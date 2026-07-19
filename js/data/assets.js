/* =========================================================================
 * data/assets.js — Phase 5 DATA: real estate + luxury collection
 * -------------------------------------------------------------------------
 * IMAGES: every item (estate + luxury) looks for `img/assets/<id>.png`.
 * Drop a file with the matching name into img/assets/ and the card picks it
 * up automatically — until then a coloured placeholder with the icon shows.
 *
 * REAL ESTATE: own multiples of each property. Each unit pays rent/sec and
 * the MARKET VALUE of the property type appreciates apprPerDay compounding
 * (so buying early is cheaper, and selling later realizes the gain).
 * ROI shown as rent payback time; sells pay market value minus a 3% fee.
 *
 * LUXURY: one-off collectibles grouped into sets; completing a set grants a
 * permanent global income multiplier (product feeds globalIncomeMultiplier).
 * ========================================================================= */

const ASSETS_CFG = {
  ESTATE_SELL_FEE: 0.03,  // 3% agent fee when selling a property
};

/* ---------------------------- Real estate ------------------------------- */
// Payback time (price / rent) intentionally lengthens up the tiers while
// appreciation improves — cheap tiers are income, top tiers are stores of value.

const ESTATE_DEFS = [
  { id: 'apartment',  name: 'City Apartment',      icon: '🏢', tier: 1,
    price: 75000,     rentPerSec: 30,    apprPerDay: 0.02 },
  { id: 'villa',      name: 'Beach Villa',         icon: '🏖️', tier: 2,
    price: 400000,    rentPerSec: 130,   apprPerDay: 0.025 },
  { id: 'mansion',    name: 'Hillside Mansion',    icon: '🏰', tier: 3,
    price: 2500000,   rentPerSec: 650,   apprPerDay: 0.03 },
  { id: 'commercial', name: 'Commercial Tower',    icon: '🏬', tier: 4,
    price: 15000000,  rentPerSec: 3200,  apprPerDay: 0.035 },
  { id: 'estate',     name: 'Country Estate',      icon: '🏞️', tier: 5,
    price: 100000000, rentPerSec: 17000, apprPerDay: 0.04 },
];

/* ------------------------------ Luxury ---------------------------------- */
// Sets: complete every item in a set → permanent income bonus. `hue` colours
// the placeholder cards until real images are dropped in.

const LUXURY_SETS = [
  { id: 'starter_cars', name: 'Starter Garage', icon: '🚗', bonus: 1.02, hue: 210 },
  { id: 'sports_cars',  name: 'Sports Cars',    icon: '🏎️', bonus: 1.03, hue: 0 },
  { id: 'classic_cars', name: 'Classics & Retro', icon: '🕰️', bonus: 1.04, hue: 30 },
  { id: 'supercars',    name: 'Supercars',      icon: '💨', bonus: 1.05, hue: 275 },
  { id: 'hypercars',    name: 'Hypercars',      icon: '🚀', bonus: 1.08, hue: 320 },
  { id: 'helicopters',  name: 'Helicopters',    icon: '🚁', bonus: 1.04, hue: 180 },
  { id: 'boats',        name: 'Boats & Yachts', icon: '🛥️', bonus: 1.05, hue: 200 },
  { id: 'jets',         name: 'Private Jets',   icon: '✈️', bonus: 1.08, hue: 240 },
  { id: 'jewellery',    name: 'Jewellery',      icon: '💎', bonus: 1.06, hue: 45 },
];

const LUXURY_DEFS = [
  // Starter Garage
  { id: 'rusty_hatch',   name: 'Rusty Hatchback',  set: 'starter_cars', price: 20000 },
  { id: 'city_compact',  name: 'City Compact',     set: 'starter_cars', price: 35000 },
  { id: 'family_sedan',  name: 'Family Sedan',     set: 'starter_cars', price: 60000 },
  // Sports Cars
  { id: 'nightfire_gt',  name: 'Nightfire GT',     set: 'sports_cars', price: 300000 },
  { id: 'aero_coupe',    name: 'Aero Coupé',       set: 'sports_cars', price: 500000 },
  { id: 'track_demon',   name: 'Track Demon',      set: 'sports_cars', price: 800000 },
  // Classics & Retro
  { id: 'bellair_57',    name: "'57 Bellair",      set: 'classic_cars', price: 2000000 },
  { id: 'stingaray_67',  name: "'67 Stingaray",    set: 'classic_cars', price: 8000000 },
  { id: 'gt250_62',      name: "'62 GT-250",       set: 'classic_cars', price: 20000000 },
  // Supercars
  { id: 'bullissimo',    name: 'Bullissimo V10',   set: 'supercars', price: 5000000 },
  { id: 'vortex_v12',    name: 'Vortex V12',       set: 'supercars', price: 9000000 },
  { id: 'phantom_rs',    name: 'Phantom RS',       set: 'supercars', price: 15000000 },
  // Hypercars
  { id: 'chiroon',       name: 'Chiroon SS',       set: 'hypercars', price: 80000000 },
  { id: 'valkyra',       name: 'Valkyra AMR',      set: 'hypercars', price: 150000000 },
  { id: 'nevera_x',      name: 'Nevera X',         set: 'hypercars', price: 250000000 },
  // Helicopters
  { id: 'exec_heli',     name: 'Executive Heli',   set: 'helicopters', price: 150000000 },
  { id: 'twin_turbine',  name: 'Twin-Turbine',     set: 'helicopters', price: 400000000 },
  // Boats & Yachts
  { id: 'speedboat',     name: 'Speedboat',        set: 'boats', price: 50000000 },
  { id: 'sport_yacht',   name: 'Sport Yacht',      set: 'boats', price: 400000000 },
  { id: 'mega_yacht',    name: 'Mega Yacht',       set: 'boats', price: 1500000000 },
  // Private Jets
  { id: 'light_jet',     name: 'Light Jet',        set: 'jets', price: 500000000 },
  { id: 'gulfstrom_g8',  name: 'Gulfstrom G8',     set: 'jets', price: 2000000000 },
  // Jewellery
  { id: 'gold_watch',    name: 'Gold Rolodex',     set: 'jewellery', price: 10000000 },
  { id: 'diamond_ring',  name: 'Diamond Ring',     set: 'jewellery', price: 100000000 },
  { id: 'emerald_neck',  name: 'Emerald Necklace', set: 'jewellery', price: 800000000 },
  { id: 'crown_jewel',   name: 'The Crown Jewel',  set: 'jewellery', price: 5000000000 },
];

const ESTATE_BY_ID = ESTATE_DEFS.reduce((m, d) => { m[d.id] = d; return m; }, {});
const LUXURY_BY_ID = LUXURY_DEFS.reduce((m, d) => { m[d.id] = d; return m; }, {});
const LUXURY_SET_BY_ID = LUXURY_SETS.reduce((m, d) => { m[d.id] = d; return m; }, {});
