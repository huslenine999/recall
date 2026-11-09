const M = require('../src/megaminx.js');
const data = require('../data/megaminx.json');
const dRc = ['DR', 'DBR', 'DL', 'DBL', 'B'], bRc = ['BR', 'DBR', 'B', 'DR', 'DBL'];
const lc = []; for (const f of ['L', 'R', 'U', 'F']) for (const s of [1, -1, 2, -2]) lc.push({ rot: true, face: f, steps: s });
const has = (re) => data.filter(c => re.test(c.alg));
const algsdR = has(/\bd[RL]/), algsbR = has(/\bbR/), algsL = has(/L-/);
const pass = (c, cfg) => { try { return M.analyze(M.run(c.alg, cfg)).ok; } catch (e) { return false; } };
const okdR = dRc.filter(x => algsdR.every(c => pass(c.alg ? c : c, { dR: x, bR: 'BR' })) || false);
const res = {};
for (const x of dRc) res['dR=' + x] = algsdR.filter(c => pass(c, { dR: x, bR: 'BR' })).length + '/' + algsdR.length;
for (const x of bRc) res['bR=' + x] = algsbR.filter(c => pass(c, { dR: 'DR', bR: x })).length + '/' + algsbR.length;
console.log(res);
console.log('dR algs:', algsdR.map(c => c.id).join(' '), '| bR algs:', algsbR.map(c => c.id).join(' '));
for (const l of lc) { const n = algsL.filter(c => pass(c, { dR: 'DR', bR: 'BR', 'L-': l })).length; if (n) console.log('L-', l.face, l.steps, n + '/' + algsL.length); }
