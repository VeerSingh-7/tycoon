/* =========================================================================
 * service-worker.js — PWA offline shell
 * -------------------------------------------------------------------------
 * Network-first for our own assets (always fresh when online) with a full
 * precache so the game still launches offline. Bump CACHE_NAME on asset change.
 * Fully self-contained: the candlestick chart is our own canvas renderer
 * (js/chart.js) — no CDN, no external dependencies.
 * ========================================================================= */

const CACHE_NAME = 'tycoon-v37'; // v37: chart live price pinned to the shared quote so it matches the header/list to the penny on every timeframe

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
  // Banks & Fintech logos.
  'img/logos/mnp.svg',
  'img/logos/gds.svg',
  'img/logos/bka.svg',
  'img/logos/vsa.svg',
  'img/logos/mic.svg',
  'img/logos/yrk.svg',
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

// NETWORK-FIRST for our own app files (HTML/CSS/JS/icons), so a new build lands
// as soon as you're online — no more stale cached code — while the cache keeps
// the game fully playable offline. Cross-origin GETs stay cache-first.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const sameOrigin = new URL(event.request.url).origin === self.location.origin;

  if (event.request.mode === 'navigate' || sameOrigin) {
    event.respondWith(
      fetch(event.request)
        .then((resp) => {
          // Refresh the cache copy for offline use.
          if (resp && resp.status === 200 && resp.type === 'basic') {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return resp;
        })
        .catch(() =>
          caches.match(event.request).then((cached) =>
            cached || (event.request.mode === 'navigate' ? caches.match('index.html') : undefined))
        )
    );
    return;
  }

  // Cross-origin GETs: cache-first with network fallback.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((resp) => {
        if (resp && resp.status === 200 && resp.type === 'cors') {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return resp;
      }).catch(() => cached);
    })
  );
});
