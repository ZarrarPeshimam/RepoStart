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

  async run(): Promise<EnvStatus> {
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
      const result = await this._bootstrapDir(absPath, label);
      if (result === 'configured') {
        anyConfigured = true;
      }
    }

    return anyConfigured ? 'configured' : 'not-required';
  }

  private async _bootstrapDir(dir: string, label: string): Promise<EnvStatus> {
    const envPath        = path.join(dir, '.env');
    const envExamplePath = path.join(dir, '.env.example');

    const envExists        = await this._exists(envPath);
    const envExampleExists = await this._exists(envExamplePath);

    if (envExists) {
      this.streamer.system(
        `.env already exists in [${label}] — skipping environment generation`,
        'repostart'
      );
      const ev = this.timeline.addEvent(`✓ .env present [${label}]`, 'success');
      this.timeline.updateEvent(ev.id, 'success', `.env detected in ${label}`);
      return 'configured';
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
