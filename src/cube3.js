// 3x3 simulator. 54 stickers: a sticker is (cubie position p, face normal n), coordinates in {-1, 0, 1}: x = R face, y = U face, z = F face.
// Face turns U D R L F B go clockwise seen from the face; wide turns (r l u d f b, or Rw Lw ...) also take the middle layer; M E S follow L, D, F; x y z turn the whole cube like R U F.
// Colours are the usual scheme with the last layer on top: U yellow, D white, F green, B blue, R red, L orange.
// A "case" is a position up to how the cube is held. What else counts as the same case depends on the set (see keyOf): a turn of the top layer
// before or after the alg for last-layer sets, nothing for F2L (the four slots are the same case), and which pieces matter (a COLL ignores where the edges are).
(function (root) {
  const stickers = [];
  for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) {
    const p = [x, y, z];
    for (let i = 0; i < 3; i++) if (p[i] !== 0) stickers.push({ p, n: [0, 1, 2].map(k => (k === i ? p[i] : 0)) });
  }
  const N = stickers.length; // 54
  const key = (p, n) => p.join(',') + '|' + n.join(',');
  const slotOf = new Map(stickers.map((s, i) => [key(s.p, s.n), i]));
  // colour indices: 0 R, 1 L, 2 U, 3 D, 4 F, 5 B
  const colorOf = i => { const n = stickers[i].n; return n[0] ? (n[0] > 0 ? 0 : 1) : n[1] ? (n[1] > 0 ? 2 : 3) : (n[2] > 0 ? 4 : 5); };
  const R_ = 0, L_ = 1, U_ = 2, D_ = 3, F_ = 4, B_ = 5;
  const ROT = { x: v => [v[0], v[2], -v[1]], y: v => [-v[2], v[1], v[0]], z: v => [v[1], -v[0], v[2]] }; // clockwise seen from R, U, F
  const turn = (axis, k) => v => { let w = v; for (let i = 0; i < ((k % 4) + 4) % 4; i++) w = ROT[axis](w); return w; };
  const mapPerm = (f, test) => {
    const perm = new Int8Array(N);
    stickers.forEach((s, i) => { perm[i] = test(s.p) ? slotOf.get(key(f(s.p), f(s.n))) : i; });
    return perm;
  };
  // move name -> axis, which layers (test on the coordinate), quarter turns clockwise (as the letter says) for one written turn
  const MOVES = {
    R: ['x', 0, v => v === 1, 1], L: ['x', 0, v => v === -1, 3], U: ['y', 1, v => v === 1, 1], D: ['y', 1, v => v === -1, 3], F: ['z', 2, v => v === 1, 1], B: ['z', 2, v => v === -1, 3],
    r: ['x', 0, v => v >= 0, 1], l: ['x', 0, v => v <= 0, 3], u: ['y', 1, v => v >= 0, 1], d: ['y', 1, v => v <= 0, 3], f: ['z', 2, v => v >= 0, 1], b: ['z', 2, v => v <= 0, 3],
    M: ['x', 0, v => v === 0, 3], E: ['y', 1, v => v === 0, 3], S: ['z', 2, v => v === 0, 1],
    x: ['x', 0, () => true, 1], y: ['y', 1, () => true, 1], z: ['z', 2, () => true, 1]
  };
  const cache = new Map();
  function movePerm(t) {
    const k = t.m + t.turns; let p = cache.get(k); if (p) return p;
    const [ax, i, test, q] = MOVES[t.m];
    p = mapPerm(turn(ax, q * t.turns), v => test(v[i]));
    cache.set(k, p); return p;
  }
  // Reads an alg. Brackets are ignored, "(R U)3" repeats, a quarter turn written R3 is R', "Rw" is "r", and the acute and curly primes count as '.
  function parse(alg) {
    const s = String(alg).replace(/[‘’´ʹ`]/g, "'").replace(/[\[\],.]/g, ' ').trim();
    const out = [];
    (function go(str) {
      const re = /\(([^()]*)\)\s*(\d?)|([A-Za-z]w?\d?'?\d?)/g; let m;
      while ((m = re.exec(str))) {
        if (m[3] === undefined) { const save = out.length; go(m[1]); const part = out.splice(save); const n = m[2] ? +m[2] : 1; for (let i = 0; i < n; i++) out.push(...part); continue; }
        const mm = /^([URFDLBurfdlbMESxyz])(w?)(\d?)('?)(\d?)$/.exec(m[3]);
        if (!mm) throw new Error('bad token ' + m[3]);
        let name = mm[1];
        if (mm[2]) { if (!/[URFDLB]/.test(name)) throw new Error('bad token ' + m[3]); name = name.toLowerCase(); }
        let n = mm[3] ? +mm[3] : 1; if (mm[5]) n = +mm[5];
        if (mm[4]) n = -n;
        n = ((n % 4) + 4) % 4; if (n) out.push({ m: name, turns: n });
      }
    })(s);
    return out;
  }
  // Rewrites an alg without whole-cube turns: after an x, y or z the letters name other layers, so every later letter is renamed to the layer it really turns
  // (an alg that starts "y' x L2 D2 ..." becomes the same moves written for the cube as it was held at the start). The result starts and ends with the cube held the same way.
  const ROTMAP = { x: { U: 'F', B: 'U', D: 'B', F: 'D' }, y: { L: 'F', B: 'L', R: 'B', F: 'R' }, z: { R: 'U', D: 'R', L: 'D', U: 'L' } }; // new[face] = old[ROTMAP[axis][face]]
  const SLICE = { M: 'L', E: 'D', S: 'F' }; // the face each slice turns like
  function flatToks(toks) {
    const at = { U: 'U', D: 'D', F: 'F', B: 'B', R: 'R', L: 'L' }; const out = [];
    for (const t of toks) {
      if (ROTMAP[t.m]) { for (let i = 0; i < t.turns; i++) { const o = Object.assign({}, at); for (const f in ROTMAP[t.m]) at[f] = o[ROTMAP[t.m][f]]; } continue; }
      if (SLICE[t.m]) { const h = at[SLICE[t.m]], ax = { L: 'M', R: 'M', U: 'E', D: 'E', F: 'S', B: 'S' }[h]; out.push({ m: ax, turns: SLICE[ax] === h ? t.turns : (4 - t.turns) % 4 }); continue; }
      const h = at[t.m.toUpperCase()]; out.push({ m: t.m === t.m.toLowerCase() ? h.toLowerCase() : h, turns: t.turns });
    }
    return out;
  }
  const flat = alg => toStr(flatToks(parse(alg)));
  const invertToks = toks => toks.slice().reverse().map(t => ({ m: t.m, turns: (4 - t.turns) % 4 }));
  const tokStr = t => t.m + (t.turns === 1 ? '' : t.turns === 2 ? '2' : "'");
  const toStr = toks => toks.map(tokStr).join(' ');
  const invert = alg => toStr(invertToks(parse(alg)));
  const solved = () => { const s = new Int8Array(N); for (let i = 0; i < N; i++) s[i] = colorOf(i); return s; };
  const apply = (s, perm) => { const o = new Int8Array(N); for (let i = 0; i < N; i++) o[perm[i]] = s[i]; return o; };
  const run = (alg, s) => { s = s || solved(); for (const t of parse(alg)) s = apply(s, movePerm(t)); return s; };
  // the position an alg solves, the cube held as at the start of the alg; and the moves that make it from a solved cube (no whole-cube turns in them)

  // ---- holding the cube: ROTS are the 24 whole-cube turns; norm() turns a state until every centre is back in its home place (null if the centres are not in a legal arrangement)
  const ROTS = (() => {
    const seen = new Set(), q = [Int8Array.from({ length: N }, (_, i) => i)]; seen.add(q[0].join());
    for (let h = 0; h < q.length; h++) for (const ax of ['x', 'y']) {
      const g = mapPerm(turn(ax, 1), () => true), c = new Int8Array(N); for (let i = 0; i < N; i++) c[i] = g[q[h][i]];
      const k = c.join(); if (!seen.has(k)) { seen.add(k); q.push(c); }
    }
    return q;
  })();
  const CENTER = [0, 1, 2, 3, 4, 5].map(c => stickers.findIndex((s, i) => s.p.filter(v => v === 0).length === 2 && colorOf(i) === c));
  const norm = s => {
    for (const r of ROTS) { const t = apply(s, r); let ok = true; for (let c = 0; c < 6; c++) if (t[CENTER[c]] !== c) { ok = false; break; } if (ok) return t; }
    return null;
  };
  // The cube as a solved cube turned so that its centres sit where s has them (an alg that moves a slice or a wide layer without turning it back ends with the centres shifted).
  const heldLike = s => { const sv = solved(); for (const r of ROTS) { const t = apply(sv, r); if (CENTER.every(i => t[i] === s[i])) return t; } return null; };
  // the position an alg solves, the cube held as at the start of the alg; and the moves that make it from a solved cube (a turn of the whole cube first only when the alg shifts the centres)
  const start = alg => { const f = flat(alg), e = heldLike(run(f)); return run(invert(f), e || undefined); };
  const holdTurn = alg => { const e = heldLike(run(flat(alg))); if (!e) return ''; for (const seq of ['', 'x', "x'", 'x2', 'y', "y'", 'y2', 'z', "z'", 'z2', 'x y', "x y'", "x' y", "x' y'", 'x z', "x z'", "x' z", "x' z'", 'y z', "y z'", "y' z", "y' z'", 'x2 y', 'x2 z', 'y2 x', 'y2 z', 'z2 x', 'z2 y']) if (CENTER.every(i => run(seq)[CENTER[i]] === e[CENTER[i]])) return seq; return ''; };
  const scramble = alg => { const h = holdTurn(alg); return (h ? h + ' ' : '') + invert(flat(alg)); };
  const isSolved = s => { const n = norm(s); if (!n) return false; for (let i = 0; i < N; i++) if (n[i] !== colorOf(i)) return false; return true; };
  const U1 = movePerm({ m: 'U', turns: 1 }), Y1 = movePerm({ m: 'y', turns: 1 });
  const pow = (perm, k) => { let t = Int8Array.from({ length: N }, (_, i) => i); for (let i = 0; i < k; i++) { const o = new Int8Array(N); for (let j = 0; j < N; j++) o[j] = perm[t[j]]; t = o; } return t; };
  const UP = [0, 1, 2, 3].map(k => pow(U1, k)), YP = [0, 1, 2, 3].map(k => pow(Y1, k));
  // relabel colours so the side colours go F -> R -> B -> L j times (what a turn of the top layer, or of the whole cube, does to the colours of the pieces it carries)
  const SIDE = [F_, L_, B_, R_]; // a clockwise turn from above carries F to L, L to B, B to R, R to F
  const relabel = (s, j) => { const m = [0, 1, 2, 3, 4, 5]; for (let i = 0; i < 4; i++) m[SIDE[i]] = SIDE[(i + j) % 4]; const o = new Int8Array(N); for (let i = 0; i < N; i++) o[i] = m[s[i]]; return o; };
  // slot lists
  const at = f => { const r = []; stickers.forEach((s, i) => { if (f(s)) r.push(i); }); return r; };
  const LL = at(s => s.p[1] === 1);                                    // the 21 stickers of the top layer (9 on U, 12 on the sides)
  const LLC = at(s => s.p[1] === 1 && s.p[0] !== 0 && s.p[2] !== 0);   // the 12 stickers of the four top corners
  const LLE = at(s => s.p[1] === 1 && (s.p[0] === 0) !== (s.p[2] === 0)); // the 8 stickers of the four top edges
  const LLE_U = LLE.filter(i => stickers[i].n[1] === 1);               // their U stickers
  const BELOW = at(s => s.p[1] <= 0);                                  // the first two layers
  // which stickers sit on a piece that has yellow on it (a last-layer piece), wherever that piece is
  const posGroups = (() => { const g = new Map(); stickers.forEach((s, i) => { const k = s.p.join(','); if (!g.has(k)) g.set(k, []); g.get(k).push(i); }); return Array.from(g.values()); })();
  const LLPIECE = s => { const m = new Uint8Array(N); for (const g of posGroups) { if (g.length < 2) continue; if (g.some(i => s[i] === U_)) for (const i of g) m[i] = 1; } return m; };
  const f2lSolved = n => BELOW.every(i => n[i] === colorOf(i));
  const CROSS = at(s => s.p[1] === -1 && (s.p[0] === 0 || s.p[2] === 0));                  // the bottom cross: four edges (both stickers) and the centre
  const crossSolved = n => !!n && CROSS.every(i => n[i] === colorOf(i));
  const eoSolved = n => LLE_U.every(i => n[i] === U_);
  // ---- the position class of a state, per set. Returns a string, or null when the state is not a position of this kind of set.
  const min = a => a.reduce((b, x) => (b === null || x < b ? x : b), null);
  const FLAG = c => (c === U_ ? 'Y' : '.');
  const ll16 = (n, slots, fn) => { const o = []; for (let k = 0; k < 4; k++) { const t = apply(n, UP[k]); for (let j = 0; j < 4; j++) { const r = relabel(t, j); o.push(slots.map(i => fn(r[i], i)).join('')); } } return min(o); };
  const keyOf = {
    // orientation of the last layer only, up to a turn of the top layer
    oll: n => { if (!f2lSolved(n)) return null; return min([0, 1, 2, 3].map(k => { const t = apply(n, UP[k]); return LL.map(i => FLAG(t[i])).join(''); })); },
    // the four corners exactly, the edges oriented (where they are does not matter)
    coll: n => { if (!f2lSolved(n) || !eoSolved(n)) return null; return ll16(n, LLC, c => c); },
    // the whole last layer
    pll: n => { if (!f2lSolved(n)) return null; return ll16(n, LL, c => c); },
    zbll: n => { if (!f2lSolved(n)) return null; return ll16(n, LL, c => c); },
    // first two layers exactly except for the pieces that belong to the last layer; those only show whether they are turned the right way. Up to a turn of the whole cube about y.
    f2l: (n, flag) => {
      const o = [];
      for (let k = 0; k < 4; k++) { const t = relabel(apply(n, YP[k]), k), m = LLPIECE(t); o.push(Array.from(t, (c, i) => (m[i] ? (flag ? FLAG(c) : '.') : c)).join('')); }
      return min(o);
    }
  };
  // Advanced F2L: the sheet's algs for one case do not all start with the same turn of the top layer, so that turn does not make a different case either
  keyOf.af2l = n => {
    const o = [];
    for (let u = 0; u < 4; u++) { const a = apply(n, UP[u]); for (let k = 0; k < 4; k++) { const t = relabel(apply(a, YP[k]), k), m = LLPIECE(t); o.push(Array.from(t, (c, i) => (m[i] ? '.' : c)).join('')); } }
    return min(o);
  };
  keyOf.wv = n => keyOf.f2l(n, true);
  keyOf.vls = n => keyOf.f2l(n, true);
  const SETKEY = { F2L: 'f2l', 'Advanced F2L': 'af2l', OLL: 'oll', PLL: 'pll', COLL: 'coll', WV: 'wv', VLS: 'vls', ZBLL: 'zbll' };
  // The class of what an alg solves, as a short string kept in the data.
  const hash = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); };
  const classOf = (set, s) => { const n = norm(s); if (!n) return null; const k = keyOf[SETKEY[set] || set](n); return k === null ? null : hash(k); };
  // what is drawn: the position held the usual way, with the stickers that do not belong to the case removed (-1)
  // A setup that ends with a turn of the whole cube (y, y') is drawn as it ends up, like the source sheet does (that is what the turn is for): the positions stay where they are and the colours are read from the centres.
  // Anything else (a tipped cube) is turned back so the centres sit at home.
  const asHeld = s => { for (let j = 0; j < 4; j++) { const t = relabel(s, j); if (CENTER.every((ci, c) => t[ci] === c)) return t; } return norm(s); };
  const view = (set, s) => {
    const n = asHeld(s); if (!n) return null;
    const o = Int8Array.from(n), m = LLPIECE(n);
    const sk = SETKEY[set] || set;
    if (sk === 'oll') { for (const i of LL) o[i] = n[i] === U_ ? U_ : -1; }
    else if (sk === 'coll') { for (const i of LLE) o[i] = n[i] === U_ ? U_ : -1; }
    else if (sk === 'f2l' || sk === 'af2l') { for (let i = 0; i < N; i++) if (m[i]) o[i] = -1; }
    else if (sk === 'wv' || sk === 'vls') { for (let i = 0; i < N; i++) if (m[i] && n[i] !== U_) o[i] = -1; }
    return o;
  };
  const api = { stickers, N, colorOf, parse, invert, flat, start, scramble, run, solved, isSolved, norm, classOf, view, hash, toStr, ROTS, apply, keyOf, SETKEY, LL, LLC, LLE, LLPIECE, f2lSolved, crossSolved, relabel, UP, YP, ROT };
  if (typeof module !== 'undefined') module.exports = api; else root.Cube3 = api;
})(typeof window !== 'undefined' ? window : globalThis);
