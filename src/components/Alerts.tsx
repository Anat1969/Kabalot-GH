import { useEffect, useMemo, useState } from 'react';
import { alertsFor, notifyOnce } from '../alerts';
import { todayISO } from '../dates';
import type { Receipt } from '../types';

/** Alerts strip: price rises in terracotta, renewals in champagne. Tapping one searches its business. */
export default function Alerts({ list, onPick }: { list: Receipt[]; onPick?: (store: string) => void }) {
  const alerts = useMemo(() => alertsFor(list.filter((r) => !r.demo), todayISO()), [list]);
  const [perm, setPerm] = useState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  useEffect(() => { notifyOnce(alerts); }, [alerts, perm]);
  if (!alerts.length) return null;
  return (
    <section className="alerts" aria-label="התראות">
      {alerts.map((a) => (
        <button key={a.id} className={'alert press ' + a.kind} onClick={() => onPick?.(a.storeKey)}>
          <span className="dot" aria-hidden="true" />
          <span className="a-main"><b>{a.title}</b><small>{a.detail}</small></span>
        </button>
      ))}
      {perm === 'default' && (
        <button className="link press notify-ask" onClick={() => Notification.requestPermission().then(setPerm)}>להציג את ההתראות גם כהודעה במכשיר</button>
      )}
    </section>
  );
}
