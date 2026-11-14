(() => {
  'use strict';
  const vscode = acquireVsCodeApi();

  const ROW = 34;
  const LANE = 16;
  const X0 = 26;
  const TOP = 8;
  const LIST_INSET = 10;
  const COLORS = 8;

  let S = null;
  let G = null;
  let view = 'skeleton';
  let emptyInfo = null;
  let errorMsg = '';
  let selected = null;
  let lastRefKey = null;
  let loadingMore = false;
  const details = new Map();
  const failedImg = new Set();
  const byHash = new Map();
  const mode = document.body.dataset.mode || 'view';

  const app = document.getElementById('app');

  const I = {
    branch:
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="4.5" cy="3.5" r="1.6"/><circle cx="4.5" cy="12.5" r="1.6"/><circle cx="11.5" cy="5" r="1.6"/><path d="M4.5 5.1v5.8M11.5 6.6c0 3.2-7 2.1-7 4.3"/></svg>',
    chevron:
      '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m4.5 6.5 3.5 3.5 3.5-3.5"/></svg>',
    close:
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4.5 4.5l7 7m0-7-7 7"/></svg>',
    refresh:
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 8a5 5 0 1 1-1.47-3.54M13.2 2.8v2.9h-2.9"/></svg>',
    tag: '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M2.5 2.5h5.3l5.7 5.7-5.3 5.3-5.7-5.7z"/><circle cx="5.6" cy="5.6" r="1.1" fill="currentColor" stroke="none"/></svg>',
    cloud:
      '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M4.6 12.5h6.9a2.9 2.9 0 0 0 .3-5.8 3.9 3.9 0 0 0-7.5 1A2.4 2.4 0 0 0 4.6 12.5z"/></svg>',
    branchSm:
      '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="4.5" cy="3.5" r="1.6"/><circle cx="4.5" cy="12.5" r="1.6"/><circle cx="11.5" cy="5" r="1.6"/><path d="M4.5 5.1v5.8M11.5 6.6c0 3.2-7 2.1-7 4.3"/></svg>',
    copy: '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5.5" y="5.5" width="8" height="8" rx="1.8"/><path d="M10.5 3.4V3A1.5 1.5 0 0 0 9 1.5H4A1.5 1.5 0 0 0 2.5 3v5A1.5 1.5 0 0 0 4 9.5h.4"/></svg>',
    check:
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m3.5 8.5 3 3 6-7"/></svg>',
    repo: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M3.5 13V3.2A1.7 1.7 0 0 1 5.2 1.5h7.3v9.8H5.2a1.7 1.7 0 0 0-1.7 1.7zm0 0a1.7 1.7 0 0 0 1.7 1.5h7.3"/></svg>',
    all: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="3.5" cy="3.5" r="1.5"/><circle cx="3.5" cy="12.5" r="1.5"/><circle cx="12.5" cy="12.5" r="1.5"/><circle cx="8" cy="6" r="1.5"/><path d="M3.5 5v6M8 7.5c0 3 4.5 2 4.5 3.5M3.5 4.5c0 1.5 4.5 0 4.5 0"/></svg>',
    forkOff:
      '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14V9.5A4.5 4.5 0 0 1 8.5 5H13M10 2l3 3-3 3"/></svg>',
    merged:
      '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 14V9.5A4.5 4.5 0 0 0 7.5 5H3M6 2 3 5l3 3"/></svg>',
    pr: '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="4" cy="3.5" r="1.6"/><circle cx="4" cy="12.5" r="1.6"/><circle cx="12" cy="12.5" r="1.6"/><path d="M4 5.1v5.8M12 10.9V6.5a2 2 0 0 0-2-2H7M8.6 2.9 7 4.5l1.6 1.6"/></svg>',
    stack:
      '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M8 2 14 5 8 8 2 5z"/><path d="M2 8.2l6 3 6-3M2 11.2l6 3 6-3"/></svg>',
    warn: '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.2 14.3 13.5H1.7z"/><path d="M8 6.5v3.2M8 11.6v.1"/></svg>',
    claude:
      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M8 2.2v3.1M8 10.7v3.1M2.2 8h3.1M10.7 8h3.1M3.9 3.9l2.2 2.2M9.9 9.9l2.2 2.2M12.1 3.9 9.9 6.1M6.1 9.9l-2.2 2.2"/></svg>',
    cube: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M8 2.2 13 5v6l-5 2.8L3 11V5z"/><path d="M3 5l5 2.9L13 5M8 7.9v5.9" /></svg>',
    spark:
      '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.8c.5 3.2 2.9 5.7 6.2 6.2-3.3.5-5.7 2.9-6.2 6.2C7.5 10.9 5.1 8.5 1.8 8 5.1 7.5 7.5 5 8 1.8z"/></svg>',
  };

  const esc = (s) =>
    String(s ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const fmtN = (n) => Number(n || 0).toLocaleString('en-US');
  const compactN = (n) =>
    n < 1000 ? String(n) : n < 10000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : Math.round(n / 1000) + 'k';
  const plural = (n, w) => `${fmtN(n)} ${w}${n === 1 ? '' : /(s|x|ch|sh)$/.test(w) ? 'es' : 's'}`;

  function shortAge(t) {
    const s = Math.max(0, Date.now() / 1000 - t);
    if (s < 45) return 'now';
    const m = s / 60;
    if (m < 60) return Math.max(1, Math.floor(m)) + 'm';
    const h = m / 60;
    if (h < 24) return Math.floor(h) + 'h';
    const d = h / 24;
    if (d < 7) return Math.floor(d) + 'd';
    if (d < 30) return Math.floor(d / 7) + 'w';
    if (d < 365) return Math.max(1, Math.floor(d / 30.44)) + 'mo';
    return Math.floor(d / 365.25) + 'y';
  }
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  function longAge(t) {
    const s = Date.now() / 1000 - t;
    const steps = [
      [60, 'second', 1],
      [3600, 'minute', 60],
      [86400, 'hour', 3600],
      [604800, 'day', 86400],
      [2629800, 'week', 604800],
      [31557600, 'month', 2629800],
      [Infinity, 'year', 31557600],
    ];
    for (const [lim, unit, div] of steps) {
      if (s < lim) return rtf.format(-Math.floor(s / div), unit);
    }
    return '';
  }
  const absDate = (t) => new Date(t * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

  function initials(name) {
    const parts = String(name || '?')
      .replace(/[[\]()<>]/g, '')
      .split(/[\s._-]+/)
      .filter(Boolean);
    const a = parts[0]?.[0] ?? '?';
    const b = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (a + b).toUpperCase();
  }

  function aiOf(c) {
    for (const p of c.coAuthors || []) {
      const s = `${p.name} ${p.email}`;
      if (/claude|anthropic/i.test(s)) return { kind: 'claude', name: 'Claude' };
      if (/cursor/i.test(s)) return { kind: 'cursor', name: 'Cursor' };
      if (/copilot/i.test(s)) return { kind: 'bot', name: 'Copilot' };
      if (/codex|openai|chatgpt|gemini|devin|aider|\[bot\]/i.test(s))
        return { kind: 'bot', name: p.name.replace(/\[bot\]/i, '').trim() };
    }
    return null;
  }

  function mergeName(subject) {
    const pats = [
      /^Merge branch '([^']+)'/,
      /^Merge pull request #\d+ from [^/\s]+\/(\S+)/,
      /^Merge remote-tracking branch '(?:[^/']+\/)?([^']+)'/,
      /^Merged? (?:branch )?'?([\w./-]+?)'? into /i,
    ];
    for (const re of pats) {
      const m = re.exec(subject);
      if (m) return m[1];
    }
    return null;
  }

  const svg11 = (d, fill) =>
    `<svg width="11" height="11" viewBox="0 0 16 16" fill="${fill ? 'currentColor' : 'none'}" stroke="${fill ? 'none' : 'currentColor'}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const CC_ICON = {
    feat: svg11(
      '<path d="M8 1.6c.5 3.3 3 5.9 6.4 6.4-3.4.5-5.9 3-6.4 6.4C7.5 11 5 8.5 1.6 8 5 7.5 7.5 4.9 8 1.6z"/>',
      true
    ),
    fix: svg11(
      '<rect x="5" y="5" width="6" height="8" rx="3"/><path d="M8 7.5v5M3 8.5h2M11 8.5h2M3.5 12.5 5.2 11.3M12.5 12.5l-1.7-1.2M3.5 4.8l1.8 1.4M12.5 4.8l-1.8 1.4M6.3 5.2 5.6 3M9.7 5.2l.7-2.2"/>'
    ),
    perf: svg11('<path d="M9.2 1.2 3.4 9h4.3l-1 5.8L12.6 7H8.3z"/>', true),
    refactor: svg11('<path d="M3 6.2a5 5 0 0 1 9.1-1.6M13 9.8a5 5 0 0 1-9.1 1.6M12.4 1.9v2.9H9.5M3.6 14.1v-2.9h2.9"/>'),
    docs: svg11(
      '<path d="M3 3.3A1.5 1.5 0 0 1 4.5 1.8H12.5v10H4.5A1.5 1.5 0 0 0 3 13.3zm0 0v10a1.5 1.5 0 0 0 1.5 1.5h8"/>'
    ),
    test: svg11(
      '<path d="M5.8 1.8h4.4M6.6 1.8v4.3L3 12.8a1.1 1.1 0 0 0 1 1.6h8a1.1 1.1 0 0 0 1-1.6L9.4 6.1V1.8M4.6 9.8h6.8"/>'
    ),
    style: svg11('<path d="M8 1.8s4.6 4.7 4.6 7.7a4.6 4.6 0 0 1-9.2 0C3.4 6.5 8 1.8 8 1.8z"/>'),
    build: svg11('<path d="M8 1.8 13.6 4.7v6.6L8 14.2 2.4 11.3V4.7z"/><path d="M2.4 4.7 8 7.6l5.6-2.9M8 7.6v6.6"/>'),
    ci: svg11('<circle cx="8" cy="8" r="6"/><path d="M6.7 5.4v5.2L10.8 8z" fill="currentColor"/>'),
    chore: svg11(
      '<path d="M10.6 1.9a3.3 3.3 0 0 0-4 4.3L2 10.8a1.5 1.5 0 0 0 2.2 2.2l4.6-4.6a3.3 3.3 0 0 0 4.3-4L11 6.5 9.5 5l2.1-2.1a3.3 3.3 0 0 0-1-1z"/>'
    ),
    revert: svg11('<path d="M3.8 6h6.4a3.6 3.6 0 0 1 0 7.2H6.8M6.4 3.2 3.6 6l2.8 2.8"/>'),
    release: svg11(
      '<path d="M2.5 2.5h5.3l5.7 5.7-5.3 5.3-5.7-5.7z"/><circle cx="5.6" cy="5.6" r="1.1" fill="currentColor" stroke="none"/>'
    ),
    security: svg11('<path d="M8 1.6 13.2 3.5v4.2c0 3.3-2.2 5.5-5.2 6.7-3-1.2-5.2-3.4-5.2-6.7V3.5z"/>'),
    merge: svg11(
      '<circle cx="4.5" cy="3.4" r="1.6"/><circle cx="4.5" cy="12.6" r="1.6"/><circle cx="11.5" cy="8.6" r="1.6"/><path d="M4.5 5v6M4.6 5.1c.4 2.4 2.7 3.5 5.3 3.5"/>'
    ),
  };
  const CC_TYPES = {
    feat: [3, 'feat'],
    fix: [2, 'fix'],
    perf: [7, 'perf'],
    refactor: [4, 'refactor'],
    docs: [5, 'docs'],
    test: [6, 'test'],
    style: [6, 'style'],
    build: [1, 'build'],
    ci: [1, 'ci'],
    chore: [null, 'chore'],
    revert: [7, 'revert'],
    deps: [3, 'build'],
    release: [0, 'release'],
    security: [2, 'security'],
    wip: [null, 'chore'],
    merge: [null, 'merge'],
  };
  const CC_ALIAS = {
    feature: 'feat',
    features: 'feat',
    bugfix: 'fix',
    hotfix: 'fix',
    doc: 'docs',
    tests: 'test',
    dep: 'deps',
    sec: 'security',
    refact: 'refactor',
  };
  const CC_RE = /^([A-Za-z]+)(?:\(([^()]*)\))?(!)?:\s*(.+)$/;
  const PR_SUFFIX_RE = /\s*\(#(\d+)\)\s*$/;
  const MERGE_PR_RE = /^Merge pull request #(\d+) from \S+/;

  function parseCommit(c) {
    if (c._p) return c._p;
    let subject = c.subject;
    let pr = null;
    let m = PR_SUFFIX_RE.exec(subject);
    if (m) {
      pr = Number(m[1]);
      subject = subject.slice(0, m.index);
    } else if ((m = MERGE_PR_RE.exec(subject))) {
      pr = Number(m[1]);
    }
    let cc = null;
    const cm = CC_RE.exec(subject);
    if (cm) {
      const raw = cm[1].toLowerCase();
      const type = CC_ALIAS[raw] || raw;
      if (CC_TYPES[type] && type !== 'merge') {
        const footer = /^BREAKING[ -]CHANGE:\s*([\s\S]*?)(?:\n\s*\n|\n[\w-]+: |$)/m.exec(c.body || '');
        cc = {
          type,
          raw: cm[1],
          scope: cm[2] ? cm[2].trim() : '',
          breaking: !!cm[3] || !!footer,
          breakingNote: footer ? footer[1].trim() : '',
          desc: cm[4],
        };
      }
    }
    if (!cc && c.parents.length > 1) {
      const title = MERGE_PR_RE.test(c.subject) && c.body ? c.body.split('\n')[0].trim() : '';
      const inner = title ? CC_RE.exec(title) : null;
      cc = inner
        ? {
            type: 'merge',
            raw: 'merge',
            scope: (inner[2] || '').trim(),
            breaking: !!inner[3],
            breakingNote: '',
            desc: inner[4],
            synthetic: true,
          }
        : {
            type: 'merge',
            raw: 'merge',
            scope: '',
            breaking: false,
            breakingNote: '',
            desc: title || subject,
            synthetic: true,
          };
    }
    return (c._p = { cc, pr, text: cc ? cc.desc : subject });
  }

  const richText = (t) => esc(t).replace(/`([^`\n]+)`/g, '<code>$1</code>');
  const sentence = (t) => (/^[a-z]+(\s|$)/.test(t) ? t[0].toUpperCase() + t.slice(1) : t);
  const ccColor = (type) => {
    const c = CC_TYPES[type]?.[0];
    return c === null || c === undefined ? 'var(--text-dim)' : `var(--lane-${c})`;
  };
  function ccTag(cc, withData = true) {
    const icon = CC_ICON[CC_TYPES[cc.type][1]] || '';
    const title = `${cc.raw}${cc.scope ? `(${cc.scope})` : ''}${cc.breaking ? ' · breaking change' : ''}`;
    const f = (k) => (withData ? ` data-f="${k}"` : '');
    const scope = cc.scope
      ? `<span class="cc-s"${f(`sc${SCOPES.get(cc.scope)}`)} title="Scope: ${esc(cc.scope)}">${esc(cc.scope)}</span>`
      : '';
    return `<span class="cc${cc.breaking ? ' breaking' : ''}${cc.synthetic ? ' synthetic' : ''}${withData ? ' live' : ''}" style="--c: ${ccColor(cc.type)}"><span class="cc-t"${f(`t-${cc.type}`)} title="${esc(title)}">${icon}<span class="ct">${esc(cc.type)}</span>${cc.breaking ? '<b class="bang">!</b>' : ''}</span>${scope}</span>`;
  }

  const SEG_COLORS = [1, 4, 5, 6, 3, 7, 2];
  let SEG = new Map();
  let STACK_BRANCH = new Map();
  let SCOPES = new Map();

  function indexStacks() {
    SEG = new Map();
    STACK_BRANCH = new Map();
    let k = 0;
    (S.stacks || []).forEach((st, si) => {
      const total = Math.max(...st.branches.map((b) => b.depth)) + 1;
      st.branches.forEach((b, bi) => {
        const seg = {
          key: `sg${si}-${bi}`,
          si,
          bi,
          stack: st,
          branch: b,
          color: SEG_COLORS[k++ % SEG_COLORS.length],
          level: b.depth + 1,
          total,
        };
        STACK_BRANCH.set(b.name, seg);
        for (const h of b.commits) if (!SEG.has(h)) SEG.set(h, seg);
      });
    });
  }

  const prState = (p) => p?.state || '';
  const PR_LABEL = { open: 'Open', draft: 'Draft', merged: 'Merged', closed: 'Closed' };
  function prUrl(n, info) {
    if (info?.url) return info.url;
    return S.remote?.prUrl ? S.remote.prUrl.replace('{n}', String(n)) : '';
  }
  function prPill(n, info, withState = false) {
    const st = prState(info);
    const url = prUrl(n, info);
    const title = `#${n}${info?.title ? ' · ' + info.title : ''}${st ? ' · ' + PR_LABEL[st] : ''}${url ? '\nClick to open' : ''}`;
    return `<span class="pill pr ${st}"${url ? ` data-url="${esc(url)}"` : ''} title="${esc(title)}">${I.pr}<span class="pl">#${n}</span>${withState && st ? `<span class="note">${PR_LABEL[st]}</span>` : ''}</span>`;
  }

  function focusClasses(c, r) {
    const out = [...G.touch[r]].map((id) => 'a' + id);
    const seg = SEG.get(c.hash);
    if (seg) out.push(seg.key);
    const cc = parseCommit(c).cc;
    if (cc) {
      out.push('t-' + cc.type);
      if (cc.scope) out.push('sc' + SCOPES.get(cc.scope));
    }
    return out.join(' ');
  }

  function layout(commits, mainName) {
    const lanes = [];
    const allocs = [];
    const rows = new Array(commits.length);
    const edges = [];
    let maxLane = 0;

    const newAlloc = (name) => {
      const a = { id: allocs.length, color: allocs.length % COLORS, name, first: -1 };
      allocs.push(a);
      return a;
    };
    const freeSlot = (exclude) => {
      for (let i = 0; i < lanes.length; i++) if (!lanes[i] && i !== exclude) return i;
      return lanes.length === exclude ? lanes.length + 1 : lanes.length;
    };

    commits.forEach((c, r) => {
      let lane = -1;
      const ending = [];
      for (let i = 0; i < lanes.length; i++) {
        const l = lanes[i];
        if (l && l.hash === c.hash) {
          if (lane < 0) lane = i;
          ending.push(...l.edges);
          if (i !== lane) lanes[i] = null;
        }
      }
      let alloc;
      if (lane < 0) {
        lane = freeSlot(-1);
        const br = c.refs.filter((x) => x.type === 'branch');
        const pick = br.find((x) => x.name === S.head.name) || br[0] || c.refs.find((x) => x.type === 'remote');
        alloc = newAlloc(pick ? pick.name : r === 0 ? mainName : null);
      } else {
        alloc = lanes[lane].alloc;
      }
      for (const e of ending) {
        e.toRow = r;
        e.toLane = lane;
      }
      if (alloc.first < 0) alloc.first = r;
      rows[r] = { lane, alloc };
      lanes[lane] = null;

      const ps = c.parents;
      if (ps.length) {
        const e0 = { fromRow: r, fromLane: lane, lane, alloc, toRow: null, toLane: null };
        edges.push(e0);
        lanes[lane] = { hash: ps[0], alloc, edges: [e0] };
        for (let k = 1; k < ps.length; k++) {
          let j = lanes.findIndex((l) => l && l.hash === ps[k]);
          let e;
          if (j >= 0) {
            const l = lanes[j];
            e = { fromRow: r, fromLane: lane, lane: j, alloc: l.alloc, toRow: null, toLane: null };
            l.edges.push(e);
          } else {
            j = freeSlot(lane);
            const a = newAlloc(mergeName(c.subject));
            e = { fromRow: r, fromLane: lane, lane: j, alloc: a, toRow: null, toLane: null };
            lanes[j] = { hash: ps[k], alloc: a, edges: [e] };
          }
          edges.push(e);
        }
      }
      for (let i = lanes.length - 1; i >= 0 && !lanes[i]; i--) lanes.length = i;
      maxLane = Math.max(maxLane, lane, lanes.length - 1);
    });

    const index = new Map(commits.map((c, i) => [c.hash, i]));

    for (const a of allocs) Object.assign(a, { count: 0, fork: null, merge: null, last: -1 });
    rows.forEach((row, r) => {
      row.alloc.count++;
      row.alloc.last = r;
    });
    for (const e of edges) {
      const a = e.alloc;
      if (e.toRow !== null && rows[e.toRow].alloc !== a && (a.fork === null || e.toRow > a.fork)) a.fork = e.toRow;
      if (rows[e.fromRow].alloc !== a && (a.merge === null || e.fromRow < a.merge)) a.merge = e.fromRow;
    }
    const touch = rows.map((row) => new Set([row.alloc.id]));
    for (const a of allocs) {
      if (a.fork !== null) touch[a.fork].add(a.id);
      if (a.merge !== null) touch[a.merge].add(a.id);
    }
    const trunkTip = S.trunk && commits.find((c) => c.refs.some((x) => x.type === 'branch' && x.name === S.trunk));
    const headRow = trunkTip ? index.get(trunkTip.hash) : index.get(S.head.commit);
    if (headRow !== undefined) {
      const hc = rows[headRow].alloc.color;
      if (hc !== 0) for (const a of allocs) a.color = a.color === 0 ? hc : a.color === hc ? 0 : a.color;
    }

    const mainline = new Set();
    const start = S.selected.value === '__all__' ? (index.get(S.head.commit) ?? 0) : 0;
    for (let i = start; i !== undefined && commits[i]; ) {
      mainline.add(commits[i].hash);
      i = index.get(commits[i].parents[0]);
    }
    const rowColor = rows.map((row, r) => SEG.get(commits[r].hash)?.color ?? row.alloc.color);

    const plain = commits.filter((c) => c.parents.length < 2);
    const ccCount = plain.filter((c) => parseCommit(c).cc).length;
    const ccMode = plain.length >= 3 && ccCount / plain.length >= 0.3;
    const typeCounts = new Map();
    SCOPES = new Map();
    for (const c of commits) {
      const cc = parseCommit(c).cc;
      if (!cc) continue;
      if (!cc.synthetic) typeCounts.set(cc.type, (typeCounts.get(cc.type) || 0) + 1);
      if (cc.scope && !SCOPES.has(cc.scope)) SCOPES.set(cc.scope, SCOPES.size);
    }
    return { rows, edges, maxLane, mainline, allocs, touch, rowColor, ccMode, typeCounts };
  }

  const X = (l) => X0 + l * LANE;

  function graphSvg(commits, offset, showUncommitted, width, height, fadeFrom) {
    const Y = (r) => TOP + (r + offset) * ROW + ROW / 2;
    const yEnd = height;
    let paths = '';
    let knocks = '';
    let nodes = '';

    for (const e of G.edges) {
      const x1 = X(e.fromLane);
      const y1 = Y(e.fromRow);
      const xl = X(e.lane);
      const ends = e.toRow !== null;
      const x2 = ends ? X(e.toLane) : xl;
      const y2 = ends ? Y(e.toRow) : yEnd;
      const span = ends ? e.toRow - e.fromRow : Infinity;
      const h = ROW / 2;
      let d = `M${x1} ${y1}`;
      if (x1 !== xl && x2 !== xl && span === 1) {
        d += `C${x1} ${y1 + h} ${x2} ${y2 - h} ${x2} ${y2}`;
      } else {
        let y = y1;
        if (x1 !== xl) {
          d += `C${x1} ${y1 + h} ${xl} ${y1 + h} ${xl} ${y1 + ROW}`;
          y = y1 + ROW;
        }
        if (x2 !== xl) {
          if (y2 - ROW > y) d += `L${xl} ${y2 - ROW}`;
          d += `C${xl} ${y2 - h} ${x2} ${y2 - h} ${x2} ${y2}`;
        } else if (y2 > y) {
          d += `L${x2} ${y2}`;
        }
      }
      const fromSeg = SEG.get(commits[e.fromRow].hash);
      const toSeg = e.toRow !== null ? SEG.get(commits[e.toRow].hash) : null;
      const firstParent = e.lane === e.fromLane;
      const seg = firstParent ? fromSeg : toSeg;
      const color = seg ? seg.color : e.alloc.color;
      paths += `<path class="gi c${color} a${e.alloc.id}${seg ? ' ' + seg.key : ''}" d="${d}"/>`;
    }

    commits.forEach((c, r) => {
      const { lane } = G.rows[r];
      const x = X(lane);
      const y = Y(r);
      const cls = `gi c${G.rowColor[r]} ${focusClasses(c, r)}`;
      const stackTip = STACK_BRANCH.get(c.refs.find((x) => x.type === 'branch' && STACK_BRANCH.has(x.name))?.name);
      if (c.hash === S.head.commit) {
        knocks += `<circle cx="${x}" cy="${y}" r="10.5"/>`;
        nodes += `<circle class="${cls}" cx="${x}" cy="${y}" r="5.4" fill="none" stroke="currentColor" stroke-width="2.6"/>`;
      } else if (stackTip) {
        knocks += `<circle cx="${x}" cy="${y}" r="10"/>`;
        nodes += `<g class="${cls}"><circle cx="${x}" cy="${y}" r="6.3" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="${x}" cy="${y}" r="2.8" fill="currentColor"/></g>`;
      } else if (G.mainline.has(c.hash)) {
        knocks += `<circle cx="${x}" cy="${y}" r="10"/>`;
        nodes += `<g class="${cls}"><circle cx="${x}" cy="${y}" r="6.6" fill="currentColor" opacity=".22"/><circle cx="${x}" cy="${y}" r="3.6" fill="currentColor"/></g>`;
      } else {
        knocks += `<circle cx="${x}" cy="${y}" r="7.5"/>`;
        nodes += `<circle class="${cls}" cx="${x}" cy="${y}" r="3.6" fill="currentColor"/>`;
      }
    });

    if (showUncommitted) {
      const x = X(G.rows[0].lane);
      const y = TOP + ROW / 2;
      const cls = `c${G.rowColor[0]}`;
      knocks += `<circle cx="${x}" cy="${y}" r="10"/>`;
      paths += `<path class="${cls}" d="M${x} ${y}L${x} ${Y(0)}" stroke-dasharray="2.5 3.5" opacity=".85"/>`;
      nodes += `<circle class="${cls}" cx="${x}" cy="${y}" r="5.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2.6 2.3" opacity=".9"/>`;
    }

    if (S.hasMore) {
      const rr = commits.length;
      const y = Y(rr);
      const txt = compactN(S.total - commits.length);
      const w = Math.max(19, txt.length * 6.2 + 9);
      knocks += `<rect x="${X0 - w / 2 - 3}" y="${y - 12.5}" width="${w + 6}" height="25" rx="12.5"/>`;
      nodes += `<g class="c0"><rect x="${X0 - w / 2}" y="${y - 9.5}" width="${w}" height="19" rx="9.5" fill="currentColor" opacity=".2"/><text x="${X0}" y="${y + 3.3}" text-anchor="middle" fill="currentColor" font-size="9.5" font-weight="600" font-family="var(--font)">${txt}</text></g>`;
    }

    const fade =
      fadeFrom < height
        ? `<rect x="0" y="${fadeFrom}" width="${width}" height="${height - fadeFrom}" fill="url(#gfade)"/>`
        : '';
    return `<svg class="graph" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">
      <defs>
        <linearGradient id="gfade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>
        <mask id="gmask" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}">
          <rect x="0" y="0" width="${width}" height="${Math.min(fadeFrom, height)}" fill="#fff"/>${fade}
          <g fill="#000">${knocks}</g>
        </mask>
      </defs>
      <g mask="url(#gmask)" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">${paths}</g>
      ${nodes}
    </svg>`;
  }

  function avatar(name, email, ai, extraClass = '') {
    const url = S?.avatars ? S.avatars[String(email || '').toLowerCase()] : null;
    const ini = esc(initials(name));
    const face =
      url && !failedImg.has(url)
        ? `<img src="${esc(url)}" alt="" data-ini="${ini}" loading="lazy" referrerpolicy="no-referrer">`
        : ini;
    let badge = '';
    if (ai) {
      const icon = ai.kind === 'claude' ? I.claude : ai.kind === 'cursor' ? I.cube : I.spark;
      badge = `<span class="badge ${ai.kind === 'claude' ? 'claude' : 'bot'}" title="Co-authored with ${esc(ai.name)}">${icon}</span>`;
    }
    return `<span class="av ${extraClass}"><span class="face">${face}</span>${badge}</span>`;
  }

  function pill(icon, label, color, cls = '', title = '', focusKey = null, note = '', pre = '') {
    const da = focusKey !== null ? ` data-f="${focusKey}"` : '';
    const nt = note ? `<span class="note">${esc(note)}</span>` : '';
    return `<span class="pill ${cls}" style="--c: var(--lane-${color})" title="${esc(title || label)}"${da}>${icon}${pre}<span class="pl">${esc(label)}</span>${nt}</span>`;
  }

  const allocLabel = (a) => a.name || 'unnamed branch';

  function pillsFor(c, r) {
    const row = G.rows[r];
    const color = row.alloc.color;
    const out = [];
    const local = new Set(c.refs.filter((x) => x.type === 'branch').map((x) => x.name));
    const allMode = S.selected.value === '__all__';
    for (const ref of c.refs) if (ref.type === 'tag') out.push(pill(I.tag, ref.name, color, '', `Tag ${ref.name}`));
    const subjectPr = parseCommit(c).pr;
    for (const ref of c.refs) {
      if (ref.type !== 'branch') continue;
      const seg = STACK_BRANCH.get(ref.name);
      const pr = S.prs?.[ref.name];
      const hideName = !allMode && ref.name === S.selected.label && r === 0 && !seg;
      if (!hideName) {
        if (seg) {
          const b = seg.branch;
          const tip = `${ref.name} · PR ${seg.level} of ${seg.total} in stack on ${seg.stack.trunk}${b.parent !== seg.stack.trunk ? `\nBased on ${b.parent}` : ''}${b.needsRestack ? `\n⚠ Needs restack: ${b.parent} has moved on` : ''}`;
          out.push(
            pill(
              b.needsRestack ? I.warn : I.stack,
              ref.name,
              seg.color,
              `stack${b.needsRestack ? ' restack' : ''}`,
              tip,
              seg.key,
              '',
              `<span class="lvl">${seg.level}/${seg.total}</span>`
            )
          );
        } else {
          out.push(
            pill(
              I.branchSm,
              ref.name,
              color,
              '',
              `Branch ${ref.name}${ref.name === S.head.name ? ' (checked out)' : ''}`,
              row.alloc.first === r ? 'a' + row.alloc.id : null
            )
          );
        }
      }
      if (pr && pr.number !== subjectPr) out.push(prPill(pr.number, pr));
    }
    for (const ref of c.refs) {
      if (ref.type !== 'remote') continue;
      const short = ref.name.slice(ref.name.indexOf('/') + 1);
      if (local.has(short)) continue;
      out.push(pill(I.cloud, ref.name, color, 'remote', `Remote ${ref.name}`));
    }
    const a = row.alloc;
    if (
      a.id !== 0 &&
      a.first === r &&
      a.name &&
      !c.refs.some((x) => x.name === a.name || x.name.endsWith('/' + a.name))
    ) {
      out.push(
        pill(
          I.branchSm,
          a.name,
          color,
          'ghost',
          `${a.name} · ${plural(a.count, 'commit')}${a.merge !== null ? ' · merged' : ''}`,
          'a' + a.id
        )
      );
    }
    for (const b of G.allocs) {
      if (b.fork !== r || b.id === row.alloc.id || (b.name && STACK_BRANCH.has(b.name))) continue;
      const tip = S.commits[b.first];
      const label = allocLabel(b);
      out.push(
        pill(
          I.forkOff,
          label,
          b.color,
          'fork',
          `${label} branched off here · ${plural(b.count, 'commit')}${b.merge !== null ? ' · merged ' + longAge(S.commits[b.merge].date) : ''}\nTip: ${tip ? tip.subject : ''}`,
          'a' + b.id,
          'branched off'
        )
      );
    }
    for (const seg of STACK_BRANCH.values()) {
      if (seg.branch.depth !== 0 || !seg.branch.commits.length) continue;
      const last = seg.branch.commits[seg.branch.commits.length - 1];
      const lr = S.commits.findIndex((x) => x.hash === last);
      if (lr < 0 || S.commits[lr].parents[0] !== c.hash) continue;
      const n = seg.stack.branches.length;
      out.push(
        pill(
          I.stack,
          `stack of ${n}`,
          seg.color,
          'fork',
          `A stack of ${n} branches starts here:\n${seg.stack.branches.map((b) => '  ' + '  '.repeat(b.depth) + b.name).join('\n')}`,
          seg.key,
          'branched off'
        )
      );
    }
    if (subjectPr)
      out.push(
        prPill(
          subjectPr,
          Object.values(S.prs || {}).find((p) => p.number === subjectPr)
        )
      );
    return out.join('');
  }

  function rowHtml(c, r) {
    const dim = !G.mainline.has(c.hash);
    const ai = aiOf(c);
    const ctx = esc(
      JSON.stringify({
        webviewSection: 'gistryCommit',
        hash: c.hash,
        root: S.repo.root,
        preventDefaultContextMenuItems: true,
      })
    );
    const p = parseCommit(c);
    const seg = SEG.get(c.hash);
    const showCc = p.cc && (!p.cc.synthetic || G.ccMode);
    const tag = showCc ? ccTag(p.cc) : '';
    // In a conventional-commit history every row gets a slot (sized in alignTags) so subjects
    // line up, while the chip inside stays as wide as its own text.
    const lead = G.ccMode ? `<span class="cc-slot">${tag}</span>` : tag;
    const text = showCc ? sentence(p.cc.desc) : p.cc?.synthetic ? sentence(p.cc.desc) : p.text;
    return `<div class="row${dim ? ' dim' : ''}${selected === c.hash ? ' sel' : ''} ${focusClasses(c, r)}" data-r="${r}" data-hash="${c.hash}" tabindex="-1" data-vscode-context="${ctx}">
      <div class="gut" data-f="${seg ? seg.key : 'a' + G.rows[r].alloc.id}"></div>
      <div class="msg">${lead}<span class="subject" title="${esc(c.subject)}">${esc(text)}</span>${pillsFor(c, r)}</div>
      <div class="author">${avatar(c.author, c.email, ai)}<span class="name">${esc(c.author)}</span></div>
      <div class="time" data-t="${c.date}" title="${esc(absDate(c.date))}">${shortAge(c.date)}</div>
    </div>`;
  }

  function headerHtml() {
    const count =
      S && view === 'list' ? `<span class="count" title="${fmtN(S.total)} commits">${fmtN(S.total)}</span>` : '';
    const label = S ? S.selected.label : '…';
    const isAll = S && S.selected.value === '__all__';
    const multiRepo = S?.repos && S.repos.length > 1;
    const repoName = multiRepo ? `<span class="repo-name">${esc(S.repo.name)}</span>` : '';
    return `<header class="hdr">
      <span class="title">Commit History</span>${count}${repoName}
      <span class="spacer"></span>
      ${S ? `<button class="ref-btn" id="refBtn" aria-haspopup="menu" aria-expanded="false" title="Switch branch">${isAll ? I.all : I.branch}<span class="label">${esc(label)}</span>${S && STACK_BRANCH.has(label) ? `<span class="lvl" style="--c: var(--lane-${STACK_BRANCH.get(label).color})">${STACK_BRANCH.get(label).level}/${STACK_BRANCH.get(label).total}</span>` : ''}${I.chevron}</button>` : '<span class="ref-btn ghost" aria-hidden="true"></span>'}
      <button class="icon-btn" id="refreshBtn" title="Refresh">${I.refresh}</button>
      ${mode === 'panel' ? `<button class="icon-btn" id="closeBtn" title="Close">${I.close}</button>` : ''}
      <div class="progress" id="progress"></div>
    </header>`;
  }

  function branchesHtml() {
    const groups = [];

    (S.stacks || []).forEach((st) => {
      const segs = st.branches.map((b) => {
        const seg = STACK_BRANCH.get(b.name);
        const inView = S.commits.some((c) => c.hash === b.tip);
        const pr = b.pr || S.prs?.[b.name];
        return `<button class="seg${inView ? '' : ' off'}" data-f="${seg.key}" style="--c: var(--lane-${seg.color})" title="${esc(stackSegTitle(seg, pr, inView))}"><span class="dot"></span><span class="cn">${esc(b.name)}</span>${pr ? `<span class="cm pr-n ${prState(pr)}">#${pr.number}</span>` : ''}${b.needsRestack ? `<span class="rs">${I.warn}</span>` : ''}</button>`;
      });
      const joined = segs
        .map((html, i) => {
          if (i === 0) return html;
          const b = st.branches[i];
          const onPrev = b.parent === st.branches[i - 1].name;
          return `<span class="sk-sep"${onPrev ? '' : ` title="${esc(b.name)} is also based on ${esc(b.parent)}"`}>${onPrev ? '›' : '+'}</span>${html}`;
        })
        .join('');
      groups.push(
        `<div class="stack-chip" title="Stack on ${esc(st.trunk)} · ${plural(st.branches.length, 'branch')}"><span class="sk-ic">${I.stack}</span>${joined}</div>`
      );
    });

    const seen = new Set();
    const chips = [];
    const headIdx = S.commits.findIndex((c) => c.hash === S.head.commit);
    for (const a of G.allocs) {
      if (!a.count || !a.name || seen.has(a.name) || STACK_BRANCH.has(a.name)) continue;
      seen.add(a.name);
      let meta;
      if (G.rows[headIdx]?.alloc === a) meta = 'HEAD';
      else if (a.merge !== null) meta = `merged ${shortAge(S.commits[a.merge].date)}`;
      else if (a.fork !== null) meta = 'open';
      else meta = '';
      chips.push(
        `<button class="chip" data-f="a${a.id}" style="--c: var(--lane-${a.color})" title="${esc(lineageText(a))}"><span class="dot"></span><span class="cn">${esc(a.name)}</span><span class="cm">${a.fork !== null ? fmtN(a.count) : ''}</span>${meta ? `<span class="cs">${esc(meta)}</span>` : ''}</button>`
      );
    }
    if (chips.length >= 2 || (chips.length && groups.length)) groups.push(chips.join(''));

    if (G.ccMode && G.typeCounts.size) {
      const order = Object.keys(CC_TYPES);
      const types = [...G.typeCounts].sort((a, b) => b[1] - a[1] || order.indexOf(a[0]) - order.indexOf(b[0]));
      groups.push(
        types
          .map(
            ([t, n]) =>
              `<button class="chip tchip" data-f="t-${t}" style="--c: ${ccColor(t)}" title="${plural(n, t + ' commit')} — click to spotlight">${CC_ICON[CC_TYPES[t][1]]}<span class="cn">${esc(t)}</span><span class="cm">${n}</span></button>`
          )
          .join('')
      );
    }
    if (!groups.length) return '';
    return `<div class="branches" role="toolbar" aria-label="Branches, stacks and commit types">${groups.join('<span class="strip-div"></span>')}</div>`;
  }

  function stackSegTitle(seg, pr, inView) {
    const b = seg.branch;
    const lines = [
      `${b.name} — PR ${seg.level} of ${seg.total} on ${seg.stack.trunk}`,
      `${plural(b.commits.length, 'commit')} · based on ${b.parent}`,
    ];
    if (pr) lines.push(`#${pr.number}${pr.title ? ' ' + pr.title : ''}${pr.state ? ' · ' + PR_LABEL[pr.state] : ''}`);
    if (b.needsRestack) lines.push(`⚠ Needs restack — ${b.parent} has moved on`);
    if (b.source !== 'history') lines.push(`Parent from ${b.source === 'graphite' ? 'Graphite' : 'PR base'}`);
    lines.push(inView ? 'Click to spotlight' : 'Click to view this stack');
    return lines.join('\n');
  }

  function lineageText(a) {
    const parts = [`${allocLabel(a)} · ${plural(a.count, 'commit')}`];
    if (a.fork !== null) {
      const base = S.commits[a.fork];
      parts.push(
        `branched from ${allocLabel(G.rows[a.fork].alloc)} at ${base.hash.slice(0, 7)} (${longAge(base.date)})`
      );
    }
    if (a.merge !== null) {
      const m = S.commits[a.merge];
      parts.push(`merged into ${allocLabel(G.rows[a.merge].alloc)} ${longAge(m.date)}`);
    } else if (a.fork !== null) parts.push('not merged');
    return parts.join('\n');
  }

  // Keep in sync with BOOT_SHELL in src/controller.ts, which pre-renders this so the first frame isn't blank.
  function skeletonHtml() {
    return `<div class="scroller"><div class="skel" aria-hidden="true">${'<div class="sk-row"><i></i><i></i><i></i><i></i><i></i></div>'.repeat(14)}</div></div>`;
  }

  function emptyHtml() {
    const e = emptyInfo || {};
    const map = {
      norepo: ['No repository', 'Open a folder that contains a Git repository to see its history here.'],
      nocommits: ['No commits yet', 'Make your first commit and it will show up here.'],
      loading: ['Looking for repositories…', ''],
    };
    const [t, p] = map[e.reason] || map.loading;
    return `<div class="empty"><div><svg class="c0" width="44" height="44" viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".7"><circle cx="22" cy="10" r="4.5" stroke-dasharray="2.6 2.3"/><path d="M22 17v10" stroke-dasharray="2.5 3.5"/><circle cx="22" cy="34" r="4.5"/></svg><h3>${t}</h3><p>${p}</p></div></div>`;
  }

  function errorHtml() {
    return `<div class="empty"><div><h3>Couldn’t read history</h3><p style="font-family:var(--mono);font-size:12px;white-space:pre-wrap">${esc(errorMsg)}</p><p style="margin-top:12px"><button class="ref-btn" id="retryBtn" style="margin:0 auto">${I.refresh}<span>Try again</span></button></p></div></div>`;
  }

  function render(opts = {}) {
    // The skeleton may already be on screen (pre-rendered by the extension, or from an earlier
    // message). Rebuilding it would restart its fade-in, so only refresh the header.
    if (view === 'skeleton' && app.querySelector('.card > .scroller > .skel')) {
      const hdr = app.querySelector('.hdr');
      if (hdr) hdr.outerHTML = headerHtml();
      return;
    }
    const prevScroll = app.querySelector('.scroller')?.scrollTop ?? 0;
    let body = '';
    if (view === 'skeleton') body = skeletonHtml();
    else if (view === 'empty') body = emptyHtml();
    else if (view === 'error') body = errorHtml();
    else body = listHtml();

    const enter = view === 'list' && opts.animate;
    app.innerHTML = `<div class="shell"><div class="card${enter ? ' enter' : ''}">${headerHtml()}${view === 'list' ? branchesHtml() : ''}${body}${drawerHtml()}</div></div>`;
    if (enter) {
      // Stagger the rows that are on screen; everything below shares the last delay.
      app.querySelectorAll('.rows > .row').forEach((el, i) => {
        if (i < 18) el.style.setProperty('--i', i);
      });
    }
    alignTags();
    applyFocus();

    const sc = app.querySelector('.scroller');
    if (sc && !opts.resetScroll) sc.scrollTop = prevScroll;
    observeLoadMore();
  }

  /** Sizes the tag column to the widest tag in view (capped, so one long scope can't push every row). */
  function alignTags() {
    const rows = app.querySelector('.rows');
    if (!rows || !G?.ccMode) return;
    let w = 0;
    for (const el of rows.querySelectorAll('.cc-slot > .cc')) w = Math.max(w, el.offsetWidth);
    rows.style.setProperty('--cc-w', `${Math.min(w, 168)}px`);
  }
  // Tag widths change at the narrow-layout breakpoint, so re-measure when the view resizes.
  let alignFrame = 0;
  new ResizeObserver(() => {
    cancelAnimationFrame(alignFrame);
    alignFrame = requestAnimationFrame(alignTags);
  }).observe(app);

  function listHtml() {
    const commits = S.commits;
    const showUnc = S.uncommitted > 0 && S.tipIsHead;
    const offset = showUnc ? 1 : 0;
    const width = Math.max(64, X0 + G.maxLane * LANE + 24);
    const totalRows = commits.length + offset + (S.hasMore ? 1 : 0);
    const dangling = G.edges.some((e) => e.toRow === null);
    const height = TOP + totalRows * ROW + (dangling ? 26 : 0);
    const fadeFrom = dangling
      ? S.hasMore
        ? TOP + (commits.length + offset) * ROW + ROW / 2
        : TOP + (commits.length + offset) * ROW - 8
      : Infinity;

    let rows = '';
    if (showUnc) {
      rows += `<div class="row special uncommitted" id="uncRow" title="Open Source Control"><div class="msg"><span class="subject">Uncommitted changes</span></div><span class="meta-right">${plural(S.uncommitted, 'file')}</span></div>`;
    }
    rows += commits.map(rowHtml).join('');
    if (S.hasMore) {
      const left = S.total - commits.length;
      rows += `<div class="row special loadmore" id="loadMore"><div class="msg"><span class="subject">${loadingMore ? 'Loading…' : 'Earlier history'}</span></div><span class="meta-right">${fmtN(left)} more</span></div>`;
    }
    const pad = width - LIST_INSET;
    return `<div class="scroller" id="scroller"><div class="list">
      ${graphSvg(commits, offset, showUnc, width, height, fadeFrom)}
      <div class="rows" style="padding-top:${TOP}px; --pad:${pad}px">${rows}</div>
      ${dangling ? '<div class="end-cap"></div>' : '<div style="height:10px"></div>'}
    </div></div>`;
  }

  function drawerHtml() {
    if (!selected || view !== 'list') return '';
    const c = byHash.get(selected);
    if (!c) return '';
    const ai = aiOf(c);
    const d = details.get(c.hash);
    const p = parseCommit(c);
    const cc = p.cc && !p.cc.synthetic ? p.cc : null;
    let body = c.body.replace(/^(co-authored-by|signed-off-by):.*$/gim, '');
    if (cc?.breakingNote) body = body.replace(/^BREAKING[ -]CHANGE:[\s\S]*?(?=\n\s*\n|$)/m, '');
    if (p.cc?.synthetic && MERGE_PR_RE.test(c.subject)) body = body.replace(/^.*\n?/, '');
    body = body.trim();
    const title = cc ? sentence(cc.desc) : p.cc?.synthetic ? sentence(p.cc.desc) : p.text;
    const prInfo = p.pr ? Object.values(S.prs || {}).find((x) => x.number === p.pr) : null;
    const co = (c.coAuthors || [])
      .map((p) => {
        const a = aiOf({ coAuthors: [p] });
        const icon = a
          ? `<span class="ai-ic ${a.kind === 'claude' ? 'claude' : 'bot'}">${a.kind === 'claude' ? I.claude : a.kind === 'cursor' ? I.cube : I.spark}</span>`
          : avatar(p.name, p.email, null);
        return `<span class="coauthor" title="${esc(p.email)}">${icon}${esc(a ? a.name : p.name)}</span>`;
      })
      .join('');

    let files = '';
    if (!d || d === 'loading') {
      files = `<div class="files-head">Changes <span class="stat dots"></span></div>`;
    } else if (d.error) {
      files = `<div class="dr-error">${esc(d.error)}</div>`;
    } else {
      const head = `<div class="files-head">${plural(d.files.length, 'file')} changed<span class="stat"><span class="add">+${fmtN(d.add)}</span> <span class="del">−${fmtN(d.del)}</span></span></div>`;
      files =
        head +
        d.files
          .map((f, i) => {
            const slash = f.path.lastIndexOf('/');
            const fn = f.path.slice(slash + 1);
            const dir = slash >= 0 ? f.path.slice(0, slash) : '';
            const nums = f.binary
              ? '<span class="bin">binary</span>'
              : `${f.added ? `<span class="add">+${fmtN(f.added)}</span>` : ''}${f.removed ? `<span class="del">−${fmtN(f.removed)}</span>` : ''}`;
            const title = f.oldPath ? `${f.oldPath} → ${f.path}` : f.path;
            return `<button class="file" data-fi="${i}" style="--i:${Math.min(i, 12)}" title="${esc(title)}"><span class="st ${f.status}">${f.status}</span><span class="fp"><span class="fn">${esc(fn)}</span><span class="dir">${esc(dir)}</span></span><span class="nums">${nums}</span></button>`;
          })
          .join('');
    }

    return `<section class="drawer" aria-label="Commit details">
      <div class="dr-head">
        ${avatar(c.author, c.email, ai)}
        <div class="dr-title">
          ${cc ? `<div class="dr-cc">${ccTag(cc)}</div>` : ''}
          <div class="dr-subject">${esc(title)}</div>
          <div class="dr-meta">
            ${p.pr ? prPill(p.pr, prInfo, true) + '<span class="sep-dot">·</span>' : ''}
            <span>${esc(c.author)}</span><span class="sep-dot">·</span>
            <span title="${esc(absDate(c.date))}">${esc(longAge(c.date))}</span><span class="sep-dot">·</span>
            <button class="sha" id="copySha" title="Copy full SHA">${c.hash.slice(0, 7)}${I.copy}</button>
          </div>
        </div>
        <button class="icon-btn dr-close" id="drClose" title="Close (Esc)">${I.close}</button>
      </div>
      ${cc?.breaking ? `<div class="breaking-note">${I.warn}<div><b>Breaking change</b>${cc.breakingNote ? `<div>${richText(cc.breakingNote)}</div>` : ''}</div></div>` : ''}
      ${SEG.has(c.hash) ? '' : lineageHtml(c)}
      <div class="dr-scroll">
        ${body ? `<div class="dr-body">${richText(body)}</div>` : ''}
        ${co ? `<div class="coauthors">${co}</div>` : ''}
        ${SEG.has(c.hash) ? stackViewHtml(SEG.get(c.hash)) : ''}
        ${files}
      </div>
    </section>`;
  }

  function stackViewHtml(cur) {
    const st = cur.stack;
    const list = [...st.branches].reverse();
    const rows = list.map((b, i) => {
      const seg = STACK_BRANCH.get(b.name);
      const pr = b.pr || S.prs?.[b.name];
      const isCur = seg === cur;
      const below = list[i + 1]?.name ?? st.trunk;
      const sideways = b.parent !== below;
      return `<button class="sv-row${isCur ? ' cur' : ''}${sideways ? ' no-rail' : ''}" data-f="${seg.key}" data-svb="${esc(b.name)}" style="--c: var(--lane-${seg.color}); --d: ${b.depth}" title="${esc(
        stackSegTitle(
          seg,
          pr,
          S.commits.some((c) => c.hash === b.tip)
        )
      )}">
        <span class="sv-dot"></span>
        <span class="sv-name">${esc(b.name)}</span>
        ${sideways ? `<span class="sv-on">on ${esc(b.parent)}</span>` : ''}
        ${pr ? prPill(pr.number, pr, true) : ''}
        ${b.needsRestack ? `<span class="restack-t" title="Needs restack: ${esc(b.parent)} has moved on">${I.warn}<span>needs restack</span></span>` : ''}
        <span class="sv-cnt">${plural(b.commits.length, 'commit')}</span>
      </button>`;
    });
    return `<div class="stackview">
      <div class="sv-head">${I.stack}<span>Stack</span><span class="sv-sub">${plural(st.branches.length, 'branch')} on ${esc(st.trunk)}${cur.branch.source === 'graphite' ? ' · Graphite' : cur.branch.source === 'pr' ? ' · from PR bases' : ''}</span></div>
      ${rows.join('')}
      <div class="sv-row trunk" style="--c: var(--lane-0)"><span class="sv-dot"></span><span class="sv-name">${esc(st.trunk)}</span></div>
    </div>`;
  }

  function stackTopFor(seg) {
    let cur = seg.branch;
    for (;;) {
      const child = seg.stack.branches.find((b) => b.parent === cur.name);
      if (!child) return cur.name;
      cur = child;
    }
  }
  let pendingPin = null;
  function showSegment(seg) {
    const tipRow = S.commits.findIndex((c) => c.hash === seg.branch.tip);
    if (tipRow >= 0) return togglePin(seg.key, true);
    const top = stackTopFor(seg);
    pendingPin = seg.key;
    selected = null;
    setProgress(true);
    vscode.postMessage({ type: 'selectRef', ref: top === S.head.name ? null : top });
  }

  function lineageHtml(c) {
    const r = S.commits.indexOf(c);
    const a = G.rows[r]?.alloc;
    if (!a || (a.fork === null && a.merge === null)) return '';
    const jump = (row) => {
      const x = S.commits[row];
      return `<button class="jump" data-jump="${x.hash}" title="${esc(x.subject)}">${x.hash.slice(0, 7)}</button>`;
    };
    const lines = [
      `<div><span class="ic"><span class="ldot" style="--c: var(--lane-${a.color}); margin:0"></span></span><span class="lb" data-f="a${a.id}" style="--c: var(--lane-${a.color})">${esc(allocLabel(a))}</span><span class="cnt">${plural(a.count, 'commit')}</span></div>`,
    ];
    if (a.fork !== null)
      lines.push(
        `<div><span class="ic">${I.forkOff}</span>branched from <b>${esc(allocLabel(G.rows[a.fork].alloc))}</b> at ${jump(a.fork)}<span class="cnt">${esc(longAge(S.commits[a.fork].date))}</span></div>`
      );
    if (a.merge !== null)
      lines.push(
        `<div><span class="ic">${I.merged}</span>merged into <b>${esc(allocLabel(G.rows[a.merge].alloc))}</b> at ${jump(a.merge)}<span class="cnt">${esc(longAge(S.commits[a.merge].date))}</span></div>`
      );
    else if (a.fork !== null) lines.push(`<div class="muted"><span class="ic">${I.merged}</span>not merged yet</div>`);
    return `<div class="lineage">${lines.join('')}</div>`;
  }

  function requestDetails(c) {
    if (details.has(c.hash)) return;
    details.set(c.hash, 'loading');
    vscode.postMessage({ type: 'details', hash: c.hash, parent: c.parents[0] });
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function drawerEl() {
    const tpl = document.createElement('template');
    tpl.innerHTML = drawerHtml().trim();
    return tpl.content.firstElementChild;
  }

  function closeDrawer(el) {
    if (reduceMotion.matches) return el.remove();
    el.classList.remove('opening');
    el.style.maxHeight = `${el.offsetHeight}px`;
    void el.offsetHeight;
    el.classList.add('closing');
    el.style.maxHeight = '0px';
    setTimeout(() => el.remove(), 240);
  }

  function select(hash, scroll) {
    selected = hash;
    if (hash) {
      const c = byHash.get(hash);
      if (c) requestDetails(c);
    }
    app.querySelectorAll('.row.sel').forEach((el) => el.classList.remove('sel'));
    const el = hash ? app.querySelector(`.row[data-hash="${hash}"]`) : null;
    el?.classList.add('sel');
    const card = app.querySelector('.card');
    const open = card?.querySelector('.drawer:not(.closing)');
    if (card && hash) {
      const fresh = drawerEl();
      if (open && fresh) {
        // Already open: swap the contents in place so arrow-key browsing stays still.
        open.classList.remove('files-in');
        open.replaceChildren(...fresh.childNodes);
      } else if (fresh) {
        card.querySelectorAll('.drawer.closing').forEach((d) => d.remove());
        fresh.classList.add('opening');
        card.appendChild(fresh);
      }
    } else if (open) closeDrawer(open);
    if (scroll && el) el.scrollIntoView({ block: 'nearest' });
  }

  function refreshDrawer() {
    const old = app.querySelector('.drawer:not(.closing)');
    if (!old) return;
    const fresh = drawerEl();
    if (!fresh) return old.remove();
    const scroller = old.querySelector('.dr-scroll');
    const scrollTop = scroller?.scrollTop ?? 0;
    const wasLoading = !!old.querySelector('.files-head .dots');
    // Replace children rather than the element so an in-flight open animation isn't cut short.
    old.replaceChildren(...fresh.childNodes);
    old.classList.toggle('files-in', wasLoading);
    const s = old.querySelector('.dr-scroll');
    if (s) s.scrollTop = scrollTop;
  }

  const focusStyle = document.createElement('style');
  document.head.appendChild(focusStyle);
  let hoverFocus = null;
  let pinned = null;
  function applyFocus() {
    const k = hoverFocus ?? pinned;
    focusStyle.textContent = !k
      ? ''
      : `.graph .gi:not(.${k}) { opacity: .13; }
         .graph path.${k} { stroke-width: 2.3; }
         .rows .row[data-hash]:not(.${k}) > .msg, .rows .row[data-hash]:not(.${k}) > .author, .rows .row[data-hash]:not(.${k}) > .time { opacity: .3; }
         .rows .row.special { opacity: .3; }
         .branches [data-f]:not([data-f="${k}"]) { opacity: .42; }
         .branches .stack-chip:not(:has([data-f="${k}"])) .sk-ic { opacity: .42; }`;
    app.querySelectorAll('.branches [data-f]').forEach((el) => el.classList.toggle('pinned', el.dataset.f === pinned));
  }
  function setHoverFocus(k) {
    if (k === hoverFocus) return;
    hoverFocus = k;
    applyFocus();
  }
  function togglePin(k, scroll) {
    pinned = pinned === k ? null : k;
    applyFocus();
    if (pinned && scroll)
      app.querySelector(`.rows .row.${k}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  app.addEventListener('mouseover', (ev) => {
    const t = ev.target;
    const el = t.closest('.gut, [data-f]');
    setHoverFocus(el ? el.dataset.f || null : null);
  });
  app.addEventListener('mouseleave', () => setHoverFocus(null));

  const card = document.createElement('div');
  card.className = 'hovercard';
  document.body.appendChild(card);
  let hoverTimer = 0;
  let hideTimer = 0;
  let hoverHash = null;

  function hovercardHtml(c, r) {
    const ai = aiOf(c);
    const row = G.rows[r];
    const humans = (c.coAuthors || []).filter(
      (p) =>
        !ai || !`${p.name} ${p.email}`.match(/claude|anthropic|cursor|copilot|codex|openai|gemini|devin|aider|\[bot\]/i)
    );
    const sub = ai
      ? `Co-authored with ${esc(ai.name)}`
      : humans.length
        ? `with ${esc(humans.map((p) => p.name).join(', '))}`
        : esc(c.email);
    const glow = ai?.kind === 'claude' ? 'var(--claude)' : `var(--lane-${G.rowColor[r]})`;
    const d = details.get(c.hash);
    const changed =
      !d || d === 'loading'
        ? '<span class="dots"></span>'
        : d.error
          ? '—'
          : `${plural(d.files.length, 'file')}&nbsp; <span class="add">+${fmtN(d.add)}</span> <span class="del">−${fmtN(d.del)}</span>`;
    const a = row.alloc;
    const branch = a.name;
    const fork = a.fork !== null ? S.commits[a.fork] : null;
    const merge = a.merge !== null ? S.commits[a.merge] : null;
    const p = parseCommit(c);
    const seg = SEG.get(c.hash);
    const typeRow = p.cc && !p.cc.synthetic ? `<dt>Type</dt><dd class="hc-cc">${ccTag(p.cc, false)}</dd>` : '';
    if (seg) {
      const b = seg.branch;
      const pr = b.pr || S.prs?.[b.name];
      const stackRows = `<dt>Stack</dt><dd><span class="ldot" style="--c: var(--lane-${seg.color})"></span>${esc(b.name)} · ${seg.level} of ${seg.total}</dd>
        ${pr ? `<dt>PR</dt><dd>#${pr.number}${pr.state ? ` · <span class="prs ${pr.state}">${PR_LABEL[pr.state]}</span>` : ''}</dd>` : ''}
        <dt>Based on</dt><dd>${esc(b.parent)}${b.needsRestack ? ' · <span class="warn-t">needs restack</span>' : ''}</dd>`;
      return `<div class="hc-head" style="--glow:${glow}">${avatar(c.author, c.email, ai)}<div class="hc-who"><div class="hc-name">${esc(c.author)}</div><div class="hc-sub">${sub}</div></div></div>
      <dl class="hc-body">
        <dt>Commit</dt><dd class="mono">${c.hash.slice(0, 7)}</dd>
        ${typeRow}
        <dt>Changed</dt><dd>${changed}</dd>
        <dt>Committed</dt><dd title="${esc(absDate(c.date))}">${esc(longAge(c.date))}</dd>
        ${stackRows}
      </dl>`;
    }
    const lin =
      (fork
        ? `<dt>From</dt><dd title="${esc(fork.subject)}"><span class="ldot" style="--c: var(--lane-${G.rows[a.fork].alloc.color})"></span>${esc(allocLabel(G.rows[a.fork].alloc))} · <span class="mono">${fork.hash.slice(0, 7)}</span></dd>`
        : '') +
      (merge
        ? `<dt>Merged</dt><dd title="${esc(longAge(merge.date))}">into ${esc(allocLabel(G.rows[a.merge].alloc))} · ${esc(shortAge(merge.date))} ago</dd>`
        : fork
          ? '<dt>Status</dt><dd>Not merged</dd>'
          : '');
    return `<div class="hc-head" style="--glow:${glow}">${avatar(c.author, c.email, ai)}<div class="hc-who"><div class="hc-name">${esc(c.author)}</div><div class="hc-sub">${sub}</div></div></div>
      <dl class="hc-body">
        <dt>Commit</dt><dd class="mono">${c.hash.slice(0, 7)}</dd>
        ${typeRow}
        <dt>Changed</dt><dd>${changed}</dd>
        <dt>Committed</dt><dd title="${esc(absDate(c.date))}">${esc(longAge(c.date))}</dd>
        ${branch || fork ? `<dt>Branch</dt><dd title="${esc(allocLabel(a))}"><span class="ldot" style="--c: var(--lane-${a.color})"></span>${esc(allocLabel(a))}</dd>` : ''}
        ${lin}
      </dl>`;
  }

  function showCard(rowEl, anchor) {
    const hash = rowEl.dataset.hash;
    const r = Number(rowEl.dataset.r);
    const c = byHash.get(hash);
    if (!c) return;
    hoverHash = hash;
    requestDetails(c);
    card.innerHTML = hovercardHtml(c, r);
    const rr = rowEl.getBoundingClientRect();
    const ar = anchor.getBoundingClientRect();
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    const vw = window.innerWidth;
    const hdr = app.querySelector('.hdr')?.getBoundingClientRect().bottom ?? 0;
    const left = Math.min(Math.max(8, ar.left + 9 - w / 2 - 20), vw - w - 8);
    let top = rr.top - h - 6;
    const below = top < hdr + 4;
    if (below) top = rr.bottom + 6;
    card.classList.toggle('below', below);
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    requestAnimationFrame(() => card.classList.add('show'));
  }
  function hideCard() {
    clearTimeout(hoverTimer);
    card.classList.remove('show');
    hoverHash = null;
  }
  function refreshCard() {
    if (!hoverHash) return;
    const rowEl = app.querySelector(`.row[data-hash="${hoverHash}"]`);
    if (!rowEl) return hideCard();
    const c = byHash.get(hoverHash);
    card.innerHTML = hovercardHtml(c, Number(rowEl.dataset.r));
  }

  app.addEventListener('mouseover', (ev) => {
    const t = ev.target;
    const author = t.closest('.author');
    if (!author) return;
    const rowEl = author.closest('.row[data-hash]');
    if (!rowEl) return;
    clearTimeout(hideTimer);
    if (hoverHash === rowEl.dataset.hash) return;
    clearTimeout(hoverTimer);
    const delay = card.classList.contains('show') ? 60 : 280;
    hoverTimer = setTimeout(() => showCard(rowEl, author.querySelector('.av') || author), delay);
  });
  app.addEventListener('mouseout', (ev) => {
    const t = ev.target;
    if (!t.closest('.author')) return;
    const to = ev.relatedTarget;
    if (to && (to.closest('.author') === t.closest('.author') || card.contains(to))) return;
    clearTimeout(hoverTimer);
    hideTimer = setTimeout(hideCard, 120);
  });
  card.addEventListener('mouseenter', () => clearTimeout(hideTimer));
  card.addEventListener('mouseleave', () => (hideTimer = setTimeout(hideCard, 120)));
  app.addEventListener('scroll', hideCard, true);

  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.setAttribute('role', 'menu');
  document.body.appendChild(menu);
  let menuOpen = false;
  let menuFilter = '';
  let menuIndex = -1;

  function menuItems() {
    const items = [];
    if (S.repos.length > 1) {
      items.push({ sect: 'Repository' });
      for (const r of S.repos)
        items.push({ kind: 'repo', value: r.root, label: r.name, icon: I.repo, checked: r.root === S.repo.root });
      items.push({ sep: true });
    }
    items.push({
      kind: 'ref',
      value: '__all__',
      label: 'All branches',
      icon: I.all,
      checked: S.selected.value === '__all__',
    });
    items.push({ sect: 'Branches' });
    for (const b of S.branches || []) {
      const isHead = b === S.head.name;
      const checked = S.selected.value === b || (S.selected.value === null && isHead);
      items.push({
        kind: 'ref',
        value: isHead ? null : b,
        label: b,
        icon: I.branchSm,
        checked,
        tag: isHead ? 'HEAD' : '',
      });
    }
    if ((S.stacks || []).length) {
      const at = items.findIndex((i) => i.sect === 'Branches');
      const stackItems = [{ sect: 'Stacks' }];
      for (const st of S.stacks) {
        const top = stackTopFor(STACK_BRANCH.get(st.branches[0].name));
        const checked = S.selected.label === top;
        stackItems.push({
          kind: 'ref',
          value: top === S.head.name ? null : top,
          label: `${st.branches[0].name} → ${top}`,
          icon: I.stack,
          checked,
          tag: `${st.branches.length}`,
        });
      }
      items.splice(at, 0, ...stackItems);
    }
    if (S.github?.available && !S.github.connected) {
      items.push({ sep: true });
      items.push({
        kind: 'action',
        value: 'connectGitHub',
        label: 'Connect GitHub for PR status',
        icon: I.pr,
        checked: false,
      });
    }
    if (S.head.name === null) {
      items.splice(items.findIndex((i) => i.sect === 'Branches') + 1, 0, {
        kind: 'ref',
        value: null,
        label: `Detached at ${S.head.commit.slice(0, 7)}`,
        icon: I.branchSm,
        checked: S.selected.value === null,
        tag: 'HEAD',
      });
    }
    const q = menuFilter.trim().toLowerCase();
    return q ? items.filter((i) => i.kind && i.label.toLowerCase().includes(q)) : items;
  }

  function renderMenu() {
    const items = menuItems();
    let k = -1;
    const html = items
      .map((it) => {
        if (it.sect) return `<div class="sect">${esc(it.sect)}</div>`;
        if (it.sep) return '<div class="sep"></div>';
        k++;
        return `<button class="mi${k === menuIndex ? ' kb' : ''}" role="menuitemradio" aria-checked="${it.checked}" data-k="${k}"><span class="ic">${it.icon}</span><span class="lbl">${esc(it.label)}</span>${it.tag ? `<span class="tag">${it.tag}</span>` : ''}${it.checked ? `<span class="check">${I.check}</span>` : ''}</button>`;
      })
      .join('');
    const showFilter = (S.branches || []).length > 8;
    const itemsEl = menu.querySelector('.items');
    if (itemsEl && menu.querySelector('input')) {
      itemsEl.innerHTML = html;
    } else {
      menu.innerHTML = `${showFilter ? '<input type="text" placeholder="Filter branches…" spellcheck="false" />' : ''}<div class="items">${html}</div>`;
    }
    menu._items = items.filter((i) => i.kind);
  }

  function openMenu() {
    const btn = app.querySelector('#refBtn');
    if (!btn || !S) return;
    menuFilter = '';
    menuIndex = -1;
    menu.innerHTML = '';
    renderMenu();
    const r = btn.getBoundingClientRect();
    menu.style.top = `${r.bottom + 6}px`;
    menu.style.left = 'auto';
    menu.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;
    menu.classList.add('show');
    btn.setAttribute('aria-expanded', 'true');
    menuOpen = true;
    const input = menu.querySelector('input');
    if (input) setTimeout(() => input.focus(), 0);
  }
  function closeMenu() {
    menu.classList.remove('show');
    app.querySelector('#refBtn')?.setAttribute('aria-expanded', 'false');
    menuOpen = false;
  }
  function chooseMenu(k) {
    const it = menu._items?.[k];
    if (!it) return;
    closeMenu();
    if (it.kind === 'action') {
      vscode.postMessage({ type: it.value });
      return;
    }
    if (it.kind === 'repo') {
      if (it.value !== S.repo.root) {
        selected = null;
        vscode.postMessage({ type: 'selectRepo', root: it.value });
      }
    } else if (it.value !== S.selected.value) {
      selected = null;
      vscode.postMessage({ type: 'selectRef', ref: it.value });
    }
    setProgress(true);
  }
  menu.addEventListener('click', (ev) => {
    const b = ev.target.closest('.mi');
    if (b) chooseMenu(Number(b.dataset.k));
  });
  menu.addEventListener('input', (ev) => {
    menuFilter = ev.target.value;
    menuIndex = menuFilter ? 0 : -1;
    renderMenu();
  });

  function setProgress(on) {
    app.querySelector('#progress')?.classList.toggle('on', on);
  }

  app.addEventListener('click', (ev) => {
    const t = ev.target;
    if (t.closest('#refBtn')) return menuOpen ? closeMenu() : openMenu();
    if (t.closest('#refreshBtn') || t.closest('#retryBtn')) {
      setProgress(true);
      return vscode.postMessage({ type: 'refresh' });
    }
    if (t.closest('#closeBtn')) return vscode.postMessage({ type: 'close' });
    if (t.closest('#drClose')) return select(null);
    if (t.closest('#copySha') && selected)
      return vscode.postMessage({ type: 'copy', text: selected, label: selected.slice(0, 7) });
    if (t.closest('#uncRow')) return vscode.postMessage({ type: 'openScm' });
    const prEl = t.closest('.pill.pr[data-url]');
    if (prEl) return vscode.postMessage({ type: 'openUrl', url: prEl.dataset.url });
    const svEl = t.closest('.sv-row[data-svb]');
    if (svEl) {
      const seg = STACK_BRANCH.get(svEl.dataset.svb);
      const tip = seg && S.commits.find((c) => c.hash === seg.branch.tip);
      return tip ? select(tip.hash, true) : seg && showSegment(seg);
    }
    const stripEl = t.closest('.branches [data-f]');
    if (stripEl) {
      const k = stripEl.dataset.f;
      const seg = [...STACK_BRANCH.values()].find((x) => x.key === k);
      return seg ? showSegment(seg) : togglePin(k, true);
    }
    const tagEl = t.closest('.cc.live [data-f]');
    if (tagEl) return togglePin(tagEl.dataset.f, false);
    const jumpEl = t.closest('[data-jump]');
    if (jumpEl) return select(jumpEl.dataset.jump, true);
    if (t.closest('#loadMore')) return loadMore();
    const fileEl = t.closest('.file');
    if (fileEl && selected) {
      const d = details.get(selected);
      const f = d?.files?.[Number(fileEl.dataset.fi)];
      if (f)
        vscode.postMessage({
          type: 'openDiff',
          hash: selected,
          base: d.base,
          path: f.path,
          oldPath: f.oldPath,
          status: f.status,
        });
      return;
    }
    const rowEl = t.closest('.row[data-hash]');
    if (rowEl) {
      hideCard();
      select(selected === rowEl.dataset.hash ? null : rowEl.dataset.hash, false);
    }
  });

  document.addEventListener('mousedown', (ev) => {
    if (menuOpen && !menu.contains(ev.target) && !ev.target.closest('#refBtn')) closeMenu();
  });

  document.addEventListener('keydown', (ev) => {
    if (menuOpen) {
      const n = menu._items?.length ?? 0;
      if (ev.key === 'Escape') return closeMenu();
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        menuIndex = (menuIndex + (ev.key === 'ArrowDown' ? 1 : -1) + n) % Math.max(n, 1);
        renderMenu();
        menu.querySelector('.mi.kb')?.scrollIntoView({ block: 'nearest' });
        return;
      }
      if (ev.key === 'Enter' && menuIndex >= 0) return chooseMenu(menuIndex);
      return;
    }
    if (view !== 'list') return;
    if (ev.key === 'Escape' && selected) return select(null);
    if (ev.key === 'Escape' && pinned) {
      pinned = null;
      return applyFocus();
    }
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp' || ev.key === 'j' || ev.key === 'k') {
      ev.preventDefault();
      const commits = S.commits;
      const i = selected ? commits.findIndex((c) => c.hash === selected) : -1;
      const down = ev.key === 'ArrowDown' || ev.key === 'j';
      const next = Math.min(commits.length - 1, Math.max(0, i < 0 ? 0 : i + (down ? 1 : -1)));
      select(commits[next].hash, true);
      if (down && next >= commits.length - 3 && S.hasMore) loadMore();
    }
  });

  document.addEventListener(
    'error',
    (ev) => {
      const img = ev.target;
      if (!(img instanceof HTMLImageElement)) return;
      failedImg.add(img.getAttribute('src'));
      const face = img.parentElement;
      if (face) face.textContent = img.dataset.ini || '';
    },
    true
  );

  let io = null;
  function loadMore() {
    if (loadingMore || !S?.hasMore) return;
    loadingMore = true;
    const lm = app.querySelector('#loadMore .subject');
    if (lm) lm.textContent = 'Loading…';
    vscode.postMessage({ type: 'loadMore' });
  }
  function observeLoadMore() {
    io?.disconnect();
    const el = app.querySelector('#loadMore');
    const root = app.querySelector('.scroller');
    if (!el || !root) return;
    io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && loadMore(), {
      root,
      rootMargin: '200px',
    });
    io.observe(el);
  }

  setInterval(() => {
    app.querySelectorAll('.time[data-t]').forEach((el) => {
      el.textContent = shortAge(Number(el.dataset.t));
    });
  }, 60_000);

  window.addEventListener('message', (ev) => {
    const m = ev.data;
    switch (m?.type) {
      case 'state': {
        const refKey = `${m.repo.root}|${m.selected.value}`;
        const changedRef = refKey !== lastRefKey;
        const firstPaint = view !== 'list';
        lastRefKey = refKey;
        if (changedRef) pinned = pendingPin;
        pendingPin = null;
        S = m;
        indexStacks();
        G = layout(S.commits, S.selected.mainName);
        byHash.clear();
        for (const c of S.commits) byHash.set(c.hash, c);
        if (selected && !byHash.has(selected)) selected = null;
        loadingMore = false;
        view = 'list';
        hideCard();
        render({ animate: changedRef || firstPaint, resetScroll: changedRef });
        if (selected) requestDetails(byHash.get(selected));
        break;
      }
      case 'status':
        if (S) {
          S.uncommitted = m.uncommitted;
          if (view === 'list') render();
        }
        break;
      case 'loading':
        setProgress(true);
        break;
      case 'empty':
        S = null;
        emptyInfo = m;
        view = m.reason === 'loading' ? 'skeleton' : 'empty';
        selected = null;
        render();
        break;
      case 'error':
        if (view === 'list') {
          setProgress(false);
        } else {
          errorMsg = m.message;
          view = 'error';
          render();
        }
        break;
      case 'details': {
        const files = m.files || [];
        details.set(
          m.hash,
          m.error
            ? { error: m.error }
            : {
                base: m.base,
                files,
                add: files.reduce((a, f) => a + f.added, 0),
                del: files.reduce((a, f) => a + f.removed, 0),
              }
        );
        if (m.hash === selected) refreshDrawer();
        if (m.hash === hoverHash) refreshCard();
        break;
      }
    }
  });

  render();
  vscode.postMessage({ type: 'ready' });
})();
