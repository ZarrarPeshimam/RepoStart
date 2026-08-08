import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { AppFolder, LogEntry, LogLevel, PackageManager, ServiceStatus, ServiceState } from '../types';
import { ActivityTimeline, TimelineStep } from '../services/ActivityTimeline';
import { LogStreamer } from '../services/LogStreamer';
import { now, uid } from '../utils/fs';

function runCommand(pm: PackageManager, script: string): string {
  switch (pm) {
    case 'pnpm': return `pnpm run ${script}`;
    case 'yarn': return `yarn ${script}`;
    default:     return `npm run ${script}`;
  }
}

function terminalLabel(app: AppFolder): string {
  if (app.isFrontend) { return 'RepoStart Frontend'; }
  if (app.isBackend)  { return 'RepoStart Backend'; }
  return `RepoStart ${app.label}`;
}

interface ErrorGuidance {
  pattern: RegExp;
  message: string;
}

const ERROR_PATTERNS: ErrorGuidance[] = [
  { pattern: /EADDRINUSE|address already in use|port.*in use/i, message: 'Port may already be in use. Try stopping other processes or change the port.' },
  { pattern: /cannot find module|module not found/i,             message: 'Missing module detected. Try running npm install again.' },
  { pattern: /npm error|yarn error|pnpm error/i,                message: 'Dependency installation failure detected. Check the Logs tab.' },
  { pattern: /ENOENT.*\.env/i,                                  message: 'Environment file missing. Check your .env configuration.' },
];

function detectErrorGuidance(line: string): string | null {
  for (const { pattern, message } of ERROR_PATTERNS) {
    if (pattern.test(line)) { return message; }
  }
  return null;
}

export interface StartupRunnerOptions {
  apps: AppFolder[];
  timeline: ActivityTimeline;
  streamer: LogStreamer;
  onServiceStatus?: (status: ServiceStatus) => void;
  onTerminalClosed?: (terminal: vscode.Terminal, role: string, relativePath: string) => void;
  logger?: vscode.OutputChannel;
}

interface ManagedTerminal {
  terminal: vscode.Terminal;
  role: string;
  relativePath: string;
  /** Process ID if available (VS Code 1.93+). Used as a fallback identifier. */
  processId?: number;
  /** Human-readable name used to match terminals by name as a last resort. */
  name: string;
}

export class StartupRunner {
  private apps: AppFolder[];
  private timeline: ActivityTimeline;
  private streamer: LogStreamer;
  private onServiceStatus?: (status: ServiceStatus) => void;
  private onTerminalClosed?: (terminal: vscode.Terminal, role: string, relativePath: string) => void;
  private logger?: vscode.OutputChannel;

  private managedTerminals: ManagedTerminal[] = [];

  constructor(opts: StartupRunnerOptions) {
    this.apps             = opts.apps;
    this.timeline         = opts.timeline;
    this.streamer         = opts.streamer;
    this.onServiceStatus  = opts.onServiceStatus;
    this.onTerminalClosed = opts.onTerminalClosed;
    this.logger           = opts.logger;
  }

  // ── Logging helper ──────────────────────────────────────────────
  private log(message: string): void {
    this.logger?.appendLine(`[StartupRunner] ${message}`);
  }

