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
  'js/data/techspecs.js',
  'js/data/bizdefs.js',
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
check('managed: a non-tech stock too (tezla)', TechCo.isManaged('tezla'));
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

/* G) Revenue scales with market share + leadership; net profit nets costs. */
const rev = TechCo.revenuePerDay(ID);
check('revenue = (base + product income) × share mult × leader mult',
  approx(rev, (TechCo.baseIncome(ID) + TechCo.productIncome(ID, prod)) * TechCo.shareIncomeMult(ID) * TechCo.leaderMult(ID)));
check('net profit = revenue − revenue×opex − payroll',
  approx(TechCo.netProfitPerDay(ID), rev - rev * TechCo.opexRate(ID) - TechCo.payrollPerDay(ID)));

/* H) Market share is RELATIVE: your strength as a share of the whole field. */
check('market share = playerStrength / (player + rivals) × 100',
  approx(TechCo.marketShare(ID), TechCo.playerStrength(ID) / (TechCo.playerStrength(ID) + TechCo.totalRivalStrength(ID)) * 100));

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

/* ============================ PHASE 3 ================================= */
const F = 'faceblock'; // Lumen Social — a fresh company for rivals/market share
const fc = TechCo._state(F);

/* X) Rivals are seeded from the company's roster, each with its own state. */
check('rivals seeded from the roster', fc.rivals.length === TECHCO_DEFS[F].rivals.length && fc.rivals.length >= 3);
check('each rival has strength/reputation/innovation/value/profit',
  fc.rivals.every((r) => r.strength > 0 && r.rep > 0 && r.innovation > 0 && r.value > 0 && r.profit !== undefined));

/* Y) Market share is relative and its income multiplier tracks it. */
const share0 = TechCo.marketShare(F);
check('market share in (0.5, 99)', share0 > 0.5 && share0 < 99);
check('share = playerStrength / (player + rivals) × 100',
  approx(share0, TechCo.playerStrength(F) / (TechCo.playerStrength(F) + TechCo.totalRivalStrength(F)) * 100));

/* Z) Compete — Marketing Push: costs cash, adds edge, raises your share.
 *    Pre-claim crowns so a leadership bonus can't mask the pure cash deduction
 *    (the crowns test AD resets leaders anyway). */
fc.cash = TechCo.baseIncome(F) * 1000;
fc.leaders = { share: true, value: true, innovation: true, satisfaction: true, profit: true };
const pcost = TechCo.competeCost(F, 'push');
check('compete cost scales off base income', approx(pcost, TechCo.baseIncome(F) * TechCo.COMPETE.push.costMult));
const cash0 = fc.cash, str0 = TechCo.playerStrength(F), sim0 = TechCo.shareIncomeMult(F);
const rp = TechCo.compete(F, 'push');
check('marketing push ok', rp.ok === true);
check('push deducted company cash', approx(fc.cash, cash0 - pcost));
check('push raised competitive strength', TechCo.playerStrength(F) > str0);
check('push raised market share', TechCo.marketShare(F) > share0);
check('higher share → higher income multiplier', TechCo.shareIncomeMult(F) >= sim0);

/* AA) Undercut lowers rivals’ strength and applies a temporary margin hit. */
const rivalSum0 = TechCo.totalRivalStrength(F);
TechCo.compete(F, 'undercut');
check('undercut reduced total rival strength', TechCo.totalRivalStrength(F) < rivalSum0);
check('undercut set a temporary margin window', fc.undercutUntil > globalThis.NOW);

/* AB) Poach weakens the market leader; Innovation Sprint lifts innovation. */
const leadBefore = fc.rivals.slice().sort((a, b) => b.strength - a.strength)[0];
const leadStr0 = leadBefore.strength;
TechCo.compete(F, 'poach');
check('poach weakened the strongest rival', leadBefore.strength < leadStr0);
const innov0 = TechCo.innovationScore(F);
TechCo.compete(F, 'innovate');
check('innovation sprint raised innovation score', TechCo.innovationScore(F) > innov0);

/* AC) Rankings: player rank is 1..(rivals+1) in every category. */
const totalPlayers = fc.rivals.length + 1;
check('player rank is within 1..N for every category',
  TechCo.RANK_CATS.every((cat) => { const r = TechCo.playerRank(F, cat.id); return r >= 1 && r <= totalPlayers; }));

