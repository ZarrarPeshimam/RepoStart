import * as fs from 'fs';
import * as path from 'path';
import { AppFolder, EnvStatus } from '../types';
import { ActivityTimeline } from '../services/ActivityTimeline';
import { LogStreamer } from '../services/LogStreamer';

export class EnvBootstrap {
  constructor(
    private rootPath: string,
    private timeline: ActivityTimeline,
    private streamer: LogStreamer,
    
    private apps?: AppFolder[]
  ) {}

  async run(forceOverwrite = false): Promise<EnvStatus> {
    const dirsToCheck: Array<{ absPath: string; label: string }> = [
      { absPath: this.rootPath, label: '.' },
    ];

    if (this.apps) {
      for (const app of this.apps) {
        if (app.relativePath !== '.' && app.path !== this.rootPath) {
          dirsToCheck.push({ absPath: app.path, label: app.relativePath });
        }
      }
    }

    let anyConfigured = false;

    for (const { absPath, label } of dirsToCheck) {
      const result = await this._bootstrapDir(absPath, label, forceOverwrite);
      if (result === 'configured') {
        anyConfigured = true;
      }
    }

    return anyConfigured ? 'configured' : 'not-required';
  }

  async restore(dir: string, label: string = path.basename(dir)): Promise<boolean> {
    try {
      const files = await fs.promises.readdir(dir);
      const backups = files.filter(f => f.startsWith('.env.backup-')).sort();
      
      if (backups.length === 0) {
        this.streamer.system(`No backups found in [${label}]`, 'repostart');
        return false;
      }
      
      const latestBackup = backups[backups.length - 1];
      const envPath = path.join(dir, '.env');
      const backupPath = path.join(dir, latestBackup);
      
      await fs.promises.copyFile(backupPath, envPath);
      
      this.streamer.system(`✓ Restored .env from ${latestBackup} in [${label}]`, 'repostart');
      const ev = this.timeline.addEvent(`Restored .env from ${latestBackup} [${label}]`, 'success');
      this.timeline.updateEvent(ev.id, 'success', `Restored .env from ${latestBackup} in ${label}`);
      return true;
    } catch (err) {
      this.streamer.system(`✗ Failed to restore .env in [${label}]: ${(err as Error).message}`, 'repostart');
      return false;
    }
  }

  private async _bootstrapDir(dir: string, label: string, forceOverwrite: boolean): Promise<EnvStatus> {
    const envPath        = path.join(dir, '.env');
    const envExamplePath = path.join(dir, '.env.example');

    const envExists        = await this._exists(envPath);
    const envExampleExists = await this._exists(envExamplePath);

    if (envExists && !forceOverwrite) {
      this.streamer.system(
        `.env already exists in [${label}] — skipping environment generation`,
        'repostart'
      );
      const ev = this.timeline.addEvent(`✓ .env present [${label}]`, 'success');
      this.timeline.updateEvent(ev.id, 'success', `.env detected in ${label}`);
      return 'configured';
    }

    if (envExists && forceOverwrite) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${envPath}.backup-${timestamp}`;
      try {
        await fs.promises.copyFile(envPath, backupPath);
        this.streamer.system(`Backed up existing .env to ${path.basename(backupPath)} in [${label}]`, 'repostart');
        const ev = this.timeline.addEvent(`Backed up .env [${label}]`, 'success');
        this.timeline.updateEvent(ev.id, 'success', `Backup created: ${path.basename(backupPath)}`);
      } catch (err) {
        this.streamer.system(`✗ Failed to backup .env in [${label}]: ${(err as Error).message}`, 'repostart');
      }
    }

    if (envExampleExists) {
      const ev = this.timeline.addEvent(
        `Generating .env from .env.example [${label}]`,
        'running'
      );
      try {
        const contents = await fs.promises.readFile(envExamplePath, 'utf-8');
        await fs.promises.writeFile(envPath, contents, 'utf-8');
        this.streamer.system(
          `✓ .env generated from .env.example in [${label}]`,
          'repostart'
        );
        this.timeline.updateEvent(ev.id, 'success', `.env generated in ${label}`);
        return 'configured';
      } catch (err) {
        this.streamer.system(
          `✗ Failed to generate .env in [${label}]: ${(err as Error).message}`,
          'repostart'
        );
        this.timeline.updateEvent(ev.id, 'error', (err as Error).message);
        return 'not-required';
      }
    }

    return 'not-required';
  }

  private async _exists(p: string): Promise<boolean> {
    try {
      await fs.promises.access(p);
      return true;
    } catch {
      return false;
    }
  }
}