  async start(): Promise<void> {
    const appsWithScript = this.apps.filter((a) => a.startScript !== null || a.startCommand !== undefined);

    if (appsWithScript.length === 0) {
      this.streamer.system('No startup scripts detected - skipping service launch.');
      const event = this.timeline.addEvent(TimelineStep.STARTING_SERVICES, 'skipped');
      this.timeline.updateEvent(event.id, 'skipped', 'No start scripts found');
      return;
    }

    const parentEvent = this.timeline.addEvent(TimelineStep.STARTING_SERVICES, 'running');
    this.streamer.system('Launching services in VS Code terminals...');

    const frontendApp = appsWithScript.find((a) => a.isFrontend);
    const backendApp  = appsWithScript.find((a) => a.isBackend);
    const otherApps   = appsWithScript.filter((a) => !a.isFrontend && !a.isBackend);

    let firstTerminal: vscode.Terminal | undefined;

    if (frontendApp) {
      firstTerminal = this._launchInTerminal(frontendApp);
    }

    if (backendApp) {
      if (firstTerminal) {
        this._launchInTerminal(backendApp, firstTerminal);
      } else {
        firstTerminal = this._launchInTerminal(backendApp);
      }
    }

    for (const app of otherApps) {
      this._launchInTerminal(app);
    }

    this.timeline.updateEvent(
      parentEvent.id,
      'success',
      `${appsWithScript.length} terminal(s) launched`
    );

    this.streamer.system(
      `${appsWithScript.length} service(s) started in VS Code terminals` +
      (frontendApp && backendApp ? ' (split terminal requested)' : '')
    );

    this.log(`Started ${this.managedTerminals.length} managed terminal(s):`);
    for (const mt of this.managedTerminals) {
      this.log(`  - ${mt.role} [${mt.relativePath}] name="${mt.name}"`);
    }
  }

  private _launchInTerminal(
    app: AppFolder,
    parentTerminal?: vscode.Terminal
  ): vscode.Terminal {
    const cmd = app.startScript !== null
      ? runCommand(app.packageManager, app.startScript)
      : app.startCommand!;
    const name    = terminalLabel(app);
    const source  = `${app.startScript ?? app.startCommand} [${app.relativePath}]`;

    const eventLabel = `Starting ${name}`;
    const event = this.timeline.addEvent(eventLabel, 'running');

    this.streamer.system(`Launching: ${cmd}  (in ${app.relativePath})`, source);

    const terminalOptions: vscode.TerminalOptions = {
      name,
      cwd: app.path,
      env: process.env as Record<string, string>,
      ...(parentTerminal ? { location: { parentTerminal } } : {}),
    };

    const terminal = vscode.window.createTerminal(terminalOptions);
    terminal.show(false);
    terminal.sendText(cmd);

    const role = app.isFrontend ? 'Frontend' : app.isBackend ? 'Backend' : app.label;

    // Track this terminal as managed — store both the Terminal reference
    // AND the name so we can match by name as a fallback (issue #26).
    const managed: ManagedTerminal = {
      terminal,
      role,
      relativePath: app.relativePath,
      name,
    };

    // Try to get the process ID asynchronously (available in VS Code 1.93+).
    // This is used as a secondary identifier if the Terminal object
    // comparison fails.
    try {
      const pidPromise = terminal.processId as PromiseLike<number | undefined>;
      if (pidPromise && typeof pidPromise.then === 'function') {
        pidPromise.then((pid) => {
          if (typeof pid === 'number') {
            managed.processId = pid;
            this.log(`Terminal "${name}" processId = ${pid}`);
          }
        }, () => {
          // processId may not be available on all platforms / VS Code versions.
        });
      }
    } catch {
      // Ignore — processId is optional and only used as a fallback identifier.
    }

    this.managedTerminals.push(managed);

    this.onServiceStatus?.({
      label: role,
      relativePath: app.relativePath,
      state: 'running',
    });

    this.timeline.updateEvent(event.id, 'success', `Terminal: ${name}`);

    const logEntry: LogEntry = {
      id: uid(),
      level: 'success',
      source,
      message: `${cmd} - terminal: ${name}`,
      timestamp: now(),
      category: app.isFrontend ? 'FRONTEND' : app.isBackend ? 'BACKEND' : 'SYSTEM',
    };
    this.streamer.emit('log', logEntry);

    return terminal;
  }

