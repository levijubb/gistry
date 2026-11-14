import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';

export interface RefInfo {
  type: 'branch' | 'remote' | 'tag';
  name: string;
}

export interface CoAuthor {
  name: string;
  email: string;
}

export interface CommitInfo {
  hash: string;
  parents: string[];
  author: string;
  email: string;
  date: number;
  subject: string;
  body: string;
  coAuthors: CoAuthor[];
  refs: RefInfo[];
}

export interface FileChange {
  path: string;
  oldPath?: string;
  status: string;
  added: number;
  removed: number;
  binary: boolean;
}

export function runGit(gitPath: string, cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      gitPath,
      ['-c', 'core.quotepath=off', '-c', 'log.showSignature=false', ...args],
      { cwd, maxBuffer: 256 * 1024 * 1024, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', LC_ALL: 'C' } },
      (err, stdout, stderr) => {
        if (err) reject(new Error((stderr || err.message).trim()));
        else resolve(stdout);
      }
    );
  });
}

export interface RefSnapshot {
  raw: string;
  byCommit: Map<string, RefInfo[]>;
  branches: string[];
  tips: Map<string, string>;
}

export async function readRefs(gitPath: string, cwd: string): Promise<RefSnapshot> {
  const raw = await runGit(gitPath, cwd, [
    'for-each-ref',
    '--format=%(refname)%1f%(objectname)%1f%(*objectname)',
    'refs/heads',
    'refs/remotes',
    'refs/tags',
  ]);
  const byCommit = new Map<string, RefInfo[]>();
  const branches: string[] = [];
  const tips = new Map<string, string>();
  for (const line of raw.split('\n')) {
    if (!line) continue;
    const [ref, obj, peeled] = line.split('\x1f');
    const target = peeled || obj;
    let info: RefInfo | undefined;
    if (ref.startsWith('refs/heads/')) {
      info = { type: 'branch', name: ref.slice(11) };
      branches.push(info.name);
      tips.set(info.name, target);
    } else if (ref.startsWith('refs/remotes/')) {
      const name = ref.slice(13);
      if (name.endsWith('/HEAD')) continue;
      info = { type: 'remote', name };
    } else if (ref.startsWith('refs/tags/')) {
      info = { type: 'tag', name: ref.slice(10) };
    }
    if (!info) continue;
    const list = byCommit.get(target) ?? [];
    list.push(info);
    byCommit.set(target, list);
  }
  return { raw, byCommit, branches, tips };
}

const CO_AUTHOR_RE = /^co-authored-by:\s*(.+?)\s*<([^>]*)>\s*$/gim;

export async function readLog(
  gitPath: string,
  cwd: string,
  revArgs: string[],
  limit: number,
  refs: Map<string, RefInfo[]>
): Promise<CommitInfo[]> {
  const out = await runGit(gitPath, cwd, [
    'log',
    '--date-order',
    `--max-count=${limit}`,
    '--format=%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%s%x1f%b%x1e',
    ...revArgs,
    '--',
  ]);
  const commits: CommitInfo[] = [];
  for (let rec of out.split('\x1e')) {
    rec = rec.replace(/^\n+/, '');
    if (!rec) continue;
    const [hash, parents, author, email, at, subject, body = ''] = rec.split('\x1f');
    const coAuthors: CoAuthor[] = [];
    for (const m of body.matchAll(CO_AUTHOR_RE)) coAuthors.push({ name: m[1], email: m[2] });
    commits.push({
      hash,
      parents: parents ? parents.split(' ') : [],
      author,
      email,
      date: Number(at),
      subject,
      body: body.trim(),
      coAuthors,
      refs: refs.get(hash) ?? [],
    });
  }
  return commits;
}

export async function countCommits(gitPath: string, cwd: string, revArgs: string[]): Promise<number> {
  const out = await runGit(gitPath, cwd, ['rev-list', '--count', ...revArgs, '--']);
  return Number(out.trim()) || 0;
}

