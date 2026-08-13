/* =========================================================================
 * assets.js — Phase 5 engine: luxury collection sets
 * -------------------------------------------------------------------------
 * State shape (created lazily, saved with everything else):
 *   state.assets = {
 *     luxury: { id: true }           // collectibles owned
 *   }
 *
 * Completed luxury sets multiply ALL income permanently (feeds
 * Progression.globalIncomeMultiplier()).
 *
 * (Real estate used to live here too — retired from the Business tab; see
 * js/state.js SAVE_VERSION 24 for the buyout migration.)
 * ========================================================================= */

const Assets = (() => {

  /** Lazily create the assets state bag. */
  function ensure() {
    if (!state.assets) {
      state.assets = { luxury: {} };
    }
  }

  /* ----------------------------- Luxury ------------------------------- */

  function ownsLuxury(id) {
    ensure();
    return !!state.assets.luxury[id];
  }

  function buyLuxury(id) {
    const def = LUXURY_BY_ID[id];
    if (!def || ownsLuxury(id)) return false;
    if (state.balance < def.price) return false;
    state.balance -= def.price;
    state.assets.luxury[id] = true;

    // Completing a set is a big moment — announce the permanent bonus.
    const prog = setProgress(def.set);
    if (prog.owned === prog.total && typeof UI !== 'undefined') {
      const set = LUXURY_SET_BY_ID[def.set];
      UI.showToast(`${set.icon} <b>Set complete: ${set.name}!</b><br>All income ×${set.bonus} forever.`);
    }
    saveGame();
    return true;
  }

  /** Owned/total for one set. */
  function setProgress(setId) {
    ensure();
    const items = LUXURY_DEFS.filter((d) => d.set === setId);
    const owned = items.filter((d) => state.assets.luxury[d.id]).length;
    return { owned, total: items.length };
  }

  /** Product of bonuses from COMPLETED sets → global income multiplier. */
  function luxuryMultiplier() {
    ensure();
    let mult = 1;
    for (const set of LUXURY_SETS) {
      const p = setProgress(set.id);
      if (p.owned === p.total) mult *= set.bonus;
    }
    return mult;
  }

  /** Overall collection progress for the header. */
  function collectionProgress() {
    ensure();
    const owned = LUXURY_DEFS.filter((d) => state.assets.luxury[d.id]).length;
    return { owned, total: LUXURY_DEFS.length };
  }

  return {
    ensure,
    ownsLuxury, buyLuxury, setProgress, luxuryMultiplier, collectionProgress,
  };
})();
