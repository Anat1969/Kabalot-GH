import { allReceipts, getFile, putFile, putReceipt } from './db';

/** Same receipt seen twice (imported again, or the same email): matched by source id, link, or id. */
const keysOf = (r: Receipt) => [r.sourceId, r.link && r.link.includes('mail.google.com') ? r.link.replace(/\|.*$/, '') : ''].filter(Boolean) as string[];
import { todayISO } from './dates';
import type { Receipt } from './types';

const toB64 = (b: Blob) => new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(b); });
const fromB64 = async (s: string) => (await fetch(s)).blob();

export async function exportBackup() {
  const receipts = (await allReceipts()).filter((r) => !r.demo);
  const files: Record<string, { original: string; display: string; name: string }> = {};
  for (const r of receipts) if (r.fileId) {
    const f = await getFile(r.fileId);
    if (f) files[r.fileId] = { original: await toB64(f.original), display: f.original === f.display ? '' : await toB64(f.display), name: f.name };
  }
  const blob = new Blob([JSON.stringify({ app: 'kabalot', version: 1, exported: new Date().toISOString(), receipts, files })], { type: 'application/json' });
  const name = `קבלות-גיבוי-${todayISO()}.json`;
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'גיבוי קבלות' }); return receipts.length; } catch { /* fall back to download */ }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return receipts.length;
}

export async function importBackup(file: File) {
  const data = JSON.parse(await file.text()) as { app: string; receipts: Receipt[]; files: Record<string, { original: string; display: string; name: string }> };
  if (data.app !== 'kabalot') throw new Error('not a backup');
  const existing = await allReceipts();
  const seen = new Set(existing.flatMap(keysOf));
  const byKey = new Map(existing.flatMap((r) => keysOf(r).map((k) => [k, r] as const)));
  const empty = (v: unknown) => v == null || v === '' || (typeof v === 'object' && !Object.keys(v as object).length);
  const ids = new Set(existing.map((r) => r.id));
  let added = 0, skipped = 0, updated = 0;
  for (const r of data.receipts) {
    const ks = keysOf(r);
    if (ids.has(r.id) || ks.some((k) => seen.has(k))) {
      // Same receipt: fill only what is still empty there (never overwrite what was typed).
      const cur = ks.map((k) => byKey.get(k)).find(Boolean) ?? existing.find((x) => x.id === r.id);
      if (cur) {
        const fill: Partial<Receipt> = {};
        for (const k of ['amount', 'currency', 'amountOrig', 'rate', 'rateDate', 'kind', 'sourceId', 'link'] as const) {
          if (empty(cur[k]) && !empty(r[k])) (fill as Record<string, unknown>)[k] = r[k];
        }
        if (['אחר', 'מנויים ושירותים'].includes(cur.category) && r.category && !['אחר', 'מנויים ושירותים'].includes(r.category)) fill.category = r.category;
        if (Object.keys(fill).length) { await putReceipt({ ...cur, ...fill, updatedAt: Date.now() }); updated++; continue; }
      }
      skipped++; continue;
    }
    ks.forEach((k) => seen.add(k));
    const f = r.fileId ? data.files[r.fileId] : undefined;
    if (f && r.fileId) {
      const original = await fromB64(f.original);
      await putFile({ id: r.fileId, original, display: f.display ? await fromB64(f.display) : original, name: f.name });
    }
    await putReceipt(r);
    added++;
  }
  return { added, skipped, updated };
}
