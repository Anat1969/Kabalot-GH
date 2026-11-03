import type { Receipt, Status } from './types';

export const todayISO = () => toISO(new Date());

export function toISO(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function parseISO(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3]);
}

export function addDays(iso: string, days: number) {
  const d = parseISO(iso);
  if (!d) return null;
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export function addMonths(iso: string, months: number) {
  const d = parseISO(iso);
  if (!d) return null;
  d.setMonth(d.getMonth() + months);
  return toISO(d);
}

export function daysBetween(fromISO: string, toISOStr: string) {
  const a = parseISO(fromISO), b = parseISO(toISOStr);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export const returnUntil = (r: Receipt) => (r.date && r.returnDays ? addDays(r.date, r.returnDays) : null);
export const warrantyUntil = (r: Receipt) => (r.date && r.warrantyMonths ? addMonths(r.date, r.warrantyMonths) : null);

export function statusOf(r: Receipt, today = todayISO()): Status {
  const ret = returnUntil(r);
  if (ret && ret >= today) return 'return';
  const war = warrantyUntil(r);
  if (war && war >= today) return 'warranty';
  if (ret || war) return 'expired';
  return 'none';
}

const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

export function fmtDate(iso: string | null, long = false) {
  const d = iso ? parseISO(iso) : null;
  if (!d) return '';
  if (long) return `${d.getDate()} ב${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}`;
}

export const monthLabel = (iso: string) => {
  const d = parseISO(iso);
  return d ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}` : 'בלי תאריך';
};

export function fmtMoney(n: number | null) {
  if (n == null || Number.isNaN(n)) return '';
  return '₪' + n.toLocaleString('he-IL', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
}

/** "עוד 3 ימים" / "היום" / "לפני 4 ימים" */
export function relDays(iso: string | null, today = todayISO()) {
  if (!iso) return '';
  const n = daysBetween(today, iso);
  if (n === 0) return 'היום';
  if (n === 1) return 'מחר';
  if (n > 0) return n < 60 ? `עוד ${n} ימים` : n < 730 ? `עוד ${Math.round(n / 30)} חודשים` : `עוד ${Math.round(n / 365)} שנים`;
  return 'פג';
}
