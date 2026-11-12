// The checks that need no browser: build, make sure the built page is whole, then verify the algs against the simulators.
// Run from the project root: npm test     (the browser run is separate: npm run test:ui)
const fs = require('fs'), path = require('path'), vm = require('vm'), { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
let failed = 0;
const step = (name, fn) => {
  const t = Date.now(); let note = '';
  try { note = fn() || ''; console.log(`ok    ${name}${note ? ': ' + note : ''} (${Date.now() - t} ms)`); }
  catch (e) { failed++; console.log(`FAIL  ${name}\n${String(e.message).split('\n').map(l => '      ' + l).join('\n')}`); }
};
const node = (...args) => { const r = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' }); const out = (r.stdout + r.stderr).trim(); if (r.status !== 0) throw new Error(out || 'exit ' + r.status); return out.split('\n').pop(); };

step('build', () => node('build.js'));
step('built page is complete', () => {
  const html = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
  const left = html.match(/\/\*__[A-Z]+__\*\//g); if (left) throw new Error('placeholders not filled: ' + left.join(', '));
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  if (scripts.length !== 3) throw new Error('expected 3 inline scripts, found ' + scripts.length);
  scripts.forEach((code, i) => { try { new vm.Script(code); } catch (e) { throw new Error(`inline script ${i + 1} does not parse: ${e.message}`); } });
  const sw = fs.readFileSync(path.join(root, 'dist/sw.js'), 'utf8'); if (sw.includes('__BUILD__')) throw new Error('sw.js has no build id');
  JSON.parse(fs.readFileSync(path.join(root, 'dist/manifest.webmanifest'), 'utf8'));
  return (html.length / 1024).toFixed(0) + ' KB';
});
step('data files parse and ids are unique', () => {
  const sets = { 'megaminx.json': r => r.id, 'megaminx_oll.json': r => r.id, 'square1_pbl.json': r => r.id, 'square1_obl.json': r => r.id, 'square1_csp.json': r => r.name + '|' + r.parity, 'square1_ep.json': r => r.u + '|' + r.d, 'skewb_ns.json': r => r.id, 'skewb_sa.json': r => r.id, 'pyraminx_l4e.json': r => r.id };
  return Object.entries(sets).map(([f, id]) => { const rows = JSON.parse(fs.readFileSync(path.join(root, 'data', f), 'utf8')), seen = new Set(); rows.forEach(r => { const k = id(r); if (seen.has(k)) throw new Error(f + ': duplicate ' + k); seen.add(k); }); return rows.length; }).join(' + ') + ' rows';
});
step('Square-1 CSP algs', () => node('tools/verify_csp.js'));
step('Square-1 PBL algs', () => node('tools/verify_pbl.js'));
step('Square-1 OBL algs', () => node('tools/verify_obl.js'));
step('Skewb and Pyraminx algs', () => node('tools/verify_hcubist.js'));
step('scrambles (setup + alg = solved)', () => node('tools/test_scramble.js'));
step('sync API (no storage configured)', () => {
  // without the Redis variables the function must answer 503 and never throw
  const code = `const h=require('./api/sync.js');const res={h:{},setHeader(k,v){this.h[k]=v},end(b){console.log(this.statusCode+' '+b)}};h({method:'GET',url:'/api/sync?code=ABCD-EFGH',headers:{}},res)`;
  const r = spawnSync(process.execPath, ['-e', code], { cwd: root, encoding: 'utf8', env: { PATH: process.env.PATH } });
  if (!r.stdout.startsWith('503 ')) throw new Error('expected 503, got: ' + (r.stdout + r.stderr).trim());
  return '503 when not set up';
});
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
