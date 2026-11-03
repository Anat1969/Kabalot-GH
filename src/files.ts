/** Turns whatever the phone gives (photo, screenshot, PDF) into a stored original + a display image + a thumbnail. */

async function loadBitmap(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try { return await createImageBitmap(blob, { imageOrientation: 'from-image' } as ImageBitmapOptions); } catch {
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally { URL.revokeObjectURL(url); }
  }
}

function draw(src: CanvasImageSource & { width: number; height: number }, max: number) {
  const k = Math.min(1, max / Math.max(src.width, src.height));
  const c = document.createElement('canvas');
  c.width = Math.round(src.width * k);
  c.height = Math.round(src.height * k);
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

const toBlob = (c: HTMLCanvasElement, q = 0.86) => new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/jpeg', q));

async function pdfFirstPage(blob: Blob): Promise<HTMLCanvasElement> {
  const pdfjs = await import('pdfjs-dist');
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  const page = await doc.getPage(1);
  const vp0 = page.getViewport({ scale: 1 });
  const vp = page.getViewport({ scale: Math.min(3, 1800 / Math.max(vp0.width, vp0.height)) });
  const c = document.createElement('canvas');
  c.width = vp.width; c.height = vp.height;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: g, viewport: vp }).promise;
  return c;
}

export interface Prepared { original: Blob; display: Blob; thumb: string; ocrSource: Blob }

export async function prepare(file: Blob): Promise<Prepared> {
  if (file.type === 'application/pdf') {
    const page = await pdfFirstPage(file);
    const display = await toBlob(draw(page, 1800));
    return { original: file, display, thumb: draw(page, 160).toDataURL('image/jpeg', 0.7), ocrSource: display };
  }
  const bmp = await loadBitmap(file);
  const big = draw(bmp, 2000);
  const display = await toBlob(big);
  const thumb = draw(bmp, 160).toDataURL('image/jpeg', 0.7);
  // Keep the original only when it is not huge; the display image is already full quality for a receipt.
  const original = file.size < 4_000_000 ? file : display;
  return { original, display, thumb, ocrSource: display };
}

/** Draws a text message as a thermal-paper slip, so it can be shown and searched like any receipt. */
export async function messageImage(text: string, store?: string): Promise<{ display: Blob; thumb: string }> {
  try { await document.fonts?.ready; } catch { /* optional */ }
  const W = 720, pad = 48, lh = 40;
  const c = document.createElement('canvas');
  const g = c.getContext('2d')!;
  g.font = '28px "IBM Plex Sans Hebrew", sans-serif';
  const lines: string[] = [];
  for (const para of text.replace(/https?:\/\/\S+/g, (u) => '\n' + u + '\n').split(/\n/)) {
    let line = '';
    for (const word of para.split(/(\s+)/)) {
      if (g.measureText(line + word).width > W - pad * 2 && line) { lines.push(line.trim()); line = word.trimStart(); }
      else line += word;
      while (g.measureText(line).width > W - pad * 2) { let k = line.length; while (k > 1 && g.measureText(line.slice(0, k)).width > W - pad * 2) k--; lines.push(line.slice(0, k)); line = line.slice(k); }
    }
    if (line.trim()) lines.push(line.trim());
  }
  const H = 170 + lines.length * lh + 80;
  c.width = W; c.height = H;
  g.fillStyle = '#fffdf8'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#1b1b1b'; g.direction = 'rtl'; g.textAlign = 'center';
  g.font = '600 36px "IBM Plex Sans Hebrew", sans-serif';
  g.fillText(store || 'קבלה מהודעה', W / 2, 72);
  g.font = '20px "IBM Plex Mono", "IBM Plex Sans Hebrew", monospace';
  g.fillStyle = '#6a6a6a'; g.fillText('הודעה שהתקבלה בטלפון', W / 2, 110);
  g.fillText('- - - - - - - - - - - - - - - - - - - - - - - -', W / 2, 140);
  g.fillStyle = '#1b1b1b'; g.font = '28px "IBM Plex Sans Hebrew", sans-serif';
  lines.forEach((l, i) => {
    const isLink = /^https?:/.test(l);
    g.direction = isLink ? 'ltr' : 'rtl'; g.textAlign = isLink ? 'left' : 'right';
    g.fillStyle = isLink ? '#1d4ed8' : '#1b1b1b';
    g.fillText(l, isLink ? pad : W - pad, 190 + i * lh);
  });
  const display = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/jpeg', 0.9));
  return { display, thumb: draw(c, 160).toDataURL('image/jpeg', 0.7) };
}
