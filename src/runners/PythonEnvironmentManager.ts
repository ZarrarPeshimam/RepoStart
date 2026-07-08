import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PythonProject, PythonVenvStatus } from '../types';
import { ActivityTimeline } from '../services/ActivityTimeline';
import { LogStreamer } from '../services/LogStreamer';
import { fileExistsIn, pathExists } from '../utils/fs';

const PYTHON_INDICATOR_FILES = [
  'requirements.txt',
  'pyproject.toml',
  'setup.py',
  'Pipfile',
  'poetry.lock',
];

const VENV_DIRS = ['.venv', 'venv', 'env'];

export class PythonEnvironmentManager {
  constructor(
    private rootPath: string,
    private timeline: ActivityTimeline | null,
    private streamer: LogStreamer | null
  ) {}

  async detectPythonProjects(): Promise<PythonProject[]> {
    const pythonProjects: PythonProject[] = [];
    
    // Check root directory
    if (await this.isPythonProject(this.rootPath)) {
      const project = await this.analyzePythonProject(this.rootPath, '.');
      if (project) {
        pythonProjects.push(project);
      }
    }

    // Check subdirectories that might be Python services
    const entries = await fs.promises.readdir(this.rootPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      const dirPath = path.join(this.rootPath, entry.name);
      // Skip common non-project directories
      if (this.shouldSkipDirectory(entry.name)) continue;
      
      if (await this.isPythonProject(dirPath)) {
        const project = await this.analyzePythonProject(dirPath, entry.name);
        if (project) {
          pythonProjects.push(project);
        }
      }
    }

    return pythonProjects;
  }

  async setupPythonEnvironments(projects: PythonProject[]): Promise<void> {
    for (const project of projects) {
      await this.setupProjectEnvironment(project);
    }
  }

  private async isPythonProject(dir: string): Promise<boolean> {
    for (const file of PYTHON_INDICATOR_FILES) {
      if (await fileExistsIn(dir, file)) {
        return true;
      }
    }
    return false;
  }

  private async analyzePythonProject(
    dirPath: string,
    relativePath: string
  ): Promise<PythonProject | null> {
    this.streamer?.system(`✓ Python project detected`, 'python');
    this.streamer?.system(`✓ Python root identified: ${relativePath}/`, 'python');

    const venvPath = await this.detectVirtualEnvironment(dirPath);
    
    let venvStatus: PythonVenvStatus = 'not-required';
    let isValid = false;

    if (venvPath) {
      this.streamer?.system(`✓ Existing virtual environment found`, 'python');
      isValid = await this.validateVirtualEnvironment(venvPath);
      
      if (isValid) {
        venvStatus = 'validated';
        this.streamer?.system(`✓ Virtual environment validated`, 'python');
      } else {
        this.streamer?.system(`✗ Virtual environment invalid or corrupted`, 'python');
        // Treat invalid environment as missing
        return {
          rootPath: dirPath,
          relativePath,
          venvPath: null,
          venvStatus: 'not-required',
          isValid: false,
        };
      }
    }

    return {
      rootPath: dirPath,
      relativePath,
      venvPath,
      venvStatus,
      isValid,
    };
  }

  private async detectVirtualEnvironment(dir: string): Promise<string | null> {
    for (const venvDir of VENV_DIRS) {
      const venvPath = path.join(dir, venvDir);
      if (await pathExists(venvPath)) {
        return venvPath;
      }
    }
    return null;
  }

  private async validateVirtualEnvironment(venvPath: string): Promise<boolean> {
    const platform = os.platform();
    let pythonPath: string;

    if (platform === 'win32') {
      pythonPath = path.join(venvPath, 'Scripts', 'python.exe');
    } else {
      pythonPath = path.join(venvPath, 'bin', 'python');
    }

    return await pathExists(pythonPath);
  }

  private async setupProjectEnvironment(project: PythonProject): Promise<void> {
    // If already has a valid venv, reuse it
    if (project.venvPath && project.isValid) {
      this.streamer?.system(
        `Python Environment: Existing (${path.basename(project.venvPath)})`,
        'python'
      );
      this.streamer?.system(`Status: Reused`, 'python');
      
      const ev = this.timeline?.addEvent(
        `Reusing existing virtual environment [${project.relativePath}]`,
        'success'
      );
      if (ev) {
        this.timeline?.updateEvent(
          ev.id,
          'success',
          `Reused ${path.basename(project.venvPath)} in ${project.relativePath}`
        );
      }
      return;
    }

    // Create new virtual environment
    this.streamer?.system(`✓ Creating Python virtual environment`, 'python');
    
    const ev = this.timeline?.addEvent(
      `Creating Python virtual environment [${project.relativePath}]`,
      'running'
    );

    try {
      const venvPath = path.join(project.rootPath, '.venv');
      const cmd = 'python -m venv .venv';
      const source = `python venv [${project.relativePath}]`;

      this.streamer?.system(
        `[PYTHON] Creating virtual environment in ${project.relativePath}…`,
        source
      );

      const exitCode = this.streamer ? await this.streamer.run(cmd, project.rootPath, source) : 1;

      if (exitCode === 0) {
        this.streamer?.system(
          `✓ Virtual environment created successfully`,
          'python'
        );
        this.streamer?.system(
          `Python Environment: .venv`,
          'python'
        );
        this.streamer?.system(`Status: Created`, 'python');

        if (ev) {
          this.timeline?.updateEvent(
            ev.id,
            'success',
            `.venv created in ${project.relativePath}`
          );
        }

        // Update project with new venv info
        project.venvPath = venvPath;
        project.venvStatus = 'created';
        project.isValid = true;
      } else {
        this.streamer?.system(
          `✗ Failed to create virtual environment`,
          'python'
        );
        if (ev) {
          this.timeline?.updateEvent(
            ev.id,
            'error',
            `Failed to create venv in ${project.relativePath}`
          );
        }

        project.venvStatus = 'error';
        project.isValid = false;
      }

    } catch (err) {
      this.streamer?.system(
        `✗ Error creating virtual environment: ${(err as Error).message}`,
        'python'
      );
      if (ev) {
        this.timeline?.updateEvent(
          ev.id,
          'error',
          (err as Error).message
        );
      }

      project.venvStatus = 'error';
      project.isValid = false;
    }
  }

  private shouldSkipDirectory(name: string): boolean {
    const skipPatterns = [
      'node_modules',
      '.git',
      '.vscode',
      'dist',
      'build',
      'coverage',
      '.venv',
      'venv',
      'env',
      '__pycache__',
      '.pytest_cache',
    ];
    return skipPatterns.includes(name) || name.startsWith('.');
  }
}
