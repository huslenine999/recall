// Checks every Square-1 PBL case in data/square1_pbl.json against the simulator. Run from the project root: node tools/verify_pbl.js
//  1. the alg is legal run backwards from a cube shape, starts from a cube shape, and every piece stays in its own layer
//  2. the case it solves (class of each layer's piece permutation up to turning that layer) matches the stored one
//  3. each top name and each bottom name stands for exactly one class, and no two names share a class
//  4. the setup scramble from scramble.js, followed by the alg, gives back a solved cube (up to turning each layer)
const fs = require('fs');
const S = require('../src/square1.js'), X = require('../src/scramble.js');
const data = JSON.parse(fs.readFileSync('data/square1_pbl.json', 'utf8'));
const CUBE = 'CCECCECCECCE/CCECCECCECCE', bad = [];
const solved = S.pblClass(S.solved());
const names = { top: {}, bot: {} };
for (const c of data) {
  try {
    const st = S.cspState(c.alg, CUBE);
    if (!st) { bad.push(c.id + ': no legal start from a cube shape'); continue; }
    const cl = S.pblClass(st);
    if (!cl) { bad.push(c.id + ': a piece leaves its layer'); continue; }
    if (cl.top !== c.ct || cl.bot !== c.cb) bad.push(c.id + ': stored class differs from the alg');
    (names.top[c.top] = names.top[c.top] || new Set()).add(cl.top); (names.bot[c.bot] = names.bot[c.bot] || new Set()).add(cl.bot);
    for (let i = 0; i < 5; i++) {
      const end = S.pblClass(S.run(c.alg, undefined, S.run(X.cspSetup(c.alg, CUBE))));
      if (!end || end.top !== solved.top || end.bot !== solved.bot) { bad.push(c.id + ': scramble + alg does not solve'); break; }
    }
  } catch (e) { bad.push(c.id + ': ' + e.message); }
}
['top', 'bot'].forEach(k => {
  const inv = {};
  Object.entries(names[k]).forEach(([n, set]) => { if (set.size > 1) bad.push(k + ' name ' + n + ' maps to ' + set.size + ' classes'); set.forEach(v => (inv[v] = inv[v] || []).push(n)); });
  Object.entries(inv).forEach(([v, l]) => { if (l.length > 1) bad.push(k + ' names ' + l.join(', ') + ' share a class'); });
});
console.log(data.length + ' cases, ' + bad.length + ' problems');
bad.forEach(b => console.log(' - ' + b));
process.exit(bad.length ? 1 : 0);
