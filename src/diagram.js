// Case diagrams drawn from simulator state (no hand-drawn cases). Needs Megaminx / Square1 globals.
// Style follows the Macdiarmid sheet: dark rounded pieces, a tapered row of colored stickers around
// the face, thin yellow double-headed arrows.
(function (root) {
  const M = root.Megaminx || require('./megaminx.js');
  const S = root.Square1 || require('./square1.js');
  const f1 = n => Math.round(n * 10) / 10;
  let uid = 0;
  const INK = '#101012';

  // ---------- drawing helpers ----------
  const lerp = (A, B, t) => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];
  const centroid = P => [P.reduce((s, p) => s + p[0], 0) / P.length, P.reduce((s, p) => s + p[1], 0) / P.length];
  const lum = hex => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };

  // closed path through P with every corner rounded by radius r
  function rpath(P, r) {
    const n = P.length; let d = '';
    for (let i = 0; i < n; i++) {
      const p0 = P[(i + n - 1) % n], p1 = P[i], p2 = P[(i + 1) % n];
      const v1 = [p0[0] - p1[0], p0[1] - p1[1]], v2 = [p2[0] - p1[0], p2[1] - p1[1]];
      const l1 = Math.hypot(v1[0], v1[1]) || 1, l2 = Math.hypot(v2[0], v2[1]) || 1;
      const k1 = Math.min(r, l1 / 2.2) / l1, k2 = Math.min(r, l2 / 2.2) / l2;
      const a = [p1[0] + v1[0] * k1, p1[1] + v1[1] * k1], b = [p1[0] + v2[0] * k2, p1[1] + v2[1] * k2];
      d += (i ? 'L' : 'M') + f1(a[0]) + ',' + f1(a[1]) + 'Q' + f1(p1[0]) + ',' + f1(p1[1]) + ' ' + f1(b[0]) + ',' + f1(b[1]);
    }
    return d + 'Z';
  }
  const shape = (P, fill, r, sw) => `<path d="${rpath(P, r)}" fill="${fill}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>`;

  // sticker on the segment A->B, pushed outward by T along n; the outer corners are pulled in by s0 (at A) and s1 (at B)
  function tile(A, B, n, T, s0, s1) {
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1, u = [(B[0] - A[0]) / L, (B[1] - A[1]) / L];
    return [A, B, [B[0] + n[0] * T - u[0] * s1, B[1] + n[1] * T - u[1] * s1], [A[0] + n[0] * T + u[0] * s0, A[1] + n[1] * T + u[1] * s0]];
  }
  // petal: sits on point C0, grows along n, wb wide at the base and wf wide at the far end, h tall
  function petal(C0, n, wb, wf, h) {
    const u = [-n[1], n[0]];
    return [[C0[0] - u[0] * wb / 2, C0[1] - u[1] * wb / 2], [C0[0] + u[0] * wb / 2, C0[1] + u[1] * wb / 2],
      [C0[0] + n[0] * h + u[0] * wf / 2, C0[1] + n[1] * h + u[1] * wf / 2], [C0[0] + n[0] * h - u[0] * wf / 2, C0[1] + n[1] * h - u[1] * wf / 2]];
  }
  function arrowPath(a, b, bend) {
    if (!bend) return `M${f1(a[0])},${f1(a[1])} L${f1(b[0])},${f1(b[1])}`;
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], k = bend;
    return `M${f1(a[0])},${f1(a[1])} Q${f1(mx - dy * k)},${f1(my + dx * k)} ${f1(b[0])},${f1(b[1])}`;
  }
  const marker = (id, ink) => `<marker id="${id}" viewBox="0 0 10 10" refX="7.5" refY="5" markerUnits="userSpaceOnUse" markerWidth="7.5" markerHeight="7.5" orient="auto-start-reverse"><path d="M0,0.5 L10,5 L0,9.5 z" fill="${ink}"/></marker>`;
  // an arrow from piece centre a to piece centre b; swaps get a head at both ends, cycles curve
  function arrow(a, b, swap, id, ink, trim, outline) {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, s = trim / d;
    const a2 = lerp(a, b, s), b2 = lerp(a, b, 1 - s), p = arrowPath(a2, b2, swap ? 0 : 0.2);
    const under = outline ? `<path d="${p}" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>` : '';
    return under + `<path d="${p}" fill="none" stroke="${ink}" stroke-width="2.1" stroke-linecap="round" marker-end="url(#${id})" ${swap ? `marker-start="url(#${id})"` : ''}/>`;
  }
  function viewBoxOf(polys, m) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    polys.forEach(P => P.forEach(p => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }));
    return [f1(x0 - m), f1(y0 - m), f1(x1 - x0 + 2 * m), f1(y1 - y0 + 2 * m)];
  }

  // offset a closed polygon V outward by T with mitred corners: returns O where O[j] belongs to vertex V[j].
  // Adjacent stickers share a mitre line, so a ring of stickers has no gaps and no overlaps.
  function ringOffset(V, T, c) {
    const m = V.length, nrm = [];
    for (let j = 0; j < m; j++) {
      const A = V[j], B = V[(j + 1) % m], dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy) || 1;
      let n = [dy / l, -dx / l]; if (n[0] * ((A[0] + B[0]) / 2 - c[0]) + n[1] * ((A[1] + B[1]) / 2 - c[1]) < 0) n = [-n[0], -n[1]];
      nrm.push(n);
    }
    return V.map((v, j) => { const n1 = nrm[(j + m - 1) % m], n2 = nrm[j], k = T / Math.max(0.25, 1 + n1[0] * n2[0] + n1[1] * n2[1]); return [v[0] + (n1[0] + n2[0]) * k, v[1] + (n1[1] + n2[1]) * k]; });
  }

  // ---------- Megaminx ----------
  const MM_CFG = M.SHEET_CFG;
  // default colors are sampled from the Macdiarmid sheet; index = M.FACES order: U F R BR BL L DR DBR B DBL DL D
  const MM_DEFAULT_COLORS = ['#3d3d3d', '#77d540', '#e38d89', '#ecf087', '#71a6eb', '#ef8e36', '#b8e23a', '#8fd3f4', '#a56ad8', '#e7e7e7', '#c94c8a', '#f4f4f4'];

  const R = 70, T = 14;
  const vert = k => { const a = ((-54 + 72 * (((k % 5) + 5) % 5)) * Math.PI) / 180; return [R * Math.cos(a), -R * Math.sin(a)]; };
  const cin = k => { const v = vert(k); return [v[0] * 0.37, v[1] * 0.37]; };   // corner of the centre pentagon
  const sideP = (i, t) => lerp(vert(i - 1), vert(i), t);                          // side i runs from vert(i-1) to vert(i); side 0 is the bottom (F)
  const norm = i => { const m = lerp(vert(i - 1), vert(i), 0.5), l = Math.hypot(m[0], m[1]); return [m[0] / l, m[1] / l]; };
  const SIDE_LEN = 2 * R * Math.sin(Math.PI / 5);
  const mod5 = k => ((k % 5) + 5) % 5;
  // dark pieces of the U face (11): centre, 5 edges, 5 corners
  
  // the U face as on the sheet: centre pentagon, 5 edge pieces (narrow at the rim, wide against the centre)
  // and 5 kite-shaped corner pieces; together they fill the whole pentagon
  const EA = 0.43, EB = 0.57;
  const mmCenter = [0, 1, 2, 3, 4].map(cin);
  const mmEdgeP = i => [sideP(i, EA), sideP(i, EB), cin(i), cin(i - 1)];
  const mmCornerP = k => [cin(k), sideP(k, EB), vert(k), sideP(k + 1, EA)];
  // geometry that does not depend on the case: a mitred strip of three stickers along each side
  const mmGeom = (() => {
    const V = [0, 1, 2, 3, 4].map(vert), O = ringOffset(V, T, [0, 0]), tiles = [];
    for (let i = 0; i < 5; i++) {
      const I0 = vert(i - 1), I3 = vert(i), O0 = O[mod5(i - 1)], O3 = O[i];
      const I1 = lerp(I0, I3, EA), I2 = lerp(I0, I3, EB), O1 = lerp(O0, O3, 0.35), O2 = lerp(O0, O3, 0.65);
      tiles.push({ i, j: 0, poly: [I0, I1, O1, O0] }, { i, j: 1, poly: [I1, I2, O2, O1] }, { i, j: 2, poly: [I2, I3, O3, O2] });
    }
    return { tiles, vb: viewBoxOf(tiles.map(t => t.poly), 3) };
  })();

  // returns svg string, or null if the alg cannot be simulated / is not a valid PLL
  function megaminxDiagram(alg, colors, opts) {
    colors = colors || MM_DEFAULT_COLORS; opts = opts || {};
    let st, an;
    try { st = M.run(M.invert(alg), MM_CFG); an = M.analyze(st); } catch (e) { return null; }
    if (!an.ok) return null;
    const rel = M.rel(st), id = 'mm' + (uid++);
    const uCol = colors[0], ink = lum(uCol) > 0.6 ? '#111' : '#ffe94d';
    let g = '';
    // stickers of the side faces: tile j of side i belongs to corner (i-1), edge i, corner i
    const piece = (i, j) => (j === 0 ? M.llCorners[mod5(i - 1)] : j === 1 ? M.llEdges[i] : M.llCorners[i]);
    mmGeom.tiles.forEach(t => { g += shape(t.poly, colors[rel[M.slotOf(piece(t.i, t.j), M.ring[t.i])]], 3, 2.4); });
    // the U face: a black body with the pieces on it
    g += shape([0, 1, 2, 3, 4].map(vert), INK, 3, 2.6);
    const edgeCen = [], cornerCen = [];
    for (let i = 0; i < 5; i++) { const P = mmEdgeP(i); edgeCen[i] = centroid(P); g += shape(P, uCol, 6, 2.4); }
    for (let k = 0; k < 5; k++) { const P = mmCornerP(k); cornerCen[k] = centroid(P); g += shape(P, uCol, 6, 2.4); }
    g += shape(mmCenter, uCol, 9, 2.4);
    // arrows: the piece at position p belongs at position perm[p]
    let arrows = '';
    const draw = (perm, pos) => {
      for (let p = 0; p < 5; p++) {
        const q = perm[p]; if (q === p) continue;
        const swap = perm[q] === p;
        if (swap && p > q) continue;
        arrows += arrow(pos[p], pos[q], swap, id, ink, 5);
      }
    };
    if (opts.arrows !== false) { draw(an.ep, edgeCen); draw(an.cp, cornerCen); }
    const vb = mmGeom.vb;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}" class="diagram mm" role="img" aria-label="${opts.label || 'PLL case'}"><defs>${marker(id, ink)}</defs>${g}${arrows}</svg>`;
  }


  // OLL: the same last layer, drawn the way OLL sheets do: yellow where a sticker has the U colour, dark where it does not (no arrows).
  const OLL_ON = '#f4d83a', OLL_OFF = '#2e2e36';
  function megaminxOllDiagram(alg, opts) {
    opts = opts || {};
    let st; try { st = M.run(M.invert(alg), MM_CFG); } catch (e) { return null; }
    const o = M.ollPattern(st); if (!o.ok) return null;
    const rel = M.rel(st);
    const col = (pi, f) => (rel[M.slotOf(pi, f)] === 0 ? OLL_ON : OLL_OFF);
    const piece = (i, j) => (j === 0 ? M.llCorners[mod5(i - 1)] : j === 1 ? M.llEdges[i] : M.llCorners[i]);
    let g = '';
    mmGeom.tiles.forEach(t => { g += shape(t.poly, col(piece(t.i, t.j), M.ring[t.i]), 3, 2.4); });
    g += shape([0, 1, 2, 3, 4].map(vert), INK, 3, 2.6);
    for (let i = 0; i < 5; i++) g += shape(mmEdgeP(i), col(M.llEdges[i], 0), 6, 2.4);
    for (let k = 0; k < 5; k++) g += shape(mmCornerP(k), col(M.llCorners[k], 0), 6, 2.4);
    g += shape(mmCenter, OLL_ON, 9, 2.4);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${mmGeom.vb.join(' ')}" class="diagram mm" role="img" aria-label="${opts.label || 'OLL case'}">${g}</svg>`;
  }

  // ---------- Square-1 ----------
  // Two square layers (U above, D below) with the slice drawn as a red line through both, like the reference picture.
  // Dark pieces carry the U colour, white pieces the D colour, so an edge sitting in the wrong layer shows up at once.
  // side faces 0..3 clockwise, starting with the face on the right of the top layer: green, red, blue, orange
  const SQ_COLORS = { face: '#232325', faceD: '#ffffff', sides: ['#3fa72a', '#d02a1f', '#2740d4', '#f08a1c'] };
  const rad = d => (d * Math.PI) / 180;
  const sqPt = (cx, cy, r, aDeg) => [cx + r * Math.sin(rad(aDeg)), cy - r * Math.cos(rad(aDeg))];

  function alignLayer(L, c0) {
    let c = L.indexOf(c0); while (L[(c + 11) % 12] === c0) c = (c + 11) % 12;
    return L.map((_, i) => L[(i + c) % 12]); // R[i] = L[i + c]
  }

  const SQ_A = 84 * Math.SQRT1_2, SQ_T = 9;   // apothem of the square, thickness of the sticker strip
  // sharp-cornered polygon
  const sharp = (P, fill, sw) => `<polygon points="${P.map(p => f1(p[0]) + ',' + f1(p[1])).join(' ')}" fill="${fill}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="miter" stroke-miterlimit="4"/>`;
  const markerO = (id, ink) => `<marker id="${id}" viewBox="0 0 10 10" refX="7.5" refY="5" markerUnits="userSpaceOnUse" markerWidth="8.5" markerHeight="8.5" orient="auto-start-reverse"><path d="M0,0.5 L10,5 L0,9.5 z" fill="${ink}" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/></marker>`;

  // One layer. Pieces sit on boundary points at radius SH_RE; a corner's tip reaches SH_RC. For a square layer this is the
  // familiar square; other layers (CSP shapes) come out with kites and wedges. opt.neutral = {fill, sticker} draws a
  // colourless layer; opt.arrows === false leaves out the misplaced-edge arrows.
  const SH_RE = SQ_A / Math.cos(rad(15)), SH_RC = 84;
  function sqLayer(L, cx, cy, colors, markerId, ink, opt) {
    opt = opt || {};
    const T = SQ_T, C = [cx, cy];
    const rim = a => sqPt(cx, cy, SH_RE, a);
    const V = [], col = [];
    let pieces = '';
    for (let i = 0; i < 12; i++) {
      const id = L[i], a0 = i * 30, k = id % 4, isU = id < 4 || (id >= 8 && id < 12);
      const fill = opt.neutral ? opt.neutral.fill : isU ? colors.face : colors.faceD;
      const side = j => (opt.neutral ? opt.neutral.sticker : opt.orient ? fill : colors.sides[j]); // OBL: a piece is just top or bottom colour
      if (id >= 8) { // edge: one wedge, one sticker
        V.push(rim(a0)); col.push(side(k));
        pieces += sharp([C, rim(a0), rim(a0 + 30)], fill, 2.2);
      } else if (L[(i + 11) % 12] !== id) { // first slot of a corner: kite wedge, two stickers
        const tip = sqPt(cx, cy, SH_RC, a0 + 30);
        V.push(rim(a0), tip); col.push(side((k + 3) % 4), side(k));
        pieces += sharp([C, rim(a0), tip, rim(a0 + 60)], fill, 2.2);
      }
    }
    const O = ringOffset(V, T, C);
    let tiles = '';
    V.forEach((v, j) => { const q = (j + 1) % V.length; tiles += sharp([v, V[q], O[q], O[j]], col[j], 2.2); });
    if (opt.arrows === false || opt.neutral) return tiles + pieces;
    // arrows for misplaced edges (current slot -> home slot)
    const where = {}; for (let i = 0; i < 12; i++) if (L[i] >= 8) where[L[i]] = i;
    const moves = {}; Object.keys(where).forEach(id => { const h = 3 * (id % 4) + 2; if (h !== where[id]) moves[where[id]] = h; });
    const pos = sl => { const a = sl * 30 + 15; return sqPt(cx, cy, 0.6 * SQ_A, a); };
    let ar = '';
    for (const p of Object.keys(moves).map(Number)) {
      const q = moves[p], swap = moves[q] === p;
      if (swap && p > q) continue;
      ar += arrow(pos(p), pos(q), swap, markerId, ink, 4, true);
    }
    return tiles + pieces + ar;
  }

  // The two layers side by side. U is drawn as seen from above, D as seen from below (mirrored), the usual way to show a Square-1
  // state. The slice is marked by a thin line behind the pieces, so it only shows above and below each layer. flipped === null: no badge.
  const CY = 128, CXU = 100, CXD = 300;
  function sqFrame(gU, gD, flipped, label, cls, defs) {
    const slice = cx => `<line x1="${cx}" y1="${CY - 91}" x2="${cx}" y2="${CY + 91}" stroke="#e0323b" stroke-width="2.2" stroke-linecap="round" opacity=".7"/>`;
    const head = (cx, letter, word) => `<text x="${cx}" y="30" text-anchor="middle" fill="currentColor"><tspan font-size="30" font-weight="800">${letter}</tspan><tspan dx="8" font-size="15" font-weight="600" opacity=".75">${word}</tspan></text>`;
    const g = gU + `<g transform="translate(0 ${2 * CY}) scale(1 -1)">${gD}</g>`;
    const pillW = 130, pill = flipped === null ? '' : `<rect x="${200 - pillW / 2}" y="236" width="${pillW}" height="26" rx="13" fill="${flipped ? '#c9373f' : '#2f8a4f'}"/><text x="200" y="254" text-anchor="middle" font-size="14" font-weight="650" fill="#fff">middle ${flipped ? 'flipped' : 'square'}</text>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 270" class="diagram sq ${cls || ''}" role="img" aria-label="${label}"><defs>${defs || ''}</defs>${slice(CXU)}${slice(CXD)}${g}${head(CXU, 'U', 'top layer')}${head(CXD, 'D', 'bottom layer')}${pill}</svg>`;
  }

  // alg: an alg that solves the case; the middle layer state comes from the simulation
  function square1Diagram(alg, colors, opts) {
    colors = Object.assign({}, SQ_COLORS, colors || {}); opts = opts || {};
    let st;
    try { st = S.caseState(alg); } catch (e) { return null; }
    const id = 'sq' + (uid++);
    const top = alignLayer(st.top, 0), bot = alignLayer(st.bot, 4);
    const ink = '#ffe94d';
    return sqFrame(sqLayer(top, CXU, CY, colors, id, ink), sqLayer(bot, CXD, CY, colors, id, ink), !!st.flip, opts.label || 'Square-1 EP case', '', markerO(id, ink));
  }

  // CSP cases are about shape only: neutral pieces and stickers, drawn in the positions the reversed alg gives
  const CSP_LOOK = { U: { fill: '#2c2c31', sticker: '#8f8fa0' }, D: { fill: '#f2f2f6', sticker: '#a9a9b8' } };
  // alg: the CSP alg (shape -> cube shape); key: the case's shape key, so an alg that fits two shapes draws the labelled one
  function cspDiagram(alg, key, opts) {
    opts = opts || {};
    let st;
    try { st = S.cspState(alg, key); } catch (e) { return null; }
    if (!st) return null;
    return sqFrame(sqLayer(st.top, CXU, CY, null, '', '', { neutral: CSP_LOOK.U }), sqLayer(st.bot, CXD, CY, null, '', '', { neutral: CSP_LOOK.D }), !!st.flip, opts.label || 'Square-1 CSP case', 'csp');
  }

  // PBL: cube shape, every piece coloured. The layers are turned to whichever of their four positions leaves the most pieces at home
  // (the case is the same after turning either layer).
  function bestTurn(L, cb, eb) {
    let s = -1;
    for (let i = 0; i < 12; i++) if (L[i] === L[(i + 1) % 12] && L[(i + 11) % 12] !== L[i] && L[i] < 8) { s = i; break; }
    if (s < 0) return L;
    let best = null, bestScore = -1;
    for (let r = 0; r < 4; r++) {
      const R = L.map((_, i) => L[(i + s + 3 * r) % 12]);
      let sc = 0; for (let k = 0; k < 4; k++) { if (R[3 * k] === cb + k) sc++; if (R[3 * k + 2] === eb + k) sc++; }
      if (sc > bestScore) { bestScore = sc; best = R; }
    }
    return best;
  }
  function pblDiagram(alg, colors, opts) {
    colors = Object.assign({}, SQ_COLORS, colors || {}); opts = opts || {};
    let st;
    try { st = S.cspState(alg); } catch (e) { return null; }
    if (!st) return null;
    return sqFrame(sqLayer(bestTurn(st.top, 0, 8), CXU, CY, colors, '', '', { arrows: false }), sqLayer(bestTurn(st.bot, 4, 12), CXD, CY, colors, '', '', { arrows: false }), null, opts.label || 'Square-1 PBL case', 'pbl');
  }

  // OBL: cube shape, each piece only in its layer's colour (U colour or D colour); which slot is which piece does not matter yet
  function oblDiagram(alg, colors, opts) {
    colors = Object.assign({}, SQ_COLORS, colors || {}); opts = opts || {};
    let st;
    try { st = S.cspState(alg, 'CCECCECCECCE/CCECCECCECCE'); } catch (e) { return null; }
    if (!st) return null;
    return sqFrame(sqLayer(st.top, CXU, CY, colors, '', '', { arrows: false, orient: true }), sqLayer(st.bot, CXD, CY, colors, '', '', { arrows: false, orient: true }), null, opts.label || 'Square-1 OBL case', 'obl');
  }


  // ---------- Skewb and Pyraminx: drawn from the simulator's sticker colours, two views each ----------
  const SK = root.Skewb || require('./skewb.js');
  const PY = root.Pyraminx || require('./pyraminx.js');
  const SKEWB_COLORS = ['#f04a3c', '#f58a24', '#f4f4f1', '#f7cf3d', '#2fbf6b', '#4a86f5']; // by face R L U D F B: red, orange, white, yellow, green, blue
  const PYRA_COLORS = ['#2fbf6b', '#f04a3c', '#4a86f5', '#f7cf3d']; // green, red, blue, yellow
  const vsub = (a, b) => a.map((x, i) => x - b[i]);
  const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const vunit = a => { const l = Math.hypot(a[0], a[1], a[2]); return a.map(x => x / l); };
  // draws sticker polygons [{poly: [[x, y]...], fill}] of several views side by side
  function viewsSvg(views, scale, gap, label, cls, r, sw) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, body = '';
    views.forEach(v => v.forEach(s => s.poly.forEach(p => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); })));
    const w = x1 - x0, h = y1 - y0; let ox = 0;
    // every view is centred in its own box; the boxes share one height
    views.forEach(v => {
      let a0 = Infinity, a1 = -Infinity; v.forEach(s => s.poly.forEach(p => { a0 = Math.min(a0, p[0]); a1 = Math.max(a1, p[0]); }));
      const dx = ox - a0, dy = -y0;
      body += v.map(s => shape(s.poly.map(p => [(p[0] + dx) * scale, (p[1] + dy) * scale]), s.fill, r, sw)).join('');
      ox += a1 - a0 + gap;
    });
    const W = (ox - gap) * scale, H = h * scale, m = sw;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f1(-m)} ${f1(-m)} ${f1(W + 2 * m)} ${f1(H + 2 * m)}" class="diagram ${cls}" role="img" aria-label="${label}">${body}</svg>`;
  }
  // state: the 30 sticker colours of the Skewb (what Skewb.run gives for the case's setup)
  const SK_VIEWS = [{ viewer: [1, 1, 1], right: [1, 0, -1] }, { viewer: [-1, -1, -1], right: [-1, 0, 1] }];
  function skewbDiagram(state, opts) {
    opts = opts || {};
    const up = vunit([-1, 2, -1]);
    const views = SK_VIEWS.map(v => {
      const right = vunit(v.right), out = [];
      SK.stickers.forEach((st, i) => {
        if (vdot(st.n, v.viewer) <= 0) return;
        const n = st.n, ax = [0, 1, 2].filter(k => !n[k]); // the two axes along the face
        let pts;
        if (st.p.every((c, k) => c === n[k])) { const e = ax.map(k => { const u = [0, 0, 0]; u[k] = 1; return u; }); pts = [[1, 0], [0, 1], [-1, 0], [0, -1]].map(([a, b]) => n.map((c, k) => c + a * e[0][k] + b * e[1][k])); } // a center: the diamond between the four edge midpoints
        else pts = [st.p, st.p.map((c, k) => (k === ax[1] ? 0 : c)), st.p.map((c, k) => (k === ax[0] ? 0 : c))]; // a corner: the cube corner and the two edge midpoints next to it
        out.push({ poly: pts.map(q => [vdot(q, right), -vdot(q, up)]), fill: opts.colors ? opts.colors[state[i]] : SKEWB_COLORS[state[i]] });
      });
      return out;
    });
    return viewsSvg(views, 46, 0.5, opts.label || 'Skewb case', 'skewb', 2.4, 2.2);
  }
  // state: the 36 sticker colours of the Pyraminx. Left: the three faces around the top tip. Right: the face opposite it.
  function pyraminxDiagram(state, opts) {
    opts = opts || {};
    const axisOf = dir => vunit(PY.V.U.map(c => c * dir));
    const make = (dir) => {
      const axis = axisOf(dir); let up = PY.V.B.map(c => c * dir); up = vunit(up.map((c, i) => c - vdot(up, axis) * axis[i]));
      const right = vcross(up, axis), out = [];
      PY.stickers.forEach((st, i) => {
        if (vdot(st.n, axis) <= 0) return;
        out.push({ poly: st.verts.map(q => [vdot(q, right), -vdot(q, up)]), fill: opts.colors ? opts.colors[state[i]] : PYRA_COLORS[state[i]] });
      });
      return out;
    };
    return viewsSvg([make(1), make(-1)], 46, 0.55, opts.label || 'Pyraminx case', 'pyra', 1.6, 1.5);
  }

  const api = { skewbDiagram, pyraminxDiagram, SKEWB_COLORS, PYRA_COLORS, oblDiagram, megaminxDiagram, megaminxOllDiagram, square1Diagram, cspDiagram, pblDiagram, MM_DEFAULT_COLORS, SQ_COLORS, MM_CFG };
  if (typeof module !== 'undefined') module.exports = api; else root.Diagram = api;
})(typeof window !== 'undefined' ? window : globalThis);
