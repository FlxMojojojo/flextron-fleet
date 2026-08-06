/* Flextron Fleet — service worker for PWA installability.
   Strategy:
   - Never cache the API (always live).
   - HTML / navigations: NETWORK-ONLY so a new deploy is always picked up
     immediately (no stale app shell). Falls back to a cached shell only offline.
   - Hashed static assets (immutable): cache-first for speed.
   Bump CACHE on any change here to force clients to update + purge old caches. */
const CACHE = 'flextron-v3';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    // Always fetch fresh HTML; only use cache when the network is unavailable.
    e.respondWith(
      fetch(req)
        .then((res) => { const c = res.clone(); caches.open(CACHE).then((cc) => cc.put('/', c)); return res; })
        .catch(() => caches.match('/')),
    );
    return;
  }

  // Hashed assets: cache-first, populate on first fetch.
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const c = res.clone(); caches.open(CACHE).then((cc) => cc.put(req, c)); }
      return res;
    })),
  );
});
