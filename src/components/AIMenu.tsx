import { useEffect, useRef } from 'react';

export const DEV_SESSION_URL = 'https://claude.ai/code/session_018qeN17QK93g554jmuKtn6e';

export interface MenuItem { label: string; hint?: string; pressed?: boolean; disabled?: boolean; danger?: boolean; onSelect: () => unknown }
interface MenuElement extends HTMLElement { items: MenuItem[]; status: string }

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'ai-menu': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { chat?: string; research?: string; phone?: string };
    }
  }
}

/** The A&I logo button (appofapp-gh.vercel.app/ai-menu.js). Every system action lives inside it. */
export default function AIMenu({ items, status }: { items: MenuItem[]; status: string }) {
  const ref = useRef<MenuElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => { el.items = items; el.status = status; };
    apply();
    customElements.whenDefined('ai-menu').then(apply).catch(() => {});
  }, [items, status]);
  return <ai-menu ref={ref} chat={DEV_SESSION_URL} phone="" />;
}
