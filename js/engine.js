/* =========================================================================
 * engine.js — Economy formulas + game tick loop
 * -------------------------------------------------------------------------
 * All constants live at the top and mirror GAME_PLAN.md §9 (the Economy
 * Bible). Everything reads generically from BUSINESS_DEFS + state, so new
 * content is data-only.
 * ========================================================================= */

/* ------------------------ Economy constants (§9) ------------------------ */

// Tap loop: starts at $2.50/tap; first upgrade costs $1,000.
const TAP_BASE = 2.5;
const TAP_VALUE_GROWTH = 1.8;   // per-tap value x1.8 per upgrade level
const TAP_COST_BASE = 1000;
const TAP_COST_GROWTH = 3;      // upgrade cost x3 per level

// Business milestones: output doubles at these levels (then every 100).
const MILESTONE_EARLY = [25, 50];

// Employees
const STAFF_OUTPUT_BONUS = 0.06;       // each staff: +6% output
const STAFF_SALARY_RATE = 0.015;       // each staff: salary = 1.5% of linear income
const STAFF_HIRE_COST_X = 0.35;        // first hire = 35% of business base cost
const STAFF_HIRE_GROWTH = 1.35;        // each further hire x1.35
const MGMT_EFFICIENCY_PER_LEVEL = 0.25; // each management level: staff +25% effective
const MGMT_BASE_COST = 50000;
const MGMT_COST_GROWTH = 8;

// Player level: level N requires totalEarned >= 1,000 x 5^(N-2).
const XP_LEVEL_BASE = 1000;
const XP_LEVEL_GROWTH = 5;

// Business slots: 2 at level 1, +1 every 2 player levels, capped at 11.
const BASE_SLOTS = 2;
const MAX_SLOTS_CAP = 11;

// Selling a business refunds 25% of everything spent on its levels.
const SELL_REFUND_RATE = 0.25;

/* ------------------------------------------------------------------ *
 * Per-business helpers
 * ------------------------------------------------------------------ */

/** Get (or lazily create/patch) the mutable progress record for a business. */
function getBiz(id) {
  if (!state.businesses[id]) {
    state.businesses[id] = { level: 0, upgrades: {}, staff: 0, mech: {} };
  }
  const biz = state.businesses[id];
  // Patch records from older shapes so new fields always exist.
  if (biz.staff == null) biz.staff = 0;
  if (!biz.mech) biz.mech = {};
  return biz;
}

/** Cost to buy the next level of a business (level 0 -> baseCost). */
function businessNextCost(def) {
  const level = getBiz(def.id).level;
  return def.baseCost * Math.pow(def.costMultiplier, level);
}

/** Number of x2 milestones reached: levels 25, 50, then every 100. */
function milestoneCount(level) {
  let count = 0;
  for (const m of MILESTONE_EARLY) if (level >= m) count++;
  count += Math.floor(level / 100);
  return count;
}

/** The next milestone level to chase (25, 50, 100, 200, 300, ...). */
function nextMilestone(level) {
  for (const m of MILESTONE_EARLY) if (level < m) return m;
  return (Math.floor(level / 100) + 1) * 100;
}

/** Combined multiplier from purchased named upgrades. */
function businessUpgradeMultiplier(def) {
  const owned = getBiz(def.id).upgrades;
  let mult = 1;
  for (const up of def.upgrades) {
    if (owned[up.id]) mult *= up.multiplier;
  }
  return mult;
}

/** Mini-mechanic income multiplier (mechanics.js handler; 1 if none). */
function mechanicMultiplier(def) {
  if (!def.mechanic || typeof Mechanics === 'undefined') return 1;
  return Mechanics.incomeMultiplier(def);
}

/** Staff productivity boost: +6% each, improved by management levels. */
function staffBoost(def) {
  const biz = getBiz(def.id);
  const efficiency = 1 + MGMT_EFFICIENCY_PER_LEVEL * state.managementLevel;
  return 1 + biz.staff * STAFF_OUTPUT_BONUS * efficiency;
}

