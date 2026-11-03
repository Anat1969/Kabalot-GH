/* Kabalot service worker: the app opens offline, and photos shared from the gallery land in the app. */
const CACHE = 'kabalot-v1';

self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/icon.svg', '/manifest.webmanifest']))); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });

function inbox(items) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('kabalot', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      ['receipts', 'files', 'inbox'].forEach((s) => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' }); });
    };
    req.onsuccess = () => {
      const t = req.result.transaction('inbox', 'readwrite');
      items.forEach((it) => t.objectStore('inbox').put(it));
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    };
    req.onerror = () => reject(req.error);
  });
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method === 'POST' && url.pathname === '/share') {
    e.respondWith((async () => {
      try {
        const form = await e.request.formData();
        const files = form.getAll('receipt').filter((f) => typeof f !== 'string');
        await inbox(files.map((f, i) => ({ id: Date.now() + '-' + i, file: f, name: f.name || 'קבלה' })));
        const cs = await self.clients.matchAll({ type: 'window' });
        cs.forEach((c) => c.postMessage('kabalot:shared'));
      } catch (err) { /* the app opens anyway */ }
      return Response.redirect('/?shared=1', 303);
    })());
    return;
  }
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Pages from the network first; built assets and icons from the cache.
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put('/', copy)); return r; }).catch(() => caches.match('/')));
    return;
  }
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
    if (r.ok && (url.pathname.startsWith('/assets/') || /\.(svg|png|webmanifest)$/.test(url.pathname))) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return r;
  })));
});
