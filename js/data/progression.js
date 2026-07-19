/* =========================================================================
 * data/progression.js — Phase 3 DATA: titles, achievements, events, tuning
 * -------------------------------------------------------------------------
 * All progression content is data. Achievement `check` functions read the
 * live engine at runtime (they are evaluated, never stored in the save).
 * Numbers here extend GAME_PLAN.md §9 (see §9.9 Progression & Legacy).
 * ========================================================================= */

/* ---------------------------- Tuning constants --------------------------- */

const PROG = {
  // Reputation: each point = +0.5% global income. Earned from achievements
  // (per-achievement `rep`) and +10 per Legacy reset.
  REP_MULT_PER_POINT: 0.005,
  REP_PER_PRESTIGE: 10,

  // Legacy (prestige): points = floor(sqrt(runEarned / 1e7)).
  // Each point = +10% global income, forever. First point at $10M run earnings.
  LEGACY_DIVISOR: 1e7,
  LEGACY_MULT_PER_POINT: 0.10,

  // Post-prestige head start: base pocket money + cash per total legacy point.
  // Combined with KEPT player level/slots, restarts are noticeably faster.
  PRESTIGE_BASE_CASH: 4900,
  PRESTIGE_CASH_PER_POINT: 2500,

  // Player-triggered booster.
  BOOSTER: { name: 'Hustle Mode', icon: '⚡', mult: 2, secs: 120, cooldownSecs: 1800 },

  // Random events: one every 3–7 minutes of active play.
  EVENT_MIN_GAP_SEC: 180,
  EVENT_MAX_GAP_SEC: 420,
};

/* ------------------------------- Titles ---------------------------------- */
// Rank names shown on the Profile; highest entry <= player level wins.

const TITLES = [
  { minLevel: 1,  name: 'Street Vendor',    icon: '🧺' },
  { minLevel: 3,  name: 'Market Trader',    icon: '🛒' },
  { minLevel: 5,  name: 'Shop Owner',       icon: '🏪' },
  { minLevel: 7,  name: 'Entrepreneur',     icon: '💼' },
  { minLevel: 9,  name: 'Business Magnate', icon: '🏦' },
  { minLevel: 11, name: 'Tycoon',           icon: '🎩' },
  { minLevel: 13, name: 'Mogul',            icon: '🏙️' },
  { minLevel: 15, name: 'Titan',            icon: '⚡' },
  { minLevel: 18, name: 'Business Legend',  icon: '👑' },
];

/* ----------------------------- Achievements ------------------------------ */
// reward: { cash: $ } one-time payout OR { mult: x } permanent income boost.
// rep: reputation points granted on completion (feeds the rep multiplier).
// check(): true when the goal is met — evaluated live, ~every 2 seconds.

