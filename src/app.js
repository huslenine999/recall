(function () {
  const M = Megaminx, S = Square1, D = Diagram, X = Scramble;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable: run without it */ } }
  };

  // ---- sticker colors: each alg set / parity group gets one, used as a marker everywhere ----
  const SET_COLORS = { 'Star': '#FFC93C', 'Square': '#4C8DF0', 'Kite': '#E86AA6', 'Barrel': '#F08A1A', 'Scallop': '#2DB89F', 'Shield': '#A56AD8', 'Mushroom': '#9BD43A', 'Left pawn': '#4FC3F7', 'Right pawn': '#F0617A', 'Fists': '#C79A3B', 'Paired edges': '#3FA7A0', 'Perpendicular edges': '#8E7CF0', 'Parallel edges': '#6FB04A', 'even': '#4C8DF0', 'odd': '#F08A1A', 'CPLL': '#FFC93C', 'EPLL': '#4C8DF0', '3x1 Line': '#A56AD8', '2x2 Block': '#F08A1A', 'R Block': '#4FC3F7', '2x1s touching': '#E86AA6', '2x1s not touching': '#9BD43A', '2x1': '#8E8BB0', 'No blocks': '#2DB89F', 'parity': '#F08A1A', 'no parity': '#4C8DF0' };
  const setColor = g => SET_COLORS[g] || '#8E8BB0';
  const sticker = g => `<span class="sticker" style="--set:${setColor(g)}"></span>`;

  // ---- case lists (same shape for both puzzles); algs come from the sheet or from the user's override ----
  const KEYS = ['mm', 'sq', 'csp']; // data keys: Megaminx PLL, Square-1 EP, Square-1 CSP
  const cases = { mm: [], sq: [], csp: [] }, sheet = { mm: {}, sq: {}, csp: {} }, byId = { mm: {}, sq: {}, csp: {} };
  function verifyAlg(p, a, c) {
    const flip = c.flip;
    try {
      if (p === 'csp') { const st = S.cspState(a, c.key); return { ok: !!st, why: st ? '' : 'This alg does not start from the ' + c.name + ' shape' }; }
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
  const rebuild = p => cases[p].forEach(c => setAlgs(p, c));

  // ---- persistent data: one key per puzzle {sel:{id:0|1}, st:{id:{status,times,att,fails,last}}} ----
  const db = { mm: store.get('at.mm.v1', { sel: {}, st: {} }), sq: store.get('at.sq.v1', { sel: {}, st: {} }), csp: store.get('at.csp.v1', { sel: {}, st: {} }) };
  const save = p => store.set('at.' + p + '.v1', db[p]);
  const settings = Object.assign({ showDiagram: { mm: true, sq: true, csp: true }, preview: false, mmArrows: false, theme: 'system' }, store.get('at.settings.v1', {}));
  const saveSettings = () => store.set('at.settings.v1', settings);
  const applyTheme = () => { const r = document.documentElement; if (settings.theme === 'light' || settings.theme === 'dark') r.setAttribute('data-theme', settings.theme); else r.removeAttribute('data-theme'); };
  if (!settings.showDiagram || typeof settings.showDiagram !== 'object') settings.showDiagram = { mm: true, sq: true, csp: true };
  if (settings.showDiagram.csp === undefined) settings.showDiagram.csp = settings.showDiagram.sq !== false;
  applyTheme();
  let colors = store.get('at.colors', D.MM_DEFAULT_COLORS.slice());
  if (!Array.isArray(colors) || colors.length !== 12) colors = D.MM_DEFAULT_COLORS.slice();

  KEYS.forEach(p => { db[p].alg = db[p].alg || {}; });
  DATA_MM.forEach(c => { sheet.mm[c.id] = [c.alg]; const k = { id: c.id, group: c.set }; cases.mm.push(k); byId.mm[c.id] = k; });
  DATA_SQ.forEach(r => [['nf', r.algsNoFlip, false], ['f', r.algsFlip, true]].forEach(([col, list, flip]) => {
    if (!list.length) return;
    const id = r.u + ' / ' + r.d + (flip ? ' (flip)' : '');
    sheet.sq[id] = list; const k = { id, group: r.parity ? 'parity' : 'no parity', parity: r.parity, flip, note: r.note }; cases.sq.push(k); byId.sq[id] = k;
  }));
  DATA_CSP.forEach(r => { const id = r.name + ' · ' + r.parity; sheet.csp[id] = [r.alg]; const k = { id, name: r.name, n: r.n, key: r.key, parity: r.parity, group: r.section }; cases.csp.push(k); byId.csp[id] = k; });
  KEYS.forEach(rebuild);

  const selected = (p, c) => db[p].sel[c.id] !== 0; // default: selected
  const stat = (p, id) => db[p].st[id] || (db[p].st[id] = { status: 'New', times: [], att: [], fails: 0, last: 0 });
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const avgOf = (t, n) => (t.length >= n ? mean(t.slice(-n)) : null);

  // ---- timer formatting ----
  const fmt = ms => { const cs = Math.floor(ms / 10), m = Math.floor(cs / 6000), s = Math.floor(cs / 100) % 60; return m + ':' + String(s).padStart(2, '0') + '.' + String(cs % 100).padStart(2, '0'); };
  const fmtN = ms => (ms == null ? '–' : fmt(ms));

  // ---- app state ----
  // each puzzle has several alg sets; only the ones with algs behind them are ready (data key = 'mm' or 'sq')
  const SETS = {
    mm: [{ id: 'pll', label: 'PLL', ready: true }, { id: 'oll', label: 'OLL', ready: false }],
    sq: [{ id: 'ep', label: 'EP', ready: true }, { id: 'pbl', label: 'PBL', ready: false }, { id: 'obl', label: 'OBL', ready: false }, { id: 'csp', label: 'CSP', ready: true }]
  };
  const PUZZLE_NAME = { mm: 'Megaminx', sq: 'Square-1' };
  const DK_NAME = { mm: 'Megaminx PLL', sq: 'Square-1 EP', csp: 'Square-1 CSP' };
  const ui = { puzzle: 'mm', screen: 'train', mmSet: 'all', sqParity: 'all', sqCol: 'both', cspSec: 'all', cspPar: 'both', sort: 'name', edit: null, chipScroll: 0 };
  if (location.hash === '#sq') ui.puzzle = 'sq';
  ui.set = Object.assign({ mm: 'pll', sq: 'ep' }, store.get('at.sets.v1', {}));
  ['mm', 'sq'].forEach(q => { if (!SETS[q].some(x => x.id === ui.set[q])) ui.set[q] = SETS[q][0].id; });
  const curSet = () => SETS[ui.puzzle].find(x => x.id === ui.set[ui.puzzle]);
  const ready = () => curSet().ready;
  const dk = () => (ui.puzzle === 'sq' && ui.set.sq === 'csp' ? 'csp' : ui.puzzle); // key of the data behind what is on screen
  const run = { mode: 'random', cur: null, last: null, queue: [], soon: [], phase: 'idle', t0: 0, time: null, scramble: '', revealed: false, lastRec: false };
  // phase: idle (scramble shown, ready) | hold | armed | running | stopped
  const sess = { mm: [], sq: [], csp: [] }; // this visit's solves per puzzle: {id, time|null}
  const isTouch = () => !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);

  // ---- weighting ----
  function weightOf(p, c, ctx) {
    const s = stat(p, c.id), base = { Learning: 3, New: 2, Learned: 1 }[s.status];
    const slow = s.times.length && ctx.overall ? Math.min(3, Math.max(0.5, mean(s.times.slice(-10)) / ctx.overall)) : 1;
    const fails = 1 + 0.5 * s.att.filter(Boolean).length;
    const stale = s.last ? 1 + Math.min(1, (ctx.now - s.last) / ctx.maxAge) : 2;
    return base * slow * fails * stale;
  }
  function nextCase() {
    const p = dk(), pool = cases[p].filter(c => c.ok && selected(p, c));
    if (!pool.length) return null;
    run.soon.forEach(x => x.left--);
    const due = run.soon.findIndex(x => x.left <= 0);
    if (due >= 0) { const id = run.soon.splice(due, 1)[0].id; const c = pool.find(c => c.id === id); if (c) return c; }
    if (run.mode === 'recap') {
      if (!run.queue.length) { run.queue = pool.map(c => c.id).sort(() => Math.random() - 0.5); run.total = run.queue.length; }
      return pool.find(c => c.id === run.queue.shift()) || null;
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
    const good = c.algs.filter(x => x.ok), alg = good[Math.floor(Math.random() * good.length)].a;
    run.scramble = ui.puzzle === 'mm' ? X.mmSetup(alg) : dk() === 'csp' ? X.cspSetup(alg, c.key) : X.sqSetup(alg);
  }

  // ---- icons ----
  const statusGlyph = s => `<svg class="sg" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="${s === 'Learned' ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8"/>${s === 'Learning' ? '<path d="M8 1.8a6.2 6.2 0 0 1 0 12.4z" fill="currentColor"/>' : ''}${s === 'Learned' ? '<path d="M5 8.2l2.2 2.2L11 6" fill="none" style="stroke:var(--panel)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' : ''}</svg>`;
  const closeIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>';

  // ---- views ----
  function render() {
    stopRaf();
    $('#tab-mm').setAttribute('aria-selected', ui.puzzle === 'mm');
    $('#tab-sq').setAttribute('aria-selected', ui.puzzle === 'sq');
    $('#sets').innerHTML = SETS[ui.puzzle].map(x => `<button class="set" role="tab" data-set="${x.id}" aria-selected="${ui.set[ui.puzzle] === x.id}">${x.label}${x.ready ? '' : '<i>soon</i>'}</button>`).join('');
    $$('.sub').forEach(b => b.setAttribute('aria-selected', b.dataset.s === ui.screen));
    const main = $('#main'), key = ui.puzzle + ui.set[ui.puzzle] + ui.screen, y = window.scrollY;
    const soon = !ready() && ui.screen !== 'settings';
    main.innerHTML = soon ? viewSoon() : ui.screen === 'train' ? viewTrain() : ui.screen === 'cases' ? viewCases() : viewSettings();
    if (soon) { /* nothing to wire */ } else if (ui.screen === 'train') wireTrain(); else if (ui.screen === 'cases') wireCases(); else wireSettings();
    document.body.classList.toggle('lock', ui.screen === 'cases' && !!ui.edit);
    if (main.dataset.key === key) window.scrollTo(0, y); else window.scrollTo(0, 0);
    main.dataset.key = key;
    setTopH();
    if (!soon) updateTimer();
  }

  // diagrams are cached: the Cases screen draws every case
  const dcache = new Map();
  function diagSvg(p, c) {
    const good = c.algs.find(x => x.ok); if (!good) return '';
    const key = p + '|' + c.id + '|' + good.a + (p === 'mm' ? '|' + colors.join('') + '|' + settings.mmArrows : '');
    if (!dcache.has(key)) dcache.set(key, (p === 'mm' ? D.megaminxDiagram(good.a, colors, { label: c.id, arrows: settings.mmArrows }) : p === 'csp' ? D.cspDiagram(good.a, c.key, { label: c.id }) : D.square1Diagram(good.a, null, { label: c.id })) || '');
    return dcache.get(key);
  }
  const matFor = (p, c) => { const s = diagSvg(p, c); return s ? `<div class="mat">${s}</div>` : ''; };
  const diagramFor = (p, c) => (settings.showDiagram[p] ? matFor(p, c) : '');

  const scrambleHtml = t => esc(t).replace(/\//g, '<span class="sl">/</span>');

  function sessionHtml(p) {
    const ss = sess[p], times = ss.filter(x => x.time != null).map(x => x.time);
    if (!ss.length) return `<section class="panel session"><h2>This session</h2><p class="note">Your solves from this visit are listed here with their case.</p></section>`;
    const rows = ss.slice(-8).reverse().map(x => `<li class="${x.time == null ? 'miss' : ''}">${sticker((byId[p][x.id] || {}).group)}<span class="nm">${esc(x.id)}</span><span class="tm">${x.time == null ? 'Forgot' : fmt(x.time)}</span></li>`).join('');
    return `<section class="panel session"><h2>This session</h2>
      <dl class="stats"><div><dd>${times.length}</dd><dt>Solved</dt></div><div><dd>${ss.length - times.length}</dd><dt>Forgot</dt></div><div><dd>${fmtN(times.length ? mean(times) : null)}</dd><dt>Mean</dt></div></dl>
      <ul class="solves">${rows}</ul></section>`;
  }

  function viewSoon() {
    const lab = curSet().label;
    return `<div class="empty"><h2>No ${PUZZLE_NAME[ui.puzzle]} ${lab} algs yet</h2><p class="muted">Its cases will show up in Train and Cases once the algorithms are added.</p></div>`;
  }

  function viewTrain() {
    const p = dk(), c = run.cur;
    if (!c) return `<div class="empty"><h2>No cases selected</h2><p class="muted">Choose the cases you want to drill, then come back to train.</p><button class="btn primary" id="toCases">Choose cases</button></div>`;
    const nSel = cases[p].filter(x => x.ok && selected(p, x)).length;
    const prog = run.mode === 'recap' ? `${run.total - run.queue.length} of ${run.total}` : `${nSel} ${nSel === 1 ? 'case' : 'cases'}`;
    const s = stat(p, c.id), shown = run.revealed;
    const pre = settings.preview && !shown ? `<section class="panel"><div class="pv-hd"><h2>Case preview</h2></div><div style="margin-top:14px">${matFor(p, c)}</div></section>` : '';
    const reveal = shown ? `<section class="panel reveal" aria-label="Case answer">
        <div class="reveal-h"><h2>${esc(c.id)}</h2><span class="gtag">${sticker(c.group)}${esc(c.group)}</span></div>
        ${diagramFor(p, c)}
        <div class="algs">${c.algs.map(x => `<div class="alg ${x.ok ? '' : 'bad'}">${esc(x.a)}</div>`).join('')}</div>
        ${c.note ? `<p class="note">${esc(c.note)}</p>` : ''}
        <dl class="stats"><div><dd>${fmtN(s.times.length ? Math.min(...s.times) : null)}</dd><dt>Best</dt></div><div><dd>${fmtN(avgOf(s.times, 5))}</dd><dt>Average of 5</dt></div><div><dd>${s.fails}</dd><dt>Forgot</dt></div></dl>
      </section>` : '';
    const forgotLabel = run.phase === 'idle' || run.phase === 'hold' || run.phase === 'armed' ? 'Show answer' : 'Forgot';
    const actions = `<div class="actions">
        <button class="btn primary" id="next" ${shown ? '' : 'disabled'}>Next <kbd>Space</kbd></button>
        <button class="btn" id="forgot" title="Counts as forgotten">${forgotLabel} <kbd>F</kbd></button>
        <button class="btn" id="soon" ${shown ? '' : 'disabled'}>Again soon</button>
        <button class="btn" id="undo" ${s.times.length && run.lastRec ? '' : 'disabled'}>Delete last <kbd>⌫</kbd></button>
      </div>`;
    return `<div class="train ${shown ? 'revealed' : ''}">
      <div class="stage">
        <div class="stage-bar">
          <select id="mode" aria-label="Mode"><option value="random" ${run.mode === 'random' ? 'selected' : ''}>Weighted random</option><option value="recap" ${run.mode === 'recap' ? 'selected' : ''}>Recap, each case once</option></select>
          <span class="note">${prog}</span>
        </div>
        <div class="scramble" id="scr" role="button" tabindex="0" title="Copy the scramble">${scrambleHtml(run.scramble)}</div>
        <div id="timer" class="pad" role="timer" aria-live="off"><span id="digits" class="digits">0:00.00</span><span id="hint" class="hint"></span></div>
        ${actions}
      </div>
      <div class="rail">${pre}${reveal}${sessionHtml(p)}</div>
    </div>`;
  }

  function wireTrain() {
    const on = (id, ev, fn) => { const e = $(id); if (e) e.addEventListener(ev, fn); };
    on('#toCases', 'click', () => go(ui.puzzle, 'cases'));
    on('#mode', 'change', e => { run.mode = e.target.value; run.queue = []; newRound(); render(); });
    on('#next', 'click', doNext); on('#forgot', 'click', doForgot); on('#undo', 'click', doUndo);
    on('#soon', 'click', () => { run.soon.push({ id: run.cur.id, left: 3 + Math.floor(Math.random() * 3) }); toast('Queued: this case returns within 3 to 5 solves'); });
    const copy = () => { if (!navigator.clipboard) { toast('Copying is not available in this browser'); return; } navigator.clipboard.writeText(run.scramble).then(() => toast('Scramble copied'), () => toast('Copying is not available in this browser')); };
    on('#scr', 'click', copy);
    on('#scr', 'keydown', e => { if (e.key === 'Enter') { e.preventDefault(); copy(); } });
    const t = $('#timer'); if (t) { t.addEventListener('pointerdown', e => { e.preventDefault(); press(); }); t.addEventListener('pointerup', e => { e.preventDefault(); release(); }); t.addEventListener('pointercancel', release); }
  }
  let toastT = 0;
  function toast(msg) { const n = $('#toast'); if (!n) return; n.textContent = msg; n.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => n.classList.remove('show'), 1800); }

  // ---- timer state machine ----
  let holdT = 0, raf = 0;
  const stopRaf = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
  function hintText() {
    const touch = isTouch();
    if (run.phase === 'hold') return 'Keep holding';
    if (run.phase === 'armed') return 'Let go to start';
    if (run.phase === 'running') return touch ? 'Tap to stop' : 'Press any key to stop';
    if (run.phase === 'stopped' || run.revealed) return touch ? 'Tap Next for the next case' : 'Press Space for the next case';
    return touch ? 'Hold the timer until it turns green' : 'Hold Space until it turns green';
  }
  function updateTimer() {
    document.body.dataset.phase = run.phase;
    const t = $('#timer'); if (!t) return;
    t.className = 'pad ' + run.phase;
    const d = $('#digits'), h = $('#hint'); if (h) h.textContent = hintText();
    if (run.phase === 'running') { d.textContent = fmt(performance.now() - run.t0); stopRaf(); raf = requestAnimationFrame(updateTimer); }
    else if (run.phase === 'stopped') d.textContent = run.time == null ? '—' : fmt(run.time);
    else if (run.phase === 'idle' && run.revealed) d.textContent = '—';
    else if (run.phase === 'idle') d.textContent = '0:00.00';
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
  function stopTimer() {
    run.time = performance.now() - run.t0; run.phase = 'stopped'; run.revealed = true;
    const s = stat(dk(), run.cur.id); s.times.push(run.time); if (s.times.length > 50) s.times.shift();
    s.att.push(0); if (s.att.length > 10) s.att.shift(); s.last = Date.now(); if (s.status === 'New') s.status = 'Learning';
    sess[dk()].push({ id: run.cur.id, time: run.time });
    run.lastRec = true; save(dk()); render();
  }
  function doNext() { if (!run.revealed) return; newRound(); render(); }
  function doForgot() {
    if (!run.cur || run.phase === 'running') return;
    if (run.revealed && !run.lastRec) return; // already marked as forgotten
    const p = dk(), s = stat(p, run.cur.id);
    if (run.lastRec && run.phase === 'stopped') { s.times.pop(); s.att.pop(); sess[p].pop(); }  // replace the timed attempt with a fail
    s.att.push(1); if (s.att.length > 10) s.att.shift(); s.fails++; s.last = Date.now(); if (s.status === 'New') s.status = 'Learning';
    sess[p].push({ id: run.cur.id, time: null });
    clearTimeout(holdT); run.phase = 'stopped'; run.time = null; run.revealed = true; run.lastRec = false; save(p); render();
  }
  function doUndo() {
    if (!run.lastRec) return;
    const p = dk(), s = stat(p, run.cur.id); s.times.pop(); s.att.pop(); sess[p].pop(); run.lastRec = false; run.time = null; save(p); render();
  }
  let wl = null;
  async function wakeLock() { try { if (navigator.wakeLock && !wl) { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); } } catch (e) { /* not supported or denied */ } }

  // keyboard (train screen only; Escape closes the alg editor)
  let spaceDown = false, ignoreUp = false;
  document.addEventListener('click', e => { $$('details.menu[open]').forEach(d => { if (!d.contains(e.target)) d.open = false; }); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') $$('details.menu[open]').forEach(d => { d.open = false; });
    if (e.key === 'Escape' && ui.edit) { ui.edit = null; render(); return; }
    if (ui.screen !== 'train' || !ready()) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
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
  document.addEventListener('pointerdown', e => { if (run.phase === 'running') { e.preventDefault(); stopTimer(); } }, true);
  window.addEventListener('blur', () => { if (run.phase === 'hold' || run.phase === 'armed') { clearTimeout(holdT); run.phase = 'idle'; updateTimer(); } });

  // ---- Cases screen ----
  const chip = (key, val, on, label, n, group) => `<button class="fchip" data-f="${key}::${esc(val)}" aria-pressed="${on}">${group ? sticker(group) : ''}${esc(label)}${n != null ? ` <span class="n">${n}</span>` : ''}</button>`;
  function tileHtml(p, c) {
    const s = stat(p, c.id), t = s.times, on = selected(p, c) && c.ok;
    const algs = c.algs.map(x => `<div class="alg ${x.ok ? '' : 'bad'}">${x.ok ? '' : '<span class="tag-check">check</span>'}${esc(x.a)}</div>`).join('');
    const stats = t.length ? `<span><b>${fmt(mean(t))}</b>mean</span><span><b>${fmt(Math.min(...t))}</b>best</span>${s.fails ? `<span><b>${s.fails}</b>forgot</span>` : ''}` : `<span>No times yet</span>${s.fails ? `<span><b>${s.fails}</b>forgot</span>` : ''}`;
    return `<article class="tile ${on ? 'is-on' : ''} ${c.ok ? '' : 'is-bad'}" style="--set:${setColor(c.group)}">
      <input type="checkbox" class="pick" data-sel="${esc(c.id)}" ${on ? 'checked' : ''} ${c.ok ? '' : 'disabled'} aria-label="Train ${esc(c.id)}">
      <div class="tile-h">
        <span class="tick" aria-hidden="true"></span>
        <h3>${esc(c.id)}</h3>
        <button type="button" class="status s-${s.status}" data-chip="${esc(c.id)}" title="Change status" aria-label="${esc(c.id)} status: ${s.status}. Change status">${statusGlyph(s.status)}<span>${s.status}</span></button>
      </div>
      ${c.ok ? matFor(p, c) : `<div class="warn">${esc(c.why || 'No alg on this case passes the check.')}</div>`}
      <div class="algs">${algs}</div>
      ${c.note ? `<p class="note">${esc(c.note)}</p>` : ''}
      <div class="tile-f"><div class="st">${stats}</div><button type="button" class="btn quiet" data-edit="${esc(c.id)}">Edit</button></div>
    </article>`;
  }
  const countText = p => `${cases[p].filter(c => c.ok && selected(p, c)).length} of ${cases[p].length} selected for training`;
  function viewCases() {
    const p = dk();
    let list = cases[p];
    if (p === 'mm') list = list.filter(c => ui.mmSet === 'all' || c.group === ui.mmSet);
    else if (p === 'csp') list = list.filter(c => (ui.cspSec === 'all' || c.group === ui.cspSec) && (ui.cspPar === 'both' || c.parity === ui.cspPar));
    else list = list.filter(c => (ui.sqParity === 'all' || (ui.sqParity === 'yes') === c.parity) && (ui.sqCol === 'both' || (ui.sqCol === 'flip') === c.flip));
    const val = c => { const t = stat(p, c.id).times; return t.length ? mean(t) : -1; };
    if (ui.sort === 'mean') list = list.slice().sort((a, b) => val(b) - val(a));
    else if (ui.sort === 'fails') list = list.slice().sort((a, b) => stat(p, b.id).fails - stat(p, a.id).fails);
    ui.shown = list;
    const chips = p === 'mm'
      ? `<div class="chips" role="group" aria-label="Alg set">${chip('mmSet', 'all', ui.mmSet === 'all', 'All', cases.mm.length)}${[...new Set(cases.mm.map(c => c.group))].map(s => chip('mmSet', s, ui.mmSet === s, s, cases.mm.filter(c => c.group === s).length, s)).join('')}</div>`
      : p === 'csp'
      ? `<div class="chips" role="group" aria-label="Shape group and parity">${chip('cspSec', 'all', ui.cspSec === 'all', 'All', cases.csp.length)}${[...new Set(cases.csp.map(c => c.group))].map(s => chip('cspSec', s, ui.cspSec === s, s, cases.csp.filter(c => c.group === s).length, s)).join('')}<span class="div" aria-hidden="true"></span>${[['both', 'Even and odd'], ['even', 'Even'], ['odd', 'Odd']].map(([v, l]) => chip('cspPar', v, ui.cspPar === v, l, null, v === 'both' ? null : v)).join('')}</div>`
      : `<div class="chips" role="group" aria-label="Parity and flip">${[['all', 'All'], ['yes', 'Parity'], ['no', 'No parity']].map(([v, l]) => chip('sqParity', v, ui.sqParity === v, l, null, v === 'yes' ? 'parity' : v === 'no' ? 'no parity' : null)).join('')}<span class="div" aria-hidden="true"></span>${[['both', 'Both algs'], ['noflip', 'Without flip'], ['flip', 'With flip']].map(([v, l]) => chip('sqCol', v, ui.sqCol === v, l)).join('')}</div>`;
    const tiles = list.length ? `<div class="tiles ${p}">${list.map(c => tileHtml(p, c)).join('')}</div>` : `<p class="none muted">No cases match these filters.</p>`;
    return `<div class="cases-top">${chips}
      <div class="tools"><span class="count">${countText(p)}</span>
        <details class="menu"><summary class="btn">Select cases <svg viewBox="0 0 12 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 1.5l5 5 5-5"/></svg></summary>
          <div class="menu-pop"><button id="selAll">Select all shown</button><button id="selNone">Deselect all shown</button><button id="selLearning">Only the ones I am learning</button><button id="selNotLearned">Only the ones not learned yet</button></div></details>
        <select id="sort" aria-label="Sort">${[['name', 'Sheet order'], ['mean', 'Slowest first'], ['fails', 'Most forgotten']].map(([v, l]) => `<option value="${v}" ${v === ui.sort ? 'selected' : ''}>${l}</option>`).join('')}</select>
      </div></div>${tiles}${ui.edit && byId[p][ui.edit] ? editorHtml(p, byId[p][ui.edit]) : ''}`;
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
      if (p === 'csp') {
        const inv = S.invert(a), c = byId.csp[ui.edit], st = S.cspState(a, c && c.key);
        if (!st) return { inv, st: `<div class="bad">This alg does not start from the ${esc(c ? c.name : '')} shape.</div>`, svg: null };
        return { inv, st: `<div>Starts from the <b>${esc(c.name)}</b> shape, middle layer <b>${st.flip ? 'flipped' : 'square'}</b>.</div>`, svg: D.cspDiagram(a, c.key) };
      }
      const inv = S.invert(a), t = S.run(a), an = S.analyze(t);
      if (!an.ok) return { inv, st: `<div class="bad">Not an EP alg: ${esc(an.reason)}</div>`, svg: null };
      const u = SHEET_U[S.classOf(an.topPerm)], d = SHEET_D[S.classOf(an.botPerm)];
      return { inv, st: `<div>Row <b>${u} / ${d}</b>, middle layer <b>${t.flip ? 'flipped' : 'square'}</b>, parity ${S.parity(an.topPerm) || S.parity(an.botPerm) ? 'yes' : 'no'}</div>`, svg: D.square1Diagram(a, null) };
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
  function wireCases() {
    const on = (id, ev, fn) => { const e = $(id); if (e) e.addEventListener(ev, fn); };
    const p = dk();
    const chips = $('.chips'); if (chips) chips.scrollLeft = ui.chipScroll || 0;
    $$('[data-f]').forEach(b => b.addEventListener('click', () => { const [k, v] = b.dataset.f.split('::'); ui.chipScroll = (b.closest('.chips') || {}).scrollLeft || 0; ui[k] = v; render(); }));
    $$('[data-edit]').forEach(b => b.addEventListener('click', () => { ui.edit = b.dataset.edit; render(); const t = $('#edtxt'); if (t) t.focus(); }));
    const edit = ui.edit && byId[p][ui.edit];
    if (edit) {
      on('#edtxt', 'input', e => { $('#edprev').innerHTML = previewHtml(p, e.target.value); });
      const done = () => { ui.edit = null; run.queue = []; run.cur = null; render(); };
      const close = () => { ui.edit = null; render(); };
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
    const setSel = fn => { ui.shown.forEach(c => { if (c.ok) db[p].sel[c.id] = fn(c) ? 1 : 0; }); save(p); run.queue = []; run.cur = null; render(); };
    on('#selAll', 'click', () => setSel(() => true));
    on('#selNone', 'click', () => setSel(() => false));
    on('#selLearning', 'click', () => setSel(c => stat(p, c.id).status === 'Learning'));
    on('#selNotLearned', 'click', () => setSel(c => stat(p, c.id).status !== 'Learned'));
    // the whole card is the button: a click anywhere on it (except its own buttons) toggles the case
    const grid = $('.tiles');
    if (grid) grid.addEventListener('click', e => {
      if (e.target.closest('button, a, input, select, textarea')) return;
      const tile = e.target.closest('.tile'), box = tile && tile.querySelector('input[data-sel]');
      if (box && !box.disabled) box.click();
    });
    $$('input[data-sel]').forEach(i => i.addEventListener('change', e => {
      const box = e.target;
      db[p].sel[box.dataset.sel] = box.checked ? 1 : 0; run.queue = []; run.cur = null; save(p);
      box.closest('.tile').classList.toggle('is-on', box.checked);
      const cn = $('.count'); if (cn) cn.textContent = countText(p);
    }));
    $$('[data-chip]').forEach(b => b.addEventListener('click', () => { const s = stat(p, b.dataset.chip); s.status = { New: 'Learning', Learning: 'Learned', Learned: 'New' }[s.status]; save(p); render(); }));
  }

  // ---- Settings screen ----
  function viewSettings() {
    const p = dk(), name = DK_NAME[p];
    const swatch = M.FACES.map((f, i) => `<label>${f}<input type="color" data-col="${i}" value="${colors[i]}"></label>`).join('');
    return `<div class="settings">
      <section class="group"><h2>Training</h2>
        <label class="line"><span>Show the case diagram after each solve<small>${name} only. Cases always show their diagram.</small></span><input type="checkbox" class="switch" id="showDiag" ${settings.showDiagram[p] ? 'checked' : ''}></label>
        ${p === 'mm' ? `<label class="line"><span>Show arrows on Megaminx cases<small>Arrows mark where each piece goes. Off by default: the sticker colours already show the case.</small></span><input type="checkbox" class="switch" id="mmArrows" ${settings.mmArrows ? 'checked' : ''}></label>` : ''}
        <label class="line"><span>Show the diagram before the solve<small>Study mode. Needs diagrams on.</small></span><input type="checkbox" class="switch" id="preview" ${settings.preview ? 'checked' : ''}></label>
      </section>
      <section class="group"><h2>Appearance</h2>
        <div class="line"><span>Theme</span><div class="seg" role="group" aria-label="Theme">${[['system', 'System'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => `<button data-theme="${v}" aria-pressed="${settings.theme === v}">${l}</button>`).join('')}</div></div>
        ${p === 'mm' ? `<div class="line" style="display:block;cursor:default"><span>Megaminx face colors<small>Used by the case diagrams. Match them to your puzzle.</small></span><div class="swatches">${swatch}</div><button class="btn" id="resetCol">Reset colors</button></div>` : ''}
      </section>
      <section class="group"><h2>Progress</h2>
        <p class="note" style="margin-bottom:10px">Progress is stored in this browser only. Export it to move it to another device.</p>
        <div class="row-btns"><button class="btn" id="export">Export</button><label class="btn">Import<input type="file" id="import" accept="application/json" hidden></label><button class="btn danger" id="reset">Reset ${name} stats</button></div>
        <p class="note" id="msg" role="status"></p>
      </section>
    </div>`;
  }
  function wireSettings() {
    const on = (id, ev, fn) => { const e = $(id); if (e) e.addEventListener(ev, fn); };
    const p = dk(), msg = t => { $('#msg').textContent = t; };
    on('#showDiag', 'change', e => { settings.showDiagram[p] = e.target.checked; saveSettings(); });
    on('#mmArrows', 'change', e => { settings.mmArrows = e.target.checked; saveSettings(); });
    on('#preview', 'change', e => { settings.preview = e.target.checked; saveSettings(); });
    $$('[data-theme]').forEach(b => b.addEventListener('click', () => { settings.theme = b.dataset.theme; saveSettings(); applyTheme(); render(); }));
    on('#resetCol', 'click', () => { colors = D.MM_DEFAULT_COLORS.slice(); store.set('at.colors', colors); render(); });
    $$('input[data-col]').forEach(i => i.addEventListener('change', e => { colors[+e.target.dataset.col] = e.target.value; store.set('at.colors', colors); }));
    on('#export', 'click', () => {
      const blob = new Blob([JSON.stringify({ app: 'alg-trainer', v: 1, mm: db.mm, sq: db.sq, csp: db.csp, settings, colors }, null, 1)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'alg-trainer-progress.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    on('#import', 'change', e => {
      const f = e.target.files[0]; if (!f) return;
      f.text().then(t => {
        const o = JSON.parse(t);
        if (o.app !== 'alg-trainer' || !o.mm || !o.sq) throw new Error('not an alg-trainer export');
        db.mm = o.mm; db.sq = o.sq; if (o.csp) db.csp = o.csp; KEYS.forEach(q => { db[q].alg = db[q].alg || {}; save(q); rebuild(q); });
        if (o.settings) { Object.assign(settings, o.settings); saveSettings(); applyTheme(); }
        if (Array.isArray(o.colors) && o.colors.length === 12) { colors = o.colors; store.set('at.colors', colors); }
        run.cur = null; msg('Imported.');
      }).catch(err => msg('Import failed: ' + err.message));
    });
    on('#reset', 'click', () => { if (confirm('Delete all stats and selections for this puzzle?')) { db[p] = { sel: {}, st: {}, alg: db[p].alg }; save(p); run.cur = null; msg('Reset.'); } });
  }

  // ---- navigation ----
  const go = (puzzle, screen) => { clearTimeout(holdT); ui.edit = null; if (puzzle !== ui.puzzle) { run.cur = null; run.queue = []; run.soon = []; run.last = null; } ui.puzzle = puzzle; ui.screen = screen; if (screen === 'train' && ready() && !run.cur) newRound(); render(); };
  $('#sets').addEventListener('click', e => {
    const b = e.target.closest('[data-set]'); if (!b || b.dataset.set === ui.set[ui.puzzle]) return;
    clearTimeout(holdT); ui.edit = null; ui.set[ui.puzzle] = b.dataset.set; store.set('at.sets.v1', ui.set);
    run.cur = null; run.queue = []; run.soon = []; run.last = null;
    if (ui.screen === 'train' && ready()) newRound();
    render();
  });
  $('#tab-mm').addEventListener('click', () => go('mm', ui.screen));
  $('#tab-sq').addEventListener('click', () => go('sq', ui.screen));
  $$('.sub').forEach(b => b.addEventListener('click', () => go(ui.puzzle, b.dataset.s)));
  const setTopH = () => document.documentElement.style.setProperty('--top-h', $('.top').offsetHeight + 'px');
  window.addEventListener('resize', setTopH); setTopH();
  newRound(); render();
})();
