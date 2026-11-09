const S = require('../src/square1.js');
const rows = require('../data/square1_ep.json');
const conv = { sT: 1, sB: -1 };
const odd = new Set(['Opp', 'Adj', 'cw O', 'ccw O', 'W']);
const recs = [];
rows.forEach((r, ri) => [['nf', r.algsNoFlip], ['f', r.algsFlip]].forEach(([col, L]) => L.forEach(a => {
  const rec = { ri, u: r.u, d: r.d, col, a, slices: S.sliceCount(a) };
  try { const an = S.analyze(S.run(a, conv)); if (!an.ok) { rec.fail = an.reason; } else { rec.tc = S.classOf(an.topPerm); rec.bc = S.classOf(an.botPerm); rec.tpar = S.parity(an.topPerm); rec.bpar = S.parity(an.botPerm); rec.flip = an.flip; } }
  catch (e) { rec.fail = e.message; }
  recs.push(rec);
})));
// majority map label -> neutral class, separately for top (u) and bottom (d)
const maj = (key, lab) => { const m = {}; recs.filter(r => !r.fail).forEach(r => { const k = r[lab], v = r[key]; (m[k] = m[k] || {})[v] = (m[k][v] || 0) + 1; }); const best = {}; for (const k in m) best[k] = Object.entries(m[k]).sort((a, b) => b[1] - a[1])[0][0]; return { m, best }; };
const U = maj('tc', 'u'), D = maj('bc', 'd');
console.log('U label->class', JSON.stringify(U.m)); console.log('D label->class', JSON.stringify(D.m));
const fails = [];
recs.forEach(r => {
  const why = [];
  if (r.fail) why.push(r.fail);
  else {
    if (U.best[r.u] !== r.tc) why.push(`top class ${r.tc} != label ${r.u}(${U.best[r.u]})`);
    if (D.best[r.d] !== r.bc) why.push(`bottom class ${r.bc} != label ${r.d}(${D.best[r.d]})`);
    const exp = (odd.has(r.u)) !== (odd.has(r.d)); if (exp !== (r.tpar !== r.bpar)) why.push('parity mismatch');
    if ((r.slices % 2 === 1) !== (r.col === 'f')) why.push(`flip column mismatch (${r.slices} slices in ${r.col})`);
    if ((r.slices % 2 === 1) !== r.flip) why.push('flag mismatch');
  }
  r.why = why; if (why.length) fails.push(r);
});
console.log('algs', recs.length, 'pass', recs.length - fails.length, 'fail', fails.length);
fails.forEach(r => console.log(`${r.u}/${r.d} [${r.col}] ${r.why.join('; ')} | ${r.a}`));
require('fs').writeFileSync('/tmp/sq1_recs.json', JSON.stringify(recs));
