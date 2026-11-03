import { useEffect, useState } from 'react';
import { getFile } from './db';

/** Object URLs for a stored receipt file: the display image and the original. */
export function useFile(fileId: string | null) {
  const [urls, setUrls] = useState<{ display: string; original: string; type: string } | null>(null);
  useEffect(() => {
    let alive = true;
    const made: string[] = [];
    setUrls(null);
    if (fileId) getFile(fileId).then((f) => {
      if (!f || !alive) return;
      const display = URL.createObjectURL(f.display);
      const original = f.original === f.display ? display : URL.createObjectURL(f.original);
      made.push(display, original);
      setUrls({ display, original, type: f.original.type });
    });
    return () => { alive = false; made.forEach((u) => URL.revokeObjectURL(u)); };
  }, [fileId]);
  return urls;
}
