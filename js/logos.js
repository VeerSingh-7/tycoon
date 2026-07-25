/* =========================================================================
 * logos.js — Asset icon: a simple auto-generated monogram (no image files)
 * -------------------------------------------------------------------------
 * ONE entry point — Logos.tile(def, cls) — renders a clean coloured circle
 * with the asset's ticker letters centred in white and bold, everywhere an
 * asset appears (markets list, detail, portfolio, buy/sell ticket).
 *
 *   - The circle colour is derived DETERMINISTICALLY from the ticker, so each
 *     asset keeps a consistent colour across the whole app and between sessions.
 *   - Pure inline SVG — there are NO image files and no network requests.
 *
 * EASY TO REMOVE LATER: every asset icon in the app is produced by this single
 * function. To drop icons entirely, make tile() return '' (or delete the
 * <span> it builds) and nothing else needs to change.
 * ========================================================================= */

const Logos = (() => {

  /** Stable 32-bit hash of a string (FNV-1a). */
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  /** Deterministic, legible circle colour from the ticker (white text sits on
   *  every hue: fixed saturation/lightness keeps it dark enough for contrast). */
  function colorOf(ticker) {
    const hue = hashStr(ticker) % 360;
    return `hsl(${hue}, 60%, 40%)`;
  }

  /** Font size that keeps 2–5 letter tickers inside the circle. */
  function fontSizeFor(len) {
    if (len <= 2) return 42;
    if (len === 3) return 36;
    if (len === 4) return 29;
    return 24;
  }

  /**
   * THE one entry point: a monogram icon tile for any asset.
   * cls: '' (list row) | 'lg' (detail) | 'sm' (ticket) — sizing lives in CSS,
   * so the icon is the same size the old logos were.
   */
  function tile(def, cls = '') {
    const ticker = String((def && (def.ticker || def.id)) || '?').toUpperCase();
    const fill = colorOf(ticker);
    const fs = fontSizeFor(ticker.length);
    const svg =
      `<svg viewBox="0 0 100 100" aria-hidden="true">` +
        `<circle cx="50" cy="50" r="50" fill="${fill}"/>` +
        `<text x="50" y="50" dy=".35em" text-anchor="middle" ` +
          `font-family="-apple-system,'Segoe UI',Roboto,sans-serif" ` +
          `font-size="${fs}" font-weight="800" fill="#fff">${ticker}</text>` +
      `</svg>`;
    return `<span class="logo-tile ${cls}">${svg}</span>`;
  }

  return { tile };
})();