/** Total salaries/sec for a business (paid out of its gross income). */
function businessSalariesPerSec(def) {
  const biz = getBiz(def.id);
  return biz.staff * def.baseIncome * biz.level * STAFF_SALARY_RATE;
}

/** GROSS income/sec: base x level x milestones x upgrades x mechanic. */
function businessGrossPerSec(def) {
  const biz = getBiz(def.id);
  if (biz.level <= 0) return 0;
  return def.baseIncome * biz.level *
    Math.pow(2, milestoneCount(biz.level)) *
    businessUpgradeMultiplier(def) *
    mechanicMultiplier(def);
}

/** Phase 3 global multiplier: reputation x achievements x legacy x events. */
function globalIncomeMultiplier() {
  return typeof Progression !== 'undefined' ? Progression.globalIncomeMultiplier() : 1;
}

/** NET income/sec: (gross x staff boost - salaries) x global multiplier. */
function businessIncomePerSec(def) {
  const biz = getBiz(def.id);
  if (biz.level <= 0) return 0;
  return (businessGrossPerSec(def) * staffBoost(def) - businessSalariesPerSec(def)) *
    globalIncomeMultiplier();
}

/** Sum of net passive income/sec across ALL businesses. */
function totalBusinessIncomePerSec() {
  let total = 0;
  for (const def of BUSINESS_DEFS) {
    total += businessIncomePerSec(def);
  }
  return total;
}

/* ------------------------------------------------------------------ *
 * Player level, reputation & business slots
 * ------------------------------------------------------------------ */

/** Lifetime earnings needed to REACH player level L. */
function xpForLevel(L) {
  return L <= 1 ? 0 : XP_LEVEL_BASE * Math.pow(XP_LEVEL_GROWTH, L - 2);
}

/** Current player level, derived from lifetime earnings. */
function playerLevel() {
  let L = 1;
  while (L < 99 && state.totalEarned >= xpForLevel(L + 1)) L++;
  return L;
}

/** Progress 0..1 toward the next player level. */
function playerLevelProgress() {
  const L = playerLevel();
  const cur = xpForLevel(L);
  const next = xpForLevel(L + 1);
  return Math.min(1, (state.totalEarned - cur) / (next - cur));
}

/** How many businesses can run at once at the current player level. */
function maxSlots() {
  return Math.min(MAX_SLOTS_CAP, BASE_SLOTS + Math.floor((playerLevel() - 1) / 2));
}

/** How many businesses are currently running (level > 0). */
function usedSlots() {
  return BUSINESS_DEFS.filter((d) => getBiz(d.id).level > 0).length;
}

/** Max staff a business can employ at its current level. */
function maxStaff(def) {
  return 2 + Math.floor(getBiz(def.id).level / 5);
}

/* ------------------------------------------------------------------ *
 * Purchases
 * ------------------------------------------------------------------ */

/**
 * Buy one level of a business. Starting a business (level 0 -> 1) also
 * requires the player level unlock AND a free business slot.
 */
function buyBusinessLevel(id) {
  const def = BUSINESS_BY_ID[id];
  const biz = getBiz(id);
  if (biz.level === 0) {
    if (playerLevel() < def.unlockLevel) return false;
    if (usedSlots() >= maxSlots()) return false;
  }
  const cost = businessNextCost(def);
  if (state.balance < cost) return false;
  state.balance -= cost;
  biz.level += 1;
  saveGame();
  return true;
}

/** Buy a named milestone upgrade. */
function buyBusinessUpgrade(id, upgradeId) {
  const def = BUSINESS_BY_ID[id];
  const biz = getBiz(id);
  const up = def.upgrades.find((u) => u.id === upgradeId);
  if (!up || biz.upgrades[upgradeId]) return false;
  if (biz.level < up.requiresLevel) return false;
  if (state.balance < up.cost) return false;
  state.balance -= up.cost;
  biz.upgrades[upgradeId] = true;
  saveGame();
  return true;
}

