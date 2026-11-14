#!/usr/bin/env node
// Renders the README / Marketplace screenshots from a generated demo repository.
//
//   npm run compile && node scripts/screenshots/render.mjs
//
// Needs Google Chrome (override with CHROME=/path/to/chrome) and, for the animated GIF, ffmpeg.
// The webview's real HTML/CSS/JS is loaded with a stubbed VS Code API and fed state produced by
// the extension's own git + stack code, so the images always match the shipped UI.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/images');
const MEDIA = pathToFileURL(join(ROOT, 'media')).href;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const git = require(join(ROOT, 'out/git.js'));
const stacks = require(join(ROOT, 'out/stacks.js'));

const work = mkdtempSync(join(tmpdir(), 'gistry-shots-'));
const repo = join(work, 'workspace');
execFileSync(join(ROOT, 'scripts/screenshots/demo-repo.sh'), [repo], { stdio: 'inherit' });
mkdirSync(OUT, { recursive: true });

const THEMES = {
  dark: { editor: '#141416', sidebar: '#18181a' },
  light: { editor: '#ffffff', sidebar: '#f7f7f8' },
};

const BACKDROP = {
  dark: `radial-gradient(900px 520px at 12% -8%, rgba(75,139,245,.20), transparent 62%),
         radial-gradient(760px 480px at 102% 108%, rgba(217,119,87,.16), transparent 60%), #0e0e11`,
  flat: '#0e0e11',
  light: `radial-gradient(900px 520px at 12% -8%, rgba(75,139,245,.16), transparent 62%),
          radial-gradient(760px 480px at 102% 108%, rgba(217,119,87,.12), transparent 60%), #eceef3`,
};

/** Builds webview state for a ref ('all' | 'head' | branch name) using the extension's own code. */
async function stateFor(ref, mode) {
  const refs = await git.readRefs('git', repo);
  const head = (await git.runGit('git', repo, ['rev-parse', 'HEAD'])).trim();
  const headName = (await git.runGit('git', repo, ['symbolic-ref', '--short', 'HEAD'])).trim();
  const rev = ref === 'all' ? ['--branches', 'HEAD'] : ref === 'head' ? ['HEAD'] : [`refs/heads/${ref}`];
  const commits = await git.readLog('git', repo, rev, 200, refs.byCommit);
  const total = await git.countCommits('git', repo, rev);
  const trunk = await stacks.detectTrunk('git', repo, refs.branches, headName);
  const st = await stacks.computeStacks('git', repo, refs.tips, trunk, new Map());
  const remote = await git.readRemote('git', repo);
  const details = {};
  for (const c of commits) details[c.hash] = await git.readChanges('git', repo, c.hash, c.parents[0]);
  const label = ref === 'all' ? 'All branches' : ref === 'head' ? headName : ref;
  return {
    details,
    state: {
      type: 'state',
      mode,
      repo: { root: repo, name: 'workspace' },
      repos: [{ root: repo, name: 'workspace' }],
      branches: refs.branches,
      selected: {
        value: ref === 'all' ? '__all__' : ref === 'head' ? null : ref,
        label,
        mainName: ref === 'all' ? headName : label,
      },
      head: { name: headName, commit: head },
      tipIsHead: ref === 'all' || ref === 'head' || ref === headName,
      commits,
      total,
      hasMore: total > commits.length,
      uncommitted: 2,
      avatars: {},
      trunk: st.trunk,
      stacks: st.stacks,
      prs: st.prs,
      remote: remote ? { kind: remote.kind, web: remote.web, prUrl: remote.prUrl } : null,
      github: { available: true, connected: true },
    },
  };
}

