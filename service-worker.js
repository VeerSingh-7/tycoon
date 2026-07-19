/* =========================================================================
 * service-worker.js — PWA offline shell
 * -------------------------------------------------------------------------
 * Cache-first for our own assets so the game launches offline. Bump
 * CACHE_NAME whenever assets change to force clients to update.
 * ========================================================================= */

const CACHE_NAME = 'tycoon-v3'; // v3: Phase 3 (progression, prestige, events)

const ASSETS = [
  'index.html',
  'manifest.json',
  'css/styles.css',
  'js/format.js',
  'js/data/businesses.js',
  'js/data/progression.js',
  'js/state.js',
  'js/engine.js',
  'js/mechanics.js',
  'js/progression.js',
  'js/profile.js',
  'js/tap.js',
  'js/businesses.js',
  'js/ui.js',
  'js/main.js',
  'icons/icon.svg',
];

// Precache the app shell on install.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Clean up old caches on activate.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Cache-first with network fallback; cache successful GETs for next time.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Navigations (e.g. "/") fall back to the cached shell when offline.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('index.html'))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((resp) => {
          if (resp && resp.status === 200 && resp.type === 'basic') {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return resp;
        })
        .catch(() => cached);
    })
  );
});
