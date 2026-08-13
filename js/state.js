/* =========================================================================
 * state.js — Game state + localStorage persistence + offline calculation
 * -------------------------------------------------------------------------
 * Single source of truth for player progress. Versioned so future phases can
 * migrate old saves without wiping players.
 * ========================================================================= */

const SAVE_KEY = 'tycoon_save_v1';
// v2: Phase 2 economy rebalance — old v1 saves are reset (numbers changed
// completely, a fresh start is intended).
// v3: Phase 3 progression fields added — v2 saves migrate WITHOUT reset.
// v4: Phase 4 investing (portfolio + market state) — migrates in place too.
// v5: Phase 5 assets (real estate + luxury) — migrates in place too.
// v6: Invest overhaul — procedural market; regenerate market state, KEEP
//     portfolio holdings (ids preserved). Migrates in place, no progress lost.
// v7: markets watchlist added — migrates in place, no progress lost.
// v8: Invest trades stocks + crypto only. Holdings in removed assets
//     (commodities/financial) are refunded at full cost basis — no value lost.
// v9: watchlist feature removed — the field is dropped; nothing else changes.
// v10: market trimmed to a curated 60 assets (48 stocks + 12 crypto). Holdings
//      in delisted tickers are auto-liquidated to cash (their invested basis,
//      so nothing is lost) and pruned from portfolio + owner-management history;
//      a one-time notice is queued for the UI. Nova Nordisk renamed to Nordvia
//      (same id/ticker, so holdings are untouched).
// v11: real estate moved from the Invest tab to the Business tab. The property
//      data (state.assets.estate) is UNCHANGED — every owned unit keeps its
//      count, cost basis, value and rent. Pure in-place migration, no reset.
// v12: every asset was renamed (custom, trademark-free) — names/tickers only,
//      ids unchanged, so holdings carry over automatically. Seven formerly
//      sub-dollar coins were repriced to real values (with matching supply
//      cuts); holders get a reverse-split (shares ÷ price factor) so their coin
//      VALUE and ownership % are preserved exactly — nothing sold or reset.
// v13: Tech-sector company management (Phase 1). Adds state.techco (per-company
//      dashboards/products); defaults via the merge — migrates in place, holdings,
//      cash and all progress untouched.
// v14: Tech management Phase 2 (Staff, Research, Valuation). New per-company
//      fields (staff/research/valuation/cumProfit) are filled in by
//      TechCo.normalize() on load — nothing to transform, all progress kept.
// v15: Tech management Phase 3 (Rivals, Market Share, Become #1). Adds per-company
//      rivals/edge/leaders fields, back-filled by TechCo.normalize() — in place,
//      all progress kept.
// v16: Tech management Phase 4 (Manufacturing, financial strategy, global
//      expansion, rival acquisition, events). New per-company fields back-filled
//      by TechCo.normalize() — in place, all progress kept.
// v17: In-depth Product Studio. New products carry specs/tier/team/budget and
//      sales metrics; old products keep working unchanged. No transform needed —
//      migrates in place, all progress kept.
// v18: Research meta-game (categories/levels, scientists, centres, partners,
//      mass projects). Each company's research state is rebuilt to the new shape
//      by TechCo.normalize() on load; unlocked products are kept. Cash/holdings
//      and everything else untouched.
// v19: per-company Signature operation — a unique always-on trait plus either a
//      5-step ladder program or a 3-way doctrine dial, tailored to each of the
//      48 companies. Seeded by TechCo.normalize() on load; nothing else changes.
// v20: Recruitment/Employee system foundation (data/employees.js) — adds
//      state.techco[id].employeeRoster (hired, named engineers) and empSearch
//      (headhunt counters), back-filled by TechCo.normalize() on load. Every
//      existing hire under the old eng/mkt/ops staff groups and Team-step
//      levels is untouched; the new roster starts empty for everyone.
// v21: Hiring & Talent screen (Services → Invest) — the SAME employeeRoster
//      now has a standalone company-wide browser (all 40 roles, any 100%-
//      owned company), plus a small ambient income/cost/quality bonus layered
//      on top of each company's existing formulas. No new persisted fields —
//      state.techco[id] is created lazily (as it already was for Tech
//      companies) the first time a company is opened from the new screen; a
//      company nobody's opened there is byte-identical to before.
// v22: Marketing & Growth (Services → Invest) — adds state.techco[id].marketing
//      (campaigns, resolved-campaign history, decaying income boosts, plus
//      influencer/sponsorship/research sub-state), back-filled empty by
//      TechCo.normalize() on load. Brand reputation is the SAME pre-existing
//      co(id).reputation field — no new reputation field, just more triggers
//      writing to it. Two new employee roles (Market Researcher, Marketing
//      Assistant) join the existing Sales & Marketing taxonomy. Everything
//      else — cash, products, existing income/quality formulas — untouched.
// v23: Business tab overhaul — the original 11 businesses (Retail Store, Taxi
//      Company, Restaurant, Clothing Business, Transportation, Construction,
//      Bank, Oil & Gas, IT Company, Sports Club, Airline) are replaced by 14
//      new ones. Players who owned any of the 11 are FULLY bought out (not
//      the 25% voluntary-sell rate — this is a forced removal, not a player
//      choice): every dollar ever spent on levels, staff hires and purchased
//      upgrades is refunded, plus any cash parked in a business-specific
//      mechanic (Bank's vault, Construction's in-flight materials, Airline's
//      paid-for routes). See REMOVED_BIZ_V23 below for the exact formulas.
//      Their save records are then deleted — no orphaned fields. Players with
//      none of the 11 see zero disruption; the new 14 default in normally.
// v24: Real estate retired from the Business tab (a "Coming Soon" placeholder
//      now lives on the Invest tab instead). Any owned property is FULLY
//      refunded at its tracked cost basis (state.assets.estate[id].cost —
//      exactly what the player paid, not market value, so no gain/loss is
//      manufactured either way) and state.assets.estate + state.assets.epoch
//      are then deleted. state.assets.luxury (the separate Luxury tab
//      collection) is completely untouched. Players who never bought
//      property see zero disruption.
const SAVE_VERSION = 24;

