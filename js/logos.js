/* =========================================================================
 * logos.js — Asset icon: a simple auto-generated monogram (no image files)
 * -------------------------------------------------------------------------
 * ONE entry point — Logos.tile(def, cls) — renders a clean coloured circle
 * with the asset's NAME initials centred in white and bold, everywhere an
 * asset appears (markets list, detail, portfolio, buy/sell ticket).
 *
 *   - The circle colour is derived DETERMINISTICALLY from the asset's id, so
 *     each asset keeps a consistent colour across the app and between sessions
 *     (and it doesn't change when a company is renamed).
 *   - The letters are the name's initials (1–2), never a stock ticker.
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

  /** Deterministic, legible circle colour from a key (white text sits on every
   *  hue: fixed saturation/lightness keeps it dark enough for contrast). */
  function colorOf(key) {
    const hue = hashStr(key) % 360;
    return `hsl(${hue}, 60%, 40%)`;
  }

  /** 1–2 letter initials from the company/coin NAME (first letters of the first
   *  two words; a single word contributes its first two letters). */
  function initialsOf(name) {
    const words = String(name || '').trim().split(/[^A-Za-z0-9]+/).filter(Boolean);
    if (!words.length) return '?';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  /**
   * THE one entry point: a monogram icon tile for any asset.
   * cls: '' (list row) | 'lg' (detail) | 'sm' (ticket) — sizing lives in CSS,
   * so the icon is the same size the old logos were.
   */
  function tile(def, cls = '') {
    const letters = initialsOf(def && def.name);
    const fill = colorOf(String((def && def.id) || (def && def.name) || '?'));
    const svg =
      `<svg viewBox="0 0 100 100" aria-hidden="true">` +
        `<circle cx="50" cy="50" r="50" fill="${fill}"/>` +
        `<text x="50" y="50" dy=".35em" text-anchor="middle" ` +
          `font-family="-apple-system,'Segoe UI',Roboto,sans-serif" ` +
          `font-size="40" font-weight="800" fill="#fff">${letters}</text>` +
      `</svg>`;
    return `<span class="logo-tile ${cls}">${svg}</span>`;
  }

  return { tile };
})();
