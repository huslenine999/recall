// Builds data/cube3_*.json from SpeedCubeDB's 3x3 export (data/src/speedcubedb_3x3_selected_algs.csv): node tools/make_cube3.js
// One row per alg in the CSV: set, subset_page, case, group, setup, standard_alg, orientation_or_slot, alg_rank, algorithm.
// A case is a set + case name. Its position class (cls) is the class of the CSV's setup, so every alg of the case can be compared with it (see keyOf in src/cube3.js).
// Advanced F2L has no cls: the sheet lists algs for one case that start from different arrangements of the pair, so there only the notation and the cross are checked.
const fs = require('fs'), path = require('path');
const C = require('../src/cube3.js');
const root = path.resolve(__dirname, '..');
function csv(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; if (row.length > 1 || row[0]) rows.push(row); row = []; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const head = rows.shift().map(h => h.replace(/^﻿/, ''));
  return rows.map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
const rows = csv(fs.readFileSync(path.join(root, 'data/src/speedcubedb_3x3_selected_algs.csv'), 'utf8'));
const FILES = { F2L: 'f2l', 'Advanced F2L': 'af2l', OLL: 'oll', PLL: 'pll', COLL: 'coll', WV: 'wv', VLS: 'vls', ZBLL: 'zbll' };
// the chips on the Cases screen: the sheet's own group, except where that is empty or too fine (ZBLL has 40) and the page the case sits on says more
const groupOf = r => (r.set === 'ZBLL' ? r.subset_page.replace(/^ZBLL /, '') : r.set === 'VLS' ? r.subset_page : r.set === 'WV' ? 'Winter Variation' : r.group);
const out = {}, report = [];
for (const r of rows) {
  const set = r.set; if (!FILES[set]) throw new Error('unknown set ' + set);
  const cases = out[set] = out[set] || new Map();
  if (!cases.has(r.case)) cases.set(r.case, { id: r.case, group: groupOf(r), setup: r.setup, o: [] });
  cases.get(r.case).o.push({ ori: +r.orientation_or_slot, rank: +r.alg_rank, alg: r.algorithm.trim().replace(/\s+/g, ' ') });
}
for (const [set, cases] of Object.entries(out)) {
  const list = [];
  for (const c of cases.values()) {
    const want = set === 'Advanced F2L' ? null : C.classOf(set, C.run(c.setup));
    if (set !== 'Advanced F2L' && want === null) throw new Error(`${set} ${c.id}: the setup is not a ${set} position`);
    const algs = [], seen = new Set();
    // the main orientation first (rank order), then the other three slots of F2L-type sets
    for (const a of c.o.sort((x, y) => x.ori - y.ori || x.rank - y.rank)) {
      if (seen.has(a.alg)) continue; seen.add(a.alg);
      let why = '';
      try {
        const st = C.start(a.alg);
        if (want !== null) { const k = C.classOf(set, st); if (k === null) why = 'is not a ' + set + ' position'; else if (k !== want) why = 'starts from another case'; }
        else if (!C.crossSolved(C.norm(st))) why = 'breaks the cross';
      } catch (e) { why = e.message; }
      if (why) report.push(`${set} ${c.id}: left out "${a.alg}" (${why})`); else algs.push(a.alg);
    }
    if (!algs.length) throw new Error(`${set} ${c.id}: no usable alg`);
    const row = { id: c.id, group: c.group, algs, setup: c.setup }; if (want !== null) row.cls = want;
    list.push(row);
  }
  fs.writeFileSync(path.join(root, 'data/cube3_' + FILES[set] + '.json'), JSON.stringify(list, null, 1));
  console.log(set.padEnd(13), list.length + ' cases', list.reduce((n, c) => n + c.algs.length, 0) + ' algs');
}
fs.writeFileSync(path.join(root, 'data/src/cube3_report.txt'), report.length ? report.join('\n') + '\n' : 'Nothing left out.\n');
console.log(report.length ? 'see data/src/cube3_report.txt' : 'every alg kept');
