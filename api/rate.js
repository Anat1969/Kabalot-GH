// Bank of Israel representative exchange rate for a date (the last published rate on or before it).
// GET /api/rate?cur=USD&date=2026-10-23 -> { cur, date, rate, source }
export default async function handler(req, res) {
  const cur = String(req.query.cur || 'USD').toUpperCase();
  const date = String(req.query.date || '');
  if (!['USD', 'EUR', 'JPY'].includes(cur) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: 'cur must be USD, EUR or JPY, date YYYY-MM-DD' });
    return;
  }
  const d = new Date(date + 'T12:00:00Z');
  const start = new Date(d.getTime() - 10 * 86400000).toISOString().slice(0, 10);
  const url = `https://edge.boi.org.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/EXR/1.0/RER_${cur}_ILS?startperiod=${start}&endperiod=${date}&format=csv`;
  try {
    const r = await fetch(url);
    const text = await r.text();
    const rows = text.trim().split('\n').slice(1).map((l) => l.split(','));
    const last = rows.filter((c) => c[12] && c[13]).pop();
    if (!last) { res.status(404).json({ error: 'no rate published for this period' }); return; }
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    // The bank quotes some currencies per 10^UNIT_MULT units (yen: per 100). Return the rate for 1 unit.
    const per = 10 ** Number(last[10] || 0);
    res.status(200).json({ cur, date: last[12], rate: Number(last[13]) / per, source: 'בנק ישראל, שער יציג' });
  } catch (e) {
    res.status(502).json({ error: 'Bank of Israel did not answer' });
  }
}
