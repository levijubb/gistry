import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';

const EXTENSION_ID = 'gistry.gistry';

suite('Extension', () => {
  test('activates without errors', async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `${EXTENSION_ID} is not installed in the test host`);
    await ext.activate();
    assert.equal(ext.isActive, true);
  });

  test('registers every command it contributes', async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID)!;
    await ext.activate();
    const contributed: string[] = (ext.packageJSON.contributes?.commands ?? []).map(
      (c: { command: string }) => c.command
    );
    const registered = new Set(await vscode.commands.getCommands(true));
    const missing = contributed.filter((c) => !registered.has(c));
    assert.deepEqual(missing, [], `Contributed but not registered: ${missing.join(', ')}`);
  });

  test('opens the history panel in an editor tab', async () => {
    await vscode.commands.executeCommand('gistry.openInEditor');
    const tab = await waitFor(() =>
      vscode.window.tabGroups.all.flatMap((g) => g.tabs).find((t) => t.label === 'Commit History')
    );
    assert.ok(tab, 'No "Commit History" tab was opened');
    await vscode.window.tabGroups.close(tab);
  });
});

async function waitFor<T>(probe: () => T | undefined, timeoutMs = 5000): Promise<T | undefined> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const value = probe();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 50));
  }
  return undefined;
}
