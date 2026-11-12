// Browser smoke test: opens the built page and clicks through the main paths. Needs Playwright (npm i -D playwright; npx playwright install chromium).
// Run from the project root after a build: node tools/smoke.js
const path = require('path');
const { chromium, devices } = require('playwright');
const url = 'file://' + path.resolve(__dirname, '../dist/index.html');
const fails = [];
const check = (name, ok, extra) => { console.log((ok ? '  ok   ' : '  FAIL ') + name + (ok || extra === undefined ? '' : ' -> ' + extra)); if (!ok) fails.push(name); };

async function desktop(browser) {
  console.log('desktop');
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  check('first visit shows the intro', await page.locator('.intro').count() === 1);
  await page.click('#introOk');
  check('intro stays closed after reload', (await page.reload(), await page.locator('.intro').count()) === 0);
  check('address shows the screen', page.url().endsWith('#mm/pll/train'), page.url());

  // one timed solve with the keyboard
  await page.keyboard.down('Space'); await page.waitForTimeout(450); await page.keyboard.up('Space');
  check('timer runs', await page.evaluate(() => document.body.dataset.phase) === 'running');
  await page.waitForTimeout(250); await page.keyboard.press('KeyA');
  check('solve is listed in the session', await page.locator('.solves li').count() === 1);
  await page.keyboard.press('KeyF');
  check('F shows the answer', await page.locator('.reveal .alg').count() > 0);
  await page.keyboard.press('Space');
  check('two entries after forgot', await page.locator('.solves li').count() === 2);

  // every set: the sheet algs pass the simulator. Known open item: EP 'H / W' (no flip) has an illegal slice in the data, so EP is 145 of 146.
  for (const [tab, set, n, ok = n] of [['mm', 'pll', 151], ['mm', 'oll', 257], ['sq', 'ep', 146, 145], ['sq', 'csp', 179], ['sq', 'pbl', 967]]) {
    await page.click('#tab-' + tab); await page.click(`[data-set="${set}"]`); await page.click('[data-s="cases"]');
    const count = await page.locator('.count').textContent();
    check(`${tab} ${set}: ${ok} of ${n} cases usable`, count.startsWith(`${ok} of ${n} `), count);
  }
  check('address follows the set', page.url().endsWith('#sq/pbl/cases'), page.url());

  // search
  await page.click('#tab-mm'); await page.click('[data-set="pll"]');
  await page.keyboard.press('/'); await page.keyboard.type('k1');
  await page.waitForTimeout(250);
  check('search narrows the cards and keeps focus', await page.locator('.tile').count() === 2 && await page.evaluate(() => document.activeElement.id) === 'q', await page.locator('.tile').count());
  await page.fill('#q', 'zzzz'); await page.waitForTimeout(250);
  check('empty search offers a way out', await page.locator('#qClear').count() === 1);
  await page.click('#qClear'); await page.waitForTimeout(250);
  check('clearing brings every card back', await page.locator('.tile').count() === 151);

  // card toggle, editor, focus return, Back
  await page.locator('.tile h3').first().click();
  check('clicking a card deselects it', (await page.locator('.count').textContent()).startsWith('150 of 151'));
  await page.locator('.tile h3').first().click();
  await page.locator('[data-edit]').first().click();
  check('editor opens with focus in the box', await page.evaluate(() => document.activeElement.id) === 'edtxt');
  await page.keyboard.press('Escape');
  check('Escape closes it and focus returns to Edit', await page.locator('.drawer').count() === 0 && await page.evaluate(() => !!document.activeElement.dataset.edit));
  await page.locator('[data-edit]').first().click(); await page.goBack();
  check('Back closes the editor', await page.locator('.drawer').count() === 0 && page.url().endsWith('#mm/pll/cases'), page.url());
  await page.goBack();
  check('Back again leaves the screen', !page.url().endsWith('#mm/pll/cases'), page.url());

  await page.goto(url + '#sq/csp/settings'); await page.reload();
  check('a link opens the right place', await page.locator('.settings').count() === 1 && await page.getAttribute('[data-set="csp"]', 'aria-selected') === 'true');
  check('no script errors', errors.length === 0, errors.join(' | '));
}

async function phone(browser) {
  console.log('phone');
  const page = await (await browser.newContext({ ...devices['iPhone 13'] })).newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(url); await page.tap('#introOk');
  const gap = await page.evaluate(() => document.querySelector('#hint').getBoundingClientRect().top - (r => r.top + r.height * 0.86)(document.querySelector('#digits').getBoundingClientRect()));
  check('timer hint sits clear of the digits', gap >= 0, gap);
  check('no sideways scroll', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.tap('[data-s="cases"]');
  check('cases screen has no sideways scroll', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  check('no script errors', errors.length === 0, errors.join(' | '));
}

(async () => {
  const browser = await chromium.launch();
  try { await desktop(browser); await phone(browser); } finally { await browser.close(); }
  console.log(fails.length ? `\n${fails.length} failed` : '\nall passed');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
