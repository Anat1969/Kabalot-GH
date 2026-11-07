import { Fragment, useMemo, useRef, useState } from 'react';
import { fmtDate, fmtMoney, relDays, returnUntil, statusOf, todayISO, warrantyUntil } from '../dates';
import { GROUP_LABEL, SORT_LABEL, STATUS_LABEL, filterStatus, groupOf, matches, sortList, sum, type GroupKey, type SortKey, type StatusFilter } from '../search';
import { CatIcon, I, Icon, Mark, Mic } from '../ui';
import { reading } from '../store';
import StatusTag from './Status';
import { curOf, fmtCur } from '../money';
import Peek from './Peek';
import MessageBox from './MessageBox';
import type { Receipt } from '../types';

/** A calm greeting by the hour, in the spirit of the design (ענת, 07.11.2026). */
export function greeting(d = new Date()) {
  const h = d.getHours();
  return h >= 5 && h < 12 ? 'בוקר טוב' : h < 17 && h >= 12 ? 'צהריים טובים' : h >= 17 && h < 21 ? 'ערב טוב' : 'לילה טוב';
}

interface Prefs { view: 'cards' | 'table'; group: GroupKey; sort: SortKey; dir: 1 | -1; status: StatusFilter }
const DEFAULT: Prefs = { view: 'cards', group: 'category', sort: 'date', dir: -1, status: 'all' };
const loadPrefs = (): Prefs => { try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem('kabalot.prefs') || '{}') }; } catch { return DEFAULT; } };

interface Props { list: Receipt[]; q: string; setQ: (q: string) => void; open: string | null; setOpen: (id: string | null) => void; go: (h: string) => void; onFiles: (f: FileList | null) => void; busy: boolean; onMessage: (text: string) => Promise<void> }

