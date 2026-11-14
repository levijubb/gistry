import * as vscode from 'vscode';
import { commitCommand, HistoryController } from './controller';
import type { API, GitExtension } from './gitApi';

const controllers = new Set<HistoryController>();

export async function activate(ctx: vscode.ExtensionContext) {
  const ext = vscode.extensions.getExtension<GitExtension>('vscode.git');
  if (!ext) {
    void vscode.window.showWarningMessage('Gistry needs the built-in Git extension to be enabled.');
    return;
  }
  const api: API = (await ext.activate()).getAPI(1);

  const track = (c: HistoryController) => {
    controllers.add(c);
    return new vscode.Disposable(() => {
      controllers.delete(c);
      c.dispose();
    });
  };

  ctx.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'gistry.history',
      {
        resolveWebviewView(view) {
          const c = new HistoryController(view.webview, ctx, api, 'view');
          const d = track(c);
          view.onDidDispose(() => d.dispose());
        },
      },
      { webviewOptions: { retainContextWhenHidden: true } }
    ),

    vscode.commands.registerCommand('gistry.openInEditor', () => {
      const panel = vscode.window.createWebviewPanel('gistry.panel', 'Commit History', vscode.ViewColumn.Active, {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(ctx.extensionUri, 'media')],
      });
      panel.iconPath = vscode.Uri.joinPath(ctx.extensionUri, 'media', 'icon.svg');
      const c = new HistoryController(panel.webview, ctx, api, 'panel', () => panel.dispose());
      const d = track(c);
      panel.onDidDispose(() => d.dispose());
    }),

    vscode.commands.registerCommand('gistry.focus', () => vscode.commands.executeCommand('gistry.history.focus')),
    vscode.commands.registerCommand('gistry.refresh', () => controllers.forEach((c) => c.refresh())),
    vscode.commands.registerCommand('gistry.copySha', (a) => commitCommand(api, 'copySha', a)),
    vscode.commands.registerCommand('gistry.copyMessage', (a) => commitCommand(api, 'copyMessage', a)),
    vscode.commands.registerCommand('gistry.createBranch', (a) => commitCommand(api, 'createBranch', a)),
    vscode.commands.registerCommand('gistry.checkout', (a) => commitCommand(api, 'checkout', a)),
    new vscode.Disposable(() => controllers.forEach((c) => c.dispose()))
  );
}

export function deactivate() {}
