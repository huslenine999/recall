(function () {
  const M = Megaminx, S = Square1, D = Diagram, X = Scramble;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { if (!store.warned) { store.warned = true; setTimeout(() => toast('Progress could not be saved: this browser\'s storage is full or blocked.', { ms: 7000 }), 0); } } if (store.onChange) store.onChange(k); }
  };

  // ---- sticker colors: each alg set / parity group gets one, used as a marker everywhere ----
  const SET_COLORS = { 'Star': '#FFC93C', 'Square': '#4C8DF0', 'Kite': '#E86AA6', 'Barrel': '#F08A1A', 'Scallop': '#2DB89F', 'Shield': '#A56AD8', 'Mushroom': '#9BD43A', 'Left pawn': '#4FC3F7', 'Right pawn': '#F0617A', 'Fists': '#C79A3B', 'Paired edges': '#3FA7A0', 'Perpendicular edges': '#8E7CF0', 'Parallel edges': '#6FB04A', '3 slicers': '#4FC3F7', '4 slicers': '#2DB89F', '5 slicers': '#9BD43A', '6 slicers': '#FFC93C', '7 slicers': '#F08A1A', '8 slicers': '#E86AA6', '9 slicers': '#A56AD8', 'even': '#4C8DF0', 'odd': '#F08A1A', 'CPLL': '#FFC93C', 'EPLL': '#4C8DF0', '3x1 Line': '#A56AD8', '2x2 Block': '#F08A1A', 'R Block': '#4FC3F7', '2x1s touching': '#E86AA6', '2x1s not touching': '#9BD43A', '2x1': '#8E8BB0', 'No blocks': '#2DB89F', 'parity': '#F08A1A', 'no parity': '#4C8DF0' };
  const setColor = g => SET_COLORS[g] || '#8E8BB0';
  const sticker = g => `<span class="sticker" style="--set:${setColor(g)}"></span>`;

  // ---- case lists (same shape for both puzzles); algs come from the sheet or from the user's override ----
  const KEYS = ['mm', 'oll', 'sq', 'csp', 'pbl', 'obl']; // data keys: Megaminx PLL and OLL, Square-1 EP, CSP, PBL and OBL
  const CUBE_SHAPE = 'CCECCECCECCE/CCECCECCECCE';
  const cases = {}, sheet = {}, byId = {};
  KEYS.forEach(k => { cases[k] = []; sheet[k] = {}; byId[k] = {}; });
  function verifyAlg(p, a, c) {
    const flip = c.flip;
    try {
      if (p === 'obl') {
        const st = S.cspState(a, CUBE_SHAPE), cl = st && S.oblClass(st);
        if (!cl) return { ok: false, why: 'This alg does not start from a cube shape' };
        return { ok: cl === c.cls, why: cl === c.cls ? '' : 'This alg solves a different OBL than ' + c.id };
      }
      if (p === 'pbl') {
        const st = S.cspState(a, CUBE_SHAPE), cl = st && S.pblClass(st);
        if (!cl) return { ok: false, why: 'This alg does not start from a cube shape with every piece in its own layer' };
        const same = cl.top === c.ct && cl.bot === c.cb;
        return { ok: same, why: same ? '' : 'This alg solves a different PBL than ' + c.id };
      }
      if (p === 'csp') { const st = S.cspState(a, c.key); return { ok: !!st, why: st ? '' : 'This alg does not start from the ' + c.name + ' shape' }; }
      if (p === 'oll') {
        const r = M.ollPattern(M.run(M.invert(a), D.MM_CFG));
        if (!r.ok) return { ok: false, why: r.reason };
        return { ok: r.cls === c.cls, why: r.cls === c.cls ? '' : 'This alg solves a different OLL than ' + c.id };
      }
      if (p === 'mm') { const r = M.analyze(M.run(M.invert(a), D.MM_CFG)); return { ok: r.ok, why: r.reason || '' }; }
      const st = S.run(a), an = S.analyze(st);
      return { ok: an.ok && st.flip === flip, why: !an.ok ? an.reason : st.flip !== flip ? 'middle layer ends ' + (st.flip ? 'flipped' : 'square') + ' but this case is ' + (flip ? 'flipped' : 'square') : '' };
    } catch (e) { return { ok: false, why: e.message }; }
  }
  function setAlgs(p, c) {
    const list = (db[p].alg && db[p].alg[c.id]) || sheet[p][c.id];
    c.algs = list.map(a => Object.assign({ a }, verifyAlg(p, a, c)));
    c.ok = c.algs.some(x => x.ok);
    c.why = c.ok ? '' : (c.algs[0] && c.algs[0].why) || 'no verified alg';
  }
  // Checking every alg against the simulator is the slowest part of startup (PBL alone is 967 simulations), so each set is
  // checked when it is first needed, and the others are checked a few cases at a time while the browser is idle.
  const checked = { mm: 0, oll: 0, sq: 0, csp: 0, pbl: 0, obl: 0 }; // how many cases of each set are checked so far
  const ensure = p => { const list = cases[p]; while (checked[p] < list.length) setAlgs(p, list[checked[p]++]); };
  // The alg you use: when a case has several algs, the one marked with the star is the one scrambles are built from and shown first.
  const prefAlg = (p, c) => { const a = db[p].pref && db[p].pref[c.id]; return (a && c.algs.find(x => x.ok && x.a === a)) || null; };
  const rebuild = p => { checked[p] = 0; ensure(p); };
  const idle = window.requestIdleCallback ? f => requestIdleCallback(f, { timeout: 2000 }) : f => setTimeout(() => f(null), 50);
  function warm(p) {
    const step = d => { const list = cases[p]; while (checked[p] < list.length && (!d || d.didTimeout || d.timeRemaining() > 2)) { setAlgs(p, list[checked[p]++]); if (!d) break; } if (checked[p] < list.length) idle(step); };
    idle(step);
  }

  // ---- persistent data: one key per puzzle {sel:{id:0|1}, st:{id:{status,times,att,fails,last}}} ----
  const db = { mm: store.get('at.mm.v1', { sel: {}, st: {} }), oll: store.get('at.oll.v1', { sel: {}, st: {} }), sq: store.get('at.sq.v1', { sel: {}, st: {} }), csp: store.get('at.csp.v1', { sel: {}, st: {} }), pbl: store.get('at.pbl.v1', { sel: {}, st: {} }), obl: store.get('at.obl.v1', { sel: {}, st: {} }) };
  const save = p => store.set('at.' + p + '.v1', db[p]);
  const settings = Object.assign({ showDiagram: { mm: true, oll: true, sq: true, csp: true, pbl: true, obl: true }, showCase: true, mmArrows: false, triggers: 'boxes', trigNames: true, theme: 'system' }, store.get('at.settings.v1', {}));
  const saveSettings = () => store.set('at.settings.v1', settings);
  // A chosen palette (settings.palette = its name) sets the color tokens inline, which beats the stylesheet's light/dark blocks.
  const PAL_VARS = ['--well', '--glow2', '--glow3', '--glow-a', '--hold', '--hold-ink', '--bg', '--text', '--mute', '--pri-bg', '--pri-fg', '--focus', '--bad', '--ok', '--warn', '--panel', '--raise', '--line', '--scrim'];
  const palLum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const palContrast = (x, y) => { const a = palLum(x), b = palLum(y); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
  const metaOrig = $$('meta[name="theme-color"]').map(m => m.content);
  const applyTheme = () => {
    const r = document.documentElement, pal = PALETTES.find(x => x[0] === settings.palette);
    PAL_VARS.forEach(k => r.style.removeProperty(k)); r.style.colorScheme = '';
    if (pal) {
      const [, bg, main, sub0, text, err] = pal, dark = palLum(bg) < 0.4;
      // faint muted colors are fine on a sample card but unreadable as UI text: pull them toward the text color until they reach 4.5:1
      const blend = (x, y, t) => '#' + [1, 3, 5].map(i => Math.round(parseInt(x.slice(i, i + 2), 16) * (1 - t) + parseInt(y.slice(i, i + 2), 16) * t).toString(16).padStart(2, '0')).join('');
      let sub = sub0; for (let t = 0.1; palContrast(sub, bg) < 4.5 && t <= 1; t += 0.1) sub = blend(sub0, text, t);
      const onMain = [bg, '#000000', '#ffffff'].find(c => palContrast(c, main) >= 4.5) || (palContrast('#000000', main) > palContrast('#ffffff', main) ? '#000000' : '#ffffff');
      const mix = n => `color-mix(in srgb, ${bg} ${n}%, ${text})`;
      const v = { '--bg': bg, '--text': text, '--mute': sub, '--pri-bg': main, '--pri-fg': onMain, '--focus': main, '--bad': err, '--ok': dark ? '#5FD99A' : '#0F7A45', '--warn': dark ? '#FFC93C' : '#946400', '--well': dark ? `color-mix(in srgb, ${bg} 78%, #000)` : mix(96), '--glow2': sub0, '--glow3': err, '--glow-a': dark ? '10%' : '7%', '--panel': mix(92), '--raise': mix(84), '--line': mix(76), '--scrim': dark ? 'rgba(0,0,0,.65)' : 'rgba(10,10,12,.5)' };
      Object.keys(v).forEach(k => r.style.setProperty(k, v[k]));
      r.style.colorScheme = dark ? 'dark' : 'light'; r.setAttribute('data-theme', dark ? 'dark' : 'light');
    } else if (settings.theme === 'light' || settings.theme === 'dark') r.setAttribute('data-theme', settings.theme); else r.removeAttribute('data-theme');
    $$('meta[name="theme-color"]').forEach((m, i) => { m.content = pal ? pal[1] : metaOrig[i]; });
  };
  if (!settings.showDiagram || typeof settings.showDiagram !== 'object') settings.showDiagram = { mm: true, sq: true, csp: true };
  ['csp', 'pbl', 'obl'].forEach(q => { if (settings.showDiagram[q] === undefined) settings.showDiagram[q] = settings.showDiagram.sq !== false; });
  if (settings.showDiagram.oll === undefined) settings.showDiagram.oll = settings.showDiagram.mm !== false;
  applyTheme();
  let colors = store.get('at.colors', D.MM_DEFAULT_COLORS.slice());
  if (!Array.isArray(colors) || colors.length !== 12) colors = D.MM_DEFAULT_COLORS.slice();

  // Square-1 colours: the top and bottom piece colours and the four side colours (clockwise from above, starting on the right)
  const sqDefault = () => ({ face: D.SQ_COLORS.face, faceD: D.SQ_COLORS.faceD, sides: D.SQ_COLORS.sides.slice() });
  const isHex = v => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
  const cleanSq = o => (o && isHex(o.face) && isHex(o.faceD) && Array.isArray(o.sides) && o.sides.length === 4 && o.sides.every(isHex) ? { face: o.face, faceD: o.faceD, sides: o.sides.slice() } : null);
  let sqColors = cleanSq(store.get('at.sqcolors', null)) || sqDefault();
  const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
  const fixDb = p => { if (!isObj(db[p])) db[p] = {}; ['sel', 'st', 'alg', 'pref'].forEach(k => { if (!isObj(db[p][k])) db[p][k] = {}; }); };
  KEYS.forEach(fixDb);
  DATA_MM.forEach(c => { sheet.mm[c.id] = [c.alg]; const k = { id: c.id, group: c.set }; cases.mm.push(k); byId.mm[c.id] = k; });
  DATA_OLL.forEach(r => { sheet.oll[r.id] = r.algs; const k = { id: r.id, group: r.set, cls: r.cls }; cases.oll.push(k); byId.oll[r.id] = k; });
  DATA_SQ.forEach(r => [['nf', r.algsNoFlip, false], ['f', r.algsFlip, true]].forEach(([col, list, flip]) => {
    if (!list.length) return;
    const id = r.u + ' / ' + r.d + (flip ? ' (flip)' : '');
    sheet.sq[id] = list; const k = { id, group: r.parity ? 'parity' : 'no parity', parity: r.parity, flip, note: r.note }; cases.sq.push(k); byId.sq[id] = k;
  }));
  DATA_CSP.forEach(r => { const id = r.name + ' · ' + r.parity; sheet.csp[id] = [r.alg]; const k = { id, name: r.name, n: r.n, key: r.key, parity: r.parity, group: r.section }; cases.csp.push(k); byId.csp[id] = k; });
  DATA_OBL.forEach(r => { sheet.obl[r.id] = [r.alg]; const k = { id: r.id, cls: r.cls, slashes: r.slashes, group: r.slashes + (r.slashes === 1 ? ' slash' : ' slashes') }; cases.obl.push(k); byId.obl[r.id] = k; });
  DATA_PBL.forEach(r => { sheet.pbl[r.id] = [r.alg]; const k = { id: r.id, top: r.top, bot: r.bot, ct: r.ct, cb: r.cb, slices: r.slices, group: r.slices + ' slicers' }; cases.pbl.push(k); byId.pbl[r.id] = k; });

  const selected = (p, c) => db[p].sel[c.id] !== 0; // default: selected
  const STATUSES = ['New', 'Learning', 'Learned'];
  const stat = (p, id) => {
    let s = db[p].st[id];
    if (!isObj(s)) s = db[p].st[id] = { status: 'New', times: [], att: [], fails: 0, last: 0 };
    else if (!Array.isArray(s.times) || !Array.isArray(s.att) || !STATUSES.includes(s.status)) { if (!Array.isArray(s.times)) s.times = []; if (!Array.isArray(s.att)) s.att = []; if (!STATUSES.includes(s.status)) s.status = 'New'; s.fails = +s.fails || 0; s.last = +s.last || 0; }
    return s;
  };
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const avgOf = (t, n) => (t.length >= n ? mean(t.slice(-n)) : null);

  // ---- timer formatting ----
  const fmt = ms => { const cs = Math.floor(ms / 10), m = Math.floor(cs / 6000), s = Math.floor(cs / 100) % 60, c = String(cs % 100).padStart(2, '0'); return m ? m + ':' + String(s).padStart(2, '0') + '.' + c : s + '.' + c; }; // cstimer style: 12.34, then 1:02.34
  const fmtN = ms => (ms == null ? '–' : fmt(ms));

  // ---- app state ----
  // each puzzle has several alg sets; only the ones with algs behind them are ready (data key = 'mm' or 'sq')
  const SETS = {
    mm: [{ id: 'pll', label: 'PLL', ready: true }, { id: 'oll', label: 'OLL', ready: true }],
    sq: [{ id: 'ep', label: 'EP', ready: true }, { id: 'pbl', label: 'PBL', ready: true }, { id: 'obl', label: 'OBL', ready: true }, { id: 'csp', label: 'CSP', ready: true }]
  };
  const PUZZLE_NAME = { mm: 'Megaminx', sq: 'Square-1' };
  const DK_NAME = { mm: 'Megaminx PLL', oll: 'Megaminx OLL', sq: 'Square-1 EP', csp: 'Square-1 CSP', pbl: 'Square-1 PBL', obl: 'Square-1 OBL' };
  const ui = { puzzle: 'mm', screen: 'train', mmSet: 'all', ollSet: 'all', sqParity: 'all', sqCol: 'both', cspSec: 'all', cspPar: 'both', pblSec: 'all', pblTop: 'any', pblBot: 'any', oblSec: 'all', limit: 90, sort: 'name', edit: null, chipScroll: 0, q: '' };
  ui.set = Object.assign({ mm: 'pll', sq: 'ep' }, store.get('at.sets.v1', {}));
  ['mm', 'sq'].forEach(q => { if (!SETS[q].some(x => x.id === ui.set[q])) ui.set[q] = SETS[q][0].id; });
  // The address bar follows what is on screen (#sq/pbl/cases), so Back, reload and shared links land where you were.
  const SCREENS = ['train', 'cases', 'settings'];
  const routeHash = () => '#' + ui.puzzle + '/' + ui.set[ui.puzzle] + '/' + ui.screen;
  function readRoute() { // returns true when the puzzle or set changed
    const [pz, set, scr] = location.hash.replace(/^#\/?/, '').split('/');
    if (!SETS[pz]) return false;
    const was = ui.puzzle + ui.set[ui.puzzle];
    ui.puzzle = pz;
    if (SETS[pz].some(x => x.id === set)) ui.set[pz] = set;
    if (SCREENS.includes(scr)) ui.screen = scr;
    return was !== ui.puzzle + ui.set[ui.puzzle];
  }
  readRoute();
  let routed = false;
  function writeRoute() {
    const h = routeHash(), had = (history.state && history.state.edit) || null, want = ui.edit || null;
    if (location.hash === h && had === want) { routed = true; return; }
    const push = routed && (location.hash !== h || (want && !had)); // opening a screen or the editor adds a Back step; closing does not
    try { history[push ? 'pushState' : 'replaceState'](want ? { edit: want } : null, '', h); } catch (e) { /* some embedded browsers block it: the app works without */ }
    routed = true;
  }
  const curSet = () => SETS[ui.puzzle].find(x => x.id === ui.set[ui.puzzle]);
  const ready = () => curSet().ready;
  const dk = () => (ui.puzzle === 'sq' ? (ui.set.sq === 'csp' || ui.set.sq === 'pbl' || ui.set.sq === 'obl' ? ui.set.sq : 'sq') : ui.set.mm === 'oll' ? 'oll' : 'mm'); // key of the data behind what is on screen
  const run = { mode: 'random', cur: null, last: null, queue: [], soon: [], phase: 'idle', t0: 0, time: null, scramble: '', revealed: false, lastRec: false };
  // phase: idle (scramble shown, ready) | hold | armed | running | stopped
  const sess = { mm: [], oll: [], sq: [], csp: [], pbl: [], obl: [] }; // this visit's solves per puzzle: {id, time|null}
  const MOD = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '') ? '⌥' : 'Alt+'; // cstimer-style shortcuts
  const isTouch = () => !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  let touchMode = isTouch(); // which wording the hints use; follows what the person actually uses (a laptop with a touch screen, a tablet with a keyboard)

  // ---- weighting ----
  function weightOf(p, c, ctx) {
    const s = stat(p, c.id), base = { Learning: 3, New: 2, Learned: 1 }[s.status];
    const slow = s.times.length && ctx.overall ? Math.min(3, Math.max(0.5, mean(s.times.slice(-10)) / ctx.overall)) : 1;
    const fails = 1 + 0.5 * s.att.filter(Boolean).length;
    const stale = s.last ? 1 + Math.min(1, (ctx.now - s.last) / ctx.maxAge) : 2;
    return base * slow * fails * stale;
  }
  function nextCase() {
    const p = dk(); ensure(p);
    const pool = cases[p].filter(c => c.ok && selected(p, c));
    if (!pool.length) return null;
    run.soon.forEach(x => x.left--);
    const due = run.soon.findIndex(x => x.left <= 0);
    if (due >= 0) { const id = run.soon.splice(due, 1)[0].id; const c = pool.find(c => c.id === id); if (c) return c; }
    if (run.mode === 'recap') {
      const byIdP = new Map(pool.map(c => [c.id, c]));
      run.queue = run.queue.filter(id => byIdP.has(id)); // drop cases unselected since the round began
      if (!run.queue.length) { run.queue = pool.map(c => c.id).sort(() => Math.random() - 0.5); run.total = run.queue.length; }
      return byIdP.get(run.queue.shift());
    }
    const means = pool.map(c => stat(p, c.id).times).filter(t => t.length).map(t => mean(t.slice(-10)));
    const now = Date.now(), ages = pool.map(c => stat(p, c.id).last).filter(Boolean);
    const ctx = { overall: means.length ? mean(means) : 0, now, maxAge: ages.length ? Math.max(1, now - Math.min(...ages)) : 1 };
    const cand = pool.length > 1 ? pool.filter(c => c.id !== run.last) : pool;
    const w = cand.map(c => weightOf(p, c, ctx)); let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < cand.length; i++) { r -= w[i]; if (r <= 0) return cand[i]; }
    return cand[cand.length - 1];
  }
  function newRound() {
    const c = ready() ? nextCase() : null; run.cur = c; run.phase = 'idle'; run.revealed = false; run.time = null; run.lastRec = false;
    if (!c) { run.scramble = ''; return; }
    run.last = c.id;
    const good = c.algs.filter(x => x.ok), mine = prefAlg(dk(), c), alg = mine ? mine.a : good[Math.floor(Math.random() * good.length)].a;
    run.scramble = ui.puzzle === 'mm' ? X.mmSetup(alg) : dk() === 'csp' ? X.cspSetup(alg, c.key) : dk() === 'pbl' || dk() === 'obl' ? X.cspSetup(alg, CUBE_SHAPE) : X.sqSetup(alg);
  }

  // ---- icons ----
  const statusGlyph = s => `<svg class="sg" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="${s === 'Learned' ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8"/>${s === 'Learning' ? '<path d="M8 1.8a6.2 6.2 0 0 1 0 12.4z" fill="currentColor"/>' : ''}${s === 'Learned' ? '<path d="M5 8.2l2.2 2.2L11 6" fill="none" style="stroke:var(--panel)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' : ''}</svg>`;
  const closeIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>';

  // ---- views ----
  function render() {
    stopRaf(); ensure(dk());
    $('#tab-mm').setAttribute('aria-selected', ui.puzzle === 'mm');
    $('#tab-sq').setAttribute('aria-selected', ui.puzzle === 'sq');
    $('#sets').innerHTML = SETS[ui.puzzle].map(x => `<button class="set" role="tab" data-set="${x.id}" aria-selected="${ui.set[ui.puzzle] === x.id}">${x.label}${x.ready ? '' : '<i>soon</i>'}</button>`).join('');
    $$('.sub').forEach(b => b.setAttribute('aria-selected', b.dataset.s === ui.screen));
    const main = $('#main'), key = ui.puzzle + ui.set[ui.puzzle] + ui.screen, y = window.scrollY;
    const soon = !ready() && ui.screen !== 'settings';
    main.innerHTML = soon ? viewSoon() : ui.screen === 'train' ? viewTrain() : ui.screen === 'cases' ? viewCases() : viewSettings();
    if (soon) { /* nothing to wire */ } else if (ui.screen === 'train') wireTrain(); else if (ui.screen === 'cases') wireCases(); else wireSettings();
    document.body.classList.toggle('lock', ui.screen === 'cases' && !!ui.edit);
    if (main.dataset.key === key) window.scrollTo(0, y); else { window.scrollTo(0, 0); if (main.dataset.key && main.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) main.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.16,1,.3,1)' }); }
    main.dataset.key = key;
    if (!soon) updateTimer();
    writeRoute();
    document.title = (ready() ? DK_NAME[dk()] : PUZZLE_NAME[ui.puzzle] + ' ' + curSet().label) + (ui.screen === 'train' ? '' : ' ' + ui.screen) + ' · Recall';
  }

  // diagrams are cached: the Cases screen draws every case
  const dcache = new Map();
  function diagSvg(p, c) {
    const good = prefAlg(p, c) || c.algs.find(x => x.ok); if (!good) return '';
    const key = p + '|' + c.id + '|' + good.a + (p === 'mm' ? '|' + colors.join('') + '|' + settings.mmArrows : p === 'oll' || p === 'csp' ? '' : '|' + sqColors.face + sqColors.faceD + sqColors.sides.join(''));
    if (!dcache.has(key)) dcache.set(key, (p === 'mm' ? D.megaminxDiagram(good.a, colors, { label: c.id, arrows: settings.mmArrows }) : p === 'oll' ? D.megaminxOllDiagram(good.a, { label: c.id }) : p === 'obl' ? D.oblDiagram(good.a, sqColors, { label: c.id }) : p === 'csp' ? D.cspDiagram(good.a, c.key, { label: c.id }) : p === 'pbl' ? D.pblDiagram(good.a, sqColors, { label: c.id }) : D.square1Diagram(good.a, sqColors, { label: c.id })) || '');
    return dcache.get(key);
  }
  const matFor = (p, c) => { const s = diagSvg(p, c); return s ? `<div class="mat">${s}</div>` : ''; };
  const diagramFor = (p, c) => (settings.showDiagram[p] ? matFor(p, c) : '');

  const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.7 6.6 19.7l1.2-6-4.5-4.2 6.1-.7z"/></svg>';
  // ---- trigger marks: the alg split into chunks you can learn as one motion ----
  const TRIGS = [ // Megaminx; U? matches U2 or U2'
    ['sune', "R U R' U R U? R'"], ['antisune', "R U? R' U' R U' R'"],
    ['sexy', "R U R' U'"], ["reverse sexy", "U R U' R'"], ['half sune', "R U R' U"], ['sledge', "R' F R F'"], ['hedgeslammer', "F R' F' R"]
  ].map(([name, t]) => ({ name, t: t.split(' ') })).sort((a, b) => b.t.length - a.t.length);
  const tokEq = (pat, tok) => (pat === 'U?' ? /^U2'?$/.test(tok) : pat === tok);
  function chunks(p, a) { // [{t:'R U R\' U\'', name}] ; name is '' for an unnamed chunk, null for plain moves
    if (p === 'sq' || p === 'csp' || p === 'pbl' || p === 'obl') return a.split('/').map(x => x.trim()).filter(Boolean).map(t => ({ t, name: '', slash: true }));
    const toks = a.split(/\s+/).filter(Boolean), out = [];
    for (let i = 0; i < toks.length;) {
      const m = TRIGS.find(g => g.t.every((q, k) => toks[i + k] !== undefined && tokEq(q, toks[i + k])));
      if (m) { out.push({ t: toks.slice(i, i + m.t.length).join(' '), name: m.name }); i += m.t.length; } else { out.push({ t: toks[i], name: null }); i++; }
    }
    return out;
  }
  function algText(p, a) {
    const mode = settings.triggers;
    if (mode === 'off' || !mode) return esc(a);
    const parts = chunks(p, a), names = settings.trigNames !== false;
    return parts.map((c, i) => {
      if (c.slash) return `<span class="trg ${mode}">${esc(c.t)}</span>${i < parts.length - 1 ? '<span class="sl">/</span>' : ''}`;
      if (c.name === null) return esc(c.t) + ' ';
      const nm = names ? `<i class="tn">${esc(c.name)}</i>` : '';
      return `<span class="trg ${mode}">${mode === 'brackets' ? '[' : ''}${esc(c.t)}${mode === 'brackets' ? ']' : ''}${nm}</span> `;
    }).join('');
  }
  function algsHtml(p, c) { // your alg first; the star only appears when there is a choice to make
    const mine = prefAlg(p, c), multi = c.algs.filter(x => x.ok).length > 1;
    const rows = c.algs.map((x, i) => ({ x, i })); if (mine) rows.sort((a, b) => (b.x === mine) - (a.x === mine));
    return `<div class="algs">${rows.map(({ x, i }) => `<div class="algrow ${x === mine ? 'mine' : mine ? 'other' : ''}">${multi && x.ok ? `<button type="button" class="starb" data-pref="${esc(c.id)}" data-i="${i}" aria-pressed="${x === mine}" title="${x === mine ? 'Your alg. Tap to clear it' : 'Use this alg'}" aria-label="${x === mine ? 'This is your alg. Tap to clear it' : 'Use this alg'}">${STAR}</button>` : ''}<div class="alg ${x.ok ? '' : 'bad'}">${x.ok ? '' : '<span class="tag-check">check</span>'}${algText(p, x.a)}</div></div>`).join('')}</div>`;
  }
  function togglePref(p, id, i) {
    const c = byId[p][id], x = c && c.algs[i]; if (!x || !x.ok) return false;
    if (db[p].pref[id] === x.a) delete db[p].pref[id]; else db[p].pref[id] = x.a;
    save(p); return true;
  }
  const scrambleHtml = t => esc(t).replace(/\//g, '<span class="sl">/</span>');

  // average of the last n solves of this visit: drop the best and the worst, a forgotten case counts as the worst; two or more forgotten = no average
  function aoText(ss, n) {
    if (ss.length < n) return '–';
    const v = ss.slice(-n).map(x => (x.time == null ? Infinity : x.time)).sort((a, b) => a - b);
    if (v[n - 2] === Infinity) return 'DNF';
    return fmt(mean(v.slice(1, n - 1)));
  }
  function sessionHtml(p) {
    const ss = sess[p], times = ss.filter(x => x.time != null).map(x => x.time);
    if (!ss.length) return `<section class="panel session"><h2>This session</h2><p class="note">Your solves from this visit are listed here with their case.</p></section>`;
    const sb = times.length > 1 ? Math.min(...times) : null; // the session's fastest solve is marked in the list
    const rows = ss.slice(-8).reverse().map((x, i) => `<li class="${x.time == null ? 'miss' : x.time === sb ? 'sbest' : ''}"><span class="ix">${ss.length - i}</span>${sticker((byId[p][x.id] || {}).group)}<span class="nm">${esc(x.id)}</span><span class="tm">${x.time == null ? 'Forgot' : fmt(x.time)}</span></li>`).join('');
    return `<section class="panel session"><h2>This session</h2>
      <dl class="stats"><div><dd>${times.length}</dd><dt>Solved</dt></div><div><dd>${ss.length - times.length}</dd><dt>Forgot</dt></div><div><dd>${fmtN(times.length ? mean(times) : null)}</dd><dt>Mean</dt></div><div><dd>${fmtN(times.length ? Math.min(...times) : null)}</dd><dt>Best</dt></div><div><dd>${aoText(ss, 5)}</dd><dt>Ao5</dt></div><div><dd>${aoText(ss, 12)}</dd><dt>Ao12</dt></div></dl>
      <ul class="solves">${rows}</ul></section>`;
  }

  function viewSoon() {
    const lab = curSet().label;
    return `<div class="empty"><h2>No ${PUZZLE_NAME[ui.puzzle]} ${lab} algs yet</h2><p class="muted">Its cases will show up in Train and Cases once the algorithms are added.</p></div>`;
  }

  function revealPanel(p, c, label) {
    const s = stat(p, c.id);
    return `<section class="panel reveal" aria-label="${label}">
        <div class="reveal-h"><h2>${esc(c.id)}</h2><span class="gtag">${sticker(c.group)}${esc(c.group)}</span>${label === 'Last case' ? '<span class="note">Last case</span>' : ''}</div>
        ${diagramFor(p, c)}
        ${algsHtml(p, c)}
        ${c.note ? `<p class="note">${esc(c.note)}</p>` : ''}
        <dl class="stats"><div><dd>${fmtN(s.times.length ? Math.min(...s.times) : null)}</dd><dt>Best</dt></div><div><dd>${fmtN(avgOf(s.times, 5))}</dd><dt>Average of 5</dt></div><div><dd>${s.fails}</dd><dt>Forgot</dt></div></dl>
      </section>`;
  }
  function introHtml() {
    if (settings.seenIntro) return '';
    const key = touchMode ? 'the timer' : '<kbd>Space</kbd>';
    return `<section class="panel intro" aria-label="How Recall works">
      <h2>How Recall works</h2>
      <ol>
        <li><span><b>Scramble.</b> Do the moves at the top on your solved puzzle. They set up one case.</span></li>
        <li><span><b>Solve it.</b> Hold ${key} until it turns green, let go, do the alg, then ${touchMode ? 'tap anywhere' : 'press any key'} to stop.</span></li>
        <li><span><b>Blank?</b> ${touchMode ? 'Tap' : 'Press <kbd>F</kbd> or tap'} I forgot it to see the alg. That case then comes back more often.</span></li>
      </ol>
      <p class="note">Every case is switched on to begin with. In Cases you can pick just the ones you want to drill, search them, and swap in your own algs.</p>
      <div class="row-btns"><button class="btn primary" id="introOk">Got it</button><button class="btn" id="introCases">Choose cases</button></div>
    </section>`;
  }
  function viewTrain() {
    const p = dk(), c = run.cur;
    if (!c) return `<div class="empty"><h2>No cases selected</h2><p class="muted">Choose the cases you want to drill, then come back to train.</p><button class="btn primary" id="toCases">Choose cases</button></div>`;
    const nSel = cases[p].filter(x => x.ok && selected(p, x)).length;
    const prog = run.mode === 'recap' ? `${run.total - run.queue.length} of ${run.total}` : `${nSel} ${nSel === 1 ? 'case' : 'cases'}`;
    const shown = run.revealed, ss = sess[p], lr = ss[ss.length - 1], pc = lr && byId[p][lr.id];
    // the case being solved: its picture only. The answer appears only when you ask for it.
    const caseCard = settings.showCase && !shown && matFor(p, c) ? `<section class="panel casecard" aria-label="Case">${matFor(p, c)}</section>` : '';
    const peek = !shown && ui.peek && pc ? revealPanel(p, pc, 'Last case') : '';
    const rail = shown ? revealPanel(p, c, 'Case answer') : peek + caseCard;
    const last = !shown && lr ? `<div class="last">
        <div class="lt"><b>${esc(lr.id)}</b><span class="lv ${lr.time == null ? 'miss' : lastBest() ? 'best' : ''}">${lr.time == null ? 'Forgot' : fmt(lr.time)}</span>${lr.time != null && lastBest() ? '<span class="pb">Best</span>' : ''}</div>
        <div class="lb"><button class="btn sm" id="peek" ${pc ? '' : 'disabled'}>${ui.peek ? 'Hide alg' : 'Show alg'}</button><button class="btn sm" id="lsoon">Again soon</button><button class="btn sm" id="undo" title="Delete the last solve">Delete <kbd>${MOD}Z</kbd></button></div>
      </div>` : '';
    const actions = shown
      ? `<div class="actions">
        <button class="btn primary" id="next">Next <kbd>Space</kbd></button>
        <button class="btn" id="soon">Again soon</button>
        <button class="btn" id="undo" title="Take back the forgot mark and try this case again">Undo forgot <kbd>⌫</kbd></button>
      </div>`
      : `<div class="actions pre"><button class="btn" id="forgot">I forgot it: show answer <kbd>F</kbd></button></div>`;
    const keys = `<div class="keys"><span><kbd>Space</kbd> Solve</span><span><kbd>F</kbd> Show answer</span><span><kbd>${MOD}Z</kbd> Delete last</span><span><kbd>${MOD}D</kbd> Reset session</span></div>`;
    return `${introHtml()}<div class="train ${shown ? 'revealed' : ''}">
      <div class="stage">
        <div class="stage-bar">
          <select id="mode" aria-label="Mode"><option value="random" ${run.mode === 'random' ? 'selected' : ''}>Weighted random</option><option value="recap" ${run.mode === 'recap' ? 'selected' : ''}>Recap, each case once</option></select>
          <span class="note">${prog}</span>
        </div>
        <div class="scramble ${p === 'mm' ? '' : 'sq'}" id="scr" role="button" tabindex="0" title="Copy the scramble">${scrambleHtml(run.scramble)}</div>
        <div id="timer" class="pad" role="timer" aria-live="off"><span id="digits" class="digits">0:00.00</span><span id="hint" class="hint"></span></div>
        ${actions}${last}${keys}
      </div>
      <div class="rail">${rail}${sessionHtml(p)}</div>
    </div>`;
  }

  function wireTrain() {
    const on = (id, ev, fn) => { const e = $(id); if (e) e.addEventListener(ev, fn); };
    on('#toCases', 'click', () => go(ui.puzzle, 'cases'));
    const seen = () => { settings.seenIntro = true; saveSettings(); };
    on('#introOk', 'click', () => { seen(); render(); window.scrollTo(0, 0); });
    on('#introCases', 'click', () => { seen(); go(ui.puzzle, 'cases'); });
    on('#mode', 'change', e => { run.mode = e.target.value; run.queue = []; newRound(); render(); });
    on('#next', 'click', doNext); on('#forgot', 'click', doForgot); on('#undo', 'click', doUndo);
    const rail = $('.rail'); if (rail) rail.addEventListener('click', e => { const st = e.target.closest('[data-pref]'); if (st && togglePref(dk(), st.dataset.pref, +st.dataset.i)) { const cur = run.cur; render(); if (cur && cur.id === st.dataset.pref) toast(db[dk()].pref[cur.id] ? 'Saved: scrambles for this case now use this alg' : 'Cleared: this case uses any of its algs again'); } });
    on('#peek', 'click', () => { ui.peek = !ui.peek; render(); });
    on('#lsoon', 'click', () => { const l = sess[dk()].slice(-1)[0]; if (l) { run.soon.push({ id: l.id, left: 3 + Math.floor(Math.random() * 3) }); toast('Queued: ' + l.id + ' returns within 3 to 5 solves'); } });
    on('#soon', 'click', () => { run.soon.push({ id: run.cur.id, left: 3 + Math.floor(Math.random() * 3) }); toast('Queued: this case returns within 3 to 5 solves'); });
    const copy = () => { if (!navigator.clipboard) { toast('Copying is not available in this browser'); return; } navigator.clipboard.writeText(run.scramble).then(() => toast('Scramble copied'), () => toast('Copying is not available in this browser')); };
    on('#scr', 'click', copy);
    on('#scr', 'keydown', e => { if (e.key === 'Enter') { e.preventDefault(); copy(); } });
    const t = $('#timer'); if (t) { t.addEventListener('pointerdown', e => { e.preventDefault(); if (!ptrStopped) press(); }); t.addEventListener('pointerup', e => { e.preventDefault(); release(); }); t.addEventListener('pointercancel', release); }
  }
  let toastT = 0;
  function toast(msg, o) { // o: { ms, action, fn } ; longer messages stay longer, and one with a button waits for it
    const n = $('#toast'); if (!n) return; o = o || {};
    n.textContent = msg;
    if (o.action) { const b = document.createElement('button'); b.type = 'button'; b.textContent = o.action; b.addEventListener('click', () => { n.classList.remove('show', 'act'); o.fn(); }); n.appendChild(b); }
    n.classList.toggle('act', !!o.action); n.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => n.classList.remove('show', 'act'), o.ms || (o.action ? 12000 : Math.max(1800, 1000 + msg.length * 45)));
  }

  // ---- timer state machine ----
  let holdT = 0, raf = 0;
  const stopRaf = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
  function hintText() {
    const touch = touchMode;
    if (run.phase === 'hold') return 'Keep holding';
    if (run.phase === 'armed') return 'Let go to start';
    if (run.phase === 'running') return touch ? 'Tap to stop' : 'Press any key to stop';
    if (run.revealed) return touch ? 'Tap Next for the next case' : 'Press Space for the next case';
    return touch ? 'Hold the timer until it turns green' : 'Hold Space until it turns green';
  }
  function updateTimer() {
    document.body.dataset.phase = run.phase;
    const t = $('#timer'); if (!t) return;
    t.className = 'pad ' + run.phase;
    const d = $('#digits'), h = $('#hint'); if (h) h.textContent = hintText();
    if (run.phase === 'running') { d.textContent = fmt(performance.now() - run.t0); stopRaf(); raf = requestAnimationFrame(updateTimer); }
    else if (run.phase !== 'idle') d.textContent = '0.00';
    else d.textContent = run.revealed ? 'Forgot' : run.time != null ? fmt(run.time) : '0.00'; // idle: the last solve's time stays until the next one starts
    const best = run.phase === 'idle' && !run.revealed && run.time != null && lastBest();
    t.classList.toggle('missed', run.phase === 'idle' && run.revealed); t.classList.toggle('best', !!best);
    const bd = $('.badge', t); if (best && !bd) t.insertAdjacentHTML('afterbegin', `<span class="badge">${STAR}New best on ${esc(best)}</span>`); else if (!best && bd) bd.remove();
  }
  function press() { // hold start (Space down / pointer down on timer)
    if (run.phase !== 'idle' || run.revealed || !run.cur) return;
    run.phase = 'hold'; updateTimer();
    holdT = setTimeout(() => { if (run.phase === 'hold') { run.phase = 'armed'; updateTimer(); } }, 300);
  }
  function release() { // Space up / pointer up
    clearTimeout(holdT);
    if (run.phase === 'armed') { run.phase = 'running'; run.t0 = performance.now(); wakeLock(); updateTimer(); }
    else if (run.phase === 'hold') { run.phase = 'idle'; updateTimer(); }
  }
  // Stopping records the solve and moves straight on: the next case is already on screen, the last one is not.
  function stopTimer() {
    const p = dk(), t = performance.now() - run.t0, s = stat(p, run.cur.id);
    s.times.push(t); if (s.times.length > 50) s.times.shift();
    s.att.push(0); if (s.att.length > 10) s.att.shift(); s.last = Date.now(); if (s.status === 'New') s.status = 'Learning';
    sess[p].push({ id: run.cur.id, time: t });
    save(p); ui.peek = false; newRound(); run.time = t; render();
  }
  function doNext() { if (!run.revealed) return; newRound(); render(); }
  function doForgot() { // "I forgot it": count a fail and show the answer
    if (!run.cur || run.revealed || run.phase === 'running') return;
    clearTimeout(holdT);
    const p = dk(), s = stat(p, run.cur.id);
    s.att.push(1); if (s.att.length > 10) s.att.shift(); s.fails++; s.last = Date.now(); if (s.status === 'New') s.status = 'Learning';
    sess[p].push({ id: run.cur.id, time: null });
    run.phase = 'idle'; run.time = null; run.revealed = true; ui.peek = false; save(p); render(); window.scrollTo(0, 0);
  }
  // the case id when the last solve was the best time ever on that case (and not its first time), else ''
  function lastBest() { const e = sess[dk()].slice(-1)[0]; if (!e || e.time == null) return ''; const t = stat(dk(), e.id).times; return t.length > 1 && e.time <= Math.min(...t) ? e.id : ''; }
  function lastTime() { const l = sess[dk()].slice(-1)[0]; return l && l.time != null ? l.time : null; }
  function doUndo() { // delete the last solve (cstimer: Alt+Z). Taking back a forgot mark also lets you try that case again.
    if (run.phase === 'running') return;
    const p = dk(), e = sess[p].pop();
    if (!e) { toast('No solves to delete'); return; }
    const s = stat(p, e.id);
    if (e.time == null) { s.att.pop(); s.fails = Math.max(0, s.fails - 1); } else { s.times.pop(); s.att.pop(); }
    clearTimeout(holdT); run.phase = 'idle'; run.revealed = false; ui.peek = false; run.time = lastTime();
    save(p); toast(`Deleted ${e.id}: ${e.time == null ? 'Forgot' : fmt(e.time)}`); render();
  }
  function resetSession() { // cstimer: Alt+D. Clears this visit's list; each case's saved stats stay.
    if (run.phase === 'running') return;
    const p = dk(), n = sess[p].length;
    if (!n) { toast('The session is already empty'); return; }
    sess[p].length = 0; run.time = null; ui.peek = false; clearTimeout(holdT); run.phase = 'idle';
    toast(`Session reset: ${n} ${n === 1 ? 'solve' : 'solves'} cleared`); render();
  }
  function markLastForgot() { // cstimer: Alt+3 (DNF)
    const p = dk(), e = sess[p].slice(-1)[0];
    if (run.phase === 'running' || run.revealed || !e || e.time == null) return;
    const s = stat(p, e.id); s.times.pop(); s.att.pop(); s.att.push(1); s.fails++;
    e.time = null; run.time = null; save(p); toast(`${e.id} marked as forgot`); render();
  }
  let wl = null;
  async function wakeLock() { try { if (navigator.wakeLock && !wl) { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); } } catch (e) { /* not supported or denied */ } }

  // keyboard (train screen only; Escape closes the alg editor)
  let spaceDown = false, ignoreUp = false;
  document.addEventListener('click', e => { $$('details.menu[open]').forEach(d => { if (!d.contains(e.target)) d.open = false; }); });
  const setTouch = v => { if (touchMode === v) return; touchMode = v; if (ui.screen === 'train' && run.phase === 'idle' && !settings.seenIntro) render(); else { const h = $('#hint'); if (h) h.textContent = hintText(); } };
  // arrow keys move along a row of tabs (puzzle, alg set, screen)
  document.addEventListener('keydown', e => {
    const t = e.target, step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!step || !t.matches || !t.matches('[role="tab"]') || run.phase === 'running') return;
    const list = t.closest('[role="tablist"]'), tabs = $$('[role="tab"]', list), i = (tabs.indexOf(t) + step + tabs.length) % tabs.length;
    e.preventDefault(); tabs[i].click();
    const again = $$('[role="tab"]', list)[i]; if (again) again.focus();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') $$('details.menu[open]').forEach(d => { d.open = false; });
    if (e.key === 'Escape' && ui.edit) { closeEditor(); return; }
    if (e.key === 'Tab' && ui.edit) { // keep Tab inside the open editor
      const f = $$('.drawer button, .drawer textarea'), first = f[0], last = f[f.length - 1];
      if (first && !e.target.closest('.drawer')) { e.preventDefault(); first.focus(); }
      else if (first && e.shiftKey && e.target === first) { e.preventDefault(); last.focus(); }
      else if (first && !e.shiftKey && e.target === last) { e.preventDefault(); first.focus(); }
      return;
    }
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') { if (e.key === 'Escape' && e.target.id === 'q' && e.target.value) { e.target.value = ''; setQuery(''); } return; }
    if (ui.screen === 'cases' && e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !ui.edit) { const q = $('#q'); if (q) { e.preventDefault(); q.focus(); q.select(); } return; }
    if (ui.screen !== 'train' || !ready()) return;
    if (e.code === 'Space') setTouch(false);
    if (e.altKey && !e.ctrlKey && !e.metaKey && run.phase !== 'running') { // Option/Alt shortcuts, by key position (Option+Z types a symbol on a Mac)
      const act = { KeyZ: doUndo, KeyD: resetSession, Digit3: markLastForgot }[e.code];
      if (act) { e.preventDefault(); if (!e.repeat && run.phase === 'idle') act(); return; }
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (run.phase === 'running') { e.preventDefault(); if (!e.repeat) { ignoreUp = e.code === 'Space'; stopTimer(); } return; }
    if (e.code === 'Space') {
      e.preventDefault(); if (e.repeat) return;
      if (run.revealed) { ignoreUp = true; doNext(); } else { spaceDown = true; press(); }
    } else if (e.key === 'Enter' && run.revealed && tag !== 'div') { e.preventDefault(); doNext(); }
    else if (e.key === 'f' || e.key === 'F') doForgot();
    else if (e.key === 'Backspace') { e.preventDefault(); doUndo(); }
  });
  document.addEventListener('keyup', e => {
    if (e.code !== 'Space') return;
    if (ignoreUp) { ignoreUp = false; return; }
    if (spaceDown) { spaceDown = false; release(); }
  });
  // tap anywhere stops a running timer
  let ptrStopped = false;
  document.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') setTouch(true); if (run.phase === 'running') { e.preventDefault(); ptrStopped = true; stopTimer(); } }, true);
  ['pointerup', 'pointercancel'].forEach(ev => document.addEventListener(ev, () => setTimeout(() => { ptrStopped = false; }, 0), true));
  window.addEventListener('blur', () => { if (run.phase === 'hold' || run.phase === 'armed') { clearTimeout(holdT); run.phase = 'idle'; updateTimer(); } });

  // ---- Cases screen ----
  const chip = (key, val, on, label, n, group) => `<button class="fchip" data-f="${key}::${esc(val)}" aria-pressed="${on}">${group ? sticker(group) : ''}${esc(label)}${n != null ? ` <span class="n">${n}</span>` : ''}</button>`;
  function tileHtml(p, c) {
    const s = stat(p, c.id), t = s.times, on = selected(p, c) && c.ok;
    const stats = t.length ? `<span><b>${fmt(mean(t))}</b>mean</span><span><b>${fmt(Math.min(...t))}</b>best</span>${s.fails ? `<span><b>${s.fails}</b>forgot</span>` : ''}` : `<span>No times yet</span>${s.fails ? `<span><b>${s.fails}</b>forgot</span>` : ''}`;
    return `<article class="tile ${on ? 'is-on' : ''} ${c.ok ? '' : 'is-bad'}" style="--set:${setColor(c.group)}">
      <input type="checkbox" class="pick" data-sel="${esc(c.id)}" ${on ? 'checked' : ''} ${c.ok ? '' : 'disabled'} aria-label="Train ${esc(c.id)}">
      <div class="tile-h">
        <span class="tick" aria-hidden="true"></span>
        <h3>${p === 'mm' || p === 'oll' ? esc(c.id) : esc(c.id).replace(/ \/ /g, '<span class="sl">/</span>')}</h3>
        <button type="button" class="status s-${s.status}" data-chip="${esc(c.id)}" title="Change status" aria-label="${esc(c.id)} status: ${s.status}. Change status">${statusGlyph(s.status)}<span>${s.status}</span></button>
      </div>
      ${c.ok ? matFor(p, c) : `<div class="warn">${esc(c.why || 'No alg on this case passes the check.')}</div>`}
      ${algsHtml(p, c)}
      ${c.note ? `<p class="note">${esc(c.note)}</p>` : ''}
      <div class="tile-f"><div class="st">${stats}</div><button type="button" class="btn quiet" data-edit="${esc(c.id)}">Edit</button></div>
    </article>`;
  }
  function progHtml(p) { // how much of the whole set is learned, learning and new
    const n = { Learned: 0, Learning: 0, New: 0 }; cases[p].forEach(c => { n[stat(p, c.id).status]++; });
    const seg = k => `<i class="p-${k}" style="flex-grow:${n[k]}"></i>`;
    return `<div class="prog" id="prog"><div class="prog-bar" aria-hidden="true">${seg('Learned')}${seg('Learning')}${seg('New')}</div>
      <div class="prog-key">${['Learned', 'Learning', 'New'].map(k => `<span class="s-${k}">${statusGlyph(k)}<span><b>${n[k]}</b> ${k.toLowerCase()}</span></span>`).join('')}</div></div>`;
  }
  const countText = p => `${cases[p].filter(c => c.ok && selected(p, c)).length} of ${cases[p].length} selected for training`;
  function filterCases(p) { // the cases the chips, the selects and the search box leave, in the chosen order
    let list = cases[p];
    if (p === 'mm') list = list.filter(c => ui.mmSet === 'all' || c.group === ui.mmSet);
    else if (p === 'oll') list = list.filter(c => ui.ollSet === 'all' || c.group === ui.ollSet);
    else if (p === 'obl') list = list.filter(c => ui.oblSec === 'all' || c.group === ui.oblSec);
    else if (p === 'pbl') list = list.filter(c => (ui.pblSec === 'all' || c.group === ui.pblSec) && (ui.pblTop === 'any' || c.top === ui.pblTop) && (ui.pblBot === 'any' || c.bot === ui.pblBot));
    else if (p === 'csp') list = list.filter(c => (ui.cspSec === 'all' || c.group === ui.cspSec) && (ui.cspPar === 'both' || c.parity === ui.cspPar));
    else list = list.filter(c => (ui.sqParity === 'all' || (ui.sqParity === 'yes') === c.parity) && (ui.sqCol === 'both' || (ui.sqCol === 'flip') === c.flip));
    const norm = t => String(t).toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, ' ').trim(), q = norm(ui.q);
    if (q) { const tight = q.replace(/ /g, ''); list = list.filter(c => { const name = norm(c.id + ' ' + (c.group || '') + ' ' + stat(p, c.id).status); return name.includes(q) || c.algs.some(x => { const a = norm(x.a + ((p === 'mm' || p === 'oll') && /[a-z]{4}/.test(q) ? ' ' + chunks(p, x.a).map(k => k.name || '').join(' ') : '')); return a.includes(q) || a.replace(/ /g, '').includes(tight); }); }); }
    const val = c => { const t = stat(p, c.id).times; return t.length ? mean(t) : -1; };
    if (ui.sort === 'mean') list = list.slice().sort((a, b) => val(b) - val(a));
    else if (ui.sort === 'fails') list = list.slice().sort((a, b) => stat(p, b.id).fails - stat(p, a.id).fails);
    return (ui.shown = list);
  }
  function tilesHtml(p, list) {
    const vis = p === 'pbl' ? list.slice(0, ui.limit) : list; // 967 PBL diagrams at once would be slow to draw
    const more = list.length > vis.length ? `<div class="more"><p class="note">Showing ${vis.length} of ${list.length}</p><button class="btn" id="more">Show ${Math.min(90, list.length - vis.length)} more</button></div>` : '';
    if (!list.length) return `<div class="none muted"><p>No cases match${ui.q.trim() ? ` \u201C${esc(ui.q.trim())}\u201D` : ' these filters'}.</p>${ui.q.trim() ? '<button class="btn" id="qClear">Clear search</button>' : ''}</div>`;
    return `<div class="tiles ${p}">${vis.map(c => tileHtml(p, c)).join('')}</div>${more}`;
  }
  const shownText = (p, list) => (list.length === cases[p].length ? '' : ` \u00B7 ${list.length} shown`);
  let qT = 0;
  function setQuery(v) { // typing redraws only the cards, so the box keeps its focus
    ui.q = v; ui.limit = 90; clearTimeout(qT);
    qT = setTimeout(() => { const p = dk(), w = $('#tilesWrap'); if (!w || ui.screen !== 'cases') return; const list = filterCases(p); w.innerHTML = tilesHtml(p, list); const cn = $('.count'); if (cn) cn.textContent = countText(p) + shownText(p, list); }, 90);
  }
  function viewCases() {
    const p = dk(), list = filterCases(p);
    const ollGroups = p === 'oll' ? [...new Set(cases.oll.map(c => c.group))] : [];
    const chips = p === 'oll'
      ? `<div class="chips" role="group" aria-label="Shape"><select id="ollSet" aria-label="Shape">${[['all', 'All shapes (' + cases.oll.length + ')'], ...ollGroups.map(g => [g, g + ' (' + cases.oll.filter(c => c.group === g).length + ')'])].map(([v, l]) => `<option value="${esc(v)}" ${ui.ollSet === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`
      : p === 'mm'
      ? `<div class="chips" role="group" aria-label="Alg set">${chip('mmSet', 'all', ui.mmSet === 'all', 'All', cases.mm.length)}${[...new Set(cases.mm.map(c => c.group))].map(s => chip('mmSet', s, ui.mmSet === s, s, cases.mm.filter(c => c.group === s).length, s)).join('')}</div>`
      : p === 'obl'
      ? `<div class="chips" role="group" aria-label="Slashes">${chip('oblSec', 'all', ui.oblSec === 'all', 'All', cases.obl.length)}${[...new Set(cases.obl.map(c => c.group))].map(g => chip('oblSec', g, ui.oblSec === g, g, cases.obl.filter(c => c.group === g).length)).join('')}</div>`
      : p === 'pbl'
      ? `<div class="chips" role="group" aria-label="Slices">${chip('pblSec', 'all', ui.pblSec === 'all', 'All', cases.pbl.length)}${[...new Set(cases.pbl.map(c => c.group))].sort().map(g => chip('pblSec', g, ui.pblSec === g, g, cases.pbl.filter(c => c.group === g).length, g)).join('')}</div>`
      : p === 'csp'
      ? `<div class="chips" role="group" aria-label="Shape group and parity">${chip('cspSec', 'all', ui.cspSec === 'all', 'All', cases.csp.length)}${[...new Set(cases.csp.map(c => c.group))].map(s => chip('cspSec', s, ui.cspSec === s, s, cases.csp.filter(c => c.group === s).length, s)).join('')}<span class="div" aria-hidden="true"></span>${[['both', 'Even and odd'], ['even', 'Even'], ['odd', 'Odd']].map(([v, l]) => chip('cspPar', v, ui.cspPar === v, l, null, v === 'both' ? null : v)).join('')}</div>`
      : `<div class="chips" role="group" aria-label="Parity and flip">${[['all', 'All'], ['yes', 'Parity'], ['no', 'No parity']].map(([v, l]) => chip('sqParity', v, ui.sqParity === v, l, null, v === 'yes' ? 'parity' : v === 'no' ? 'no parity' : null)).join('')}<span class="div" aria-hidden="true"></span>${[['both', 'Both algs'], ['noflip', 'Without flip'], ['flip', 'With flip']].map(([v, l]) => chip('sqCol', v, ui.sqCol === v, l)).join('')}</div>`;
    const layerSel = (id, label, key, names) => `<select id="${id}" aria-label="${label}"><option value="any">${label}: any</option>${names.map(n => `<option value="${esc(n)}" ${ui[key] === n ? 'selected' : ''}>${label}: ${esc(n)}</option>`).join('')}</select>`;
    const pblSel = p === 'pbl' ? layerSel('pblTop', 'Top', 'pblTop', [...new Set(cases.pbl.map(c => c.top))]) + layerSel('pblBot', 'Bottom', 'pblBot', [...new Set(cases.pbl.map(c => c.bot))].sort()) : '';
    return `<div class="cases-top">${chips}${progHtml(p)}
      <div class="tools"><span class="count" role="status">${countText(p)}${shownText(p, list)}</span><input type="search" class="txt search" id="q" value="${esc(ui.q)}" placeholder="Search name or alg" aria-label="Search cases by name or alg" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search">${pblSel}
        <details class="menu"><summary class="btn">Select cases <svg viewBox="0 0 12 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 1.5l5 5 5-5"/></svg></summary>
          <div class="menu-pop"><button id="selAll">Select all shown</button><button id="selNone">Deselect all shown</button><button id="selLearning">Only the ones I am learning</button><button id="selNotLearned">Only the ones not learned yet</button></div></details>
        <select id="sort" aria-label="Sort">${[['name', 'Sheet order'], ['mean', 'Slowest first'], ['fails', 'Most forgotten']].map(([v, l]) => `<option value="${v}" ${v === ui.sort ? 'selected' : ''}>${l}</option>`).join('')}</select>
      </div></div><div id="tilesWrap">${tilesHtml(p, list)}</div>${ui.edit && byId[p][ui.edit] ? editorHtml(p, byId[p][ui.edit]) : ''}`;
  }
  // ---- alg editor: reverse the alg, show the state it starts from ----
  const SHEET_U = { '-': '-', T3b: 'cw U', T3a: 'ccw U', Z: 'Z', H: 'H', Opp: 'Opp', Adj: 'Adj', 'O-': 'cw O', 'O+': 'ccw O', W: 'W' };
  const SHEET_D = { '-': '-', T3a: 'cw U', T3b: 'ccw U', Z: 'Z', H: 'H', Opp: 'Opp', Adj: 'Adj', 'O+': 'cw O', 'O-': 'ccw O', W: 'W' };
  const cyc = (perm, name) => { // perm[p] = home of the piece at position p
    const seen = [], out = [];
    perm.forEach((_, i) => { if (seen[i] || perm[i] === i) return; const c = []; let j = i; while (!seen[j]) { seen[j] = 1; c.push(name(j)); j = perm[j]; } out.push(c.join('→') + '→' + c[0]); });
    return out.length ? out.join(', ') : 'solved';
  };
  function previewOne(p, a) {
    try {
      if (p === 'mm') {
        M.parse(a, D.MM_CFG); // throws on a bad token of the alg itself
        const inv = M.invert(a), an = M.analyze(M.run(inv, D.MM_CFG));
        const st = an.ok ? `<div>Edges: ${cyc(an.ep, i => M.FACES[M.ring[i]])}</div><div>Corners: ${cyc(an.cp, i => M.FACES[M.ring[i]] + '/' + M.FACES[M.ring[(i + 1) % 5]])}</div><div class="note">x→y means the piece at x belongs at y.</div>` : `<div class="bad">Not a PLL: ${esc(an.reason)}</div>`;
        return { inv, st, svg: an.ok ? D.megaminxDiagram(a, colors, { arrows: settings.mmArrows }) : null };
      }
      if (p === 'oll') {
        M.parse(a, D.MM_CFG);
        const inv = M.invert(a), r = M.ollPattern(M.run(inv, D.MM_CFG)), c = byId.oll[ui.edit];
        if (!r.ok) return { inv, st: `<div class="bad">Not an OLL alg: ${esc(r.reason)}</div>`, svg: null };
        const same = c && r.cls === c.cls;
        return { inv, st: same ? `<div>This alg solves <b>${esc(c.id)}</b>.</div>` : `<div class="bad">This alg solves a different OLL than ${esc(c ? c.id : '')}.</div>`, svg: D.megaminxOllDiagram(a) };
      }
      if (p === 'obl') {
        const inv = S.invert(a), c = byId.obl[ui.edit], st = S.cspState(a, CUBE_SHAPE), cl = st && S.oblClass(st);
        if (!cl) return { inv, st: `<div class="bad">Not an OBL alg: it has to start from a cube shape.</div>`, svg: null };
        const same = c && cl === c.cls;
        return { inv, st: same ? `<div>This alg solves <b>${esc(c.id)}</b>.</div>` : `<div class="bad">This alg solves a different OBL than ${esc(c ? c.id : '')}.</div>`, svg: D.oblDiagram(a, sqColors) };
      }
      if (p === 'pbl') {
        const inv = S.invert(a), c = byId.pbl[ui.edit], st = S.cspState(a, CUBE_SHAPE), cl = st && S.pblClass(st);
        if (!cl) return { inv, st: `<div class="bad">Not a PBL alg: it has to start from a cube shape and keep every piece in its own layer.</div>`, svg: null };
        const same = c && cl.top === c.ct && cl.bot === c.cb;
        return { inv, st: same ? `<div>This alg solves <b>${esc(c.id)}</b>.</div>` : `<div class="bad">This alg solves a different PBL than ${esc(c ? c.id : '')}.</div>`, svg: D.pblDiagram(a, sqColors) };
      }
      if (p === 'csp') {
        const inv = S.invert(a), c = byId.csp[ui.edit], st = S.cspState(a, c && c.key);
        if (!st) return { inv, st: `<div class="bad">This alg does not start from the ${esc(c ? c.name : '')} shape.</div>`, svg: null };
        return { inv, st: `<div>Starts from the <b>${esc(c.name)}</b> shape, middle layer <b>${st.flip ? 'flipped' : 'square'}</b>.</div>`, svg: D.cspDiagram(a, c.key) };
      }
      const inv = S.invert(a), t = S.run(a), an = S.analyze(t);
      if (!an.ok) return { inv, st: `<div class="bad">Not an EP alg: ${esc(an.reason)}</div>`, svg: null };
      const u = SHEET_U[S.classOf(an.topPerm)], d = SHEET_D[S.classOf(an.botPerm)];
      return { inv, st: `<div>Row <b>${u} / ${d}</b>, middle layer <b>${t.flip ? 'flipped' : 'square'}</b>, parity ${S.parity(an.topPerm) || S.parity(an.botPerm) ? 'yes' : 'no'}</div>`, svg: D.square1Diagram(a, sqColors) };
    } catch (e) { return { inv: '', st: `<div class="bad">${esc(e.message)}</div>`, svg: null }; }
  }
  function previewHtml(p, text) {
    const lines = text.split('\n').map(x => x.trim()).filter(Boolean);
    return lines.map(a => { const r = previewOne(p, a); return `<div class="pv"><div class="alg">${esc(a)}</div><div class="note">Setup (the alg reversed)</div><div class="alg">${esc(r.inv)}</div>${r.st}${r.svg ? `<div class="mat">${r.svg}</div>` : ''}</div>`; }).join('') || '<p class="note">Add an alg to see its case.</p>';
  }
  function editorHtml(p, c) {
    const text = c.algs.map(x => x.a).join('\n');
    return `<div class="scrim" id="edscrim"></div>
      <aside class="drawer" role="dialog" aria-modal="true" aria-label="Edit algs for ${esc(c.id)}">
        <div class="drawer-h"><h2>${esc(c.id)}</h2><button class="icon-btn" id="edx" aria-label="Close editor">${closeIcon}</button></div>
        <p class="note">One alg per line. The preview reverses each alg and shows the case it solves.${p === 'sq' ? ` This case ends with the middle layer <b>${c.flip ? 'flipped' : 'square'}</b>.` : ''}</p>
        <textarea id="edtxt" rows="${Math.max(3, c.algs.length + 1)}" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Algs">${esc(text)}</textarea>
        <div id="edprev">${previewHtml(p, text)}</div>
        <div class="drawer-f"><button class="btn primary" id="edsave">Save</button><button class="btn" id="edcancel">Cancel</button>${db[p].alg[c.id] ? '<button class="btn danger" id="edreset">Back to sheet alg</button>' : ''}</div>
      </aside>`;
  }
  function closeEditor(changed) {
    const id = ui.edit; if (changed) { run.queue = []; run.cur = null; }
    editFocus = id;
    if (history.state && history.state.edit) { history.back(); return; } // opening added a Back step: take it, and popstate redraws
    ui.edit = null; render(); focusEdit();
  }
  let editFocus = null;
  function focusEdit() { const id = editFocus; editFocus = null; const b = id && $$('[data-edit]').find(x => x.dataset.edit === id); if (b) b.focus({ preventScroll: true }); }
  function wireCases() {
    const on = (id, ev, fn) => { const e = $(id); if (e) e.addEventListener(ev, fn); };
    const p = dk();
    const chips = $('.chips'); if (chips && ui.chipScroll) chips.scrollLeft = ui.chipScroll; // reading or setting scrollLeft forces a layout: skip it when there is nothing to restore
    $$('[data-f]').forEach(b => b.addEventListener('click', () => { const [k, v] = b.dataset.f.split('::'); ui.chipScroll = (b.closest('.chips') || {}).scrollLeft || 0; ui[k] = v; ui.limit = 90; render(); }));
    on('#ollSet', 'change', e => { ui.ollSet = e.target.value; render(); });
    ['pblTop', 'pblBot'].forEach(k => { const e = $('#' + k); if (e) e.addEventListener('change', () => { ui[k] = e.value; ui.limit = 90; render(); }); });
    on('#q', 'input', e => setQuery(e.target.value));
    const edit = ui.edit && byId[p][ui.edit];
    if (edit) {
      on('#edtxt', 'input', e => { $('#edprev').innerHTML = previewHtml(p, e.target.value); });
      const done = () => closeEditor(true), close = () => closeEditor();
      on('#edsave', 'click', () => {
        const list = $('#edtxt').value.split('\n').map(x => x.trim()).filter(Boolean);
        if (!list.length) return;
        if (list.join('\n') === sheet[p][edit.id].join('\n')) delete db[p].alg[edit.id]; else db[p].alg[edit.id] = list;
        save(p); setAlgs(p, edit); done();
      });
      on('#edreset', 'click', () => { delete db[p].alg[edit.id]; save(p); setAlgs(p, edit); done(); });
      on('#edcancel', 'click', close); on('#edx', 'click', close); on('#edscrim', 'click', close);
    }
    on('#sort', 'change', e => { ui.sort = e.target.value; render(); });
    const setSel = fn => { $$('details.menu[open]').forEach(d => { d.open = false; }); ui.shown.forEach(c => { if (c.ok) db[p].sel[c.id] = fn(c) ? 1 : 0; }); save(p); run.queue = []; run.cur = null; render(); };
    on('#selAll', 'click', () => setSel(() => true));
    on('#selNone', 'click', () => setSel(() => false));
    on('#selLearning', 'click', () => setSel(c => stat(p, c.id).status === 'Learning'));
    on('#selNotLearned', 'click', () => setSel(c => stat(p, c.id).status !== 'Learned'));
    // the whole card is the button: a click anywhere on it (except its own buttons) toggles the case
    const grid = $('#tilesWrap');
    if (grid) {
      grid.addEventListener('click', e => {
        if (e.target.closest('#more')) { ui.limit += 90; grid.innerHTML = tilesHtml(p, ui.shown); return; }
        if (e.target.closest('#qClear')) { const q = $('#q'); if (q) { q.value = ''; q.focus(); } setQuery(''); return; }
        const st = e.target.closest('[data-pref]');
        if (st) { if (togglePref(p, st.dataset.pref, +st.dataset.i)) st.closest('.tile').outerHTML = tileHtml(p, byId[p][st.dataset.pref]); return; }
        const ed = e.target.closest('[data-edit]');
        if (ed) { ui.edit = ed.dataset.edit; render(); const t = $('#edtxt'); if (t) t.focus(); return; }
        const ch = e.target.closest('[data-chip]');
        if (ch) { // a status change only touches its own card
          const c = byId[p][ch.dataset.chip], s = stat(p, c.id); s.status = { New: 'Learning', Learning: 'Learned', Learned: 'New' }[s.status]; save(p);
          ch.closest('.tile').outerHTML = tileHtml(p, c); const pg = $('#prog'); if (pg) pg.outerHTML = progHtml(p); return;
        }
        if (e.target.closest('button, a, input, select, textarea')) return;
        const tile = e.target.closest('.tile'), box = tile && tile.querySelector('input[data-sel]');
        if (box && !box.disabled) box.click();
      });
      grid.addEventListener('change', e => {
        const box = e.target.closest('input[data-sel]'); if (!box) return;
        db[p].sel[box.dataset.sel] = box.checked ? 1 : 0; run.queue = []; run.cur = null; save(p);
        box.closest('.tile').classList.toggle('is-on', box.checked); box.closest('.tile').classList.toggle('pop', box.checked);
        const cn = $('.count'); if (cn) cn.textContent = countText(p) + shownText(p, ui.shown);
      });
    }
  }

  // ---- Settings screen ----
  let installEv = null; // Chrome and Android offer an install prompt; iPhone installs through Share > Add to Home Screen
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEv = e; if (ui.screen === 'settings') render(); });
  window.addEventListener('appinstalled', () => { installEv = null; if (ui.screen === 'settings') render(); });
  const offlineText = () => {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return 'Offline use needs the hosted site. This copy is a file on your device and already works without a connection.';
    return navigator.serviceWorker.controller
      ? 'Recall is saved on this device and opens with no connection. To put it on your home screen: in Safari tap Share, then Add to Home Screen. In Chrome open the menu and tap Install app.'
      : 'Saving Recall for offline use. Reload once while online and it will open with no connection.';
  };
  function viewSettings() {
    const p = dk(), name = DK_NAME[p];
    const palBtn = x => x ? `<button class="pal" data-pal="${x[0]}" aria-pressed="${settings.palette === x[0]}" style="--b:${x[1]};--m:${x[2]};--s:${x[3]};--t:${x[4]}"><b>${x[0]}</b><i></i></button>` : `<button class="pal pal-def" data-pal="" aria-pressed="${!settings.palette || !PALETTES.some(y => y[0] === settings.palette)}"><b>Default</b><i></i></button>`;
    const sqSw = [['face', 'Top (U)'], ['faceD', 'Bottom (D)']].map(([k, l]) => `<label>${l}<input type="color" data-sq="${k}" value="${sqColors[k]}"></label>`).join('') + sqColors.sides.map((v, i) => `<label>Side ${i + 1}<input type="color" data-sq="${i}" value="${v}"></label>`).join('');
    const swatch = M.FACES.map((f, i) => `<label>${f}<input type="color" data-col="${i}" value="${colors[i]}"></label>`).join('');
    return `<div class="settings">
      <section class="group"><h2>Training</h2>
        <label class="line"><span>Show the diagram in the answer<small>${name} only. The answer opens when you tap I forgot it. Cases always show their diagram.</small></span><input type="checkbox" class="switch" id="showDiag" ${settings.showDiagram[p] ? 'checked' : ''}></label>
        <div class="line" style="display:block;cursor:default"><span>Trigger marks<small>Groups moves you can learn as one motion, like sune or sledge. Megaminx marks the common ones; Square-1 marks each turn between slashes.</small></span><div class="seg" role="group" aria-label="Trigger marks">${[['boxes', 'Boxes'], ['brackets', 'Brackets'], ['off', 'Off']].map(([v, l]) => `<button type="button" class="btn" data-trg="${v}" aria-pressed="${settings.triggers === v}">${l}</button>`).join('')}</div></div>
        <label class="line"><span>Show trigger names<small>The name under each marked group, such as sune.</small></span><input type="checkbox" class="switch" id="trigNames" ${settings.trigNames !== false ? 'checked' : ''}></label>
        ${p === 'mm' ? `<label class="line"><span>Show arrows on Megaminx cases<small>Arrows mark where each piece goes. Off by default: the sticker colours already show the case.</small></span><input type="checkbox" class="switch" id="mmArrows" ${settings.mmArrows ? 'checked' : ''}></label>` : ''}
        <label class="line"><span>Show the case picture while solving<small>The case you are about to solve, without its algorithm. Turn off to solve from the scramble alone.</small></span><input type="checkbox" class="switch" id="showCase" ${settings.showCase ? 'checked' : ''}></label>
        <div class="line" style="cursor:default"><span>New here?<small>A three-step walkthrough of the Train screen.</small></span><button class="btn" id="showIntro">How Recall works</button></div>
      </section>
      <section class="group kbd-group"><h2>Keyboard shortcuts</h2>
        <ul class="klist">
          <li><span>Hold, then let go to start. Any key stops</span><span><kbd>Space</kbd></span></li>
          <li><span>I forgot it: show the answer</span><span><kbd>F</kbd></span></li>
          <li><span>Next case after the answer</span><span><kbd>Space</kbd></span></li>
          <li><span>Delete the last solve</span><span><kbd>${MOD}Z</kbd> <kbd>⌫</kbd></span></li>
          <li><span>Reset the session</span><span><kbd>${MOD}D</kbd></span></li>
          <li><span>Mark the last solve as forgot</span><span><kbd>${MOD}3</kbd></span></li>
        </ul>
      </section>
      <section class="group look"><h2>Appearance</h2>
        ${settings.palette && PALETTES.some(x => x[0] === settings.palette) ? '' : `<div class="line"><span>Theme</span><div class="seg" role="group" aria-label="Theme">${[['system', 'System'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => `<button data-theme="${v}" aria-pressed="${settings.theme === v}">${l}</button>`).join('')}</div></div>`}
        <div class="line" style="display:block;cursor:default"><span>Color palette<small>Pick a look for the whole site. Default uses the System, Light or Dark theme.</small></span><div class="pals">${palBtn(null)}${PALETTES.map(palBtn).join('')}</div></div>
        ${p !== 'mm' && p !== 'oll' ? `<div class="line" style="display:block;cursor:default"><span>Square-1 colors<small>Used by the EP, PBL and OBL diagrams. Sides 1 to 4 go clockwise seen from above, starting on the right. ${p === 'csp' ? 'CSP cases are about shape only, so they are drawn without colors.' : 'Match them to your puzzle.'}</small></span><div class="swatches">${sqSw}</div><button class="btn" id="resetSqCol">Reset colors</button></div>` : ''}
        ${p === 'mm' ? `<div class="line" style="display:block;cursor:default"><span>Megaminx face colors<small>Used by the case diagrams. Match them to your puzzle.</small></span><div class="swatches">${swatch}</div><button class="btn" id="resetCol">Reset colors</button></div>` : ''}
      </section>
      <section class="group"><h2>Offline</h2>
        <p class="note" id="offlineMsg">${offlineText()}</p>
        <div class="row-btns">${installEv ? '<button class="btn primary" id="install">Install Recall</button>' : ''}</div>
      </section>
      ${syncSection()}
      <section class="group"><h2>Progress</h2>
        <p class="note" style="margin-bottom:10px">Export saves your progress as a file; Import loads one.</p>
        <div class="row-btns"><button class="btn" id="export">Export</button><label class="btn">Import<input type="file" id="import" accept="application/json" hidden></label><button class="btn danger" id="reset">Reset ${name} stats</button></div>
        <p class="note" id="msg" role="status"></p>
      </section>
    </div>`;
  }
  function wireSettings() {
    const on = (id, ev, fn) => { const e = $(id); if (e) e.addEventListener(ev, fn); };
    const p = dk(), msg = t => { $('#msg').textContent = t; };
    wireSync();
    on('#showDiag', 'change', e => { settings.showDiagram[p] = e.target.checked; saveSettings(); });
    $$('[data-trg]').forEach(b => b.addEventListener('click', () => { settings.triggers = b.dataset.trg; saveSettings(); render(); }));
    on('#trigNames', 'change', e => { settings.trigNames = e.target.checked; saveSettings(); });
    on('#mmArrows', 'change', e => { settings.mmArrows = e.target.checked; saveSettings(); });
    on('#showCase', 'change', e => { settings.showCase = e.target.checked; saveSettings(); });
    on('#showIntro', 'click', () => { settings.seenIntro = false; saveSettings(); go(ui.puzzle, 'train'); });
    $$('[data-pal]').forEach(b => b.addEventListener('click', () => { settings.palette = b.dataset.pal; saveSettings(); applyTheme(); const y = scrollY; render(); scrollTo(0, y); }));
    $$('.seg [data-theme]').forEach(b => b.addEventListener('click', () => { settings.theme = b.dataset.theme; saveSettings(); applyTheme(); render(); }));
    on('#install', 'click', () => { if (installEv) { installEv.prompt(); installEv = null; } });
    on('#resetSqCol', 'click', () => { sqColors = sqDefault(); store.set('at.sqcolors', sqColors); render(); });
    $$('input[data-sq]').forEach(i => i.addEventListener('change', e => { const k = e.target.dataset.sq; if (k === 'face' || k === 'faceD') sqColors[k] = e.target.value; else sqColors.sides[+k] = e.target.value; store.set('at.sqcolors', sqColors); }));
    on('#resetCol', 'click', () => { colors = D.MM_DEFAULT_COLORS.slice(); store.set('at.colors', colors); render(); });
    $$('input[data-col]').forEach(i => i.addEventListener('change', e => { colors[+e.target.dataset.col] = e.target.value; store.set('at.colors', colors); }));
    on('#export', 'click', () => {
      const blob = new Blob([JSON.stringify(snapshot(), null, 1)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'recall-progress.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    on('#import', 'change', e => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      f.text().then(t => {
        let o; try { o = JSON.parse(t); } catch (x) { throw new Error('that file is not a Recall export'); }
        if (!isObj(o) || o.app !== 'alg-trainer' || !isObj(o.mm) || !isObj(o.sq)) throw new Error('that file is not a Recall export');
        if (!confirm('Replace the progress on this device with the one in ' + f.name + '?')) return;
        KEYS.forEach(q => { if (o[q]) db[q] = o[q]; }); KEYS.forEach(q => { fixDb(q); save(q); checked[q] = 0; });
        if (o.settings) { Object.assign(settings, o.settings); saveSettings(); applyTheme(); }
        if (Array.isArray(o.colors) && o.colors.length === 12) { colors = o.colors; store.set('at.colors', colors); }
        if (cleanSq(o.sqColors)) { sqColors = cleanSq(o.sqColors); store.set('at.sqcolors', sqColors); }
        run.cur = null; dcache.clear(); render(); $('#msg').textContent = 'Imported ' + f.name + '.';
      }).catch(err => msg('Import failed: ' + err.message));
    });
    on('#reset', 'click', () => { if (confirm('Delete all ' + name + ' stats and selections? Your own algs are kept.')) { db[p] = { sel: {}, st: {}, alg: db[p].alg }; save(p); run.cur = null; msg(name + ' stats and selections were reset.'); } });
  }

  // ---- navigation ----
  const go = (puzzle, screen) => { clearTimeout(holdT); ui.peek = false; ui.edit = null; if (puzzle !== ui.puzzle) { run.cur = null; run.queue = []; run.soon = []; run.last = null; } ui.puzzle = puzzle; ui.screen = screen; if (screen === 'train' && ready() && !run.cur) newRound(); render(); };
  $('#sets').addEventListener('click', e => {
    const b = e.target.closest('[data-set]'); if (!b || b.dataset.set === ui.set[ui.puzzle]) return;
    clearTimeout(holdT); ui.edit = null; ui.set[ui.puzzle] = b.dataset.set; store.set('at.sets.v1', ui.set);
    run.cur = null; run.queue = []; run.soon = []; run.last = null;
    if (ui.screen === 'train' && ready()) newRound();
    render();
  });
  window.addEventListener('popstate', () => {
    if (run.phase === 'running') return;
    clearTimeout(holdT); ui.peek = false;
    if (readRoute()) { run.cur = null; run.queue = []; run.soon = []; run.last = null; }
    const ed = history.state && history.state.edit; ui.edit = ui.screen === 'cases' && ed && byId[dk()][ed] ? ed : null;
    if (ui.screen === 'train' && ready() && !run.cur) newRound();
    render(); focusEdit();
  });
  $('#brand').addEventListener('click', () => go(ui.puzzle, 'train'));
  $('#tab-mm').addEventListener('click', () => go('mm', ui.screen));
  $('#tab-sq').addEventListener('click', () => go('sq', ui.screen));
  $$('.sub').forEach(b => b.addEventListener('click', () => go(ui.puzzle, b.dataset.s)));
  // Sticky offsets follow the real header and bottom-nav heights (they change when fonts load, chips wrap or the window resizes).
  // A ResizeObserver reports the sizes without forcing a layout on every render.
  const rootVar = (k, v) => document.documentElement.style.setProperty(k, v);
  const setTopH = h => rootVar('--top-h', (h == null ? $('.top').getBoundingClientRect().height : h) + 'px');
  const setNavH = h => { const n = $('.nav'); rootVar('--nav-h', getComputedStyle(n).position === 'fixed' ? (h == null ? n.getBoundingClientRect().height : h) + 'px' : '0px'); };
  const boxH = e => (e.borderBoxSize && e.borderBoxSize[0] ? e.borderBoxSize[0].blockSize : e.target.getBoundingClientRect().height);
  if (window.ResizeObserver) {
    new ResizeObserver(es => setTopH(boxH(es[es.length - 1]))).observe($('.top'));
    new ResizeObserver(es => setNavH(boxH(es[es.length - 1]))).observe($('.nav'));
  } else { window.addEventListener('resize', () => { setTopH(); setNavH(); }); setTopH(); setNavH(); }
  // ---- sync: progress kept under a short code (no account), so it follows you to your other devices ----
  const SYNCED = /^at\.((mm|oll|sq|csp|pbl|obl)\.v1|settings\.v1|colors|sqcolors)$/; // what a change to marks as needing a save
  const sync = Object.assign({ code: null, at: 0, dirty: false }, store.get('at.sync.v1', {}), { err: '', busy: false, quiet: false, pulled: 0 });
  const saveSync = () => { const q = sync.quiet; sync.quiet = true; store.set('at.sync.v1', { code: sync.code, at: sync.at, dirty: sync.dirty }); sync.quiet = q; };
  function snapshot() { const o = { app: 'alg-trainer', v: 1 }; KEYS.forEach(k => (o[k] = db[k])); return Object.assign(o, { settings, colors, sqColors }); }
  const forUpload = () => JSON.parse(JSON.stringify(snapshot(), (k, v) => (k === 'times' && Array.isArray(v) ? v.map(Math.round) : v))); // whole ms is plenty and halves the size
  const canon = o => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort().reduce((a, x) => ((a[x] = v[x]), a), {}) : v));
  let pushT = null;
  store.onChange = k => {
    if (sync.quiet || !sync.code || !SYNCED.test(k)) return;
    sync.dirty = true; saveSync(); syncStatus();
    clearTimeout(pushT); pushT = setTimeout(syncPush, 2500);
  };
  async function syncApi(method, body, code, keepalive) {
    let r;
    try {
      r = await fetch('/api/sync' + (method === 'GET' ? '?code=' + encodeURIComponent(code) : ''),
        method === 'GET' ? { cache: 'no-store' } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: !!keepalive });
    } catch (e) { const x = new Error(navigator.onLine === false ? 'Offline: will sync when you are back online.' : 'Could not reach the sync server.'); x.offline = true; throw x; }
    const j = await r.json().catch(() => null);
    if (!j) { const x = new Error(/^https?:$/.test(location.protocol) ? 'Sync is not available on this site.' : 'Sync works on the online version of Recall.'); x.status = r.status; throw x; }
    if (!r.ok) { const x = new Error(j.error || 'Sync failed (' + r.status + ')'); x.status = r.status; throw x; }
    return j;
  }
  // Merge another copy into this one. Practice stats keep whichever side was used more recently, per case;
  // selections, own algs, starred algs and settings come from `prefer` ('local' or 'remote') when both have them.
  function syncMerge(o, prefer) {
    const loc = prefer === 'local', before = canon(snapshot());
    sync.quiet = true;
    try {
      KEYS.forEach(q => {
        const r = o[q]; if (!r || typeof r !== 'object') return;
        const l = db[q], st = Object.assign({}, r.st || {});
        Object.entries(l.st || {}).forEach(([id, s]) => { const rs = st[id]; if (!rs || (s.last || 0) >= (rs.last || 0)) st[id] = s; });
        const mix = k => (loc ? Object.assign({}, r[k] || {}, l[k] || {}) : Object.assign({}, l[k] || {}, r[k] || {}));
        db[q] = Object.assign({}, r, l, { sel: mix('sel'), st, alg: mix('alg'), pref: mix('pref') });
        fixDb(q); save(q); checked[q] = 0;
      });
      if (!loc) {
        if (o.settings && typeof o.settings === 'object') { Object.assign(settings, o.settings); saveSettings(); applyTheme(); }
        if (Array.isArray(o.colors) && o.colors.length === 12) { colors = o.colors; store.set('at.colors', colors); }
        if (cleanSq(o.sqColors)) { sqColors = cleanSq(o.sqColors); store.set('at.sqcolors', sqColors); }
      }
    } finally { sync.quiet = false; }
    if (canon(snapshot()) === before) return; // nothing new: leave the current scramble alone
    dcache.clear();
    if (run.phase === 'idle' && !ui.edit) { if (!run.revealed) run.cur = null; if (ui.screen === 'train' && ready() && !run.cur) newRound(); render(); }
  }
  async function syncPush(keepalive) {
    clearTimeout(pushT);
    if (!sync.code) return;
    if (sync.busy) { pushT = setTimeout(syncPush, 1500); return; }
    sync.busy = true;
    try { const j = await syncApi('POST', { code: sync.code, data: forUpload() }, null, keepalive); sync.at = j.at; sync.dirty = false; sync.err = ''; }
    catch (e) { sync.err = e.message; }
    finally { sync.busy = false; saveSync(); syncStatus(); }
  }
  async function syncPull() {
    if (!sync.code || sync.busy) return;
    sync.busy = true; sync.pulled = Date.now();
    let again = false;
    try {
      const j = await syncApi('GET', null, sync.code);
      if (sync.dirty) { syncMerge(j.data, 'local'); again = true; } // changed here while away: keep this device's choices, then save
      else if (j.at > sync.at) { syncMerge(j.data, 'remote'); sync.at = j.at; again = canon(forUpload()) !== canon(Object.assign({}, j.data, { app: 'alg-trainer', v: 1 })); }
      sync.err = '';
    } catch (e) { sync.err = e.message; }
    finally { sync.busy = false; saveSync(); syncStatus(); }
    if (again) syncPush();
  }
  async function syncOn() {
    sync.busy = true; syncStatus('Making a code...');
    try { const j = await syncApi('POST', { data: forUpload() }); sync.code = j.code; sync.at = j.at; sync.dirty = false; sync.err = ''; }
    catch (e) { sync.err = e.message; }
    finally { sync.busy = false; saveSync(); }
    render();
  }
  async function syncUse(code) {
    const c = String(code || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (c.length !== 8) { syncStatus('A sync code has 8 letters and numbers, like ABCD-EFGH.'); return; }
    sync.busy = true; syncStatus('Loading...');
    try {
      const j = await syncApi('GET', null, c);
      sync.code = c.slice(0, 4) + '-' + c.slice(4); sync.at = j.at; sync.dirty = false; sync.err = '';
      sync.busy = false; saveSync();
      syncMerge(j.data, 'remote'); // practice from this device is kept too, then saved under the code
      await syncPush(); render(); toast('Sync is on. Progress loaded.');
    } catch (e) { sync.busy = false; syncStatus(e.message); }
  }
  const agoText = t => { const s = Math.round((Date.now() - t) / 1000); return s < 45 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : new Date(t).toLocaleDateString(); };
  const syncText = () => (!sync.code ? '' : sync.err ? sync.err : sync.dirty ? 'Saving changes...' : sync.at ? 'Synced ' + agoText(sync.at) + '.' : '');
  function syncStatus(t) { const m = $('#syncMsg'); if (m) m.textContent = t || syncText(); }
  function syncSection() {
    if (!sync.code) return `<section class="group"><h2>Sync</h2>
        <p class="note" style="margin-bottom:10px">Progress saves in this browser by itself. Turn on sync to keep a copy under a short code, then enter the code on your phone or another computer to pick up where you left off. No account needed.</p>
        <div class="row-btns"><button class="btn primary" id="syncOn">Turn on sync</button></div>
        <label class="line" style="display:block;cursor:default;margin-top:14px"><span>Have a code from another device?</span>
          <div class="row-btns" style="margin-top:8px"><input class="txt code" id="syncCode" placeholder="ABCD-EFGH" maxlength="9" autocomplete="off" autocapitalize="characters" spellcheck="false" inputmode="text"><button class="btn" id="syncUse">Use code</button></div></label>
        <p class="note" id="syncMsg" role="status">${esc(sync.err)}</p>
      </section>`;
    return `<section class="group"><h2>Sync</h2>
        <div class="synccode"><span class="note">Your sync code</span><b class="code">${esc(sync.code)}</b><button class="btn" id="syncCopy">Copy</button></div>
        <p class="note" style="margin:10px 0">Enter it on your other devices under Settings &gt; Sync. Anyone with the code can see and change this progress, so keep it to yourself.</p>
        <p class="note" id="syncMsg" role="status">${esc(syncText())}</p>
        <div class="row-btns" style="margin-top:10px"><button class="btn" id="syncNow">Sync now</button><button class="btn" id="syncOff">Stop syncing on this device</button></div>
      </section>`;
  }
  function wireSync() {
    const on = (id, ev, fn) => { const e = $(id); if (e) e.addEventListener(ev, fn); };
    on('#syncOn', 'click', syncOn);
    on('#syncUse', 'click', () => syncUse($('#syncCode').value));
    on('#syncCode', 'keydown', e => { if (e.key === 'Enter') syncUse(e.target.value); });
    on('#syncCopy', 'click', () => { (navigator.clipboard ? navigator.clipboard.writeText(sync.code) : Promise.reject()).then(() => toast('Code copied'), () => toast(sync.code)); });
    on('#syncNow', 'click', async () => { await syncPull(); if (sync.dirty) await syncPush(); });
    on('#syncOff', 'click', () => { if (!confirm('Stop syncing on this device? Your progress stays here and under the code, and you can enter the code again later.')) return; sync.code = null; sync.at = 0; sync.dirty = false; sync.err = ''; saveSync(); render(); });
  }
  document.addEventListener('visibilitychange', () => {
    if (!sync.code) return;
    if (document.visibilityState === 'hidden') { if (sync.dirty) syncPush(true); }
    else if (Date.now() - sync.pulled > 15000) syncPull();
  });
  window.addEventListener('online', () => { if (sync.code) (sync.dirty ? syncPush() : syncPull()); });

  if (settings.seenIntro === undefined && KEYS.some(p => Object.keys(db[p].st).length)) settings.seenIntro = true;
  newRound(); render();
  setTimeout(() => document.body.classList.remove('boot'), 1400); // the entrance plays once, not on every redraw
  KEYS.forEach(warm);
  if (sync.code) syncPull();
  // offline: the service worker keeps the app on the device; a new version shows up on the next open
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    const had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) toast('A new version of Recall is ready.', { action: 'Reload', fn: () => location.reload() }); else if (ui.screen === 'settings') { const m = $('#offlineMsg'); if (m) m.textContent = offlineText(); } });
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { /* private mode or blocked: the site still works online */ }));
  }
})();
