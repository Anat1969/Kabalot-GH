import { addDays, todayISO } from './dates';
import type { Receipt } from './types';
import { putFile, putReceipt, uid } from './db';

interface Demo { item: string; store: string; category: string; ago: number; amount: number; returnDays: number | null; warrantyMonths: number | null; notes?: string; lines: [string, number][] }

const DEMOS: Demo[] = [
  { item: 'אוזניות אלחוטיות', store: 'KSP', category: 'אלקטרוניקה', ago: 4, amount: 549, returnDays: 14, warrantyMonths: 12, notes: 'מתנה ליום הולדת, שחורות', lines: [['אוזניות BT ANC', 549]] },
  { item: 'מעיל צמר', store: 'קסטרו', category: 'ביגוד והנעלה', ago: 12, amount: 389.9, returnDays: 14, warrantyMonths: null, notes: 'מידה M, אפשר להחליף לזיכוי', lines: [['מעיל צמר אפור M', 389.9]] },
  { item: 'מכונת קפה', store: 'שקם אלקטריק', category: 'מכשירי חשמל', ago: 230, amount: 1290, returnDays: 14, warrantyMonths: 24, lines: [['מכונת אספרסו', 1190], ['קפסולות 100', 100]] },
  { item: 'כיסא עבודה', store: 'איקאה', category: 'בית וריהוט', ago: 60, amount: 699, returnDays: 365, warrantyMonths: 120, lines: [['כיסא משרדי', 699]] },
  { item: 'נעלי ריצה', store: 'דקתלון', category: 'ספורט ופנאי', ago: 400, amount: 329, returnDays: 30, warrantyMonths: 6, lines: [['נעלי ריצה 39', 329]] },
  { item: 'מקדחה רוטטת', store: 'ACE', category: 'כלים וגינה', ago: 20, amount: 459, returnDays: 14, warrantyMonths: 36, notes: 'כולל סט מקדחים', lines: [['מקדחה 18V', 399], ['סט מקדחים', 60]] },
];

function drawReceipt(d: Demo, date: string): Promise<{ blob: Blob; thumb: string }> {
  const W = 600, H = 300 + d.lines.length * 44 + 260;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fffdf8'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#1b1b1b'; g.textAlign = 'center'; g.direction = 'rtl';
  g.font = '600 40px "IBM Plex Sans Hebrew", sans-serif'; g.fillText(d.store, W / 2, 70);
  g.font = '22px "IBM Plex Mono", "IBM Plex Sans Hebrew", monospace';
  g.fillText('עוסק מורשה 51-' + (1000000 + d.amount * 7).toFixed(0).slice(0, 7), W / 2, 110);
  const [y, m, dd] = date.split('-');
  g.fillText(`קבלה מס' ${(10000 + d.ago * 37) % 99999}   ${dd}/${m}/${y}`, W / 2, 145);
  g.fillText('- - - - - - - - - - - - - - - - - - - -', W / 2, 185);
  let yy = 235;
  g.font = '26px "IBM Plex Mono", "IBM Plex Sans Hebrew", monospace';
  for (const [name, p] of d.lines) {
    g.textAlign = 'right'; g.fillText(name, W - 40, yy);
    g.textAlign = 'left'; g.fillText(p.toFixed(2), 40, yy);
    yy += 44;
  }
  g.textAlign = 'center'; g.font = '22px "IBM Plex Mono", monospace';
  g.fillText('- - - - - - - - - - - - - - - - - - - -', W / 2, yy + 5);
  g.font = '600 34px "IBM Plex Sans Hebrew", sans-serif';
  g.textAlign = 'right'; g.fillText('סה"כ לתשלום', W - 40, yy + 60);
  g.textAlign = 'left'; g.fillText(d.amount.toFixed(2), 40, yy + 60);
  g.textAlign = 'center'; g.font = '22px "IBM Plex Sans Hebrew", sans-serif';
  g.fillText('תודה ולהתראות', W / 2, yy + 130);
  // barcode
  for (let i = 0; i < 70; i++) { g.fillRect(120 + i * 5, yy + 160, (i * 7) % 3 + 1, 60); }
  const t = document.createElement('canvas'); t.width = 120; t.height = Math.round(120 * H / W);
  t.getContext('2d')!.drawImage(c, 0, 0, t.width, t.height);
  return new Promise((res) => c.toBlob((b) => res({ blob: b!, thumb: t.toDataURL('image/jpeg', 0.7) }), 'image/jpeg', 0.85));
}

export async function loadDemo() {
  try { await document.fonts?.ready; } catch { /* fonts are optional */ }
  const today = todayISO();
  for (const d of DEMOS) {
    const date = addDays(today, -d.ago)!;
    const { blob, thumb } = await drawReceipt(d, date);
    const fileId = uid();
    await putFile({ id: fileId, original: blob, display: blob, name: d.item + '.jpg' });
    const now = Date.now();
    const r: Receipt = {
      id: uid(), item: d.item, store: d.store, category: d.category, date, amount: d.amount,
      returnDays: d.returnDays, warrantyMonths: d.warrantyMonths, notes: d.notes ?? '',
      ocrText: `${d.store}\n${d.lines.map(([n, p]) => `${n} ${p}`).join('\n')}\nסה"כ ${d.amount}`,
      fileId, fileType: 'image/jpeg', thumb, auto: {}, demo: true, createdAt: now, updatedAt: now,
    };
    await putReceipt(r);
  }
}
