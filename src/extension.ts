import * as vscode from 'vscode';
import { SidebarProvider } from './ui/SidebarProvider';

let sidebarProvider: SidebarProvider | undefined;

export function activate(context: vscode.ExtensionContext): void {
  console.log('[RepoStart] Extension activating…');

  sidebarProvider = new SidebarProvider(context.extensionUri, context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SidebarProvider.VIEW_ID,
      sidebarProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('repostart.openDashboard', () => {
      vscode.commands.executeCommand('repostart.sidebarView.focus');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('repostart.runSetup', async () => {
      vscode.commands.executeCommand('repostart.sidebarView.focus');
      await new Promise<void>((resolve) => setTimeout(resolve, 400));
      sidebarProvider?.triggerSetup();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('repostart.runProject', async () => {
      vscode.commands.executeCommand('repostart.sidebarView.focus');
      await new Promise<void>((resolve) => setTimeout(resolve, 300));
      
    })
  );

  if (vscode.workspace.workspaceFolders?.length) {
    setTimeout(() => { sidebarProvider?.triggerAnalysis(); }, 800);
  }

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      sidebarProvider?.triggerAnalysis();
    })
  );

  console.log('[RepoStart] Extension activated ✓');
}

export function deactivate(): void {
  console.log('[RepoStart] Extension deactivating…');
  sidebarProvider?.dispose();
  sidebarProvider = undefined;
}
