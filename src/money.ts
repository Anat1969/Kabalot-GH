/** Money across currencies. Every sum in the app is in shekels; foreign charges are converted
 *  with the Bank of Israel representative rate of the charge date (the official Israeli standard). */
import type { Receipt } from './types';

export const SYMBOL = { ILS: '₪', USD: '$', EUR: '€' } as const;
export type Cur = keyof typeof SYMBOL;

export const curOf = (r: Receipt): Cur => r.currency ?? 'ILS';

export function fmtCur(n: number | null | undefined, cur: Cur = 'ILS') {
  if (n == null || Number.isNaN(n)) return '';
  const s = n.toLocaleString('he-IL', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
  return SYMBOL[cur] + s;
}

/** "$25.00, ₪77.80 לפי השער היציג" style detail for a foreign charge. */
export function foreignNote(r: Receipt) {
  const cur = curOf(r);
  if (cur === 'ILS' || r.amountOrig == null) return '';
  return `${fmtCur(r.amountOrig, cur)}${r.rate ? ` · שער יציג ${r.rate}` : ' · בלי שער'}`;
}

/** Fetches the representative rate for a date (the app's own /api/rate, which asks the Bank of Israel). */
export async function fetchRate(cur: Cur, date: string): Promise<{ rate: number; date: string } | null> {
  if (cur === 'ILS') return { rate: 1, date };
  try {
    const r = await fetch(`/api/rate?cur=${cur}&date=${date}`);
    if (!r.ok) return null;
    const j = await r.json();
    return typeof j.rate === 'number' ? { rate: j.rate, date: j.date } : null;
  } catch { return null; }
}

export const toShekels = (orig: number | null | undefined, rate: number | null | undefined) =>
  orig == null || !rate ? null : Math.round(orig * rate * 100) / 100;
