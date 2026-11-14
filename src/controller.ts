import * as path from 'node:path';
import * as vscode from 'vscode';
import { avatarUrl, countCommits, type RemoteInfo, readChanges, readLog, readRefs, readRemote, runGit } from './git';
import type { API, Repository } from './gitApi';
import { fetchGitHubPrs } from './github';
import { computeStacks, detectTrunk, type PrInfo, type StackResult } from './stacks';

const PR_TTL = 2 * 60 * 1000;

export const ALL_BRANCHES = '__all__';

type Mode = 'view' | 'panel';

// Painted with the very first frame, before main.js has loaded, so the view never flashes
// blank. main.js adopts this markup instead of re-rendering it (see skeletonHtml there).
const BOOT_SHELL = `<div class="shell"><div class="card"><header class="hdr"><span class="title">Commit History</span><span class="spacer"></span><span class="ref-btn ghost" aria-hidden="true"></span></header><div class="scroller"><div class="skel" aria-hidden="true">${'<div class="sk-row"><i></i><i></i><i></i><i></i><i></i></div>'.repeat(14)}</div></div></div></div>`;

export class HistoryController implements vscode.Disposable {
  private repo: Repository | undefined;
  private ref: string | null = null;
  private limit: number;
  private sig = '';
  private uncommitted = -1;
  private busy = false;
  private pending: { force: boolean } | undefined;
  private ready = false;
  private timer: NodeJS.Timeout | undefined;
  private readonly disposables: vscode.Disposable[] = [];
  private repoDisposables: vscode.Disposable[] = [];
  private remote: { root: string; info: RemoteInfo | undefined } | undefined;
  private prCache:
    | { root: string; at: number; connected: boolean; prs: Map<string, PrInfo>; version: number; inflight?: boolean }
    | undefined;
  private stackCache: { key: string; result: StackResult } | undefined;

