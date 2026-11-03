import { useEffect, useRef, useState } from 'react';
import { catByName } from './categories';

export function Icon({ d, size = 20, color = 'currentColor' }: { d: string; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export const CatIcon = ({ name, size = 20 }: { name: string; size?: number }) => <Icon d={catByName(name).icon} size={size} />;

export const I = {
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 10a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7',
  gallery: 'M4 5h16v14H4zM4 15l5-5l4 4l3-3l4 4M15 9h.01',
  search: 'M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14M20 20l-4-4',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3M5 11a7 7 0 0 0 14 0M12 18v3',
  show: 'M4 4h6M4 4v6M20 4h-6M20 4v6M4 20h6M4 20v-6M20 20h-6M20 20v-6',
  close: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  fit: 'M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5',
  edit: 'M4 20h4l11-11l-4-4L4 16zM13 7l4 4',
  file: 'M6 3h9l4 4v14H6zM14 3v5h5',
  back: 'M9 6l6 6l-6 6',
  x: 'M6 6l12 12M18 6L6 18',
  paste: 'M9 4h6v3H9zM7 5H5v16h14V5h-2M9 12h6M9 16h4',
  message: 'M4 5h16v11H9l-5 4zM8 9h8M8 12h5',
  link: 'M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1',
};

/** Speech to text in Hebrew, for every writing field. Hidden where the browser has no speech recognition. */
type SR = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
const SRCtor: (new () => SR) | undefined = typeof window !== 'undefined' ? ((window as unknown as Record<string, new () => SR>).SpeechRecognition || (window as unknown as Record<string, new () => SR>).webkitSpeechRecognition) : undefined;

export function Mic({ onText, label }: { onText: (t: string) => void; label: string }) {
  const [on, setOn] = useState(false);
  const rec = useRef<SR | null>(null);
  useEffect(() => () => rec.current?.stop(), []);
  if (!SRCtor) return null;
  const toggle = () => {
    if (on) { rec.current?.stop(); return; }
    const r = new SRCtor();
    r.lang = 'he-IL'; r.interimResults = false; r.continuous = false;
    r.onresult = (e) => { const t = Array.from(e.results).map((x) => x[0].transcript).join(' '); if (t) onText(t.trim()); };
    r.onend = () => setOn(false);
    r.onerror = () => setOn(false);
    rec.current = r; r.start(); setOn(true);
  };
  return (
    <button type="button" className={'mic press' + (on ? ' on' : '')} onClick={toggle} aria-pressed={on} aria-label={on ? 'עצירת הקלטה' : `הקלטה: ${label}`} title={on ? 'עצירת הקלטה' : `הקלטה ותמלול: ${label}`}>
      <Icon d={I.mic} size={18} />
    </button>
  );
}

/** Marks the search words inside a text with the yellow marker. */
export function Mark({ text, q }: { text: string; q: string }) {
  const words = q.trim().split(/\s+/).filter((w) => w.length > 1);
  if (!words.length || !text) return <>{text}</>;
  const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return <>{text.split(re).map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p))}</>;
}
