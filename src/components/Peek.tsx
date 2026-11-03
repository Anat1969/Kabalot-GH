import { fmtDate, fmtMoney, returnUntil, warrantyUntil } from '../dates';
import { useFile } from '../useFile';
import { I, Icon } from '../ui';
import type { Receipt } from '../types';

/** The receipt opened in place: the original image, the facts, and the two actions. */
export default function Peek({ r, go }: { r: Receipt; go: (h: string) => void }) {
  const f = useFile(r.fileId);
  const ret = returnUntil(r), war = warrantyUntil(r);
  return (
    <div className="peek">
      <button className="peek-img press" onClick={() => go(`#/show/${r.id}`)} aria-label="הצגת הקבלה המקורית במסך מלא">
        {f ? <img src={f.display} alt={`הקבלה של ${r.item || 'החפץ'}`} /> : r.thumb ? <img src={r.thumb} alt="" /> : <span className="noimg">אין צילום</span>}
      </button>
      <div className="peek-body">
        <dl className="facts">
          <div><dt>עלות</dt><dd className="num big">{fmtMoney(r.amount) || '—'}</dd></div>
          <div><dt>תאריך</dt><dd className="num">{fmtDate(r.date, true) || '—'}</dd></div>
          <div><dt>חנות</dt><dd>{r.store || '—'}</dd></div>
          <div><dt>החזרה עד</dt><dd className="num">{fmtDate(ret, true) || '—'}</dd></div>
          <div><dt>אחריות עד</dt><dd className="num">{fmtDate(war, true) || '—'}</dd></div>
        </dl>
        {r.notes && <p className="notes">{r.notes}</p>}
        <div className="row2">
          <button className="btn primary press" onClick={() => go(`#/show/${r.id}`)}><Icon d={I.show} /> הצגה למוכרת</button>
          <button className="btn press" onClick={() => go(`#/r/${r.id}`)}><Icon d={I.edit} /> עריכה</button>
        </div>
      </div>
    </div>
  );
}
