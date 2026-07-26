/* =========================================================================
 * tests/techco.test.js — headless tests for Tech-company management (Phase 1)
 * -------------------------------------------------------------------------
 * Run:  node tests/techco.test.js   (exit 0 = all pass, 1 = a failure)
 *
 * Loads the real browser modules into one scope with a MOCK clock (Date.now)
 * so time-dependent behaviour — build timers, ageing, cash accrual — is
 * deterministic. Asserts the Phase-1 contract:
 *   - every cost/reward scales off the company's BASE PASSIVE INCOME
 *   - product development: cost, build timer, reception, income, decay, update,
 *     retirement
 *   - net profit = revenue − costs; market share aggregates product share
 *   - save migrates v12 → v13 in place (holdings + cash untouched)
 * ========================================================================= */

const fs = require('fs');
const path = require('path');

globalThis.NOW = 1700000000000;
Date.now = () => globalThis.NOW;
globalThis.addEventListener = () => {};
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

const ROOT = path.join(__dirname, '..');
const files = [
  'js/format.js',
  'js/data/markets.js',
  'js/data/stocks.js',
  'js/data/techco.js',
  'js/state.js',
  'js/market.js',
  'js/techco.js',
];

const tests = `
let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  \\u2713 ' + name); }
  else { fail++; console.log('  \\u2717 FAIL: ' + name); }
}
const approx = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
const ID = 'mango'; // Halcyon Digital — a managed tech company

Market.ensure();

/* A) Only the five tech companies are managed. */
check('managed: the five tech ids', ['mango','googol','macrosoft','faceblock','auracle'].every(TechCo.isManaged));
check('not managed: a non-tech stock (tezla)', !TechCo.isManaged('tezla'));
check('not managed: a crypto (bitcorn)', !TechCo.isManaged('bitcorn'));

/* B) Base passive income is the scaling unit = marketCap × INCOME_RATE. */
const cap = Market.stats(ID).marketCap;
check('base income scales off market cap', approx(TechCo.baseIncome(ID), cap * TechCo.CFG.INCOME_RATE));
check('base income is a large (non-flat) number', TechCo.baseIncome(ID) > 1e6);

/* C) Company seeds with cash = SEED_DAYS × base income (scaled, not flat). */
const c = TechCo._state(ID);
check('seed cash = SEED_DAYS × base income', approx(c.cash, TechCo.baseIncome(ID) * TechCo.CFG.SEED_DAYS));
check('company has zero products at first', c.products.length === 0);

/* D) Launching a product: cost scales off base income; a build starts. */
const cost = TechCo.buildCost(ID, 'standard');
check('build cost = base income × budget mult', approx(cost, TechCo.baseIncome(ID) * TechCo.BUDGETS.standard.costMult));
const cashBefore = c.cash;
const r1 = TechCo.startBuild(ID, { type: 'Smartphones', budget: 'standard', quality: 'standard', pricing: 'balanced' });
check('startBuild ok', r1.ok === true);
check('company cash reduced by exactly the build cost', approx(c.cash, cashBefore - cost));
check('one build now in progress', c.builds.length === 1);
check('no product yet (still building)', c.products.length === 0);

/* E) The build does NOT complete before its timer, and DOES after. Build time
 *    is Engineering-adjusted, so read the actual duration from the build. */
const bld = c.builds[0];
const dur = bld.endsAt - bld.startMs;
check('Engineering speeds builds (duration < nominal)', dur < TechCo.QUALITIES.standard.seconds * 1000);
globalThis.NOW = bld.startMs + dur - 3000; // 3s before done
TechCo.advance(ID);
check('build still in progress just before its timer', c.builds.length === 1 && c.products.length === 0);
globalThis.NOW = bld.endsAt + 2000; // now past the timer
TechCo.advance(ID);
check('build completed after the timer', c.builds.length === 0 && c.products.length === 1);
const prod = c.products[0];
check('launched product earns income (a % boost)', TechCo.productIncome(ID, prod) > 0);
check('launched product has a 1..5 rating', prod.rating >= 1 && prod.rating <= 5);
check('launched product has health', prod.health > 0);

/* F) Reception is shifted by budget + quality (bounded, deterministic ends). */
let allTop = true, allBottom = true;
for (let i = 0; i < 400; i++) {
  const hi = TechCo.rollReception({ budget: 'blockbuster', quality: 'polished' });
  const lo = TechCo.rollReception({ budget: 'lean', quality: 'rush' });
  if (hi !== 'hit' && hi !== 'breakout') allTop = false;
  if (lo !== 'flop' && lo !== 'modest') allBottom = false;
}
check('blockbuster + polished never flops (always hit/breakout)', allTop);
check('lean + rush never breaks out (always flop/modest)', allBottom);

/* G) Net profit = revenue − operating costs − payroll; revenue = base + products. */
const rev = TechCo.revenuePerDay(ID);
check('revenue = base income + product income', approx(rev, TechCo.baseIncome(ID) + TechCo.productIncome(ID, prod)));
check('net profit = revenue − revenue×opex − payroll',
  approx(TechCo.netProfitPerDay(ID), rev - rev * TechCo.opexRate(ID) - TechCo.payrollPerDay(ID)));

/* H) Market share = (baseline + product contributions) × marketing multiplier. */
check('market share = (baseShare + product share) × shareMult',
  approx(TechCo.marketShare(ID), (c.baseShare + TechCo.productShare(ID, prod)) * TechCo.shareMult(ID)));

/* I) Products AGE: income falls as health decays over time. */
const incFresh = TechCo.productIncome(ID, prod);
const hFresh = prod.health;
globalThis.NOW += 200 * 1000; // ~10 in-game days
TechCo.advance(ID);
check('product health decayed over time', prod.health < hFresh);
check('product income fell as it aged', TechCo.productIncome(ID, prod) < incFresh);

/* J) Update restores health (diminishing) and costs company cash (scaled). */
prod.health = 20;
const uCost = TechCo.updateCost(ID, prod);
check('update cost scales off base income', approx(uCost, TechCo.baseIncome(ID) * (2 + prod.updates)));
const cashPreUpd = c.cash;
const hPreUpd = prod.health;
const ru = TechCo.updateProduct(ID, prod.pid);
check('update ok', ru.ok === true);
check('update raised product health', prod.health > hPreUpd);
check('update deducted company cash', c.cash < cashPreUpd);

/* K) Very old products retire (removed, income stops). */
globalThis.NOW += TechCo.CFG.MAX_ACCRUE_DAYS * TechCo.CFG.DAY_SECONDS * 1000; // enormous ageing
TechCo.advance(ID);
check('aged-out product retired (portfolio empty)', c.products.length === 0);

/* L) Cash accrues from net profit over elapsed in-game days. */
c.products = []; c.builds = []; c.cash = 0; c.lastMs = globalThis.NOW;
globalThis.NOW += 5 * TechCo.CFG.DAY_SECONDS * 1000; // 5 in-game days
const net = TechCo.netProfitPerDay(ID); // evaluated at the same clock advance() uses
TechCo.advance(ID);
check('cash accrued ≈ netProfit/day × days', approx(c.cash, net * 5, 1e-3));

/* M) A duplicate live/in-development product type is rejected. */
TechCo.startBuild(ID, { type: 'Laptops', budget: 'standard', quality: 'standard', pricing: 'balanced' });
const dup = TechCo.startBuild(ID, { type: 'Laptops', budget: 'standard', quality: 'standard', pricing: 'balanced' });
check('cannot develop a type already in development', dup.ok === false);

/* N) startBuild fails when company cash is short (no negative balances). */
c.cash = 0;
const broke = TechCo.startBuild(ID, { type: 'Tablets', budget: 'blockbuster', quality: 'polished', pricing: 'premium' });
check('startBuild rejected when cash is insufficient', broke.ok === false);

/* O) Save migrates v12 → v13 in place, keeping holdings + cash. */
const out = migrate({ version: 12, balance: 12345, portfolio: { mango: { shares: 7, cost: 100 } } });
check('save migrates to the latest version (>= 14)', out.version >= 14);
check('cash kept through migration', out.balance === 12345);
check('holdings kept through migration', out.portfolio.mango.shares === 7);

/* ============================ PHASE 2 ================================= */
const V = 'googol'; // Vireo — a fresh managed company for staff/research/valuation
const vc = TechCo._state(V);

/* P) Staff: three groups seed with headcount + zero training. */
check('company seeds Engineering / Marketing / Operations teams',
  vc.staff.eng.count > 0 && vc.staff.mkt.count > 0 && vc.staff.ops.count > 0);
check('build slots ≥ 2 from seed Engineering', TechCo.concurrentSlots(V) >= 2);

/* Q) Hiring costs cash (scaled off base income), adds payroll, adds a head. */
vc.cash = TechCo.baseIncome(V) * 100; // plenty to act
const hc = TechCo.hireCost(V, 'eng');
check('hire cost scales off base income', approx(hc, TechCo.baseIncome(V) * TechCo.STAFF_CFG.HIRE_BASE * (1 + vc.staff.eng.count * TechCo.STAFF_CFG.HIRE_GROWTH)));
const payBefore = TechCo.payrollPerDay(V), engBefore = vc.staff.eng.count, cashBeforeHire = vc.cash;
const rh = TechCo.hire(V, 'eng');
check('hire ok', rh.ok === true);
check('hire added a team', vc.staff.eng.count === engBefore + 1);
check('hire deducted company cash', approx(vc.cash, cashBeforeHire - hc));
check('hire raised payroll/day', TechCo.payrollPerDay(V) > payBefore);

/* R) Training raises the group's training level (no new payroll) and costs cash. */
const payPreTrain = TechCo.payrollPerDay(V), cashPreTrain = vc.cash, trainPre = vc.staff.eng.training;
const rt = TechCo.train(V, 'eng');
check('train ok', rt.ok === true);
check('train raised training level', vc.staff.eng.training === trainPre + 1);
check('train did NOT add payroll', approx(TechCo.payrollPerDay(V), payPreTrain));
check('train deducted company cash', vc.cash < cashPreTrain);

/* S) More Engineering → faster builds and more concurrent slots. */
check('buildSpeedMult < 1 with staff', TechCo.buildSpeedMult(V) < 1);
const slotsNow = TechCo.concurrentSlots(V);
vc.staff.eng.count += 8;
check('extra Engineering adds build slots', TechCo.concurrentSlots(V) > slotsNow);
check('extra Engineering speeds builds further', TechCo.buildSpeedMult(V) < 1);

/* T) Build slots are enforced (can't exceed the concurrent slot cap). */
vc.staff.eng.count = 1; vc.staff.eng.training = 0; // slots = 1
vc.products = []; vc.builds = []; vc.cash = TechCo.baseIncome(V) * 500;
const cat = TechCo.catalogFor(V);
check('first build starts (slot free)', TechCo.startBuild(V, { type: cat[0][0], budget: 'lean', quality: 'rush', pricing: 'balanced' }).ok === true);
const second = TechCo.startBuild(V, { type: cat[1][0], budget: 'lean', quality: 'rush', pricing: 'balanced' });
check('second build rejected when all slots busy', second.ok === false);

/* U) Research: tiers gate on order; starting one costs cash and runs a timer. */
vc.research = { done: {}, active: null };
check('tier 0 available, tier 1 locked until tier 0 done', TechCo.researchAvailable(V, 0) && !TechCo.researchAvailable(V, 1));
const rcost = TechCo.researchCost(V, 0), cashPreR = vc.cash;
const sr = TechCo.startResearch(V, 0);
check('startResearch ok', sr.ok === true);
check('research deducted cash (scaled off base income)', approx(vc.cash, cashPreR - rcost));
check('research is now active', !!vc.research.active);
check('cannot start a second project while one runs', TechCo.startResearch(V, 0).ok === false);
// Resolve it (success or failure — either way the project stops running).
globalThis.NOW = vc.research.active.endsAt + 1000;
TechCo.advance(V);
check('research resolves after its timer (no longer active)', vc.research.active === null);

/* V) Research EFFECTS wire through: income mult, cost cut, unlock. */
vc.research = { done: { 2: true }, active: null }; // tier 2 = income ×1.15
check('income-mult research raises researchMult', approx(TechCo.researchMult(V), TechCo.RESEARCH_TIERS[2].effect.mult));
const opexFull = TechCo.opexRate(V);
vc.research = { done: { 1: true }, active: null }; // tier 1 = cost cut
check('cost-cut research lowers operating cost rate', TechCo.opexRate(V) < opexFull);
const baseCatLen = TECHCO_DEFS[V].catalog.length;
vc.research = { done: {}, active: null }; vc.unlocked = [];
check('catalog is base length with nothing unlocked', TechCo.catalogFor(V).length === baseCatLen);
vc.unlocked = [TECHCO_DEFS[V].unlockProduct];
check('unlocked flagship extends the catalog', TechCo.catalogFor(V).length === baseCatLen + 1);

/* W) Valuation ratchets up and feeds the empire (net-worth) total. */
vc.products = []; vc.builds = []; vc.research = { done: {}, active: null }; vc.unlocked = [];
vc.valuation = 0; vc.cumProfit = 0; vc.lastMs = globalThis.NOW;
TechCo.advance(V);
const val1 = TechCo._state(V).valuation;
check('valuation initialises to a positive number', val1 > 0);
vc.cumProfit += TechCo.baseIncome(V) * 1000; // more retained profit → higher target
TechCo.advance(V);
check('valuation ratchets up as the company grows', TechCo._state(V).valuation > val1);
check('empire value ≥ this company valuation (feeds net worth)', TechCo.empireValue() >= TechCo._state(V).valuation);
check('managed count reflects opened companies', TechCo.managedCount() >= 1);

console.log('\\n' + (fail ? ('\\u2717 ' + fail + ' failing, ' + pass + ' passing') : ('\\u2713 all ' + pass + ' checks passed')));
if (fail) process.exitCode = 1;
`;

const src = files.map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n') + '\n' + tests;
eval(src);
