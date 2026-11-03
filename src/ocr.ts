/** Reads the receipt text on the phone itself (Tesseract, Hebrew + English). Nothing is sent to a server. */
let workerP: Promise<import('tesseract.js').Worker> | null = null;

async function getWorker() {
  if (!workerP) {
    workerP = import('tesseract.js').then(({ createWorker }) => createWorker(['heb', 'eng'], 1, { errorHandler: () => {} }));
    workerP.catch(() => { workerP = null; });
  }
  return workerP;
}

export async function readText(image: Blob, timeoutMs = 60000): Promise<string> {
  const run = (async () => {
    const w = await getWorker();
    const { data } = await w.recognize(image);
    return data.text || '';
  })();
  const timeout = new Promise<string>((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs));
  return Promise.race([run, timeout]).catch((e) => { workerP?.then((w) => w.terminate()).catch(() => {}); workerP = null; throw e; });
}
