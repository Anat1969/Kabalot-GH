/** Reads item, store, date and total out of raw OCR text of a receipt. Pure and tested. */

export interface Parsed {
  store?: string;
  date?: string;
  amount?: number;
}

const TOTAL_WORDS = /(סה["״'׳]?כ|סך\s*הכל|סך\s*הכול|לתשלום|total|amount due|סכום|לשלם)/i;
const NOT_TOTAL = /(מע["״]?מ|vat|הנחה|עודף|change|מזומן|cash|ללא מע)/i;

function toNumber(s: string) {
  const clean = s.replace(/[₪\s]/g, '').replace(/,(?=\d{3}(\D|$))/g, '');
  const n = parseFloat(clean.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const MONEY = /(\d{1,3}(?:,\d{3})+|\d+)[.,](\d{2})(?!\d)/g;

export function parseAmount(text: string): number | undefined {
  const lines = text.split(/\r?\n/);
  let best: number | undefined;
  for (const line of lines) {
    if (!TOTAL_WORDS.test(line) || NOT_TOTAL.test(line)) continue;
    const nums = [...line.matchAll(MONEY)].map((m) => toNumber(m[0])).filter((n): n is number => n != null);
    if (nums.length) {
      const v = Math.max(...nums);
      if (best == null || v > best) best = v;
    }
  }
  if (best != null) return best;
  const all = [...text.matchAll(MONEY)].map((m) => toNumber(m[0])).filter((n): n is number => n != null && n < 1_000_000);
  return all.length ? Math.max(...all) : undefined;
}

export function parseDate(text: string, now = new Date()): string | undefined {
  const re = /(?<!\d)(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})(?!\d)/g;
  const found: string[] = [];
  for (const m of text.matchAll(re)) {
    const d = +m[1], mo = +m[2];
    let y = +m[3];
    if (y < 100) y += 2000;
    if (d < 1 || d > 31 || mo < 1 || mo > 12) continue;
    const date = new Date(y, mo - 1, d);
    if (date.getMonth() !== mo - 1) continue;
    if (date.getTime() > now.getTime() + 86400000 || y < 2000) continue;
    const p = (n: number) => String(n).padStart(2, '0');
    found.push(`${y}-${p(mo)}-${p(d)}`);
  }
  return found[0];
}

export function parseStore(text: string): string | undefined {
  for (const raw of text.split(/\r?\n/).slice(0, 6)) {
    const line = raw.replace(/[^\p{L}\p{N}\s"'׳״&.-]/gu, ' ').replace(/\s+/g, ' ').trim();
    const letters = (line.match(/\p{L}/gu) || []).length;
    if (letters < 3) continue;
    if (/(קבלה|חשבונית|עוסק|ח\.?פ|טל|tel|receipt|invoice|מס'?)/i.test(line)) continue;
    return line.slice(0, 40);
  }
  return undefined;
}

export function parseReceipt(text: string, now = new Date()): Parsed {
  return { store: parseStore(text), date: parseDate(text, now), amount: parseAmount(text) };
}
