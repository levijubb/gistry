import * as vscode from 'vscode';
import type { RemoteInfo } from './git';
import type { PrInfo } from './stacks';

const SCOPES = ['repo'];

export async function githubSession(interactive: boolean): Promise<vscode.AuthenticationSession | undefined> {
  try {
    return await vscode.authentication.getSession(
      'github',
      SCOPES,
      interactive ? { createIfNone: true } : { silent: true }
    );
  } catch {
    return undefined;
  }
}

export async function fetchGitHubPrs(
  remote: RemoteInfo,
  interactive = false
): Promise<{ connected: boolean; prs: Map<string, PrInfo> }> {
  const prs = new Map<string, PrInfo>();
  if (remote.kind !== 'github' || remote.host !== 'github.com') return { connected: false, prs };
  const session = await githubSession(interactive);
  if (!session) return { connected: false, prs };

  const fullName = `${remote.owner}/${remote.repo}`;
  const get = async (query: string) => {
    const res = await fetch(`https://api.github.com/repos/${fullName}/pulls?${query}`, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'gistry-vscode',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    return (await res.json()) as any[];
  };

  try {
    const [open, closed] = await Promise.all([
      get('state=open&per_page=100'),
      get('state=closed&sort=updated&direction=desc&per_page=50'),
    ]);
    for (const p of [...closed, ...open]) {
      if (p?.head?.repo?.full_name && p.head.repo.full_name.toLowerCase() !== fullName.toLowerCase()) continue;
      const branch = p?.head?.ref;
      if (typeof branch !== 'string') continue;
      prs.set(branch, {
        number: p.number,
        title: p.title,
        url: p.html_url,
        base: p.base?.ref,
        state: p.state === 'open' ? (p.draft ? 'draft' : 'open') : p.merged_at ? 'merged' : 'closed',
      });
    }
  } catch {}
  return { connected: true, prs };
}
