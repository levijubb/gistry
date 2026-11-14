import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { avatarUrl, countCommits, readChanges, readLog, readRefs, readRemote } from '../../git';

const GIT = 'git';

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'gistry-test-'));
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: 'Ada',
    GIT_AUTHOR_EMAIL: 'ada@example.com',
    GIT_COMMITTER_NAME: 'Ada',
    GIT_COMMITTER_EMAIL: 'ada@example.com',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
  };
  const git = (...args: string[]) => execFileSync(GIT, args, { cwd: dir, env, stdio: 'pipe' }).toString();

  git('init', '-q', '-b', 'main');
  writeFileSync(join(dir, 'a.txt'), 'one\n');
  git('add', '.');
  git('commit', '-q', '-m', 'feat: first');
  git('tag', '-a', 'v1.0.0', '-m', 'v1.0.0');

  git('checkout', '-q', '-b', 'feature');
  writeFileSync(join(dir, 'a.txt'), 'one\ntwo\nthree\n');
  git('commit', '-q', '-am', 'feat: grow a.txt', '-m', 'Co-authored-by: Claude <noreply@anthropic.com>');

  git('checkout', '-q', 'main');
  renameSync(join(dir, 'a.txt'), join(dir, 'b.txt'));
  git('add', '-A');
  git('commit', '-q', '-m', 'refactor: rename a to b');
  git('merge', '-q', '--no-ff', '-X', 'theirs', 'feature', '-m', 'Merge branch feature');
  git('remote', 'add', 'origin', 'git@github.com:octo/hello-world.git');
  return dir;
}

describe('git helpers', () => {
  let repo: string;
  before(() => {
    repo = makeRepo();
  });
  after(() => rmSync(repo, { recursive: true, force: true }));

  test('readRefs lists branches and peels annotated tags to their commit', async () => {
    const refs = await readRefs(GIT, repo);
    assert.deepEqual([...refs.branches].sort(), ['feature', 'main']);
    const first = execFileSync(GIT, ['rev-list', '--max-parents=0', 'HEAD'], { cwd: repo }).toString().trim();
    assert.deepEqual(refs.byCommit.get(first), [{ type: 'tag', name: 'v1.0.0' }]);
  });

  test('readLog returns commits newest first with parents and co-authors', async () => {
    const refs = await readRefs(GIT, repo);
    const log = await readLog(GIT, repo, ['HEAD'], 50, refs.byCommit);
    assert.equal(log.length, 4);
    assert.equal(log[0].subject, 'Merge branch feature');
    assert.equal(log[0].parents.length, 2);
    assert.deepEqual(
      log[0].refs.map((r) => r.name),
      ['main']
    );

    const coAuthored = log.find((c) => c.subject === 'feat: grow a.txt');
    assert.ok(coAuthored);
    assert.deepEqual(coAuthored.coAuthors, [{ name: 'Claude', email: 'noreply@anthropic.com' }]);
    assert.equal(coAuthored.author, 'Ada');
    assert.equal(coAuthored.email, 'ada@example.com');
  });

  test('readLog respects the limit and countCommits reports the total', async () => {
    const refs = await readRefs(GIT, repo);
    assert.equal((await readLog(GIT, repo, ['HEAD'], 2, refs.byCommit)).length, 2);
    assert.equal(await countCommits(GIT, repo, ['HEAD']), 4);
    assert.equal(await countCommits(GIT, repo, ['feature']), 2);
  });

  test('readChanges reports line counts and renames', async () => {
    const refs = await readRefs(GIT, repo);
    const log = await readLog(GIT, repo, ['HEAD'], 50, refs.byCommit);

    const grow = log.find((c) => c.subject === 'feat: grow a.txt')!;
    const { files } = await readChanges(GIT, repo, grow.hash, grow.parents[0]);
    assert.deepEqual(files, [{ path: 'a.txt', status: 'M', added: 2, removed: 0, binary: false }]);

    const rename = log.find((c) => c.subject.startsWith('refactor'))!;
    const renamed = await readChanges(GIT, repo, rename.hash, rename.parents[0]);
    assert.equal(renamed.files[0].status, 'R');
    assert.equal(renamed.files[0].oldPath, 'a.txt');
    assert.equal(renamed.files[0].path, 'b.txt');
  });

  test('readChanges diffs a root commit against the empty tree', async () => {
    const first = execFileSync(GIT, ['rev-list', '--max-parents=0', 'HEAD'], { cwd: repo }).toString().trim();
    const { files } = await readChanges(GIT, repo, first, undefined);
    assert.deepEqual(files, [{ path: 'a.txt', status: 'A', added: 1, removed: 0, binary: false }]);
  });

  test('readRemote parses scp-style GitHub remotes', async () => {
    const remote = await readRemote(GIT, repo);
    assert.ok(remote);
    assert.equal(remote.kind, 'github');
    assert.equal(remote.owner, 'octo');
    assert.equal(remote.repo, 'hello-world');
    assert.equal(remote.web, 'https://github.com/octo/hello-world');
  });
});

describe('avatarUrl', () => {
  test('uses the GitHub avatar for numeric noreply addresses', () => {
    assert.equal(
      avatarUrl('12345+octocat@users.noreply.github.com'),
      'https://avatars.githubusercontent.com/u/12345?s=80&v=4'
    );
  });

  test('uses the GitHub profile image for legacy noreply addresses', () => {
    assert.equal(avatarUrl('octocat@users.noreply.github.com'), 'https://github.com/octocat.png?size=80');
  });

  test('falls back to Gravatar with a normalised email hash', () => {
    const url = avatarUrl('  Ada@Example.com ');
    assert.equal(url, avatarUrl('ada@example.com'));
    assert.match(url, /^https:\/\/www\.gravatar\.com\/avatar\/[0-9a-f]{32}\?s=80&d=404$/);
  });
});
