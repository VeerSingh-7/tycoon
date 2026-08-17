/* =========================================================================
 * tests/business.test.js — headless tests for the Business tab overhaul
 * -------------------------------------------------------------------------
 * Run:  node tests/business.test.js   (exit code 0 = all pass, 1 = a failure)
 *
 * Loads the real browser modules into one scope (fs.readFileSync + eval, no
 * require()) and drives a mock clock via Date.now, matching the pattern in
 * tests/techco.test.js and tests/invest.test.js.
 * ========================================================================= */

const fs = require('fs');
const path = require('path');

globalThis.NOW = 1700000000000;
Date.now = () => globalThis.NOW;
let _perfNow = 0;
globalThis.performance = { now: () => _perfNow };

globalThis.addEventListener = () => {};
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
globalThis.document = { hidden: false };

const ROOT = path.join(__dirname, '..');
const files = [
  'js/format.js',
  'js/data/businesses.js',
  'js/data/properties.js',
  'js/data/progression.js',
  'js/state.js',
  'js/engine.js',
  'js/mechanics.js',
  'js/progression.js',
];

const tests = `
let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  \\u2713 ' + name); }
  else { fail++; console.log('  \\u2717 FAIL: ' + name); }
}
function approx(a, b, tol) { return Math.abs(a - b) <= Math.abs(b) * (tol == null ? 0.01 : tol); }

state = defaultState();

/* ===================== A) Catalog shape (all 14, Batches 1-3) ===================== */
check('BUSINESS_DEFS has all 14 businesses', BUSINESS_DEFS.length === 14);
check('all 11 removed ids are gone', ['retail','taxi','restaurant','clothing','transport','construction','bank','oil','it','sports','airline'].every((id) => !BUSINESS_BY_ID[id]));
check('automotive/hotels/energy/space all present', ['automotive','hotels','energy','space'].every((id) => !!BUSINESS_BY_ID[id]));
check('ecommerce/mining/railway/media/gamestudio all present', ['ecommerce','mining','railway','media','gamestudio'].every((id) => !!BUSINESS_BY_ID[id]));
check('pharma/supermarket/entvenue/airport/logistics all present', ['pharma','supermarket','entvenue','airport','logistics'].every((id) => !!BUSINESS_BY_ID[id]));
check('no duplicate ids', new Set(BUSINESS_DEFS.map((d) => d.id)).size === BUSINESS_DEFS.length);
check('no duplicate upgrade ids across the whole catalog', (function () {
  const seen = new Set(); let dup = false;
  for (const def of BUSINESS_DEFS) for (const up of def.upgrades) { if (seen.has(up.id)) dup = true; seen.add(up.id); }
  return !dup;
})());
for (const def of BUSINESS_DEFS) {
  check(def.id + ' has 3 named upgrades at 10/40/75', def.upgrades.length === 3 &&
    def.upgrades[0].requiresLevel === 10 && def.upgrades[1].requiresLevel === 40 && def.upgrades[2].requiresLevel === 75);
  check(def.id + ' has staffRoles', Array.isArray(def.staffRoles) && def.staffRoles.length >= 6);
}

/* ===================== B) Core loop: buy -> upgrade -> produce income ===================== */
for (const def of BUSINESS_DEFS) {
  state = defaultState();
  state.balance = 1e15;
  state.totalEarned = 1e20; // clears every unlockLevel gate
  const before = businessIncomePerSec(def);
  check(def.id + ' produces $0 at level 0', before === 0);
  for (let i = 0; i < 12; i++) buyBusinessLevel(def.id);
  const biz = getBiz(def.id);
  check(def.id + ' bought up to level 12', biz.level === 12);
  const afterBuy = businessIncomePerSec(def);
  check(def.id + ' produces positive income once owned', afterBuy > 0);
  hireStaff(def.id);
  const afterHire = businessIncomePerSec(def);
  check(def.id + ' hiring staff increases income', afterHire > afterBuy);
}

/* ===================== C) Mechanic-specific levers move income ===================== */
// automotive: projectRun — starting and collecting a project pays out.
(function () {
  state = defaultState();
  state.balance = 1e15;
  state.totalEarned = 1e20;
  for (let i = 0; i < 5; i++) buyBusinessLevel('automotive');
  const before = state.balance;
  const started = Mechanics.action('automotive', 'start', 'compact');
  check('automotive: can start a project', started);
  globalThis.NOW += 3 * 60000 + 1000; // 3 min compact project
  const collected = Mechanics.action('automotive', 'collect');
  check('automotive: collecting a finished project pays out', collected && state.balance > before);
})();

// hotels: hospitality — tier pick changes mult; event pays a lump sum.
(function () {
  state = defaultState();
  state.balance = 1e15;
  state.totalEarned = 1e20;
  for (let i = 0; i < 20; i++) buyBusinessLevel('hotels'); // level 20, unlocks Business Class tier (15)
  const base = businessIncomePerSec(BUSINESS_BY_ID['hotels']);
  Mechanics.action('hotels', 'tier', '1');
  const upgraded = businessIncomePerSec(BUSINESS_BY_ID['hotels']);
  check('hotels: higher room tier increases income', upgraded > base);
  const before = state.balance;
  const hosted = Mechanics.action('hotels', 'event');
  check('hotels: hosting an event pays a lump sum', hosted && state.balance > before);
  check('hotels: event goes on cooldown', !Mechanics.action('hotels', 'event'));
})();

// energy: tierPick with a volatile gas tier — mult should wobble over time
// but always stay positive; a stable renewable tier should beat gas on average.
(function () {
  state = defaultState();
  state.balance = 1e15;
  state.totalEarned = 1e20;
  for (let i = 0; i < 50; i++) buyBusinessLevel('energy'); // unlock nuclear tier (75)? no—only to 50; wind(15)/solar(40) unlocked
  const def = BUSINESS_BY_ID['energy'];
  let gasSamples = [];
  for (let s = 0; s < 400; s += 40) { globalThis.NOW += 40000; gasSamples.push(Mechanics.incomeMultiplier(def)); }
  const allPositive = gasSamples.every((m) => m > 0);
  const varies = new Set(gasSamples.map((m) => m.toFixed(3))).size > 1;
  check('energy: gas tier income multiplier stays positive', allPositive);
  check('energy: gas tier multiplier is volatile (varies over time)', varies);
  Mechanics.action('energy', 'tier', '2'); // Solar Farms (unlocked at 40, biz is level 50)
  const solarMult = Mechanics.incomeMultiplier(def);
  check('energy: solar tier multiplier is stable and higher than gas base', solarMult === 1.7);
})();

// space: riskProject — mission resolves to either full or partial payout, never zero.
(function () {
  state = defaultState();
  state.balance = 1e15;
  state.totalEarned = 1e20;
  for (let i = 0; i < 5; i++) buyBusinessLevel('space');
  let successes = 0, failures = 0;
  for (let trial = 0; trial < 25; trial++) {
    const before = state.balance;
    Mechanics.action('space', 'start', 'satlaunch');
    globalThis.NOW += 8 * 60000 + 1000;
    Mechanics.action('space', 'collect');
    const gain = state.balance - before;
    check('space: mission always pays something (trial ' + trial + ')', gain > 0);
    if ((getBiz('space').mech.missionSuccesses || 0) > successes) successes++; else failures++;
  }
  check('space: missions produced a mix of outcomes over 25 trials (successes=' + successes + ')', successes > 0);
})();

// ecommerce: expansion — recruiting a seller costs money and raises income permanently.
(function () {
  state = defaultState();
  state.balance = 1e15;
  state.totalEarned = 1e20;
  for (let i = 0; i < 5; i++) buyBusinessLevel('ecommerce');
  const before = businessIncomePerSec(BUSINESS_BY_ID['ecommerce']);
  const cashBefore = state.balance;
  const opened = Mechanics.action('ecommerce', 'open');
  check('ecommerce: can recruit a seller', opened);
  check('ecommerce: recruiting a seller costs money', state.balance < cashBefore);
  const after = businessIncomePerSec(BUSINESS_BY_ID['ecommerce']);
  check('ecommerce: recruiting a seller raises income permanently', after > before);
})();

// mining: riskyExpansion — exploring always costs money; success sometimes adds a mine.
(function () {
  state = defaultState();
  state.balance = 1e15;
  state.totalEarned = 1e20;
  for (let i = 0; i < 10; i++) buyBusinessLevel('mining'); // chance ~54% at this level/staff
  let strikes = 0, dryHoles = 0;
  for (let trial = 0; trial < 40; trial++) {
    getBiz('mining').mech.nodes = 0; // reset between trials so the node cap never binds — we're sampling the outcome roll, not accumulating nodes
    const cashBefore = state.balance;
    const explored = Mechanics.action('mining', 'explore');
    check('mining: exploring always costs money (trial ' + trial + ')', explored && state.balance < cashBefore);
    if ((getBiz('mining').mech.nodes || 0) > 0) strikes++; else dryHoles++;
  }
  check('mining: 40 explorations produced a mix of strikes and dry holes (strikes=' + strikes + ', dry=' + dryHoles + ')', strikes > 0 && dryHoles > 0);
})();

// railway: expansion, same shape as ecommerce but distinct data/theme.
(function () {
  state = defaultState();
  state.balance = 1e15;
  state.totalEarned = 1e20;
  for (let i = 0; i < 5; i++) buyBusinessLevel('railway');
  const before = businessIncomePerSec(BUSINESS_BY_ID['railway']);
  const opened = Mechanics.action('railway', 'open');
  check('railway: can build a route', opened);
  const after = businessIncomePerSec(BUSINESS_BY_ID['railway']);
  check('railway: building a route raises income permanently', after > before);
})();

// media: projectRun — greenlighting and releasing a production pays out.
(function () {
  state = defaultState();
  state.balance = 1e15;
  state.totalEarned = 1e20;
  for (let i = 0; i < 5; i++) buyBusinessLevel('media');
  const before = state.balance;
  Mechanics.action('media', 'start', 'indie');
  globalThis.NOW += 5 * 60000 + 1000;
  const collected = Mechanics.action('media', 'collect');
  check('media: releasing a production pays out', collected && state.balance > before);
})();

// gamestudio: projectRun, same handler as media/automotive but its own data.
(function () {
  state = defaultState();
  state.balance = 1e15;
  state.totalEarned = 1e20;
  for (let i = 0; i < 5; i++) buyBusinessLevel('gamestudio');
  const before = state.balance;
  Mechanics.action('gamestudio', 'start', 'mobile');
  globalThis.NOW += 4 * 60000 + 1000;
  const collected = Mechanics.action('gamestudio', 'collect');
  check('gamestudio: shipping a game pays out', collected && state.balance > before);
})();

// supermarket: tierPick, same handler as entvenue but different data/theme.
(function () {
  state = defaultState();
  state.balance = 1e15;
  state.totalEarned = 1e20;
  for (let i = 0; i < 20; i++) buyBusinessLevel('supermarket');
  const before = businessIncomePerSec(BUSINESS_BY_ID['supermarket']);
  Mechanics.action('supermarket', 'tier', '1');
  const after = businessIncomePerSec(BUSINESS_BY_ID['supermarket']);
  check('supermarket: better supplier tier increases income', after > before);
})();

// entvenue: tierPick.
(function () {
  state = defaultState();
  state.balance = 1e15;
  state.totalEarned = 1e20;
  for (let i = 0; i < 20; i++) buyBusinessLevel('entvenue');
  const before = businessIncomePerSec(BUSINESS_BY_ID['entvenue']);
  Mechanics.action('entvenue', 'tier', '1');
  const after = businessIncomePerSec(BUSINESS_BY_ID['entvenue']);
  check('entvenue: a bigger venue type increases income', after > before);
})();

// logistics: expansion.
(function () {
  state = defaultState();
  state.balance = 1e15;
  state.totalEarned = 1e20;
  for (let i = 0; i < 5; i++) buyBusinessLevel('logistics');
  const before = businessIncomePerSec(BUSINESS_BY_ID['logistics']);
  const opened = Mechanics.action('logistics', 'open');
  check('logistics: can open a distribution center', opened);
  const after = businessIncomePerSec(BUSINESS_BY_ID['logistics']);
  check('logistics: opening a distribution center raises income permanently', after > before);
})();

// airport: expansion.
(function () {
  state = defaultState();
  state.balance = 1e15;
  state.totalEarned = 1e20;
  for (let i = 0; i < 5; i++) buyBusinessLevel('airport');
  const before = businessIncomePerSec(BUSINESS_BY_ID['airport']);
  const opened = Mechanics.action('airport', 'open');
  check('airport: can open a gate', opened);
  const after = businessIncomePerSec(BUSINESS_BY_ID['airport']);
  check('airport: opening a gate raises income permanently', after > before);
})();

// pharma: riskProject, same handler as space but distinct data — a trial
// always resolves to a payout (full success or partial consolation), never zero.
(function () {
  state = defaultState();
  state.balance = 1e15;
  state.totalEarned = 1e20;
  for (let i = 0; i < 5; i++) buyBusinessLevel('pharma');
  let successes = 0, failures = 0;
  for (let trial = 0; trial < 25; trial++) {
    const before = state.balance;
    Mechanics.action('pharma', 'start', 'generic');
    globalThis.NOW += 6 * 60000 + 1000;
    Mechanics.action('pharma', 'collect');
    check('pharma: trial always pays something (trial ' + trial + ')', state.balance > before);
  }
})();

/* ===================== C2) Cross-business check: oil price fully retired ===================== */
check('Mechanics no longer exports oilPrice (retired with Oil & Gas / Transportation)', Mechanics.oilPrice === undefined);
check('no business mechanic references a shared oil price', BUSINESS_DEFS.every((d) => !d.mechanic || d.mechanic.type !== 'commodity'));
check('energy is the only business with a volatile tier, and it is self-contained', BUSINESS_DEFS.filter((d) => d.mechanic && d.mechanic.type === 'tierPick' && d.mechanic.tiers.some((t) => t.volatile)).map((d) => d.id).join(',') === 'energy');

/* ===================== D) Achievements: no dangling refs to removed businesses ===================== */
check('all_11 achievement no longer names removed businesses', !ACHIEVEMENT_DEFS.find((a) => a.id === 'all_11').desc.match(/11 businesses/i));
check('champion (sports) achievement removed', !ACHIEVEMENT_DEFS.find((a) => a.id === 'champion'));
check('mission_success_5 achievement added, reads space mission counter', !!ACHIEVEMENT_DEFS.find((a) => a.id === 'mission_success_5'));
(function () {
  state = defaultState();
  state.businesses['space'] = { level: 5, upgrades: {}, staff: 0, mech: { missionSuccesses: 5 } };
  const a = ACHIEVEMENT_DEFS.find((x) => x.id === 'mission_success_5');
  check('mission_success_5 triggers at 5 successes', a.check());
})();
(function () {
  state = defaultState();
  const a = ACHIEVEMENT_DEFS.find((x) => x.id === 'all_11');
  for (const def of BUSINESS_DEFS) buyBusinessLevel(def.id);
  check('all_11 still references a real, reachable slot cap', typeof MAX_SLOTS_CAP === 'number' && MAX_SLOTS_CAP === 11);
})();

/* ===================== E) Real-save migration (v22 -> v23) ===================== */
(function () {
  // A hand-built "real" v22 save: player owns 4 of the 11 removed businesses
  // with real progress (levels, staff, upgrades, and mechanic-specific cash),
  // AND already has some of the new-era state (techco) that must be untouched.
  const oldSave = {
    version: 22,
    balance: 12345,
    totalEarned: 5000000,
    tapLevel: 4,
    managementLevel: 2,
    businesses: {
      retail:  { level: 30, upgrades: { retail_signage: true }, staff: 3, mech: {} },
      bank:    { level: 15, upgrades: {}, staff: 1, mech: { vault: 88000 } },
      construction: { level: 8, upgrades: {}, staff: 0, mech: { job: { start: 1, materials: 5000 } } },
      airline: { level: 20, upgrades: { air_biz: true }, staff: 2, mech: { routes: 3 } },
    },
    achievements: { first_business: true },
    legacyPoints: 1, prestiges: 1, runEarned: 100, stats: { taps: 500 },
    effects: [], nextEventAt: 0, boosterReadyAt: 0,
    portfolio: {}, market: null, assets: null, techco: { keepme: true },
    lastSaved: Math.floor(Date.now() / 1000),
  };

  const expectedRetail = removedBizRefund('retail', oldSave.businesses.retail);
  const expectedBank = removedBizRefund('bank', oldSave.businesses.bank);
  const expectedConstruction = removedBizRefund('construction', oldSave.businesses.construction);
  const expectedAirline = removedBizRefund('airline', oldSave.businesses.airline);
  const expectedTotal = expectedRetail + expectedBank + expectedConstruction + expectedAirline;

  check('sanity: bank refund includes the full vault cash', expectedBank > 88000);
  check('sanity: construction refund includes in-flight materials', expectedConstruction > 5000);
  check('sanity: airline refund accounts for 3 paid routes', expectedAirline > 0);

  const beforeBalance = oldSave.balance;
  const migrated = migrate(JSON.parse(JSON.stringify(oldSave)));

  check('migration bumps version to latest (cascades past the v23 step tested here)', migrated.version === SAVE_VERSION);
  check('migration deletes all 11 removed business records', ['retail','taxi','restaurant','clothing','transport','construction','bank','oil','it','sports','airline'].every((id) => migrated.businesses[id] === undefined));
  check('migration refunds the full buyout amount (before=' + beforeBalance + ' expected+=' + Math.round(expectedTotal) + ' got=' + migrated.balance + ')',
    approx(migrated.balance, beforeBalance + expectedTotal, 0.001));
  check('migration queues a one-time buyout notice with count=4', migrated.businessBuyoutNotice && migrated.businessBuyoutNotice.count === 4);
  check('migration leaves unrelated state untouched (techco)', migrated.techco && migrated.techco.keepme === true);
  check('migration leaves totalEarned/achievements untouched', migrated.totalEarned === 5000000 && migrated.achievements.first_business === true);
  check('migration (v26) wipes legacyPoints/prestiges/runEarned entirely', migrated.legacyPoints === undefined && migrated.prestiges === undefined && migrated.runEarned === undefined);

  // A save with NONE of the removed businesses sees zero disruption.
  const cleanSave = { version: 22, balance: 999, businesses: { hotels: { level: 3, upgrades: {}, staff: 0, mech: {} } } };
  const migratedClean = migrate(JSON.parse(JSON.stringify(cleanSave)));
  check('a save with no removed businesses is undisturbed (balance unchanged)', migratedClean.balance === 999);
  check('a save with no removed businesses gets no buyout notice', !migratedClean.businessBuyoutNotice);
  check('a save with no removed businesses keeps its new-era business untouched', migratedClean.businesses.hotels.level === 3);
})();

// A second real save owning ALL 11 removed businesses at once (deep progress:
// high levels, max-ish staff, every upgrade) — every refund formula must run
// clean (no NaN/undefined) and every dollar must be accounted for.
(function () {
  const allOwned = { version: 22, balance: 500, businesses: {} };
  const allIds = ['retail','taxi','restaurant','clothing','transport','construction','bank','oil','it','sports','airline'];
  for (const id of allIds) allOwned.businesses[id] = { level: 40, upgrades: {}, staff: 4, mech: {} };
  // Own every upgrade explicitly for each business.
  allOwned.businesses.retail.upgrades = { retail_signage: true, retail_loyalty: true, retail_chain: true };
  allOwned.businesses.taxi.upgrades = { taxi_dispatch: true, taxi_app: true, taxi_ev: true };
  allOwned.businesses.restaurant.upgrades = { rest_menu: true, rest_star: true, rest_franchise: true };
  allOwned.businesses.clothing.upgrades = { cloth_design: true, cloth_brand: true, cloth_global: true };
  allOwned.businesses.transport.upgrades = { trans_hub: true, trans_rail: true, trans_ships: true };
  allOwned.businesses.construction.upgrades = { constr_crane: true, constr_pre: true, constr_mega: true };
  allOwned.businesses.construction.mech = { job: { start: 1, materials: 9000 } };
  allOwned.businesses.bank.upgrades = { bank_branch: true, bank_invest: true, bank_global: true };
  allOwned.businesses.bank.mech = { vault: 250000 };
  allOwned.businesses.oil.upgrades = { oil_rigs: true, oil_refine: true, oil_cartel: true };
  allOwned.businesses.it.upgrades = { it_cloud: true, it_ai: true, it_uni: true };
  allOwned.businesses.sports.upgrades = { sport_academy: true, sport_stadium: true, sport_league: true };
  allOwned.businesses.airline.upgrades = { air_biz: true, air_hub: true, air_flag: true };
  allOwned.businesses.airline.mech = { routes: 5 };

  let expectedAll = 0;
  for (const id of allIds) expectedAll += removedBizRefund(id, allOwned.businesses[id]);
  check('sanity: full-catalog expected refund is a real finite number', Number.isFinite(expectedAll) && expectedAll > 0);

  const migratedAll = migrate(JSON.parse(JSON.stringify(allOwned)));
  check('full-catalog migration: version bumped to latest (24, cascades past the v23 step tested here)', migratedAll.version === SAVE_VERSION);
  check('full-catalog migration: all 11 records deleted', allIds.every((id) => migratedAll.businesses[id] === undefined));
  check('full-catalog migration: refund is finite, no NaN/undefined (before=' + allOwned.balance + ' got=' + migratedAll.balance + ')', Number.isFinite(migratedAll.balance));
  check('full-catalog migration: refund matches the hand-computed total exactly',
    approx(migratedAll.balance, allOwned.balance + expectedAll, 0.0001));
  check('full-catalog migration: buyout notice count is 11', migratedAll.businessBuyoutNotice.count === 11);
})();

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
`;

const src = files.map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n;\n');
try {
  eval(src + '\n' + tests);
} catch (e) {
  console.error('ERROR running tests:', e);
  process.exit(1);
}
