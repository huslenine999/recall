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
  embed('DATA_SQ', pick('data/square1_ep.json', ['u', 'd', 'parity', 'algsNoFlip', 'algsFlip', 'note'])),
  embed('DATA_CSP', pick('data/square1_csp.json', ['n', 'name', 'section', 'parity', 'alg', 'key'])),
  embed('DATA_PBL', pick('data/square1_pbl.json', ['id', 'top', 'bot', 'slices', 'alg', 'ct', 'cb']))
].join('\n');
const engines = ['src/palettes.js', 'src/megaminx.js', 'src/square1.js', 'src/diagram.js', 'src/scramble.js'].map(read).join('\n');
// replacer functions: avoid '$' patterns in code being interpreted
html = html.replace('/*__FONTS__*/', () => fonts).replace('/*__DATA__*/', () => wrap(data)).replace('/*__ENGINES__*/', () => wrap(engines)).replace('/*__APP__*/', () => wrap(read('src/app.js')));
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.html', html);
console.log('dist/index.html', (html.length / 1024).toFixed(0) + ' KB');
