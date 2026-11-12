// 2x2 simulator. 24 stickers: 8 corners x 3. A sticker is (corner position p, face normal n), coordinates in {-1, 1}: x = R face, y = U face, z = F face.
// R L U D F B turn the face clockwise seen from it (the four corners with a positive dot product to the face), x y z turn the whole cube like R U F.
// A "case" is a position up to how the cube is held and a turn of either layer (the U moves in brackets in front of an alg are that turn).
(function (root) {
  const AX = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const stickers = [];
  for (const sx of [1, -1]) for (const sy of [1, -1]) for (const sz of [1, -1]) for (let i = 0; i < 3; i++) stickers.push({ p: [sx, sy, sz], n: AX[i].map((c, k) => (k === i ? [sx, sy, sz][i] : 0)) });
  const key = (p, n) => p.join(',') + '|' + n.join(',');
  const slotOf = new Map(stickers.map((s, i) => [key(s.p, s.n), i]));
  const N = stickers.length; // 24
  const colorOf = i => { const n = stickers[i].n; return n[0] ? (n[0] > 0 ? 0 : 1) : n[1] ? (n[1] > 0 ? 2 : 3) : (n[2] > 0 ? 4 : 5); }; // R L U D F B
  const ROT = { x: v => [v[0], v[2], -v[1]], y: v => [-v[2], v[1], v[0]], z: v => [v[1], -v[0], v[2]] }; // clockwise seen from R, U, F
  const turn = (axis, k) => v => { let w = v; for (let i = 0; i < ((k % 4) + 4) % 4; i++) w = ROT[axis](w); return w; };
  const mapPerm = (f, test) => {
    const perm = new Int8Array(N);
    stickers.forEach((s, i) => { perm[i] = test(s.p) ? slotOf.get(key(f(s.p), f(s.n))) : i; });
    return perm;
  };
  const FACE = { R: ['x', 0, 1, 1], L: ['x', 0, -1, 3], U: ['y', 1, 1, 1], D: ['y', 1, -1, 3], F: ['z', 2, 1, 1], B: ['z', 2, -1, 3] }; // axis, coordinate, side, quarter turns clockwise
  const cache = new Map();
  function movePerm(t) {
    const k = t.m + t.turns; let p = cache.get(k); if (p) return p;
    if (FACE[t.m]) { const [ax, i, side, q] = FACE[t.m]; p = mapPerm(turn(ax, q * t.turns), v => v[i] * side > 0); }
    else p = mapPerm(turn(t.m, t.turns), () => true);
    cache.set(k, p); return p;
  }
  // Reads an alg. Brackets are ignored, "(R U)2" repeats, a quarter turn written R3 is R', and the acute and curly primes count as '.
  function parse(alg) {
    const s = String(alg).replace(/[‘’´ʹ`]/g, "'").replace(/\./g, ' ').trim();
    const out = [];
    (function go(str) {
      const re = /\(([^()]*)\)\s*(\d?)|([A-Za-z]\d?'?\d?)/g; let m, last = 0;
      while ((m = re.exec(str))) {
        if (m[3] === undefined) { const inner = []; (function () { const save = out.length; go(m[1]); const part = out.splice(save); const n = m[2] ? +m[2] : 1; for (let i = 0; i < n; i++) out.push(...part); })(); continue; }
        const mm = /^([RLUDFBxyz])(\d?)('?)(\d?)$/.exec(m[3]);
        if (!mm) throw new Error('bad token ' + m[3]);
        let n = mm[2] ? +mm[2] : 1; if (mm[4]) n = +mm[4]; // R3
        if (mm[3]) n = -n;
        n = ((n % 4) + 4) % 4; if (n) out.push({ m: mm[1], turns: n });
      }
    })(s);
    return out;
  }
  const invertToks = toks => toks.slice().reverse().map(t => ({ m: t.m, turns: (4 - t.turns) % 4 }));
  const tokStr = t => t.m + (t.turns === 1 ? '' : t.turns === 2 ? '2' : "'");
  const toStr = toks => toks.map(tokStr).join(' ');
  const invert = alg => toStr(invertToks(parse(alg)));
  const solved = () => { const s = new Int8Array(N); for (let i = 0; i < N; i++) s[i] = colorOf(i); return s; };
  const apply = (s, perm) => { const o = new Int8Array(N); for (let i = 0; i < N; i++) o[perm[i]] = s[i]; return o; };
  const run = (alg, s) => { s = s || solved(); for (const t of parse(alg)) s = apply(s, movePerm(t)); return s; };
  const ROTS = (() => {
    const seen = new Set(), q = [Int8Array.from({ length: N }, (_, i) => i)]; seen.add(q[0].join());
    for (let h = 0; h < q.length; h++) for (const ax of ['x', 'y']) {
      const g = mapPerm(turn(ax, 1), () => true), c = new Int8Array(N); for (let i = 0; i < N; i++) c[i] = g[q[h][i]];
      const k = c.join(); if (!seen.has(k)) { seen.add(k); q.push(c); }
    }
    return q;
  })();
  const isSolved = s => { for (let f = 0; f < 6; f++) { let c = -1; for (let i = 0; i < N; i++) if (colorOf(i) === f) { if (c === -1) c = s[i]; else if (c !== s[i]) return false; } } return true; };
  // the position however the cube is held: colours are renamed in order of first appearance
  const classOf = s => {
    let best = null;
    for (const r of ROTS) {
      const t = apply(s, r), m = {}; let n = 0, str = '';
      for (let i = 0; i < N; i++) { if (m[t[i]] === undefined) m[t[i]] = n++; str += m[t[i]]; }
      if (best === null || str < best) best = str;
    }
    return best;
  };
  // A short name for a position class, kept in the data instead of the 24 letters.
  const hash = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); };
  const D1 = () => movePerm({ m: 'D', turns: 1 }), U1 = () => movePerm({ m: 'U', turns: 1 });
  // Does the position s, with a turn of the top and/or bottom layer, match one of the given classes? (A case starts from the same position whatever turn of the layers it has.)
  const fits = (s, hashes) => {
    let t = s;
    for (let a = 0; a < 4; a++) { let u = t; for (let b = 0; b < 4; b++) { if (hashes.includes(hash(classOf(u)))) return true; u = apply(u, D1()); } t = apply(t, U1()); }
    return false;
  };
  // are two positions the same case: the same up to the hold and a turn of either layer
  const same = (a, b) => { const c = classOf(a); let t = b; for (let i = 0; i < 4; i++) { let u = t; for (let j = 0; j < 4; j++) { if (classOf(u) === c) return true; u = apply(u, D1()); } t = apply(t, U1()); } return false; };
  const api = { stickers, N, colorOf, parse, invert, run, solved, isSolved, classOf, hash, fits, same, toStr, ROTS, apply, ROT };
  if (typeof module !== 'undefined') module.exports = api; else root.Cube2 = api;
})(typeof window !== 'undefined' ? window : globalThis);
