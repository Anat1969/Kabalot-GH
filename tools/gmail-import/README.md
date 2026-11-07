# קבלות מהמייל: איסוף חודשי

המטרה: בכל חודש, כל הקבלות והחשבוניות מ-Gmail של ענת נכנסות לאפליקציה, בלי הקלדה.
**מאז 07.11.2026 הקבלות נכנסות ישר לחשבון של ענת** (Supabase `ktqmwpbzcnzkhjskqisy`, טבלה `kabalot_receipts`, owner `825fd850-e586-4775-b861-cb2409afa74a`). האפליקציה מושכת אותן לבד בכל מכשיר, ומציירת להן תמונה מהטקסט. אין קובץ ואין שחזור.
המזהה הוא `gm-<messageId>`, ולכן הכנסה חוזרת לא משכפלת (`on conflict (owner, id)`).
קובץ שחזור (שלבים 6 ו-7) נשאר רק כחלופה, כשאין גישה ל-Supabase.

## השלבים
1. **חיפוש ב-Gmail** (כלי Gmail, קריאה בלבד) לחודש הקודם: `after:YYYY/MM/01 before:YYYY/MM+1/01`, עם מילים: receipt, invoice, קבלה, חשבונית, "payment received", "חויב", ושולחי חיוב ידועים: googleplay-noreply@google.com, invoice+statements@lovable.dev, invoice+statements@supabase.com, invoice+statements@midjourney.com, receipts+...@stripe.com, team@base44.com, tabulaprio@clalit.org.il.
2. **מסננים החוצה:** תזכורות לחיוב עתידי, שיווק, עדכוני מוצר, התראות GitHub ו-Vercel, ומייל בלי חיוב בפועל. חשבונית "due" נכנסת רק אם אין "Payment received" לאותו מספר.
3. **כותבים `gmail.json`:** מערך עם `messageId, threadId, date, vendor, item, kind (subscription|one-time), topic (בינה מלאכותית, פיתוח ותשתיות, תקשורת וגלישה, נסיעות ולינה, בריאות, אחר), amount, currency, ref, period, text, viewUrl`. סכום שלא מופיע בגוף המייל (למשל PDF של כללית) נשאר `null`. לא ממציאים.
4. **שער יציג:** מורידים CSV מבנק ישראל (לכל מטבע: RER_USD_ILS, RER_EUR_ILS, RER_JPY_ILS. הין מצוטט ל-100 יחידות, והכלי מחלק לבד):
   `https://edge.boi.org.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/EXR/1.0/RER_USD_ILS?startperiod=YYYY-MM-01&endperiod=YYYY-MM-DD&format=csv`
5. **ממירים לפריטים:** `python3 -I tools/gmail-import/to-items.py gmail.json usd.csv items.json [eur.csv] [jpy.csv]`
6. **בונים את הקובץ בקוד של האפליקציה:** `npx vite --port 5180 --strictPort &` ואז `node tools/gmail-import/build.cjs items.json kabalot-YYYY-MM.json`
7. **בודקים:** שחזור הקובץ בדפדפן נקי מחזיר את מספר הקבלות הצפוי.
8. **מכניסים לחשבון** (כלי Supabase, execute_sql), לפי הדפוס:
   ```sql
   insert into public.kabalot_receipts (owner, id, data)
   select '825fd850-e586-4775-b861-cb2409afa74a'::uuid, x->>'id', x from jsonb_array_elements('<items as Receipt json>'::jsonb) x
   on conflict (owner, id) do nothing;
   ```
   כל פריט הוא Receipt: `id = 'gm-'||messageId`, item, store, category, date, amount (שקלים), currency, amountOrig, rate, rateDate, kind, notes, `ocrText` (תקציר המייל), `fileId = 'f-'||messageId`, `thumb = ''`, `source = 'email'`, `sourceId = 'gmail:'||messageId`, link, `auto = {}`, createdAt ו-updatedAt באלפיות שנייה. לא לדרוס קבלה קיימת (`do nothing`), כי ענת אולי השלימה בה סכום.
9. **מודיעים לענת** בשורה אחת: כמה קבלות נכנסו, סך בשקלים, אילו מנויים חויבו, מה בלי סכום, ושינוי מחיר אם היה. היא רואה אותן באפליקציה, בלי לעשות דבר.

## גבולות ידועים
- מיילים של Anthropic (חיוב Claude) חסומים לכלי Gmail של Claude. ענת מוסיפה אותם ידנית מהמייל.
- קבלות SMS לא נגישות. נכנסות דרך "מהודעה" באפליקציה.
- הקובץ מכיל מידע רפואי ופיננסי. לא נשמר בריפו.
