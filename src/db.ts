import type { Receipt, StoredFile } from './types';

const DB = 'kabalot';
let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('receipts')) db.createObjectStore('receipts', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('inbox')) db.createObjectStore('inbox', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return open().then((db) => new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const r = fn(s);
    t.oncomplete = () => resolve(r ? (r.result as T) : (undefined as T));
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

export const allReceipts = () => tx<Receipt[]>('receipts', 'readonly', (s) => s.getAll());
/** Called after every local change, so the cloud sync can mirror it. `silent` writes come from the cloud itself. */
type Change = { kind: 'put'; r: Receipt } | { kind: 'del'; id: string } | { kind: 'file'; f: StoredFile };
let changeHook: ((c: Change) => void) | null = null;
export const setChangeHook = (fn: typeof changeHook) => { changeHook = fn; };

export const putReceipt = (r: Receipt, silent = false) => tx('receipts', 'readwrite', (s) => { s.put(r); }).then(() => { if (!silent) changeHook?.({ kind: 'put', r }); });
export const deleteReceipt = (id: string, silent = false) => tx('receipts', 'readwrite', (s) => { s.delete(id); }).then(() => { if (!silent) changeHook?.({ kind: 'del', id }); });
export const getFile = (id: string) => tx<StoredFile | undefined>('files', 'readonly', (s) => s.get(id));
export const putFile = (f: StoredFile, silent = false) => tx('files', 'readwrite', (s) => { s.put(f); }).then(() => { if (!silent) changeHook?.({ kind: 'file', f }); });
export const deleteFile = (id: string) => tx('files', 'readwrite', (s) => { s.delete(id); });

/** Files shared into the app from the phone gallery (written by sw.js). */
export interface InboxItem { id: string; file?: Blob; text?: string; name: string }
export const takeInbox = async (): Promise<InboxItem[]> => {
  const items = await tx<InboxItem[]>('inbox', 'readonly', (s) => s.getAll());
  if (items.length) await tx('inbox', 'readwrite', (s) => { s.clear(); });
  return items;
};

export async function clearAll() {
  await tx('receipts', 'readwrite', (s) => { s.clear(); });
  await tx('files', 'readwrite', (s) => { s.clear(); });
}

/** Ask the browser to keep this data even when the phone is low on space. */
export async function persist() {
  try { return (await navigator.storage?.persist?.()) ?? false; } catch { return false; }
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