  constructor(
    private readonly webview: vscode.Webview,
    private readonly ctx: vscode.ExtensionContext,
    private readonly api: API,
    private readonly mode: Mode,
    private readonly onClose?: () => void
  ) {
    this.limit = this.pageSize();
    webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(ctx.extensionUri, 'media')],
    };
    webview.html = this.html();

    this.disposables.push(
      webview.onDidReceiveMessage((m) => this.onMessage(m)),
      api.onDidOpenRepository(() => {
        if (!this.repo) this.selectRepo(this.pickRepo());
      }),
      api.onDidChangeState(() => this.reload(true)),
      api.onDidCloseRepository((r) => {
        if (r === this.repo) this.selectRepo(this.pickRepo());
      }),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('gistry')) {
          this.limit = Math.max(this.limit, this.pageSize());
          this.reload(true);
        }
      })
    );
    this.selectRepo(this.pickRepo(), false);
  }

  dispose() {
    clearTimeout(this.timer);
    this.repoDisposables.forEach((d) => d.dispose());
    this.disposables.forEach((d) => d.dispose());
  }

  get root(): string | undefined {
    return this.repo?.rootUri.fsPath;
  }

  refresh() {
    this.reload(true);
  }

  private pageSize() {
    return Math.max(20, vscode.workspace.getConfiguration('gistry').get<number>('pageSize', 200));
  }

  private pickRepo(): Repository | undefined {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const r = this.api.getRepository(editor.document.uri);
      if (r) return r;
    }
    return this.api.repositories[0];
  }

  private selectRepo(repo: Repository | undefined, load = true) {
    this.repoDisposables.forEach((d) => d.dispose());
    this.repoDisposables = [];
    this.repo = repo;
    this.sig = '';
    this.uncommitted = -1;
    this.limit = this.pageSize();
    this.remote = undefined;
    this.prCache = undefined;
    this.stackCache = undefined;
    this.ref = repo ? this.ctx.workspaceState.get<string | null>(this.refKey(), null) : null;
    if (repo) {
      this.repoDisposables.push(
        repo.state.onDidChange(() => {
          clearTimeout(this.timer);
          this.timer = setTimeout(() => this.reload(false), 350);
        })
      );
    }
    if (load) this.reload(true);
  }

  private refKey() {
    return `gistry.ref:${this.repo?.rootUri.fsPath}`;
  }

  private post(msg: unknown) {
    if (this.ready) void this.webview.postMessage(msg);
  }

  private git(args: string[]) {
    return runGit(this.api.git.path, this.repo!.rootUri.fsPath, args);
  }

  private countUncommitted(repo: Repository): number {
    const s = repo.state;
    const set = new Set<string>();
    for (const list of [s.workingTreeChanges, s.indexChanges, s.mergeChanges, s.untrackedChanges ?? []]) {
      for (const c of list) set.add(c.uri.fsPath);
    }
    return set.size;
  }

  private async reload(force: boolean) {
    if (!this.ready) return;
    if (this.busy) {
      this.pending = { force: force || !!this.pending?.force };
      return;
    }
    this.busy = true;
    try {
      await this.load(force);
    } catch (err) {
      this.post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      this.busy = false;
      const p = this.pending;
      this.pending = undefined;
      if (p) void this.reload(p.force);
    }
  }

  private async load(force: boolean) {
    const repo = this.repo;
    const repos = this.api.repositories.map((r) => ({
      root: r.rootUri.fsPath,
      name: path.basename(r.rootUri.fsPath),
    }));

    if (!repo) {
      this.post({ type: 'empty', reason: this.api.state === 'initialized' ? 'norepo' : 'loading', mode: this.mode });
      return;
    }

    const gitPath = this.api.git.path;
    const root = repo.rootUri.fsPath;
    const head = repo.state.HEAD;
    const uncommitted = this.countUncommitted(repo);
    const refs = await readRefs(gitPath, root);

    const sig = [head?.name, head?.commit, this.ref, this.limit, refs.raw].join('|');
    if (!force && sig === this.sig) {
      if (uncommitted !== this.uncommitted) {
        this.uncommitted = uncommitted;
        this.post({ type: 'status', uncommitted });
      }
      return;
    }

    if (this.ref && this.ref !== ALL_BRANCHES && !refs.branches.includes(this.ref)) {
      this.ref = null;
      void this.ctx.workspaceState.update(this.refKey(), null);
    }

    if (!head?.commit) {
      this.sig = sig;
      this.post({
        type: 'empty',
        reason: 'nocommits',
        mode: this.mode,
        repo: { root, name: path.basename(root) },
        repos,
        uncommitted,
      });
      return;
    }

    this.post({ type: 'loading' });

    let revArgs: string[];
    let label: string;
    if (this.ref === ALL_BRANCHES) {
      revArgs = ['--branches', 'HEAD'];
      label = 'All branches';
    } else if (this.ref) {
      revArgs = [`refs/heads/${this.ref}`];
      label = this.ref;
    } else {
      revArgs = ['HEAD'];
      label = head.name ?? head.commit.slice(0, 7);
    }

    if (this.remote?.root !== root) this.remote = { root, info: await readRemote(gitPath, root) };
    const remoteInfo = this.remote.info;
    const forge = this.pullRequests(root, remoteInfo);

    const [commits, total, stacks] = await Promise.all([
      readLog(gitPath, root, revArgs, this.limit, refs.byCommit),
      countCommits(gitPath, root, revArgs),
      this.stacks(gitPath, root, refs, head.name, forge.prs, forge.version),
    ]);

    const remote = vscode.workspace.getConfiguration('gistry').get<string>('avatars', 'remote') === 'remote';
    const avatars: Record<string, string> = {};
    if (remote) {
      for (const c of commits) {
        const key = c.email.toLowerCase();
        if (key && !avatars[key]) avatars[key] = avatarUrl(c.email);
      }
    }

    this.sig = sig;
    this.uncommitted = uncommitted;
    const tipIsHead =
      this.ref === null || this.ref === head.name || (this.ref === ALL_BRANCHES && commits[0]?.hash === head.commit);

    this.post({
      type: 'state',
      mode: this.mode,
      repo: { root, name: path.basename(root) },
      repos,
      branches: refs.branches.sort((a, b) => (a === head.name ? -1 : b === head.name ? 1 : a.localeCompare(b))),
      selected: { value: this.ref, label, mainName: this.ref === ALL_BRANCHES ? (head.name ?? null) : label },
      head: { name: head.name ?? null, commit: head.commit },
      tipIsHead,
      commits,
      total,
      hasMore: total > commits.length,
      uncommitted,
      avatars,
      trunk: stacks.trunk,
      stacks: stacks.stacks,
      prs: stacks.prs,
      remote: remoteInfo ? { kind: remoteInfo.kind, web: remoteInfo.web, prUrl: remoteInfo.prUrl } : null,
      github: { available: remoteInfo?.host === 'github.com' && this.prsEnabled(), connected: forge.connected },
    });
  }

  private prsEnabled() {
    return vscode.workspace.getConfiguration('gistry').get<boolean>('github.pullRequests', true);
  }

  private pullRequests(root: string, remote: RemoteInfo | undefined, interactive = false) {
    if (!this.prCache || this.prCache.root !== root) {
      this.prCache = { root, at: 0, connected: false, prs: new Map(), version: 0 };
    }
    const cache = this.prCache;
    const stale = Date.now() - cache.at > PR_TTL;
    if (remote && this.prsEnabled() && (stale || interactive) && !cache.inflight) {
      cache.inflight = true;
      void fetchGitHubPrs(remote, interactive)
        .then(({ connected, prs }) => {
          const before = JSON.stringify([cache.connected, [...cache.prs]]);
          cache.connected = connected;
          cache.prs = prs;
          cache.at = Date.now();
          if (JSON.stringify([connected, [...prs]]) !== before) {
            cache.version++;
            if (this.prCache === cache) void this.reload(true);
          }
        })
        .finally(() => (cache.inflight = false));
    }
    return cache;
  }

  private async stacks(
    gitPath: string,
    root: string,
    refs: Awaited<ReturnType<typeof readRefs>>,
    headName: string | undefined,
    prs: Map<string, PrInfo>,
    prVersion: number
  ): Promise<StackResult> {
    const key = `${root}|${prVersion}|${headName}|${refs.raw}`;
    if (this.stackCache?.key === key) return this.stackCache.result;
    let result: StackResult;
    try {
      const trunk = (await detectTrunk(gitPath, root, refs.branches, headName)) ?? '';
      result = trunk ? await computeStacks(gitPath, root, refs.tips, trunk, prs) : { trunk, stacks: [], prs: {} };
    } catch {
      result = { trunk: '', stacks: [], prs: {} };
    }
    this.stackCache = { key, result };
    return result;
  }

  private async onMessage(m: any) {
    try {
      switch (m?.type) {
        case 'ready':
          this.ready = true;
          await this.reload(true);
          break;
        case 'refresh':
          if (this.prCache) this.prCache.at = 0;
          await this.reload(true);
          break;
        case 'selectRef':
          this.ref = m.ref ?? null;
          this.limit = this.pageSize();
          await this.ctx.workspaceState.update(this.refKey(), this.ref);
          await this.reload(true);
          break;
        case 'selectRepo': {
          const repo = this.api.repositories.find((r) => r.rootUri.fsPath === m.root);
          if (repo && repo !== this.repo) this.selectRepo(repo);
          break;
        }
        case 'loadMore':
          this.limit += this.pageSize();
          await this.reload(true);
          break;
        case 'details': {
          if (!this.repo) return;
          const { base, files } = await readChanges(this.api.git.path, this.repo.rootUri.fsPath, m.hash, m.parent);
          this.post({ type: 'details', hash: m.hash, base, files });
          break;
        }
        case 'openDiff':
          await this.openDiff(m);
          break;
        case 'copy':
          await vscode.env.clipboard.writeText(String(m.text ?? ''));
          vscode.window.setStatusBarMessage(`$(check) Copied ${m.label ?? 'to clipboard'}`, 2000);
          break;
        case 'openUrl': {
          const url = String(m.url ?? '');
          if (/^https:\/\//.test(url)) await vscode.env.openExternal(vscode.Uri.parse(url));
          break;
        }
        case 'connectGitHub':
          if (this.repo && this.remote?.info) this.pullRequests(this.repo.rootUri.fsPath, this.remote.info, true);
          break;
        case 'openScm':
          await vscode.commands.executeCommand('workbench.view.scm');
          break;
        case 'close':
          this.onClose?.();
          break;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (m?.type === 'details') this.post({ type: 'details', hash: m.hash, error: message, files: [] });
      else void vscode.window.showErrorMessage(`Gistry: ${message}`);
    }
  }

  private async openDiff(m: { hash: string; base: string; path: string; oldPath?: string; status: string }) {
    if (!this.repo) return;
    const root = this.repo.rootUri;
    const rightUri = vscode.Uri.joinPath(root, m.path);
    const leftUri = vscode.Uri.joinPath(root, m.oldPath ?? m.path);
    const left = this.api.toGitUri(leftUri, m.base);
    const right = this.api.toGitUri(rightUri, m.hash);
    const short = m.hash.slice(0, 7);
    const title = `${path.basename(m.path)} (${short}^ ↔ ${short})`;
    await vscode.commands.executeCommand('vscode.diff', left, right, title, { preview: true });
  }

  private html(): string {
    const w = this.webview;
    const media = (f: string) => w.asWebviewUri(vscode.Uri.joinPath(this.ctx.extensionUri, 'media', f));
    const nonce = [...Array(32)].map(() => Math.floor(Math.random() * 36).toString(36)).join('');
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${w.cspSource} https: data:; style-src ${w.cspSource} 'unsafe-inline'; font-src ${w.cspSource}; script-src 'nonce-${nonce}';" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="stylesheet" href="${media('main.css')}" />
<title>Commit History</title>
</head>
<body data-mode="${this.mode}">
<div id="app">${BOOT_SHELL}</div>
<script nonce="${nonce}" src="${media('main.js')}"></script>
</body>
</html>`;
  }
}

export async function commitCommand(
  api: API,
  action: 'copySha' | 'copyMessage' | 'createBranch' | 'checkout',
  arg: { hash?: string; root?: string } | undefined
) {
  if (!arg?.hash || !arg.root) return;
  const repo = api.repositories.find((r) => r.rootUri.fsPath === arg.root);
  const short = arg.hash.slice(0, 7);
  switch (action) {
    case 'copySha':
      await vscode.env.clipboard.writeText(arg.hash);
      vscode.window.setStatusBarMessage(`$(check) Copied ${short}`, 2000);
      break;
    case 'copyMessage': {
      const msg = await runGit(api.git.path, arg.root, ['log', '-1', '--format=%B', arg.hash]);
      await vscode.env.clipboard.writeText(msg.trim());
      vscode.window.setStatusBarMessage(`$(check) Copied message of ${short}`, 2000);
      break;
    }
    case 'createBranch': {
      if (!repo) return;
      const name = await vscode.window.showInputBox({
        prompt: `Create a branch at ${short} and check it out`,
        placeHolder: 'Branch name',
        validateInput: (v) => (/^[^\s~^:?*[\\]+$/.test(v) ? undefined : 'Enter a valid branch name'),
      });
      if (name) await repo.createBranch(name, true, arg.hash);
      break;
    }
    case 'checkout': {
      if (!repo) return;
      const ok = await vscode.window.showWarningMessage(
        `Check out ${short}? This puts the repository in a detached HEAD state.`,
        { modal: true },
        'Checkout'
      );
      if (ok === 'Checkout') await repo.checkout(arg.hash);
      break;
    }
  }
}
