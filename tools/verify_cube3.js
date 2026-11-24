// 3x3 checks, from the data files: node tools/verify_cube3.js
// For every case: each alg reads; for sets with a position class, every alg starts from the case's position and the setup makes it too, different cases have different classes
// (Advanced F2L has none: its algs only have to leave the cross alone); and the scramble shown for each alg, followed by the alg, solves the cube.
const fs = require('fs'), path = require('path');
const C = require('../src/cube3.js');
const root = path.resolve(__dirname, '..');
const SETS = { f2l: 'F2L', af2l: 'Advanced F2L', oll: 'OLL', pll: 'PLL', coll: 'COLL', wv: 'WV', vls: 'VLS', zbll: 'ZBLL' };
let bad = 0, algs = 0, cases = 0; const fail = m => { bad++; if (bad <= 12) console.log('FAIL ' + m); };
for (const [f, set] of Object.entries(SETS)) {
  const rows = JSON.parse(fs.readFileSync(path.join(root, 'data/cube3_' + f + '.json'), 'utf8')), seen = new Map();
  for (const c of rows) {
    cases++;
    if (c.cls) {
      let k = null; try { k = C.classOf(set, C.run(c.setup)); } catch (e) { }
      if (k !== c.cls) fail(`${set} ${c.id}: the setup does not make the case's position`);
      if (seen.has(c.cls)) fail(`${set} ${c.id} and ${seen.get(c.cls)} are the same position`); seen.set(c.cls, c.id);
    }
    for (const a of c.algs) {
      algs++;
      try {
        const st = C.start(a);
        if (c.cls) { if (C.classOf(set, st) !== c.cls) fail(`${set} ${c.id}: "${a}" starts from another case`); }
        else if (!C.crossSolved(C.norm(st))) fail(`${set} ${c.id}: "${a}" breaks the cross`);
        // scramble (from a solved cube) + alg = solved, whatever way the cube is held at the end
        if (!C.isSolved(C.run(a, C.run(C.scramble(a))))) fail(`${set} ${c.id}: scramble + "${a}" does not solve`);
      } catch (e) { fail(`${set} ${c.id}: "${a}" ${e.message}`); }
    }
  }
}
console.log(`3x3: ${cases} cases, ${algs} algs, ${bad} problems`);
process.exit(bad ? 1 : 0);
