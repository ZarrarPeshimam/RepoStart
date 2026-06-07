import * as vscode from 'vscode';
import { DEFAULT_SETTINGS, RepoStartSettings } from '../types';

const SETTINGS_KEY = 'repostart.settings';

export class SettingsManager {
  constructor(private readonly context: vscode.ExtensionContext) {}

  load(): RepoStartSettings {
    const stored = this.context.globalState.get<Partial<RepoStartSettings>>(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...stored };
  }

  async save(settings: RepoStartSettings): Promise<void> {
    await this.context.globalState.update(SETTINGS_KEY, settings);
  }
}
