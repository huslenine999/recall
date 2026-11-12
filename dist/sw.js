// Recall service worker: the whole app is one page, so it is cached when first visited and then works with no connection.
// BUILD is replaced by build.js, so every new build gets a new cache and the old one is deleted.
const CACHE = 'recall-0112fbd5db';
const SHELL = ['./', './index.html', './manifest.webmanifest', './favicon.svg', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('recall-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.startsWith('/api/')) return; // sync calls always go to the network
  if (r.mode === 'navigate') { // open instantly from the cache, refresh it in the background for the next visit
    e.respondWith(caches.open(CACHE).then(async c => {
      const cached = await c.match('./index.html');
      const fresh = fetch(r).then(res => { if (res.ok) c.put('./index.html', res.clone()); return res; }).catch(() => null);
      if (cached) { e.waitUntil(fresh); return cached; }
      return (await fresh) || new Response('Offline, and Recall has not been opened online yet.', { status: 503, headers: { 'content-type': 'text/plain' } });
    }));
    return;
  }
  e.respondWith(caches.match(r).then(hit => hit || fetch(r)));
});
