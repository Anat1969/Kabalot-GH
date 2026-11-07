/** Private sync across devices: the phone and the computer show the same receipts.
 *  Supabase (shared project), table kabalot_receipts and bucket kabalot-files, both owner-only by RLS.
 *  Local IndexedDB stays the working copy; the cloud is mirrored both ways, newest change wins. */
import { createClient, type Session } from '@supabase/supabase-js';
import { allReceipts, deleteFile, deleteReceipt, getFile, putFile, putReceipt, setChangeHook } from './db';
import { notify } from './store';
import type { Receipt, StoredFile } from './types';
import { messageImage } from './files';

const URL_ = 'https://ktqmwpbzcnzkhjskqisy.supabase.co';
const KEY = 'sb_publishable_IkreG7naPa1h-d4kGp1gpA_sLU4tg5q';
export const sb = createClient(URL_, KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'kabalot-auth' } });

export type CloudState = { status: 'out' | 'syncing' | 'synced' | 'error'; email?: string; at?: number; message?: string };
let state: CloudState = { status: 'out' };
const subs = new Set<(s: CloudState) => void>();
const set = (s: Partial<CloudState>) => { state = { ...state, ...s }; subs.forEach((f) => f(state)); };
export const cloudState = () => state;
export const onCloud = (f: (s: CloudState) => void) => { subs.add(f); return () => { subs.delete(f); }; };

let uid: string | null = null;
let timer: number | undefined;
const queue = new Map<string, { id: string; data: unknown; deleted: boolean }>();
const lastKey = () => `kabalot.lastPull.${uid}`;

async function flush() {
  if (!uid || !queue.size) return;
  const rows = [...queue.values()].map((r) => ({ ...r, owner: uid, updated_at: new Date().toISOString() }));
  queue.clear();
  set({ status: 'syncing' });
  const { error } = await sb.from('kabalot_receipts').upsert(rows, { onConflict: 'owner,id' });
  if (error) { rows.forEach((r) => queue.set(r.id, r)); set({ status: 'error', message: 'לא נשמר בחשבון. מנסה שוב.' }); return; }
  set({ status: 'synced', at: Date.now(), message: undefined });
}
const later = () => { window.clearTimeout(timer); timer = window.setTimeout(flush, 700); };

async function uploadFile(f: StoredFile) {
  if (!uid) return;
  const up = (path: string, b: Blob) => sb.storage.from('kabalot-files').upload(path, b, { upsert: true, contentType: b.type || 'application/octet-stream' });
  await up(`${uid}/${f.id}`, f.display);
  if (f.original !== f.display) await up(`${uid}/${f.id}.orig`, f.original);
}

/** Brings a file from the cloud when this device does not have it yet. */
export async function fetchFile(fileId: string): Promise<StoredFile | null> {
  if (!uid) return null;
  const { data: display } = await sb.storage.from('kabalot-files').download(`${uid}/${fileId}`);
  if (!display) return null;
  const { data: orig } = await sb.storage.from('kabalot-files').download(`${uid}/${fileId}.orig`);
  const f: StoredFile = { id: fileId, display, original: orig ?? display, name: 'קבלה' };
  await putFile(f, true);
  return f;
}

export async function pull() {
  if (!uid) return;
  set({ status: 'syncing' });
  const since = localStorage.getItem(lastKey()) ?? '1970-01-01T00:00:00Z';
  const { data, error } = await sb.from('kabalot_receipts').select('id,data,deleted,updated_at').gt('updated_at', since).order('updated_at').limit(5000);
  if (error) { set({ status: 'error', message: 'החשבון לא ענה. הקבלות שבמכשיר זמינות.' }); return; }
  const local = new Map((await allReceipts()).map((r) => [r.id, r]));
  let changed = 0;
  for (const row of data ?? []) {
    const mine = local.get(row.id);
    if (row.deleted) {
      if (mine) { await deleteReceipt(row.id, true); if (mine.fileId) await deleteFile(mine.fileId); changed++; }
    } else {
      const r = row.data as Receipt;
      if (!mine || (r.updatedAt ?? 0) > (mine.updatedAt ?? 0)) { await putReceipt(r, true); changed++; }
    }
    localStorage.setItem(lastKey(), row.updated_at);
  }
  if (changed) notify();
  set({ status: 'synced', at: Date.now(), message: undefined });
  void drawMissingPictures();
}

/** Receipts that arrived without a picture (e.g. loaded straight from the email) get one drawn from their text. */
async function drawMissingPictures() {
  for (const r of await allReceipts()) {
    if (r.thumb || !(r.source === 'email' || r.source === 'message') || !r.ocrText) continue;
    const img = await messageImage(r.ocrText, r.store, r.source, r.date);
    const fileId = r.fileId || 'f-' + r.id;
    if (!(await getFile(fileId))) await putFile({ id: fileId, display: img.display, original: img.display, name: 'קבלה' });
    await putReceipt({ ...r, fileId, thumb: img.thumb, updatedAt: Math.max(Date.now(), (r.updatedAt ?? 0) + 1) });
  }
  notify();
}

/** First sync on a device: send up what exists only here (receipts and their files). */
async function pushLocal() {
  const { data } = await sb.from('kabalot_receipts').select('id,data->updatedAt').limit(5000);
  const remote = new Map((data ?? []).map((r) => [String(r.id), Number(r.updatedAt) || 0] as const));
  const doneKey = `kabalot.uploaded.${uid}`;
  const uploaded = new Set<string>(JSON.parse(localStorage.getItem(doneKey) || '[]'));
  for (const r of await allReceipts()) {
    if (r.demo) continue;
    if (!remote.has(r.id) || (r.updatedAt ?? 0) > (remote.get(r.id) ?? 0)) queue.set(r.id, { id: r.id, data: r, deleted: false });
    if (r.fileId && !uploaded.has(r.fileId)) {
      const f = await getFile(r.fileId);
      if (f) { await uploadFile(f); uploaded.add(r.fileId); }
    }
  }
  localStorage.setItem(doneKey, JSON.stringify([...uploaded]));
  await flush();
}

async function start(session: Session) {
  if (uid === session.user.id) return;
  uid = session.user.id;
  set({ status: 'syncing', email: session.user.email });
  setChangeHook((c) => {
    if (c.kind === 'put' && !c.r.demo) { queue.set(c.r.id, { id: c.r.id, data: c.r, deleted: false }); later(); }
    if (c.kind === 'del') { queue.set(c.id, { id: c.id, data: {}, deleted: true }); later(); }
    if (c.kind === 'file') void uploadFile(c.f);
  });
  try { await pull(); await pushLocal(); } catch { set({ status: 'error', message: 'הסנכרון נעצר. ינסה שוב.' }); }
}

function stop() {
  uid = null; setChangeHook(null); set({ status: 'out', email: undefined, at: undefined });
}

export async function initCloud() {
  const { data } = await sb.auth.getSession();
  if (data.session) void start(data.session);
  sb.auth.onAuthStateChange((_e, s) => { if (s) void start(s); else stop(); });
  const again = () => { if (uid && document.visibilityState === 'visible') { void flush(); void pull(); } };
  document.addEventListener('visibilitychange', again);
  window.setInterval(again, 60_000);
}

export async function signIn(email: string, password: string) {
  const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  if (!error) return null;
  if (/invalid/i.test(error.message)) return 'האימייל או הסיסמה לא נכונים.';
  if (/confirm/i.test(error.message)) return 'החשבון עוד לא אושר במייל.';
  return 'הכניסה לא הצליחה. לנסות שוב בעוד רגע.';
}
export const signOut = () => sb.auth.signOut();