// Buyout data for v22 -> v23 migration (see below). Copied from the removed
// businesses' definitions so the refund math matches exactly what players
// actually paid; the live BUSINESS_DEFS no longer carries these entries.
const REMOVED_BIZ_V23 = {
  retail:       { baseCost: 4900 },
  taxi:         { baseCost: 10000 },
  restaurant:   { baseCost: 20000 },
  clothing:     { baseCost: 25000 },
  transport:    { baseCost: 35000 },
  construction: { baseCost: 40000,       hasMaterials: true },
  bank:         { baseCost: 200000,      hasVault: true },
  oil:          { baseCost: 1000000 },
  it:           { baseCost: 5000000 },
  sports:       { baseCost: 50000000 },
  airline:      { baseCost: 1000000000, routeCostX: 0.4, routeCostGrowth: 2 },
};
const REMOVED_BIZ_COST_MULT = 1.15; // costMultiplier every removed business used
const REMOVED_UPGRADE_COST = {
  retail_signage: 245000,     retail_loyalty: 5880000,     retail_chain: 122500000,
  taxi_dispatch: 500000,      taxi_app: 12000000,          taxi_ev: 250000000,
  rest_menu: 1000000,         rest_star: 24000000,         rest_franchise: 500000000,
  cloth_design: 1250000,      cloth_brand: 30000000,       cloth_global: 625000000,
  trans_hub: 1750000,         trans_rail: 42000000,        trans_ships: 875000000,
  constr_crane: 2000000,      constr_pre: 48000000,        constr_mega: 1000000000,
  bank_branch: 10000000,      bank_invest: 240000000,      bank_global: 5000000000,
  oil_rigs: 50000000,         oil_refine: 1200000000,      oil_cartel: 25000000000,
  it_cloud: 250000000,        it_ai: 6000000000,           it_uni: 125000000000,
  sport_academy: 2500000000,  sport_stadium: 60000000000,  sport_league: 1250000000000,
  air_biz: 50000000000,       air_hub: 1200000000000,      air_flag: 25000000000000,
};

