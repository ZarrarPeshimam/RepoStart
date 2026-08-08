import * as vscode from 'vscode';
import { SidebarProvider } from './ui/SidebarProvider';

let sidebarProvider: SidebarProvider | undefined;

// Issue #26: Create a single OutputChannel for the entire extension.
// The user can open the Output panel (View → Output → "RepoStart") to
// see every terminal lifecycle event, service status change, and
// diagnostic message. This is the key tool for verifying that the
// terminal-close handler is working.
let outputChannel: vscode.OutputChannel | undefined;

export function activate(context: vscode.ExtensionContext): void {
  console.log('[RepoStart] Extension activating...');

  // Create the OutputChannel BEFORE the SidebarProvider so it can be
  // passed to the constructor.
  outputChannel = vscode.window.createOutputChannel('RepoStart');
  context.subscriptions.push(outputChannel);
  outputChannel.appendLine('[RepoStart] Extension activated at ' + new Date().toISOString());
  outputChannel.appendLine('[RepoStart] Open this panel (View → Output → "RepoStart") to see terminal lifecycle diagnostics.');

  sidebarProvider = new SidebarProvider(context.extensionUri, context, outputChannel);

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
      sidebarProvider?.triggerRunProject();
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

  // Issue #26: Show an information message on first activation so the
  // user knows where to find the diagnostic logs.
  outputChannel.appendLine('[RepoStart] SidebarProvider created.');
  outputChannel.appendLine('[RepoStart] onDidCloseTerminal listener registered in SidebarProvider constructor.');
  outputChannel.appendLine('[RepoStart] To test terminal close detection:');
  outputChannel.appendLine('[RepoStart]   1. Run Setup or Run Project');
  outputChannel.appendLine('[RepoStart]   2. Close a RepoStart-managed terminal (trash icon)');
  outputChannel.appendLine('[RepoStart]   3. Check this Output panel for "onDidCloseTerminal FIRED" messages');

  console.log('[RepoStart] Extension activated');
}

export function deactivate(): void {
  console.log('[RepoStart] Extension deactivating...');
  outputChannel?.appendLine('[RepoStart] Extension deactivating at ' + new Date().toISOString());
  sidebarProvider?.dispose();
  sidebarProvider = undefined;
}
