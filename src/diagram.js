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

  function sqLayer(L, cx, cy, colors, markerId, ink) {
    const A = SQ_A, T = SQ_T, C = [cx, cy];
    // distance from the centre to the square's outline in direction th (corners sit at 30, 120, 210, 300 degrees)
    const rimR = th => { let d = (((th - 75) % 90) + 90) % 90; if (d > 45) d -= 90; return A / Math.cos(rad(d)); };
    const rim = a => sqPt(cx, cy, rimR(a), a);
    const V = [], col = [];
    let pieces = '';
    for (let i = 0; i < 12; i++) {
      const id = L[i], a0 = i * 30, k = id % 4, isU = id < 4 || (id >= 8 && id < 12);
      const fill = isU ? colors.face : colors.faceD;
      if (id >= 8) { // edge: one wedge, one sticker
        V.push(rim(a0)); col.push(colors.sides[k]);
        pieces += sharp([C, rim(a0), rim(a0 + 30)], fill, 2.2);
      } else if (L[(i + 11) % 12] !== id) { // first slot of a corner: kite wedge, two stickers
        const tip = sqPt(cx, cy, rimR(a0 + 30), a0 + 30);
        V.push(rim(a0), tip); col.push(colors.sides[(k + 3) % 4], colors.sides[k]);
        pieces += sharp([C, rim(a0), tip, rim(a0 + 60)], fill, 2.2);
      }
    }
    const O = ringOffset(V, T, C);
    let tiles = '';
    V.forEach((v, j) => { const q = (j + 1) % V.length; tiles += sharp([v, V[q], O[q], O[j]], col[j], 2.2); });
    // arrows for misplaced edges (current slot -> home slot)
    const where = {}; for (let i = 0; i < 12; i++) if (L[i] >= 8) where[L[i]] = i;
    const moves = {}; Object.keys(where).forEach(id => { const h = 3 * (id % 4) + 2; if (h !== where[id]) moves[where[id]] = h; });
    const pos = sl => { const a = sl * 30 + 15; return sqPt(cx, cy, 0.6 * rimR(a), a); };
    let ar = '';
    for (const p of Object.keys(moves).map(Number)) {
      const q = moves[p], swap = moves[q] === p;
      if (swap && p > q) continue;
      ar += arrow(pos(p), pos(q), swap, markerId, ink, 4, true);
    }
    return tiles + pieces + ar;
  }

  // alg: an alg that solves the case; the middle layer state comes from the simulation
  // U and D sit side by side; D is drawn as seen from below (mirrored), the usual way to show a Square-1 state
  function square1Diagram(alg, colors, opts) {
    colors = Object.assign({}, SQ_COLORS, colors || {}); opts = opts || {};
    let st;
    try { st = S.caseState(alg); } catch (e) { return null; }
    const id = 'sq' + (uid++);
    const top = alignLayer(st.top, 0), bot = alignLayer(st.bot, 4);
    const ink = '#ffe94d', cy = 128, cxU = 100, cxD = 300;
    const flipped = !!st.flip;
    const slice = cx => `<line x1="${cx}" y1="${cy - 90}" x2="${cx}" y2="${cy + 90}" stroke="#e0323b" stroke-width="3.4" stroke-linecap="round"/>`;
    const head = (cx, letter, word) => `<text x="${cx}" y="30" text-anchor="middle" fill="currentColor"><tspan font-size="30" font-weight="800">${letter}</tspan><tspan dx="8" font-size="15" font-weight="600" opacity=".75">${word}</tspan></text>`;
    const g = sqLayer(top, cxU, cy, colors, id, ink) + `<g transform="translate(0 ${2 * cy}) scale(1 -1)">${sqLayer(bot, cxD, cy, colors, id, ink)}</g>`;
    const pillW = 130, pill = `<rect x="${200 - pillW / 2}" y="236" width="${pillW}" height="26" rx="13" fill="${flipped ? '#c9373f' : '#2f8a4f'}"/><text x="200" y="254" text-anchor="middle" font-size="14" font-weight="650" fill="#fff">middle ${flipped ? 'flipped' : 'square'}</text>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 270" class="diagram sq" role="img" aria-label="${opts.label || 'Square-1 EP case'}"><defs>${markerO(id, ink)}</defs>${g}${slice(cxU)}${slice(cxD)}${head(cxU, 'U', 'top layer')}${head(cxD, 'D', 'bottom layer')}${pill}</svg>`;
  }

  const api = { megaminxDiagram, square1Diagram, MM_DEFAULT_COLORS, SQ_COLORS, MM_CFG };
  if (typeof module !== 'undefined') module.exports = api; else root.Diagram = api;
})(typeof window !== 'undefined' ? window : globalThis);
