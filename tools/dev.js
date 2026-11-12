// Dev server: builds, serves dist/ on http://localhost:5173, rebuilds when src/ or data/ change and reloads the open page.
// No dependencies. Run from the project root: npm run dev   (PORT=8080 npm run dev for another port)
// /api/sync is answered by the real function in api/sync.js; without the Redis variables it replies "not set up", like a bare deploy.
const http = require('http'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const root = path.resolve(__dirname, '..'), dist = path.join(root, 'dist'), port = +process.env.PORT || 5173;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const RELOAD = '<script>new EventSource("/__reload").onmessage=()=>location.reload()</script>';
const clients = new Set();
let lastError = '';

function build() {
  const t = Date.now();
  try { const out = execFileSync(process.execPath, ['build.js'], { cwd: root, encoding: 'utf8' }); lastError = ''; console.log(new Date().toLocaleTimeString(), out.trim(), `(${Date.now() - t} ms)`); }
  catch (e) { lastError = (e.stderr || e.message || '').toString(); console.error('\nBuild failed:\n' + lastError); }
  clients.forEach(res => res.write('data: reload\n\n'));
}
let timer = null;
const changed = () => { clearTimeout(timer); timer = setTimeout(build, 80); };
['src', 'data'].forEach(d => fs.watch(path.join(root, d), { recursive: true }, changed));
fs.watch(path.join(root, 'build.js'), changed);
build();

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/__reload') { res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' }); res.write('\n'); clients.add(res); req.on('close', () => clients.delete(res)); return; }
  if (url.pathname === '/api/sync') { delete require.cache[require.resolve('../api/sync.js')]; return require('../api/sync.js')(req, res); }
  if (url.pathname === '/sw.js') { res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' }); return res.end('// no service worker in dev, so a reload always shows the latest build\nself.addEventListener("install",()=>self.skipWaiting());self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.map(n=>caches.delete(n)))).then(()=>self.registration.unregister())));'); }
  const file = path.join(dist, url.pathname === '/' ? 'index.html' : path.normalize(decodeURIComponent(url.pathname)));
  if (!file.startsWith(dist)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    const type = TYPES[path.extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    if (type.startsWith('text/html')) {
      const banner = lastError ? `<pre style="position:fixed;inset:0 0 auto 0;z-index:999;margin:0;padding:12px 16px;background:#B8262F;color:#fff;font:13px/1.5 monospace;white-space:pre-wrap;max-height:50vh;overflow:auto">Build failed (this page is the last good build)\n\n${lastError.replace(/[&<]/g, c => ({ '&': '&amp;', '<': '&lt;' }[c]))}</pre>` : '';
      return res.end(buf.toString('utf8').replace('</body>', banner + RELOAD + '</body>'));
    }
    res.end(buf);
  });
}).listen(port, () => {
  console.log(`\nRecall dev server: http://localhost:${port}`);
  const nets = Object.values(require('os').networkInterfaces()).flat().filter(n => n && n.family === 'IPv4' && !n.internal);
  nets.forEach(n => console.log(`On your phone (same wifi): http://${n.address}:${port}`));
  console.log('Edit src/ or data/ and the page reloads.\n');
});