export default function Home({ list, q, setQ, open, setOpen, go, onFiles, busy, onMessage }: Props) {
  const [p, setP] = useState<Prefs>(loadPrefs);
  const set = (patch: Partial<Prefs>) => setP((old) => { const n = { ...old, ...patch }; try { localStorage.setItem('kabalot.prefs', JSON.stringify(n)); } catch { /* ok */ } return n; });
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const today = todayISO();
  const [msgOpen, setMsgOpen] = useState(false);

  const shown = useMemo(() => sortList(list.filter((r) => matches(r, q) && filterStatus(r, p.status, today)), p.sort, p.dir), [list, q, p, today]);
  const groups = useMemo(() => {
    if (p.group === 'none') return [{ name: '', items: shown }];
    const m = new Map<string, Receipt[]>();
    for (const r of shown) { const g = groupOf(r, p.group); if (!m.has(g)) m.set(g, []); m.get(g)!.push(r); }
    return [...m.entries()].map(([name, items]) => ({ name, items })).sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name, 'he'));
  }, [shown, p.group]);

  const counts = useMemo(() => {
    const c = { return: 0, warranty: 0 };
    for (const r of list) { const s = statusOf(r, today); if (s === 'return') c.return++; if (s === 'return' || s === 'warranty') c.warranty++; }
    return c;
  }, [list, today]);
  const soonest = useMemo(() => list.filter((r) => statusOf(r, today) === 'return').sort((a, b) => (returnUntil(a)! < returnUntil(b)! ? -1 : 1))[0], [list, today]);
  const hasDemo = list.some((r) => r.demo);
  const missing = useMemo(() => list.filter((r) => r.amount == null).length, [list]);

  const sortBy = (k: SortKey) => set(p.sort === k ? { dir: (p.dir * -1) as 1 | -1 } : { sort: k, dir: k === 'date' || k === 'amount' ? -1 : 1 });
  const dirWord = p.sort === 'date' || p.sort === 'returnUntil' || p.sort === 'warrantyUntil' ? (p.dir === -1 ? 'חדש לישן' : 'ישן לחדש') : p.sort === 'amount' ? (p.dir === -1 ? 'יקר לזול' : 'זול ליקר') : p.dir === 1 ? 'א עד ת' : 'ת עד א';

  return (
    <main className="home">
      <section className="hero">
        <p className="greet"><span>{greeting()}, ענת</span><small>{list.length ? 'כל קבלה במקומה. נשימה אחת, ומוצאים.' : 'מתחילים בקבלה אחת.'}</small></p>
        {list.length ? (
          <>
            <h1 className="insight"><span className="num">{list.length}</span> קבלות, <span className="num">{fmtMoney(sum(list))}</span></h1>
            <p className="explain">
              {soonest ? <>את <b>{soonest.item || 'החפץ האחרון'}</b> אפשר עוד להחזיר, <mark>{relDays(returnUntil(soonest), today)}</mark>. </> : null}
              {counts.warranty ? <><b className="num">{counts.warranty}</b> חפצים עדיין באחריות. </> : null}
              {missing ? <><b className="num">{missing}</b> קבלות בלי סכום: להשלים מהקבלה המקורית.</> : null}
            </p>
          </>
        ) : (
          <>
            <h1 className="insight">כל קבלה, <mark>בשנייה</mark>, מול המוכרת.</h1>
            <p className="explain">מצלמים קבלה, כותבים מה נקנה, ומוצאים אותה לפי <b>שם החפץ</b>.</p>
          </>
        )}
        <div className="row3 capture">
          <button className="btn primary big press" onClick={() => camRef.current?.click()} disabled={busy}><Icon d={I.camera} size={22} /> <span>{busy ? 'שומר...' : 'צילום'}</span></button>
          <button className="btn big press" onClick={() => galRef.current?.click()} disabled={busy}><Icon d={I.gallery} size={22} /> <span>גלריה או PDF</span></button>
          <button className="btn big press" onClick={() => setMsgOpen(true)} disabled={busy}><Icon d={I.message} size={22} /> <span>מהודעה</span></button>
        </div>
        {msgOpen && <MessageBox onClose={() => setMsgOpen(false)} onSave={async (t) => { await onMessage(t); setMsgOpen(false); }} />}
        <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
        <input ref={galRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} data-testid="gallery-input" />
      </section>

      {!list.length ? (
        <section className="empty">
          <ol className="steps">
            <li><b>צילום</b> הקבלה, תמונה מהגלריה, או <b>הודעה</b> עם קבלה דיגיטלית.</li>
            <li><b>שם החפץ:</b> סכום, תאריך וחנות נקראים מהקבלה לבד.</li>
            <li><b>בחנות:</b> מחפשים את החפץ, ולוחצים "הצגה למוכרת".</li>
          </ol>
          <p className="small">הקבלות נשמרות רק בטלפון הזה. גיבוי לקובץ נמצא בכפתור הלוגו.</p>
        </section>
      ) : (
        <section className="frame">
          <div className="searchbar">
            <Icon d={I.search} />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש: אוזניות, איקאה, 549, מרץ..." aria-label="חיפוש קבלה לפי מילות מפתח" />
            {q && <button className="iconbtn press" onClick={() => setQ('')} aria-label="ניקוי החיפוש" title="ניקוי החיפוש"><Icon d={I.x} size={16} /></button>}
            <Mic onText={setQ} label="חיפוש" />
          </div>

          <div className="tools">
            <div className="seg" role="group" aria-label="תצוגה">
              <button className="chip press" aria-pressed={p.view === 'cards'} onClick={() => set({ view: 'cards' })}>לפי חפץ</button>
              <button className="chip press" aria-pressed={p.view === 'table'} onClick={() => set({ view: 'table' })}>טבלה</button>
            </div>
            <div className="seg four" role="group" aria-label="סינון לפי תוקף">
              {(Object.keys(STATUS_LABEL) as StatusFilter[]).map((s) => (
                <button key={s} className="chip press" aria-pressed={p.status === s} onClick={() => set({ status: s })}>{STATUS_LABEL[s]}</button>
              ))}
            </div>
          </div>

          <div className="sortline">
            <span>
              <b className="num">{shown.length}</b> מתוך <span className="num">{list.length}</span>, ממוין לפי <b>{SORT_LABEL[p.sort]}</b>, {dirWord}
              {p.view === 'cards' && p.group !== 'none' ? <>, מקובץ לפי <b>{GROUP_LABEL[p.group]}</b></> : null}
            </span>
            <span className="selects">
              {p.view === 'cards' && (
                <select value={p.group} onChange={(e) => set({ group: e.target.value as GroupKey })} aria-label="קיבוץ לפי">
                  {(Object.keys(GROUP_LABEL) as GroupKey[]).map((g) => <option key={g} value={g}>קיבוץ: {GROUP_LABEL[g]}</option>)}
                </select>
              )}
              <select value={p.sort} onChange={(e) => sortBy(e.target.value as SortKey)} aria-label="מיון לפי">
                {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => <option key={k} value={k}>מיון: {SORT_LABEL[k]}</option>)}
              </select>
              <button className="iconbtn press" onClick={() => set({ dir: (p.dir * -1) as 1 | -1 })} aria-label="היפוך כיוון המיון" title="היפוך כיוון המיון">{p.dir === -1 ? '↓' : '↑'}</button>
            </span>
          </div>

          {hasDemo && (
            <p className="demo-note">אלה קבלות לדוגמה. <button className="link press" onClick={() => window.dispatchEvent(new Event('kabalot:clear-demo'))}>מחיקת הדוגמאות</button></p>
          )}

          {!shown.length ? (
            <p className="nothing">{q ? <>אין קבלה עם "<b>{q}</b>". אפשר לחפש גם לפי חנות, סכום או מילה מהקבלה.</> : 'אין קבלות בסינון הזה. "הכול" מציג את כולן.'}</p>
          ) : p.view === 'cards' ? (
            <div className="groups">
              {groups.map((g) => (
                <section key={g.name || 'all'} className="group">
                  {g.name && (
                    <h2 className="group-h">
                      {p.group === 'category' && <CatIcon name={g.name} />}
                      <span>{g.name}</span>
                      <span className="meta num">{g.items.length} · {g.items.every((r) => r.amount == null) ? 'בלי סכום' : fmtMoney(sum(g.items))}</span>
                    </h2>
                  )}
                  <ul className="cards">
                    {g.items.map((r) => (
                      <li key={r.id} className={'card' + (open === r.id ? ' open' : '')}>
                        <button className="card-head press" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>
                          <span className="thumb">{r.thumb ? <img src={r.thumb} alt="" /> : <Icon d={I.file} />}</span>
                          <span className="card-main">
                            <span className="item"><Mark text={r.item || 'חפץ בלי שם'} q={q} />{reading.has(r.id) && <span className="reading">קורא את הקבלה...</span>}</span>
                            <span className="sub"><Mark text={r.store || 'חנות'} q={q} /> · <span className="num">{fmtDate(r.date)}</span></span>
                          </span>
                          <span className="card-side">
                            <span className={'amount num' + (r.amount == null && r.amountOrig == null ? ' missing' : '')}>{r.amount != null ? fmtMoney(r.amount) : r.amountOrig != null ? fmtCur(r.amountOrig, curOf(r)) : 'חסר סכום'}</span>
                            {r.amountOrig != null && r.amount != null && <span className="orig num">{fmtCur(r.amountOrig, curOf(r))}</span>}
                            <StatusTag r={r} today={today} />
                          </span>
                        </button>
                        {open === r.id && <Peek r={r} go={go} />}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <div className="tablewrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th aria-label="צילום"></th>
                    {(['item', 'store', 'date', 'amount', 'returnUntil', 'warrantyUntil'] as SortKey[]).map((k) => (
                      <th key={k} aria-sort={p.sort === k ? (p.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                        <button className={'th press' + (p.sort === k ? ' on' : '')} onClick={() => sortBy(k)}>{SORT_LABEL[k]}{p.sort === k ? (p.dir === 1 ? ' ↑' : ' ↓') : ''}</button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => {
                    const s = statusOf(r, today);
                    return (
                      <Fragment key={r.id}>
                        <tr className={'tr ' + s + (open === r.id ? ' open' : '')} onClick={() => setOpen(open === r.id ? null : r.id)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setOpen(open === r.id ? null : r.id); }}>
                          <td className="tthumb">{r.thumb && <img src={r.thumb} alt="" />}</td>
                          <td className="titem"><Mark text={r.item || 'חפץ בלי שם'} q={q} /></td>
                          <td><Mark text={r.store} q={q} /></td>
                          <td className="num">{fmtDate(r.date)}</td>
                          <td className="num strong">{fmtMoney(r.amount)}</td>
                          <td className={'num ' + (s === 'return' ? 'ok' : 'dim')}>{fmtDate(returnUntil(r))}</td>
                          <td className={'num ' + (s === 'warranty' || s === 'return' ? 'warn' : 'dim')}>{fmtDate(warrantyUntil(r))}</td>
                        </tr>
                        {open === r.id && <tr className="peekrow"><td colSpan={7}><Peek r={r} go={go} /></td></tr>}
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr><td></td><td colSpan={3}>סכום כולל, <span className="num">{shown.length}</span> קבלות</td><td className="num strong">{fmtMoney(sum(shown))}</td><td colSpan={2}></td></tr>
                </tfoot>
              </table>
            </div>
          )}
          <p className="legend"><span className="tag return">ירוק</span> אפשר עוד להחזיר <span className="tag warranty">ענבר</span> באחריות <span className="tag expired">אפור</span> בלי תוקף</p>
        </section>
      )}
      <footer className="inspire">השראה: קטלוג הכרטיסיות של מלוויל דיואי (Melvil Dewey), <span className="num">1876</span>. כל פריט נמצא לפי <b>מה שהוא</b>, לא לפי מתי הגיע.</footer>
    </main>
  );
}
