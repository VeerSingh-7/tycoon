/* =========================================================================
 * data/markets.js — Phase 4 DATA: tradeable assets + market tuning
 * -------------------------------------------------------------------------
 * Adding an asset = adding one object. The Market engine reads these
 * generically; groups drive the Invest tab filters.
 *
 * Volatility (`vol`) is the per-second lognormal stddev — the risk ladder:
 *   commodities/blue-chips low → growth stocks mid → crypto high.
 * `maxDrift` bounds bull/bear regime strength; `shockMax` bounds
 * crash/rally size; `divYield` is the fraction of position value paid
 * every dividend interval (stocks only).
 * ========================================================================= */

const MARKET = {
  STEP_SEC: 1,              // one price step per second
  SPREAD: 0.005,            // buy at +0.5%, sell at −0.5% of mid
  CANDLE_TFS: [10, 60],     // candle timeframes (seconds)
  CANDLES_KEPT: 90,         // history depth per timeframe
  DIV_INTERVAL_SEC: 300,    // dividends every 5 minutes
  DIV_MAX_CATCHUP: 24,      // at most 2h of missed payouts on return
  REVERSION: 0.00003,       // gentle pull toward basePrice (stability)
  OFFLINE_CAP_SEC: 7200,    // simulate at most 2h of closed-app drift
  OFFLINE_MAX_STEPS: 600,   // coarse steps used for that catch-up
  SEED_SEC: 5400,           // 90 min of history generated on first run
};

const ASSET_DEFS = [
  /* ------------------------------ Stocks ------------------------------ */
  // Steady-ish, pay dividends every 5 min based on shares held.
  { id: 'googol', symbol: 'GGL',  name: 'Googol',      icon: '🔎', group: 'stock',
    basePrice: 180,  vol: 0.0016, maxDrift: 0.00020, shockMax: 0.10, divYield: 0.0030 },
  { id: 'mango',  symbol: 'MNGO', name: 'Mango Inc',   icon: '🥭', group: 'stock',
    basePrice: 210,  vol: 0.0015, maxDrift: 0.00018, shockMax: 0.09, divYield: 0.0032 },
  { id: 'tezla',  symbol: 'TZLA', name: 'Tezla',       icon: '⚡', group: 'stock',
    basePrice: 240,  vol: 0.0030, maxDrift: 0.00035, shockMax: 0.16, divYield: 0.0018 },
  { id: 'ramble', symbol: 'RMBL', name: 'Ramble',      icon: '📣', group: 'stock',
    basePrice: 45,   vol: 0.0034, maxDrift: 0.00040, shockMax: 0.18, divYield: 0.0012 },
  { id: 'amazen', symbol: 'AMZN', name: 'Amazen',      icon: '📦', group: 'stock',
    basePrice: 150,  vol: 0.0018, maxDrift: 0.00022, shockMax: 0.10, divYield: 0.0026 },
  { id: 'burgerduke', symbol: 'BDK', name: 'Burger Duke', icon: '🍔', group: 'stock',
    basePrice: 62,   vol: 0.0012, maxDrift: 0.00014, shockMax: 0.07, divYield: 0.0040 },

  /* ------------------------------ Crypto ------------------------------ */
  // No dividends; big swings, bigger crashes — pure timing.
  { id: 'bitcorn',  symbol: 'BTC', name: 'Bitcorn',   icon: '🌽', group: 'crypto',
    basePrice: 65000, vol: 0.006,  maxDrift: 0.00060, shockMax: 0.22 },
  { id: 'ethereal', symbol: 'ETH', name: 'Ethereal',  icon: '👻', group: 'crypto',
    basePrice: 3200,  vol: 0.008,  maxDrift: 0.00075, shockMax: 0.26 },
  { id: 'dogecorn', symbol: 'DOGE', name: 'Dogecorn', icon: '🐶', group: 'crypto',
    basePrice: 0.12,  vol: 0.012,  maxDrift: 0.00110, shockMax: 0.35 },

  /* ---------------------------- Commodities ---------------------------- */
  // Crude Oil is oilLinked: its price IS Mechanics.oilPrice() × basePrice —
  // the exact same cycle the Oil & Gas and Transport businesses react to.
  { id: 'oil',   symbol: 'OIL',  name: 'Crude Oil', icon: '🛢️', group: 'commodity',
    basePrice: 80,   oilLinked: true },
  { id: 'gold',  symbol: 'GLD',  name: 'Gold',      icon: '🪙', group: 'commodity',
    basePrice: 2400, vol: 0.0008, maxDrift: 0.00010, shockMax: 0.05 },
  { id: 'wheat', symbol: 'WHT',  name: 'Wheat',     icon: '🌾', group: 'commodity',
    basePrice: 6.2,  vol: 0.0020, maxDrift: 0.00025, shockMax: 0.10 },
];

const ASSET_BY_ID = ASSET_DEFS.reduce((m, a) => { m[a.id] = a; return m; }, {});
