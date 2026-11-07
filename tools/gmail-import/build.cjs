// Builds a restore file (the app's backup format) from items.json, using the app's own code,
// so imported receipts look and behave exactly like ones entered on the phone.
// Usage: npx vite --port 5180 --strictPort &   then   node tools/gmail-import/build.cjs items.json out.json [http://localhost:5180/]
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const [src, out, base = 'http://localhost:5180/'] = process.argv.slice(2);
  const items = JSON.parse(fs.readFileSync(src, 'utf8'));
  const b = await chromium.launch();
  const ctx = await b.newContext({ acceptDownloads: true });
  await ctx.route('**/ai-menu.js', (r) => r.fulfill({ body: '', contentType: 'text/javascript' }));
  await ctx.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  const p = await ctx.newPage();
  await p.goto(base);
  await p.waitForSelector('.insight');
  const n = await p.evaluate(async (items) => {
    const st = await import('/src/store.ts');
    const db = await import('/src/db.ts');
    for (const it of items) {
      const id = await st.addMessage(it.text || it.item, it.store);
      const r = (await db.allReceipts()).find((x) => x.id === id);
      await db.putReceipt({
        ...r, id: 'gm-' + it.sourceId.replace(/^gmail:/, ''), item: it.item, store: it.store, category: it.category, date: it.date,
        amount: it.amount ?? null, currency: it.currency || 'ILS', amountOrig: it.amountOrig ?? null, rate: it.rate ?? null, rateDate: it.rateDate,
        kind: it.kind, sourceId: it.sourceId, source: 'email', notes: it.notes || '', link: it.link, returnDays: null, warrantyMonths: null,
        auto: {}, ocrText: [it.text, it.notes].filter(Boolean).join('\n'), updatedAt: Date.now(),
      });
      await db.deleteReceipt(id);
    }
    return (await db.allReceipts()).length;
  }, items);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.evaluate(async () => { const m = await import('/src/backup.ts'); await m.exportBackup(); })]);
  await dl.saveAs(out);
  console.log(`${n} receipts -> ${out}`);
  await b.close();
})();
