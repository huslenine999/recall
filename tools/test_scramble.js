// Automated test: setup + AUF-before + alg = solved (up to a final layer turn), for every verified case and every wrapper combination.
const M = require('../src/megaminx.js'), S = require('../src/square1.js'), X = require('../src/scramble.js');
const MM = require('../data/megaminx.json'), SQ = require('../data/square1_ep.json');
const CFG = M.SHEET_CFG;
let fail = 0, n = 0;
const solvedRel = st => { const r = M.rel(st); return r.every((c, i) => c === M.slots[i].face); };
for (const c of MM) {
  let ok = false; try { ok = M.analyze(M.run(M.invert(c.alg), CFG)).ok; } catch (e) { }
  if (!ok) { console.log('skip (unverified)', c.id); continue; }
  for (const a of X.U_TURNS) for (const b of X.U_TURNS) {
    n++;
    const setup = X.mmSetup(c.alg, null, a, b);
    let good = !/\by/.test(setup);
    try {
      // the trailing U wrapper is an AUF the solver undoes before the alg, so allow a pre-turn p and a final turn s
      const base = M.run(setup, CFG), U = s => M.turnPerm(0, s, false);
      good = good && [0, 1, 2, 3, 4].some(p => { const st = M.run(c.alg, CFG, M.apply(base, U(p))); return [0, 1, 2, 3, 4].some(s => solvedRel(M.apply(st, U(s)))); });
    } catch (e) { good = false; }
    if (!good) { fail++; if (fail < 10) console.log('FAIL mm', c.id, a, b, setup); }
  }
}
const W = X.SQ_WRAP;
for (const r of SQ) for (const [list, flip] of [[r.algsNoFlip, false], [r.algsFlip, true]]) for (const alg of list) {
  let ok = false; try { const s = S.run(alg); ok = S.analyze(s).ok && s.flip === flip; } catch (e) { }
  if (!ok) continue;
  for (const w0 of W) for (const w1 of W) for (const w2 of W) for (const w3 of W) {
    n++;
    const setup = X.sqSetup(alg, null, [w0, w1, w2, w3]);
    let good = false;
    try {
      const st = S.run(setup + ' ' + (-w2 || 0) + ',' + (-w3 || 0) + ' ' + alg), an = S.analyze(st);
      good = an.ok && !st.flip && an.topPerm.join('') === '0123' && an.botPerm.join('') === '0123';
    } catch (e) { }
    if (!good) { fail++; if (fail < 10) console.log('FAIL sq', r.u, r.d, alg, w0, w1, w2, w3, '|', setup); }
  }
}
console.log(n + ' checks, ' + fail + ' failures');
process.exit(fail ? 1 : 0);
