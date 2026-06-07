import * as vscode from 'vscode';
import * as path from 'path';
import { getDashboardHTML } from './DashboardWebview';
import { analyzeRepository } from '../analyzers/RepositoryAnalyzer';
import { ActivityTimeline, TimelineStep } from '../services/ActivityTimeline';
import { LogStreamer } from '../services/LogStreamer';
import { SetupEngine } from '../runners/SetupEngine';
import { StartupRunner } from '../runners/StartupRunner';
import { EnvBootstrap } from '../runners/EnvBootstrap';
import { SettingsManager } from '../services/SettingsManager';
import {
  AppFolder,
  EnvStatus,
  ExtensionToWebviewMessage,
  LogEntry,
  RepoAnalysis,
  RepoStartSettings,
  ServiceStatus,
  SetupSummary,
  TimelineEvent,
  WebviewToExtensionMessage,
} from '../types';

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly VIEW_ID = 'repostart.sidebarView';

  private _view?: vscode.WebviewView;
  private _analysis?: RepoAnalysis;
  private _startupRunner?: StartupRunner;
  private _setupRunning = false;
  private _settingsManager: SettingsManager;

  private _summary: SetupSummary = {
    depsInstalled: false,
    envGenerated: false,
    appsStarted: false,
    errorCount: 0,
  };

  private _serviceStatuses: ServiceStatus[] = [];

  private _timelineEvents: TimelineEvent[] = [];

  private _logs: LogEntry[] = [];

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext
  ) {
    this._settingsManager = new SettingsManager(_context);
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = getDashboardHTML(webviewView.webview, this._extensionUri);

    webviewView.webview.onDidReceiveMessage(
      (message: WebviewToExtensionMessage) => {
        switch (message.type) {
          case 'ready':
            if (this._analysis) {
              this._postMessage({ type: 'analysisResult', payload: this._analysis });
            } else {
              this._triggerAnalysis();
            }
            this._sendSettings();
            break;

          case 'runSetup':
            this._runSetup();
            break;

          case 'runProject':
            this._runProject();
            break;

          case 'getSettings':
            this._sendSettings();
            break;

          case 'saveSettings':
            this._settingsManager.save(message.payload).then(() => {
              this._sendSettings();
              if (this._getSettings().showNotifications) {
                vscode.window.showInformationMessage('RepoStart: Settings saved ✓');
              }
            });
            break;

          case 'downloadReport':
            this._downloadReport();
            break;

          case 'downloadTimeline':
            this._downloadTimeline();
            break;

          case 'downloadLogs':
            this._downloadLogs();
            break;
        }
      }
    );

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible && !this._analysis) {
        this._triggerAnalysis();
      }
    });
  }


  focus(): void {
    this._view?.show(true);
  }

  async triggerAnalysis(): Promise<void> {
    return this._triggerAnalysis();
  }

  async triggerSetup(): Promise<void> {
    return this._runSetup();
  }

  dispose(): void {
    this._startupRunner?.killAll();
  }

  private async _triggerAnalysis(): Promise<void> {
    const rootPath = this._getWorkspaceRoot();
    if (!rootPath) {
      this._postMessage({
        type: 'setupComplete',
        payload: { success: false, message: 'No workspace folder open.' },
      });
      return;
    }
    try {
      const analysis = await analyzeRepository(rootPath);
      this._analysis = analysis;
      this._postMessage({ type: 'analysisResult', payload: analysis });
    } catch (err) {
      vscode.window.showErrorMessage(
        `RepoStart: Analysis failed — ${(err as Error).message}`
      );
    }
  }

  private _getSettings(): RepoStartSettings {
    return this._settingsManager.load();
  }

  private _sendSettings(): void {
    this._postMessage({ type: 'settingsLoaded', payload: this._getSettings() });
  }


  private async _runSetup(): Promise<void> {
    if (this._setupRunning) {
      vscode.window.showWarningMessage('RepoStart: Setup is already running.');
      return;
    }

    const rootPath = this._getWorkspaceRoot();
    if (!rootPath) {
      vscode.window.showErrorMessage('RepoStart: No workspace folder open.');
      return;
    }

    const settings = this._getSettings();

    this._setupRunning = true;
    this._summary = { depsInstalled: false, envGenerated: false, appsStarted: false, errorCount: 0 };
    this._serviceStatuses = [];
    this._timelineEvents = [];
    this._logs = [];

    this._postMessage({ type: 'setupStarted' });
    this._postMessage({ type: 'clearLogs' });

    const timeline = new ActivityTimeline();
    const streamer = new LogStreamer();

    timeline.on('update', (event: TimelineEvent) => {
      this._postMessage({ type: 'timelineUpdate', payload: event });
      // Accumulate: upsert by id so updates overwrite the original add
      const idx = this._timelineEvents.findIndex((e) => e.id === event.id);
      if (idx >= 0) { this._timelineEvents[idx] = event; }
      else { this._timelineEvents.push(event); }
    });

    streamer.on('log', (entry: LogEntry) => {
      this._postMessage({ type: 'logEntry', payload: entry });
      this._logs.push(entry);
    });

    try {
      const detectEvent = timeline.addEvent('✓ Repository detected', 'running');
      streamer.system('RepoStart starting setup…');

      let analysis = this._analysis;
      if (!analysis) {
        analysis = await analyzeRepository(rootPath);
        this._analysis = analysis;
        this._postMessage({ type: 'analysisResult', payload: analysis });
      }
      timeline.updateEvent(detectEvent.id, 'success', `Root: ${rootPath}`);

      const archEvent = timeline.addEvent('✓ Architecture analyzed', 'running');

      const fe = analysis.apps.find((a) => a.isFrontend);
      const be = analysis.apps.find((a) => a.isBackend);
      if (fe) {
        const fev = timeline.addEvent(`✓ Frontend detected (${fe.relativePath})`, 'success');
        timeline.updateEvent(fev.id, 'success', fe.framework);
      }
      if (be) {
        const bev = timeline.addEvent(`✓ Backend detected (${be.relativePath})`, 'success');
        timeline.updateEvent(bev.id, 'success', be.framework);
      }

      const pmEv = timeline.addEvent('✓ Package manager detected', 'success');
      timeline.updateEvent(pmEv.id, 'success', analysis.packageManager);

      streamer.system(`Architecture: ${analysis.architecture} · ${analysis.apps.length} app(s)`);
      timeline.updateEvent(
        archEvent.id,
        'success',
        `${analysis.architecture} — ${analysis.apps.map((a) => a.relativePath).join(', ')}`
      );

      if (analysis.apps.length === 0) {
        timeline.updateEvent(archEvent.id, 'error', 'No Node.js packages found');
        throw new Error('No installable packages detected in this repository.');
      }

      const setupEngine = new SetupEngine({ apps: analysis.apps, timeline, streamer });
      const installResult = await setupEngine.run();

      this._summary.depsInstalled = installResult.success;
      if (!installResult.success) {
        this._summary.errorCount++;
        const settings2 = this._getSettings();
        if (settings2.showNotifications) {
          vscode.window.showWarningMessage(
            `RepoStart: Install failed for: ${installResult.failedFolders.join(', ')}. Check Logs tab.`
          );
        }
      }

      let envStatus: EnvStatus = 'not-required';
      if (settings.autoGenerateEnv) {
        const envBootstrap = new EnvBootstrap(rootPath, timeline, streamer, analysis.apps);
        envStatus = await envBootstrap.run();
      } else {
        const ev = timeline.addEvent('Environment generation disabled in settings', 'skipped');
        timeline.updateEvent(ev.id, 'skipped');
      }

      this._summary.envGenerated = envStatus === 'configured';

      analysis.envStatus = envStatus;
      this._analysis = analysis;
      this._postMessage({ type: 'analysisResult', payload: analysis });
      this._postMessage({ type: 'envStatusUpdate', payload: envStatus });

      if (settings.autoRunAfterSetup) {
        await this._launchApps(analysis.apps, timeline, streamer, settings);
        this._summary.appsStarted = true;
      } else {
        const skipEv = timeline.addEvent('Auto Run disabled — skipping service launch', 'skipped');
        timeline.updateEvent(skipEv.id, 'skipped');
      }

      const completeEvent = timeline.addEvent(TimelineStep.COMPLETE, 'success');
      timeline.updateEvent(completeEvent.id, 'success', '✓ Applications running');
      streamer.system('✓ RepoStart setup complete!');

      this._postMessage({ type: 'setupSummaryUpdate', payload: this._summary });
      this._postMessage({
        type: 'setupComplete',
        payload: { success: true, message: 'Setup complete — services running' },
      });

      if (settings.showNotifications) {
        vscode.window.showInformationMessage('RepoStart: Setup complete!');
      }
    } catch (err) {
      const message = (err as Error).message;
      streamer.system(`✗ Setup failed: ${message}`);
      this._summary.errorCount++;
      this._postMessage({ type: 'setupSummaryUpdate', payload: this._summary });
      this._postMessage({ type: 'setupComplete', payload: { success: false, message } });
      vscode.window.showErrorMessage(`RepoStart: Setup failed — ${message}`);
    } finally {
      this._setupRunning = false;
    }
  }

  private async _runProject(): Promise<void> {
    if (this._setupRunning) {
      vscode.window.showWarningMessage('RepoStart: Setup is already running.');
      return;
    }

    const rootPath = this._getWorkspaceRoot();
    if (!rootPath) {
      vscode.window.showErrorMessage('RepoStart: No workspace folder open.');
      return;
    }

    const analysis = this._analysis;
    if (!analysis || analysis.apps.length === 0) {
      vscode.window.showWarningMessage('RepoStart: Run Setup first to analyze the repository.');
      return;
    }

    const settings = this._getSettings();
    const timeline = new ActivityTimeline();
    const streamer = new LogStreamer();
    this._timelineEvents = [];
    this._logs = [];

    timeline.on('update', (event: TimelineEvent) => {
      this._postMessage({ type: 'timelineUpdate', payload: event });
      const idx = this._timelineEvents.findIndex((e) => e.id === event.id);
      if (idx >= 0) { this._timelineEvents[idx] = event; }
      else { this._timelineEvents.push(event); }
    });
    streamer.on('log', (entry: LogEntry) => {
      this._postMessage({ type: 'logEntry', payload: entry });
      this._logs.push(entry);
    });

    this._postMessage({ type: 'clearLogs' });
    streamer.system('RepoStart: Run Project — launching applications…');

    try {
      await this._launchApps(analysis.apps, timeline, streamer, settings);
      this._postMessage({
        type: 'setupComplete',
        payload: { success: true, message: 'Applications launched' },
      });
    } catch (err) {
      const message = (err as Error).message;
      this._postMessage({ type: 'setupComplete', payload: { success: false, message } });
    }
  }

  private async _launchApps(
    apps: AppFolder[],
    timeline: ActivityTimeline,
    streamer: LogStreamer,
    settings: RepoStartSettings
  ): Promise<void> {
    const filtered = apps.filter((app) => {
      if (app.isFrontend && !settings.autoLaunchFrontend) { return false; }
      if (app.isBackend  && !settings.autoLaunchBackend)  { return false; }
      return true;
    });

    const runner = new StartupRunner({
      apps: filtered,
      timeline,
      streamer,
      onServiceStatus: (status: ServiceStatus) => {
        const idx = this._serviceStatuses.findIndex(
          (s) => s.relativePath === status.relativePath
        );
        if (idx >= 0) {
          this._serviceStatuses[idx] = status;
        } else {
          this._serviceStatuses.push(status);
        }
        this._postMessage({ type: 'serviceStatusUpdate', payload: status });
      },
    });

    this._startupRunner?.killAll();
    this._startupRunner = runner;

    await runner.start();
  }

  private async _downloadReport(): Promise<void> {
    const analysis = this._analysis;
    if (!analysis) {
      vscode.window.showWarningMessage('RepoStart: No analysis data available.');
      return;
    }

    const repoName = path.basename(analysis.rootPath);
    const timestamp = new Date().toISOString();

    const fe = analysis.apps.find((a) => a.isFrontend);
    const be = analysis.apps.find((a) => a.isBackend);

    const errorEntries = this._logs.filter((e) => e.level === 'error');

    const lines: string[] = [
      '══════════════════════════════════════════',
      '  RepoStart Setup Report',
      '══════════════════════════════════════════',
      '',
      `Repository:       ${repoName}`,
      `Timestamp:        ${timestamp}`,
      `Root Path:        ${analysis.rootPath}`,
      '',
      '── Architecture ───────────────────────────',
      `Architecture:     ${analysis.architecture}`,
      `Frontend:         ${fe ? `${fe.framework} (${fe.relativePath})` : 'None'}`,
      `Backend:          ${be ? `${be.framework} (${be.relativePath})` : 'None'}`,
      `Package Manager:  ${analysis.packageManager}`,
      '',
      '── Environment ────────────────────────────',
      `Environment:      ${analysis.envStatus === 'configured' ? '✓ Configured' : 'Not Required'}`,
      '',
      '── Setup Results ──────────────────────────',
      `Dependencies:     ${this._summary.depsInstalled ? '✓ Installed' : '✗ Failed'}`,
      `Environment:      ${this._summary.envGenerated  ? '✓ Generated' : 'Not Required'}`,
      `Applications:     ${this._summary.appsStarted   ? '✓ Started'  : 'Not Started'}`,
      `Errors:           ${this._summary.errorCount}`,
      '',
      '── Service Status ─────────────────────────',
      ...this._serviceStatuses.map(
        (s) => `${s.label.padEnd(16)}  ${s.state === 'running' ? '🟢 Running' : '🔴 Stopped'}`
      ),
      '',
      '── Apps Detected ──────────────────────────',
      ...analysis.apps.map(
        (a) =>
          `${a.relativePath.padEnd(20)}  ${a.framework}  ${a.isFrontend ? '[frontend]' : a.isBackend ? '[backend]' : '[app]'}  start: ${a.startScript ?? (a.startCommand ? `(${a.startCommand})` : 'none')}`
      ),
      '',
      '── Error Summary ──────────────────────────',
      ...(errorEntries.length === 0
        ? ['  No errors recorded.']
        : errorEntries.map((e) => {
            const time = new Date(e.timestamp).toLocaleTimeString('en-US', {
              hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
            });
            return `✗ ${time}  [${e.source}]  ${e.message}`;
          })),
      '',
      '══════════════════════════════════════════',
      '  Generated by RepoStart',
      '══════════════════════════════════════════',
    ];

    const content = lines.join('\n');
    const defaultUri = vscode.Uri.file(
      path.join(analysis.rootPath, 'repostart-setup-report.txt')
    );

    const saveUri = await vscode.window.showSaveDialog({
      defaultUri,
      filters: { 'Text Files': ['txt'] },
    });

    if (saveUri) {
      const encoder = new TextEncoder();
      await vscode.workspace.fs.writeFile(saveUri, encoder.encode(content));
      vscode.window.showInformationMessage(
        `RepoStart: Setup report saved to ${path.basename(saveUri.fsPath)}`
      );
    }
  }

  private async _downloadTimeline(): Promise<void> {
    if (this._timelineEvents.length === 0) {
      vscode.window.showWarningMessage('RepoStart: No timeline events available. Run Setup first.');
      return;
    }

    const analysis = this._analysis;
    const rootPath = analysis?.rootPath ?? this._getWorkspaceRoot() ?? '.';
    const repoName = path.basename(rootPath);
    const timestamp = new Date().toISOString();

    const statusIcon = (status: import('../types').TimelineEventStatus): string => {
      switch (status) {
        case 'success': return '✓';
        case 'error':   return '✗';
        case 'running': return '▶';
        case 'skipped': return '○';
        default:        return '·';
      }
    };

    const lines: string[] = [
      '══════════════════════════════════════════',
      '  RepoStart Timeline Report',
      '══════════════════════════════════════════',
      '',
      `Repository:  ${repoName}`,
      `Exported:    ${timestamp}`,
      `Events:      ${this._timelineEvents.length}`,
      '',
      '── Timeline ───────────────────────────────',
      '',
      ...this._timelineEvents.map((e) => {
        const icon = statusIcon(e.status);
        const time = new Date(e.timestamp).toLocaleTimeString('en-US', {
          hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
        const detail = e.detail ? `  (${e.detail})` : '';
        return `${icon}  ${time}  ${e.label}${detail}`;
      }),
      '',
      '══════════════════════════════════════════',
      '  Generated by RepoStart',
      '══════════════════════════════════════════',
    ];

    const content = lines.join('\n');
    const defaultUri = vscode.Uri.file(path.join(rootPath, 'repostart-timeline.txt'));

    const saveUri = await vscode.window.showSaveDialog({
      defaultUri,
      filters: { 'Text Files': ['txt'] },
    });

    if (saveUri) {
      const encoder = new TextEncoder();
      await vscode.workspace.fs.writeFile(saveUri, encoder.encode(content));
      vscode.window.showInformationMessage(
        `RepoStart: Timeline saved to ${path.basename(saveUri.fsPath)}`
      );
    }
  }

  private async _downloadLogs(): Promise<void> {
    if (this._logs.length === 0) {
      vscode.window.showWarningMessage('RepoStart: No logs available. Run Setup first.');
      return;
    }

    const analysis = this._analysis;
    const rootPath = analysis?.rootPath ?? this._getWorkspaceRoot() ?? '.';
    const repoName = path.basename(rootPath);
    const timestamp = new Date().toISOString();

    const lines: string[] = [
      '══════════════════════════════════════════',
      '  RepoStart Log Export',
      '══════════════════════════════════════════',
      '',
      `Repository:  ${repoName}`,
      `Exported:    ${timestamp}`,
      `Entries:     ${this._logs.length}`,
      '',
      '── Logs ───────────────────────────────────',
      '',
      ...this._logs.map((e) => {
        const cat = e.category
          ? e.category
          : e.level === 'error'
          ? 'SYSTEM'
          : e.source.toLowerCase().includes('frontend') || e.source.toLowerCase().includes('client')
          ? 'FRONTEND'
          : e.source.toLowerCase().includes('backend') || e.source.toLowerCase().includes('server')
          ? 'BACKEND'
          : e.level === 'system'
          ? 'SYSTEM'
          : 'SETUP';
        const time = new Date(e.timestamp).toLocaleTimeString('en-US', {
          hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
        return `[${cat}] ${time}  ${e.message}`;
      }),
      '',
      '══════════════════════════════════════════',
      '  Generated by RepoStart',
      '══════════════════════════════════════════',
    ];

    const content = lines.join('\n');
    const defaultUri = vscode.Uri.file(path.join(rootPath, 'repostart-logs.txt'));

    const saveUri = await vscode.window.showSaveDialog({
      defaultUri,
      filters: { 'Text Files': ['txt'] },
    });

    if (saveUri) {
      const encoder = new TextEncoder();
      await vscode.workspace.fs.writeFile(saveUri, encoder.encode(content));
      vscode.window.showInformationMessage(
        `RepoStart: Logs saved to ${path.basename(saveUri.fsPath)}`
      );
    }
  }

  private _postMessage(message: ExtensionToWebviewMessage): void {
    if (this._view?.webview) {
      this._view.webview.postMessage(message);
    }
  }

  private _getWorkspaceRoot(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }
}
