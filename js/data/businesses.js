/* =========================================================================
 * data/businesses.js — DATA-DRIVEN business definitions
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
 * tuning never touches code. `staffRoles` is flavor only — the hire button
 * cycles through it to show which role the next hire fills (the Business tab
 * still uses one simple staff counter per business, not a named roster).
 *
 * All 14 businesses of the overhaul are here: Space, Hotels, Energy,
 * Automotive, E-Commerce, Mining, Railway, Media & Entertainment, Game
 * Studio, Pharmaceutical, Supermarket, Entertainment Venue, Airport,
 * Logistics & Warehousing.
 * ========================================================================= */

// Up to 6 independent Supermarket Chains, unlocked one at a time (chain N+1
// only shows once chain N is actually owned — see businessCardHTML/
// lockedCardHTML in businesses.js). Each is a FULLY independent business —
// its own level, staff, upgrades, income, and dedicated BizDash page — that
// happens to share the same catalog/config as every other chain. Generated
// from one template instead of hand-duplicated 6x; chainIndex marks which
// slot a def is (1-6); js/data/properties.js registers the SAME
// BUSINESS_PROPERTIES.supermarket catalog under every chain id, so every
// chain's property browser draws from one shared catalog.
const SUPERMARKET_CHAIN_COUNT = 6;
const SUPERMARKET_CHAIN_TEMPLATE = {
  icon: '🛍️',
  blurb: 'Stores, suppliers, and private labels — grocery at scale.',
  unlockLevel: 1,
  baseCost: 4900,
  costMultiplier: 1.15,
  baseIncome: 8,
  // Negotiate supplier deals: better terms unlock as the chain grows.
  mechanic: {
    type: 'tierPick',
    icon: '🛍️',
    label: 'Supplier Deals',
    tiers: [
      { name: 'Local Suppliers',        mult: 1.0, requiresLevel: 1 },
      { name: 'Regional Contracts',     mult: 1.4, requiresLevel: 15 },
      { name: 'National Buying Power',  mult: 2.0, requiresLevel: 40 },
    ],
  },
  staffRoles: ['Cashier', 'Stock Worker', 'Store Manager', 'Buyer', 'Warehouse Worker', 'Delivery Driver', 'Regional Manager'],
  upgrades: [
    { id: 'super_selfcheck', name: 'Self-Checkout', desc: 'Serve more shoppers ×2 income', requiresLevel: 10, cost: 245000,     multiplier: 2 },
    { id: 'super_label',     name: 'Private Label',  desc: 'Higher margins ×3 income',    requiresLevel: 40, cost: 5880000,    multiplier: 3 },
    { id: 'super_chain',     name: 'National Chain',  desc: 'Stores everywhere ×5 income', requiresLevel: 75, cost: 122500000,  multiplier: 5 },
  ],
};
const SUPERMARKET_CHAIN_DEFS = Array.from({ length: SUPERMARKET_CHAIN_COUNT }, (_, i) => ({
  ...SUPERMARKET_CHAIN_TEMPLATE,
  id: 'supermarket_' + (i + 1),
  name: 'Supermarket Chain ' + (i + 1),
  chainIndex: i + 1,
}));

