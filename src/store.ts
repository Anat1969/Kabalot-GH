import { useCallback, useEffect, useState } from 'react';
import { allReceipts, persist, putFile, putReceipt, uid } from './db';
import { prepare } from './files';
import { readText } from './ocr';
import { parseMessage, parseReceipt } from './parse';
import { messageImage } from './files';
import { guessCategory } from './categories';
import { todayISO } from './dates';
import type { Receipt } from './types';

type Listener = () => void;
const listeners = new Set<Listener>();
export const notify = () => listeners.forEach((l) => l());

/** Receipts currently being read by OCR. */
export const reading = new Set<string>();

export function useReceipts() {
  const [list, setList] = useState<Receipt[] | null>(null);
  const reload = useCallback(() => { allReceipts().then(setList).catch(() => setList([])); }, []);
  useEffect(() => {
    reload();
    listeners.add(reload);
    return () => { listeners.delete(reload); };
  }, [reload]);
  return list;
}

export function blankReceipt(): Receipt {
  const now = Date.now();
  return {
    id: uid(), item: '', store: '', category: 'אחר', date: todayISO(), amount: null, returnDays: 14, warrantyMonths: 12,
    notes: '', ocrText: '', fileId: null, fileType: '', thumb: '', auto: {}, createdAt: now, updatedAt: now,
  };
}

/** Saves the files right away, then reads them in the background and fills what is still empty. */
export async function addFiles(files: Blob[], names: string[] = []): Promise<string[]> {
  persist();
  const ids: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const p = await prepare(f);
    const fileId = uid();
    await putFile({ id: fileId, original: p.original, display: p.display, name: names[i] || (f as File).name || 'קבלה' });
    const r = { ...blankReceipt(), fileId, fileType: p.original.type || 'image/jpeg', thumb: p.thumb };
    await putReceipt(r);
    ids.push(r.id);
    reading.add(r.id);
    notify();
    void readInto(r.id, p.ocrSource);
  }
  return ids;
}

async function readInto(id: string, image: Blob, keep = '') {
  try {
    const text = await readText(image);
    const parsed = parseReceipt(text);
    const cur = (await allReceipts()).find((x) => x.id === id);
    if (!cur) return;
    const fresh = cur.updatedAt === cur.createdAt; // nothing typed yet
    const next: Receipt = { ...cur, ocrText: keep ? keep + '\n' + text : text, auto: { ...cur.auto } };
    if (parsed.store && !cur.store) { next.store = parsed.store; next.auto.store = true; }
    if (parsed.amount != null && cur.amount == null) { next.amount = parsed.amount; next.auto.amount = true; }
    if (parsed.date && (fresh || !cur.date || cur.date === todayISO())) { next.date = parsed.date; next.auto.date = true; }
    if (cur.category === 'אחר') next.category = guessCategory(text + ' ' + cur.item) ?? 'אחר';
    await putReceipt(next);
  } catch {
    /* reading failed or timed out: the receipt is saved, fields stay for typing */
  } finally {
    reading.delete(id);
    notify();
  }
}

/** A receipt that arrived as a text message: the text itself is the receipt, plus its link. */
export async function addMessage(text: string): Promise<string> {
  persist();
  const p = parseMessage(text);
  const img = await messageImage(text, p.store);
  const fileId = uid();
  await putFile({ id: fileId, original: img.display, display: img.display, name: 'הודעה' });
  const r: Receipt = {
    ...blankReceipt(), fileId, fileType: 'image/jpeg', thumb: img.thumb, ocrText: text, source: 'message', link: p.link,
    store: p.store ?? '', amount: p.amount ?? null, date: p.date ?? todayISO(),
    auto: { store: !!p.store, amount: p.amount != null, date: !!p.date },
  };
  r.category = guessCategory(text) ?? 'אחר';
  await putReceipt(r);
  notify();
  return r.id;
}

/** Puts a photo or PDF on an existing receipt (for example a screenshot of the digital receipt). */
export async function attachFile(r: Receipt, file: Blob) {
  const p = await prepare(file);
  const fileId = uid();
  await putFile({ id: fileId, original: p.original, display: p.display, name: (file as File).name || 'קבלה' });
  const { deleteFile } = await import('./db');
  if (r.fileId) await deleteFile(r.fileId).catch(() => {});
  await putReceipt({ ...r, fileId, fileType: p.original.type || 'image/jpeg', thumb: p.thumb, updatedAt: Date.now() });
  notify();
  reading.add(r.id);
  void readInto(r.id, p.ocrSource, r.ocrText);
}