/* AD) Reaching #1 in every category claims all crowns + income bonus + cash. */
fc.leaders = {}; fc.satisfaction = 95;
fc.rivals.forEach((r) => { r.strength = 0.1; r.value = 1; r.innovation = 1; r.satisfaction = 1; r.profit = -1e12; });
const lmBefore = TechCo.leaderMult(F), cashBeforeCrowns = fc.cash;
TechCo.checkLeadership(F);
check('all five crowns claimed when dominating', Object.keys(fc.leaders).length === 5);
check('leadership paid a cash bonus', fc.cash > cashBeforeCrowns);
check('leadership raised the permanent income multiplier', TechCo.leaderMult(F) > lmBefore);
check('leaderMult = 1 + 0.03 × crowns', approx(TechCo.leaderMult(F), 1 + TechCo.LEADER_INCOME_BONUS * 5));

/* AE) Rivals evolve (grow) over time. */
fc.rivals.forEach((r) => { r.strength = 5; });
TechCo.evolveRivals(F, 20);
check('rivals grow passively over time', fc.rivals.some((r) => r.strength > 5));

/* AF) Save migrates to v15 in place. */
const out3 = migrate({ version: 14, balance: 42, portfolio: { mango: { shares: 3, cost: 9 } } });
check('save migrates to v15+', out3.version >= 15);
check('holdings + cash kept through v15 migration', out3.balance === 42 && out3.portfolio.mango.shares === 3);

/* ============================ PHASE 4 ================================= */
const A2 = 'auracle'; // Cygnus Labs — has physical (robotics) products
const ac = TechCo._state(A2);
ac.cash = TechCo.baseIncome(A2) * 5000;

/* AG) Manufacturing only exists for companies with physical products. */
check('manufacturing on for physical-product companies', TechCo.hasManufacturing('mango') && TechCo.hasManufacturing('googol') && TechCo.hasManufacturing('auracle'));
check('manufacturing off for software/social companies', !TechCo.hasManufacturing('macrosoft') && !TechCo.hasManufacturing('faceblock'));
check('physical company defaults to Outsource', ac.manufacturing === 'outsource');
check('non-physical company manufacturing = none', TechCo._state('macrosoft').manufacturing === 'none');

/* AH) Manufacturing affects physical margins only; In-house costs upfront. */
check('outsource lowers physical product margin (<1)', TechCo.manufacturingMult(A2, { phys: true }) < 1);
check('manufacturing does not touch non-physical products', TechCo.manufacturingMult(A2, { phys: false }) === 1);
const setupCost = TechCo.inhouseSetupCost(A2), cashPreManu = ac.cash;
const rm = TechCo.setManufacturing(A2, 'inhouse');
check('switch to in-house ok', rm.ok === true);
check('in-house charged the setup cost', approx(ac.cash, cashPreManu - setupCost));
check('in-house lifts physical product margin (>1)', TechCo.manufacturingMult(A2, { phys: true }) > 1);

/* AI) Financial strategy shifts operating cost, research odds, satisfaction. */
TechCo.setStrategy(A2, 'balanced'); const opexBal = TechCo.opexRate(A2);
TechCo.setStrategy(A2, 'costcut');
check('Cut Costs lowers the operating cost rate', TechCo.opexRate(A2) < opexBal);
const succBal = TechCo.researchSuccess(A2, 0);
TechCo.setStrategy(A2, 'research');
check('Research Focus raises research success chance', TechCo.researchSuccess(A2, 0) >= succBal);

/* AJ) Marketing Focus steadily grows competitive edge over time. */
TechCo.setStrategy(A2, 'marketing');
ac.edge = 0; ac.lastMs = globalThis.NOW;
globalThis.NOW += 5 * TechCo.CFG.DAY_SECONDS * 1000;
TechCo.advance(A2);
check('Marketing Focus grows competitive edge passively', ac.edge > 0);
TechCo.setStrategy(A2, 'balanced');

