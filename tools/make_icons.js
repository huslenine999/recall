// Renders the app icons (src/icons/*.png and favicon.svg) from one SVG. Needs Playwright:  node tools/make_icons.js
const fs = require('fs'), path = require('path');
const INK = '#1B1A2B', GOLD = '#FFC93C';
// a "recall" ring (an arrow that loops back) around a pentagon (Megaminx) and a turned square (Square-1)
const glyph = `
  <g fill="none" stroke="${GOLD}" stroke-width="30" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 310.7 105.6 A 160 160 0 1 1 153.1 133.4"/>
    <path d="M 141.5 188.2 L 153.1 133.4 L 97.1 135.4"/>
  </g>
  <polygon points="256,188 322,236 297,314 215,314 190,236" fill="${GOLD}"/>
  <rect x="236" y="246" width="40" height="40" rx="6" fill="${INK}" transform="rotate(15 256 266)"/>`;
const svg = (bg, scale, round) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" ${round ? 'rx="112"' : ''} fill="${bg}"/><g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${glyph}</g></svg>`;
const out = path.join(__dirname, '..', 'src', 'icons');
fs.writeFileSync(path.join(out, 'favicon.svg'), svg(INK, 1, true));
(async () => {
  const { chromium } = require('playwright'); const b = await chromium.launch(); const p = await b.newPage();
  const shot = async (file, size, markup) => { await p.setViewportSize({ width: size, height: size }); await p.setContent(`<body style="margin:0">${markup.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`); await p.screenshot({ path: path.join(out, file), omitBackground: true }); };
  await shot('icon-192.png', 192, svg(INK, 1, true));
  await shot('icon-512.png', 512, svg(INK, 1, true));
  await shot('icon-maskable-512.png', 512, svg(INK, 0.78, false)); // full-bleed, glyph inside the safe zone
  await shot('apple-touch-icon.png', 180, svg(INK, 0.9, false));   // iOS rounds the corners itself
  await b.close();
})();
