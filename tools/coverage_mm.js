const M = require('../src/megaminx.js');
const data = require('../data/megaminx.json');
const cfg = M.SHEET_CFG;
const names = new Map(); let bad = [];
for (const c of data) {
  const a = M.analyze(M.run(M.invert(c.alg), cfg));
  if (!a.ok) { bad.push(c.id + ' ' + a.reason); continue; }
  const k = M.canon(M.invPerm(a.cp), M.invPerm(a.ep)); // case = inverse of alg
  if (!names.has(k)) names.set(k, []); names.get(k).push(c.id);
}
console.log('skipped/failed:', bad);
console.log('distinct classes covered:', names.size, 'algs analysed:', data.length - bad.length);
console.log('duplicates:', [...names.values()].filter(v => v.length > 1));
// enumerate all LL states
const perms = []; (function g(p, rest) { if (!rest.length) return perms.push(p); rest.forEach((x, i) => g([...p, x], rest.filter((_, j) => j !== i))); })([], [0, 1, 2, 3, 4]);
const all = new Map();
for (const cp of perms) for (const ep of perms) { const k = M.canon(cp, ep); if (!all.has(k)) all.set(k, [M.parity(cp), M.parity(ep)]); }
const cnt = {}; for (const [k, v] of all) { const t = v.join(''); cnt[t] = (cnt[t] || 0) + 1; }
console.log('orbits total', all.size, 'by parity(cp,ep)', cnt);
const par = {}; for (const k of names.keys()) { const t = all.get(k) && all.get(k).join(''); par[t] = (par[t] || 0) + 1; }
console.log('algs by parity', par);
const missing = [...all.keys()].filter(k => !names.has(k) && all.get(k).join('') === '00');
console.log('even/even orbits not covered by any alg:', missing.length, missing.map(k => k.slice(0, 5) + '/' + k.slice(5)));
// solved class
console.log('solved is orbit', M.canon([0,1,2,3,4],[0,1,2,3,4]));
