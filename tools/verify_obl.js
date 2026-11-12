// Checks every Square-1 OBL case in data/square1_obl.json against the simulator. Run from the project root: node tools/verify_obl.js
//  1. the alg is legal run backwards from a cube shape and starts from a cube shape
//  2. the case it solves (which pieces belong on top, per layer, up to turning that layer) matches the stored one
//  3. no two cases share a class
//  4. the setup scramble from scramble.js, followed by the alg, leaves every piece in its own layer
const fs = require('fs');
const S = require('../src/square1.js'), X = require('../src/scramble.js');
const data = JSON.parse(fs.readFileSync('data/square1_obl.json', 'utf8'));
const CUBE = 'CCECCECCECCE/CCECCECCECCE', bad = [], seen = {};
const solved = S.oblClass(S.solved());
for (const c of data) {
  try {
    const st = S.cspState(c.alg, CUBE);
    if (!st) { bad.push(c.id + ': no legal start from a cube shape'); continue; }
    const cl = S.oblClass(st);
    if (cl !== c.cls) bad.push(c.id + ': stored class differs from the alg');
    if (seen[cl]) bad.push(c.id + ' and ' + seen[cl] + ' are the same case'); else seen[cl] = c.id;
    for (let i = 0; i < 5; i++) {
      const end = S.oblClass(S.run(c.alg, undefined, S.run(X.cspSetup(c.alg, CUBE))));
      if (end !== solved) { bad.push(c.id + ': scramble + alg does not orient both layers'); break; }
    }
  } catch (e) { bad.push(c.id + ': ' + e.message); }
}
if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
console.log(data.length + ' OBL cases ok');
