/** Alerts that matter before money leaves: a subscription about to renew, an annual plan coming up,
 *  and a price rise. Price rises are measured in the original currency, so a change in the exchange
 *  rate is not mistaken for a new price. Pure, tested. */
import { daysBetween, fmtDate } from './dates';
import { subscriptions } from './summary';
import type { Receipt } from './types';

export interface Alert { id: string; kind: 'renew' | 'annual' | 'rise'; title: string; detail: string; days?: number; storeKey: string }

const money = (n: number, cur = 'ILS') => (cur === 'USD' ? '$' : cur === 'EUR' ? '€' : cur === 'JPY' ? '¥' : '₪') + (Math.round(n * 100) / 100).toLocaleString('he-IL');
const inDays = (n: number) => (n === 0 ? 'היום' : n === 1 ? 'מחר' : `בעוד ${n} ימים`);

export function alertsFor(list: Receipt[], today: string): Alert[] {
  const out: Alert[] = [];
  for (const s of subscriptions(list, today)) {
    if (s.active && s.next) {
      const d = daysBetween(today, s.next);
      if (d >= 0 && d <= 7) out.push({ id: `renew:${s.store}:${s.next}`, kind: 'renew', storeKey: s.store, days: d,
        title: `${s.store} יחויב ${inDays(d)}`, detail: `${fmtDate(s.next)}, בערך ${s.monthly != null ? money(s.monthly) : 'סכום לא ידוע'}${s.monthlyOrig ? ` (${s.monthlyOrig})` : ''}` });
    }
    const [prev, last] = s.charges.slice(-2);
    if (prev && last && last.kind !== 'one-time' && daysBetween(last.date, today) <= 60) {
      const sameCur = (prev.currency ?? 'ILS') === (last.currency ?? 'ILS');
      const a = sameCur && last.currency && last.currency !== 'ILS' ? prev.amountOrig : prev.amount;
      const b = sameCur && last.currency && last.currency !== 'ILS' ? last.amountOrig : last.amount;
      if (a != null && b != null && b > a * 1.05) {
        const cur = sameCur ? last.currency ?? 'ILS' : 'ILS';
        out.push({ id: `rise:${s.store}:${last.date}`, kind: 'rise', storeKey: s.store,
          title: `${s.store} התייקר ב-${Math.round((b / a - 1) * 100)}%`, detail: `מ-${money(a, cur)} ל-${money(b, cur)} בחודש, מ-${fmtDate(last.date)}` });
      }
    }
  }
  // Annual plans: "מתחדש ב-DD.MM.YYYY" in the notes.
  for (const r of list) {
    const m = /מתחדש ב-(\d{2})\.(\d{2})\.(\d{4})/.exec(r.notes || '');
    if (!m) continue;
    const when = `${m[3]}-${m[2]}-${m[1]}`;
    const d = daysBetween(today, when);
    if (d >= 0 && d <= 30) out.push({ id: `annual:${r.id}:${when}`, kind: 'annual', storeKey: r.store, days: d,
      title: `${r.store}: חידוש שנתי ${inDays(d)}`, detail: `${fmtDate(when)}, בשנה שעברה ${r.amountOrig != null ? money(r.amountOrig, r.currency) : r.amount != null ? money(r.amount) : ''}` });
  }
  const order = { rise: 0, renew: 1, annual: 2 } as const;
  return out.sort((x, y) => order[x.kind] - order[y.kind] || (x.days ?? 99) - (y.days ?? 99));
}

/** Also as a system notification while the app is open, once per alert (opt-in). */
export function notifyOnce(alerts: Alert[]) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  let seen: string[] = [];
  try { seen = JSON.parse(localStorage.getItem('kabalot.alerted') || '[]'); } catch { /* fresh */ }
  for (const a of alerts) {
    if (seen.includes(a.id)) continue;
    try { new Notification(a.title, { body: a.detail, icon: '/icon-192.png', tag: a.id }); } catch { /* not allowed here */ }
    seen.push(a.id);
  }
  try { localStorage.setItem('kabalot.alerted', JSON.stringify(seen.slice(-200))); } catch { /* ok */ }
}
