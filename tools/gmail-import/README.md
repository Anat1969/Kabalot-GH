# קבלות מהמייל: איסוף חודשי

המטרה: בכל חודש, כל הקבלות והחשבוניות מ-Gmail של ענת נכנסות לאפליקציה, בלי הקלדה.
האפליקציה שומרת בטלפון בלבד, ולכן התוצר הוא **קובץ שחזור** שענת פותחת באפליקציה: כפתור הלוגו, ואז "שחזור מגיבוי".
קבלה שכבר קיימת לא משוכפלת. אם חסר בה סכום או מטבע, הקובץ משלים אותו, בלי לדרוס מה שענת הקלידה.

## השלבים
1. **חיפוש ב-Gmail** (כלי Gmail, קריאה בלבד) לחודש הקודם: `after:YYYY/MM/01 before:YYYY/MM+1/01`, עם מילים: receipt, invoice, קבלה, חשבונית, "payment received", "חויב", ושולחי חיוב ידועים: googleplay-noreply@google.com, invoice+statements@lovable.dev, invoice+statements@supabase.com, invoice+statements@midjourney.com, receipts+...@stripe.com, team@base44.com, tabulaprio@clalit.org.il.
2. **מסננים החוצה:** תזכורות לחיוב עתידי, שיווק, עדכוני מוצר, התראות GitHub ו-Vercel, ומייל בלי חיוב בפועל. חשבונית "due" נכנסת רק אם אין "Payment received" לאותו מספר.
3. **כותבים `gmail.json`:** מערך עם `messageId, threadId, date, vendor, item, kind (subscription|one-time), topic (בינה מלאכותית, פיתוח ותשתיות, תקשורת וגלישה, נסיעות ולינה, בריאות, אחר), amount, currency, ref, period, text, viewUrl`. סכום שלא מופיע בגוף המייל (למשל PDF של כללית) נשאר `null`. לא ממציאים.
4. **שער יציג:** מורידים CSV מבנק ישראל (לכל מטבע: RER_USD_ILS, RER_EUR_ILS, RER_JPY_ILS. הין מצוטט ל-100 יחידות, והכלי מחלק לבד):
   `https://edge.boi.org.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/EXR/1.0/RER_USD_ILS?startperiod=YYYY-MM-01&endperiod=YYYY-MM-DD&format=csv`
5. **ממירים לפריטים:** `python3 -I tools/gmail-import/to-items.py gmail.json usd.csv items.json [eur.csv] [jpy.csv]`
6. **בונים את הקובץ בקוד של האפליקציה:** `npx vite --port 5180 --strictPort &` ואז `node tools/gmail-import/build.cjs items.json kabalot-YYYY-MM.json`
7. **בודקים:** שחזור הקובץ בדפדפן נקי מחזיר את מספר הקבלות הצפוי.
8. **מוסרים לענת** את הקובץ, עם שורה אחת: כמה קבלות, סך בשקלים, ומה חסר סכום.

## גבולות ידועים
- מיילים של Anthropic (חיוב Claude) חסומים לכלי Gmail של Claude. ענת מוסיפה אותם ידנית מהמייל.
- קבלות SMS לא נגישות. נכנסות דרך "מהודעה" באפליקציה.
- הקובץ מכיל מידע רפואי ופיננסי. לא נשמר בריפו.
