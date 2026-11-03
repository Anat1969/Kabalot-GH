// End-to-end check on the built app. Usage: node tests/e2e.cjs <baseUrl> [shotsDir]
const { chromium, devices } = require('playwright');
const path = require('path');
const fs = require('fs');
const base = process.argv[2] || 'http://localhost:4173';
const shots = process.argv[3] || 'test-results';
fs.mkdirSync(shots, { recursive: true });
let failed = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failed++; };

(async () => {
  const b = await chromium.launch();
  for (const [name, opts] of [['phone', devices['Pixel 7']], ['desktop', { viewport: { width: 1280, height: 860 } }]]) {
    const ctx = await b.newContext({ ...opts, locale: 'he-IL' });
    await ctx.route('**/ai-menu.js', (r) => r.fulfill({ path: path.join(__dirname, 'ai-menu.js'), contentType: 'text/javascript' }));
    await ctx.route(/tesseract|tessdata|jsdelivr/, (r) => r.abort());
    const p = await ctx.newPage();
    const errors = [];
    // OCR engine is blocked here on purpose (simulates a phone offline); the app must keep working without it.
    p.on('pageerror', (e) => { if (!/tesseract|importScripts/.test(e.message)) errors.push(e.message); });
    await p.goto(base);
    await p.waitForSelector('.insight');
    ok(await p.locator('ai-menu .logo').isVisible(), `${name}: A&I logo button in the top bar`);
    ok(!(await p.locator('header >> text=העתקת קישור').first().isVisible().catch(() => false)), `${name}: no loose development buttons in the bar`);
    ok(await p.locator('text=הצגת דוגמה').isVisible(), `${name}: empty state explains and offers a demo`);
    await p.screenshot({ path: `${shots}/${name}-0-empty.png` });

    await p.click('text=הצגת דוגמה');
    await p.waitForSelector('.card');
    ok((await p.locator('.card').count()) === 6, `${name}: 6 demo receipts shown`);
    ok(await p.locator('.group-h').first().isVisible(), `${name}: grouped by item type with headers`);
    await p.screenshot({ path: `${shots}/${name}-1-home.png` });

    await p.fill('input[type=search]', 'אוזניות');
    ok((await p.locator('.card').count()) === 1, `${name}: search by item finds one receipt`);
    await p.fill('input[type=search]', 'מקדחים');
    ok((await p.locator('.card').count()) === 1, `${name}: search by a note word finds it`);
    await p.fill('input[type=search]', '');

    await p.click('.card >> nth=0 >> .card-head');
    ok(await p.locator('.peek').isVisible(), `${name}: tapping opens the receipt in place`);
    ok((await p.locator('.card').count()) === 6, `${name}: the rest of the list stays visible`);
    await p.screenshot({ path: `${shots}/${name}-2-peek.png` });
    await p.click('.peek >> text=הצגה למוכרת');
    await p.waitForSelector('.show img');
    ok(await p.locator('.show-amount').isVisible(), `${name}: show mode with amount`);
    await p.screenshot({ path: `${shots}/${name}-3-show.png` });
    await p.click('.show >> text=סגירה');
    await p.waitForSelector('.show', { state: 'detached' });

    await p.click('.seg >> text=טבלה');
    await p.waitForSelector('.tbl');
    await p.click('.th >> text=עלות');
    const first = await p.locator('.tbl tbody tr.tr >> nth=0 >> td.strong').innerText();
    ok(first.includes('1,290'), `${name}: table sorted by cost, most expensive first (${first})`);
    ok(await p.locator('text=ממוין לפי').isVisible(), `${name}: sort line says how the list is sorted`);
    ok((await p.locator('tfoot').innerText()).includes('₪'), `${name}: table total`);
    await p.screenshot({ path: `${shots}/${name}-4-table.png` });
    await p.click('.seg >> text=אפשר להחזיר');
    const n = await p.locator('.tbl tbody tr.tr').count();
    ok(n >= 1 && n < 6, `${name}: filter "can return" narrows the list (${n})`);
    await p.click('.seg >> text=הכול');
    await p.click('.seg >> text=לפי חפץ');

    // add a new receipt from a file
    const img = await p.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 300; c.height = 500;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 300, 500); g.fillStyle = '#000'; g.font = '24px sans-serif'; g.fillText('TEST', 100, 100);
      return c.toDataURL('image/jpeg').split(',')[1];
    });
    await p.setInputFiles('[data-testid=gallery-input]', { name: 'r.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(img, 'base64') });
    await p.waitForSelector('.editor');
    await p.fill('.ed-form input >> nth=0', 'מטען לטלפון');
    await p.fill('.ed-form input[inputmode=decimal]', '79.9');
    await p.waitForTimeout(700);
    ok((await p.locator('.chip.cat[aria-pressed=true]').innerText()).includes('אלקטרוניקה'), `${name}: category guessed from the item name`);
    await p.screenshot({ path: `${shots}/${name}-5-editor.png` });
    await p.click('text=סיום, לכל הקבלות');
    await p.fill('input[type=search]', 'מטען');
    await p.waitForTimeout(200);
    ok((await p.locator('.card').count()) === 1, `${name}: new receipt saved and found by search`);
    await p.reload();
    await p.fill('input[type=search]', 'מטען');
    ok((await p.locator('.card').count()) === 1, `${name}: still there after reload`);

    const sw = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(sw <= 0, `${name}: no horizontal page scroll (${sw})`);
    ok(errors.length === 0, `${name}: no page errors ${errors.join(' | ')}`);
    await ctx.close();
  }
  await b.close();
  console.log(failed ? `${failed} FAILED` : 'ALL GREEN');
  process.exit(failed ? 1 : 0);
})();
