// Square-1 simulator. Layer = 12 slots (30 deg each). Corner = 2 slots with same id, edge = 1 slot.
// ids: corners 0-3 top, 4-7 bottom; edges 8-11 top, 12-15 bottom. Both layers indexed clockwise seen from above.
(function (root) {
  const solvedLayer = (c0, e0) => { const L = new Array(12); for (let k = 0; k < 4; k++) { L[3 * k] = L[3 * k + 1] = c0 + k; L[3 * k + 2] = e0 + k; } return L; };
  const solved = () => ({ top: solvedLayer(0, 8), bot: solvedLayer(4, 12), flip: false });
  const mod = (n, m) => ((n % m) + m) % m;
  const rot = (L, n) => { const r = new Array(12); for (let i = 0; i < 12; i++) r[mod(i + n, 12)] = L[i]; return r; };

  // sT/sB: direction of positive turn for top/bottom (+1 = clockwise as seen from above)
  const CONV = { sT: 1, sB: -1 }; // verified against the sheet: top clockwise seen from above, bottom clockwise seen from below

  function parse(alg) {
    const t = alg.replace(/[()\[\]]/g, ' ').replace(/\//g, ' / ').trim().split(/\s+/).filter(Boolean);
    return t.map(x => {
      if (x === '/') return { slice: true };
      const m = /^(-?\d+),(-?\d+)$/.exec(x);
      if (!m) throw new Error('bad token ' + x);
      return { a: +m[1], b: +m[2] };
    });
  }

  function step(s, op, conv) {
    conv = conv || CONV;
    if (op.slice) {
      if (s.top[5] === s.top[6] || s.top[11] === s.top[0] || s.bot[5] === s.bot[6] || s.bot[11] === s.bot[0]) throw new Error('illegal slice');
      const top = s.top.slice(), bot = s.bot.slice();
      for (let i = 0; i < 6; i++) { top[5 - i] = s.bot[i]; bot[5 - i] = s.top[i]; }
      return { top, bot, flip: !s.flip };
    }
    return { top: rot(s.top, conv.sT * op.a), bot: rot(s.bot, conv.sB * op.b), flip: s.flip };
  }
  function run(alg, conv, st) { let s = st || solved(); for (const op of parse(alg)) s = step(s, op, conv); return s; }

  const sliceCount = alg => parse(alg).filter(o => o.slice).length;

  // After running an alg on a solved cube: check cube shape + home corners (up to final layer turns); return edge perms.
  function analyze(s) {
    const out = { ok: false };
    const layer = (L, c0, e0) => {
      let c = L.indexOf(c0); // first slot of corner c0 (scan so we get the start slot)
      while (L[mod(c - 1, 12)] === c0) c = mod(c - 1, 12);
      const R = rot(L, -c);
      for (let k = 0; k < 4; k++) if (R[3 * k] !== c0 + k || R[3 * k + 1] !== c0 + k) return { err: 'corners not home/cube shape' };
      const e = [2, 5, 8, 11].map(p => R[p]);
      if (e.some(v => v < 8)) return { err: 'edge slot holds corner' };
      return { e, turn: c };
    };
    const t = layer(s.top, 0, 8), b = layer(s.bot, 4, 12);
    if (t.err) return { ok: false, reason: 'top: ' + t.err };
    if (b.err) return { ok: false, reason: 'bottom: ' + b.err };
    const tp = t.e.map(v => v - 8), bp = b.e.map(v => v - 12);
    if (tp.some(v => v < 0 || v > 3) || bp.some(v => v < 0 || v > 3)) return { ok: false, reason: 'edges cross layers' };
    return { ok: true, topPerm: tp, botPerm: bp, flip: s.flip };
  }

  // conjugacy class under layer rotation, neutral names
  const parity = p => { let s = 0; const v = p.slice(); for (let i = 0; i < v.length; i++) while (v[i] !== i) { const j = v[i]; [v[i], v[j]] = [v[j], v[i]]; s ^= 1; } return s; };
  const compose = (p, q) => p.map((_, i) => p[q[i]]); // p after q
  const R1 = [1, 2, 3, 0], R3 = [3, 0, 1, 2];
  const conj = (p, r) => { let q = p; for (let k = 0; k < r; k++) q = compose(R1, compose(q, R3)); return q; };
  function classOf(p) {
    const key = x => x.join('');
    const cycles = []; const seen = new Array(4).fill(false);
    for (let i = 0; i < 4; i++) if (!seen[i]) { let c = 0, j = i; while (!seen[j]) { seen[j] = true; j = p[j]; c++; } cycles.push(c); }
    cycles.sort();
    const orb = q => { const ks = []; for (let r = 0; r < 4; r++) ks.push(key(conj(q, r))); return new Set(ks); };
    const inOrb = (q, rep) => orb(rep).has(key(q));
    const c = cycles.join('');
    if (c === '1111') return '-';
    if (c === '112') { const i0 = p.findIndex((v, i) => v !== i); return p[i0] - i0 === 2 || i0 - p[i0] === 2 ? 'Opp' : 'Adj'; }
    if (c === '13') return inOrb(p, [1, 2, 0, 3]) ? 'T3a' : 'T3b';
    if (c === '22') return inOrb(p, [2, 3, 0, 1]) ? 'H' : 'Z';
    if (c === '4') return key(p) === key(R1) ? 'O+' : key(p) === key(R3) ? 'O-' : 'W';
    return '?';
  }
  const invPerm = p => { const r = []; p.forEach((v, i) => (r[v] = i)); return r; };

  // State from which `alg` leads back to solved. Built from the alg's position permutation, so slice
  // legality at the start of the inverse never matters (inverse(alg) run on solved can hit an illegal slice).
  function caseState(alg) {
    const T = run(alg); // throws if the alg is illegal from solved
    const start = (L, c0) => { let c = L.indexOf(c0); while (L[mod(c - 1, 12)] === c0) c = mod(c - 1, 12); return c; };
    const sol = solved();
    // target = solved cube with layers turned the way the alg leaves them (a case is solved up to a final turn)
    const target = { top: rot(sol.top, start(T.top, 0)), bot: rot(sol.bot, start(T.bot, 4)) };
    let s = { top: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], bot: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23], flip: false };
    for (const op of parse(alg)) s = step(s, op);
    const end = s.top.concat(s.bot), content = target.top.concat(target.bot);
    const pi = []; end.forEach((lab, q) => (pi[lab] = q));
    const c = content.map((_, p) => content[pi[p]]);
    return { top: c.slice(0, 12), bot: c.slice(12), flip: s.flip };
  }
  // layer turns [a,b] (in sheet units) that take a solved cube to the state `alg` ends in; needed so inverse(alg) is legal from solved
  function endTurns(alg) {
    const T = run(alg);
    const start = (L, c0) => { let c = L.indexOf(c0); while (L[mod(c - 1, 12)] === c0) c = mod(c - 1, 12); return c; };
    return [start(T.top, 0) * CONV.sT, start(T.bot, 4) * CONV.sB];
  }
  const invert = alg => parse(alg).reverse().map(o => (o.slice ? '/' : (-o.a || 0) + ',' + (-o.b || 0))).join(' ');

  // ---- CSP (cube shape + parity) ----
  // A CSP alg turns a cube shape's "case shape" into a plain cube shape (square layers). Colours do not matter, so the case is
  // read off the reversed alg: run inverse(alg) from a solved cube (with a layer pre-turn that keeps every slice legal).
  const layerKey = L => { const s = L.map(v => (v < 8 ? 'C' : 'E')).join(''); let best = s; for (let r = 1; r < 12; r++) { const t = s.slice(r) + s.slice(0, r); if (t < best) best = t; } return best; };
  const shapeKey = st => layerKey(st.top) + '/' + layerKey(st.bot);
  function cspState(alg, key) {
    const ops = parse(invert(alg));
    for (let a = 0; a < 12; a++) for (let b = 0; b < 12; b++) {
      const s0 = solved();
      let s = { top: rot(s0.top, a), bot: rot(s0.bot, b), flip: false };
      try { for (const op of ops) s = step(s, op); } catch (e) { continue; }
      const k = shapeKey(s);
      if (key && k !== key) continue;
      return { top: s.top, bot: s.bot, flip: s.flip, pre: [a, b], key: k };
    }
    return null;
  }
  const api = { cspState, shapeKey, caseState, invert, solved, parse, step, run, analyze, classOf, parity, invPerm, sliceCount, endTurns, CONV };
  if (typeof module !== 'undefined') module.exports = api; else root.Square1 = api;
})(typeof window !== 'undefined' ? window : globalThis);
