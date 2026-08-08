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
  /** Human-readable name used for diagnostics only (NOT for matching). */
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

  /**
   * Issue #26 fix: Track terminals that were explicitly killed by killAll().
   * When onDidCloseTerminal fires for these, we ignore them — they were
   * killed by us, not by the user, so they should NOT trigger a
   * "service stopped" status update.
   *
   * This prevents the "toggle" bug where restarting services causes the
   * old terminal's close event to mark the new terminal as stopped.
   */
  private _killedTerminals = new Set<vscode.Terminal>();

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

    // Track this terminal as managed — reference equality is used for
    // matching (NOT name match, which caused the toggle bug in issue #26).
    const managed: ManagedTerminal = {
      terminal,
      role,
      relativePath: app.relativePath,
      name,
    };

    // Try to get the process ID asynchronously (available in VS Code 1.93+).
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
      // Ignore — processId is optional and only used for diagnostics.
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
   * Uses REFERENCE EQUALITY ONLY (mt.terminal === terminal).
   *
   * We do NOT match by name — matching by name caused a toggle bug where
   * restarting services would make the old terminal's close event
   * incorrectly match the new terminal (which has the same name) and
   * mark it as stopped.
   *
   * Called by SidebarProvider's onDidCloseTerminal listener (issue #26).
   */
  isManagedTerminal(terminal: vscode.Terminal): boolean {
    // If this terminal was explicitly killed by killAll(), ignore it.
    // This is the key fix for the toggle bug.
    if (this._killedTerminals.has(terminal)) {
      this.log(`isManagedTerminal: terminal "${terminal.name}" was killed by killAll() — ignoring close event`);
      return false;
    }

    // Reference equality only.
    const byRef = this.managedTerminals.some((mt) => mt.terminal === terminal);
    if (byRef) {
      this.log(`isManagedTerminal: matched by reference for "${terminal.name}"`);
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
    // If this terminal was explicitly killed by killAll(), ignore it.
    if (this._killedTerminals.has(closedTerminal)) {
      this.log(`handleTerminalClose: terminal "${closedTerminal.name}" was killed by killAll() — ignoring (not a user-initiated close)`);
      this._killedTerminals.delete(closedTerminal);
      return false;
    }

    // Reference equality only — do NOT match by name.
    const idx = this.managedTerminals.findIndex((mt) => mt.terminal === closedTerminal);

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

  /**
   * Kill all managed terminals.
   *
   * IMPORTANT: We clear `managedTerminals` BEFORE disposing so that
   * if onDidCloseTerminal fires synchronously during dispose, the
   * terminal is already gone from the list and won't be matched.
   *
   * We also add each terminal to `_killedTerminals` so that when
   * onDidCloseTerminal fires asynchronously LATER (for the old
   * terminals), the handler ignores them — they were killed by us,
   * not by the user, so they should NOT mark the new (replacement)
   * terminals as stopped.
   */
  killAll(): void {
    // Snapshot the list and clear it FIRST.
    const toKill = this.managedTerminals.splice(0);
    this.log(`killAll: disposing ${toKill.length} managed terminal(s) (list cleared first)`);

    for (const mt of toKill) {
      try {
        // Mark this terminal as killed so the async close event is ignored.
        this._killedTerminals.add(mt.terminal);

        mt.terminal.dispose();

        this.onServiceStatus?.({
          label: mt.role,
          relativePath: mt.relativePath,
          state: 'stopped',
        });
      } catch { /* already disposed */ }
    }

    // Note: we do NOT clear _killedTerminals here. The terminals stay
    // in the set until their close events fire and are ignored, at
    // which point handleTerminalClose removes them individually.
    // This set is on the OLD runner instance, which gets disposed
    // after killAll() returns, so memory is reclaimed when the
    // runner is garbage-collected.
  }

  dispose(): void {
    // No closeDisposable to dispose — terminal-close listener is managed
    // by the SidebarProvider / context.subscriptions.
  }
}
