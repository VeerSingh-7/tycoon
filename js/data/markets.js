/* =========================================================================
 * data/markets.js — Phase 4 (overhauled) DATA: market config + non-stock roster
 * -------------------------------------------------------------------------
 * Prices are PROCEDURAL (see js/market.js `priceAt`): every asset here is a
 * light data object; price, candle history, % change and stats are generated
 * on demand from a deterministic noise function of wall-clock time. That lets
 * us carry ~170 assets on a phone and draw history back to any founding date
 * without storing per-asset candle state.
 *
 * Stocks live in js/data/stocks.js (a compact parody roster); their per-asset
 * numbers derive from SECTOR_PROFILES below. Adding an asset = adding a row.
 * ========================================================================= */

const MARKET = {
  EPOCH: 1735689600,      // 2025-01-01 UTC — FIXED trend anchor (never "now"),
                          // so historical candles are stable as real time passes.
  DAY: 86400,
  YEAR: 31557600,
  SPREAD: 0.005,          // buy +0.5% / sell −0.5% of mid — trading has a cost
  DIV_INTERVAL_SEC: 300,  // dividends / coupons every 5 minutes
  DIV_MAX_CATCHUP: 24,    // cap missed payouts on return (2h)
  CANDLE_SAMPLES: 6,      // intra-candle samples for wick high/low
  MAX_CANDLES: 140,       // hard cap per chart (phone performance)
  DEFAULT_TF: '1D',
  // Chart timeframes. bucket/span in seconds; Max spans founding→now.
  TIMEFRAMES: [
    { id: '1D', label: '1D', bucket: 900,    span: 86400 },
    { id: '1W', label: '1W', bucket: 7200,   span: 604800 },
    { id: '1M', label: '1M', bucket: 28800,  span: 2592000 },
    { id: '3M', label: '3M', bucket: 86400,  span: 7776000 },
    { id: '1Y', label: '1Y', bucket: 345600, span: 31557600 },
    { id: 'Max', label: 'Max', bucket: null, span: null },
  ],
};

// Category headers in the Markets list (commodity sub-groups + top levels).
const MARKET_GROUPS = [
  { id: 'stock',      label: 'Stocks',            icon: '📈' },
  { id: 'crypto',     label: 'Crypto',            icon: '🪙' },
  { id: 'precious',   label: 'Precious Metals',   icon: '🥇' },
  { id: 'industrial', label: 'Industrial Metals', icon: '🔩' },
  { id: 'energy',     label: 'Energy',            icon: '⚡' },
  { id: 'agri',       label: 'Agriculture',       icon: '🌾' },
  { id: 'softs',      label: 'Soft Commodities',  icon: '☕' },
  { id: 'livestock',  label: 'Livestock',         icon: '🐄' },
  { id: 'forestry',   label: 'Forestry',          icon: '🌲' },
  { id: 'gems',       label: 'Gemstones',         icon: '💠' },
  { id: 'financial',  label: 'Financial',         icon: '🏦' },
];

// The eight commodity sub-groups, in display order.
const COMMODITY_GROUP_IDS = ['precious', 'industrial', 'energy', 'agri', 'softs', 'livestock', 'forestry', 'gems'];

// Stock sectors → tidy display sections (collapsible headers in the list).
// Every SECTOR_PROFILES key maps to exactly one section.
const STOCK_SECTIONS = [
  { id: 'sec_tech',     label: 'Technology',          icon: '💻', sectors: ['tech', 'media', 'telecom'] },
  { id: 'sec_semi',     label: 'Semiconductors',      icon: '🔬', sectors: ['semi'] },
  { id: 'sec_fin',      label: 'Banks & Finance',     icon: '🏦', sectors: ['bank', 'fintech'] },
  { id: 'sec_health',   label: 'Healthcare & Pharma', icon: '💊', sectors: ['pharma'] },
  { id: 'sec_energy',   label: 'Energy',              icon: '⚡', sectors: ['energy', 'utility'] },
  { id: 'sec_consumer', label: 'Consumer & Retail',   icon: '🛍️', sectors: ['consumer', 'retail', 'luxury'] },
  { id: 'sec_auto',     label: 'Autos',               icon: '🚗', sectors: ['auto'] },
  { id: 'sec_aero',     label: 'Aerospace & Defence', icon: '🚀', sectors: ['aerospace'] },
  { id: 'sec_industrial', label: 'Industrials',       icon: '🏗️', sectors: ['industrial', 'materials'] },
];
const SECTOR_TO_SECTION = STOCK_SECTIONS.reduce((m, s) => {
  for (const k of s.sectors) m[k] = s.id;
  return m;
}, {});

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

