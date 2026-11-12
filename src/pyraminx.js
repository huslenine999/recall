// Pyraminx simulator. 36 stickers (4 faces x 9 small triangles). A sticker is its centroid p (in ninths) and its face normal.
// Vertices U, L, R, B (U on top; L, R, B counter-clockwise seen from above). A capital letter turns the vertex with its two
// layers (tip, center and the three edges next to it), a lowercase letter turns the tip alone. Plain = clockwise seen from the vertex.
(function (root) {
  const V = { U: [1, 1, 1], L: [1, -1, -1], R: [-1, 1, -1], B: [-1, -1, 1] };
  const NAMES = ['U', 'L', 'R', 'B'];
  const FACE_COLOR = { U: 3, B: 0, R: 1, L: 2 }; // face opposite the vertex -> colour index: green (front, opposite B), red (opposite R), blue (opposite L), yellow (opposite U)
  const stickers = []; // {p: [x9,y9,z9], n: [..], face: vertex it is opposite to}
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  for (const k of NAMES) {
    const u = NAMES.filter(x => x !== k).map(x => V[x]), n = V[k].map(c => -c);
    const pt = g => [0, 1, 2].map(c => (g[0] * u[0][c] + g[1] * u[1][c] + g[2] * u[2][c]) / 3); // a point of the face's grid (a + b + c = 3), in the vertex coordinates
    const add = (w, kind, tri) => stickers.push({ p: [0, 1, 2].map(c => Math.round(9 * (w[0] * u[0][c] + w[1] * u[1][c] + w[2] * u[2][c]))), n, face: k, kind, verts: tri.map(pt) });
    for (let i = 0; i <= 2; i++) for (let j = 0; i + j <= 2; j++) { const q = 2 - i - j; add([(i + 1 / 3) / 3, (j + 1 / 3) / 3, (q + 1 / 3) / 3], null, [[i + 1, j, q], [i, j + 1, q], [i, j, q + 1]]); } // up triangles
    for (let i = 0; i <= 1; i++) for (let j = 0; i + j <= 1; j++) { const q = 1 - i - j; add([(i + 2 / 3) / 3, (j + 2 / 3) / 3, (q + 2 / 3) / 3], 'center', [[i, j + 1, q + 1], [i + 1, j, q + 1], [i + 1, j + 1, q]]); } // down triangles
  }
  const N = stickers.length; // 36
  const key = (p, n) => p.join(',') + '|' + n.join(',');
  const slotOf = new Map(stickers.map((s, i) => [key(s.p, s.n), i]));
  const colorOf = i => FACE_COLOR[stickers[i].face];
  const cornerFn = (c, dir) => {
    const T = dir > 0 ? v => [v[1], v[2], v[0]] : v => [v[2], v[0], v[1]]; // all four vertices have an even number of minus signs
    const D = v => [v[0] * c[0], v[1] * c[1], v[2] * c[2]];
    return v => D(T(D(v)));
  };
  const mapPerm = (f, test) => {
    const perm = new Int8Array(N);
    stickers.forEach((s, i) => { perm[i] = test(s) ? slotOf.get(key(f(s.p), f(s.n))) : i; });
    return perm;
  };
  const cache = new Map();
  function movePerm(tok) {
    const k = tok.v + tok.tip + tok.dir; let p = cache.get(k); if (p) return p;
    const c = V[tok.v], f = cornerFn(c, tok.dir), cut = tok.tip ? 5 / 3 : 1 / 3;
    p = mapPerm(f, s => dot(s.p, c) / 9 > cut); cache.set(k, p); return p;
  }
  const invertToks = toks => toks.slice().reverse().map(t => Object.assign({}, t, { dir: -t.dir }));
  function parse(alg) {
    const out = [];
    for (const raw of alg.replace(/[()\[\]]/g, ' ').trim().split(/\s+/).filter(Boolean)) {
      const m = /^([ULRBulrb])(2?)('?)$/.exec(raw);
      if (!m) throw new Error('bad token ' + raw);
      const l = m[1], net = (((m[2] ? 2 : 1) * (m[3] ? -1 : 1) % 3) + 3) % 3;
      out.push({ v: l.toUpperCase(), tip: l !== l.toUpperCase(), dir: net === 1 ? 1 : -1 });
    }
    return out;
  }
  const tokStr = t => (t.tip ? t.v.toLowerCase() : t.v) + (t.dir > 0 ? '' : "'");
  const toStr = toks => toks.map(tokStr).join(' ');
  const invert = alg => toStr(invertToks(parse(alg)));
  const solved = () => { const s = new Int8Array(N); for (let i = 0; i < N; i++) s[i] = colorOf(i); return s; };
  const apply = (s, perm) => { const o = new Int8Array(N); for (let i = 0; i < N; i++) o[perm[i]] = s[i]; return o; };
  const run = (alg, s) => { s = s || solved(); for (const t of parse(alg)) s = apply(s, movePerm(t)); return s; };
  const ROTS = (() => { // the 12 rotations of the whole puzzle
    const gens = NAMES.map(k => mapPerm(cornerFn(V[k], 1), () => true)), seen = new Set(), q = [Int8Array.from({ length: N }, (_, i) => i)]; seen.add(q[0].join());
    for (let h = 0; h < q.length; h++) for (const g of gens) { const c = new Int8Array(N); for (let i = 0; i < N; i++) c[i] = g[q[h][i]]; const k = c.join(); if (!seen.has(k)) { seen.add(k); q.push(c); } }
    return q;
  })();
  const isSolved = s => { for (let f = 0; f < 4; f++) { let c = -1; for (let i = 0; i < N; i++) if (colorOf(i) === f) { if (c === -1) c = s[i]; else if (c !== s[i]) return false; } } return true; };
  const classOf = s => { // the same however the puzzle is held; colours are renamed in order of first appearance
    let best = null;
    for (const r of ROTS) {
      const t = apply(s, r), m = {}; let n = 0, str = '';
      for (let i = 0; i < N; i++) { if (m[t[i]] === undefined) m[t[i]] = n++; str += m[t[i]]; }
      if (best === null || str < best) best = str;
    }
    return best;
  };
  const api = { V, stickers, N, colorOf, parse, invert, run, solved, isSolved, classOf, toStr, ROTS, apply };
  if (typeof module !== 'undefined') module.exports = api; else root.Pyraminx = api;
})(typeof window !== 'undefined' ? window : globalThis);
