import { fmtDate, statusOf, returnUntil, warrantyUntil, monthLabel } from './dates';
import type { Receipt, Status } from './types';

export type SortKey = 'item' | 'store' | 'date' | 'amount' | 'returnUntil' | 'warrantyUntil' | 'category';
export type GroupKey = 'category' | 'store' | 'month' | 'none';
export type StatusFilter = 'all' | 'return' | 'warranty' | 'expired';

export const SORT_LABEL: Record<SortKey, string> = { item: 'חפץ', store: 'חנות', date: 'תאריך', amount: 'עלות', returnUntil: 'החזרה עד', warrantyUntil: 'אחריות עד', category: 'סוג' };
export const GROUP_LABEL: Record<GroupKey, string> = { category: 'סוג החפץ', store: 'חנות', month: 'חודש', none: 'בלי קיבוץ' };
export const STATUS_LABEL: Record<StatusFilter, string> = { all: 'הכול', return: 'אפשר להחזיר', warranty: 'באחריות', expired: 'בלי תוקף' };

const norm = (s: string) => s.toLowerCase().replace(/["״'׳]/g, '');

export function haystack(r: Receipt) {
  return norm([r.item, r.store, r.category, r.notes, r.ocrText, r.amount ?? '', fmtDate(r.date), r.date].join(' '));
}

export function matches(r: Receipt, q: string) {
  const words = norm(q).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const h = haystack(r);
  return words.every((w) => h.includes(w));
}

export function filterStatus(r: Receipt, f: StatusFilter, today: string) {
  if (f === 'all') return true;
  const s: Status = statusOf(r, today);
  if (f === 'return') return s === 'return';
  if (f === 'warranty') return s === 'return' || s === 'warranty';
  return s === 'expired' || s === 'none';
}

function val(r: Receipt, k: SortKey): string | number {
  switch (k) {
    case 'amount': return r.amount ?? -1;
    case 'returnUntil': return returnUntil(r) ?? '';
    case 'warrantyUntil': return warrantyUntil(r) ?? '';
    default: return (r[k] as string) ?? '';
  }
}

export function sortList(list: Receipt[], k: SortKey, dir: 1 | -1) {
  return [...list].sort((a, b) => {
    const x = val(a, k), y = val(b, k);
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'he');
    return c * dir || b.createdAt - a.createdAt;
  });
}

export function groupOf(r: Receipt, g: GroupKey) {
  if (g === 'category') return r.category || 'אחר';
  if (g === 'store') return r.store || 'חנות לא ידועה';
  if (g === 'month') return monthLabel(r.date);
  return '';
}

export const sum = (list: Receipt[]) => list.reduce((s, r) => s + (r.amount ?? 0), 0);
