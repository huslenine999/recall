// Skewb simulator. 30 stickers: 6 centers and 8 corners x 3. A sticker is (piece position p, face normal n) with coordinates in
// {-1,0,1}: x = R face, y = U face, z = F face. A corner turn rotates every piece whose position has a positive dot product with the
// corner (the corner, its 3 neighbours and the 3 centers next to it) by 120 degrees.
// Two notations are read. NS (the normal Skewb algorithms): capitals turn the top corners F R B L, lowercase the bottom corners
// f r b l, x y z turn the whole puzzle like R U F. SA (Sarah's): the same corners, plus the macros S = R' F R F' and
// H = F R' F' R, and its y and z swap axes (z turns the whole puzzle about the vertical axis). Both were checked against the
// pictures printed in the HCubist sheets: every case starts from exactly the state drawn there.
(function (root) {
  const CORNERS = { F: [1, 1, 1], R: [1, 1, -1], B: [-1, 1, -1], L: [-1, 1, 1], f: [1, -1, 1], r: [1, -1, -1], b: [-1, -1, -1], l: [-1, -1, 1] };
  const NS = { id: 'ns', axes: { x: 'x', y: 'y', z: 'z' }, macros: false };
  const SA = { id: 'sa', axes: { x: 'x', y: 'z', z: 'y' }, macros: true };
  const MACRO = { S: "R' F R F'", H: "F R' F' R" };

  const stickers = []; // {p, n}
  const AX = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let i = 0; i < 3; i++) for (const s of [1, -1]) { const v = AX[i].map(c => c * s); stickers.push({ p: v, n: v }); }
  for (const sx of [1, -1]) for (const sy of [1, -1]) for (const sz of [1, -1]) for (let i = 0; i < 3; i++) stickers.push({ p: [sx, sy, sz], n: AX[i].map((c, k) => (k === i ? [sx, sy, sz][i] : 0)) });
  const key = (p, n) => p.join(',') + '|' + n.join(',');
  const slotOf = new Map(stickers.map((s, i) => [key(s.p, s.n), i]));
  const N = stickers.length; // 30
  const colorOf = i => { const n = stickers[i].n; return n[0] ? (n[0] > 0 ? 0 : 1) : n[1] ? (n[1] > 0 ? 2 : 3) : (n[2] > 0 ? 4 : 5); }; // R L U D F B

  const mapPerm = (f, test) => {
    const perm = new Int8Array(N);
    stickers.forEach((s, i) => { perm[i] = test(s.p) ? slotOf.get(key(f(s.p), f(s.n))) : i; });
    return perm;
  };
  const cornerFn = (c, dir) => { // dir +1: clockwise seen from outside the corner
    const D = v => [v[0] * c[0], v[1] * c[1], v[2] * c[2]];
    const det = c[0] * c[1] * c[2]; // conjugating by a mirror (an odd number of minus signs) reverses the turning direction
    const T = dir * det > 0 ? v => [v[1], v[2], v[0]] : v => [v[2], v[0], v[1]];
    return v => D(T(D(v)));
  };
  const ROT = { // clockwise seen from the face the letter names
    x: v => [v[0], v[2], -v[1]],
    y: v => [-v[2], v[1], v[0]],
    z: v => [v[1], -v[0], v[2]]
  };
  const rotFn = (axis, turns) => { const t = ((turns % 4) + 4) % 4; return v => { let w = v; for (let k = 0; k < t; k++) w = ROT[axis](w); return w; }; };

  const cache = new Map();
  function movePerm(tok, cfg) {
    const k = cfg.id + (tok.corner ? tok.corner + (tok.dir > 0 ? '' : "'") : tok.rot + tok.turns);
    let p = cache.get(k); if (p) return p;
    if (tok.corner) { const c = CORNERS[tok.corner]; p = mapPerm(cornerFn(c, tok.dir), q => q[0] * c[0] + q[1] * c[1] + q[2] * c[2] > 0); }
    else p = mapPerm(rotFn(cfg.axes[tok.rot], tok.turns), () => true);
    cache.set(k, p); return p;
  }

  const invertToks = toks => toks.slice().reverse().map(t => (t.corner ? { corner: t.corner, dir: -t.dir } : { rot: t.rot, turns: (4 - t.turns) % 4 }));
  function parse(alg, cfg) {
    cfg = cfg || NS;
    const out = [];
    for (const raw of alg.replace(/[()\[\]]/g, ' ').trim().split(/\s+/).filter(Boolean)) {
      const m = /^([A-Za-z])(2?)('?)$/.exec(raw);
      if (!m) throw new Error('bad token ' + raw);
      const [, l, two, pr] = m;
      if (cfg.macros && MACRO[l]) { if (two) throw new Error('bad token ' + raw); const sub = parse(MACRO[l], cfg); out.push(...(pr ? invertToks(sub) : sub)); continue; }
      if (l === 'x' || l === 'y' || l === 'z') { const t = two ? 2 : 1; out.push({ rot: l, turns: pr ? 4 - t : t }); continue; }
      if (!CORNERS[l]) throw new Error('bad token ' + raw);
      const net = (((two ? 2 : 1) * (pr ? -1 : 1) % 3) + 3) % 3; // two turns one way = one turn the other way (r2' = r)
      out.push({ corner: l, dir: net === 1 ? 1 : -1 });
    }
    return out;
  }
  const tokStr = t => (t.corner ? t.corner + (t.dir > 0 ? '' : "'") : t.rot + (t.turns === 1 ? '' : t.turns === 2 ? '2' : "'"));
  const toStr = toks => toks.map(tokStr).join(' ');
  const invert = (alg, cfg) => toStr(invertToks(parse(alg, cfg)));

  const solved = () => { const s = new Int8Array(N); for (let i = 0; i < N; i++) s[i] = colorOf(i); return s; };
  const apply = (s, perm) => { const o = new Int8Array(N); for (let i = 0; i < N; i++) o[perm[i]] = s[i]; return o; };
  const run = (alg, s, cfg) => { cfg = cfg || NS; s = s || solved(); for (const t of parse(alg, cfg)) s = apply(s, movePerm(t, cfg)); return s; };

  const ROTS = (() => { // the 24 whole-puzzle rotations as sticker permutations
    const seen = new Set(), q = [Int8Array.from({ length: N }, (_, i) => i)]; seen.add(q[0].join());
    for (let h = 0; h < q.length; h++) for (const ax of ['x', 'y']) {
      const g = mapPerm(rotFn(ax, 1), () => true), c = new Int8Array(N); for (let i = 0; i < N; i++) c[i] = g[q[h][i]];
      const k = c.join(); if (!seen.has(k)) { seen.add(k); q.push(c); }
    }
    return q;
  })();
  const isSolved = s => { for (let f = 0; f < 6; f++) { let c = -1; for (let i = 0; i < N; i++) if (colorOf(i) === f) { if (c === -1) c = s[i]; else if (c !== s[i]) return false; } } return true; };
  // the class of a position: the same however the puzzle is held (colours are renamed by the face their center is on)
  const classOf = s => {
    let best = null;
    for (const r of ROTS) {
      const t = apply(s, r), m = new Int8Array(6); for (let i = 0; i < 6; i++) m[t[i]] = colorOf(i);
      let str = ''; for (let i = 0; i < N; i++) str += String.fromCharCode(65 + m[t[i]]);
      if (best === null || str < best) best = str;
    }
    return best;
  };
  // The alg with every x y z turned into the corner letters it makes you use: no rotations left, so a setup scramble needs none.
  function normalize(alg, cfg) {
    cfg = cfg || NS;
    const out = []; let M = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]; // M[j]: where original axis j points now
    for (const t of parse(alg, cfg)) {
      if (t.rot) { const f = rotFn(cfg.axes[t.rot], t.turns); M = M.map(col => f(col)); continue; }
      const c = CORNERS[t.corner], pos = [0, 1, 2].map(j => M[j][0] * c[0] + M[j][1] * c[1] + M[j][2] * c[2]); // the body position now at c
      out.push({ corner: Object.keys(CORNERS).find(k => CORNERS[k].join() === pos.join()), dir: t.dir });
    }
    return toStr(out);
  }

  // The scramble that sets a case up: the alg reversed, macros opened, turns of the whole puzzle written the NS way (x y z).
  // Keeping the rotations means you finish holding the puzzle the way the case picture shows it.
  const scramble = (alg, cfg) => { cfg = cfg || NS; return toStr(invertToks(parse(alg, cfg)).map(t => (t.rot ? { rot: cfg.axes[t.rot], turns: t.turns } : t))); };
  const api = { scramble, NS, SA, CORNERS, parse, invert, run, solved, isSolved, classOf, normalize, toStr, N, colorOf, stickers, ROTS, apply };
  if (typeof module !== 'undefined') module.exports = api; else root.Skewb = api;
})(typeof window !== 'undefined' ? window : globalThis);
