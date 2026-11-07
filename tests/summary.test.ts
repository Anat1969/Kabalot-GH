import { describe, expect, it } from 'vitest';
import { byKey, byMonth, subscriptions, toCSV } from '../src/summary';
import type { Receipt } from '../src/types';

let n = 0;
const r = (date: string, store: string, amount: number | null, extra: Partial<Receipt> = {}): Receipt => ({
  id: String(++n), item: store, store, category: 'בינה מלאכותית', date, amount, returnDays: null, warrantyMonths: null,
  notes: '', ocrText: '', fileId: null, fileType: '', thumb: '', auto: {}, createdAt: n, updatedAt: n, ...extra,
});

const list = [
  r('2026-08-27', 'Google Play', 74.9), r('2026-09-27', 'Google Play', 74.9), r('2026-10-27', 'Google Play', 74.9),
  r('2026-09-23', 'Lovable', 77.5), r('2026-10-23', 'Lovable', 98.2),
  r('2026-10-11', 'כללית', null, { category: 'בריאות ויופי' }),
  r('2026-08-05', 'איקאה', 699, { category: 'בית וריהוט' }),
];

describe('summaries', () => {
  it('months include empty ones and count missing amounts', () => {
    const m = byMonth(list, '2026-07', '2026-10');
    expect(m.map((b) => b.key)).toEqual(['2026-07', '2026-08', '2026-09', '2026-10']);
    expect(m[0].count).toBe(0);
    expect(m[3].total).toBeCloseTo(74.9 + 98.2);
    expect(m[3].missing).toBe(1);
  });
  it('by topic, largest first', () => {
    expect(byKey(list, (x) => x.category)[0].key).toBe('בית וריהוט');
  });
  it('detects subscriptions, the next charge and a price change', () => {
    const s = subscriptions(list, '2026-11-07');
    const g = s.find((x) => x.store === 'Google Play')!;
    expect(g.monthly).toBe(74.9);
    expect(g.next).toBe('2026-11-27');
    expect(g.charges.length).toBe(3);
    const l = s.find((x) => x.store === 'Lovable')!;
    expect(l.priceChangedFrom).toBe(77.5);
    expect(s.find((x) => x.store === 'איקאה')).toBeUndefined();
  });
  it('a subscription that stopped is not active', () => {
    const s = subscriptions([r('2026-03-01', 'Midjourney', 120), r('2026-04-01', 'Midjourney', 120)], '2026-11-07');
    expect(s[0].active).toBe(false);
    expect(s[0].next).toBeNull();
  });
  it('CSV opens in Excel with Hebrew', () => {
    const csv = toCSV(list);
    expect(csv.startsWith('﻿תאריך,')).toBe(true);
    expect(csv.split('\n').length).toBe(list.length + 1);
  });
});

import { projection } from '../src/summary';
describe('forecast', () => {
  it('projects active subscriptions into the months ahead only', () => {
    const subs = subscriptions(list, '2026-11-07');
    const p = projection(subs, '2026-11', '2026-12');
    expect(Object.keys(p).sort()).toEqual(['2026-11', '2026-12']);
    expect(p['2026-12']).toBeCloseTo(74.9 + 98.2);
  });
});

import { alertsFor } from '../src/alerts';
describe('alerts', () => {
  it('warns of a renewal within 7 days and of a price rise in the original currency', () => {
    const subs = [
      r('2026-09-23', 'Supabase', 75.42, { currency: 'USD', amountOrig: 25, kind: 'subscription', category: 'פיתוח ותשתיות' }),
      r('2026-10-23', 'Supabase', 111.44, { currency: 'USD', amountOrig: 35.81, kind: 'subscription', category: 'פיתוח ותשתיות' }),
      r('2026-09-23', 'Lovable', 75.42, { currency: 'USD', amountOrig: 25, kind: 'subscription' }),
      r('2026-10-23', 'Lovable', 77.8, { currency: 'USD', amountOrig: 25, kind: 'subscription' }),
      r('2026-04-09', 'Midjourney', 889, { kind: 'one-time', notes: 'מנוי שנתי, מתחדש ב-09.04.2027' }),
    ];
    const a = alertsFor(subs, '2026-11-18');
    const rise = a.filter((x) => x.kind === 'rise');
    expect(rise.map((x) => x.storeKey)).toEqual(['Supabase']); // Lovable's shekel change is only the rate
    expect(rise[0].title).toContain('43%');
    expect(a.filter((x) => x.kind === 'renew').map((x) => x.storeKey).sort()).toEqual(['Lovable', 'Supabase']);
    expect(alertsFor(subs, '2027-03-20').some((x) => x.kind === 'annual')).toBe(true);
    expect(alertsFor(subs, '2026-11-01').some((x) => x.kind === 'renew')).toBe(false);
  });
});