/** Full buyout refund for one removed business's saved record (v23 migration). */
function removedBizRefund(id, biz) {
  const cfg = REMOVED_BIZ_V23[id];
  if (!cfg || !biz) return 0;
  let refund = 0;

  const L = biz.level || 0;
  if (L > 0) {
    refund += cfg.baseCost * (Math.pow(REMOVED_BIZ_COST_MULT, L) - 1) / (REMOVED_BIZ_COST_MULT - 1);
  }

  const staff = biz.staff || 0;
  if (staff > 0) {
    // Mirrors engine.js hireCost(): baseCost * STAFF_HIRE_COST_X * STAFF_HIRE_GROWTH^n
    const X = 0.35, G = 1.35;
    refund += cfg.baseCost * X * (Math.pow(G, staff) - 1) / (G - 1);
  }

  if (biz.upgrades) {
    for (const upId of Object.keys(biz.upgrades)) {
      if (biz.upgrades[upId] && REMOVED_UPGRADE_COST[upId] != null) refund += REMOVED_UPGRADE_COST[upId];
    }
  }

  if (biz.mech) {
    if (cfg.hasVault && biz.mech.vault) refund += biz.mech.vault;
    if (cfg.hasMaterials && biz.mech.job && biz.mech.job.materials) refund += biz.mech.job.materials;
    if (cfg.routeCostX && biz.mech.routes) {
      const n = biz.mech.routes;
      refund += cfg.baseCost * cfg.routeCostX * (Math.pow(cfg.routeCostGrowth, n) - 1) / (cfg.routeCostGrowth - 1);
    }
  }

  return refund;
}

// Coins that were repriced in v12: id -> price factor (newPrice / oldPrice).
// A holder's share count is divided by this so value stays identical.
const V12_COIN_SPLIT = {
  ripplet:      30 / 0.55,
  dogecorn:     24 / 0.12,
  cardino:      18 / 0.45,
  polkadotty:   65 / 6.5,
  shibanovu:    12 / 0.00002,
  safemoonshot: 8 / 0.000004,
  frogcoin:     5 / 0.0000012,
};

// Offline earnings: pay 100% for a window, avoiding both "free idle game" and
// the genre's usual stingy offline rates. Phase 1 cap = 2 hours (raised later).
const OFFLINE_CAP_SECONDS = 2 * 60 * 60;

/**
 * Fresh game state. Anything added in later phases (investments, real estate,
 * employees, level/xp…) gets a default here and a migration bump.
 */
function defaultState() {
  return {
    version: SAVE_VERSION,
    balance: 0,            // current spendable cash
    totalEarned: 0,        // lifetime earnings (for stats/progression)
    tapLevel: 1,           // per-tap upgrade level
    managementLevel: 0,    // global staff-efficiency upgrade level
    // businesses: map id -> { level, upgrades: {id:true}, staff, mech: {...} }
    businesses: {},

    /* Phase 3 — progression & meta */
    achievements: {},      // id -> true (completed; rewards already granted)
    legacyPoints: 0,       // permanent prestige currency (+10% income each)
    prestiges: 0,          // number of Legacy resets performed
    runEarned: 0,          // earned since last prestige (legacy-point basis)
    stats: { taps: 0 },    // lifetime counters for the Profile
    effects: [],           // active timed effects [{id, kind, mult, endsAt}]
    nextEventAt: 0,        // wall-clock ms of the next random event
    boosterReadyAt: 0,     // wall-clock ms when the booster is off cooldown

    /* Phase 4 — investing */
    portfolio: {},         // assetId -> { shares, cost } (cost = total $ basis)
    market: null,          // full market state; created lazily by Market.ensure()

    /* Phase 5 — real estate & luxury */
    assets: null,          // { luxury:{} }; lazy via Assets.ensure()

    /* Tech-sector company management (Phase 1) */
    techco: null,          // id -> per-company state; lazy via TechCo.ensureCompany()

    lastSaved: nowSeconds(),
  };
}

