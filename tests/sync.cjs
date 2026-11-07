// Sync test against a simulated Supabase (no real account needed). Usage: node tests/sync.cjs <baseUrl>
const { chromium, devices } = require('playwright');
const path = require('path');
const base = process.argv[2] || 'http://localhost:4173/';
const shot = process.argv[3];
let failed = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failed++; };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const UID = '11111111-2222-3333-4444-555555555555';
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, email: 'anat@test', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
const row = (id, item, store, amount, date, extra = {}) => ({ id, deleted: false, updated_at: new Date().toISOString(), data: { id, item, store, category: 'בינה מלאכותית', date, amount, kind: 'subscription', source: 'email', sourceId: 'gmail:' + id, ocrText: `${item}\n${store}`, fileId: 'f-' + id, thumb: '', notes: '', auto: {}, createdAt: 1, updatedAt: 1, ...extra } });
const rows = [
  row('gm-a', 'מנוי Google AI Pro', 'Google Play', 74.9, '2026-10-27'), row('gm-b', 'מנוי Google AI Pro', 'Google Play', 74.9, '2026-09-27'),
  row('gm-c', 'מנוי Supabase Pro', 'Supabase', 75.42, '2026-09-23', { currency: 'USD', amountOrig: 25 }), row('gm-d', 'מנוי Supabase Pro', 'Supabase', 111.44, '2026-10-23', { currency: 'USD', amountOrig: 35.81 }),
];

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['Pixel 7'] });
  await ctx.route('**/ai-menu.js', (r) => r.fulfill({ path: path.join(__dirname, 'ai-menu.js'), contentType: 'text/javascript' }));
  await ctx.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  const upserts = []; const uploads = [];
  await ctx.route(/supabase\.co/, async (r) => {
    const u = r.request().url(); const m = r.request().method();
    const json = (body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (m === 'OPTIONS') return json({});
    if (u.includes('/auth/v1/token')) {
      const body = JSON.parse(r.request().postData() || '{}');
      if (body.password !== 'right') return json({ error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials' }, 400);
      return json({ access_token: jwt, refresh_token: 'r', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: { id: UID, email: 'anat@test', aud: 'authenticated', role: 'authenticated' } });
    }
    if (u.includes('/auth/v1/user')) return json({ id: UID, email: 'anat@test', aud: 'authenticated', role: 'authenticated' });
    if (u.includes('/rest/v1/kabalot_receipts')) {
      if (m === 'GET' && u.includes('updated_at')) return json(rows);
      if (m === 'GET') return json(rows.map((x) => ({ id: x.id, updatedAt: x.data.updatedAt })));
      if (m === 'POST') { upserts.push(...JSON.parse(r.request().postData() || '[]')); return json([], 201); }
    }
    if (u.includes('/storage/v1/object')) { if (m === 'POST' || m === 'PUT') { uploads.push(u); return json({ Key: 'x' }); } return json({ error: 'not found' }, 400); }
    return json({});
  });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(base);
  await p.waitForSelector('.insight');
  ok(await p.locator('.signin-card >> text=כניסה לחשבון').isVisible(), 'empty app offers sign-in, not an empty page');
  await p.click('.signin-card >> text=כניסה לחשבון');
  ok(await p.locator('input[autocomplete=current-password]').isVisible(), 'password field with autofill hint');
  await p.fill('input[autocomplete=current-password]', 'wrong');
  await p.click('.sheet >> button:has-text("כניסה")');
  await p.waitForSelector('.sheet-note');
  ok((await p.locator('.sheet-note').innerText()).includes('לא נכונים'), 'wrong password explained in Hebrew');
  await p.click('.showpass');
  ok((await p.locator('input[name=password]').getAttribute('type')) === 'text', 'show password works');
  await p.fill('input[name=password]', 'right');
  await p.click('.sheet >> button:has-text("כניסה")');
  await p.waitForSelector('.card', { timeout: 10000 });
  ok((await p.locator('.card').count()) === 4, 'receipts arrived from the account');
  await p.waitForFunction(() => [...document.querySelectorAll('.thumb img')].length === 4, null, { timeout: 15000 }).catch(() => {});
  ok((await p.locator('.thumb img').count()) === 4, 'pictures drawn for receipts that came without one');
  ok((await p.locator('.alert.rise').count()) === 1, 'price-rise alert for Supabase');
  ok((await p.locator('.local-note').count()) === 0, 'no "only on this device" note when signed in');
  await p.waitForTimeout(1500);
  ok(upserts.length >= 4, `changes sent back to the account (${upserts.length} rows)`);
  ok(uploads.length >= 4, `pictures uploaded to the private bucket (${uploads.length})`);
  ok(upserts.every((x) => x.owner === UID), 'every row is written under the owner');
  if (shot) await p.screenshot({ path: shot });
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await b.close();
  console.log(failed ? `${failed} FAILED` : 'ALL GREEN');
  process.exit(failed ? 1 : 0);
})();
