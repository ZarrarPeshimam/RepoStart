import * as path from 'path';
import {
  AppFolder,
  ArchitectureType,
  EnvStatus,
  Framework,
  PackageManager,
  RepoAnalysis,
} from '../types';
import { fileExistsIn, listDir, pathExists, readJsonFile } from '../utils/fs';

const CLIENT_DIRS = ['client', 'frontend', 'web', 'ui', 'app'];

const SERVER_DIRS = ['server', 'backend', 'api', 'service'];

const MULTI_DIRS  = ['apps', 'services', 'packages', 'libs'];

const STARTUP_SCRIPT_PRIORITY = ['dev', 'start', 'server', 'serve', 'develop'];

const NODE_ENTRY_FILES = ['index.js', 'server.js', 'app.js', 'main.js', 'src/index.js', 'src/server.js'];

async function detectPackageManager(dir: string): Promise<PackageManager> {
  if (await fileExistsIn(dir, 'pnpm-lock.yaml'))   { return 'pnpm'; }
  if (await fileExistsIn(dir, 'yarn.lock'))          { return 'yarn'; }
  if (await fileExistsIn(dir, 'package-lock.json')) { return 'npm'; }
  return 'npm';
}

interface PackageJson {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  name?: string;
  workspaces?: string[] | { packages: string[] };
}

function detectFramework(pkg: PackageJson): Framework {
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  if ('next' in allDeps)                                   { return 'next'; }
  if ('react' in allDeps || 'react-dom' in allDeps)        { return 'react'; }
  if ('vite' in allDeps)                                   { return 'vite'; }
  if ('vue' in allDeps)                                    { return 'vue'; }
  if ('@nestjs/core' in allDeps)                           { return 'nest'; }
  if ('fastify' in allDeps)                                { return 'fastify'; }
  if ('express' in allDeps)                                { return 'express'; }
  return 'unknown';
}

function isFrontendFramework(fw: Framework): boolean {
  return ['react', 'next', 'vite', 'vue'].includes(fw);
}

function isBackendFramework(fw: Framework): boolean {
  return ['express', 'fastify', 'nest'].includes(fw);
}

function detectStartScript(scripts: Record<string, string> = {}): string | null {
  for (const candidate of STARTUP_SCRIPT_PRIORITY) {
    if (candidate in scripts) { return candidate; }
  }
  return null;
}

async function buildAppFolder(
  absolutePath: string,
  relativePath: string,
  label: string,
  rootPackageManager: PackageManager
): Promise<AppFolder | null> {
  const pkgPath = path.join(absolutePath, 'package.json');
  const pkg = await readJsonFile<PackageJson>(pkgPath);
  if (!pkg) { return null; }

  const framework   = detectFramework(pkg);
  const scripts     = pkg.scripts ?? {};
  const startScript = detectStartScript(scripts);

  const lowerLabel      = label.toLowerCase();
  const nameHintFront   = CLIENT_DIRS.some((d) => lowerLabel.includes(d));
  const nameHintBack    = SERVER_DIRS.some((d) => lowerLabel.includes(d));

  const isFrontend = nameHintFront || isFrontendFramework(framework);
  const isBackend  = nameHintBack  || isBackendFramework(framework);

  const localPm      = await detectPackageManager(absolutePath);
  const packageManager = localPm !== 'npm' ? localPm : rootPackageManager;

  let startCommand: string | undefined;
  if (startScript === null) {
    // Also honour the `main` field in package.json as a candidate entry point
    const mainField = (pkg as PackageJson & { main?: string }).main;
    const candidates = mainField
      ? [mainField, ...NODE_ENTRY_FILES]
      : NODE_ENTRY_FILES;

    for (const file of candidates) {
      if (await fileExistsIn(absolutePath, file)) {
        startCommand = `node ${file}`;
        break;
      }
    }
  }

  return {
    path: absolutePath,
    relativePath,
    label,
    framework,
    isFrontend,
    isBackend,
    startScript,
    startCommand,
    availableScripts: Object.keys(scripts),
    packageManager,
  };
}

