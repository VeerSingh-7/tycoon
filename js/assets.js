/* =========================================================================
 * assets.js — Phase 5 engine: real estate rent/appreciation + luxury sets
 * -------------------------------------------------------------------------
 * State shape (created lazily, saved with everything else):
 *   state.assets = {
 *     epoch:  <sec>,               // appreciation anchor (set once)
 *     estate: { id: {count, cost} }, // units owned + total $ basis
 *     luxury: { id: true }           // collectibles owned
 *   }
 *
 * Economy rules:
 *   - Rent joins passive income (engine's totalPassiveIncomePerSec) and is
 *     scaled by the Phase 3 global multiplier like everything else.
 *   - Property market value = price × (1+apprPerDay)^daysSinceEpoch — buys
 *     get dearer over time, sells realize the gain (minus 3% fee).
 *   - Selling: only PROFIT over average cost counts as earnings (same rule
 *     as trading) — no wash-flip XP farming.
 *   - Completed luxury sets multiply ALL income permanently (feeds
 *     Progression.globalIncomeMultiplier()).
 * ========================================================================= */

const Assets = (() => {

  /** Lazily create the assets state bag. */
  function ensure() {
    if (!state.assets) {
      state.assets = { epoch: nowSeconds(), estate: {}, luxury: {} };
    }
  }

  function estateRec(id) {
    ensure();
    if (!state.assets.estate[id]) state.assets.estate[id] = { count: 0, cost: 0 };
    return state.assets.estate[id];
  }

  /* --------------------------- Real estate ---------------------------- */

  /** Compounded appreciation factor since the save's asset epoch. */
  function apprFactor(def) {
    ensure();
    const days = Math.max(0, (nowSeconds() - state.assets.epoch) / 86400);
    return Math.pow(1 + def.apprPerDay, days);
  }

  /** Current market value of ONE unit of a property type. */
  function unitValue(def) {
    return def.price * apprFactor(def);
  }

  /** Total rent/sec from all owned units (global multiplier applied). */
  function rentPerSec() {
    ensure();
    let rent = 0;
    for (const def of ESTATE_DEFS) {
      rent += estateRec(def.id).count * def.rentPerSec;
    }
    return rent * globalIncomeMultiplier();
  }

  function buyEstate(id) {
    const def = ESTATE_BY_ID[id];
    const cost = unitValue(def);
    if (state.balance < cost) return false;
    const rec = estateRec(id);
    state.balance -= cost;
    rec.count += 1;
    rec.cost += cost;
    saveGame();
    return true;
  }

  /** Sell one unit at market value minus the fee; profit-only earnings. */
  function sellEstate(id) {
    const def = ESTATE_BY_ID[id];
    const rec = estateRec(id);
    if (rec.count < 1) return false;
    const proceeds = unitValue(def) * (1 - ASSETS_CFG.ESTATE_SELL_FEE);
    const avgCost = rec.cost / rec.count;
    rec.count -= 1;
    rec.cost -= avgCost;
    if (rec.count === 0) rec.cost = 0;
    state.balance += proceeds;
    const gain = proceeds - avgCost;
    if (gain > 0) {
      state.totalEarned += gain;
      state.runEarned += gain;
    }
    saveGame();
    return true;
  }

  /** Totals for the header card: units, market value, basis, rent. */
  function estateSummary() {
    ensure();
    let units = 0, value = 0, cost = 0;
    for (const def of ESTATE_DEFS) {
      const rec = estateRec(def.id);
      units += rec.count;
      value += rec.count * unitValue(def);
      cost += rec.cost;
    }
    return { units, value, cost, pl: value - cost };
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
    ensure, apprFactor, unitValue, rentPerSec,
    buyEstate, sellEstate, estateSummary,
    ownsLuxury, buyLuxury, setProgress, luxuryMultiplier, collectionProgress,
  };
})();
