const S = require('../src/square1.js');
const recs = JSON.parse(require('fs').readFileSync('/tmp/sq1_recs.json'));
const conv = { sT: 1, sB: -1 };
const classMapU = { 'cw U': 'T3b', 'ccw U': 'T3a', Z: 'Z', H: 'H', Opp: 'Opp', Adj: 'Adj', 'cw O': 'O-', 'ccw O': 'O+', W: 'W', '-': '-' };
const classMapD = { 'cw U': 'T3a', 'ccw U': 'T3b', Z: 'Z', H: 'H', Opp: 'Opp', Adj: 'Adj', 'cw O': 'O+', 'ccw O': 'O-', W: 'W', '-': '-' };
const norm = n => ((n + 5) % 12 + 12) % 12 - 5;
const fmt = ops => ops.map(o => (o.slice ? '/' : o.a + ',' + o.b)).join(' ');
function good(ops, r) { try { let s = S.solved(); for (const o of ops) s = S.step(s, o, conv); const an = S.analyze(s); return an.ok && S.classOf(an.topPerm) === classMapU[r.u] && S.classOf(an.botPerm) === classMapD[r.d] && (s.flip === (r.col === 'f')); } catch (e) { return false; } }
for (const r of recs.filter(r => r.why && r.why.length && !/and adj/.test(r.a) && r.a !== '1,0 / 5,-1 / -5,1 /')) {
  const ops = S.parse(r.a), found = [];
  for (let i = 0; i < ops.length; i++) {
    if (ops[i].slice) continue;
    for (const k of ['a', 'b']) for (let v = -5; v <= 6; v++) { if (v === ops[i][k]) continue; const o2 = ops.map(o => ({ ...o })); o2[i][k] = v; if (good(o2, r)) found.push(`token ${i} ${k}: ${ops[i].a},${ops[i].b} -> ${o2[i].a},${o2[i].b}`); }
  }
  // also try deleting / inserting a slice? skip. try appending a final turn (truncated algs)
  console.log(`${r.u}/${r.d} [${r.col}] ${r.a}\n   single-value fixes: ${found.length ? found.join(' | ') : 'none'}`);
}
