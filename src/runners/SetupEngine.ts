import { AppFolder, LogCategory, PackageManager } from '../types';
import { ActivityTimeline, TimelineStep } from '../services/ActivityTimeline';
import { LogStreamer } from '../services/LogStreamer';

function installCommand(pm: PackageManager): string {
  switch (pm) {
    case 'pnpm': return 'pnpm install';
    case 'yarn': return 'yarn install';
    default:     return 'npm install';
  }
}

function categoryForApp(app: AppFolder): LogCategory {
  if (app.isFrontend) { return 'FRONTEND'; }
  if (app.isBackend)  { return 'BACKEND'; }
  return 'SETUP';
}

export interface SetupEngineOptions {
  apps: AppFolder[];
  timeline: ActivityTimeline;
  streamer: LogStreamer;
}

export interface SetupResult {
  success: boolean;
  failedFolders: string[];
}

export class SetupEngine {
  private apps: AppFolder[];
  private timeline: ActivityTimeline;
  private streamer: LogStreamer;

  constructor(opts: SetupEngineOptions) {
    this.apps     = opts.apps;
    this.timeline = opts.timeline;
    this.streamer = opts.streamer;
  }

  async run(): Promise<SetupResult> {
    const failedFolders: string[] = [];
    const parentEvent = this.timeline.addEvent(TimelineStep.INSTALLING_DEPS, 'running');

    this.streamer.system('Starting dependency installation…');

    for (const app of this.apps) {
      const category = categoryForApp(app);
      const isfe = app.isFrontend;
      const isbe = app.isBackend;

      const roleLabel = isfe ? 'frontend' : isbe ? 'backend' : app.relativePath;
      const startLabel = isfe
        ? '✓ Installing frontend dependencies'
        : isbe
        ? '✓ Installing backend dependencies'
        : `Installing [${app.relativePath}]`;

      const childEvent = this.timeline.addEvent(startLabel, 'running');

      const cmd    = installCommand(app.packageManager);
      const source = `${app.packageManager} install [${app.relativePath}]`;

      this.streamer.system(
        `[${category}] Installing dependencies in ${app.relativePath} using ${app.packageManager}…`,
        source
      );

      const exitCode = await this.streamer.run(cmd, app.path, source);

      if (exitCode === 0) {
        const doneLabel = isfe
          ? '✓ Frontend dependencies installed'
          : isbe
          ? '✓ Backend dependencies installed'
          : `${app.relativePath} ready`;
        this.timeline.updateEvent(childEvent.id, 'success', doneLabel);
      } else {
        this.timeline.updateEvent(childEvent.id, 'error', `Exit code ${exitCode}`);
        failedFolders.push(app.relativePath);
      }
    }

    const success = failedFolders.length === 0;
    this.timeline.updateEvent(
      parentEvent.id,
      success ? 'success' : 'error',
      success ? 'All dependencies installed' : `${failedFolders.length} folder(s) failed`
    );

    return { success, failedFolders };
  }
}
