const S = require('../src/square1.js');
const rows = require('../data/square1_ep.json');
const convs = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const all = []; rows.forEach(r => { r.algsNoFlip.forEach(a => all.push({ r, a, col: 'nf' })); r.algsFlip.forEach(a => all.push({ r, a, col: 'f' })); });
console.log('algs', all.length);
for (const [sT, sB] of convs) {
  let ok = 0, ill = 0, shape = 0, cross = 0;
  for (const x of all) { try { const an = S.analyze(S.run(x.a, { sT, sB })); if (an.ok) ok++; else if (/cross/.test(an.reason)) cross++; else shape++; } catch (e) { ill++; } }
  console.log('conv', sT, sB, { ok, illegalSlice: ill, badShape: shape, cross });
}
