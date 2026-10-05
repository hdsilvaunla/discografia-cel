/* ═══════════════════════════════════════════════════════════════
   Discografía Viewer v7.3.0 — Service Worker
   ═══════════════════════════════════════════════════════════════ */

const CACHE_VERSION = 'discografia-v7.3.0';
const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app-core-1-base.js',
  './app-core-2-storage.js',
  './app-core-3-store.js',
  './app-services-1-streaming.js',
  './app-services-2-voice-ai.js',
  './app-ui-1-state.js',
  './app-ui-2-render.js',
  './app-ui-3-detail.js',
  './app-ui-4-init.js',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(c => c.addAll(CORE_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (/script\.google\.com|googleusercontent|itunes\.apple|discogs|musicbrainz|coverartarchive|song\.link|dropbox|icloud/i.test(url.hostname)){
    return;
  }
  if (url.origin === location.origin){
    e.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          if (res && res.status === 200 && res.type === 'basic'){
            const clone = res.clone();
            caches.open(CACHE_VERSION).then(c => c.put(req, clone));
          }
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }
  e.respondWith(
    Promise.race([
      fetch(req).catch(() => null),
      new Promise(r => setTimeout(() => r(null), 8000))
    ]).then(res => res || caches.match(req))
  );
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING'){
    self.skipWaiting();
  }
});