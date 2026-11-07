import { useEffect, useRef, useState } from 'react';
import { fmtDate, fmtMoney } from '../dates';
import { useFile } from '../useFile';
import { I, Icon } from '../ui';
import type { Receipt } from '../types';

/** For the person at the counter: white, big, zoomable, and the screen stays on. */
export default function Show({ r, onClose }: { r: Receipt; onClose: () => void }) {
  const f = useFile(r.fileId, r);
  const [zoom, setZoom] = useState(1);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let lock: { release(): Promise<void> } | null = null;
    const wl = (navigator as unknown as { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock;
    wl?.request('screen').then((l) => { lock = l; }).catch(() => {});
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    document.body.style.overflow = 'hidden';
    return () => { lock?.release().catch(() => {}); window.removeEventListener('keydown', key); document.body.style.overflow = ''; };
  }, [onClose]);

  const z = (k: number) => setZoom((v) => Math.min(5, Math.max(1, +(v * k).toFixed(2))));

  return (
    <div className="show" role="dialog" aria-modal="true" aria-label={`הקבלה של ${r.item}`}>
      <header className="show-h">
        <div>
          <div className="show-item">{r.item || 'קבלה'}</div>
          <div className="show-sub">{r.store}{r.store && r.date ? ' · ' : ''}<span className="num">{fmtDate(r.date, true)}</span></div>
        </div>
        <div className="show-amount num">{fmtMoney(r.amount)}</div>
      </header>
      <div className="show-img" ref={box} onDoubleClick={() => setZoom((v) => (v > 1 ? 1 : 2.5))}>
        {f ? <img src={f.display} alt="הקבלה המקורית" style={{ width: `${zoom * 100}%`, maxWidth: zoom === 1 ? '100%' : 'none', maxHeight: zoom === 1 ? '100%' : 'none' }} /> : <span className="noimg">טוען...</span>}
      </div>
      <footer className="show-f">
        <button className="iconbtn big press" onClick={() => z(1 / 1.5)} disabled={zoom <= 1} aria-label="הקטנה" title="הקטנה"><Icon d={I.minus} /></button>
        <button className="iconbtn big press" onClick={() => setZoom(1)} aria-label="כל הקבלה" title="כל הקבלה"><Icon d={I.fit} /></button>
        <button className="iconbtn big press" onClick={() => z(1.5)} aria-label="הגדלה" title="הגדלה"><Icon d={I.plus} /></button>
        {r.link && <a className="btn press" href={r.link} target="_blank" rel="noreferrer"><Icon d={I.link} /> הקבלה הדיגיטלית</a>}
        <button className="btn primary press" onClick={onClose}><Icon d={I.close} /> סגירה</button>
      </footer>
    </div>
  );
}