  /**
   * Check if a terminal is managed by this runner.
   *
   * Uses three strategies in order:
   * 1. Reference equality (mt.terminal === terminal) — fastest, works
   *    in most cases.
   * 2. Process ID match — fallback if the Terminal object is a different
   *    wrapper around the same underlying process.
   * 3. Name match — last resort, matches by the terminal's display name.
   *
   * Called by SidebarProvider's onDidCloseTerminal listener (issue #26).
   */
  isManagedTerminal(terminal: vscode.Terminal): boolean {
    // Strategy 1: reference equality
    const byRef = this.managedTerminals.some((mt) => mt.terminal === terminal);
    if (byRef) {
      this.log(`isManagedTerminal: matched by reference for "${terminal.name}"`);
      return true;
    }

    // Strategy 2: process ID
    // (Synchronous check — processId may have been resolved already)
    // Note: we can't await terminal.processId here because this method
    // is synchronous. But if we previously stored the PID, we can
    // compare. We can't get the closed terminal's PID after it's closed,
    // so this strategy is limited. Skip for now.

    // Strategy 3: name match
    const byName = this.managedTerminals.some((mt) => mt.name === terminal.name);
    if (byName) {
      this.log(`isManagedTerminal: matched by name "${terminal.name}" (reference match failed)`);
      return true;
    }

    this.log(`isManagedTerminal: NO MATCH for terminal "${terminal.name}" (managed: ${this.managedTerminals.map(m => `"${m.name}"`).join(', ') || 'none'})`);
    return false;
  }

  /**
   * Handle terminal close — called by SidebarProvider when a terminal
   * is closed. Updates service status, records timeline event, and
   * emits a log entry.
   *
   * Returns true if the terminal was managed and handled, false otherwise.
   */
  handleTerminalClose(closedTerminal: vscode.Terminal): boolean {
    // Find the managed terminal entry — try reference first, then name.
    let idx = this.managedTerminals.findIndex((mt) => mt.terminal === closedTerminal);

    if (idx === -1) {
      // Fallback: match by name
      idx = this.managedTerminals.findIndex((mt) => mt.name === closedTerminal.name);
      if (idx !== -1) {
        this.log(`handleTerminalClose: matched by name "${closedTerminal.name}" (reference match failed)`);
      }
    }

    if (idx === -1) {
      this.log(`handleTerminalClose: terminal "${closedTerminal.name}" not found in managed list — already removed or not managed`);
      return false;
    }

    const managed = this.managedTerminals[idx];
    this.managedTerminals.splice(idx, 1);

    this.log(`handleTerminalClose: processing close for ${managed.role} [${managed.relativePath}]`);

    // Update service status to 'stopped'
    this.onServiceStatus?.({
      label: managed.role,
      relativePath: managed.relativePath,
      state: 'stopped',
    });

    // Record timeline event
    const stopEvent = this.timeline.addEvent(
      `${managed.role} service stopped`,
      'success'
    );
    this.timeline.updateEvent(
      stopEvent.id,
      'success',
      `Terminal closed by user`
    );

    // Emit log entry
    const logEntry: LogEntry = {
      id: uid(),
      level: 'system',
      source: `${managed.role} [${managed.relativePath}]`,
      message: `${managed.role} service stopped`,
      timestamp: now(),
      category: managed.role === 'Frontend' ? 'FRONTEND' : managed.role === 'Backend' ? 'BACKEND' : 'SYSTEM',
    };
    this.streamer.emit('log', logEntry);

    this.streamer.system(
      `${managed.role} service stopped (terminal closed)`,
      `${managed.role} [${managed.relativePath}]`
    );

    // Also fire the onTerminalClosed callback if provided
    this.onTerminalClosed?.(closedTerminal, managed.role, managed.relativePath);

    this.log(`handleTerminalClose: DONE — ${managed.role} marked stopped, timeline + log updated`);
    return true;
  }

  /**
   * Get a snapshot of managed terminals for diagnostic purposes.
   */
  getManagedTerminalsInfo(): Array<{ role: string; relativePath: string; name: string }> {
    return this.managedTerminals.map((mt) => ({
      role: mt.role,
      relativePath: mt.relativePath,
      name: mt.name,
    }));
  }

  killAll(): void {
    this.log(`killAll: disposing ${this.managedTerminals.length} managed terminal(s)`);
    for (const mt of this.managedTerminals) {
      try {
        mt.terminal.dispose();
        this.onServiceStatus?.({
          label: mt.role,
          relativePath: mt.relativePath,
          state: 'stopped',
        });
      } catch { /* already disposed */ }
    }
    this.managedTerminals = [];
  }

  dispose(): void {
    // No closeDisposable to dispose — terminal-close listener is managed
    // by the SidebarProvider / context.subscriptions.
  }
}
