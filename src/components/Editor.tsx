import { useEffect, useRef, useState } from 'react';
import { putReceipt } from '../db';
import { CATEGORIES, guessCategory } from '../categories';
import { fmtDate, returnUntil, warrantyUntil } from '../dates';
import { attachFile, notify, reading } from '../store';
import { useFile } from '../useFile';
import { CatIcon, I, Icon, Mic } from '../ui';
import type { Receipt, SaveState } from '../types';
import { fetchRate, fmtCur, SYMBOL, toShekels, type Cur } from '../money';

/** One receipt: the image beside the fields. Every change is saved on its own. */
export default function Editor({ r, go, onSave }: { r: Receipt; go: (h: string) => void; onSave: (s: SaveState) => void }) {
  const [d, setD] = useState(r);
  const f = useFile(r.fileId);
  const timer = useRef<number>();
  const itemRef = useRef<HTMLInputElement>(null);
  const isReading = reading.has(r.id);
  const attachRef = useRef<HTMLInputElement>(null);

  // Fields filled by reading the receipt arrive after the screen opened: take them unless typed over.
  useEffect(() => {
    setD((cur) => {
      const n = { ...cur, ocrText: r.ocrText };
      (['store', 'amount', 'date', 'category'] as const).forEach((k) => {
        if (cur[k] !== r[k] && (r.auto[k as keyof Receipt['auto']] || k === 'category') && cur.updatedAt === r.updatedAt) (n as Record<string, unknown>)[k] = r[k];
      });
      n.auto = r.auto;
      return n;
    });
  }, [r]);

  useEffect(() => { if (!r.item) itemRef.current?.focus(); }, [r.id]);

  const change = (patch: Partial<Receipt>) => {
    setD((cur) => {
      const auto = { ...cur.auto };
      Object.keys(patch).forEach((k) => delete auto[k as keyof Receipt['auto']]);
      const next = { ...cur, ...patch, auto, updatedAt: Date.now(), demo: cur.demo };
      if (patch.item && cur.category === 'אחר') next.category = guessCategory(patch.item + ' ' + cur.ocrText) ?? 'אחר';
      onSave('saving');
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        putReceipt(next).then(() => { onSave('saved'); notify(); }).catch(() => onSave('error'));
      }, 350);
      return next;
    });
  };

  const autoMark = (k: keyof Receipt['auto']) => (d.auto[k] ? <span className="auto" title="נקרא מהקבלה. כדאי לוודא.">נקרא מהקבלה</span> : null);
  const num = (v: string) => (v === '' ? null : Number(v.replace(',', '.')));
  const cur: Cur = d.currency ?? 'ILS';
  const [rateNote, setRateNote] = useState('');

  /** Foreign charge: keep the original amount, convert with the Bank of Israel rate of the charge date. */
  const setForeign = async (c: Cur, orig: number | null, date: string) => {
    if (c === 'ILS') { change({ currency: 'ILS', amount: orig, amountOrig: null, rate: null, rateDate: undefined }); setRateNote(''); return; }
    change({ currency: c, amountOrig: orig, amount: toShekels(orig, d.currency === c ? d.rate : null) });
    setRateNote('מביא את השער היציג...');
    const got = await fetchRate(c, date);
    if (!got) { setRateNote('השער לא התקבל (אין רשת?). אפשר להקליד שער ידנית.'); return; }
    change({ currency: c, amountOrig: orig, rate: got.rate, rateDate: got.date, amount: toShekels(orig, got.rate) });
    setRateNote('');
  };

  return (
    <main className="editor">
      <div className="ed-img">
        <button className="press imgbtn" onClick={() => go(`#/show/${r.id}`)} aria-label="הצגה במסך מלא">
          {f ? <img src={f.display} alt="הקבלה המקורית" /> : <span className="noimg">אין צילום</span>}
        </button>
        <div className="row2">
          <button className="btn primary press" onClick={() => go(`#/show/${r.id}`)}><Icon d={I.show} /> הצגה למוכרת</button>
          {f && f.type === 'application/pdf' ? <a className="btn press" href={f.original} target="_blank" rel="noreferrer"><Icon d={I.file} /> ה-PDF המקורי</a> : <button className="btn press" onClick={() => go('#/')}>לכל הקבלות</button>}
        </div>
        {r.link && <a className="btn press" href={r.link} target="_blank" rel="noreferrer"><Icon d={I.link} /> פתיחת הקבלה הדיגיטלית</a>}
        <button type="button" className="btn press" onClick={() => attachRef.current?.click()}><Icon d={I.gallery} /> {r.source === 'message' ? 'צירוף צילום של הקבלה' : 'החלפת הצילום'}</button>
        <input ref={attachRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) attachFile(r, f); e.target.value = ''; }} />
        {r.source === 'message' && <p className="reading-line dim">המסמך המקורי נמצא בקישור. צילום מסך שלו, מצורף כאן, יישמר גם בלי רשת.</p>}
        {isReading && <p className="reading-line">קורא את הקבלה על הטלפון: סכום, תאריך וחנות יתמלאו לבד.</p>}
      </div>

      <form className="ed-form" onSubmit={(e) => { e.preventDefault(); go('#/'); }}>
        <label className="field wide">
          <span className="lbl">מה נקנה</span>
          <span className="inp">
            <input ref={itemRef} value={d.item} onChange={(e) => change({ item: e.target.value })} placeholder="למשל: אוזניות, מעיל, מקדחה" />
            <Mic label="מה נקנה" onText={(t) => change({ item: (d.item ? d.item + ' ' : '') + t })} />
          </span>
        </label>

        <div className="cats" role="group" aria-label="סוג החפץ">
          {CATEGORIES.map((c) => (
            <button type="button" key={c.name} className="chip cat press" aria-pressed={d.category === c.name} onClick={() => change({ category: c.name })} title={c.name}>
              <CatIcon name={c.name} size={18} /><span>{c.name}</span>
            </button>
          ))}
        </div>

        <div className="seg kind" role="group" aria-label="סוג החיוב">
          <button type="button" className="chip press" aria-pressed={d.kind !== 'subscription'} onClick={() => change({ kind: 'one-time' })}>קנייה</button>
          <button type="button" className="chip press" aria-pressed={d.kind === 'subscription'} onClick={() => change({ kind: 'subscription', returnDays: null, warrantyMonths: null })}>מנוי חודשי</button>
        </div>

        <div className="grid2">
          <label className="field">
            <span className="lbl">עלות {autoMark('amount')}</span>
            <span className="inp">
              <input inputMode="decimal" className="num" value={(cur === 'ILS' ? d.amount : d.amountOrig) ?? ''} placeholder={SYMBOL[cur]}
                onChange={(e) => (cur === 'ILS' ? change({ amount: num(e.target.value) }) : change({ amountOrig: num(e.target.value), amount: toShekels(num(e.target.value), d.rate) }))} />
              <select className="cur" value={cur} onChange={(e) => setForeign(e.target.value as Cur, cur === 'ILS' ? d.amount : d.amountOrig ?? null, d.date)} aria-label="מטבע">
                <option value="ILS">₪</option><option value="USD">$</option><option value="EUR">€</option>
              </select>
            </span>
            {cur !== 'ILS' && (
              <span className="hint num">
                {d.rate ? <>= <b>{fmtCur(d.amount, 'ILS')}</b> · שער יציג <input className="rate" inputMode="decimal" value={d.rate} onChange={(e) => change({ rate: num(e.target.value), amount: toShekels(d.amountOrig, num(e.target.value)) })} aria-label="שער" /> {d.rateDate ? `(${fmtDate(d.rateDate)})` : ''}</>
                  : <>שער: <input className="rate" inputMode="decimal" placeholder="3.70" onChange={(e) => change({ rate: num(e.target.value), amount: toShekels(d.amountOrig, num(e.target.value)) })} aria-label="שער" /></>}
                {rateNote && <span className="dim"> {rateNote}</span>}
              </span>
            )}
          </label>
          <label className="field">
            <span className="lbl">תאריך {autoMark('date')}</span>
            <span className="inp"><input type="date" className="num" value={d.date} onChange={(e) => { change({ date: e.target.value }); if (cur !== 'ILS') setForeign(cur, d.amountOrig ?? null, e.target.value); }} /></span>
          </label>
          <label className="field wide">
            <span className="lbl">חנות {autoMark('store')}</span>
            <span className="inp">
              <input value={d.store} onChange={(e) => change({ store: e.target.value })} placeholder="שם החנות" />
              <Mic label="חנות" onText={(t) => change({ store: t })} />
            </span>
          </label>
          <label className="field">
            <span className="lbl">ימים להחזרה</span>
            <span className="inp"><input inputMode="numeric" className="num" value={d.returnDays ?? ''} onChange={(e) => change({ returnDays: num(e.target.value) })} /></span>
            <span className="hint num">{returnUntil(d) ? `עד ${fmtDate(returnUntil(d), true)}` : 'בלי החזרה'}</span>
          </label>
          <label className="field">
            <span className="lbl">חודשי אחריות</span>
            <span className="inp"><input inputMode="numeric" className="num" value={d.warrantyMonths ?? ''} onChange={(e) => change({ warrantyMonths: num(e.target.value) })} /></span>
            <span className="hint num">{warrantyUntil(d) ? `עד ${fmtDate(warrantyUntil(d), true)}` : 'בלי אחריות'}</span>
          </label>
          <label className="field wide">
            <span className="lbl">מילות מפתח והערות</span>
            <span className="inp">
              <textarea rows={2} value={d.notes} onChange={(e) => change({ notes: e.target.value })} placeholder="צבע, מידה, למי, מספר סידורי" />
              <Mic label="הערות" onText={(t) => change({ notes: (d.notes ? d.notes + ' ' : '') + t })} />
            </span>
          </label>
        </div>

        {d.ocrText && (
          <details className="ocr">
            <summary>{r.source === 'message' ? 'ההודעה המקורית (נכנסת לחיפוש)' : 'הטקסט שנקרא מהקבלה (נכנס לחיפוש)'}</summary>
            <pre>{d.ocrText}</pre>
          </details>
        )}
        <button type="submit" className="btn primary press done">סיום, לכל הקבלות</button>
      </form>
    </main>
  );
}
