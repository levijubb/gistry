import { runGit } from './git';

export type PrState = 'open' | 'draft' | 'merged' | 'closed';

export interface PrInfo {
  number: number;
  title?: string;
  state?: PrState;
  url?: string;
  base?: string;
}

export interface StackBranch {
  name: string;
  tip: string;
  parent: string;
  depth: number;
  commits: string[];
  needsRestack: boolean;
  source: 'graphite' | 'pr' | 'history';
  pr?: PrInfo;
}

export interface Stack {
  trunk: string;
  branches: StackBranch[];
}

export interface StackResult {
  trunk: string;
  stacks: Stack[];
  prs: Record<string, PrInfo>;
}

const MAX_BRANCHES = 80;
const MAX_SEGMENT = 300;

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k]);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function detectTrunk(
  gitPath: string,
  cwd: string,
  branches: string[],
  head: string | undefined
): Promise<string | undefined> {
  try {
    const remoteHead = (
      await runGit(gitPath, cwd, ['symbolic-ref', '-q', '--short', 'refs/remotes/origin/HEAD'])
    ).trim();
    const name = remoteHead.slice(remoteHead.indexOf('/') + 1);
    if (name && branches.includes(name)) return name;
  } catch {}
  for (const b of ['main', 'master', 'trunk', 'develop', 'dev']) if (branches.includes(b)) return b;
  return head ?? branches[0];
}

interface GraphiteMeta {
  parent?: string;
  pr?: PrInfo;
}

async function readGraphite(gitPath: string, cwd: string): Promise<Map<string, GraphiteMeta>> {
  const out = new Map<string, GraphiteMeta>();
  let list = '';
  try {
    list = await runGit(gitPath, cwd, ['for-each-ref', '--format=%(refname)%1f%(objectname)', 'refs/branch-metadata/']);
  } catch {
    return out;
  }
  const entries = list
    .split('\n')
    .filter(Boolean)
    .slice(0, 200)
    .map((l) => l.split('\x1f'));
  await mapLimit(entries, 8, async ([ref, obj]) => {
    try {
      const json = JSON.parse(await runGit(gitPath, cwd, ['cat-file', '-p', obj]));
      const meta: GraphiteMeta = {};
      if (typeof json.parentBranchName === 'string') meta.parent = json.parentBranchName;
      const p = json.prInfo;
      if (p && typeof p.number === 'number') {
        const st = String(p.state ?? '').toUpperCase();
        meta.pr = {
          number: p.number,
          title: typeof p.title === 'string' ? p.title : undefined,
          url: typeof p.url === 'string' ? p.url : undefined,
          base: typeof p.base === 'string' ? p.base : undefined,
          state:
            st === 'MERGED'
              ? 'merged'
              : st === 'CLOSED'
                ? 'closed'
                : p.isDraft
                  ? 'draft'
                  : st === 'OPEN'
                    ? 'open'
                    : undefined,
        };
      }
      out.set(ref.slice('refs/branch-metadata/'.length), meta);
    } catch {}
  });
  return out;
}

