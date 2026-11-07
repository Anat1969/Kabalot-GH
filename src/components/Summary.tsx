import { useMemo, useState } from 'react';
import { catByName } from '../categories';
import { fmtDate, todayISO } from '../dates';
import { fmtCur, foreignNote } from '../money';
import { byKey, byMonth, monthShort, projection, subscriptions, toCSV, ym, type Bucket } from '../summary';
import { CatIcon } from '../ui';
import Alerts from './Alerts';
import type { Receipt } from '../types';

type Period = string; // 'last12' or a year like '2026'
type Pick = { kind: 'month' | 'topic' | 'store'; key: string } | null;

const money = (n: number) => fmtCur(Math.round(n), 'ILS');

export function downloadCSV(list: Receipt[], name: string) {
  const blob = new Blob([toCSV(list)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/** Where the money goes: month by month, by topic, by business, and the subscriptions that repeat. */
export default function Summary({ list, go }: { list: Receipt[]; go: (h: string) => void }) {
  const today = todayISO();
  const real = useMemo(() => list.filter((r) => !r.demo || list.every((x) => x.demo)), [list]);
  const years = useMemo(() => [...new Set(real.map((r) => r.date.slice(0, 4)))].sort().reverse(), [real]);
  const [period, setPeriod] = useState<Period>('last12');
  const [pick, setPick] = useState<Pick>(null);
  const [hover, setHover] = useState<string | null>(null);

  const [from, to] = useMemo(() => {
    if (period === 'last12') { const d = new Date(); d.setMonth(d.getMonth() - 11); return [`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, ym(today)]; }
    return [`${period}-01`, `${period}-12`];
  }, [period, today]);

  const inPeriod = useMemo(() => real.filter((r) => ym(r.date) >= from && ym(r.date) <= to), [real, from, to]);
  const months = useMemo(() => byMonth(inPeriod, from, to), [inPeriod, from, to]);
  const topics = useMemo(() => byKey(inPeriod, (r) => r.category), [inPeriod]);
  const stores = useMemo(() => byKey(inPeriod, (r) => r.store).slice(0, 8), [inPeriod]);
  const subs = useMemo(() => subscriptions(real, today), [real, today]);
  const subsInPeriod = useMemo(() => subs.map((s) => ({ ...s, periodTotal: s.charges.filter((r) => ym(r.date) >= from && ym(r.date) <= to).reduce((a, r) => a + (r.amount ?? 0), 0) })), [subs, from, to]);

  const total = inPeriod.reduce((s, r) => s + (r.amount ?? 0), 0);
  const missing = inPeriod.filter((r) => r.amount == null).length;
  const active = subs.filter((s) => s.active);
  const monthlySubs = active.reduce((s, x) => s + (x.monthly ?? 0), 0);
  const aiMonthly = active.filter((s) => s.category === 'בינה מלאכותית').reduce((s, x) => s + (x.monthly ?? 0), 0);
  const subsTotal = subsInPeriod.reduce((s, x) => s + x.periodTotal, 0);
  const nowKey = ym(today);
  const forecast = useMemo(() => projection(subs, nowKey, to, today), [subs, nowKey, to, today]);
  const forecastTotal = Object.values(forecast).reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...months.map((m) => m.total + (forecast[m.key] ?? 0)));
  const topicOrder = topics.map((t) => t.key);
  const peak = months.reduce<Bucket | null>((a, b) => (!a || b.total > a.total ? b : a), null);
  const past = months.filter((m) => m.key <= nowKey);
  const avg = past.length ? total / past.length : 0;

  const picked = useMemo(() => {
    if (!pick) return [];
    const f = pick.kind === 'month' ? (r: Receipt) => ym(r.date) === pick.key : pick.kind === 'topic' ? (r: Receipt) => r.category === pick.key : (r: Receipt) => (r.store || 'לא ידוע') === pick.key;
    return inPeriod.filter(f).sort((a, b) => b.date.localeCompare(a.date));
  }, [pick, inPeriod]);
  const toggle = (p: NonNullable<Pick>) => setPick((cur) => (cur && cur.kind === p.kind && cur.key === p.key ? null : p));
  const isPicked = (kind: string, key: string) => pick?.kind === kind && pick.key === key;
  const periodName = period === 'last12' ? '12 החודשים האחרונים' : `שנת ${period}`;

  if (!real.length) return <main className="sum"><p className="nothing">אין עדיין קבלות לסכם. אחרי שמוסיפים קבלות, כאן רואים לאן הולך הכסף.</p></main>;

  return (
    <main className="sum">
      <p className="purpose">לאן הולך הכסף: לפי חודש, נושא ועסק, ומה חוזר כל חודש. לחיצה על עמודה, נושא או עסק פותחת את הקבלות שלו כאן.</p>
      <section className="hero">
        <h1 className="insight"><span className="num">{money(total)}</span> ב{periodName}</h1>
        <p className="explain">
          {active.length ? <><mark>מנויים פעילים: <b className="num">{money(monthlySubs)}</b> בחודש</mark>, כלומר <b className="num">{money(monthlySubs * 12)}</b> בשנה. </> : null}
          {aiMonthly ? <>מזה בינה מלאכותית: <b className="num">{money(aiMonthly)}</b> בחודש. </> : null}
          {forecastTotal ? <>צפי עד {monthShort(to)}: עוד <b className="num">{money(forecastTotal)}</b> במנויים, ובסך הכול <b className="num">{money(total + forecastTotal)}</b>. </> : null}
          {missing ? <span className="warn-red"><b className="num">{missing}</b> קבלות בלי סכום, ולכן הסכום חסר.</span> : null}
        </p>
        <Alerts list={real} onPick={(store) => setPick({ kind: 'store', key: store })} />
        <div className="seg periods" role="group" aria-label="תקופה">
          <button className="chip press" aria-pressed={period === 'last12'} onClick={() => { setPeriod('last12'); setPick(null); }}>12 חודשים</button>
          {years.slice(0, 3).map((y) => <button key={y} className="chip press" aria-pressed={period === y} onClick={() => { setPeriod(y); setPick(null); }}>{y}</button>)}
        </div>
      </section>

      <section className="panel">
        <header className="panel-h">
          <h2>חודש אחרי חודש</h2>
          <span className="meta">ממוצע <b className="num">{money(avg)}</b> לחודש{peak && peak.total ? <>, השיא ב{monthShort(peak.key)}: <b className="num">{money(peak.total)}</b></> : null}</span>
        </header>
        <p className="axis-note">גובה העמודה: סך ההוצאה בחודש, בשקלים. כל צבע הוא נושא, לפי המקרא. עמודה מקווקוות היא צפי, לפי המנויים הפעילים.</p>
        <div className="mbars" role="list">
          {months.map((m) => (
            <button key={m.key} role="listitem" className={'mbar press' + (isPicked('month', m.key) ? ' on' : '') + (m.key > nowKey ? ' future' : '')} onClick={() => toggle({ kind: 'month', key: m.key })}
              onMouseEnter={() => setHover(m.key)} onMouseLeave={() => setHover(null)}
              aria-label={`${monthShort(m.key)} ${m.key.slice(0, 4)}: ${money(m.total)}, ${m.count} קבלות`}>
              <span className="mbar-val num">{forecast[m.key] ? money(m.total + forecast[m.key]) : m.total ? money(m.total) : ''}</span>
              {forecast[m.key] ? <span className="mbar-forecast" style={{ height: `calc((100% - 58px) * ${(m.total + forecast[m.key]) / max})` }} title={`צפי: עוד ${money(forecast[m.key])} במנויים`} /> : null}
              <span className="mbar-stack" style={{ height: `${(m.total / max) * 100}%` }}>
                {topicOrder.filter((t) => m.byTopic[t]).map((t) => (
                  <span key={t} className="seg-t" style={{ flexGrow: m.byTopic[t], background: catByName(t).color }} title={`${t}: ${money(m.byTopic[t])}`} />
                ))}
              </span>
              {m.missing ? <span className="mbar-missing" title={`${m.missing} בלי סכום`}>{m.missing}</span> : null}
              <span className="mbar-lbl">{monthShort(m.key)}</span>
            </button>
          ))}
        </div>
        {hover && (() => { const m = months.find((x) => x.key === hover)!; return (
          <p className="tip">{monthShort(m.key)} {m.key.slice(0, 4)}: <b className="num">{money(m.total)}</b> ב-<b className="num">{m.count}</b> קבלות{m.missing ? `, ${m.missing} בלי סכום` : ''}.</p>
        ); })()}
        <ul className="legend2">
          {topics.map((t) => <li key={t.key}><span className="sw" style={{ background: catByName(t.key).color }} />{t.key}</li>)}
          <li><span className="sw miss">n</span>בלי סכום</li>
          {forecastTotal ? <li><span className="sw fc" />צפי</li> : null}
        </ul>
      </section>

      <div className="two">
        <section className="panel">
          <header className="panel-h"><h2>לפי נושא</h2><span className="meta">חלק מהסך</span></header>
          <ul className="hbars">
            {topics.map((t) => (
              <li key={t.key}>
                <button className={'hbar press' + (isPicked('topic', t.key) ? ' on' : '')} onClick={() => toggle({ kind: 'topic', key: t.key })}>
                  <span className="hb-name"><CatIcon name={t.key} size={16} /> {t.key}</span>
                  <span className="hb-track"><span className="hb-fill" style={{ width: `${total ? (t.total / total) * 100 : 0}%`, background: catByName(t.key).color }} /></span>
                  <span className="hb-val num">{money(t.total)}</span>
                  <span className="hb-pct num">{total ? Math.round((t.total / total) * 100) : 0}%</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <header className="panel-h"><h2>לפי עסק</h2><span className="meta">8 הגדולים</span></header>
          <ul className="hbars">
            {stores.map((t) => (
              <li key={t.key}>
                <button className={'hbar press' + (isPicked('store', t.key) ? ' on' : '')} onClick={() => toggle({ kind: 'store', key: t.key })}>
                  <span className="hb-name">{t.key}</span>
                  <span className="hb-track"><span className="hb-fill" style={{ width: `${(t.total / Math.max(1, stores[0].total)) * 100}%` }} /></span>
                  <span className="hb-val num">{money(t.total)}</span>
                  <span className="hb-pct num">{t.count}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {pick && (
        <section className="panel picked">
          <header className="panel-h">
            <h2>{pick.kind === 'month' ? `${monthShort(pick.key)} ${pick.key.slice(0, 4)}` : pick.key}</h2>
            <span className="meta"><b className="num">{picked.length}</b> קבלות, <b className="num">{money(picked.reduce((s, r) => s + (r.amount ?? 0), 0))}</b></span>
            <button className="iconbtn press" onClick={() => setPick(null)} aria-label="סגירת הרשימה" title="סגירת הרשימה">×</button>
          </header>
          <ul className="rows">
            {picked.map((r) => (
              <li key={r.id}>
                <button className="row press" onClick={() => go(`#/r/${r.id}`)}>
                  <span className="sw" style={{ background: catByName(r.category).color }} />
                  <span className="row-main"><b>{r.item || 'בלי שם'}</b><small>{r.store} · <span className="num">{fmtDate(r.date)}</span>{foreignNote(r) ? ` · ${foreignNote(r)}` : ''}</small></span>
                  <span className={'num row-amt' + (r.amount == null ? ' missing' : '')}>{r.amount == null ? 'חסר סכום' : money(r.amount)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel">
        <header className="panel-h">
          <h2>מנויים: מה חוזר כל חודש</h2>
          <span className="meta">ב{periodName}: <b className="num">{money(subsTotal)}</b>, <b className="num">{total ? Math.round((subsTotal / total) * 100) : 0}%</b> מכל ההוצאה</span>
        </header>
        <p className="axis-note">מנוי הוא עסק שחייב ב-2 חודשים או יותר. "החיוב הבא" הוא חודש אחרי האחרון. <span className="up">עלייה במחיר</span> מסומנת באדום.</p>
        {!subs.length ? <p className="nothing">עוד אין חיובים חוזרים.</p> : (
          <div className="tablewrap">
            <table className="tbl subs">
              <thead><tr><th>שירות</th><th>לחודש</th><th>ב{period === 'last12' ? '-12 חודשים' : period}</th><th>חיובים</th><th>החיוב הבא</th></tr></thead>
              <tbody>
                {subsInPeriod.map((s) => (
                  <tr key={s.store} className={s.active ? '' : 'stopped'} onClick={() => toggle({ kind: 'store', key: s.store })}>
                    <td><span className="sw" style={{ background: catByName(s.category).color }} /> <b>{s.store}</b><small className="sub-cat">{s.category}</small></td>
                    <td className="num strong">{s.monthly == null ? <span className="missing">חסר</span> : money(s.monthly)}{s.monthlyOrig && <small className="orig">{s.monthlyOrig}</small>}
                      {s.priceChangedFrom != null && <small className={s.monthly! > s.priceChangedFrom ? 'up' : 'down'}>{s.monthly! > s.priceChangedFrom ? 'עלה' : 'ירד'} מ-{money(s.priceChangedFrom)}</small>}</td>
                    <td className="num">{money(s.periodTotal)}</td>
                    <td className="num">{s.charges.length}</td>
                    <td className="num">{s.active ? fmtDate(s.next) : <span className="dim">הופסק ב-{fmtDate(s.last)}</span>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td>מנויים פעילים</td><td className="num strong">{money(monthlySubs)}</td><td className="num strong">{money(subsTotal)}</td><td colSpan={2} className="num">{money(monthlySubs * 12)} בשנה</td></tr></tfoot>
            </table>
          </div>
        )}
      </section>

      <div className="row2 exports">
        <button className="btn press" onClick={() => downloadCSV(inPeriod, `קבלות-${period === 'last12' ? '12-חודשים' : period}.csv`)}>ייצוא {periodName} לאקסל (CSV)</button>
        <button className="btn press" onClick={() => go('#/')}>לכל הקבלות</button>
      </div>
      <p className="small">שקלים בלבד. חיוב בדולר או באירו מומר לפי השער היציג של בנק ישראל ביום החיוב. בכרטיס האשראי השער בפועל עשוי להיות מעט שונה.</p>
    </main>
  );
}
