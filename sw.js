/* Släktsagan service worker: makes the app installable and usable offline.
   - Pages: network first, so a new version shows up as soon as you are online.
   - Own files and libraries from CDNs: served from cache, refreshed in the background.
   - Supabase (shared trees) is never cached: that data is always fetched live. */
const CACHE = 'klansagan-v10'; // old prefix kept on purpose; bump the number to refresh the app shell
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  'fonts/ibm-plex-sans-latin-400-normal.woff2', 'fonts/ibm-plex-sans-latin-500-normal.woff2', 'fonts/ibm-plex-sans-latin-600-normal.woff2', 'fonts/fraunces-latin-opsz-normal.woff2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co')) return;

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req)
      .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put('index.html', copy)); return res; })
      .catch(() => caches.match('index.html')));
    return;
  }

  const ours = url.origin === location.origin;
  const lib = /cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net/.test(url.hostname);
  if (!ours && !lib) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(req);
    const fresh = fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || fresh;
  }));
});
