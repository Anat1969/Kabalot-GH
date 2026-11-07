import { useEffect, useRef, useState } from 'react';
import { cloudState, onCloud, signIn, type CloudState } from '../cloud';

export function useCloud() {
  const [s, setS] = useState<CloudState>(cloudState());
  useEffect(() => onCloud(setS), []);
  return s;
}

/** Sign-in sheet: the receipts live in Anat's private account and appear on every device. */
export default function Account({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('shtanat5@gmail.com');
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const passRef = useRef<HTMLInputElement>(null);
  useEffect(() => { passRef.current?.focus(); const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    const m = await signIn(email, pass);
    setBusy(false);
    if (m) setErr(m); else onClose();
  };

  return (
    <div className="sheet-bg" onClick={onClose}>
      <form className="sheet" role="dialog" aria-modal="true" aria-label="כניסה לחשבון" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2 className="sheet-h">הקבלות שלך, בכל מכשיר</h2>
        <p className="sheet-why">כניסה אחת, והקבלות מהטלפון ומהמחשב מסונכרנות. החשבון פרטי: רק את רואה אותו.</p>
        <label className="field"><span className="lbl">אימייל</span>
          <span className="inp"><input type="email" name="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" required /></span>
        </label>
        <label className="field"><span className="lbl">סיסמה</span>
          <span className="inp">
            <input ref={passRef} type={show ? 'text' : 'password'} name="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} dir="ltr" required />
            <button type="button" className="mic press showpass" onClick={() => setShow(!show)} aria-pressed={show} aria-label={show ? 'הסתרת הסיסמה' : 'הצגת הסיסמה'} title={show ? 'הסתרת הסיסמה' : 'הצגת הסיסמה'}>{show ? 'הסתר' : 'הצג'}</button>
          </span>
        </label>
        {err && <p className="sheet-note">{err}</p>}
        <div className="row2">
          <button className="btn primary press" disabled={busy}>{busy ? 'נכנסת...' : 'כניסה'}</button>
          <button type="button" className="btn press" onClick={onClose}>לא עכשיו</button>
        </div>
        <p className="small">אותו חשבון כמו באפליקציית האפליקציות. הדפדפן ימלא את הסיסמה אם שמרת אותה.</p>
      </form>
    </div>
  );
}
