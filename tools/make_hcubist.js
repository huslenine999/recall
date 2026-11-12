// Builds data/skewb_ns.json, data/skewb_sa.json and data/pyraminx_l4e.json from data/src/hcubist_rows.json (the cases read off
// the HCubist PDFs by tools/hcubist_extract.py). Each case gets its class: the position it starts from, however the puzzle is held.
// A case's algs are accepted in the app when they start from that class. Run: node tools/make_hcubist.js
const fs = require('fs');
const K = require('../src/skewb.js'), P = require('../src/pyraminx.js');
const rows = JSON.parse(fs.readFileSync('data/src/hcubist_rows.json', 'utf8'));
const tidy = s => { // 'PI + SWIRL PERM' -> 'Pi + swirl perm'; L4C, H and Z stay capitals
  const w = s.replace(/\+\s*/g, '+ ').replace(/\s*\+/g, ' +').replace(/\s+/g, ' ').trim().split(' ');
  return w.map((t, i) => { const l = t.toLowerCase(); if (/^l\d[ce]$/i.test(t) || (/^[a-z]$/i.test(t))) return t.toUpperCase(); if (l === 'or' || l === 'and') return l; if (l === '+') return '+'; const c = l.replace(/^./, x => x.toUpperCase()); return i === 0 || w[i - 1] === '+' ? c : l; }).join(' ');
};
function build(tag, engine, cfg, file) {
  const out = [], seen = new Set();
  for (const r of rows[tag]) {
    if (r.page < 2 || !r.alg) continue;
    if (seen.has(r.name)) throw new Error('duplicate case ' + r.name); seen.add(r.name);
    const algs = [r.alg, r.alt].filter(Boolean).map(a => a.replace(/\s+/g, ' ').trim());
    const cls = algs.map(a => engine.classOf(engine.run(engine.invert(a, cfg), null, cfg)));
    if (new Set(cls).size !== 1) throw new Error(r.name + ': its algs start from different positions');
    out.push({ id: r.name, group: tidy(r.section), algs, cls: cls[0] });
  }
  fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
  console.log(file, out.length, 'cases,', new Set(out.map(c => c.group)).size, 'groups,', out.filter(c => c.algs.length > 1).length, 'with a second alg');
  return out;
}
// Pyraminx: its engine takes the alg alone
const pyr = { classOf: P.classOf, run: a => P.run(a), invert: a => P.invert(a) };
const ns = build('ns', K, K.NS, 'data/skewb_ns.json'), sa = build('sa', K, K.SA, 'data/skewb_sa.json');
const byId = new Map(sa.map(c => [c.id, c.cls]));
ns.forEach(c => { if (byId.get(c.id) !== c.cls) throw new Error('NS and Sarah\'s differ on ' + c.id); });
build('l4e', pyr, null, 'data/pyraminx_l4e.json');