async function revList(gitPath: string, cwd: string, tip: string, exclude: string): Promise<string[]> {
  try {
    const out = await runGit(gitPath, cwd, [
      'rev-list',
      '--first-parent',
      `--max-count=${MAX_SEGMENT}`,
      tip,
      `^${exclude}`,
      '--',
    ]);
    return out.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

async function isAncestor(gitPath: string, cwd: string, a: string, b: string): Promise<boolean> {
  try {
    await runGit(gitPath, cwd, ['merge-base', '--is-ancestor', a, b]);
    return true;
  } catch {
    return false;
  }
}

export async function computeStacks(
  gitPath: string,
  cwd: string,
  tips: Map<string, string>,
  trunk: string,
  prs: Map<string, PrInfo>
): Promise<StackResult> {
  const graphite = await readGraphite(gitPath, cwd);

  let unmerged: string[] = [];
  try {
    const out = await runGit(gitPath, cwd, [
      'for-each-ref',
      '--no-merged',
      trunk,
      '--format=%(refname:short)',
      'refs/heads/',
    ]);
    unmerged = out.split('\n').filter((b) => b && b !== trunk && tips.has(b));
  } catch {
    unmerged = [];
  }
  const candidates = unmerged.slice(0, MAX_BRANCHES);
  const candSet = new Set(candidates);

  const tipOwners = new Map<string, string[]>();
  for (const b of candidates) {
    const t = tips.get(b)!;
    tipOwners.set(t, [...(tipOwners.get(t) ?? []), b]);
  }

  const parents = new Map<string, { parent: string; source: StackBranch['source'] }>();
  await mapLimit(candidates, 8, async (b) => {
    const pr = prs.get(b);
    const declared =
      graphite.get(b)?.parent ?? (pr && (pr.state === 'open' || pr.state === 'draft') ? pr.base : undefined);
    if (declared && declared !== b && (declared === trunk || candSet.has(declared))) {
      parents.set(b, { parent: declared, source: graphite.get(b)?.parent ? 'graphite' : 'pr' });
      return;
    }
    const chain = await revList(gitPath, cwd, tips.get(b)!, trunk);
    for (let i = 1; i < chain.length; i++) {
      const owners = (tipOwners.get(chain[i]) ?? []).filter((o) => o !== b);
      if (owners.length) {
        parents.set(b, { parent: owners.sort()[0], source: 'history' });
        return;
      }
    }
    parents.set(b, { parent: trunk, source: 'history' });
  });

  for (const b of candidates) {
    const seen = new Set<string>([b]);
    let cur = parents.get(b)?.parent;
    while (cur && cur !== trunk && candSet.has(cur)) {
      if (seen.has(cur)) {
        parents.set(b, { parent: trunk, source: 'history' });
        break;
      }
      seen.add(cur);
      cur = parents.get(cur)?.parent;
    }
  }

  const children = new Map<string, string[]>();
  const roots: string[] = [];
  for (const b of candidates) {
    const p = parents.get(b)!.parent;
    if (p === trunk || !candSet.has(p)) roots.push(b);
    else children.set(p, [...(children.get(p) ?? []), b]);
  }

  const prOf = (b: string): PrInfo | undefined => prs.get(b) ?? graphite.get(b)?.pr;

  const stacks: Stack[] = [];
  for (const root of roots.sort()) {
    const order: { name: string; depth: number }[] = [];
    const walk = (b: string, depth: number) => {
      order.push({ name: b, depth });
      for (const c of (children.get(b) ?? []).sort()) walk(c, depth + 1);
    };
    walk(root, 0);
    if (order.length < 2) continue;

    const branches = await mapLimit(order, 8, async ({ name, depth }) => {
      const { parent, source } = parents.get(name)!;
      const p = candSet.has(parent) ? parent : trunk;
      const tip = tips.get(name)!;
      const [commits, onTop] = await Promise.all([
        revList(gitPath, cwd, tip, p),
        p === trunk ? Promise.resolve(true) : isAncestor(gitPath, cwd, tips.get(p)!, tip),
      ]);
      return { name, tip, parent: p, depth, commits, needsRestack: !onTop, source, pr: prOf(name) } as StackBranch;
    });
    const seen = new Map<string, number>();
    for (const b of branches) for (const h of b.commits) seen.set(h, (seen.get(h) ?? 0) + 1);
    for (const b of branches) b.commits = b.commits.filter((h) => seen.get(h) === 1);
    stacks.push({ trunk, branches });
  }

  const prRecord: Record<string, PrInfo> = {};
  for (const b of new Set([...candidates, ...prs.keys()])) {
    const p = prOf(b);
    if (p) prRecord[b] = p;
  }
  return { trunk, stacks, prs: prRecord };
}