const BUSINESS_DEFS = [
  ...SUPERMARKET_CHAIN_DEFS,
  {
    id: 'entvenue',
    name: 'Entertainment Venue Company',
    icon: '🎡',
    blurb: 'Cinemas, bowling, arcades and theme parks — a night out.',
    unlockLevel: 3,
    baseCost: 20000,
    costMultiplier: 1.15,
    baseIncome: 24,
    mechanic: {
      type: 'tierPick',
      icon: '🎡',
      label: 'Venue Type',
      tiers: [
        { name: 'Arcade',            mult: 1.0, requiresLevel: 1 },
        { name: 'Bowling & Cinema',  mult: 1.4, requiresLevel: 15 },
        { name: 'Theme Park',        mult: 2.0, requiresLevel: 40 },
      ],
    },
    staffRoles: ['Venue Manager', 'Event Manager', 'Technician', 'Security Worker', 'Ticket Staff', 'Maintenance Worker', 'Marketing Manager'],
    upgrades: [
      { id: 'venue_vip',   name: 'VIP Lounges',    desc: 'Premium tickets ×2 income', requiresLevel: 10, cost: 1000000,   multiplier: 2 },
      { id: 'venue_events', name: 'Live Events',    desc: 'Concerts & shows ×3 income', requiresLevel: 40, cost: 24000000,  multiplier: 3 },
      { id: 'venue_chain', name: 'Venue Chain',     desc: 'Every city ×5 income',      requiresLevel: 75, cost: 500000000, multiplier: 5 },
    ],
  },
  {
    id: 'logistics',
    name: 'Logistics & Warehousing',
    icon: '📦',
    blurb: 'Warehouses, distribution centres, and fulfilment for others.',
    unlockLevel: 8,
    baseCost: 900000,
    costMultiplier: 1.15,
    baseIncome: 400,
    // Open distribution centres: each one adds permanent income.
    mechanic: { type: 'expansion', icon: '📦', noun: 'Distribution Center', bonusPerNode: 0.09, costX: 0.35, costGrowth: 1.55, perLevels: 9 },
    staffRoles: ['Warehouse Worker', 'Logistics Manager', 'Supply Chain Manager', 'Forklift Operator', 'Inventory Analyst', 'Operations Manager', 'Delivery Coordinator'],
    upgrades: [
      { id: 'logi_auto',   name: 'Automated Sorting', desc: 'Robotic warehouses ×2 income', requiresLevel: 10, cost: 45000000,    multiplier: 2 },
      { id: 'logi_fleet',  name: 'Owned Fleet',       desc: 'Cut carrier fees ×3 income',   requiresLevel: 40, cost: 1080000000,  multiplier: 3 },
      { id: 'logi_global', name: 'Global Network',    desc: 'International reach ×5 income', requiresLevel: 75, cost: 22500000000, multiplier: 5 },
    ],
  },
  {
    id: 'pharma',
    name: 'Pharmaceutical Company',
    icon: '💊',
    blurb: 'Research, test, and manufacture treatments. Trials can fail.',
    unlockLevel: 12,
    baseCost: 320000000,
    costMultiplier: 1.15,
    baseIncome: 95000,
    // Run one R&D pipeline at a time; bigger treatments pay more but pass
    // trials less often — a failed trial still recovers partial R&D value.
    mechanic: {
      type: 'riskProject',
      label: 'R&D Pipeline',
      failPayoutFrac: 0.40,
      projects: [
        { id: 'generic',      name: 'Generic Drug',        mins: 6,  payoutMult: 1.1, staffNeeded: 0, requiresLevel: 1,  baseChance: 0.65 },
        { id: 'branded',      name: 'Branded Treatment',   mins: 25, payoutMult: 1.6, staffNeeded: 3, requiresLevel: 15, baseChance: 0.50 },
        { id: 'breakthrough', name: 'Breakthrough Therapy', mins: 90, payoutMult: 2.4, staffNeeded: 6, requiresLevel: 40, baseChance: 0.35 },
      ],
    },
    staffRoles: ['Pharmacologist', 'Chemist', 'Biologist', 'Research Scientist', 'Laboratory Technician', 'Manufacturing Manager', 'Regulatory Specialist'],
    upgrades: [
      { id: 'pharma_lab',    name: 'Research Wing',    desc: 'Faster trials ×2 income',    requiresLevel: 10, cost: 16000000000,   multiplier: 2 },
      { id: 'pharma_patent', name: 'Patent Portfolio', desc: 'Protected margins ×3 income', requiresLevel: 40, cost: 384000000000,  multiplier: 3 },
      { id: 'pharma_global', name: 'Global Distribution', desc: 'Every pharmacy ×5 income', requiresLevel: 75, cost: 8000000000000, multiplier: 5 },
    ],
  },
  {
    id: 'airport',
    name: 'Airport Company',
    icon: '✈️',
    blurb: 'Runways, terminals, and gates leased out to airlines.',
    unlockLevel: 13,
    baseCost: 1300000000,
    costMultiplier: 1.15,
    baseIncome: 320000,
    // Open gates: each one adds permanent income (lease revenue).
    mechanic: { type: 'expansion', icon: '✈️', noun: 'Gate', bonusPerNode: 0.12, costX: 0.3, costGrowth: 1.7, perLevels: 10 },
    staffRoles: ['Airport Manager', 'Air Traffic Controller', 'Security Officer', 'Engineer', 'Ground Crew', 'Customer Service Worker', 'Operations Manager'],
    upgrades: [
      { id: 'air_terminal', name: 'New Terminal',    desc: 'More passengers ×2 income', requiresLevel: 10, cost: 65000000000,    multiplier: 2 },
      { id: 'air_cargo',    name: 'Cargo Hub',       desc: 'Freight revenue ×3 income', requiresLevel: 40, cost: 1560000000000,  multiplier: 3 },
      { id: 'air_hub_intl', name: 'International Hub', desc: 'Global connections ×5 income', requiresLevel: 75, cost: 32500000000000, multiplier: 5 },
    ],
  },
  {
    id: 'ecommerce',
    name: 'E-Commerce Company',
    icon: '🛒',
    blurb: 'Run an online marketplace — sellers, warehouses, delivery.',
    unlockLevel: 2,
    baseCost: 10000,
    costMultiplier: 1.15,
    baseIncome: 14,
    // Recruit sellers onto the platform: each one adds permanent income.
    mechanic: { type: 'expansion', icon: '🛍️', noun: 'Seller', bonusPerNode: 0.08, costX: 0.4, costGrowth: 1.5, perLevels: 8 },
    staffRoles: ['Software Engineer', 'Warehouse Worker', 'Logistics Manager', 'Customer Support', 'Product Manager', 'Marketing Manager', 'Data Analyst'],
    upgrades: [
      { id: 'ecom_app',    name: 'Mobile App',        desc: 'Shop anywhere ×2 income',   requiresLevel: 10, cost: 500000,     multiplier: 2 },
      { id: 'ecom_prime',  name: 'Fast Delivery Tier', desc: 'Subscriptions ×3 income',  requiresLevel: 40, cost: 12000000,   multiplier: 3 },
      { id: 'ecom_global', name: 'Global Marketplace', desc: 'Every country ×5 income',  requiresLevel: 75, cost: 250000000,  multiplier: 5 },
    ],
  },
  {
    id: 'mining',
    name: 'Mining Company',
    icon: '⛏️',
    blurb: 'Explore for deposits, then dig. Not every site strikes gold.',
    unlockLevel: 4,
    baseCost: 30000,
    costMultiplier: 1.15,
    baseIncome: 32,
    // Explore for a new mine site — costs money either way, but a successful
    // strike (odds improve with level/staff) adds permanent income.
    mechanic: { type: 'riskyExpansion', icon: '⛏️', noun: 'Mine', bonusPerNode: 0.10, exploreCostX: 0.3, exploreCostGrowth: 1.4, perLevels: 8, baseChance: 0.5, chancePerLevel: 0.004, chancePerStaff: 0.02, maxChance: 0.85 },
    staffRoles: ['Geologist', 'Mining Engineer', 'Machine Operator', 'Safety Officer', 'Surveyor', 'Site Manager', 'Environmental Specialist'],
    upgrades: [
      { id: 'mine_equip',  name: 'Heavy Equipment', desc: 'Dig deeper ×2 income',      requiresLevel: 10, cost: 1500000,    multiplier: 2 },
      { id: 'mine_refine', name: 'Refining Plant',  desc: 'Process on-site ×3 income', requiresLevel: 40, cost: 36000000,   multiplier: 3 },
      { id: 'mine_global', name: 'Global Operations', desc: 'Mines on every continent ×5 income', requiresLevel: 75, cost: 750000000, multiplier: 5 },
    ],
  },
  {
    id: 'railway',
    name: 'Railway Company',
    icon: '🚆',
    blurb: 'Passenger and freight routes, station by station.',
    unlockLevel: 7,
    baseCost: 300000,
    costMultiplier: 1.15,
    baseIncome: 160,
    // Build a route between stations: each one adds permanent income.
    mechanic: { type: 'expansion', icon: '🚆', noun: 'Route', bonusPerNode: 0.10, costX: 0.35, costGrowth: 1.6, perLevels: 10 },
    staffRoles: ['Train Driver', 'Conductor', 'Engineer', 'Station Manager', 'Track Worker', 'Maintenance Technician', 'Operations Manager'],
    upgrades: [
      { id: 'rail_electric', name: 'Electrification', desc: 'Faster trains ×2 income', requiresLevel: 10, cost: 15000000,   multiplier: 2 },
      { id: 'rail_highspeed', name: 'High-Speed Line', desc: 'Premium tickets ×3 income', requiresLevel: 40, cost: 360000000, multiplier: 3 },
      { id: 'rail_national', name: 'National Network', desc: 'Every major city ×5 income', requiresLevel: 75, cost: 7500000000, multiplier: 5 },
    ],
  },
  {
    id: 'media',
    name: 'Media & Entertainment',
    icon: '🎬',
    blurb: 'Greenlight films, shows and music. Reviews decide the payout.',
    unlockLevel: 10,
    baseCost: 16000000,
    costMultiplier: 1.15,
    baseIncome: 6200,
    // Produce one title at a time; bigger productions need more staff and
    // level, and pay income/sec x duration x payout multiplier on release.
    mechanic: {
      type: 'projectRun',
      label: 'Productions',
      projects: [
        { id: 'indie',       name: 'Indie Film',    mins: 5,  payoutMult: 1.0,  staffNeeded: 0, requiresLevel: 1 },
        { id: 'series',      name: 'TV Series',     mins: 20, payoutMult: 1.35, staffNeeded: 3, requiresLevel: 15 },
        { id: 'blockbuster', name: 'Blockbuster',   mins: 75, payoutMult: 1.9,  staffNeeded: 6, requiresLevel: 40 },
      ],
    },
    staffRoles: ['Producer', 'Director', 'Writer', 'Editor', 'Actor', 'Music Producer', 'Marketing Manager', 'Talent Manager'],
    upgrades: [
      { id: 'media_studio',   name: 'Production Studio',   desc: 'In-house crews ×2 income', requiresLevel: 10, cost: 800000000,    multiplier: 2 },
      { id: 'media_stream',   name: 'Streaming Platform',  desc: 'Direct to fans ×3 income', requiresLevel: 40, cost: 19200000000,  multiplier: 3 },
      { id: 'media_studio_giant', name: 'Global Media Empire', desc: 'Own the box office ×5 income', requiresLevel: 75, cost: 400000000000, multiplier: 5 },
    ],
  },
  {
    id: 'gamestudio',
    name: 'Game Studio',
    icon: '🎮',
    blurb: 'Build games across genres and platforms. Ship, review, repeat.',
    unlockLevel: 11,
    baseCost: 65000000,
    costMultiplier: 1.15,
    baseIncome: 23000,
    mechanic: {
      type: 'projectRun',
      label: 'Game Development',
      projects: [
        { id: 'mobile', name: 'Mobile Game', mins: 4,  payoutMult: 1.0,  staffNeeded: 0, requiresLevel: 1 },
        { id: 'indie',  name: 'Indie Title',  mins: 18, payoutMult: 1.3,  staffNeeded: 3, requiresLevel: 15 },
        { id: 'aaa',    name: 'AAA Title',    mins: 70, payoutMult: 1.85, staffNeeded: 6, requiresLevel: 40 },
      ],
    },
    staffRoles: ['Game Developer', 'Game Designer', 'Artist', 'Animator', 'Writer', 'Sound Designer', 'Producer', 'QA Tester'],
    upgrades: [
      { id: 'game_engine',  name: 'Custom Engine',    desc: 'Faster shipping ×2 income', requiresLevel: 10, cost: 3250000000,   multiplier: 2 },
      { id: 'game_live',    name: 'Live-Service Ops', desc: 'Recurring players ×3 income', requiresLevel: 40, cost: 78000000000,  multiplier: 3 },
      { id: 'game_franchise', name: 'Flagship Franchise', desc: 'Sequels sell themselves ×5 income', requiresLevel: 75, cost: 1625000000000, multiplier: 5 },
    ],
  },
  {
    id: 'automotive',
    name: 'Automotive Company',
    icon: '🚗',
    blurb: 'Design, build, and sell cars through your own dealerships.',
    unlockLevel: 5,
    baseCost: 45000,
    costMultiplier: 1.15,
    baseIncome: 42,
    // Develop one vehicle model at a time; bigger models need more staff
    // and level, and pay income/sec x duration x payout multiplier on launch.
    mechanic: {
      type: 'projectRun',
      label: 'Vehicle Development',
      projects: [
        { id: 'compact', name: 'Compact Car',       mins: 3,  payoutMult: 1.0, staffNeeded: 0, requiresLevel: 1 },
        { id: 'suv',     name: 'SUV Lineup',         mins: 15, payoutMult: 1.3, staffNeeded: 3, requiresLevel: 15 },
        { id: 'ev',      name: 'Electric Vehicle',   mins: 60, payoutMult: 1.8, staffNeeded: 6, requiresLevel: 40 },
      ],
    },
    staffRoles: ['Automotive Engineer', 'Designer', 'Mechanic', 'Factory Worker', 'Production Manager', 'Software Engineer', 'Sales Manager'],
    upgrades: [
      { id: 'auto_robots',  name: 'Robotic Assembly', desc: 'Faster factories ×2 income', requiresLevel: 10, cost: 2250000,   multiplier: 2 },
      { id: 'auto_battery', name: 'Battery R&D',      desc: 'EV breakthroughs ×3 income', requiresLevel: 40, cost: 54000000,  multiplier: 3 },
      { id: 'auto_global',  name: 'Global Dealer Network', desc: 'Showrooms everywhere ×5 income', requiresLevel: 75, cost: 1125000000, multiplier: 5 },
    ],
  },
  {
    id: 'hotels',
    name: 'Hotels & Resorts',
    icon: '🏨',
    blurb: 'Rooms, restaurants, and events — hospitality at scale.',
    unlockLevel: 6,
    baseCost: 65000,
    costMultiplier: 1.15,
    baseIncome: 58,
    // Pick a room tier (guaranteed pricing/quality multiplier) and host
    // events on cooldown for a guaranteed lump-sum booking payout.
    mechanic: {
      type: 'hospitality',
      roomTiers: [
        { name: 'Budget Rooms',   mult: 1.0, requiresLevel: 1 },
        { name: 'Business Class', mult: 1.4, requiresLevel: 15 },
        { name: 'Luxury Resort',  mult: 2.0, requiresLevel: 40 },
      ],
      eventCooldownSec: 150,
      eventPayoutSecs: 200,
    },
    staffRoles: ['Hotel Manager', 'Receptionist', 'Chef', 'Housekeeper', 'Concierge', 'Maintenance Worker', 'Marketing Manager', 'Event Manager'],
    upgrades: [
      { id: 'hotel_spa',   name: 'Spa & Pool Deck', desc: 'Guests stay longer ×2 income', requiresLevel: 10, cost: 3250000,    multiplier: 2 },
      { id: 'hotel_brand', name: 'Signature Brand', desc: 'Premium bookings ×3 income',   requiresLevel: 40, cost: 78000000,   multiplier: 3 },
      { id: 'hotel_group', name: 'Global Resort Group', desc: 'Destinations worldwide ×5 income', requiresLevel: 75, cost: 1625000000, multiplier: 5 },
    ],
  },
  {
    id: 'energy',
    name: 'Energy Company',
    icon: '⚡',
    blurb: 'Generate and sell power. Choose your source, manage the risk.',
    unlockLevel: 9,
    baseCost: 3500000,
    costMultiplier: 1.15,
    baseIncome: 1500,
    // Pick a generation source. Gas is cheap to unlock but its own fuel
    // index wobbles income up/down; renewables and nuclear are steadier
    // and pay more once unlocked.
    mechanic: {
      type: 'tierPick',
      icon: '⚡',
      label: 'Generation Source',
      tiers: [
        { name: 'Natural Gas',  mult: 1.0,  requiresLevel: 1,  volatile: true },
        { name: 'Wind Power',   mult: 1.35, requiresLevel: 15 },
        { name: 'Solar Farms',  mult: 1.7,  requiresLevel: 40 },
        { name: 'Nuclear Plant', mult: 2.3, requiresLevel: 75 },
      ],
    },
    staffRoles: ['Electrical Engineer', 'Energy Scientist', 'Plant Manager', 'Technician', 'Maintenance Worker', 'Energy Trader', 'Safety Manager'],
    upgrades: [
      { id: 'energy_grid',    name: 'Smart Grid',       desc: 'Less waste ×2 income',       requiresLevel: 10, cost: 175000000,   multiplier: 2 },
      { id: 'energy_storage', name: 'Battery Storage',  desc: 'Sell around the clock ×3 income', requiresLevel: 40, cost: 4200000000, multiplier: 3 },
      { id: 'energy_national', name: 'National Grid Operator', desc: 'Power the country ×5 income', requiresLevel: 75, cost: 87500000000, multiplier: 5 },
    ],
  },
  {
    id: 'space',
    name: 'Space Company',
    icon: '🚀',
    blurb: 'From launch contracts to Mars — build a space corporation.',
    unlockLevel: 14,
    baseCost: 6000000000,
    costMultiplier: 1.15,
    baseIncome: 1300000,
    // Plan a mission (rocket/payload tier), let it fly, then resolve it:
    // bigger missions pay more but succeed less often against the competition.
    mechanic: {
      type: 'riskProject',
      label: 'Mission Planning',
      failPayoutFrac: 0.35,
      projects: [
        { id: 'satlaunch', name: 'Satellite Launch',   mins: 8,   payoutMult: 1.2, staffNeeded: 0, requiresLevel: 1,  baseChance: 0.70 },
        { id: 'cargo',     name: 'Cargo Resupply',     mins: 25,  payoutMult: 1.6, staffNeeded: 3, requiresLevel: 15, baseChance: 0.55 },
        { id: 'lunar',     name: 'Lunar Mission',      mins: 60,  payoutMult: 2.2, staffNeeded: 6, requiresLevel: 40, baseChance: 0.40 },
        { id: 'mars',      name: 'Mars Expedition',    mins: 120, payoutMult: 3.2, staffNeeded: 9, requiresLevel: 75, baseChance: 0.30 },
      ],
    },
    staffRoles: ['Aerospace Engineer', 'Mission Controller', 'Astronaut', 'Space Scientist', 'Launch Technician', 'Mission Planner', 'Safety Officer'],
    upgrades: [
      { id: 'space_reuse',   name: 'Reusable Rockets',    desc: 'Cut launch costs ×2 income',  requiresLevel: 10, cost: 300000000000,    multiplier: 2 },
      { id: 'space_station', name: 'Orbital Space Station', desc: 'Research & tourism ×3 income', requiresLevel: 40, cost: 7200000000000,  multiplier: 3 },
      { id: 'space_colony',  name: 'Interplanetary Corporation', desc: 'Moon & Mars resources ×5 income', requiresLevel: 75, cost: 150000000000000, multiplier: 5 },
    ],
  },
];

// Convenience lookup by id (used by engine/UI/mechanics).
const BUSINESS_BY_ID = BUSINESS_DEFS.reduce((map, b) => {
  map[b.id] = b;
  return map;
}, {});