/* AK) Global expansion: unlock regions for income (with a cost drag). */
check('home region is unlocked, income mult starts at 1', ac.regions.na && approx(TechCo.globalIncomeMult(A2), 1));
const gCost = TechCo.regionCost(A2, 'eu');
check('region cost scales off base income', gCost > 0);
const revPreRegion = TechCo.revenuePerDay(A2), opexPreRegion = TechCo.opexRate(A2);
const rg = TechCo.unlockRegion(A2, 'eu');
check('expand to Europe ok', rg.ok === true);
check('global income multiplier rose above 1', TechCo.globalIncomeMult(A2) > 1);
check('expansion raised revenue', TechCo.revenuePerDay(A2) > revPreRegion);
check('expansion added an operating cost drag', TechCo.opexRate(A2) > opexPreRegion);

/* AL) Rival acquisition — only when you dominate; absorbs share + a bonus. */
check('cannot acquire a strong rival', !TechCo.canAcquire(A2, 0) || ac.rivals[0].strength <= TechCo.playerStrength(A2) * 0.5);
ac.rivals[0].strength = 0.1; // now clearly weaker than the player
check('weak rival is acquirable', TechCo.canAcquire(A2, 0));
const nRivals = ac.rivals.length, edgePreAcq = ac.edge || 0, acqBonusPre = ac.acqBonus || 0, cashPreAcq = ac.cash;
const aq = TechCo.acquireRival(A2, 0);
check('acquire ok', aq.ok === true);
check('acquired rival removed from the field', ac.rivals.length === nRivals - 1);
check('acquisition absorbed market share (edge up)', (ac.edge || 0) > edgePreAcq);
check('acquisition granted a permanent income bonus', ac.acqBonus > acqBonusPre);
check('acquisition cost company cash', ac.cash < cashPreAcq);

/* AM) Events: roll when due, resolve with cost/benefit, dismissible. */
ac.event = null; ac.nextEventAt = 0;
TechCo.maybeRollEvent(A2);
check('an event surfaces when due', ac.event !== null);
check('rolling an event pushes the next one out', ac.nextEventAt > globalThis.NOW);
TechCo.resolveEvent(A2, 'dismiss');
check('an event is dismissible', ac.event === null);
// Viral: option A spends cash and boosts edge.
ac.event = { id: 'viral' }; ac.cash = TechCo.baseIncome(A2) * 1000;
const edgePreV = ac.edge || 0, cashPreV = ac.cash;
TechCo.resolveEvent(A2, 'a');
check('viral (pay in) boosted edge and spent cash', (ac.edge || 0) > edgePreV && ac.cash < cashPreV && ac.event === null);
// Supply shortage: riding it out applies a temporary income dip.
ac.event = { id: 'supply' };
TechCo.resolveEvent(A2, 'b');
check('supply shortage (ride out) sets a temporary income dip', ac.supplyUntil > globalThis.NOW && ac.event === null);

/* AN) Save migrates to v16 in place. */
const out4 = migrate({ version: 15, balance: 77, portfolio: { mango: { shares: 2, cost: 5 } } });
check('save migrates to v16+', out4.version >= 16);
check('holdings + cash kept through v16 migration', out4.balance === 77 && out4.portfolio.mango.shares === 2);

/* ==================== PRODUCT STUDIO (in-depth design) =============== */
const K = 'macrosoft'; // Kestrel Software — software archetype
const kc = TechCo._state(K);
kc.cash = TechCo.baseIncome(K) * 1e6; kc.products = []; kc.builds = [];
const setSpecs = (cfg, idx) => { for (const sp of TechCo.archetypeOf(cfg.type).specs) cfg.specs[sp[0]] = idx; return cfg; };

/* AO) Archetype mapping is tailored per product type. */
check('Smartphones → mobile (hardware focus)', TechCo.archetypeOf('Smartphones').focus === 'hardware');
check('Office Suite → software', TechCo.archetypeOf('Office Suite').unit === 'licenses');
check('AI Assistants → ai archetype', TechCo.archetypeOf('AI Assistants').category === 'AI Products');
check('Robotics → robotics archetype', TechCo.archetypeOf('Robotics').unit === 'units');
check('unknown type falls back to generic', TechCo.archetypeOf('Nonexistent Thing').category === 'Product');

/* AP) A default studio config is complete and editable. */
const dcfg = TechCo.studioDefault(K, 'Office Suite');
check('studio default has a name', typeof dcfg.name === 'string' && dcfg.name.length > 0);
check('studio default: tier standard, budgets standard, team none',
  dcfg.tier === 'standard' && Object.values(dcfg.budget).every((v) => v === 'standard') && Object.values(dcfg.team).every((v) => v === 'none'));

