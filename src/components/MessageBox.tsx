import { useEffect, useRef, useState } from 'react';
import { parseMessage } from '../parse';
import { fmtDate, fmtMoney } from '../dates';
import { I, Icon } from '../ui';

/** A receipt that came as a text message: paste it here, see what was read, save. */
export default function MessageBox({ onSave, onClose }: { onSave: (text: string) => Promise<void>; onClose: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);

  const paste = async () => {
    try { const t = await navigator.clipboard.readText(); if (t) { setText(t); setNote(''); } else setNote('הלוח ריק. להעתיק קודם את ההודעה.'); }
    catch { setNote('הדפדפן לא נתן לקרוא את הלוח. לחיצה ארוכה בתיבה, ואז "הדבקה".'); ref.current?.focus(); }
  };
  const p = text.trim() ? parseMessage(text) : null;

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="קבלה מהודעה" onClick={(e) => e.stopPropagation()}>
        <h2 className="sheet-h">קבלה מהודעה</h2>
        <p className="sheet-why">קבלה שהגיעה ב-SMS או בוואטסאפ: מעתיקים את ההודעה ומדביקים כאן. הסכום, החנות והקישור נקראים לבד.</p>
        <textarea ref={ref} className="msg" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="להדביק כאן את ההודעה" aria-label="טקסט ההודעה" />
        {note && <p className="sheet-note">{note}</p>}
        {p && (
          <dl className="readout">
            <div><dt>חנות</dt><dd>{p.store || '—'}</dd></div>
            <div><dt>סכום</dt><dd className="num">{fmtMoney(p.amount ?? null) || '—'}</dd></div>
            <div><dt>תאריך</dt><dd className="num">{p.date ? fmtDate(p.date) : 'היום'}</dd></div>
            <div><dt>קישור לקבלה</dt><dd>{p.link ? 'נמצא' : 'אין'}</dd></div>
          </dl>
        )}
        <div className="row2">
          {text.trim()
            ? <button className="btn primary press" disabled={busy} onClick={async () => { setBusy(true); try { await onSave(text.trim()); } finally { setBusy(false); } }}>{busy ? 'שומר...' : 'שמירת הקבלה'}</button>
            : <button className="btn primary press" onClick={paste}><Icon d={I.paste} /> הדבקה מהלוח</button>}
          <button className="btn press" onClick={onClose}>ביטול</button>
        </div>
        <details className="howto">
          <summary>הדרך הקצרה: שיתוף ישר מההודעה</summary>
          <ol>
            <li><b>אנדרואיד:</b> להתקין את האפליקציה במסך הבית. אחר כך לחיצה ארוכה על ההודעה, "שיתוף", ולבחור <b>קבלות</b>.</li>
            <li><b>אייפון:</b> לחיצה ארוכה על ההודעה, "העתקה", ואז כאן "הדבקה מהלוח".</li>
          </ol>
        </details>
      </div>
    </div>
  );
}
