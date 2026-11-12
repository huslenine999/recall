// 2x2 sets from the Best 2x2 Algs workbook: every alg reads, solves the position it sets up, and (CLL, EG-2, PBL) every alg of a case starts from that case's position.
const fs = require('fs');
const C = require('../src/cube2.js');
const load = f => JSON.parse(fs.readFileSync(__dirname + '/../data/cube2_' + f + '.json', 'utf8'));
const EXPECT = { pbl: 9, cll: 40, eg1: 40, eg2: 40, leg1: 40, tcllp: 43, tcllm: 43, ls: 486, teg2p: 43 };
let algs = 0, positions = 0;
for (const [f, n] of Object.entries(EXPECT)) {
  const rows = load(f); if (rows.length !== n) throw new Error(`${f}: ${rows.length} cases, expected ${n}`);
  for (const c of rows) {
    if (!c.algs.length) throw new Error(`${f} ${c.id}: no algs`);
    for (const a of c.algs) {
      algs++;
      const st = C.run(C.invert(a));
      if (!C.isSolved(C.run(a, st))) throw new Error(`${f} ${c.id}: "${a}" does not solve its own setup`);
      if (c.cls) { positions++; if (!C.fits(st, c.cls)) throw new Error(`${f} ${c.id}: "${a}" starts from a different position than the case`); }
    }
  }
}
console.log(`${algs} algs in ${Object.values(EXPECT).reduce((a, b) => a + b, 0)} cases (${positions} checked against their case position)`);