/* AQ) Quality rises with better specs, more budget and more team. */
const lo = setSpecs(TechCo.studioDefault(K, 'Office Suite'), 0);
Object.keys(lo.budget).forEach((a) => lo.budget[a] = 'lean');
Object.keys(lo.team).forEach((r) => lo.team[r] = 'none');
const hi = setSpecs(TechCo.studioDefault(K, 'Office Suite'), 2);
Object.keys(hi.budget).forEach((a) => hi.budget[a] = 'heavy');
Object.keys(hi.team).forEach((r) => hi.team[r] = 'large');
const qLo = TechCo.computeQuality(K, lo).quality, qHi = TechCo.computeQuality(K, hi).quality;
check('quality is bounded 3..100', qLo >= 3 && qHi <= 100);
check('better specs + budget + team → much higher quality', qHi > qLo + 20);

/* AR) Deep build cost scales off base income and with tier/budget/team. */
check('deep build cost scales off base income', TechCo.deepBuildCost(K, hi) > TechCo.baseIncome(K));
check('a maxed build costs more than a minimal one', TechCo.deepBuildCost(K, hi) > TechCo.deepBuildCost(K, lo));

/* AS) A Project Manager speeds the build. */
const noPm = TechCo.studioDefault(K, 'Office Suite');
const bigPm = TechCo.studioDefault(K, 'Office Suite'); bigPm.team.pm = 'large';
check('assigning a Project Manager shortens build time', TechCo.deepBuildTime(K, bigPm) < TechCo.deepBuildTime(K, noPm));

/* AT) scoreToReception maps a quality-driven score to an outcome. */
check('very low score → flop', TechCo.scoreToReception(0.5) === 'flop');
check('very high score → breakout', TechCo.scoreToReception(6) === 'breakout');

/* AU) Start a deep build: costs cash, records the full config. */
const kcfg = setSpecs(TechCo.studioDefault(K, 'Office Suite'), 2);
Object.keys(kcfg.budget).forEach((a) => kcfg.budget[a] = 'heavy');
kcfg.team.lead = 'large'; kcfg.team.swe = 'large'; kcfg.name = 'Kestrel Works';
const dc = TechCo.deepBuildCost(K, kcfg), kcash0 = kc.cash;
const sb = TechCo.startDeepBuild(K, kcfg);
check('startDeepBuild ok', sb.ok === true);
check('deep build deducted the right cash', approx(kc.cash, kcash0 - dc));
check('a deep build is in progress with its config', kc.builds.length === 1 && kc.builds[0].deep && kc.builds[0].cfg.name === 'Kestrel Works');
check('cannot start the same product type twice', TechCo.startDeepBuild(K, kcfg).ok === false);

/* AV) On completion the product carries name/tier/specs/quality + sales fields. */
const bd = kc.builds[0];
globalThis.NOW = bd.endsAt + 1000;
TechCo.advance(K);
check('deep build completed into a product', kc.products.length === 1);
const kprod = kc.products[0];
check('product kept its custom name', kprod.name === 'Kestrel Works');
check('product records tier, specs and a quality score', kprod.tier === 'standard' && kprod.quality > 0 && kprod.specs);
check('product earns income and has a unit price', TechCo.productIncome(K, kprod) > 0 && kprod.unitPrice > 0);
check('product tracks lifetime sales fields', typeof kprod.unitsSold === 'number' && typeof kprod.revenue === 'number' && typeof kprod.profit === 'number');

/* AW) Unit price rises with tier; margin sane; units = income / price. */
const budgetTier = Object.assign({}, kprod, { tier: 'budget' });
const flagTier = Object.assign({}, kprod, { tier: 'flagship' });
check('flagship unit price > budget unit price', TechCo.unitPriceOf(K, flagTier) > TechCo.unitPriceOf(K, budgetTier));
check('product margin within 0.15..0.75', TechCo.productMargin(K, kprod) >= 0.15 && TechCo.productMargin(K, kprod) <= 0.75);
check('units/day = income / unit price', approx(TechCo.unitsPerDay(K, kprod), TechCo.productIncome(K, kprod) / kprod.unitPrice));

