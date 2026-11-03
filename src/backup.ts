import { allReceipts, getFile, putFile, putReceipt } from './db';
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
  for (const [id, f] of Object.entries(data.files)) {
    const original = await fromB64(f.original);
    await putFile({ id, original, display: f.display ? await fromB64(f.display) : original, name: f.name });
  }
  for (const r of data.receipts) await putReceipt(r);
  return data.receipts.length;
}
