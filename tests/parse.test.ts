import { describe, expect, it } from 'vitest';
import { parseAmount, parseDate, parseStore, parseReceipt } from '../src/parse';
import { statusOf } from '../src/dates';
import { matches, sortList } from '../src/search';
import type { Receipt } from '../src/types';

const now = new Date(2026, 10, 3);
const text = `שקם אלקטריק
עוסק מורשה 512345678
קבלה מס' 4411   28/10/2026 14:22
מכונת אספרסו        1,190.00
קפסולות               100.00
מע"מ 18%              196.78
סה"כ לתשלום         1,290.00
מזומן               1,300.00
עודף                   10.00`;

describe('reading a receipt', () => {
  it('finds the total, not VAT or cash', () => expect(parseAmount(text)).toBe(1290));
  it('finds the date', () => expect(parseDate(text, now)).toBe('2026-10-28'));
  it('finds the store on the first line', () => expect(parseStore(text)).toBe('שקם אלקטריק'));
  it('ignores future dates and handles 2-digit years', () => expect(parseDate('01.02.27 ו-15.03.26', now)).toBe('2026-03-15'));
  it('falls back to the largest money value', () => expect(parseAmount('חולצה 89.90\nמכנס 149.90')).toBe(149.9));
  it('returns nothing on empty text', () => expect(parseReceipt('', now)).toEqual({ store: undefined, date: undefined, amount: undefined }));
});

const base: Receipt = { id: '1', item: 'אוזניות', store: 'KSP', category: 'אלקטרוניקה', date: '2026-10-30', amount: 549, returnDays: 14, warrantyMonths: 12, notes: 'שחורות', ocrText: '', fileId: null, fileType: '', thumb: '', auto: {}, createdAt: 1, updatedAt: 1 };

describe('status and search', () => {
  it('returnable inside the return window', () => expect(statusOf(base, '2026-11-03')).toBe('return'));
  it('warranty after the return window', () => expect(statusOf(base, '2026-12-01')).toBe('warranty'));
  it('expired after warranty', () => expect(statusOf(base, '2028-01-01')).toBe('expired'));
  it('search matches every word across fields', () => {
    expect(matches(base, 'אוזניות ksp')).toBe(true);
    expect(matches(base, 'שחורות 549')).toBe(true);
    expect(matches(base, 'מעיל')).toBe(false);
  });
  it('sorts by amount both ways', () => {
    const b = { ...base, id: '2', amount: 100 };
    expect(sortList([base, b], 'amount', 1)[0].id).toBe('2');
    expect(sortList([base, b], 'amount', -1)[0].id).toBe('1');
  });
});

import { parseMessage } from '../src/parse';

describe('reading a receipt from a text message', () => {
  const now2 = new Date(2026, 10, 3);
  it('store, amount and link from a typical SMS', () => {
    const r = parseMessage('תודה שקנית בשופרסל! הקבלה הדיגיטלית שלך על סך 245.90 ש"ח זמינה כאן: https://e.shufersal.co.il/r/AB12cd', now2);
    expect(r.store).toBe('שופרסל');
    expect(r.amount).toBe(245.9);
    expect(r.link).toBe('https://e.shufersal.co.il/r/AB12cd');
  });
  it('sender prefix and shekel sign before the number', () => {
    const r = parseMessage('FOX: חשבונית מס/קבלה לרכישתך מ-01/11/2026 בסך ₪ 389 לצפייה https://invoice.example.com/x?id=9.', now2);
    expect(r.store).toBe('FOX');
    expect(r.amount).toBe(389);
    expect(r.date).toBe('2026-11-01');
    expect(r.link).toBe('https://invoice.example.com/x?id=9');
  });
  it('charge message without a link', () => {
    const r = parseMessage('בוצעה עסקה בכרטיסך המסתיים ב-1234 ברשת איקאה בסך 1,299.00 ש"ח', now2);
    expect(r.amount).toBe(1299);
    expect(r.link).toBeUndefined();
  });
});
