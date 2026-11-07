/** Categories of things bought. Each has a line icon path (24x24, stroke 1.75) and words that suggest it. */
export interface Category { name: string; icon: string; words: string[]; color: string }

export const CATEGORIES: Category[] = [
  { name: 'אלקטרוניקה', color: '#3b5bdb', icon: 'M4 5h16v11H4zM2 19h20M9 16v3M15 16v3', words: ['טלפון', 'מחשב', 'אוזניות', 'מטען', 'טאבלט', 'מסך', 'טלוויזיה', 'רמקול', 'מצלמה', 'כבל', 'שעון חכם', 'iphone', 'samsung', 'laptop'] },
  { name: 'מכשירי חשמל', color: '#1971c2', icon: 'M7 3h10v18H7zM7 9h10M10 6h1M12 13a2 2 0 1 0 0 4a2 2 0 1 0 0-4', words: ['מקרר', 'מכונת כביסה', 'מייבש', 'מדיח', 'תנור', 'מיקרוגל', 'שואב', 'מזגן', 'קומקום', 'בלנדר', 'מאוורר', 'מגהץ', 'טוסטר', 'קפסולות', 'מכונת קפה'] },
  { name: 'ביגוד והנעלה', color: '#c2255c', icon: 'M8 3l-5 3l2 4l3-1v12h8V9l3 1l2-4l-5-3a4 4 0 0 1-8 0z', words: ['חולצה', 'מכנסיים', 'שמלה', 'נעליים', 'סנדלים', 'מעיל', 'ג\'ינס', 'חצאית', 'גרביים', 'תיק', 'כובע', 'זארה', 'קסטרו', 'פוקס', 'h&m'] },
  { name: 'בית וריהוט', color: '#a8642b', icon: 'M3 11l9-7l9 7M5 10v10h14V10M10 20v-6h4v6', words: ['ספה', 'כיסא', 'שולחן', 'מיטה', 'מזרן', 'ארון', 'מדף', 'שטיח', 'וילון', 'מנורה', 'כרית', 'מצעים', 'סיר', 'מחבת', 'צלחות', 'איקאה', 'ikea', 'הום סנטר'] },
  { name: 'ילדים', color: '#e8590c', icon: 'M12 4a3 3 0 1 0 0 6a3 3 0 1 0 0-6M6 21v-4a6 6 0 0 1 12 0v4', words: ['צעצוע', 'עגלה', 'בוסטר', 'משחק', 'לגו', 'תינוק', 'בובה', 'טוי'] },
  { name: 'ספורט ופנאי', color: '#2b8a3e', icon: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M3.5 9h17M3.5 15h17M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18', words: ['אופניים', 'כדור', 'מזרן יוגה', 'משקולות', 'אוהל', 'נעלי ריצה', 'קורקינט', 'דקתלון', 'decathlon'] },
  { name: 'ספרים ומשרד', color: '#5f3dc4', icon: 'M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6M20 4v14h-6', words: ['ספר', 'מחברת', 'עט', 'מדפסת', 'דיו', 'נייר', 'סטימצקי', 'צומת ספרים'] },
  { name: 'בריאות ויופי', color: '#0c8599', icon: 'M9 3h6v4H9zM7 7h10v14H7zM12 11v6M9 14h6', words: ['תרופה', 'מרפאה', 'כללית', 'מכבי', 'רפואה', 'טיפול', 'קרם', 'בושם', 'שמפו', 'משקפיים', 'עדשות', 'ויטמין', 'סופר פארם', 'be', 'מספרה'] },
  { name: 'כלים וגינה', color: '#5c940d', icon: 'M14 4l6 6l-3 3l-6-6zM11 7l-8 8l3 3l8-8M15 15l5 5', words: ['מקדחה', 'מברגה', 'פטיש', 'צינור', 'עציץ', 'שתיל', 'מסור', 'סולם', 'ace', 'טמבור'] },
  { name: 'בינה מלאכותית', color: '#7048e8', icon: 'M12 3v3M12 18v3M3 12h3M18 12h3M7 7h10v10H7zM10 10h4v4h-4z', words: ['google ai', 'gemini', 'claude', 'anthropic', 'chatgpt', 'openai', 'lovable', 'midjourney', 'base44', 'perplexity', 'cursor', 'elevenlabs', 'suno', 'runway', 'heygen'] },
  { name: 'פיתוח ותשתיות', color: '#364fc7', icon: 'M8 7l-5 5l5 5M16 7l5 5l-5 5M13 5l-2 14', words: ['supabase', 'vercel', 'github', 'netlify', 'apify', 'domain', 'דומיין', 'hosting'] },
  { name: 'תקשורת וגלישה', color: '#1098ad', icon: 'M5 12a10 10 0 0 1 14 0M8 15a5.5 5.5 0 0 1 8 0M12 19h.01M2 9a14.5 14.5 0 0 1 20 0', words: ['ubigi', 'transatel', 'esim', 'גלישה', 'סלקום', 'פרטנר', 'הוט', 'בזק', 'גולן', 'airalo'] },
  { name: 'מנויים ושירותים', color: '#862e9c', icon: 'M4 6h16v12H4zM4 10h16M8 15h3M17 3v3M7 3v3', words: ['מנוי', 'subscription', 'google play', 'google one', 'netflix', 'spotify', 'lovable', 'supabase', 'vercel', 'openai', 'anthropic', 'icloud', 'apple', 'חיוב חודשי'] },
  { name: 'אחר', color: '#868e96', icon: 'M5 4h14v16l-3-2l-2 2l-2-2l-2 2l-2-2l-3 2zM9 9h6M9 13h6', words: [] },
];

export const catByName = (n: string) => CATEGORIES.find((c) => c.name === n) ?? CATEGORIES[CATEGORIES.length - 1];

export function guessCategory(text: string): string | undefined {
  const t = text.toLowerCase();
  let best: { name: string; len: number } | undefined;
  for (const c of CATEGORIES) for (const w of c.words) {
    if (t.includes(w.toLowerCase()) && (!best || w.length > best.len)) best = { name: c.name, len: w.length };
  }
  return best?.name;
}
