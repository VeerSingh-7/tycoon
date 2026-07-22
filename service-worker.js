/* =========================================================================
 * service-worker.js — PWA offline shell
 * -------------------------------------------------------------------------
 * Cache-first for our own assets so the game launches offline. Bump
 * CACHE_NAME whenever assets change to force clients to update.
 * Fully self-contained: the candlestick chart is our own canvas renderer
 * (js/chart.js) — no CDN, no external dependencies.
 * ========================================================================= */

const CACHE_NAME = 'tycoon-v15'; // v15: Invest tidy — no emojis/search, Real Estate, bigger portfolio

const ASSETS = [
  'index.html',
  'manifest.json',
  'css/styles.css',
  'js/format.js',
  'js/chart.js',
  'js/logos.js',
  'js/data/businesses.js',
  'js/data/progression.js',
  'js/data/markets.js',
  'js/data/stocks.js',
  'js/data/assets.js',
  'js/state.js',
  'js/engine.js',
  'js/mechanics.js',
  'js/progression.js',
  'js/market.js',
  'js/assets.js',
  'js/tap.js',
  'js/businesses.js',
  'js/invest.js',
  'js/assetstab.js',
  'js/ui.js',
  'js/profile.js',
  'js/main.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-512-maskable.png',
  // Designed asset logos (override the generated marks in js/logos.js).
  'img/logos/mngo.svg',
  'img/logos/ggl.svg',
  'img/logos/tzla.svg',
  'img/logos/amz.svg',
  'img/logos/fbk.svg',
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
          // Cache same-origin assets AND the CORS-served chart library.
          const cacheable = resp && resp.status === 200 &&
            (resp.type === 'basic' || resp.type === 'cors');
          if (cacheable) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return resp;
        })
        .catch(() => cached);
    })
  );
});
