// Case diagrams drawn from simulator state (no hand-drawn cases). Needs Megaminx / Square1 globals.
(function (root) {
  const M = root.Megaminx || require('./megaminx.js');
  const S = root.Square1 || require('./square1.js');
  const f1 = n => Math.round(n * 10) / 10;
  let uid = 0;

  // ---------- Megaminx ----------
  const MM_CFG = M.SHEET_CFG;
  // default colors follow the Macdiarmid sheet; index = M.FACES order: U F R BR BL L DR DBR B DBL DL D
  const MM_DEFAULT_COLORS = ['#3b3b3b', '#2fb82f', '#f08a8a', '#e9ea6a', '#4c8df0', '#ff8a00', '#b8e23a', '#8fd3f4', '#a56ad8', '#e7e7e7', '#c94c8a', '#f4f4f4'];
  const lum = hex => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };

  function arrowPath(a, b, bend) {
    if (!bend) return `M${f1(a[0])},${f1(a[1])} L${f1(b[0])},${f1(b[1])}`;
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], k = bend;
    return `M${f1(a[0])},${f1(a[1])} Q${f1(mx - dy * k)},${f1(my + dx * k)} ${f1(b[0])},${f1(b[1])}`;
  }

  // returns svg string, or null if the alg cannot be simulated / is not a valid PLL
  function megaminxDiagram(alg, colors, opts) {
    colors = colors || MM_DEFAULT_COLORS; opts = opts || {};
    let st, an;
    try { st = M.run(M.invert(alg), MM_CFG); an = M.analyze(st); } catch (e) { return null; }
    if (!an.ok) return null;
    const rel = M.rel(st);
    const id = 'mm' + (uid++);
    const cx = 100, cy = 100, R = 50, T = 17;
    const az = k => (-90 + 72 * k) * Math.PI / 180;
    const vert = k => { const a = ((-54 + 72 * (((k % 5) + 5) % 5)) * Math.PI) / 180; return [cx + R * Math.cos(a), cy - R * Math.sin(a)]; };
    const uCol = colors[0];
    const ink = lum(uCol) > 0.6 ? '#111' : '#ffe14a';
    let g = '';
    const poly = (pts, fill) => `<polygon points="${pts.map(p => f1(p[0]) + ',' + f1(p[1])).join(' ')}" fill="${fill}" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/>`;
    // pentagon
    g += poly([0, 1, 2, 3, 4].map(vert), uCol);
    const ranges = [[0, 0.31], [0.34, 0.66], [0.69, 1]];
    for (let i = 0; i < 5; i++) {
      const A = vert(i - 1), B = vert(i), n = [Math.cos(az(i)), -Math.sin(az(i))];
      const P = t => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];
      const stick = (r, piece) => {
        const slot = M.slotOf(piece, M.ring[i]);
        const p1 = P(r[0]), p2 = P(r[1]);
        return poly([p1, p2, [p2[0] + n[0] * T, p2[1] + n[1] * T], [p1[0] + n[0] * T, p1[1] + n[1] * T]], colors[rel[slot]]);
      };
      g += stick(ranges[0], M.llCorners[(i + 4) % 5]) + stick(ranges[1], M.llEdges[i]) + stick(ranges[2], M.llCorners[i]);
    }
    // arrows: piece at position p has home an.xp[p]
    const mid = k => { const A = vert(k - 1), B = vert(k); return [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2]; };
    const inward = (p, f) => [cx + (p[0] - cx) * f, cy + (p[1] - cy) * f];
    let arrows = '';
    const draw = (perm, pos, dashed, f) => {
      for (let p = 0; p < 5; p++) {
        const q = perm[p]; if (q === p) continue;
        const swap = perm[q] === p;
        if (swap && p > q) continue;
        const a = inward(pos(p), f), b = inward(pos(q), f);
        // shorten so heads sit inside the pentagon
        const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, s = 5 / d;
        const a2 = [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s], b2 = [b[0] - (b[0] - a[0]) * s, b[1] - (b[1] - a[1]) * s];
        arrows += `<path d="${arrowPath(swap ? a2 : a, swap ? b2 : b, swap ? 0 : 0.18)}" fill="none" stroke="${ink}" stroke-width="2.4" ${dashed ? 'stroke-dasharray="5 3.5"' : ''} marker-end="url(#${id}h)" ${swap ? `marker-start="url(#${id}t)"` : ''} stroke-linecap="round"/>`;
      }
    };
    draw(an.ep, mid, false, 0.62);
    draw(an.cp, vert, true, 0.66);
    const defs = `<defs><marker id="${id}h" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${ink}"/></marker><marker id="${id}t" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${ink}"/></marker></defs>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="26 26 148 148" class="diagram mm" role="img" aria-label="${opts.label || 'PLL case'}">${defs}${g}${arrows}</svg>`;
  }

  // ---------- Square-1 ----------
  const SQ_COLORS = { top: '#f2f2f2', bottom: '#f0d83a', sides: ['#e24b4b', '#3a78e0', '#f08a1a', '#35b535'] }; // side faces 0..3 clockwise from top
  const rad = d => (d * Math.PI) / 180;
  const pt = (cx, cy, r, aDeg) => [cx + r * Math.sin(rad(aDeg)), cy - r * Math.cos(rad(aDeg))];

  function alignLayer(L, c0) {
    let c = L.indexOf(c0); while (L[(c + 11) % 12] === c0) c = (c + 11) % 12;
    return L.map((_, i) => L[(i + c) % 12]); // R[i] = L[i + c]
  }

  function layerSvg(L, cx, cy, isTop, colors, arrowsOn, markerId, ink) {
    const R = 62, rE = 54, s = 8;
    const poly = (pts, fill, w) => `<polygon points="${pts.map(p => f1(p[0]) + ',' + f1(p[1])).join(' ')}" fill="${fill}" stroke="#222" stroke-width="${w || 1.3}" stroke-linejoin="round"/>`;
    let g = '';
    const slotCenter = (i, r) => pt(cx, cy, r, (i + 0.5) * 30);
    const homeSlot = id => 3 * (id % 4) + 2; // edge k at slot 3k+2
    for (let i = 0; i < 12; i++) {
      const id = L[i], a0 = i * 30;
      const fillTop = (id < 4 || (id >= 8 && id < 12)) ? colors.top : colors.bottom;
      if (id >= 8) { // edge
        const k = id % 4;
        g += poly([[cx, cy], pt(cx, cy, rE, a0), pt(cx, cy, rE, a0 + 30)], fillTop);
        g += poly([pt(cx, cy, rE, a0), pt(cx, cy, rE + s, a0), pt(cx, cy, rE + s, a0 + 30), pt(cx, cy, rE, a0 + 30)], colors.sides[k]);
      } else if (L[(i + 11) % 12] !== id) { // first slot of a corner
        const k = id % 4;
        g += poly([[cx, cy], pt(cx, cy, rE, a0), pt(cx, cy, R, a0 + 30), pt(cx, cy, rE, a0 + 60)], fillTop);
        g += poly([pt(cx, cy, rE, a0), pt(cx, cy, R, a0 + 30), pt(cx, cy, R + s, a0 + 30), pt(cx, cy, rE + s, a0)], colors.sides[(k + 3) % 4]);
        g += poly([pt(cx, cy, R, a0 + 30), pt(cx, cy, rE, a0 + 60), pt(cx, cy, rE + s, a0 + 60), pt(cx, cy, R + s, a0 + 30)], colors.sides[k]);
      }
    }
    if (!arrowsOn) return g;
    // arrows for misplaced edges (current slot -> home slot)
    const where = {}; for (let i = 0; i < 12; i++) if (L[i] >= 8) where[L[i]] = i;
    const moves = {}; Object.keys(where).forEach(id => { const h = homeSlot(+id); if (h !== where[id]) moves[where[id]] = h; });
    let ar = '';
    for (const p of Object.keys(moves).map(Number)) {
      const q = moves[p], swap = moves[q] === p;
      if (swap && p > q) continue;
      const a = slotCenter(p, 34), b = slotCenter(q, 34);
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, k = 4 / d;
      const a2 = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], b2 = [b[0] - (b[0] - a[0]) * k, b[1] - (b[1] - a[1]) * k];
      ar += `<path d="${arrowPath(swap ? a2 : a, swap ? b2 : b, swap ? 0 : 0.22)}" fill="none" stroke="${ink}" stroke-width="2.3" stroke-linecap="round" ${swap ? '' : 'stroke-dasharray="5 3"'} marker-end="url(#${markerId})" ${swap ? `marker-start="url(#${markerId})"` : ''}/>`;
    }
    return g + ar;
  }

  // alg: an alg that solves the case; flip: expected middle-layer state of the case (true = flipped)
  function square1Diagram(alg, colors, opts) {
    colors = colors || SQ_COLORS; opts = opts || {};
    let st;
    try { st = S.caseState(alg); } catch (e) { return null; }
    const id = 'sq' + (uid++);
    const top = alignLayer(st.top, 0), bot = alignLayer(st.bot, 4);
    const ink = '#111';
    const defs = `<defs><marker id="${id}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${ink}"/></marker></defs>`;
    const badge = st.flip ? 'flipped' : 'square';
    const g = layerSvg(top, 85, 88, true, colors, true, id, ink) + layerSvg(bot, 245, 88, false, colors, true, id, ink);
    const t = (x, y, s, w) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${w || 11}" fill="currentColor" font-family="system-ui,sans-serif">${s}</text>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 330 208" class="diagram sq" role="img" aria-label="${opts.label || 'Square-1 EP case'}">${defs}${g}${t(85, 170, 'U')}${t(245, 170, 'D (seen through the top)')}<rect x="122" y="184" width="86" height="16" rx="8" fill="${st.flip ? '#d9534f' : '#4a9d4a'}"/>${t(165, 195.5, 'middle: ' + badge, 9).replace('fill="currentColor"', 'fill="#fff"')}</svg>`;
  }

  const api = { megaminxDiagram, square1Diagram, MM_DEFAULT_COLORS, SQ_COLORS, MM_CFG };
  if (typeof module !== 'undefined') module.exports = api; else root.Diagram = api;
})(typeof window !== 'undefined' ? window : globalThis);
