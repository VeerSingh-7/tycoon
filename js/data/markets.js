/* =========================================================================
 * data/markets.js — Invest DATA: market config, sections, crypto roster
 * -------------------------------------------------------------------------
 * The Invest tab trades STOCKS and CRYPTO only. (The oil price the Oil & Gas
 * and Transport businesses react to lives in js/mechanics.js — it was never
 * part of this file's data and is unaffected.)
 *
 * Prices are PROCEDURAL (js/market.js `priceAt`): every asset is a light
 * data object; price, candle history, % change and stats are generated on
 * demand from a deterministic noise function of wall-clock time.
 *
 * Stocks live in js/data/stocks.js; their numbers derive from
 * SECTOR_PROFILES below. Adding an asset = adding a row.
 * ========================================================================= */

const MARKET = {
  EPOCH: 1735689600,      // 2025-01-01 UTC — FIXED trend anchor (never "now"),
                          // so historical candles are stable as real time passes.
  DAY: 86400,
  YEAR: 31557600,
  SPREAD: 0.005,          // buy +0.5% / sell −0.5% of mid — trading has a cost
  DIV_INTERVAL_SEC: 300,  // dividends / owner income every 5 minutes
  DIV_MAX_CATCHUP: 24,    // cap missed payouts on return (2h)
  OWNER_INCOME_RATE: 0.002, // fully-owned company/coin pays 0.2% of its market
                            // cap per interval (~payback in a couple of days)
  CANDLE_SAMPLES: 20,     // intra-candle samples for accurate high/low aggregation
  MAX_CANDLES: 140,       // hard cap per chart (phone performance)
  DEFAULT_TF: '1D',
  // Chart timeframes. `bucket` (seconds) is the candle interval — ONE candle per
  // bucket, so a new candle only appears when that interval elapses. Six only,
  // fitting one row. MAX (bucket null) spans the asset's whole life, aggregated.
  TIMEFRAMES: [
    { id: '1s', label: '1S',   bucket: 1 },
    { id: '1m', label: '1MIN', bucket: 60 },
    { id: '1H', label: '1H',   bucket: 3600 },
    { id: '1D', label: '1D',   bucket: 86400 },
    { id: '1W', label: '1W',   bucket: 604800 },
    { id: 'Max', label: 'MAX', bucket: null },
  ],
};

// Top-level asset groups (only these two are tradeable now).
const MARKET_GROUPS = [
  { id: 'stock',  label: 'Stocks', icon: '📈' },
  { id: 'crypto', label: 'Crypto', icon: '🪙' },
];

// Stock sector profiles → drift (annual trend), vol (noise scale), P/E range,
// dividend range (fraction paid per 5-min interval), price-to-book range.
const SECTOR_PROFILES = {
  tech:       { drift: 0.13, vol: 0.030, pe: [28, 55], div: [0, 0.006],      pb: [6, 14] },
  semi:       { drift: 0.15, vol: 0.042, pe: [22, 46], div: [0, 0.010],      pb: [5, 12] },
  bank:       { drift: 0.05, vol: 0.022, pe: [8, 14],  div: [0.020, 0.045],  pb: [0.8, 1.8] },
  fintech:    { drift: 0.11, vol: 0.032, pe: [18, 40], div: [0, 0.012],      pb: [4, 9] },
  pharma:     { drift: 0.07, vol: 0.020, pe: [12, 26], div: [0.010, 0.035],  pb: [3, 7] },
  energy:     { drift: 0.04, vol: 0.028, pe: [7, 13],  div: [0.030, 0.060],  pb: [1, 2.5] },
  consumer:   { drift: 0.06, vol: 0.015, pe: [18, 30], div: [0.015, 0.030],  pb: [4, 10] },
  retail:     { drift: 0.07, vol: 0.018, pe: [16, 30], div: [0.005, 0.020],  pb: [3, 8] },
  auto:       { drift: 0.06, vol: 0.034, pe: [6, 20],  div: [0, 0.030],      pb: [1, 4] },
  aerospace:  { drift: 0.06, vol: 0.026, pe: [15, 30], div: [0.005, 0.020],  pb: [2, 6] },
  industrial: { drift: 0.06, vol: 0.022, pe: [14, 26], div: [0.010, 0.025],  pb: [2, 6] },
  telecom:    { drift: 0.02, vol: 0.017, pe: [8, 16],  div: [0.040, 0.070],  pb: [1, 3] },
  media:      { drift: 0.07, vol: 0.026, pe: [16, 32], div: [0, 0.015],      pb: [2, 6] },
  utility:    { drift: 0.04, vol: 0.013, pe: [14, 22], div: [0.025, 0.045],  pb: [1.5, 3] },
  materials:  { drift: 0.05, vol: 0.026, pe: [9, 18],  div: [0.020, 0.040],  pb: [1.5, 4] },
  luxury:     { drift: 0.09, vol: 0.024, pe: [20, 38], div: [0.008, 0.020],  pb: [4, 10] },
};

