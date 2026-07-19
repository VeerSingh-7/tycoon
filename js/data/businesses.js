/* =========================================================================
 * data/businesses.js — DATA-DRIVEN business definitions (all 11 businesses)
 * -------------------------------------------------------------------------
 * Adding a business = adding one object here. The engine, UI and mechanics
 * layer all read this generically.
 *
 * ECONOMY (see GAME_PLAN.md §9 — the Economy Bible):
 *   - Level cost:        baseCost * 1.15 ^ currentLevel   (deep, endless levels)
 *   - Income (gross):    baseIncome * level * 2^(milestones) * upgrades * mechanic
 *   - Milestones:        output x2 at levels 25, 50, 100, 200, 300, ...
 *   - Named upgrades:    3 per business at levels 10 / 40 / 75,
 *                        multipliers x2 / x3 / x5, costs 50x / 1,200x / 25,000x base
 *   - unlockLevel:       PLAYER level required before this business can be started
 *
 * `mechanic.type` selects a handler in js/mechanics.js. Config lives here so
 * tuning never touches code.
 * ========================================================================= */

const BUSINESS_DEFS = [
  /* ------------------------- STARTER TIER ------------------------- */
  {
    id: 'retail',
    name: 'Retail Store',
    icon: '🛍️',
    blurb: 'Corner shop cashflow. Restock, sell, repeat.',
    unlockLevel: 1,
    baseCost: 4900,
    costMultiplier: 1.15,
    baseIncome: 8,
    mechanic: null, // starter businesses are pure passive (mechanics from tier 2 up)
    upgrades: [
      { id: 'retail_signage', name: 'Neon Signage',    desc: 'Foot traffic ×2 income',  requiresLevel: 10, cost: 245000,     multiplier: 2 },
      { id: 'retail_loyalty', name: 'Loyalty Program', desc: 'Repeat buyers ×3 income', requiresLevel: 40, cost: 5880000,    multiplier: 3 },
      { id: 'retail_chain',   name: 'Franchise Chain', desc: 'Go national ×5 income',   requiresLevel: 75, cost: 122500000,  multiplier: 5 },
    ],
  },
  {
    id: 'taxi',
    name: 'Taxi Company',
    icon: '🚕',
    blurb: 'A growing fleet. More cars, more fares.',
    unlockLevel: 2,
    baseCost: 10000,
    costMultiplier: 1.15,
    baseIncome: 14,
    mechanic: null,
    upgrades: [
      { id: 'taxi_dispatch', name: 'Smart Dispatch', desc: 'Cut idle time ×2 income',   requiresLevel: 10, cost: 500000,     multiplier: 2 },
      { id: 'taxi_app',      name: 'Ride-Hail App',  desc: 'Book anywhere ×3 income',   requiresLevel: 40, cost: 12000000,   multiplier: 3 },
      { id: 'taxi_ev',       name: 'EV Fleet',       desc: 'Slash fuel costs ×5 income', requiresLevel: 75, cost: 250000000, multiplier: 5 },
    ],
  },
  {
    id: 'restaurant',
    name: 'Restaurant',
    icon: '🍽️',
    blurb: 'Tables, covers, and a rising star rating.',
    unlockLevel: 3,
    baseCost: 20000,
    costMultiplier: 1.15,
    baseIncome: 24,
    mechanic: null,
    upgrades: [
      { id: 'rest_menu',      name: 'Signature Menu',   desc: 'Higher margins ×2 income', requiresLevel: 10, cost: 1000000,   multiplier: 2 },
      { id: 'rest_star',      name: 'Celebrity Chef',   desc: 'Michelin buzz ×3 income',  requiresLevel: 40, cost: 24000000,  multiplier: 3 },
      { id: 'rest_franchise', name: 'Restaurant Group', desc: 'Multiple venues ×5 income', requiresLevel: 75, cost: 500000000, multiplier: 5 },
    ],
  },

  /* ------------------------- MID TIER (Phase 2) ------------------------- */
  {
    id: 'clothing',
    name: 'Clothing Business',
    icon: '👗',
    blurb: 'Fashion lines that live or die by the trend.',
    unlockLevel: 4,
    baseCost: 25000,
    costMultiplier: 1.15,
    baseIncome: 28,
    // Fashion trends rotate; match the current trend for x2, miss for x0.75.
    mechanic: { type: 'trends', matchMult: 2, missMult: 0.75, periodMin: 3 },
    upgrades: [
      { id: 'cloth_design', name: 'In-House Designers', desc: 'Own the runway ×2 income', requiresLevel: 10, cost: 1250000,   multiplier: 2 },
      { id: 'cloth_brand',  name: 'Luxury Label',       desc: 'Brand premium ×3 income',  requiresLevel: 40, cost: 30000000,  multiplier: 3 },
      { id: 'cloth_global', name: 'Global Fashion House', desc: 'Every capital ×5 income', requiresLevel: 75, cost: 625000000, multiplier: 5 },
    ],
  },
  {
    id: 'transport',
    name: 'Transportation Co.',
    icon: '🚚',
    blurb: 'Freight routes. Fuel prices bite into margins.',
    unlockLevel: 5,
    baseCost: 35000,
    costMultiplier: 1.15,
    baseIncome: 35,
    // Pick a route (longer = better multiplier, gated by business level);
    // fuel factor moves inversely to the oil price.
    mechanic: {
      type: 'routes',
      routes: [
        { name: 'Local',            mult: 1.0, requiresLevel: 1 },
        { name: 'Regional',         mult: 1.4, requiresLevel: 15 },
        { name: 'Intercontinental', mult: 2.0, requiresLevel: 40 },
      ],
    },
    upgrades: [
      { id: 'trans_hub',   name: 'Logistics Hub',   desc: 'Central depot ×2 income',   requiresLevel: 10, cost: 1750000,   multiplier: 2 },
      { id: 'trans_rail',  name: 'Rail Contracts',  desc: 'Bulk freight ×3 income',    requiresLevel: 40, cost: 42000000,  multiplier: 3 },
      { id: 'trans_ships', name: 'Container Ships', desc: 'Own the seas ×5 income',    requiresLevel: 75, cost: 875000000, multiplier: 5 },
    ],
  },
  {
    id: 'construction',
    name: 'Construction Co.',
    icon: '🏗️',
    blurb: 'Buy materials, build, deliver for a lump sum.',
    unlockLevel: 6,
    baseCost: 40000,
    costMultiplier: 1.15,
    baseIncome: 38,
    // Buy materials -> build timer -> deliver for materials x payoutMult.
    mechanic: { type: 'construction', buildMin: 8, materialsSecs: 150, payoutMult: 2.5 },
    upgrades: [
      { id: 'constr_crane', name: 'Tower Cranes',     desc: 'Bigger jobs ×2 income',    requiresLevel: 10, cost: 2000000,    multiplier: 2 },
      { id: 'constr_pre',   name: 'Prefab Factory',   desc: 'Faster builds ×3 income',  requiresLevel: 40, cost: 48000000,   multiplier: 3 },
      { id: 'constr_mega',  name: 'Megaprojects',     desc: 'Skylines ×5 income',       requiresLevel: 75, cost: 1000000000, multiplier: 5 },
    ],
  },
  {
    id: 'bank',
    name: 'Bank',
    icon: '🏦',
    blurb: 'Deposits earn interest and grow your bank.',
    unlockLevel: 7,
    baseCost: 200000,
    costMultiplier: 1.15,
    baseIncome: 130,
    // Deposit cash into the vault: it earns interest AND boosts bank income
    // (up to x2 when the vault reaches vaultTargetX x baseCost).
    mechanic: { type: 'interest', ratePerHour: 0.10, vaultTargetX: 20 },
    upgrades: [
      { id: 'bank_branch', name: 'Branch Network',   desc: 'High street ×2 income',   requiresLevel: 10, cost: 10000000,   multiplier: 2 },
      { id: 'bank_invest', name: 'Investment Arm',   desc: 'Big clients ×3 income',   requiresLevel: 40, cost: 240000000,  multiplier: 3 },
      { id: 'bank_global', name: 'Global Bank',      desc: 'World finance ×5 income', requiresLevel: 75, cost: 5000000000, multiplier: 5 },
    ],
  },
  {
    id: 'oil',
    name: 'Oil & Gas',
    icon: '🛢️',
    blurb: 'Pumping crude. Income rides the oil price.',
    unlockLevel: 8,
    baseCost: 1000000,
    costMultiplier: 1.15,
    baseIncome: 500,
    // Income multiplier == live oil price factor (deterministic market cycle).
    mechanic: { type: 'commodity' },
    upgrades: [
      { id: 'oil_rigs',    name: 'Offshore Rigs',  desc: 'Deep water ×2 income',   requiresLevel: 10, cost: 50000000,    multiplier: 2 },
      { id: 'oil_refine',  name: 'Refineries',     desc: 'Refined margin ×3 income', requiresLevel: 40, cost: 1200000000, multiplier: 3 },
      { id: 'oil_cartel',  name: 'Energy Empire',  desc: 'Price maker ×5 income',  requiresLevel: 75, cost: 25000000000, multiplier: 5 },
    ],
  },
  {
    id: 'it',
    name: 'IT Company',
    icon: '💻',
    blurb: 'Ship software projects for lump-sum payouts.',
    unlockLevel: 9,
    baseCost: 5000000,
    costMultiplier: 1.15,
    baseIncome: 1900,
    // Run one project at a time; bigger projects need more staff (devs/QA)
    // and pay income/sec x duration x payout multiplier on delivery.
    mechanic: {
      type: 'projects',
      projects: [
        { id: 'sprint',   name: 'App Sprint',   mins: 3,  payoutMult: 1.0, staffNeeded: 0 },
        { id: 'product',  name: 'SaaS Product', mins: 15, payoutMult: 1.3, staffNeeded: 3 },
        { id: 'platform', name: 'Platform',     mins: 60, payoutMult: 1.8, staffNeeded: 6 },
      ],
    },
    upgrades: [
      { id: 'it_cloud', name: 'Cloud Division', desc: 'Recurring revenue ×2 income', requiresLevel: 10, cost: 250000000,    multiplier: 2 },
      { id: 'it_ai',    name: 'AI Lab',         desc: 'Frontier tech ×3 income',     requiresLevel: 40, cost: 6000000000,   multiplier: 3 },
      { id: 'it_uni',   name: 'Tech Unicorn',   desc: 'IPO glory ×5 income',         requiresLevel: 75, cost: 125000000000, multiplier: 5 },
    ],
  },
  {
    id: 'sports',
    name: 'Sports Club',
    icon: '🏟️',
    blurb: 'Win matches, grow the fanbase, sign sponsors.',
    unlockLevel: 10,
    baseCost: 50000000,
    costMultiplier: 1.15,
    baseIncome: 14000,
    // Play matches (cooldown): wins add fans (income multiplier); every 5th
    // win is a championship that pays a sponsorship lump sum.
    mechanic: { type: 'sports', cooldownSec: 90, fansPerWin: 10, fansDivisor: 150, maxFanMult: 4, sponsorSecs: 120, winsPerChampionship: 5 },
    upgrades: [
      { id: 'sport_academy', name: 'Youth Academy',   desc: 'Homegrown stars ×2 income', requiresLevel: 10, cost: 2500000000,    multiplier: 2 },
      { id: 'sport_stadium', name: 'Super Stadium',   desc: 'Sold out ×3 income',        requiresLevel: 40, cost: 60000000000,   multiplier: 3 },
      { id: 'sport_league',  name: 'Own the League',  desc: 'Media rights ×5 income',    requiresLevel: 75, cost: 1250000000000, multiplier: 5 },
    ],
  },
  {
    id: 'airline',
    name: 'Airline',
    icon: '✈️',
    blurb: 'Open global routes. The ultimate status business.',
    unlockLevel: 11,
    baseCost: 1000000000,
    costMultiplier: 1.15,
    baseIncome: 200000,
    // Open routes for escalating costs; each adds +15% income permanently.
    // Route slots grow with business level.
    mechanic: { type: 'airline', routeBonus: 0.15, routeCostX: 0.4, routeCostGrowth: 2 },
    upgrades: [
      { id: 'air_biz',    name: 'Business Class',   desc: 'Premium cabins ×2 income', requiresLevel: 10, cost: 50000000000,    multiplier: 2 },
      { id: 'air_hub',    name: 'Alliance Hub',     desc: 'Code sharing ×3 income',   requiresLevel: 40, cost: 1200000000000,  multiplier: 3 },
      { id: 'air_flag',   name: 'Flag Carrier',     desc: 'National icon ×5 income',  requiresLevel: 75, cost: 25000000000000, multiplier: 5 },
    ],
  },
];

// Convenience lookup by id (used by engine/UI/mechanics).
const BUSINESS_BY_ID = BUSINESS_DEFS.reduce((map, b) => {
  map[b.id] = b;
  return map;
}, {});