/** A page that boots the real webview against canned state, then drives it via the query string. */
async function page(name, { ref, theme = 'dark', mode = 'panel', backdrop = 'dark' }) {
  const { state, details } = await stateFor(ref, mode);
  const t = THEMES[theme];
  const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${MEDIA}/main.css">
<style>
  :root { --vscode-font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
          --vscode-editor-background: ${t.editor}; --vscode-sideBar-background: ${t.sidebar}; }
  html body[data-mode='panel'] { background: ${BACKDROP[backdrop]}; }
  html body[data-mode='panel'] .shell { padding: 44px 56px; }
  html body[data-mode='panel'] .card { box-shadow: 0 50px 120px -40px rgba(0,0,0,.75), 0 0 0 1px rgba(255,255,255,.04); }
  *, *::before, *::after { animation: none !important; transition: none !important; }
</style></head>
<body class="vscode-${theme}" data-mode="${mode}"><div id="app"></div>
<script>
const STATE = ${JSON.stringify(state)};
const DETAILS = ${JSON.stringify(details)};
window.acquireVsCodeApi = () => ({ postMessage(m) { setTimeout(() => {
  if (m.type === 'ready') window.postMessage(STATE, '*');
  if (m.type === 'details') window.postMessage({ type: 'details', hash: m.hash, ...DETAILS[m.hash] }, '*');
}, 0); } });
</script>
<script src="${MEDIA}/main.js"></script>
<script>
const q = new URLSearchParams(location.search);
const row = (text) => [...document.querySelectorAll('.row[data-hash]')]
  .find((r) => r.querySelector('.subject').textContent.toLowerCase().includes(text.toLowerCase()));
setTimeout(() => {
  if (q.get('sel')) row(q.get('sel'))?.click();
  if (q.get('pin')) {
    const p = q.get('pin');
    const el = [...document.querySelectorAll('.branches [data-f]')]
      .find((e) => e.dataset.f === p || e.querySelector('.cn')?.textContent === p);
    el?.click();
  }
  if (q.get('hover')) {
    const r = row(q.get('hover'));
    r.classList.add('sel');
    r.querySelector('.author').dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  }
}, 200);
</script></body></html>`;
  const file = join(work, `${name}.html`);
  writeFileSync(file, html);
  return pathToFileURL(file).href;
}

function shoot(url, out, [w, h]) {
  const r = spawnSync(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=2',
      '--allow-file-access-from-files',
      `--window-size=${w},${h}`,
      '--virtual-time-budget=8000',
      '--run-all-compositor-stages-before-draw',
      `--screenshot=${out}`,
      url,
    ],
    { stdio: 'ignore' }
  );
  if (r.status !== 0 || !existsSync(out)) throw new Error(`Chrome failed to render ${out}`);
  console.log('  ✓', out.replace(`${ROOT}/`, ''));
}

console.log('Rendering screenshots…');

// 1. Hero: everything at once, with the author hover card.
shoot(`${await page('hero', { ref: 'all' })}?hover=retry flaky`, join(OUT, 'hero.png'), [1280, 940]);

// 2. Stacked PRs: the top of a Graphite stack with the stack drawer open.
shoot(`${await page('stacks', { ref: 'billing/ui' })}?sel=format currency`, join(OUT, 'stacks.png'), [1280, 980]);

// 3. Conventional commits: type column + a breaking change.
shoot(`${await page('conventional', { ref: 'head' })}?sel=sliding session`, join(OUT, 'conventional.png'), [1280, 980]);

// 4. Sidebar, dark + light, side by side.
const sideDark = await page('side-dark', { ref: 'billing/ui', mode: 'view' });
const sideLight = await page('side-light', { ref: 'all', theme: 'light', mode: 'view' });
const compositeFile = join(work, 'sidebar.html');
writeFileSync(
  compositeFile,
  `<!doctype html><html><body style="margin:0;height:100vh;display:flex;gap:40px;align-items:center;justify-content:center;
     background:linear-gradient(90deg, #0e0e11 0 50%, #eceef3 50% 100%)">
   ${[
     [`${sideDark}?sel=invoices page`, '#2a2a2e', 'rgba(0,0,0,.7)'],
     [sideLight, '#d9dbe2', 'rgba(30,40,80,.18)'],
   ]
     .map(
       ([src, border, shadow]) =>
         `<iframe src="${src}" style="width:420px;height:800px;border:1px solid ${border};border-radius:14px;box-shadow:0 40px 100px -30px ${shadow}"></iframe>`
     )
     .join('')}
   </body></html>`
);
shoot(pathToFileURL(compositeFile).href, join(OUT, 'sidebar.png'), [1100, 900]);

// 5. Spotlight: an animated tour of the legend.
const ffmpeg = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;
if (ffmpeg) {
  const base = await page('spotlight', { ref: 'all', backdrop: 'flat' });
  const pins = ['', 'billing/models', 'billing/api', 'billing/ui', 'feat/dark-mode', 'feat/search', 't-fix', 't-feat'];
  const frames = join(work, 'frames');
  mkdirSync(frames);
  pins.forEach((pin, i) =>
    shoot(`${base}${pin ? `?pin=${encodeURIComponent(pin)}` : ''}`, join(frames, `${i}.png`), [1280, 940])
  );
  const list = pins.map((_, i) => `file '${join(frames, `${i}.png`)}'\nduration ${i === 0 ? 2.2 : 1.6}`).join('\n');
  writeFileSync(join(frames, 'list.txt'), `${list}\nfile '${join(frames, `${pins.length - 1}.png`)}'\n`);
  const gif = join(OUT, 'spotlight.gif');
  const r = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-loglevel',
      'error',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      join(frames, 'list.txt'),
      '-vf',
      'scale=1280:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=192:stats_mode=full[p];[b][p]paletteuse=dither=none',
      '-loop',
      '0',
      gif,
    ],
    { stdio: 'inherit' }
  );
  if (r.status === 0) console.log('  ✓', gif.replace(`${ROOT}/`, ''));
} else {
  console.log('  – ffmpeg not found; skipping spotlight.gif');
}

if (process.env.KEEP) console.log(`Kept work files in ${work}`);
else rmSync(work, { recursive: true, force: true });
console.log('Done.');