/* ----------------------- Non-stock roster (explicit) --------------------- */
// Fields: id, name, ticker, group, refPrice (~present price at EPOCH), vol
// (noise scale), drift (annual, optional), unit (display), and flags:
//   oilLinked — price = Mechanics.oilPrice() × refPrice (shared with businesses)
//   flat      — constant price (Cash)
//   savings   — smooth interest curve, no noise
//   divYield  — coupon/rent paid per interval (bonds, REITs, property)
//   issuer    — flavour text for bonds

const COMMODITY_DEFS = [
  // Precious metals
  { id: 'gold',      name: 'Gold',       ticker: 'XAU', group: 'precious', refPrice: 2400,  vol: 0.010, drift: 0.02, unit: 'per oz' },
  { id: 'silver',    name: 'Silver',     ticker: 'XAG', group: 'precious', refPrice: 30,    vol: 0.020, unit: 'per oz' },
  { id: 'platinum',  name: 'Platinum',   ticker: 'XPT', group: 'precious', refPrice: 980,   vol: 0.016, unit: 'per oz' },
  { id: 'palladium', name: 'Palladium',  ticker: 'XPD', group: 'precious', refPrice: 1000,  vol: 0.022, unit: 'per oz' },

  // Industrial metals
  { id: 'copper',    name: 'Copper',     ticker: 'HG',  group: 'industrial', refPrice: 4.3,   vol: 0.020, unit: 'per lb' },
  { id: 'aluminium', name: 'Aluminium',  ticker: 'ALI', group: 'industrial', refPrice: 2.5,   vol: 0.018, unit: 'per kg' },
  { id: 'nickel',    name: 'Nickel',     ticker: 'NIK', group: 'industrial', refPrice: 18000, vol: 0.030, unit: 'per ton' },
  { id: 'zinc',      name: 'Zinc',       ticker: 'ZNC', group: 'industrial', refPrice: 2.85,  vol: 0.022, unit: 'per kg' },
  { id: 'lead',      name: 'Lead',       ticker: 'PBX', group: 'industrial', refPrice: 2.1,   vol: 0.020, unit: 'per kg' },
  { id: 'tin',       name: 'Tin',        ticker: 'TIN', group: 'industrial', refPrice: 31000, vol: 0.028, unit: 'per ton' },
  { id: 'iron_ore',  name: 'Iron Ore',   ticker: 'IRN', group: 'industrial', refPrice: 110,   vol: 0.030, unit: 'per ton' },
  { id: 'steel',     name: 'Steel',      ticker: 'STL', group: 'industrial', refPrice: 720,   vol: 0.020, unit: 'per ton' },
  { id: 'lithium',   name: 'Lithium',    ticker: 'LIT', group: 'industrial', refPrice: 15000, vol: 0.050, unit: 'per ton' },
  { id: 'cobalt',    name: 'Cobalt',     ticker: 'COB', group: 'industrial', refPrice: 27000, vol: 0.040, unit: 'per ton' },

  // Energy
  { id: 'oil',         name: 'Crude Oil',   ticker: 'CL',  group: 'energy', refPrice: 80,  oilLinked: true, unit: 'per bbl' },
  { id: 'brent',       name: 'Brent Oil',   ticker: 'BRN', group: 'energy', refPrice: 84,  vol: 0.030, unit: 'per bbl' },
  { id: 'natural_gas', name: 'Natural Gas', ticker: 'NG',  group: 'energy', refPrice: 2.8, vol: 0.060, unit: 'per MMBtu' },
  { id: 'coal',        name: 'Coal',        ticker: 'COA', group: 'energy', refPrice: 130, vol: 0.030, unit: 'per ton' },
  { id: 'uranium',     name: 'Uranium',     ticker: 'URA', group: 'energy', refPrice: 90,  vol: 0.035, unit: 'per lb' },
  { id: 'electricity', name: 'Electricity', ticker: 'ELC', group: 'energy', refPrice: 60,  vol: 0.050, unit: 'per MWh' },

  // Agriculture
  { id: 'wheat',    name: 'Wheat',    ticker: 'WHT', group: 'agri', refPrice: 6.2, vol: 0.025, unit: 'per bu' },
  { id: 'corn',     name: 'Corn',     ticker: 'CRN', group: 'agri', refPrice: 4.3, vol: 0.025, unit: 'per bu' },
  { id: 'rice',     name: 'Rice',     ticker: 'RIC', group: 'agri', refPrice: 17,  vol: 0.020, unit: 'per cwt' },
  { id: 'soybeans', name: 'Soybeans', ticker: 'SOY', group: 'agri', refPrice: 12,  vol: 0.022, unit: 'per bu' },
  { id: 'oats',     name: 'Oats',     ticker: 'OAT', group: 'agri', refPrice: 3.6, vol: 0.028, unit: 'per bu' },
  { id: 'barley',   name: 'Barley',   ticker: 'BLY', group: 'agri', refPrice: 5.5, vol: 0.025, unit: 'per bu' },
  { id: 'canola',   name: 'Canola',   ticker: 'CAN', group: 'agri', refPrice: 620, vol: 0.024, unit: 'per ton' },

  // Soft commodities
  { id: 'coffee',       name: 'Coffee',       ticker: 'KC',  group: 'softs', refPrice: 2.4,  vol: 0.035, unit: 'per lb' },
  { id: 'cocoa',        name: 'Cocoa',        ticker: 'CC',  group: 'softs', refPrice: 7000, vol: 0.050, unit: 'per ton' },
  { id: 'sugar',        name: 'Sugar',        ticker: 'SB',  group: 'softs', refPrice: 0.22, vol: 0.030, unit: 'per lb' },
  { id: 'cotton',       name: 'Cotton',       ticker: 'CT',  group: 'softs', refPrice: 0.72, vol: 0.028, unit: 'per lb' },
  { id: 'orange_juice', name: 'Orange Juice', ticker: 'OJ',  group: 'softs', refPrice: 3.8,  vol: 0.040, unit: 'per lb' },
  { id: 'rubber',       name: 'Rubber',       ticker: 'RUB', group: 'softs', refPrice: 1.7,  vol: 0.030, unit: 'per kg' },
  { id: 'tobacco',      name: 'Tobacco',      ticker: 'TOB', group: 'softs', refPrice: 3.2,  vol: 0.020, unit: 'per lb' },

  // Livestock
  { id: 'cattle',    name: 'Cattle',    ticker: 'LC',  group: 'livestock', refPrice: 1.85, vol: 0.020, unit: 'per lb' },
  { id: 'lean_hogs', name: 'Lean Hogs', ticker: 'HE',  group: 'livestock', refPrice: 0.9,  vol: 0.028, unit: 'per lb' },
  { id: 'sheep',     name: 'Sheep',     ticker: 'SHP', group: 'livestock', refPrice: 5.5,  vol: 0.025, unit: 'per kg' },
  { id: 'poultry',   name: 'Poultry',   ticker: 'PLT', group: 'livestock', refPrice: 1.2,  vol: 0.020, unit: 'per lb' },

  // Forestry
  { id: 'timber', name: 'Timber', ticker: 'TMB', group: 'forestry', refPrice: 380, vol: 0.020, unit: 'per m³' },
  { id: 'lumber', name: 'Lumber', ticker: 'LBS', group: 'forestry', refPrice: 550, vol: 0.030, unit: 'per 1k bf' },
  { id: 'pulp',   name: 'Pulp',   ticker: 'PLP', group: 'forestry', refPrice: 900, vol: 0.022, unit: 'per ton' },

  // Gemstones
  { id: 'diamonds',  name: 'Diamonds',  ticker: 'DMD', group: 'gems', refPrice: 6500, vol: 0.012, drift: 0.02, unit: 'per ct' },
  { id: 'emeralds',  name: 'Emeralds',  ticker: 'EMR', group: 'gems', refPrice: 4200, vol: 0.015, unit: 'per ct' },
  { id: 'rubies',    name: 'Rubies',    ticker: 'RBY', group: 'gems', refPrice: 5000, vol: 0.015, unit: 'per ct' },
  { id: 'sapphires', name: 'Sapphires', ticker: 'SPH', group: 'gems', refPrice: 3800, vol: 0.015, unit: 'per ct' },

  // Financial assets (fictional issuers). `fin` splits them into the
  // "Savings & Bonds" vs "Property" filter chips.
  { id: 'cash',            name: 'Cash',              ticker: 'CASH', group: 'financial', fin: 'savings', refPrice: 1.00,  vol: 0, flat: true, unit: 'per unit' },
  { id: 'savings',         name: 'Savings Account',   ticker: 'SAV',  group: 'financial', fin: 'savings', refPrice: 1.00,  vol: 0, savings: true, drift: 0.03, unit: 'per unit' },
  { id: 'bonds',           name: 'Bonds',             ticker: 'BND',  group: 'financial', fin: 'savings', refPrice: 100,   vol: 0.004, divYield: 0.0010, unit: 'per note' },
  { id: 'gov_bonds',       name: 'Government Bonds',   ticker: 'GVT',  group: 'financial', fin: 'savings', refPrice: 100,   vol: 0.003, divYield: 0.0008, issuer: 'Republic of Aurelia', unit: 'per note' },
  { id: 'corp_bonds',      name: 'Corporate Bonds',   ticker: 'CRP',  group: 'financial', fin: 'savings', refPrice: 101,   vol: 0.006, divYield: 0.0013, issuer: 'Veranda Capital', unit: 'per note' },
  { id: 'tbills',          name: 'Treasury Bills',    ticker: 'TBL',  group: 'financial', fin: 'savings', refPrice: 99.5,  vol: 0.002, divYield: 0.0005, issuer: 'Aurelia Treasury', unit: 'per bill' },
  { id: 'reit_beacon',     name: 'Beacon REIT',       ticker: 'BCN',  group: 'financial', fin: 'property', refPrice: 55,    vol: 0.020, divYield: 0.0030, drift: 0.03, unit: 'per share' },
  { id: 'reit_meridian',   name: 'Meridian Property Fund', ticker: 'MPF', group: 'financial', fin: 'property', refPrice: 42, vol: 0.018, divYield: 0.0028, drift: 0.03, unit: 'per share' },
  { id: 'commercial_prop', name: 'Commercial Property', ticker: 'CMP', group: 'financial', fin: 'property', refPrice: 250,  vol: 0.012, divYield: 0.0022, drift: 0.02, unit: 'index' },
  { id: 'residential_prop',name: 'Residential Property',ticker: 'RES', group: 'financial', fin: 'property', refPrice: 180,  vol: 0.012, divYield: 0.0020, drift: 0.025, unit: 'index' },

  // Crypto (kept from the original roster; high volatility, no dividends)
  { id: 'bitcorn',  name: 'Bitcorn',  ticker: 'BTC', group: 'crypto', refPrice: 65000, vol: 0.090, drift: 0.10, unit: 'per coin' },
  { id: 'ethereal', name: 'Ethereal', ticker: 'ETH', group: 'crypto', refPrice: 3200,  vol: 0.105, drift: 0.12, unit: 'per coin' },
  { id: 'dogecorn', name: 'Dogecorn', ticker: 'DOGE',group: 'crypto', refPrice: 0.12,  vol: 0.130, drift: 0.05, unit: 'per coin' },
];