const ACHIEVEMENT_DEFS = [
  // Building the empire
  { id: 'first_business', icon: '🏁', name: 'Open For Business', desc: 'Own your first business',      rep: 2,  reward: { cash: 500 },    check: () => usedSlots() >= 1 },
  { id: 'portfolio_5',    icon: '🗂️', name: 'Diversified',        desc: 'Run 5 businesses at once',     rep: 5,  reward: { mult: 1.05 },   check: () => usedSlots() >= 5 },
  { id: 'empire_8',       icon: '🏙️', name: 'Conglomerate',       desc: 'Run 8 businesses at once',     rep: 8,  reward: { mult: 1.05 },   check: () => usedSlots() >= 8 },
  { id: 'all_11',         icon: '🌐', name: 'Monopoly Man',       desc: 'Run all 11 businesses',        rep: 15, reward: { mult: 1.10 },   check: () => usedSlots() >= 11 },

  // Wealth milestones
  { id: 'earn_100k', icon: '💵', name: 'Six Figures',      desc: 'Earn $100K lifetime',          rep: 2,  reward: { cash: 5000 },   check: () => state.totalEarned >= 1e5 },
  { id: 'earn_10m',  icon: '💰', name: 'Serious Money',    desc: 'Earn $10M lifetime',           rep: 4,  reward: { cash: 250000 }, check: () => state.totalEarned >= 1e7 },
  { id: 'earn_1b',   icon: '🤑', name: 'Billionaire Club', desc: 'Earn $1B lifetime',            rep: 8,  reward: { mult: 1.05 },   check: () => state.totalEarned >= 1e9 },
  { id: 'earn_1t',   icon: '👑', name: 'Trillion Row',     desc: 'Earn $1T lifetime',            rep: 15, reward: { mult: 1.10 },   check: () => state.totalEarned >= 1e12 },
  { id: 'rich_1m',   icon: '🏧', name: 'Liquid Million',   desc: 'Hold $1M cash at once',        rep: 3,  reward: { cash: 50000 },  check: () => state.balance >= 1e6 },

  // People
  { id: 'staff_10', icon: '👥', name: 'Job Creator',   desc: 'Employ 10 staff',              rep: 3, reward: { cash: 25000 },  check: () => BUSINESS_DEFS.reduce((n, d) => n + getBiz(d.id).staff, 0) >= 10 },
  { id: 'staff_50', icon: '🧑‍🤝‍🧑', name: 'Major Employer', desc: 'Employ 50 staff',              rep: 8, reward: { mult: 1.05 },   check: () => BUSINESS_DEFS.reduce((n, d) => n + getBiz(d.id).staff, 0) >= 50 },

  // Levels & grind
  { id: 'level_5',   icon: '📈', name: 'Rising Star',   desc: 'Reach player level 5',         rep: 3,  reward: { cash: 10000 },  check: () => playerLevel() >= 5 },
  { id: 'level_10',  icon: '🚀', name: 'Heavy Hitter',  desc: 'Reach player level 10',        rep: 8,  reward: { mult: 1.05 },   check: () => playerLevel() >= 10 },
  { id: 'level_15',  icon: '🌟', name: 'Apex',          desc: 'Reach player level 15',        rep: 15, reward: { mult: 1.10 },   check: () => playerLevel() >= 15 },
  { id: 'tap_10',    icon: '👆', name: 'Golden Finger', desc: 'Tap upgrade level 10',         rep: 4,  reward: { cash: 500000 }, check: () => state.tapLevel >= 10 },
  { id: 'taps_1000', icon: '🫰', name: 'Grinder',       desc: 'Tap 1,000 times',              rep: 2,  reward: { cash: 2500 },   check: () => (state.stats.taps || 0) >= 1000 },

  // Business depth
  { id: 'biz_50',   icon: '🏗️', name: 'Institution',  desc: 'Any business at level 50',     rep: 5,  reward: { cash: 100000 }, check: () => BUSINESS_DEFS.some((d) => getBiz(d.id).level >= 50) },
  { id: 'biz_100',  icon: '🏛️', name: 'Century Club', desc: 'Any business at level 100',    rep: 10, reward: { mult: 1.05 },   check: () => BUSINESS_DEFS.some((d) => getBiz(d.id).level >= 100) },
  { id: 'champion', icon: '🏆', name: 'Champions',    desc: 'Win a sports championship',    rep: 6,  reward: { mult: 1.05 },   check: () => (getBiz('sports').mech.wins || 0) >= 5 },

  // Legacy
  { id: 'first_legacy', icon: '♻️', name: 'New Game+',      desc: 'Complete your first Legacy reset', rep: 10, reward: { mult: 1.10 }, check: () => state.prestiges >= 1 },
  { id: 'legacy_25',    icon: '💎', name: 'Dynasty',        desc: 'Collect 25 Legacy points',         rep: 15, reward: { mult: 1.10 }, check: () => state.legacyPoints >= 25 },
];

/* ------------------------------ Random events ---------------------------- */
// kind: 'incomeMult' | 'tapMult' — timed effect; 'cash' — instant payout
// scaled by income; 'setback' — small loss, capped at a % of balance.

const EVENT_DEFS = [
  { id: 'surge',      icon: '📈', name: 'Demand Surge',       desc: 'All income ×2!',                weight: 3, kind: 'incomeMult', mult: 2, secs: 60 },
  { id: 'viral',      icon: '📱', name: 'Gone Viral',         desc: 'Tap earnings ×5!',              weight: 2, kind: 'tapMult',    mult: 5, secs: 45 },
  { id: 'windfall',   icon: '💼', name: 'Market Opportunity', desc: 'A quick flip pays off.',        weight: 2, kind: 'cash',    incomeSecs: 90,  minCash: 500 },
  { id: 'investor',   icon: '🤝', name: 'Angel Investor',     desc: 'A believer wires you funds.',   weight: 1, kind: 'cash',    incomeSecs: 180, minCash: 1500 },
  { id: 'inspection', icon: '🧾', name: 'Tax Inspection',     desc: 'A surprise audit stings.',      weight: 1, kind: 'setback', incomeSecs: 45,  maxBalanceFrac: 0.10 },
];
