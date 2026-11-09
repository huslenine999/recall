// Builds dist/index.html: one self-contained file (data + engines + app inline).
const fs = require('fs');
const read = p => fs.readFileSync(p, 'utf8');
const wrap = (code) => code.replace(/<\/script/gi, '<\\/script');
let html = read('src/index.template.html');
const data = `const DATA_MM=${JSON.stringify(JSON.parse(read('data/megaminx.json')))};\nconst DATA_SQ=${JSON.stringify(JSON.parse(read('data/square1_ep.json')))};`;
const engines = ['src/megaminx.js', 'src/square1.js', 'src/diagram.js', 'src/scramble.js'].map(read).join('\n');
// replacer functions: avoid '$' patterns in code being interpreted
html = html.replace('/*__DATA__*/', () => wrap(data)).replace('/*__ENGINES__*/', () => wrap(engines)).replace('/*__APP__*/', () => wrap(read('src/app.js')));
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.html', html);
console.log('dist/index.html', (html.length / 1024).toFixed(0) + ' KB');
