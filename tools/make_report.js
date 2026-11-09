const fs = require('fs');
const M = require('../src/megaminx.js'), S = require('../src/square1.js');
const mm = require('../data/megaminx.json'), rows = require('../data/square1_ep.json');
const conv = { sT: 1, sB: -1 };
const recs = JSON.parse(fs.readFileSync('/tmp/sq1_recs.json'));
const sus = {};
let out = '# Verification report (Phase 2)\n\n## Megaminx (151 algs)\n\n| case | alg | result | reason |\n|---|---|---|---|\n';
let mp = 0;
for (const c of mm) {
  let res = 'pass', why = '';
  if (false) { }
  else { const a = M.analyze(M.run(M.invert(c.alg), M.SHEET_CFG)); if (!a.ok) { res = 'FAIL'; why = a.reason; } }
  if (res === 'pass') mp++;
  out += `| ${c.id} | ${c.alg} | ${res} | ${why} |\n`;
}
out += `\nMegaminx: ${mp}/151 pass.\n\n## Square-1 EP (192 algs in sheet)\n\n| U/D | column | alg | result | reason |\n|---|---|---|---|---|\n`;
let sp = 0;
for (const r of recs) {
  const partial = /and adj/.test(r.a) || r.a === '1,0 / 5,-1 / -5,1 /';
  let res = r.why.length ? 'FAIL' : 'pass', why = r.why.join('; ');
  if (r.why.length && r.a === '1,0 / 5,-1 / -5,1 /') { res = 'partial'; why = 'alg is only the first half; sheet says "and adj/adj" (a second alg must follow)'; }
  if (res === 'pass') sp++;
  out += `| ${r.u}/${r.d} | ${r.col} | ${r.a} | ${res} | ${why} |\n`;
}
out += `\nSquare-1: ${sp}/${recs.length} pass (+2 note-only entries "M2 U2 M2 and adj/adj" not simulated).\n`;
fs.writeFileSync('data/verification_report.md', out);
console.log(mp, sp);
