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
const SAVE_VERSION = 8;

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
    assets: null,          // { epoch, estate:{}, luxury:{} }; lazy via Assets.ensure()
    watchlist: {},         // assetId -> true (starred in the Markets list)

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

  if (earned <= 0) return null;

  addEarnings(earned);

  return { seconds: elapsed, cappedSeconds: capped, earned, rate };
}
