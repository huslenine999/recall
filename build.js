// Builds dist/index.html: one self-contained file (data + engines + app inline).
const fs = require('fs');
const read = p => fs.readFileSync(p, 'utf8');
const wrap = (code) => code.replace(/<\/script/gi, '<\\/script');
let html = read('src/index.template.html');
// fonts are embedded as base64 so dist/index.html stays one offline file
const font = (fam, file, weight, stretch) => `@font-face{font-family:"${fam}";src:url(data:font/woff2;base64,${fs.readFileSync('src/fonts/' + file).toString('base64')}) format("woff2");font-weight:${weight};font-stretch:${stretch};font-style:normal;font-display:swap}`;
const fonts = font('Bricolage', 'bricolage-grotesque-latin-wght-normal.woff2', '200 800', '100%') + font('Martian', 'martian-mono-latin-standard-normal.woff2', '100 800', '75% 112.5%');
// data: fields the app does not use are dropped, and each set is embedded as JSON.parse('...'), which browsers parse faster than a big object literal
const pick = (file, keys) => JSON.parse(read(file)).map(r => Object.fromEntries(keys.map(k => [k, r[k]])));
const embed = (name, rows) => `const ${name}=JSON.parse(${JSON.stringify(JSON.stringify(rows))});`;
const data = [
  embed('DATA_MM', pick('data/megaminx.json', ['id', 'set', 'alg'])),
  embed('DATA_OLL', pick('data/megaminx_oll.json', ['id', 'set', 'algs', 'cls'])),
  embed('DATA_SQ', pick('data/square1_ep.json', ['u', 'd', 'parity', 'algsNoFlip', 'algsFlip', 'note'])),
  embed('DATA_CSP', pick('data/square1_csp.json', ['n', 'name', 'section', 'parity', 'alg', 'key'])),
  embed('DATA_OBL', pick('data/square1_obl.json', ['id', 'slashes', 'alg', 'cls'])),
  embed('DATA_SKNS', pick('data/skewb_ns.json', ['id', 'group', 'algs', 'cls'])),
  embed('DATA_SKSA', pick('data/skewb_sa.json', ['id', 'group', 'algs', 'cls'])),
  embed('DATA_PYL4E', pick('data/pyraminx_l4e.json', ['id', 'group', 'algs', 'cls'])),
  embed('DATA_PBL', pick('data/square1_pbl.json', ['id', 'top', 'bot', 'slices', 'alg', 'ct', 'cb']))
].join('\n');
const engines = ['src/palettes.js', 'src/megaminx.js', 'src/square1.js', 'src/skewb.js', 'src/pyraminx.js', 'src/diagram.js', 'src/scramble.js'].map(read).join('\n');
// replacer functions: avoid '$' patterns in code being interpreted
html = html.replace('/*__FONTS__*/', () => fonts).replace('/*__DATA__*/', () => wrap(data)).replace('/*__ENGINES__*/', () => wrap(engines)).replace('/*__APP__*/', () => wrap(read('src/app.js')));
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.html', html);
// installable + offline: manifest, icons and a service worker whose cache name changes with every build
const buildId = require('crypto').createHash('sha1').update(html).digest('hex').slice(0, 10);
const manifest = {
  id: './', name: 'Recall: Algorithm Trainer', short_name: 'Recall', description: 'Alg trainer for Megaminx, Square-1, Skewb and Pyraminx.',
  start_url: './', scope: './', display: 'standalone', background_color: '#100F14', theme_color: '#100F14',
  icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }, { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }]
};
fs.writeFileSync('dist/manifest.webmanifest', JSON.stringify(manifest, null, 1));
fs.writeFileSync('dist/sw.js', read('src/sw.js').replace('__BUILD__', buildId));
fs.readdirSync('src/icons').forEach(f => fs.copyFileSync('src/icons/' + f, 'dist/' + f));
console.log('dist/index.html', (html.length / 1024).toFixed(0) + ' KB');
