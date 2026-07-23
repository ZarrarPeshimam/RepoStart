export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'unknown';

export type Framework =
  | 'react'
  | 'next'
  | 'vite'
  | 'vue'
  | 'express'
  | 'fastify'
  | 'nest'
  | 'unknown';

export type ArchitectureType = 'single' | 'client-server' | 'multi-app' | 'unknown';

export interface AppFolder {
  path: string;
  relativePath: string;
  label: string;
  framework: Framework;
  isFrontend: boolean;
  isBackend: boolean;
  startScript: string | null;

  startCommand?: string;
  availableScripts: string[];
  packageManager: PackageManager;
}

export type EnvStatus = 'configured' | 'not-required' | 'pending';

export interface RepoAnalysis {
  rootPath: string;
  architecture: ArchitectureType;
  packageManager: PackageManager;
  apps: AppFolder[];
  summary: string;
  hasRootPackageJson: boolean;
  envStatus: EnvStatus;
}

export type TimelineEventStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped';

export interface TimelineEvent {
  id: string;
  label: string;
  status: TimelineEventStatus;
  timestamp: string;
  detail?: string;
}

export type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'system';
export type LogCategory = 'SYSTEM' | 'SETUP' | 'FRONTEND' | 'BACKEND' | 'ENV';

export interface LogEntry {
  id: string;
  level: LogLevel;
  source: string;   
  message: string;
  timestamp: string;
  category?: LogCategory;
}

export type ServiceState = 'running' | 'stopped' | 'starting' | 'error';

export interface ServiceStatus {
  label: string;         
  relativePath: string;
  state: ServiceState;
  pid?: number;
}

export interface SetupSummary {
  depsInstalled: boolean;
  envGenerated: boolean;
  appsStarted: boolean;
  errorCount: number;
}

export type ThemeMode = 'auto' | 'light' | 'dark';

export interface RepoStartSettings {
  autoRunAfterSetup: boolean;
  autoGenerateEnv: boolean;
  autoLaunchFrontend: boolean;
  autoLaunchBackend: boolean;
  autoOpenDashboard: boolean;
  showNotifications: boolean;
  theme: ThemeMode;
}

export const DEFAULT_SETTINGS: RepoStartSettings = {
  autoRunAfterSetup: true,
  autoGenerateEnv: true,
  autoLaunchFrontend: true,
  autoLaunchBackend: true,
  autoOpenDashboard: true,
  showNotifications: false,  
  theme: 'auto',
};

export type ExtensionToWebviewMessage =
  | { type: 'analysisResult'; payload: RepoAnalysis }
  | { type: 'timelineUpdate'; payload: TimelineEvent }
  | { type: 'logEntry'; payload: LogEntry }
  | { type: 'setupComplete'; payload: { success: boolean; message: string } }
  | { type: 'setupStarted' }
  | { type: 'clearLogs' }
  | { type: 'serviceStatusUpdate'; payload: ServiceStatus }
  | { type: 'setupSummaryUpdate'; payload: SetupSummary }
  | { type: 'settingsLoaded'; payload: RepoStartSettings }
  | { type: 'envStatusUpdate'; payload: EnvStatus };

export type WebviewToExtensionMessage =
  | { type: 'runSetup' }
  | { type: 'runProject' }
  | { type: 'ready' }
  | { type: 'saveSettings'; payload: RepoStartSettings }
  | { type: 'getSettings' }
  | { type: 'downloadReport'; payload?: { logs: LogEntry[] } }
  | { type: 'downloadTimeline' }
  | { type: 'downloadLogs' };