/* ------------------------------ Crypto ---------------------------------- */
// All fictional parody coins. `supply` is the total coin supply — buy 100%
// of it and the coin is fully YOURS (owner income + Manage panel), exactly
// like buying out a company. Risk ladder: vol 0.09 (blue-chip) → 0.18 (degen).
// Market caps span ~$0.5B (attainable) to ~$1.4T (endgame trophy).

const CRYPTO_DEFS = [
  // id            name             ticker   refPrice   supply    vol    drift  founded
  { id: 'bitcorn',   name: 'Bitcorn',      ticker: 'BTC',  group: 'crypto', refPrice: 65000,     supply: 2.1e7,   vol: 0.090, drift: 0.10, founded: 2009, unit: 'per coin' },
  { id: 'ethereal',  name: 'Ethereal',     ticker: 'ETH',  group: 'crypto', refPrice: 3200,      supply: 1.2e8,   vol: 0.105, drift: 0.12, founded: 2015, unit: 'per coin' },
  { id: 'litebit',   name: 'Litebit',      ticker: 'LTB',  group: 'crypto', refPrice: 80,        supply: 8.4e7,   vol: 0.095, drift: 0.04, founded: 2011, unit: 'per coin' },
  { id: 'ripplet',   name: 'Ripplet',      ticker: 'RPL',  group: 'crypto', refPrice: 0.55,      supply: 5.5e10,  vol: 0.100, drift: 0.05, founded: 2012, unit: 'per coin' },
  { id: 'dogecorn',  name: 'Dogecorn',     ticker: 'DOGE', group: 'crypto', refPrice: 0.12,      supply: 1.4e11,  vol: 0.130, drift: 0.05, founded: 2013, unit: 'per coin' },
  { id: 'cardino',   name: 'Cardino',      ticker: 'ADA',  group: 'crypto', refPrice: 0.45,      supply: 3.5e10,  vol: 0.110, drift: 0.06, founded: 2017, unit: 'per coin' },
  { id: 'solami',    name: 'Solami',       ticker: 'SOL',  group: 'crypto', refPrice: 150,       supply: 4.6e8,   vol: 0.115, drift: 0.13, founded: 2020, unit: 'per coin' },
  { id: 'polkadotty',name: 'Polkadotty',   ticker: 'DOTY', group: 'crypto', refPrice: 6.5,       supply: 1.4e9,   vol: 0.110, drift: 0.06, founded: 2020, unit: 'per coin' },
  { id: 'avalunch',  name: 'Avalunch',     ticker: 'AVAX', group: 'crypto', refPrice: 30,        supply: 4.4e8,   vol: 0.120, drift: 0.08, founded: 2020, unit: 'per coin' },
  { id: 'shibanovu', name: 'Shiba Novu',   ticker: 'SHNV', group: 'crypto', refPrice: 0.00002,   supply: 5.89e14, vol: 0.140, drift: 0.05, founded: 2020, unit: 'per coin' },
  { id: 'safemoonshot', name: 'SafeMoonshot', ticker: 'SAFE', group: 'crypto', refPrice: 0.000004, supply: 9.99e14, vol: 0.180, drift: 0.03, founded: 2021, unit: 'per coin' },
  { id: 'frogcoin',  name: 'Frogcoin',     ticker: 'FROG', group: 'crypto', refPrice: 0.0000012, supply: 4.2e14,  vol: 0.160, drift: 0.06, founded: 2023, unit: 'per coin' },
];
