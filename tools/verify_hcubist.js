// Skewb NS, Skewb Sarah's Advanced and Pyraminx L4E: every alg of every case starts from the case's position, the setup
// scramble reaches that position too, and NS and Sarah's Advanced describe the same cases. (At build time of the data every
// case was also matched sticker for sticker against the pictures printed in the sheets; the PDFs are not kept in this repo.)
const fs = require('fs');
const K = require('../src/skewb.js'), P = require('../src/pyraminx.js');
const load = f => JSON.parse(fs.readFileSync(__dirname + '/../data/' + f, 'utf8'));
let n = 0;
const check = (rows, name, eng, start, scr) => {
  for (const c of rows) for (const a of c.algs) {
    n++;
    if (eng.classOf(start(a)) !== c.cls) throw new Error(`${name} ${c.id}: "${a}" does not start from the case's position`);
    if (eng.classOf(scr(a)) !== c.cls) throw new Error(`${name} ${c.id}: the scramble for "${a}" does not reach the case`);
  }
};
const ns = load('skewb_ns.json'), sa = load('skewb_sa.json'), px = load('pyraminx_l4e.json');
const sk = cfg => ({ start: a => K.run(K.invert(a, cfg), null, cfg), scr: a => K.run(K.scramble(a, cfg), null, K.NS) });
check(ns, 'Skewb NS', K, sk(K.NS).start, sk(K.NS).scr);
check(sa, 'Skewb SA', K, sk(K.SA).start, sk(K.SA).scr);
check(px, 'Pyraminx L4E', P, a => P.run(P.invert(a)), a => P.run(P.invert(a)));
const byId = new Map(sa.map(c => [c.id, c.cls]));
ns.forEach(c => { if (byId.get(c.id) !== c.cls) throw new Error('NS and Sarah\'s Advanced disagree on ' + c.id); });
if (ns.length !== 137 || sa.length !== 137 || px.length !== 37) throw new Error('case counts changed: ' + [ns.length, sa.length, px.length]);
console.log(n + ' algs in ' + (ns.length + sa.length + px.length) + ' cases');
