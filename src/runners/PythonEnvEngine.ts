import * as path from 'path';
import { PythonProject } from '../types';
import { ActivityTimeline } from '../services/ActivityTimeline';
import { LogStreamer } from '../services/LogStreamer';
import { pathExists } from '../utils/fs';

export interface PythonEnvEngineOptions {
  pythonProjects: PythonProject[];
  timeline: ActivityTimeline;
  streamer: LogStreamer;
}

export class PythonEnvEngine {
  private pythonProjects: PythonProject[];
  private timeline: ActivityTimeline;
  private streamer: LogStreamer;

  constructor(opts: PythonEnvEngineOptions) {
    this.pythonProjects = opts.pythonProjects;
    this.timeline       = opts.timeline;
    this.streamer       = opts.streamer;
  }

  async run(): Promise<PythonProject[]> {
    const updatedProjects: PythonProject[] = [];

    for (const project of this.pythonProjects) {
      this.streamer.system(`Checking Python environment in ${project.relativePath}...`);

      // ✓ Python project detected
      this.timeline.addEvent('✓ Python project detected', 'success');
      this.streamer.system('✓ Python project detected');

      // ✓ Python root identified: backend/
      let relPathWithSlash = project.relativePath;
      if (relPathWithSlash === '.') {
        relPathWithSlash = './';
      } else if (!relPathWithSlash.endsWith('/')) {
        relPathWithSlash += '/';
      }
      const rootIdentifiedMsg = `✓ Python root identified: ${relPathWithSlash}`;
      this.timeline.addEvent(rootIdentifiedMsg, 'success');
      this.streamer.system(rootIdentifiedMsg);

      // Search for existing virtual environment
      const venvNames = ['.venv', 'venv', 'env'];
      let foundVenvName: string | undefined;
      let isValid = false;

      for (const name of venvNames) {
        const venvPath = path.join(project.path, name);
        if (await pathExists(venvPath)) {
          foundVenvName = name;
          // Validate: check interpreter
          const interpreterName = process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python';
          const interpreterPath = path.join(venvPath, interpreterName);
          if (await pathExists(interpreterPath)) {
            isValid = true;
          }
          break;
        }
      }

      if (foundVenvName && isValid) {
        // ✓ Existing virtual environment found
        this.timeline.addEvent('✓ Existing virtual environment found', 'success');
        this.streamer.system('✓ Existing virtual environment found');

        // ✓ Virtual environment validated
        this.timeline.addEvent('✓ Virtual environment validated', 'success');
        this.streamer.system('✓ Virtual environment validated');

        // ✓ Reusing existing virtual environment
        const reuseMsg = `✓ Reusing existing virtual environment (${foundVenvName})`;
        this.timeline.addEvent(reuseMsg, 'success');
        this.streamer.system(reuseMsg);

        updatedProjects.push({
          ...project,
          venvName: foundVenvName,
          venvStatus: 'Reused',
        });
      } else {
        if (foundVenvName) {
          this.streamer.system(`Existing environment ${foundVenvName} is corrupted or missing interpreter. Creating a new one.`);
        }

        // Creating Python virtual environment
        const createEvent = this.timeline.addEvent('Creating Python virtual environment', 'running');
        this.streamer.system('Creating Python virtual environment...');

        // Command: python -m venv .venv
        const cmd = 'python -m venv .venv';
        const source = `python -m venv [${project.relativePath}]`;

        const exitCode = await this.streamer.run(cmd, project.path, source);

        if (exitCode === 0) {
          this.timeline.updateEvent(createEvent.id, 'success');
          
          this.timeline.addEvent('✓ Creating Python virtual environment', 'success');
          this.streamer.system('✓ Creating Python virtual environment');

          updatedProjects.push({
            ...project,
            venvName: '.venv',
            venvStatus: 'Created',
          });
        } else {
          this.timeline.updateEvent(createEvent.id, 'error', `Failed to create virtual environment (exit code ${exitCode})`);
          this.streamer.system(`✗ Failed to create virtual environment in ${project.relativePath}`);
          updatedProjects.push({
            ...project,
            venvStatus: undefined,
          });
        }
      }
    }

    return updatedProjects;
  }
}
