import { fmtDate, relDays, returnUntil, statusOf, warrantyUntil } from '../dates';
import type { Receipt } from '../types';

/** One line that says what can still be done with this receipt. Green = return, amber = warranty, gray = expired. */
export default function StatusTag({ r, today }: { r: Receipt; today: string }) {
  const s = statusOf(r, today);
  if (s === 'return') {
    const until = returnUntil(r)!;
    return <span className={'tag return' + (relDays(until, today).match(/^(היום|מחר|עוד [1-7] ימים)$/) ? ' soon' : '')} title={`אפשר להחזיר עד ${fmtDate(until, true)}`}>החזרה {relDays(until, today)}</span>;
  }
  if (s === 'warranty') return <span className="tag warranty" title={`אחריות עד ${fmtDate(warrantyUntil(r), true)}`}>אחריות עד {fmtDate(warrantyUntil(r))}</span>;
  if (s === 'expired') return <span className="tag expired">בלי תוקף</span>;
  return null;
}
