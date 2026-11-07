import { useEffect, useState } from 'react';
import { getFile, putFile } from './db';
import { fetchFile } from './cloud';
import { messageImage } from './files';
import type { Receipt, StoredFile } from './types';

/** Object URLs for a receipt's file: from this device, else from the account, else (for an email or a
 *  message) drawn again from its text, so a receipt is never shown without its picture. */
export function useFile(fileId: string | null, r?: Receipt) {
  const [urls, setUrls] = useState<{ display: string; original: string; type: string } | null>(null);
  const text = r?.ocrText; const source = r?.source; const store = r?.store; const date = r?.date;
  useEffect(() => {
    let alive = true;
    const made: string[] = [];
    setUrls(null);
    (async () => {
      if (!fileId) return;
      let f: StoredFile | null | undefined = await getFile(fileId);
      if (!f) f = await fetchFile(fileId).catch(() => null);
      if (!f && text && (source === 'email' || source === 'message')) {
        const img = await messageImage(text.split('\n').slice(0, 6).join('\n'), store, source, date);
        f = { id: fileId, display: img.display, original: img.display, name: 'קבלה' };
        await putFile(f);
      }
      if (!f || !alive) return;
      const display = URL.createObjectURL(f.display);
      const original = f.original === f.display ? display : URL.createObjectURL(f.original);
      made.push(display, original);
      setUrls({ display, original, type: f.original.type });
    })();
    return () => { alive = false; made.forEach((u) => URL.revokeObjectURL(u)); };
  }, [fileId, text, source, store, date]);
  return urls;
}