/**
 * Central earnings sink: EVERY income source (ticks, taps, mechanic payouts,
 * offline, events, achievement bonuses) goes through here so lifetime XP and
 * the Legacy run counter always stay in sync.
 */
function addEarnings(amount) {
  state.balance += amount;
  state.totalEarned += amount;
  state.runEarned += amount;
}

// Current live state (populated by loadGame()).
let state = defaultState();

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

/* ------------------------------------------------------------------ *
 * Persistence
 * ------------------------------------------------------------------ */

function saveGame() {
  state.lastSaved = nowSeconds();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Save failed', e);
  }
}

/**
 * Load state from localStorage, running any needed migrations, and merging
 * with defaults so new fields are always present.
 * @returns {object} { away: {seconds, earned} | null } offline info for popup
 */
function loadGame() {
  let away = null;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const loaded = JSON.parse(raw);
      state = migrate(loaded);
      // Merge to guarantee any newly-added default keys exist.
      state = Object.assign(defaultState(), state);
      away = applyOfflineEarnings();
    }
  } catch (e) {
    console.warn('Load failed, starting fresh', e);
    state = defaultState();
  }
  return { away };
}

/**
 * Migration hook. Bump SAVE_VERSION and add cases here in later phases.
 */
function migrate(loaded) {
  if (!loaded.version) loaded.version = 1;
  // v1 -> v2: the whole economy was rebalanced (costs, incomes, tap values).
  // Old numbers are meaningless under the new curves — reset cleanly.
  if (loaded.version < 2) {
    return defaultState();
  }
  // v2 -> v3: Phase 3 fields (achievements, legacy, stats…) get defaults via
  // the merge in loadGame(); a v2 player's whole history counts as their
  // first Legacy run.
  if (loaded.version < 3) {
    loaded.runEarned = loaded.totalEarned || 0;
    loaded.version = 3;
  }
  // v3 -> v4: portfolio/market fields default via the merge in loadGame();
  // nothing to transform — progress is fully kept.
  if (loaded.version < 4) {
    loaded.version = 4;
  }
  // v4 -> v5: assets field defaults via the merge; progress fully kept.
  if (loaded.version < 5) {
    loaded.version = 5;
  }
  // v5 -> v6: the market model changed from stored random walks to procedural
  // prices. Drop the old regenerable market state; KEEP portfolio holdings
  // (asset ids are preserved), cash, and everything else.
  if (loaded.version < 6) {
    loaded.market = null;
    loaded.version = 6;
  }
  // v6 -> v7: watchlist field defaults via the merge; progress fully kept.
  if (loaded.version < 7) {
    loaded.version = 7;
  }
  // v7 -> v8: commodities & financial assets are no longer tradeable.
  // Refund any such holdings at their full cost basis (no value lost) and
  // prune them (plus stale watchlist stars). ASSET_BY_ID is loaded before
  // state.js in both the page and the test harness.
  if (loaded.version < 8) {
    if (typeof ASSET_BY_ID !== 'undefined') {
      if (loaded.portfolio) {
        for (const id of Object.keys(loaded.portfolio)) {
          if (!ASSET_BY_ID[id]) {
            loaded.balance = (loaded.balance || 0) + (loaded.portfolio[id].cost || 0);
            delete loaded.portfolio[id];
          }
        }
      }
      if (loaded.watchlist) {
        for (const id of Object.keys(loaded.watchlist)) {
          if (!ASSET_BY_ID[id]) delete loaded.watchlist[id];
        }
      }
    }
    loaded.version = 8;
  }
  // v8 -> v9: the watchlist feature was removed — drop the field. Everything
  // else (holdings, cash, progress) is untouched.
  if (loaded.version < 9) {
    delete loaded.watchlist;
    loaded.version = 9;
  }
  // v9 -> v10: the market was trimmed to 60 curated assets. Any holding in a
  // now-delisted ticker is converted to cash (its invested basis — nothing is
  // lost) and cleaned out of the portfolio and owner-management history. A
  // one-time notice is queued for the UI (main.js shows it after init).
  if (loaded.version < 10) {
    if (typeof ASSET_BY_ID !== 'undefined' && loaded.portfolio) {
      let cash = 0, count = 0;
      for (const id of Object.keys(loaded.portfolio)) {
        if (ASSET_BY_ID[id]) continue; // still tradeable — keep it
        const h = loaded.portfolio[id];
        if (h && h.shares > 0) { cash += h.cost || 0; count++; }
        delete loaded.portfolio[id];
        if (loaded.market && loaded.market.mgmt) delete loaded.market.mgmt[id];
      }
      if (count > 0) {
        loaded.balance = (loaded.balance || 0) + cash;
        loaded.delistedNotice = { count, cash };
      }
    }
    loaded.version = 10;
  }
  // v10 -> v11: real estate moved from Invest to the Business tab. The property
  // data (loaded.assets.estate) is untouched — owned units, their cost basis,
  // value and rent all carry over exactly. Nothing to transform.
  if (loaded.version < 11) {
    loaded.version = 11;
  }
  // v11 -> v12: assets renamed (ids unchanged, so holdings carry over as-is).
  // Seven coins were repriced with matching supply cuts; reverse-split any
  // holding in them so its VALUE and ownership % are unchanged (shares ÷ factor,
  // cost basis untouched → same dollars in, same dollars out). Nothing is sold.
  if (loaded.version < 12) {
    if (loaded.portfolio) {
      for (const id of Object.keys(V12_COIN_SPLIT)) {
        const h = loaded.portfolio[id];
        if (h && h.shares > 0) h.shares = h.shares / V12_COIN_SPLIT[id];
      }
    }
    loaded.version = 12;
  }
  // v12 -> v13: tech-company management added. state.techco defaults via the
  // merge in loadGame() — nothing to transform, all progress kept.
  if (loaded.version < 13) {
    loaded.version = 13;
  }
  // v13 -> v14: tech management Phase 2 (staff/research/valuation). Per-company
  // fields are back-filled by TechCo.normalize() when a company is opened — no
  // transform here; existing techco/products/cash all carry over.
  if (loaded.version < 14) {
    loaded.version = 14;
  }
  // v14 -> v15: tech management Phase 3 (rivals/market share). Per-company rival
  // and standing fields are back-filled by TechCo.normalize() on open — no
  // transform here; existing techco state carries over.
  if (loaded.version < 15) {
    loaded.version = 15;
  }
  // v15 -> v16: tech management Phase 4 (manufacturing/strategy/global/events).
  // Per-company fields are back-filled by TechCo.normalize() on open — no
  // transform here; existing techco state carries over.
  if (loaded.version < 16) {
    loaded.version = 16;
  }
  // v16 -> v17: in-depth Product Studio. New per-product fields are set on
  // creation; existing products/companies carry over untouched.
  if (loaded.version < 17) {
    loaded.version = 17;
  }
  // v17 -> v18: research meta-game. Per-company research is migrated to the new
  // shape by TechCo.normalize() when a company is opened — no transform here.
  if (loaded.version < 18) {
    loaded.version = 18;
  }
  // v18 -> v19: per-company Signature operation (unique trait + ladder/doctrine).
  // Each company's signature state is seeded by TechCo.normalize() on open — no
  // transform here. All cash / holdings / progress untouched.
  if (loaded.version < 19) {
    loaded.version = 19;
  }
  // v19 -> v20: Recruitment/Employee system foundation. employeeRoster/empSearch
  // are seeded empty by TechCo.normalize() on open — no transform here. Every
  // existing eng/mkt/ops hire and Team-step level is untouched.
  if (loaded.version < 20) {
    loaded.version = 20;
  }
  // v20 -> v21: Hiring & Talent screen. No new persisted shape — reuses
  // employeeRoster/empSearch exactly as they already are; nothing to transform.
  if (loaded.version < 21) {
    loaded.version = 21;
  }
  // v21 -> v22: Marketing & Growth. co(id).marketing is seeded empty by
  // TechCo.normalize() on open — no transform here. Reputation is the same
  // pre-existing field, so nothing to migrate for it either.
  if (loaded.version < 22) {
    loaded.version = 22;
  }
  // v22 -> v23: Business tab overhaul. Fully buy out any of the 11 removed
  // businesses the player owns (see removedBizRefund above), credit the cash,
  // then delete their save records so nothing orphaned lingers. Players with
  // none of the 11 are untouched; the new 14 default in via getBiz() as usual.
  if (loaded.version < 23) {
    if (loaded.businesses) {
      let totalRefund = 0, refundedCount = 0;
      for (const id of Object.keys(REMOVED_BIZ_V23)) {
        const biz = loaded.businesses[id];
        if (biz && biz.level > 0) {
          const refund = removedBizRefund(id, biz);
          totalRefund += refund;
          refundedCount++;
        }
        delete loaded.businesses[id];
      }
      if (totalRefund > 0) {
        loaded.balance = (loaded.balance || 0) + totalRefund;
        loaded.businessBuyoutNotice = { count: refundedCount, cash: totalRefund };
      }
    }
    loaded.version = 23;
  }
  // v23 -> v24: Real estate retired from the Business tab. Refund every owned
  // property unit at its exact tracked cost basis (no gain/loss manufactured
  // either way), then drop the estate/epoch fields. Luxury is untouched.
  if (loaded.version < 24) {
    if (loaded.assets && loaded.assets.estate) {
      let totalRefund = 0, unitCount = 0;
      for (const id of Object.keys(loaded.assets.estate)) {
        const rec = loaded.assets.estate[id];
        if (rec && rec.count > 0) {
          totalRefund += rec.cost || 0;
          unitCount += rec.count;
        }
      }
      if (totalRefund > 0) {
        loaded.balance = (loaded.balance || 0) + totalRefund;
        loaded.realEstateRefundNotice = { units: unitCount, cash: totalRefund };
      }
      delete loaded.assets.estate;
      delete loaded.assets.epoch;
    }
    loaded.version = 24;
  }
  return loaded;
}

