/* =========================================================================
 * logos.js — Asset icon seam (currently OFF: no icon is rendered)
 * -------------------------------------------------------------------------
 * Every asset icon in the app goes through Logos.tile(def, cls). Icons are
 * currently disabled — tile() returns an empty string, so stocks and crypto
 * show just their name (no circle, no initials) everywhere they appear
 * (markets list, detail, portfolio, buy/sell ticket).
 *
 * To bring an icon back later, make tile() return the markup again — nothing
 * else in the app needs to change.
 * ========================================================================= */

const Logos = (() => {
  /** No icon: return nothing so only the asset name shows. */
  function tile(_def, _cls = '') { return ''; }
  return { tile };
})();