/** Total spent on levels so far (geometric series) — basis for sell refund. */
function businessSpentOnLevels(def) {
  const L = getBiz(def.id).level;
  const g = def.costMultiplier;
  return def.baseCost * (Math.pow(g, L) - 1) / (g - 1);
}

/** Sell/close a business: frees its slot, refunds 25% of level spend. */
function sellBusiness(id) {
  const def = BUSINESS_BY_ID[id];
  const biz = getBiz(id);
  if (biz.level <= 0) return false;
  const refund = SELL_REFUND_RATE * businessSpentOnLevels(def);
  state.balance += refund;
  state.businesses[id] = { level: 0, upgrades: {}, staff: 0, mech: {} };
  saveGame();
  return true;
}

/* ------------------------------------------------------------------ *
 * Employees
 * ------------------------------------------------------------------ */

function hireCost(def) {
  const biz = getBiz(def.id);
  return def.baseCost * STAFF_HIRE_COST_X * Math.pow(STAFF_HIRE_GROWTH, biz.staff);
}

function hireStaff(id) {
  const def = BUSINESS_BY_ID[id];
  const biz = getBiz(id);
  if (biz.level <= 0 || biz.staff >= maxStaff(def)) return false;
  const cost = hireCost(def);
  if (state.balance < cost) return false;
  state.balance -= cost;
  biz.staff += 1;
  saveGame();
  return true;
}

function managementUpgradeCost() {
  return MGMT_BASE_COST * Math.pow(MGMT_COST_GROWTH, state.managementLevel);
}

/** Global management upgrade: every staff member everywhere works harder. */
function buyManagementUpgrade() {
  const cost = managementUpgradeCost();
  if (state.balance < cost) return false;
  state.balance -= cost;
  state.managementLevel += 1;
  saveGame();
  return true;
}

/* ------------------------------------------------------------------ *
 * Tap earnings — starts at $2.50; upgrades from $1,000, x3 per level
 * ------------------------------------------------------------------ */

function tapValue() {
  // Timed tap effects ("Gone Viral" event) multiply the displayed+earned value.
  const eventMult = typeof Progression !== 'undefined' ? Progression.tapMultiplier() : 1;
  return TAP_BASE * Math.pow(TAP_VALUE_GROWTH, state.tapLevel - 1) * eventMult;
}

function tapUpgradeCost() {
  return TAP_COST_BASE * Math.pow(TAP_COST_GROWTH, state.tapLevel - 1);
}

/** Perform a tap: add exact float value, track lifetime earnings + stats. */
function doTap() {
  const gain = tapValue();
  addEarnings(gain);
  state.stats.taps = (state.stats.taps || 0) + 1;
  return gain;
}

function upgradeTap() {
  const cost = tapUpgradeCost();
  if (state.balance < cost) return false;
  state.balance -= cost;
  state.tapLevel += 1;
  saveGame();
  return true;
}

/* ------------------------------------------------------------------ *
 * Tick loop
 * ------------------------------------------------------------------ */

let _lastTick = performance.now();

/**
 * Advance the economy by real elapsed time. Adds the EXACT fractional
 * income (never rounded) so $0.60/s means precisely +$0.06 per 100ms tick.
 */
function tick() {
  const now = performance.now();
  const dt = (now - _lastTick) / 1000; // seconds
  _lastTick = now;

  const income = totalBusinessIncomePerSec() * dt;
  if (income > 0) {
    addEarnings(income);
  }

  // Mechanic housekeeping (e.g. bank vault interest compounding).
  if (typeof Mechanics !== 'undefined') Mechanics.tick(dt);
  // Progression housekeeping (random events, achievement checks).
  if (typeof Progression !== 'undefined') Progression.tick();
  // Market simulation (price steps, candles, dividends).
  if (typeof Market !== 'undefined') Market.tick(dt);
}