let emptyTreeCache: string | undefined;
async function emptyTree(gitPath: string, cwd: string): Promise<string> {
  if (!emptyTreeCache) {
    emptyTreeCache = (await runGit(gitPath, cwd, ['hash-object', '-t', 'tree', '/dev/null'])).trim();
  }
  return emptyTreeCache;
}

export async function readChanges(
  gitPath: string,
  cwd: string,
  hash: string,
  parent: string | undefined
): Promise<{ base: string; files: FileChange[] }> {
  const base = parent ?? (await emptyTree(gitPath, cwd));
  const [numstat, nameStatus] = await Promise.all([
    runGit(gitPath, cwd, ['diff', '-z', '-M', '--numstat', base, hash]),
    runGit(gitPath, cwd, ['diff', '-z', '-M', '--name-status', base, hash]),
  ]);

  const files = new Map<string, FileChange>();
  const ns = nameStatus.split('\0');
  for (let i = 0; i < ns.length; ) {
    const status = ns[i++];
    if (!status) continue;
    const letter = status[0];
    if (letter === 'R' || letter === 'C') {
      const oldPath = ns[i++];
      const path = ns[i++];
      files.set(path, { path, oldPath, status: letter, added: 0, removed: 0, binary: false });
    } else {
      const path = ns[i++];
      files.set(path, { path, status: letter, added: 0, removed: 0, binary: false });
    }
  }

  const nt = numstat.split('\0');
  for (let i = 0; i < nt.length; ) {
    const head = nt[i++];
    if (!head) continue;
    const [a, d, p] = head.split('\t');
    let path = p;
    if (p === '') {
      i++;
      path = nt[i++];
    }
    const f = files.get(path);
    if (!f) continue;
    if (a === '-') f.binary = true;
    else {
      f.added = Number(a) || 0;
      f.removed = Number(d) || 0;
    }
  }
  return { base, files: [...files.values()] };
}

export function avatarUrl(email: string): string {
  const e = email.trim().toLowerCase();
  let m = /^(\d+)\+[^@]+@users\.noreply\.github\.com$/.exec(e);
  if (m) return `https://avatars.githubusercontent.com/u/${m[1]}?s=80&v=4`;
  m = /^([^@+]+)@users\.noreply\.github\.com$/.exec(e);
  if (m) return `https://github.com/${encodeURIComponent(m[1])}.png?size=80`;
  const md5 = createHash('md5').update(e).digest('hex');
  return `https://www.gravatar.com/avatar/${md5}?s=80&d=404`;
}

export interface RemoteInfo {
  kind: 'github' | 'gitlab' | 'other';
  host: string;
  owner: string;
  repo: string;
  web: string;
  prUrl?: string;
}

export async function readRemote(gitPath: string, cwd: string): Promise<RemoteInfo | undefined> {
  try {
    const names = (await runGit(gitPath, cwd, ['remote'])).split('\n').filter(Boolean);
    if (!names.length) return undefined;
    const name = names.includes('origin') ? 'origin' : names[0];
    const url = (await runGit(gitPath, cwd, ['remote', 'get-url', name])).trim();
    const m =
      /^(?:[\w.+-]+@)?([^:/\s]+):(?!\/)([^\s]+?)(?:\.git)?\/?$/.exec(url) ||
      /^(?:https?|ssh|git):\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/([^\s]+?)(?:\.git)?\/?$/.exec(url);
    if (!m) return undefined;
    const host = m[1].toLowerCase();
    const path = m[2];
    const parts = path.split('/');
    if (parts.length < 2) return undefined;
    const web = `https://${host}/${path}`;
    const kind =
      host === 'github.com' || host.includes('github') ? 'github' : host.includes('gitlab') ? 'gitlab' : 'other';
    const prUrl = kind === 'github' ? `${web}/pull/{n}` : kind === 'gitlab' ? `${web}/-/merge_requests/{n}` : undefined;
    return { kind, host, owner: parts.slice(0, -1).join('/'), repo: parts[parts.length - 1], web, prUrl };
  } catch {
    return undefined;
  }
}
