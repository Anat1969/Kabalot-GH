import { useCallback, useEffect, useMemo, useState } from 'react';
import { addFiles, notify, useReceipts } from './store';
import { clearAll, deleteFile, deleteReceipt, takeInbox, allReceipts } from './db';
import { exportBackup, importBackup } from './backup';
import { loadDemo } from './demo';
import Home from './components/Home';
import Editor from './components/Editor';
import Show from './components/Show';
import AIMenu, { type MenuItem } from './components/AIMenu';
import type { SaveState } from './types';

function useHash() {
  const [h, setH] = useState(location.hash || '#/');
  useEffect(() => { const f = () => setH(location.hash || '#/'); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  return h;
}
const go = (h: string) => { location.hash = h; };

export default function App() {
  const list = useReceipts();
  const hash = useHash();
  const [q, setQ] = useState(() => new URLSearchParams(location.search).get('q') ?? '');
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [save, setSave] = useState<SaveState>('idle');
  const [toast, setToast] = useState('');

  const say = (t: string) => { setToast(t); window.setTimeout(() => setToast(''), 3500); };

  const [, route, id] = hash.match(/^#\/(r|show)?\/?([\w-]*)/) ?? [];
  const current = list?.find((r) => r.id === id);

  // Search in the address, so a copied link opens the same view.
  useEffect(() => {
    const u = new URL(location.href);
    if (q) u.searchParams.set('q', q); else u.searchParams.delete('q');
    history.replaceState(null, '', u);
  }, [q]);

  const onFiles = useCallback(async (files: FileList | Blob[] | null, names?: string[]) => {
    if (!files || !files.length) return;
    setBusy(true);
    try {
      const ids = await addFiles(Array.from(files), names);
      if (ids.length === 1) go(`#/r/${ids[0]}`);
      else { say(`נשמרו ${ids.length} קבלות. עכשיו לכתוב לכל אחת מה נקנה.`); go('#/'); }
    } catch {
      say('הקובץ לא נקרא. אפשר לנסות שוב, או לצלם מחדש.');
    } finally { setBusy(false); }
  }, []);

  // Photos shared from the gallery (Android share sheet -> sw.js -> IndexedDB inbox).
  useEffect(() => {
    const pull = () => takeInbox().then((items) => { if (items.length) onFiles(items.map((i) => i.file), items.map((i) => i.name)); }).catch(() => {});
    pull();
    const onMsg = (e: MessageEvent) => { if (e.data === 'kabalot:shared') pull(); };
    navigator.serviceWorker?.addEventListener('message', onMsg);
    return () => navigator.serviceWorker?.removeEventListener('message', onMsg);
  }, [onFiles]);

  useEffect(() => {
    const reload = () => notify();
    const clearDemo = async () => {
      for (const r of await allReceipts()) if (r.demo) { await deleteReceipt(r.id); if (r.fileId) await deleteFile(r.fileId); }
      notify(); say('הדוגמאות נמחקו.');
    };
    window.addEventListener('kabalot:reload', reload);
    window.addEventListener('kabalot:clear-demo', clearDemo);
    return () => { window.removeEventListener('kabalot:reload', reload); window.removeEventListener('kabalot:clear-demo', clearDemo); };
  }, []);

  const menuItems = useMemo<MenuItem[]>(() => {
    const items: MenuItem[] = [
      { label: 'גיבוי לקובץ', hint: 'כל הקבלות והצילומים', onSelect: () => exportBackup().then((n) => say(`הגיבוי נוצר: ${n} קבלות.`)).catch(() => say('הגיבוי לא נוצר. לנסות שוב.')) },
      { label: 'שחזור מגיבוי', hint: 'קובץ JSON', onSelect: () => {
        const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json';
        inp.onchange = () => { const f = inp.files?.[0]; if (f) importBackup(f).then((n) => { notify(); say(`שוחזרו ${n} קבלות.`); }).catch(() => say('זה לא קובץ גיבוי של קבלות.')); };
        inp.click();
      } },
      { label: 'קבלות לדוגמה', hint: '6 קבלות', onSelect: () => loadDemo().then(() => { notify(); go('#/'); }) },
    ];
    if (route === 'r' && current) items.push({ label: 'מחיקת הקבלה הזו', hint: 'דורש אישור', danger: true, onSelect: async () => {
      if (!confirm(`למחוק את הקבלה של "${current.item || 'החפץ'}"? אי אפשר לבטל.`)) return;
      await deleteReceipt(current.id); if (current.fileId) await deleteFile(current.fileId); notify(); go('#/'); say('הקבלה נמחקה.');
    } });
    else items.push({ label: 'מחיקת כל הקבלות', hint: 'דורש אישור', danger: true, onSelect: async () => {
      if (!confirm('למחוק את כל הקבלות מהטלפון? כדאי לגבות קודם. אי אפשר לבטל.')) return;
      await clearAll(); notify(); say('כל הקבלות נמחקו.');
    } });
    return items;
  }, [route, current]);

  const status = save === 'saving' ? 'שומר...' : save === 'saved' ? 'נשמר' : save === 'error' ? 'לא נשמר, מנסה שוב' : '';
  useEffect(() => { if (save === 'saved') { const t = window.setTimeout(() => setSave('idle'), 2500); return () => window.clearTimeout(t); } }, [save]);

  return (
    <>
      <header className="bar">
        <a href="#/" className="brand press" onClick={() => { setOpen(null); }} aria-label="קבלות, לדף הבית">
          <img src={import.meta.env.BASE_URL + 'icon.svg'} alt="" width={28} height={28} />
          <span>קבלות</span>
        </a>
        {route === 'r' && <span className="crumb">{current?.item || 'קבלה חדשה'}</span>}
        <span className={'saved ' + save}>{status}</span>
        <AIMenu items={menuItems} status={status} />
      </header>

      {list == null ? <div className="loading">טוען את הקבלות...</div>
        : route === 'r' ? (current ? <Editor key={current.id} r={current} go={go} onSave={setSave} /> : <div className="loading">הקבלה לא נמצאה. <a href="#/">לכל הקבלות</a></div>)
        : <Home list={list} q={q} setQ={setQ} open={open} setOpen={setOpen} go={go} onFiles={onFiles} busy={busy} />}

      {route === 'show' && current && <Show r={current} onClose={() => history.length > 1 ? history.back() : go('#/')} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
