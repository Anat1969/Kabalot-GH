/** Summaries over receipts: by month, by topic, by business, and the subscriptions behind them. Pure, tested. */
import { addMonths, parseISO } from './dates';
import type { Receipt } from './types';

export const ym = (iso: string) => iso.slice(0, 7);
const MONTHS = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];
export const monthShort = (key: string) => MONTHS[+key.slice(5, 7) - 1] ?? key;

export interface Bucket { key: string; total: number; count: number; missing: number; byTopic: Record<string, number> }

function bucket(key: string): Bucket { return { key, total: 0, count: 0, missing: 0, byTopic: {} }; }

function add(b: Bucket, r: Receipt) {
  b.count++;
  if (r.amount == null) { b.missing++; return; }
  b.total += r.amount;
  b.byTopic[r.category] = (b.byTopic[r.category] ?? 0) + r.amount;
}

/** Every month between the first and last receipt of the range, even empty ones, so gaps are visible. */
export function byMonth(list: Receipt[], from: string, to: string): Bucket[] {
  const out: Bucket[] = [];
  const d = parseISO(from + '-01')!;
  const end = parseISO(to + '-01')!;
  while (d <= end) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push(bucket(key));
    d.setMonth(d.getMonth() + 1);
  }
  const idx = new Map(out.map((b, i) => [b.key, i]));
  for (const r of list) { const i = idx.get(ym(r.date)); if (i != null) add(out[i], r); }
  return out;
}

export function byKey(list: Receipt[], key: (r: Receipt) => string): Bucket[] {
  const m = new Map<string, Bucket>();
  for (const r of list) { const k = key(r) || 'לא ידוע'; if (!m.has(k)) m.set(k, bucket(k)); add(m.get(k)!, r); }
  return [...m.values()].sort((a, b) => b.total - a.total || b.count - a.count);
}

export interface Subscription {
  store: string;
  category: string;
  item: string;
  charges: Receipt[];
  /** Latest charge in shekels (null when unknown). */
  monthly: number | null;
  monthlyOrig: string;
  total: number;
  last: string;
  next: string | null;
  /** Previous charge amount when the price changed at the last charge. */
  priceChangedFrom: number | null;
  active: boolean;
}

/** A business is a subscription when marked so, or when it charged in 2 or more different months. */
export function subscriptions(list: Receipt[], today: string): Subscription[] {
  const groups = new Map<string, Receipt[]>();
  for (const r of list) {
    const k = (r.store || '').trim().toLowerCase();
    if (!k) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }
  const subs: Subscription[] = [];
  for (const charges of groups.values()) {
    const months = new Set(charges.map((r) => ym(r.date)));
    const marked = charges.some((r) => r.kind === 'subscription');
    const markedOnce = charges.every((r) => r.kind === 'one-time');
    if (markedOnce || (!marked && months.size < 2)) continue;
    charges.sort((a, b) => a.date.localeCompare(b.date));
    const last = charges[charges.length - 1];
    const prev = charges.length > 1 ? charges[charges.length - 2] : null;
    const next = addMonths(last.date, 1);
    const active = !!next && next >= addMonths(today, -1)!.slice(0, 10) && daysSince(last.date, today) <= 45;
    const lastAmt = last.amount;
    const changed = prev && prev.amount != null && lastAmt != null && Math.abs(prev.amount - lastAmt) / Math.max(1, prev.amount) > 0.05 && ym(prev.date) !== ym(last.date);
    subs.push({
      store: last.store, category: last.category, item: last.item, charges,
      monthly: lastAmt,
      monthlyOrig: last.currency && last.currency !== 'ILS' && last.amountOrig != null ? `${({ USD: '$', EUR: '€', JPY: '¥' } as Record<string, string>)[last.currency] ?? ''}${last.amountOrig}` : '',
      total: charges.reduce((s, r) => s + (r.amount ?? 0), 0),
      last: last.date, next: active ? next : null,
      priceChangedFrom: changed ? prev!.amount : null,
      active,
    });
  }
  return subs.sort((a, b) => Number(b.active) - Number(a.active) || (b.monthly ?? 0) - (a.monthly ?? 0));
}

function daysSince(iso: string, today: string) {
  return Math.round((parseISO(today)!.getTime() - parseISO(iso)!.getTime()) / 86400000);
}

/** CSV for a spreadsheet or the accountant: one line per receipt, UTF-8 with BOM so Excel reads Hebrew. */
export function toCSV(list: Receipt[]) {
  const head = ['תאריך', 'חפץ', 'עסק', 'נושא', 'סוג', 'סכום בשקלים', 'מטבע מקור', 'סכום מקור', 'שער יציג', 'אסמכתא והערות'];
  const esc = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const rows = [...list].sort((a, b) => a.date.localeCompare(b.date)).map((r) => [
    r.date, r.item, r.store, r.category, r.kind === 'subscription' ? 'מנוי' : 'קנייה', r.amount ?? '', r.currency ?? 'ILS', r.amountOrig ?? '', r.rate ?? '', r.notes,
  ].map(esc).join(','));
  return '﻿' + [head.join(','), ...rows].join('\n');
}

/** Forecast for months after today: every active subscription keeps charging its last amount monthly. */
export function projection(subs: Subscription[], fromKey: string, toKey: string, after = ''): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of subs) {
    if (!s.active || !s.next || s.monthly == null) continue;
    let d: string | null = s.next;
    while (d && ym(d) <= toKey) {
      if (ym(d) >= fromKey && d > after) out[ym(d)] = (out[ym(d)] ?? 0) + s.monthly;
      d = addMonths(d, 1);
    }
  }
  return out;
}