interface ArchitectureProbe {
  type: ArchitectureType;
  appDirs: Array<{ abs: string; rel: string; label: string }>;
}

async function probeArchitecture(rootPath: string): Promise<ArchitectureProbe> {
  const entries  = await listDir(rootPath);
  const dirNames = entries.filter((e) => e.isDirectory()).map((e) => e.name.toLowerCase());

  const multiMatch = MULTI_DIRS.find((m) => dirNames.includes(m));
  if (multiMatch) {
    const containerAbs = path.join(rootPath, multiMatch);
    const subEntries   = await listDir(containerAbs);
    const subDirs      = subEntries
      .filter((e) => e.isDirectory())
      .map((e) => ({
        abs:   path.join(containerAbs, e.name),
        rel:   `${multiMatch}/${e.name}`,
        label: e.name,
      }));

    if (subDirs.length > 0) {
      return { type: 'multi-app', appDirs: subDirs };
    }
  }

  const clientMatch = CLIENT_DIRS.find((c) => dirNames.includes(c));
  const serverMatch = SERVER_DIRS.find((s) => dirNames.includes(s));

  if (clientMatch && serverMatch) {
    return {
      type: 'client-server',
      appDirs: [
        { abs: path.join(rootPath, clientMatch), rel: clientMatch, label: clientMatch },
        { abs: path.join(rootPath, serverMatch), rel: serverMatch, label: serverMatch },
      ],
    };
  }

  const hasRootPkg = await fileExistsIn(rootPath, 'package.json');
  if (hasRootPkg && serverMatch) {
    return {
      type: 'client-server',
      appDirs: [
        { abs: rootPath,                         rel: '.',         label: 'frontend'   },
        { abs: path.join(rootPath, serverMatch), rel: serverMatch, label: serverMatch  },
      ],
    };
  }

  return {
    type: 'single',
    appDirs: [{ abs: rootPath, rel: '.', label: 'root' }],
  };
}

function buildSummary(analysis: Omit<RepoAnalysis, 'summary'>): string {
  const { architecture, apps, packageManager } = analysis;

  if (architecture === 'single') {
    const app = apps[0];
    return `Single ${capitalize(app?.framework ?? 'Node.js')} app · ${packageManager}`;
  }

  if (architecture === 'client-server') {
    const fe = apps.find((a) => a.isFrontend);
    const be = apps.find((a) => a.isBackend);
    const feLabel = fe ? `${capitalize(fe.framework)} (${fe.relativePath})` : '?';
    const beLabel = be ? `${capitalize(be.framework)} (${be.relativePath})` : '?';
    return `Frontend: ${feLabel} · Backend: ${beLabel} · ${packageManager}`;
  }

  if (architecture === 'multi-app') {
    return `Multi-App · ${apps.length} packages · ${packageManager}`;
  }

  return `${apps.length} app(s) · ${packageManager}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export async function analyzeRepository(rootPath: string): Promise<RepoAnalysis> {
  const hasRootPackageJson = await fileExistsIn(rootPath, 'package.json');
  const rootPackageManager = await detectPackageManager(rootPath);

  const probe = await probeArchitecture(rootPath);

  const appFolderResults = await Promise.all(
    probe.appDirs.map((d) =>
      buildAppFolder(d.abs, d.rel, d.label, rootPackageManager)
    )
  );

  const apps: AppFolder[] = appFolderResults.filter(
    (a): a is AppFolder => a !== null
  );

  if (apps.length === 0 && hasRootPackageJson) {
    const rootApp = await buildAppFolder(rootPath, '.', 'root', rootPackageManager);
    if (rootApp) { apps.push(rootApp); }
  }

  const architecture: ArchitectureType =
    apps.length <= 1 ? 'single' : probe.type;

  const partial: Omit<RepoAnalysis, 'summary'> = {
    rootPath,
    architecture,
    packageManager: rootPackageManager,
    apps,
    hasRootPackageJson,
    envStatus: 'pending',
  };

  return {
    ...partial,
    summary: buildSummary(partial),
  };
}

export async function isNodeRepository(rootPath: string): Promise<boolean> {
  return pathExists(path.join(rootPath, 'package.json'));
}
