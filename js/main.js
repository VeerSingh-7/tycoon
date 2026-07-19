/* =========================================================================
 * main.js — Bootstrap: load save, wire the loop, register the service worker
 * -------------------------------------------------------------------------
 * Loaded last. Assumes format/data/state/engine/tap/businesses/ui are present.
 * ========================================================================= */

(function boot() {
  // 1. Load save + compute offline earnings.
  const { away } = loadGame();

  // 2. Build the UI shell and start the smooth balance counter.
  UI.init();

  // 3. Show the "While you were away" popup if we earned anything offline.
  if (away && away.earned > 0) {
    UI.showOfflinePopup(away);
  }

  // 4. Economy tick — 10x/sec, uses real elapsed time so it's frame-independent.
  setInterval(tick, 100);

  // 5. Autosave every 10s, and always save when the app is backgrounded/closed.
  setInterval(saveGame, 10000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveGame();
  });
  window.addEventListener('pagehide', saveGame);
  window.addEventListener('beforeunload', saveGame);

  // 6. Register the service worker (PWA / offline shell). Non-fatal if it fails.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch((e) => {
        console.warn('SW registration failed', e);
      });
    });
  }
})();
