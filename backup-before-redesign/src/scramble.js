// Setup scrambles: wrapper + inverse(alg) + wrapper, rotation-free, merged. Needs Megaminx / Square1.
(function (root) {
  const M = root.Megaminx || require('./megaminx.js');
  const S = root.Square1 || require('./square1.js');
  const mod = (n, m) => ((n % m) + m) % m;
  const pick = (a, rng) => a[Math.floor(rng() * a.length)];
  const SHEET = { DR: 'dR', BR: 'bR' };

  // ---- Megaminx ----
  const U_TURNS = [0, 1, 2, -2, -1];
  const SUF = { 1: '', 2: '2', '-2': "2'", '-1': "'" };

  function mmSetup(alg, rng, a, b) {
    rng = rng || Math.random;
    if (a === undefined) a = pick(U_TURNS, rng);
    if (b === undefined) b = pick(U_TURNS, rng);
    const out = [];
    const push = (f, s) => {
      const last = out[out.length - 1];
      if (last && !last.raw && last.f === f) { last.s += s; if (mod(last.s, 5) === 0) out.pop(); } else if (mod(s, 5) !== 0) out.push({ f, s });
    };
    push(0, a);
    // rotFace[f] = face of the un-rotated puzzle that currently sits at position f (y-style rotations are removed by relabeling).
    // Composite sheet tokens (L-) are physical moves: they stay in the scramble as written.
    let rotFace = M.FACES.map((_, i) => i);
    const turned = () => rotFace.some((g, f) => g !== f);
    for (const tok of M.invert(alg).trim().split(/\s+/)) {
      if (M.SHEET_CFG[tok] && M.SHEET_CFG[tok].seq) {
        if (turned()) throw new Error('rotation before ' + tok + ' not supported');
        out.push({ raw: tok });
        continue;
      }
      for (const q of M.expand(tok, M.SHEET_CFG)) {
        if (q.whole) {
          const m = M.turnPerm(q.f, q.s, true), next = rotFace.slice();
          rotFace.forEach((g, f) => { next[M.slots[m[M.CENTER[f]]].face] = g; });
          rotFace = next;
        } else push(rotFace[q.f], q.s);
      }
    }
    push(0, b);
    return out.map(o => o.raw || (SHEET[M.FACES[o.f]] || M.FACES[o.f]) + SUF[mod(o.s + 2, 5) - 2]).join(' ');
  }

  // ---- Square-1 ----
  const SQ_WRAP = [0, 3, 6, -3];
  const n12 = v => mod(v + 5, 12) - 5; // -5..6
  function sqSetup(alg, rng, w) {
    rng = rng || Math.random;
    w = w || [0, 0, 0, 0].map(() => pick(SQ_WRAP, rng));
    const [pa, pb] = S.endTurns(alg);
    const toks = [{ a: w[0] + pa, b: w[1] + pb }].concat(S.parse(S.invert(alg)), [{ a: w[2], b: w[3] }]);
    const out = []; let A = 0, B = 0;
    const flush = () => { A = n12(A); B = n12(B); if (A || B) out.push(A + ',' + B); A = B = 0; };
    for (const t of toks) { if (t.slice) { flush(); out.push('/'); } else { A += t.a; B += t.b; } }
    flush();
    return out.join(' ');
  }

  const api = { mmSetup, sqSetup, U_TURNS, SQ_WRAP };
  if (typeof module !== 'undefined') module.exports = api; else root.Scramble = api;
})(typeof window !== 'undefined' ? window : globalThis);