/* ------------------------------------------------------------------ *
 * Offline earnings
 * ------------------------------------------------------------------ */

/**
 * Credit passive income earned while the app was closed and return a summary
 * for the "While you were away" popup. Returns null if nothing meaningful.
 */
function applyOfflineEarnings() {
  const elapsed = nowSeconds() - (state.lastSaved || nowSeconds());
  if (elapsed < 5) return null; // ignore quick reloads

  const capped = Math.min(elapsed, OFFLINE_CAP_SECONDS);
  const rate = totalPassiveIncomePerSec(); // engine.js (businesses + rent)
  const earned = rate * capped;

  // Let mechanics apply offline time too (bank vault interest compounds;
  // project/build timers use wall-clock so they progress on their own).
  if (typeof Mechanics !== 'undefined') Mechanics.applyOffline(capped);
  // Markets kept moving while you were away (coarse catch-up, capped).
  if (typeof Market !== 'undefined') Market.applyOffline(elapsed);
  // Tech companies: resolve builds that finished and accrue company cash while
  // the app was closed (wall-clock based; a completion toast fires on return).
  if (typeof TechCo !== 'undefined') TechCo.applyOffline(elapsed);

  if (earned <= 0) return null;

  addEarnings(earned);

  return { seconds: elapsed, cappedSeconds: capped, earned, rate };
}
