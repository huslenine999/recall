// Builds data/themes.json from data/src/themes.js: every theme gets the full set of colour tokens.
// Tokens are derived in OKLab/OKLCH; then each contrast rule (WCAG 2) is checked and, where it fails,
// the token's OKLCH lightness is moved step by step until it passes. data/src/theme_report.txt lists every ratio.
// Run: node tools/make_themes.js   (exit code 1 if any theme still fails a hard rule)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const SRC = require(path.join(root, 'data/src/themes.js'));

// ---- colour math (sRGB <-> OKLab <-> OKLCH) ----
const toLin = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const toGam = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const rgbHex = rgb => '#' + rgb.map(v => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
function rgbLab([r, g, b]) {
  [r, g, b] = [r, g, b].map(toLin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function labRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map(toGam);
}
const lch = hex => { const [L, a, b] = rgbLab(hexRgb(hex)); return [L, Math.hypot(a, b), (Math.atan2(b, a) * 180 / Math.PI + 360) % 360]; };
const inGamut = rgb => rgb.every(v => v >= -1e-4 && v <= 1 + 1e-4);
function fromLch(L, C, H) { // out-of-gamut colours keep lightness and hue and lose chroma
  L = Math.min(1, Math.max(0, L)); const h = H * Math.PI / 180, at = c => labRgb([L, c * Math.cos(h), c * Math.sin(h)]);
  if (inGamut(at(C))) return rgbHex(at(C));
  let lo = 0, hi = C; for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (inGamut(at(mid))) lo = mid; else hi = mid; }
  return rgbHex(at(lo));
}
const mix = (x, y, t) => { const A = rgbLab(hexRgb(x)), B = rgbLab(hexRgb(y)); return rgbHex(labRgb(A.map((v, i) => v + (B[i] - v) * t))); }; // t of y, in OKLab
const lum = hex => { const [r, g, b] = hexRgb(hex).map(toLin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (x, y) => { const a = lum(x), b = lum(y); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
const dE = (x, y) => { const A = rgbLab(hexRgb(x)), B = rgbLab(hexRgb(y)); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };

// Move a colour's OKLCH lightness away from the backgrounds until it reaches `min` against all of them.
function ensure(hex, bgs, min) {
  const [L0, C, H] = lch(hex), up = bgs.every(b => lum(b) < 0.18) ? true : bgs.every(b => lum(b) >= 0.18) ? false : lum(hex) > 0.18;
  let L = L0, out = hex;
  for (let i = 0; i < 250 && Math.min(...bgs.map(b => contrast(out, b))) < min; i++) { L += up ? 0.004 : -0.004; if (L > 1 || L < 0) break; out = fromLch(L, C, H); }
  return { hex: out, moved: +(L - L0).toFixed(3) };
}
// Text for a filled colour: the darkest or lightest tint of its hue, whichever reads better; if neither reaches `min`, the fill moves.
function onFill(fill, min) {
  const [, C, H] = lch(fill), dark = fromLch(0.2, Math.min(C * 0.35, 0.04), H), light = fromLch(0.985, Math.min(C * 0.1, 0.012), H);
  let fg = contrast(dark, fill) >= contrast(light, fill) ? dark : light, f = fill, moved = 0;
  if (contrast(fg, f) < min) { const r = ensure(f, [fg], min); f = r.hex; moved = r.moved; }
  return { fill: f, fg, moved };
}

const STICKERS = { white: '#F4F5F7', yellow: '#FDE910', red: '#DD1E2A', orange: '#FF7A1A', blue: '#0E7AE5', green: '#1EC93B' }; // the diagrams' cube colours
const BASE = { // timer and status colours before tuning: the usual stackmat red / green
  dark: { hold: '#FF4D5E', ready: '#2EE59D', learned: '#4FE0A0', learning: '#FFC93C', danger: '#FF8089' },
  light: { hold: '#E5303F', ready: '#19CC82', learned: '#0F7A45', learning: '#946400', danger: '#C8283A' }
};
const NEAR = 0.1; // minimum OKLab distance between the accent and the holding / ready colours

const report = [], out = []; let failed = 0;
for (const [id, name, group, bg, surface, accent0, text0, note, extra = {}] of SRC) {
  const mode = group === 'special' ? extra.mode : group, dark = mode === 'dark', B = BASE[mode], log = [], fails = [], warns = [];
  const H = lch(accent0)[2];
  const check = (label, a, b, min, hard = true) => { const r = contrast(a, b); log.push(`${label} ${r.toFixed(2)}${r < min ? (hard ? ' FAIL' : ' below target') : ''}`); if (r < min) (hard ? fails : warns).push(label); return r; };
  const note2 = (what, m) => { if (m) log.push(`(${what} lightness ${m > 0 ? '+' : ''}${m})`); };

  // text: primary aims for 7:1 on page and cards (hard floor 4.5); secondary and muted 4.5:1 on cards
  let r = ensure(text0, [bg, surface], 7), textP = r.hex; note2('text-primary', r.moved);
  if (Math.min(contrast(textP, bg), contrast(textP, surface)) < 7) warns.push('text-primary below 7');
  r = ensure(mix(textP, surface, 0.25), [surface, bg], 4.5); const text2 = r.hex;
  r = ensure(mix(textP, surface, 0.45), [surface, bg], 4.5); const textM = r.hex;
  // surfaces: elevated (buttons, chips), hover, inset (timer and scramble well), borders
  const elevated = dark ? mix(surface, textP, 0.08) : mix(bg, textP, 0.055), hover = dark ? mix(surface, textP, 0.14) : mix(bg, textP, 0.1);
  const inset = extra.hc ? bg : dark ? mix(bg, '#000000', 0.35) : mix(surface, '#FFFFFF', 0.6);
  const borderS = extra.hc ? mix(surface, textP, 0.5) : mix(surface, textP, dark ? 0.13 : 0.16);
  r = ensure(mix(surface, textP, 0.38), [surface], 3); const borderX = r.hex;
  // accent and the text on it
  r = onFill(accent0, 4.5); const accent = r.fill, accentFg = r.fg; note2('accent', r.moved);
  const accentSoft = mix(surface, accent, dark ? 0.2 : 0.16);
  // best time and focus ring: the accent where it reads, else the accent moved until it does
  r = ensure(accent, [surface, bg], 4.5); const best = r.hex;
  const focus = contrast(accent, surface) >= 3 && contrast(accent, bg) >= 3 ? accent : best;
  // timer states; one-colour themes use brightness: dim accent while holding, full accent when ready
  let hold = extra.mono ? mix(accent, bg, 0.62) : B.hold, ready = extra.mono ? accent : B.ready;
  // keep the accent clearly apart from the holding and ready colours: if too close, the timer colour turns away from the accent's hue (the accent stays)
  const away = (c, minC) => { // turn c's hue away from the accent, re-checking contrast each step
    let x = ensure(c, [surface], minC).hex;
    const dir = ((lch(x)[2] - H + 540) % 360 - 180) >= 0 ? 1 : -1;
    for (let k = 0; k < 15 && dE(x, accent) < NEAR; k++) { const [L, C, h] = lch(x); x = ensure(fromLch(L, C, (h + dir * 6 + 360) % 360), [surface], minC).hex; }
    return x;
  };
  if (!extra.mono) hold = away(hold, 1);
  ready = extra.mono ? ensure(ready, [surface], 3).hex : away(ready, 4.5);
  const H1 = onFill(hold, 4.5); hold = H1.fill; const holdFg = H1.fg;
  const R1 = onFill(ready, 4.5); ready = R1.fill; const readyFg = R1.fg;
  // mastery and errors (shown as coloured words, so 4.5:1)
  const learned = ensure(extra.mono ? accent : B.learned, [surface, bg], 4.5).hex;
  const learning = ensure(extra.mono ? mix(accent, textP, 0.5) : B.learning, [surface, bg], 4.5).hex;
  const danger = ensure(extra.mono ? textP : B.danger, [surface, bg], 4.5).hex;
  // puzzles: dark plastic in every theme so all six sticker colours stay crisp; grey for stickers that are not part of a case
  const outline = fromLch(0.17, 0.008, H), body = outline;
  const ignored = dark ? fromLch(0.6, 0.018, H) : fromLch(0.68, 0.018, H);
  const glowA = extra.hc ? '0%' : dark ? '10%' : '7%';
  const [aL] = lch(accent);
  const tokens = {
    '--bg-base': bg, '--bg-surface': surface, '--bg-elevated': elevated, '--bg-hover': hover, '--bg-inset': inset, '--border-subtle': borderS, '--border-strong': borderX,
    '--text-primary': textP, '--text-secondary': text2, '--text-muted': textM,
    '--accent': accent, '--accent-soft': accentSoft, '--accent-fg': accentFg, '--focus-ring': focus, '--danger': danger,
    '--timer-idle': textP, '--timer-holding': hold, '--timer-holding-fg': holdFg, '--timer-ready': ready, '--timer-ready-fg': readyFg, '--timer-running': textP, '--timer-best': best,
    '--status-learned': learned, '--status-learning': learning, '--status-new': textM, '--trigger-bg': mix(surface, accent, dark ? 0.18 : 0.14), '--trigger-text': text2,
    '--puzzle-body': body, '--puzzle-outline': outline, '--puzzle-ignored': ignored,
    '--glow2': fromLch(Math.min(aL, 0.7), 0.12, (H + 120) % 360), '--glow3': fromLch(Math.min(aL, 0.68), 0.12, (H + 240) % 360), '--glow-a': glowA,
    '--scrim': dark ? 'rgba(0,0,0,.65)' : 'rgba(10,10,12,.5)'
  };

  // ---- the checks (hard rules fail the build) ----
  check('text/page', textP, bg, 4.5); check('text/card', textP, surface, 4.5);
  check('secondary/card', text2, surface, 4.5); check('muted/card', textM, surface, 4.5);
  check('accent-fg/accent', accentFg, accent, 4.5);
  check('timer-idle/card', textP, surface, 4.5); check('timer-ready/card', ready, surface, extra.mono ? 3 : 4.5); check('timer-best/card', best, surface, 4.5);
  check('holding-fg/holding', holdFg, hold, 4.5); check('ready-fg/ready', readyFg, ready, 4.5);
  check('learned/card', learned, surface, 4.5); check('learning/card', learning, surface, 4.5); check('danger/card', danger, surface, 4.5);
  check('border-strong/card', borderX, surface, 3); check('focus/card', focus, surface, 3);
  Object.entries(STICKERS).forEach(([k, v]) => check('sticker ' + k + '/outline', v, outline, 3));
  check('ignored/outline', ignored, outline, 3);
  if (!dark) check('outline/card', outline, surface, 3);
  if (!extra.mono) {
    const dh = dE(hold, accent), dr = dE(ready, accent);
    log.push(`accent apart from holding ${dh.toFixed(2)}, ready ${dr.toFixed(2)}`);
    if (dh < NEAR || dr < NEAR) fails.push('accent too close to a timer colour');
  }
  if (fails.length) failed++;
  report.push(`${fails.length ? 'FAIL' : 'pass'}  ${name} (${group}${extra.mono ? ', one colour' : ''})${fails.length ? ': ' + fails.join(', ') : ''}${warns.length ? '  [' + warns.join(', ') + ']' : ''}\n      ${log.join(' · ')}`);
  out.push({ id, name, group, mode, note, mono: !!extra.mono, swatch: [bg, surface, accent, textP], tokens });
}
// distinctness: no two themes should look alike (page, card, accent and text all close)
const near = [];
for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
  const a = out[i].swatch, b = out[j].swatch, d = Math.max(...a.map((x, k) => dE(x, b[k])));
  if (d < 0.06) near.push(`${out[i].name} ~ ${out[j].name} (${d.toFixed(3)})`);
}
const counts = ['dark', 'light', 'special'].map(g => `${out.filter(t => t.group === g).length} ${g}`).join(', ');
const head = `Recall themes: ${out.length} (${counts}). ${out.length - failed}/${out.length} pass every hard rule.\n` +
  `Targets: text 7:1 on page and cards (floor 4.5), secondary and muted text 4.5, text on accent 4.5, idle / ready / best timer colours 4.5 on cards,\n` +
  `text on the holding and ready fills 4.5, mastery and error words 4.5, strong borders and focus ring 3, every sticker colour 3 against the puzzle outline.\n` +
  (near.length ? `Look-alikes: ${near.join('; ')}\n` : 'No two themes look alike (every pair differs clearly in at least one of page, card, accent, text).\n');
fs.writeFileSync(path.join(root, 'data/themes.json'), JSON.stringify(out, null, 1));
fs.writeFileSync(path.join(root, 'data/src/theme_report.txt'), head + '\n' + report.join('\n') + '\n');
if (require.main === module) console.log(head.trim());
if (require.main === module && failed) process.exit(1);
module.exports = { failed, count: out.length };
