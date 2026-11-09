(function () {
  const M = Megaminx, S = Square1, D = Diagram, X = Scramble;
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable: run without it */ } }
  };

  // ---- case lists (same shape for both puzzles); algs come from the sheet or from the user's override ----
  const cases = { mm: [], sq: [] }, sheet = { mm: {}, sq: {} };
  function verifyAlg(p, a, flip) {
    try {
      if (p === 'mm') { const r = M.analyze(M.run(M.invert(a), D.MM_CFG)); return { ok: r.ok, why: r.reason || '' }; }
      const st = S.run(a), an = S.analyze(st);
      return { ok: an.ok && st.flip === flip, why: !an.ok ? an.reason : st.flip !== flip ? 'middle layer ends ' + (st.flip ? 'flipped' : 'square') + ' but this case is ' + (flip ? 'flipped' : 'square') : '' };
    } catch (e) { return { ok: false, why: e.message }; }
  }
  function setAlgs(p, c) {
    const list = (db[p].alg && db[p].alg[c.id]) || sheet[p][c.id];
    c.algs = list.map(a => Object.assign({ a }, verifyAlg(p, a, c.flip)));
    c.ok = c.algs.some(x => x.ok);
    c.why = c.ok ? '' : (c.algs[0] && c.algs[0].why) || 'no verified alg';
  }
  const rebuild = p => cases[p].forEach(c => setAlgs(p, c));

  // ---- persistent data: one key per puzzle {sel:{id:0|1}, st:{id:{status,times,att,fails,last}}} ----
  const db = { mm: store.get('at.mm.v1', { sel: {}, st: {} }), sq: store.get('at.sq.v1', { sel: {}, st: {} }) };
  const save = p => store.set('at.' + p + '.v1', db[p]);
  const settings = Object.assign({ showDiagram: { mm: false, sq: false }, preview: false }, store.get('at.settings.v1', {}));
  const saveSettings = () => store.set('at.settings.v1', settings);
  let colors = store.get('at.colors', D.MM_DEFAULT_COLORS.slice());
  if (!Array.isArray(colors) || colors.length !== 12) colors = D.MM_DEFAULT_COLORS.slice();

  ['mm', 'sq'].forEach(p => { db[p].alg = db[p].alg || {}; });
  DATA_MM.forEach(c => { sheet.mm[c.id] = [c.alg]; cases.mm.push({ id: c.id, group: c.set }); });
  DATA_SQ.forEach(r => [['nf', r.algsNoFlip, false], ['f', r.algsFlip, true]].forEach(([col, list, flip]) => {
    if (!list.length) return;
    const id = r.u + ' / ' + r.d + (flip ? ' (flip)' : '');
    sheet.sq[id] = list; cases.sq.push({ id, group: r.parity ? 'parity' : 'no parity', parity: r.parity, flip, note: r.note });
  }));
  rebuild('mm'); rebuild('sq');

  const selected = (p, c) => db[p].sel[c.id] !== 0; // default: selected
  const stat = (p, id) => db[p].st[id] || (db[p].st[id] = { status: 'New', times: [], att: [], fails: 0, last: 0 });
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const avgOf = (t, n) => (t.length >= n ? mean(t.slice(-n)) : null);

  // ---- timer formatting ----
  const fmt = ms => { const cs = Math.floor(ms / 10), m = Math.floor(cs / 6000), s = Math.floor(cs / 100) % 60; return m + ':' + String(s).padStart(2, '0') + '.' + String(cs % 100).padStart(2, '0'); };
  const fmtN = ms => (ms == null ? '–' : fmt(ms));

  // ---- app state ----
  const ui = { puzzle: 'mm', screen: 'train', mmSet: 'all', sqParity: 'all', sqCol: 'both', sort: 'name' };
  if (location.hash === '#sq') ui.puzzle = 'sq';
  const run = { mode: 'random', cur: null, last: null, queue: [], soon: [], phase: 'idle', t0: 0, time: null, scramble: '', revealed: false, lastRec: false };
  // phase: idle (scramble shown, ready) | hold | armed | running | stopped

  // ---- weighting ----
  function weightOf(p, c, ctx) {
    const s = stat(p, c.id), base = { Learning: 3, New: 2, Learned: 1 }[s.status];
    const slow = s.times.length && ctx.overall ? Math.min(3, Math.max(0.5, mean(s.times.slice(-10)) / ctx.overall)) : 1;
    const fails = 1 + 0.5 * s.att.filter(Boolean).length;
    const stale = s.last ? 1 + Math.min(1, (ctx.now - s.last) / ctx.maxAge) : 2;
    return base * slow * fails * stale;
  }
  function nextCase() {
    const p = ui.puzzle, pool = cases[p].filter(c => c.ok && selected(p, c));
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
    const c = nextCase(); run.cur = c; run.phase = 'idle'; run.revealed = false; run.time = null; run.lastRec = false;
    if (!c) { run.scramble = ''; return; }
    run.last = c.id;
    const good = c.algs.filter(x => x.ok), alg = good[Math.floor(Math.random() * good.length)].a;
    run.scramble = ui.puzzle === 'mm' ? X.mmSetup(alg) : X.sqSetup(alg);
  }

  // ---- views ----
  function render() {
    stopRaf();
    $('#tab-mm').setAttribute('aria-selected', ui.puzzle === 'mm');
    $('#tab-sq').setAttribute('aria-selected', ui.puzzle === 'sq');
    document.querySelectorAll('.sub').forEach(b => b.setAttribute('aria-selected', b.dataset.s === ui.screen));
    const main = $('#main');
    main.innerHTML = ui.screen === 'train' ? viewTrain() : ui.screen === 'cases' ? viewCases() : viewSettings();
    if (ui.screen === 'train') wireTrain(); else if (ui.screen === 'cases') wireCases(); else wireSettings();
    updateTimer();
  }

  function diagramFor(p, c) {
    if (!settings.showDiagram[p]) return '';
    const good = c.algs.find(x => x.ok); if (!good) return '';
    return (p === 'mm' ? D.megaminxDiagram(good.a, colors, { label: c.id }) : D.square1Diagram(good.a, null, { label: c.id })) || '';
  }

  function viewTrain() {
    const p = ui.puzzle, c = run.cur;
    const nSel = cases[p].filter(x => x.ok && selected(p, x)).length;
    if (!c) return `<p class="empty">No cases selected. Open <b>Cases</b> and tick some.</p>`;
    const prog = run.mode === 'recap' ? `${run.total - run.queue.length} / ${run.total}` : `${nSel} cases`;
    const pre = settings.preview && !run.revealed ? `<div class="diagwrap">${diagramFor(p, c)}</div>` : '';
    const s = stat(p, c.id), shown = run.revealed;
    const reveal = shown ? `<div class="reveal">
        <h2>${esc(c.id)} <span class="tag">${esc(c.group)}</span></h2>
        ${diagramFor(p, c) ? `<div class="diagwrap">${diagramFor(p, c)}</div>` : ''}
        ${c.algs.map(x => `<div class="alg ${x.ok ? '' : 'bad'}">${esc(x.a)}</div>`).join('')}
        ${c.note ? `<div class="note">${esc(c.note)}</div>` : ''}
        <div class="note">best ${fmtN(s.times.length ? Math.min(...s.times) : null)} · ao5 ${fmtN(avgOf(s.times, 5))} · fails ${s.fails}</div>
      </div>` : '';
    const btns = `<div class="actions">
        <button class="btn primary" id="next" ${shown ? '' : 'disabled'}>Next <kbd>Space</kbd></button>
        <button class="btn" id="forgot">${run.phase === 'idle' || run.phase === 'hold' || run.phase === 'armed' ? 'Show answer (fail)' : 'Forgot'} <kbd>F</kbd></button>
        <button class="btn" id="soon" ${shown ? '' : 'disabled'}>Again soon</button>
        <button class="btn" id="undo" ${s.times.length && run.lastRec ? '' : 'disabled'}>Delete last <kbd>⌫</kbd></button>
      </div>`;
    return `<div class="train">
      <div class="left">
        <div class="bar small"><label>Mode <select id="mode"><option value="random" ${run.mode === 'random' ? 'selected' : ''}>Random (weighted)</option><option value="recap" ${run.mode === 'recap' ? 'selected' : ''}>Recap (each once)</option></select></label><span class="note">${prog}</span></div>
        <div class="scramble" id="scr" title="Tap to copy">${esc(run.scramble)}</div>
        <div class="note hint" id="copied">tap scramble to copy · hold <b>Space</b> / the box 0.3 s, release to start, any key / tap to stop</div>
        <div id="timer" class="timer" role="timer" aria-live="off">0:00.00</div>
      </div>
      <div class="right">${pre}${reveal || '<p class="empty">Solve it, then the case and alg appear here.</p>'}${btns}</div>
    </div>`;
  }

  function wireTrain() {
    const on = (id, ev, fn) => { const e = $(id); if (e) e.addEventListener(ev, fn); };
    on('#mode', 'change', e => { run.mode = e.target.value; run.queue = []; newRound(); render(); });
    on('#next', 'click', doNext); on('#forgot', 'click', doForgot); on('#undo', 'click', doUndo);
    on('#soon', 'click', () => { run.soon.push({ id: run.cur.id, left: 3 + Math.floor(Math.random() * 3) }); toast('queued: again in 3–5'); });
    on('#scr', 'click', () => { try { navigator.clipboard.writeText(run.scramble); $('#copied').textContent = 'copied'; } catch (e) { $('#copied').textContent = 'copy not available'; } });
    const t = $('#timer'); if (t) { t.addEventListener('pointerdown', e => { e.preventDefault(); press(); }); t.addEventListener('pointerup', e => { e.preventDefault(); release(); }); t.addEventListener('pointercancel', release); }
  }
  function toast(msg) { const n = $('#copied'); if (n) n.textContent = msg; }

  // ---- timer state machine ----
  let holdT = 0, raf = 0;
  const stopRaf = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
  function updateTimer() {
    const t = $('#timer'); if (!t) return;
    t.className = 'timer ' + run.phase;
    if (run.phase === 'running') { t.textContent = fmt(performance.now() - run.t0); stopRaf(); raf = requestAnimationFrame(updateTimer); }
    else if (run.phase === 'stopped') t.textContent = run.time == null ? '—' : fmt(run.time);
    else if (run.phase === 'idle' && run.revealed) t.textContent = '—';
    else if (run.phase === 'idle') t.textContent = '0:00.00';
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
    const s = stat(ui.puzzle, run.cur.id); s.times.push(run.time); if (s.times.length > 50) s.times.shift();
    s.att.push(0); if (s.att.length > 10) s.att.shift(); s.last = Date.now(); if (s.status === 'New') s.status = 'Learning';
    run.lastRec = true; save(ui.puzzle); render();
  }
  function doNext() { if (!run.revealed) return; newRound(); render(); }
  function doForgot() {
    if (!run.cur || run.phase === 'running') return;
    const p = ui.puzzle, s = stat(p, run.cur.id);
    if (run.lastRec && run.phase === 'stopped') { s.times.pop(); s.att.pop(); }  // replace the timed attempt with a fail
    s.att.push(1); if (s.att.length > 10) s.att.shift(); s.fails++; s.last = Date.now(); if (s.status === 'New') s.status = 'Learning';
    clearTimeout(holdT); run.phase = 'stopped'; run.time = null; run.revealed = true; run.lastRec = false; save(p); render();
  }
  function doUndo() {
    if (!run.lastRec) return;
    const s = stat(ui.puzzle, run.cur.id); s.times.pop(); s.att.pop(); run.lastRec = false; run.time = null; save(ui.puzzle); render();
  }
  let wl = null;
  async function wakeLock() { try { if (navigator.wakeLock && !wl) { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); } } catch (e) { /* not supported or denied */ } }

  // keyboard (train screen only)
  let spaceDown = false, ignoreUp = false;
  document.addEventListener('keydown', e => {
    if (ui.screen !== 'train') return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (run.phase === 'running') { e.preventDefault(); if (!e.repeat) { ignoreUp = e.code === 'Space'; stopTimer(); } return; }
    if (e.code === 'Space') {
      e.preventDefault(); if (e.repeat) return;
      if (run.revealed) { ignoreUp = true; doNext(); } else { spaceDown = true; press(); }
    } else if (e.key === 'Enter' && run.revealed) { e.preventDefault(); doNext(); }
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
  function statusChip(p, c) { const s = stat(p, c.id); return `<button class="chip s-${s.status}" data-chip="${esc(c.id)}">${s.status}</button>`; }
  function viewCases() {
    const p = ui.puzzle;
    let list = cases[p];
    if (p === 'mm') list = list.filter(c => ui.mmSet === 'all' || c.group === ui.mmSet);
    else list = list.filter(c => (ui.sqParity === 'all' || (ui.sqParity === 'yes') === c.parity) && (ui.sqCol === 'both' || (ui.sqCol === 'flip') === c.flip));
    const val = c => { const t = stat(p, c.id).times; return t.length ? mean(t) : -1; };
    if (ui.sort === 'mean') list = list.slice().sort((a, b) => val(b) - val(a));
    else if (ui.sort === 'fails') list = list.slice().sort((a, b) => stat(p, b.id).fails - stat(p, a.id).fails);
    ui.shown = list;
    const filt = p === 'mm'
      ? `<label>Set <select id="mmSet"><option value="all">all (${cases.mm.length})</option>${[...new Set(cases.mm.map(c => c.group))].map(s => `<option ${s === ui.mmSet ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>`
      : `<label>Parity <select id="sqParity">${[['all', 'all'], ['yes', 'parity'], ['no', 'no parity']].map(([v, l]) => `<option value="${v}" ${v === ui.sqParity ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
         <label>Alg <select id="sqCol">${[['both', 'both'], ['noflip', 'without flip'], ['flip', 'with flip']].map(([v, l]) => `<option value="${v}" ${v === ui.sqCol ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
    const rows = list.map(c => {
      const s = stat(p, c.id), t = s.times;
      return `<div class="row ${c.ok ? '' : 'dim'}">
        <label class="pick"><input type="checkbox" data-sel="${esc(c.id)}" ${selected(p, c) && c.ok ? 'checked' : ''} ${c.ok ? '' : 'disabled'}></label>
        <div class="rname"><b>${esc(c.id)}</b> <span class="tag ${c.ok ? '' : 'bad'}">${c.ok ? esc(c.group) : 'unverified'}</span>
          <div class="alg">${c.algs.map(x => (x.ok ? '' : '<span class="tag bad">check</span> ') + esc(x.a)).join('<br>')}</div>
          ${c.ok ? '' : `<div class="note">${esc(c.why || 'no verified alg')}</div>`}${c.note ? `<div class="note">${esc(c.note)}</div>` : ''}</div>
        <div class="rstat"><button class="chip" data-edit="${esc(c.id)}">${ui.edit === c.id ? 'Close' : 'Edit'}</button>${statusChip(p, c)}<div class="note">${t.length ? 'mean ' + fmt(mean(t)) + ' · best ' + fmt(Math.min(...t)) : 'no times'}${s.fails ? ' · ' + s.fails + ' fails' : ''}</div></div>
      </div>${ui.edit === c.id ? editorHtml(p, c) : ''}`;
    }).join('');
    return `<div class="bar">${filt}
      <label>Sort <select id="sort">${[['name', 'sheet order'], ['mean', 'slowest first'], ['fails', 'most fails']].map(([v, l]) => `<option value="${v}" ${v === ui.sort ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
      <div class="bar"><button class="btn" id="selAll">Select shown</button><button class="btn" id="selNone">Deselect shown</button>
      <button class="btn" id="selLearning">Learning only</button><button class="btn" id="selNotLearned">Not learned yet</button>
      <span class="note">${list.length} shown · ${cases[p].filter(c => c.ok && selected(p, c)).length} selected</span></div>
      <div class="rows">${rows}</div>`;
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
        const st = an.ok ? `<div>edges: ${cyc(an.ep, i => M.FACES[M.ring[i]])}</div><div>corners: ${cyc(an.cp, i => M.FACES[M.ring[i]] + '/' + M.FACES[M.ring[(i + 1) % 5]])}</div><div class="note">x→y: piece at x belongs at y</div>` : `<div class="bad">not a PLL: ${esc(an.reason)}</div>`;
        return { inv, st, svg: an.ok ? D.megaminxDiagram(a, colors) : null };
      }
      const inv = S.invert(a), t = S.run(a), an = S.analyze(t);
      if (!an.ok) return { inv, st: `<div class="bad">not an EP alg: ${esc(an.reason)}</div>`, svg: null };
      const u = SHEET_U[S.classOf(an.topPerm)], d = SHEET_D[S.classOf(an.botPerm)];
      return { inv, st: `<div>row: <b>${u} / ${d}</b> · middle: <b>${t.flip ? 'flipped' : 'square'}</b> · parity: ${S.parity(an.topPerm) || S.parity(an.botPerm) ? 'yes' : 'no'}</div>`, svg: D.square1Diagram(a, null) };
    } catch (e) { return { inv: '', st: `<div class="bad">${esc(e.message)}</div>`, svg: null }; }
  }
  function previewHtml(p, text) {
    const lines = text.split('\n').map(x => x.trim()).filter(Boolean);
    return lines.map(a => { const r = previewOne(p, a); return `<div class="pv"><div class="alg">${esc(a)}</div><div class="note">reverse (setup):</div><div class="alg">${esc(r.inv)}</div>${r.st}${r.svg ? `<div class="diagwrap">${r.svg}</div>` : ''}</div>`; }).join('') || '<div class="note">no alg</div>';
  }
  function editorHtml(p, c) {
    const text = c.algs.map(x => x.a).join('\n');
    return `<div class="editor"><div class="note">One alg per line. The preview reverses each alg and shows the state it starts from.${p === 'sq' ? ` This case is <b>${c.flip ? 'flipped' : 'square'}</b> in the middle.` : ''}</div>
      <textarea id="edtxt" rows="${Math.max(2, c.algs.length + 1)}" spellcheck="false" autocapitalize="off" autocomplete="off">${esc(text)}</textarea>
      <div id="edprev">${previewHtml(p, text)}</div>
      <div class="bar"><button class="btn primary" id="edsave">Save</button><button class="btn" id="edcancel">Cancel</button>${db[p].alg[c.id] ? '<button class="btn danger" id="edreset">Back to sheet alg</button>' : ''}</div></div>`;
  }
  function wireCases() {
    const on = (id, ev, fn) => { const e = $(id); if (e) e.addEventListener(ev, fn); };
    const p = ui.puzzle;
    document.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => { ui.edit = ui.edit === b.dataset.edit ? null : b.dataset.edit; render(); }));
    const edit = ui.edit && cases[p].find(c => c.id === ui.edit);
    if (edit) {
      on('#edtxt', 'input', e => { $('#edprev').innerHTML = previewHtml(p, e.target.value); });
      const done = () => { ui.edit = null; run.queue = []; run.cur = null; render(); };
      on('#edsave', 'click', () => {
        const list = $('#edtxt').value.split('\n').map(x => x.trim()).filter(Boolean);
        if (!list.length) return;
        if (list.join('\n') === sheet[p][edit.id].join('\n')) delete db[p].alg[edit.id]; else db[p].alg[edit.id] = list;
        save(p); setAlgs(p, edit); done();
      });
      on('#edreset', 'click', () => { delete db[p].alg[edit.id]; save(p); setAlgs(p, edit); done(); });
      on('#edcancel', 'click', () => { ui.edit = null; render(); });
    }
    on('#mmSet', 'change', e => { ui.mmSet = e.target.value; render(); });
    on('#sqParity', 'change', e => { ui.sqParity = e.target.value; render(); });
    on('#sqCol', 'change', e => { ui.sqCol = e.target.value; render(); });
    on('#sort', 'change', e => { ui.sort = e.target.value; render(); });
    const setSel = fn => { ui.shown.forEach(c => { if (c.ok) db[p].sel[c.id] = fn(c) ? 1 : 0; }); save(p); run.queue = []; run.cur = null; render(); };
    on('#selAll', 'click', () => setSel(() => true));
    on('#selNone', 'click', () => setSel(() => false));
    on('#selLearning', 'click', () => setSel(c => stat(p, c.id).status === 'Learning'));
    on('#selNotLearned', 'click', () => setSel(c => stat(p, c.id).status !== 'Learned'));
    document.querySelectorAll('input[data-sel]').forEach(i => i.addEventListener('change', e => { db[p].sel[e.target.dataset.sel] = e.target.checked ? 1 : 0; run.queue = []; run.cur = null; save(p); render(); }));
    document.querySelectorAll('[data-chip]').forEach(b => b.addEventListener('click', () => { const s = stat(p, b.dataset.chip); s.status = { New: 'Learning', Learning: 'Learned', Learned: 'New' }[s.status]; save(p); render(); }));
  }

  // ---- Settings screen ----
  function viewSettings() {
    const p = ui.puzzle;
    const swatch = M.FACES.map((f, i) => `<label>${f}<input type="color" data-col="${i}" value="${colors[i]}"></label>`).join('');
    return `<div class="settings">
      <label class="chk"><input type="checkbox" id="showDiag" ${settings.showDiagram[p] ? 'checked' : ''}> Show case diagram after the solve (${p === 'mm' ? 'Megaminx' : 'Square-1'})</label>
      <label class="chk"><input type="checkbox" id="preview" ${settings.preview ? 'checked' : ''}> Show diagram <i>before</i> the solve (study mode, needs diagrams on)</label>
      ${p === 'mm' ? `<details><summary>Face colors (used by the diagram)</summary><div class="colors">${swatch}</div><button class="btn" id="resetCol">Reset colors</button></details>` : ''}
      <h3>Progress</h3>
      <p class="note">Progress is stored in this browser only. Export it to move it to another device.</p>
      <div class="bar"><button class="btn" id="export">Export</button><label class="btn">Import<input type="file" id="import" accept="application/json" hidden></label><button class="btn danger" id="reset">Reset ${p === 'mm' ? 'Megaminx' : 'Square-1'} stats</button></div>
      <p class="note" id="msg"></p>
    </div>`;
  }
  function wireSettings() {
    const on = (id, ev, fn) => { const e = $(id); if (e) e.addEventListener(ev, fn); };
    const p = ui.puzzle, msg = t => { $('#msg').textContent = t; };
    on('#showDiag', 'change', e => { settings.showDiagram[p] = e.target.checked; saveSettings(); });
    on('#preview', 'change', e => { settings.preview = e.target.checked; saveSettings(); });
    on('#resetCol', 'click', () => { colors = D.MM_DEFAULT_COLORS.slice(); store.set('at.colors', colors); render(); });
    document.querySelectorAll('input[data-col]').forEach(i => i.addEventListener('change', e => { colors[+e.target.dataset.col] = e.target.value; store.set('at.colors', colors); }));
    on('#export', 'click', () => {
      const blob = new Blob([JSON.stringify({ app: 'alg-trainer', v: 1, mm: db.mm, sq: db.sq, settings, colors }, null, 1)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'alg-trainer-progress.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    on('#import', 'change', e => {
      const f = e.target.files[0]; if (!f) return;
      f.text().then(t => {
        const o = JSON.parse(t);
        if (o.app !== 'alg-trainer' || !o.mm || !o.sq) throw new Error('not an alg-trainer export');
        db.mm = o.mm; db.sq = o.sq; ['mm', 'sq'].forEach(q => { db[q].alg = db[q].alg || {}; save(q); rebuild(q); });
        if (o.settings) { Object.assign(settings, o.settings); saveSettings(); }
        if (Array.isArray(o.colors) && o.colors.length === 12) { colors = o.colors; store.set('at.colors', colors); }
        run.cur = null; msg('Imported.');
      }).catch(err => msg('Import failed: ' + err.message));
    });
    on('#reset', 'click', () => { if (confirm('Delete all stats and selections for this puzzle?')) { db[p] = { sel: {}, st: {}, alg: db[p].alg }; save(p); run.cur = null; msg('Reset.'); } });
  }

  // ---- navigation ----
  const go = (puzzle, screen) => { clearTimeout(holdT); if (puzzle !== ui.puzzle) { run.cur = null; run.queue = []; run.soon = []; run.last = null; } ui.puzzle = puzzle; ui.screen = screen; if (screen === 'train' && !run.cur) newRound(); render(); };
  $('#tab-mm').addEventListener('click', () => go('mm', ui.screen));
  $('#tab-sq').addEventListener('click', () => go('sq', ui.screen));
  document.querySelectorAll('.sub').forEach(b => b.addEventListener('click', () => go(ui.puzzle, b.dataset.s)));
  newRound(); render();
})();
