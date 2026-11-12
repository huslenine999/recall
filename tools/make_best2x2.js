// Turns data/src/best2x2_cells.json (read from the "Best 2x2 Algs" workbook by tools/best2x2_extract.py) into the 2x2 data files.
// A section of a sheet has a label in column A (Sune, Hammer, Solved...) and one case per column B to G; the cells under it are algs for that case.
// An alg is kept when it starts from the same case as most of the algs in its column; the rest are listed as left out.
// Run: node tools/make_best2x2.js        (writes data/cube2_<set>.json and data/src/best2x2_report.txt)
const fs = require('fs');
const C = require('../src/cube2.js');
const cells = JSON.parse(fs.readFileSync('data/src/best2x2_cells.json', 'utf8'));
const report = [];
const SETS = [ // file, title, sheet(s)
  ['pbl', 'PBL', ['PBL']], ['cll', 'CLL', ['CLL']], ['eg1', 'EG-1', ['EG-1']], ['eg2', 'EG-2', ['EG-2']], ['leg1', 'LEG-1', ['LEG-1']],
  ['tcllp', 'TCLL+', ['TCLL+']], ['tcllm', 'TCLL-', ['TCLL-']], ['ls', 'LS', [1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => 'LS-' + i)], ['teg2p', 'TEG2+', ['TEG2+']]
];
const LABEL = /^[A-Za-z][A-Za-z0-9 +\-]*$/;
// the readings of a cell: "X/Y" between moves are alternatives (try each)
function readings(text) {
  const t = text.replace(/[‘’´ʹ]/g, "'").replace(/\s+/g, ' ').replace(/\.\s*$/, '').trim();
  let opts = [t];
  const alt = /([RLUDFBxyzXYZ]['23]*)\/([RLUDFBxyzXYZ]['23]*)/;
  for (let guard = 0; guard < 4; guard++) { const next = []; let any = false; for (const o of opts) { const m = alt.exec(o); if (m) { any = true; next.push(o.replace(alt, m[1]), o.replace(alt, m[2])); } else next.push(o); } opts = next; if (!any) break; }
  return opts.map(o => o.replace(/\bY'/g, "y'").replace(/\bY\b/g, 'y').replace(/\s+/g, ' ').trim());
}
const startOf = a => C.run(C.invert(a));
// Sets whose algs all start from one position (the first layer is solved): an alg that starts from another position than most of its column is left out.
// The other sets (EG-1, LEG-1, TCLL, TEG2+, LS) show one picture per case but list algs for several first-layer positions, so there the algs of a case can start from different positions and only the notation is checked.
const STRICT = new Set(['PBL', 'CLL', 'EG-2']);
function build(file, title, sheets) {
  const out = [], seen = new Map();
  for (const sh of sheets) {
    const cs = cells[sh]; if (!cs) throw new Error('no sheet ' + sh);
    const labels = cs.filter(([r, c, v]) => c === 1 && LABEL.test(v)).map(([r, c, v]) => ({ row: r, text: v.replace(/\s+/g, ' ') }));
    const header = {}; // PBL: the top-layer names above the grid
    if (sh === 'PBL') cs.filter(([r, c]) => r === 3 && c > 1).forEach(([r, c, v]) => { header[c] = v; });
    labels.forEach((lab, li) => {
      if (sh === 'PBL' && lab.row < 4) return;
      const end = li + 1 < labels.length ? labels[li + 1].row : Infinity;
      const cols = {};
      cs.filter(([r, c]) => c > 1 && r > lab.row && r < end).forEach(([r, c, v]) => { (cols[c] = cols[c] || []).push([r, v]); });
      let n = 0;
      Object.keys(cols).map(Number).sort((a, b) => a - b).forEach(c => {
        const algs = [], where = sh + ' ' + lab.text + ' col ' + 'ABCDEFG'[c - 1];
        const ok = [];
        for (const [r, v] of cols[c]) {
          let found = null, err = null;
          for (const cand of readings(v)) { try { const st = startOf(cand); if (!found) found = { a: cand, st }; } catch (e) { err = e.message; } }
          if (found) ok.push({ r, raw: v, ...found }); else if (/[RUFLDB]['2]?(\s|$)/.test(v) && !/[a-z]{4}/.test(v.replace(/[xyz]/g, ''))) report.push(`${where} row ${r}: not read (${err}): ${v}`);
        }
        if (!ok.length) return;
        n++;
        let keep = ok;
        if (STRICT.has(title === 'LS' ? 'LS' : sh)) { // the algs that agree with the most others
          let best = [];
          for (const x of ok) { const agree = ok.filter(y => C.same(x.st, y.st)); if (agree.length > best.length) best = agree; }
          keep = best;
          ok.filter(x => !keep.includes(x)).forEach(x => report.push(`${where} row ${x.r}: starts from a different position than the rest of its column (${keep.length} agree): ${x.raw}`));
        }
        const id = sh === 'PBL' ? `Base ${lab.text} / Top ${header[c] || n}` : sheets.length > 1 ? `${sh} ${lab.text} ${n}` : `${lab.text} ${n}`;
        const group = sh === 'PBL' ? 'Base ' + lab.text.toLowerCase() : sheets.length > 1 ? sh : lab.text;
        if (seen.has(id)) throw new Error('duplicate id ' + id);
        seen.set(id, 1);
        out.push({ id, group, sub: sheets.length > 1 ? lab.text : undefined, algs: [...new Set(keep.map(x => x.a))], cls: STRICT.has(sh) ? [...new Set(keep.map(x => C.hash(C.classOf(x.st))))] : undefined });
      });
    });
  }
  report.push(`== ${title}: ${out.length} cases, ${out.reduce((s, c) => s + c.algs.length, 0)} algs${sheets.some(x => STRICT.has(x)) ? ', every alg of a case starts from the same position' : ', notation checked only (see the note in make_best2x2.js)'}`);
  fs.writeFileSync(`data/cube2_${file}.json`, JSON.stringify(out, null, 1) + '\n');
  return out;
}
const all = {}; SETS.forEach(([f, t, s]) => { all[f] = build(f, t, s); });
fs.writeFileSync('data/src/best2x2_report.txt', report.join('\n') + '\n');
console.log(report.filter(l => l.startsWith('==')).join('\n')); console.log(report.filter(l => !l.startsWith('==')).length + ' lines of notes in data/src/best2x2_report.txt');
