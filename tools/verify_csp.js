// Checks every Square-1 CSP case in data/square1_csp.json against the simulator. Run from the project root: node tools/verify_csp.js
//  1. the alg is legal when run backwards from a cube shape (every slice allowed) and the shape it starts from is the case's shape
//  2. even and odd of one shape start from the same shape
//  3. the setup scramble from scramble.js, followed by the alg, gives back a cube shape
const fs = require('fs');
const S = require('../src/square1.js'), X = require('../src/scramble.js');
const data = JSON.parse(fs.readFileSync('data/square1_csp.json', 'utf8'));
const CUBE = 'CCECCECCECCE/CCECCECCECCE';
const bad = [], keys = {};
for (const c of data) {
  const id = c.name + ' ' + c.parity;
  try {
    const st = S.cspState(c.alg, c.key);
    if (!st) { bad.push(id + ': alg does not start from the stored shape'); continue; }
    (keys[c.n] = keys[c.n] || new Set()).add(c.key);
    for (let i = 0; i < 20; i++) {
      const end = S.run(c.alg, undefined, S.run(X.cspSetup(c.alg, c.key)));
      if (S.shapeKey(end) !== CUBE) { bad.push(id + ': scramble + alg does not end in a cube shape'); break; }
    }
  } catch (e) { bad.push(id + ': ' + e.message); }
}
Object.keys(keys).forEach(n => { if (keys[n].size > 1) bad.push('shape ' + n + ': even and odd start from different shapes'); });
console.log(data.length + ' cases, ' + Object.keys(keys).length + ' shapes, ' + bad.length + ' problems');
bad.forEach(b => console.log(' - ' + b));
process.exit(bad.length ? 1 : 0);
