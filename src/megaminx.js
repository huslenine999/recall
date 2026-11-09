// Megaminx simulator built from dodecahedron geometry (no hand-written move tables).
// State: color[slot] = face index of the sticker currently in that slot.
(function (root) {
  const FACES = ['U', 'F', 'R', 'BR', 'BL', 'L', 'DR', 'DBR', 'B', 'DBL', 'DL', 'D'];
  const S5 = Math.sqrt(5);
  const normals = [];
  const az = d => (d * Math.PI) / 180;
  normals.push([0, 0, 1]);
  // upper ring: F, R, BR, BL, L (counter-clockwise from above), F faces the viewer (-y)
  [-90, -18, 54, 126, 198].forEach(a => normals.push([(2 / S5) * Math.cos(az(a)), (2 / S5) * Math.sin(az(a)), 1 / S5]));
  // lower ring: DR, DBR, B, DBL, DL
  [-54, 18, 90, 162, 234].forEach(a => normals.push([(2 / S5) * Math.cos(az(a)), (2 / S5) * Math.sin(az(a)), -1 / S5]));
  normals.push([0, 0, -1]);

  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const adj = (i, j) => i !== j && Math.abs(dot(normals[i], normals[j]) - 1 / S5) < 1e-6;

  // pieces
  const pieces = []; // {faces:[...], P:[x,y,z]}
  for (let i = 0; i < 12; i++) pieces.push({ faces: [i], P: normals[i] });
  for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) if (adj(i, j)) pieces.push({ faces: [i, j], P: add(normals[i], normals[j]) });
  for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) for (let k = j + 1; k < 12; k++)
    if (adj(i, j) && adj(j, k) && adj(i, k)) pieces.push({ faces: [i, j, k], P: add(add(normals[i], normals[j]), normals[k]) });

  const slots = []; // {piece, face}
  pieces.forEach((p, pi) => p.faces.forEach(f => slots.push({ piece: pi, face: f })));
  const key = (P, f) => P.map(v => Math.round(v * 1000)).join(',') + '|' + f;
  const slotIndex = new Map(slots.map((s, i) => [key(pieces[s.piece].P, s.face), i]));
  const nearestFace = v => { let b = 0, bd = -9; normals.forEach((n, i) => { const d = dot(n, v); if (d > bd) { bd = d; b = i; } }); return b; };

  function rotMatrix(axis, ang) {
    const [x, y, z] = axis, c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
    return [[t * x * x + c, t * x * y - s * z, t * x * z + s * y], [t * x * y + s * z, t * y * y + c, t * y * z - s * x], [t * x * z - s * y, t * y * z + s * x, t * z * z + c]];
  }
  const mul = (M, v) => [dot(M[0], v), dot(M[1], v), dot(M[2], v)];

  // perm m: sticker in slot s goes to slot m[s]
  const permCache = new Map();
  function turnPerm(face, steps, whole) {
    const ck = face + '|' + steps + '|' + !!whole;
    if (permCache.has(ck)) return permCache.get(ck);
    const r = turnPermRaw(face, steps, whole); permCache.set(ck, r); return r;
  }
  function turnPermRaw(face, steps, whole) {
    const M = rotMatrix(normals[face], (-2 * Math.PI / 5) * steps); // clockwise seen from outside
    const m = new Array(slots.length);
    slots.forEach((s, i) => {
      const P = pieces[s.piece].P;
      if (whole || dot(P, normals[face]) > 0.95) {
        const P2 = mul(M, P), f2 = nearestFace(mul(M, normals[s.face]));
        const j = slotIndex.get(key(P2, f2));
        if (j === undefined) throw new Error('slot lookup failed');
        m[i] = j;
      } else m[i] = i;
    });
    return m;
  }

  const solved = () => slots.map(s => s.face);
  const centerSlot = f => slots.findIndex(s => pieces[s.piece].faces.length === 1 && s.face === f);
  const CENTER = FACES.map((_, f) => centerSlot(f));
  function apply(st, m) { const n = st.slice(); for (let i = 0; i < m.length; i++) n[m[i]] = st[i]; return n; }

  // ---- parser ----
  // cfg maps sheet tokens: alias (dR:'DR') or a composite {seq:[{face,steps,whole}]}. expand() returns primitives {f,s,whole,tok}.
  const BASE = new Set(FACES);
  const prim = (f, s, whole, tok) => ({ f: typeof f === 'string' ? FACES.indexOf(f) : f, s, whole: !!whole, tok });
  function expand(alg, cfg) {
    cfg = cfg || {};
    const out = [];
    for (const tok of alg.trim().split(/\s+/)) {
      if (!tok) continue;
      if (cfg[tok] && cfg[tok].seq) { cfg[tok].seq.forEach(q => out.push(prim(q.face, q.steps, q.whole, tok))); continue; }
      const mm = /^(y|[A-Za-z]+?)(2'|2|3'|3|')?$/.exec(tok);
      if (!mm) throw new Error('bad token ' + tok);
      let base = mm[1], mod = mm[2] || '';
      const steps = mod === '' ? 1 : mod === "'" ? -1 : mod === '2' ? 2 : mod === "2'" ? -2 : mod === '3' ? 3 : -3;
      if (base === 'y') { out.push(prim(0, steps, true, tok)); continue; }
      if (typeof cfg[base] === 'string') base = cfg[base];
      if (!BASE.has(base)) throw new Error('unknown token ' + tok);
      out.push(prim(base, steps, false, tok));
    }
    return out;
  }
  const parse = (alg, cfg) => expand(alg, cfg).map(q => ({ tok: q.tok, m: turnPerm(q.f, q.s, q.whole) }));
  // The sheet's notation. D is the face below R (DR). L- turns everything except the R layer: whole-puzzle rotation about R, then R'.
  // (Both fixed by matching the A1+/A1- diagrams in the PDF; L-' is its inverse.)
  const SHEET_CFG = {
    dR: 'DR', bR: 'BR', D: 'DR',
    'L-': { seq: [{ face: 'R', steps: 1, whole: true }, { face: 'R', steps: -1 }] },
    "L-'": { seq: [{ face: 'R', steps: 1 }, { face: 'R', steps: -1, whole: true }] }
  };
  function run(alg, cfg, st) { let s = st || solved(); for (const mv of parse(alg, cfg)) s = apply(s, mv.m); return s; }

  // inverse alg string (tokens only; rotation tokens in cfg get inverted by caller)
  function invertTok(t) {
    if (t === 'L-') return "L-'";
    const mm = /^([A-Za-z]+?)(2'|2|3'|3|')?$/.exec(t); const mod = mm[2] || '';
    const inv = { '': "'", "'": '', '2': "2'", "2'": '2', '3': "3'", "3'": '3' }[mod];
    return mm[1] + inv;
  }
  const invert = alg => alg.trim().split(/\s+/).reverse().map(invertTok).join(' ');

  // ---- last-layer analysis ----
  const ring = [1, 2, 3, 4, 5]; // F R BR BL L  (ccw from above)
  const llEdges = ring.map(f => pieces.findIndex(p => p.faces.length === 2 && p.faces.includes(0) && p.faces.includes(f)));
  const llCorners = ring.map((f, k) => { const g = ring[(k + 1) % 5]; return pieces.findIndex(p => p.faces.length === 3 && p.faces.includes(0) && p.faces.includes(f) && p.faces.includes(g)); });
  const llSet = new Set([...llEdges, ...llCorners, pieces.findIndex(p => p.faces.length === 1 && p.faces[0] === 0)]);
  const pieceSlots = pi => slots.map((s, i) => (s.piece === pi ? i : -1)).filter(i => i >= 0);

  // returns {ok, reason, cp:[..5], ep:[..5]} ; cp[p]=home index of corner now at position p
  function analyze(st) {
    const cc = CENTER.map(i => st[i]); // color of each face's center
    if (new Set(cc).size !== 12) return { ok: false, reason: 'centers not distinct' };
    const rel = st.map(c => cc.indexOf(c));
    for (let i = 0; i < slots.length; i++) {
      if (llSet.has(slots[i].piece)) continue;
      if (rel[i] !== slots[i].face) return { ok: false, reason: 'outside LL not solved (slot ' + FACES[slots[i].face] + ' of piece ' + pieces[slots[i].piece].faces.map(f => FACES[f]).join('') + ')' };
    }
    for (let i = 0; i < slots.length; i++) if (slots[i].face === 0 && rel[i] !== 0) return { ok: false, reason: 'U sticker off U (orientation)' };
    const sideSet = pi => pieceSlots(pi).filter(i => slots[i].face !== 0).map(i => rel[i]).sort((a, b) => a - b).join(',');
    const homeOf = new Map([...llEdges, ...llCorners].map((pi, idx) => [pieces[pi].faces.filter(f => f !== 0).sort((a, b) => a - b).join(','), idx % 5]));
    const ep = llEdges.map(pi => homeOf.get(sideSet(pi)));
    const cp = llCorners.map(pi => homeOf.get(sideSet(pi)));
    if (ep.some(v => v === undefined) || cp.some(v => v === undefined)) return { ok: false, reason: 'LL piece not a valid piece' };
    if (new Set(ep).size !== 5 || new Set(cp).size !== 5) return { ok: false, reason: 'not a permutation' };
    return { ok: true, cp, ep };
  }

  // canonical class up to AUF before/after
  function canon(cp, ep) {
    let best = null;
    for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) {
      const c = cp.map((_, p) => (cp[(p + a) % 5] + b) % 5), e = ep.map((_, p) => (ep[(p + a) % 5] + b) % 5);
      const k = c.join('') + e.join('');
      if (best === null || k < best) best = k;
    }
    return best;
  }
  const parity = p => { let s = 0; const v = p.slice(); for (let i = 0; i < v.length; i++) while (v[i] !== i) { const j = v[i]; [v[i], v[j]] = [v[j], v[i]]; s ^= 1; } return s; };
  const invPerm = p => { const r = []; p.forEach((v, i) => (r[v] = i)); return r; };

  // colors relative to centers (solved = rel[slot] === slot's face)
  function rel(st) { const cc = CENTER.map(i => st[i]); return st.map(c => cc.indexOf(c)); }
  const slotOf = (pi, f) => slots.findIndex(s => s.piece === pi && s.face === f);


  // ---- OLL: a case is where the U-coloured stickers sit on the last layer (F2L solved, permutation ignored) ----
  // pat[k] = 5 flags for ring position k: edge U sticker, edge side sticker, corner U sticker, corner side sticker on face k, corner side sticker on face k+1.
  // cls is the same pattern turned to its smallest form, so every AUF of a case gives the same cls.
  function ollPattern(st) {
    const cc = CENTER.map(i => st[i]);
    if (new Set(cc).size !== 12) return { ok: false, reason: 'centers not distinct' };
    const r = st.map(c => cc.indexOf(c));
    for (let i = 0; i < slots.length; i++) {
      if (llSet.has(slots[i].piece)) continue;
      if (r[i] !== slots[i].face) return { ok: false, reason: 'F2L is not solved by this alg (slot ' + FACES[slots[i].face] + ' of piece ' + pieces[slots[i].piece].faces.map(f => FACES[f]).join('') + ')' };
    }
    const pat = ring.map((f, k) => {
      const e = llEdges[k], c = llCorners[k], g = ring[(k + 1) % 5];
      return [r[slotOf(e, 0)], r[slotOf(e, f)], r[slotOf(c, 0)], r[slotOf(c, f)], r[slotOf(c, g)]].map(v => (v === 0 ? 1 : 0)).join('');
    });
    let cls = null;
    for (let k = 0; k < 5; k++) { const key = pat.map((_, i) => pat[(i + k) % 5]).join(''); if (cls === null || key < cls) cls = key; }
    return { ok: true, pat, cls };
  }

  const api = { ollPattern, rel, slotOf, ring, llEdges, llCorners, FACES, normals, pieces, slots, solved, apply, parse, expand, SHEET_CFG, run, invert, analyze, canon, parity, invPerm, turnPerm, CENTER };
  if (typeof module !== 'undefined') module.exports = api; else root.Megaminx = api;
})(typeof window !== 'undefined' ? window : globalThis);