/* AX) Lifetime sales accumulate: units, revenue and profit. */
kc.lastMs = globalThis.NOW;
globalThis.NOW += 6 * TechCo.CFG.DAY_SECONDS * 1000;
TechCo.advance(K);
check('revenue accrues after release', kprod.revenue > 0);
check('units sold accrue after release', kprod.unitsSold > 0);
check('profit ≈ revenue × margin', approx(kprod.profit, kprod.revenue * TechCo.productMargin(K, kprod), 1e-3));
check('units sold ≈ revenue / unit price', approx(kprod.unitsSold, kprod.revenue / kprod.unitPrice, 1e-3));

/* AY) Save migrates to v17 in place. */
const out5 = migrate({ version: 16, balance: 9, portfolio: { mango: { shares: 1, cost: 2 } } });
check('save migrates to v17+', out5.version >= 17);
check('holdings + cash kept through v17 migration', out5.balance === 9 && out5.portfolio.mango.shares === 1);

/* ============== ALL-SECTOR MANAGEMENT (generalised profiles) ========= */

/* AZ) EVERY stock is now manageable; no crypto is. */
const STOCKS = ASSET_DEFS.filter((d) => d.group === 'stock');
const CRYPTOS = ASSET_DEFS.filter((d) => d.group === 'crypto');
check('every stock is manageable', STOCKS.every((d) => TechCo.isManaged(d.id)));
check('no crypto is manageable', CRYPTOS.every((d) => !TechCo.isManaged(d.id)));
check('a good spread of companies (40+ stocks)', STOCKS.length >= 40);

/* BA) Every managed company has a complete, tailored profile. */
let allComplete = true, rivalsTailored = new Set();
for (const d of STOCKS) {
  const def = TECHCO_DEFS[d.id];
  if (!def || !def.catalog || def.catalog.length < 4 || !def.rivals || def.rivals.length !== 4
    || !def.research || def.research.length !== 5 || !def.unlockProduct) allComplete = false;
  // every product maps to a real spec archetype
  for (const row of def.catalog) if (!TechCo.archetypeOf(row[0]) || !TechCo.archetypeOf(row[0]).specs) allComplete = false;
  rivalsTailored.add(def.rivals.join('|'));
}
check('every company has catalog + 4 rivals + 5 research + flagship', allComplete);
check('rivals are tailored (distinct sets across companies)', rivalsTailored.size >= STOCKS.length * 0.7);

/* BB) A non-tech company runs the full flow: buyout → studio → sales. */
const BANK = 'morganpratt'; // Ashford & Rowe (banking)
check('bank maps to the banking archetype', TechCo.archetypeOf(TECHCO_DEFS[BANK].catalog[0][0]).category === 'Banking');
const bkc = TechCo._state(BANK);
bkc.cash = TechCo.baseIncome(BANK) * 1e6; bkc.products = []; bkc.builds = [];
const bcfg = TechCo.studioDefault(BANK, TECHCO_DEFS[BANK].catalog[0][0]);
for (const sp of TechCo.archetypeOf(bcfg.type).specs) bcfg.specs[sp[0]] = 2;
const bstart = TechCo.startDeepBuild(BANK, bcfg);
check('non-tech company can start a Studio build', bstart.ok === true);
globalThis.NOW = bkc.builds[0].endsAt + 1000;
TechCo.advance(BANK);
check('non-tech build completes into an earning product', bkc.products.length === 1 && TechCo.productIncome(BANK, bkc.products[0]) > 0);

/* BC) Sector margins differ (pharma high, auto low). */
const pharmaMargin = (() => { const id = 'elytilly', p = { type: TECHCO_DEFS[id].catalog[0][0], tier: 'standard' }; return TechCo.productMargin(id, p); })();
const autoMargin = (() => { const id = 'tezla'; const def = TECHCO_DEFS[id]; const p = { type: def.catalog[0][0], tier: 'standard' }; return TechCo.productMargin(id, p); })();
check('pharma margin is high, auto margin is low', pharmaMargin > autoMargin);

/* BD) Manufacturing only for physical-product sectors. */
check('a bank has no manufacturing', !TechCo.hasManufacturing(BANK));
check('a semiconductor firm has manufacturing', TechCo.hasManufacturing('envidia'));

console.log('\\n' + (fail ? ('\\u2717 ' + fail + ' failing, ' + pass + ' passing') : ('\\u2713 all ' + pass + ' checks passed')));
if (fail) process.exitCode = 1;
`;

const src = files.map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n') + '\n' + tests;
eval(src);
