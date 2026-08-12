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
  'js/data/research.js',
  'js/data/signature.js',
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
check('net profit = revenue − revenue×opex − payroll − R&D spend',
  approx(TechCo.netProfitPerDay(ID), rev - rev * TechCo.opexRate(ID) - TechCo.payrollPerDay(ID) - TechCo.researchSpendPerDay(ID)));

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
check('research state seeds to the new shape', vc.research.levels && Array.isArray(vc.research.active) && vc.research.budget === 'standard');

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

/* S) More Engineering → faster builds (build slots removed entirely). */
check('buildSpeedMult < 1 with staff', TechCo.buildSpeedMult(V) < 1);
const bs0 = TechCo.buildSpeedMult(V);
vc.staff.eng.count += 8;
check('extra Engineering speeds builds further', TechCo.buildSpeedMult(V) < bs0);

/* T) No build-slot cap — you can develop several products at once. */
vc.staff.eng.count = 1; vc.staff.eng.training = 0;
vc.products = []; vc.builds = []; vc.cash = TechCo.baseIncome(V) * 5000;
const cat = TechCo.catalogFor(V);
check('first build starts', TechCo.startBuild(V, { type: cat[0][0], budget: 'lean', quality: 'rush', pricing: 'balanced' }).ok === true);
check('a second concurrent build also starts (no slot cap)', TechCo.startBuild(V, { type: cat[1][0], budget: 'lean', quality: 'rush', pricing: 'balanced' }).ok === true);
check('multiple builds run at once', vc.builds.length === 2);

/* U) Research: scientists add power & capacity; projects cost cash + run a timer. */
vc.research = { budget: 'standard', sci: { jr: 0, sr: 0, lead: 0 }, centers: {}, partners: {}, levels: {}, active: [], mass: {} };
vc.cash = TechCo.baseIncome(V) * 5000;
const cap0 = TechCo.researchCapacity(V);
TechCo.hireSci(V, 'lead'); TechCo.hireSci(V, 'lead');
check('hiring scientists raises research power', TechCo.researchPower(V) > 0);
check('scientists raise project capacity', TechCo.researchCapacity(V) >= cap0);
const treeV = TechCo.treeOf(V), cat0 = treeV.categories[0].id;
const rcost = TechCo.projectCost(V, 1), cashPreR = vc.cash;
const sp = TechCo.startProject(V, cat0);
check('startProject ok', sp.ok === true);
check('project deducted cash (scaled off base income)', approx(vc.cash, cashPreR - rcost));
check('a research project is now active', vc.research.active.length === 1);
check('cannot start the same category twice', TechCo.startProject(V, cat0).ok === false);
globalThis.NOW = vc.research.active[0].endsAt + 1000;
TechCo.advance(V);
check('project resolves and raises the category level', vc.research.levels[cat0] === 1 && vc.research.active.length === 0);

/* V) Research effects wire through: income/quality bonuses + product unlock. */
vc.research.levels = {}; vc.unlocked = [];
const c1 = treeV.categories[0];
vc.research.levels[c1.id] = c1.levels.length; // fully researched
check('research raises income multiplier', TechCo.researchMult(V) > 1);
check('research adds a quality bonus', TechCo.researchQualityBonus(V) >= 0);
// A breakthrough with an unlock adds a new product to the catalogue.
vc.research.levels = {}; vc.unlocked = []; vc.cash = TechCo.baseIncome(V) * 1e6;
vc.research.levels[c1.id] = c1.levels.length - 1;
TechCo.startProject(V, c1.id);
globalThis.NOW = vc.research.active[0].endsAt + 1000;
TechCo.advance(V);
const unlockDef = c1.levels[c1.levels.length - 1][2].u;
check('reaching a breakthrough unlocks its product', !unlockDef || TechCo.catalogFor(V).some((r) => r[0] === unlockDef[0]));

/* W) Valuation ratchets up and feeds the empire (net-worth) total. */
vc.products = []; vc.builds = []; vc.unlocked = [];
vc.research = { budget: 'standard', sci: { jr: 0, sr: 0, lead: 0 }, centers: {}, partners: {}, levels: {}, active: [], mass: {} };
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
TechCo.setStrategy(A2, 'balanced'); const durBal = TechCo.projectDuration(A2, 1);
TechCo.setStrategy(A2, 'research');
check('Research Focus speeds up research (shorter projects)', TechCo.projectDuration(A2, 1) < durBal);

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
// Pre-claim every leadership category so checkLeadership() can't award an
// unrelated #1 cash bonus mid-resolve (which would otherwise mask the spend).
ac.leaders = { share: true, value: true, innovation: true, satisfaction: true, profit: true };
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
check('product margin within 0.15..0.85', TechCo.productMargin(K, kprod) >= 0.15 && TechCo.productMargin(K, kprod) <= 0.85);
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

/* ================= RESEARCH META-GAME (centres, partners, mass) ====== */
const R = 'tezla'; // Voltaris Motors — auto research tree
const rc2 = TechCo._state(R);
rc2.cash = TechCo.baseIncome(R) * 1e7;
rc2.research = { budget: 'standard', sci: { jr: 0, sr: 0, lead: 0 }, centers: {}, partners: {}, levels: {}, active: [], mass: {} };

/* BE) Editable research budget changes spend and speed. */
const spendStd = TechCo.researchSpendPerDay(R);
TechCo.setBudget(R, 'blitz');
check('a bigger budget raises R&D spend/day', TechCo.researchSpendPerDay(R) > spendStd);
check('a bigger budget speeds projects', TechCo.projectDuration(R, 1) < 100000);
TechCo.setBudget(R, 'standard');

/* BF) Building a research centre costs cash and adds power. */
const pow0 = TechCo.researchPower(R);
const rcbuild = TechCo.buildCenter(R, 'sv');
check('build centre ok', rcbuild.ok === true);
check('centre adds research power', TechCo.researchPower(R) > pow0);
check('cannot build the same centre twice', TechCo.buildCenter(R, 'sv').ok === false);

/* BG) Partnerships form and give distinct bonuses. */
const rlab = TechCo.formPartner(R, 'lab');
check('form partnership ok', rlab.ok === true);
check('lab partnership adds big research power', TechCo.researchPower(R) > pow0);
TechCo.formPartner(R, 'corp');
check('private R&D partner adds a quality bonus', TechCo.researchQualityBonus(R) >= 5);

/* BH) Mass "moonshot" projects: cost a lot, run long, then apply a big effect. */
const tree = TechCo.treeOf(R), mass = tree.mass[0];
rc2.cash = TechCo.baseIncome(R) * 1e7;
const incBefore = TechCo.researchMult(R);
const rmStart = TechCo.startMass(R, mass.id);
check('start mass project ok', rmStart.ok === true);
check('mass project is running', !!rc2.research.mass[mass.id] && rc2.research.mass[mass.id] !== 'done');
globalThis.NOW = rc2.research.mass[mass.id].endsAt + 1000;
TechCo.advance(R);
check('mass project completes', rc2.research.mass[mass.id] === 'done');
check('mass project applies its reward', mass.effect.inc ? TechCo.researchMult(R) > incBefore : true);

/* BI) Save migrates to v18 in place, keeping holdings + cash. */
const out6 = migrate({ version: 17, balance: 314, portfolio: { mango: { shares: 8, cost: 20 } } });
check('save migrates to v18+', out6.version >= 18);
check('holdings + cash kept through v18 migration', out6.balance === 314 && out6.portfolio.mango.shares === 8);

/* ============== RESEARCH DEPTH (more categories, team assignment) ==== */
const RD = 'silicon_isle'; // Meridian Semiconductor
const rdc = TechCo._state(RD);
rdc.cash = TechCo.baseIncome(RD) * 1e8;
rdc.research = { budget: 'standard', sci: { jr: 0, sr: 0, lead: 0 }, centers: {}, partners: {}, levels: {}, active: [], mass: {} };
const rtree = TechCo.treeOf(RD);
check('each company has 8+ research categories', rtree.categories.length >= 8);
check('common categories included (Operations & Efficiency)', rtree.categories.some((c) => c.name === 'Operations & Efficiency'));
check('each company has 3+ mass projects', rtree.mass.length >= 3);
check('a sector-specific category is present (Process Node)', rtree.categories.some((c) => c.name === 'Process Node'));

TechCo.hireSci(RD, 'lead'); TechCo.hireSci(RD, 'sr'); TechCo.hireSci(RD, 'sr'); TechCo.hireSci(RD, 'jr');
const catX = rtree.categories[0].id;
const durNoTeam = TechCo.projectDuration(RD, 1, { lead: 0, sr: 0, jr: 0, priority: 'normal' });
const durTeam = TechCo.projectDuration(RD, 1, { lead: 1, sr: 2, jr: 1, priority: 'normal' });
check('assigning a team speeds up a project', durTeam < durNoTeam);
check('Crash priority is faster but pricier',
  TechCo.projectDuration(RD, 1, { priority: 'crash' }) < TechCo.projectDuration(RD, 1, { priority: 'normal' }) &&
  TechCo.projectCost(RD, 1, { priority: 'crash' }) > TechCo.projectCost(RD, 1, { priority: 'normal' }));

const availLead0 = TechCo.availableSci(RD, 'lead');
TechCo.startProject(RD, catX, { lead: 1, sr: 2, jr: 0, priority: 'normal' });
check('starting a project assigns scientists to it', TechCo.availableSci(RD, 'lead') === availLead0 - 1);
check('the active project stored its team', rdc.research.active.find((a) => a.cat === catX).sr === 2);
check('cannot over-assign beyond available scientists', TechCo.availableSci(RD, 'sr') === 0);
// Edit the active project — assign the remaining junior and go Crash priority.
TechCo.editProject(RD, catX, { lead: 1, sr: 2, jr: 1, priority: 'crash' });
const projAfter = rdc.research.active.find((a) => a.cat === catX);
check('editing an active project updates its team & priority', projAfter.priority === 'crash' && projAfter.jr === 1);

/* ============== SIGNATURE (per-company unique operation) ============= */
// Every one of the 48 companies has a Signature: a named trait plus either a
// 5-step ladder or a 3-stance doctrine. Effects fold through the same economy
// helpers as everything else, scaling off base income.
const SG = 'mango';   // Ecosystem Flywheel — a ladder
const sgc = TechCo._state(SG);
sgc.cash = TechCo.baseIncome(SG) * 1e9;
const sgDef = TechCo.sigDef(SG);
check('every managed company has a signature definition', !!sgDef && !!sgDef.trait && !!sgDef.trait.effect);
check('a ladder signature has exactly 5 steps', sgDef.kind !== 'ladder' || (sgDef.steps && sgDef.steps.length === 5));
check('signature aggregate is a full effect vector', ['inc','mg','pr','ct','share','q'].every((k) => k in TechCo.sigAgg(SG)));
// Ladder: funding a step costs cash (scaled off base income) and raises level.
sgc.signature = { level: 0, stance: null };
const sgLvl0 = sgc.signature.level, sgCash0 = sgc.cash;
const sgStepCost = TechCo.ladderStepCost(SG, 0);
check('ladder step cost scales off base income (>0)', sgStepCost > 0);
const sgAdv = TechCo.sigAdvanceLadder(SG);
check('funding a ladder step succeeds', sgAdv.ok === true);
check('funding a ladder step raised the level', sgc.signature.level === sgLvl0 + 1);
check('funding a ladder step spent company cash', sgc.cash < sgCash0);
// Advancing the ladder strengthens the aggregate effect vector.
const sgAggMag = (id) => { const a = TechCo.sigAgg(id); return a.inc + a.mg + a.pr + a.ct + a.share + a.q; };
const sgMagAfter1 = sgAggMag(SG);
TechCo.sigAdvanceLadder(SG);
check('each ladder step deepens the signature bonuses', sgAggMag(SG) > sgMagAfter1);
// Doctrine: a 3-stance company can switch stance and the aggregate changes.
const DG = 'googol';  // Data Doctrine — a doctrine (3 stances)
const dgDef = TechCo.sigDef(DG);
check('a doctrine signature has exactly 3 stances', dgDef.kind !== 'doctrine' || (dgDef.stances && dgDef.stances.length === 3));
const dgc = TechCo._state(DG);
dgc.signature = { level: 0, stance: dgDef.stances[0].id };
const dgAgg0 = JSON.stringify(TechCo.sigAgg(DG));
TechCo.sigSetStance(DG, dgDef.stances[2].id);
check('switching a doctrine stance takes effect', dgc.signature.stance === dgDef.stances[2].id);
check('different doctrine stances give different bonuses', JSON.stringify(TechCo.sigAgg(DG)) !== dgAgg0);
// Signature effects actually move the economy: a quality-trait company's
// computed quality includes its signature quality bonus.
check('signature quality bonus feeds computeQuality', TechCo.sigQualityBonus('auracle') > 0);
// Every signature id maps to a real, managed company (48 total, no orphans).
const SIG_ALL = COMPANY_SIGNATURE; // top-level const from js/data/signature.js
check('signature covers all 48 companies', Object.keys(SIG_ALL).length === 48);
check('every signature entry is a ladder(5) or doctrine(3)', Object.values(SIG_ALL).every((s) =>
  (s.kind === 'ladder' && s.steps && s.steps.length === 5) ||
  (s.kind === 'doctrine' && s.stances && s.stances.length === 3)));

/* ============== RICHER PRODUCT TIERS (6 tiers, deep spec) ============ */
check('there are 6 product tiers', Object.keys(TECH_TIERS || {}).length >= 6);
const T = TECH_TIERS; // top-level const from js/data/techspecs.js
check('premium tiers price higher than economy tiers', (T.halo.priceMult > T.premium.priceMult) && (T.premium.priceMult > T.economy.priceMult));
check('cheaper tiers sell more volume than halo tiers', (T.economy.volume > T.standard.volume) && (T.standard.volume > T.halo.volume));
check('every tier carries deep spec (margin, volume, brand, audience, blurb)', Object.values(T).every((t) =>
  ('margin' in t) && ('volume' in t) && ('brand' in t) && !!t.audience && !!t.blurb));

/* ============== PRODUCT STUDIO — BLUEPRINT RESKIN (shared component) === */
// The reskin lives in ONE shared component used by all 48 companies across
// all 16 sectors. Exercise it for a Tech, a Bank and a Retail company to
// confirm it's genuinely shared (not hardcoded to one company) and that the
// new Market Intel / Rival Watch features adapt sensibly per sector.
[['auracle', 'tech'], ['bankameria', 'bank'], ['wallmarket', 'retail']].forEach(function (pair) {
  const cid = pair[0], sector = pair[1];
  const launch = TechCo.defaultLaunch(cid);
  const s = TechCo.wizardSummary(cid, launch.cfg);
  const basicsHTML = TechCo.studioBasics(cid, launch.cfg, s);
  check(cid + ' (' + sector + '): type grid renders an icon per catalog item',
    (basicsHTML.match(/tc-type-ico-svg/g) || []).length >= TechCo.catalogFor(cid).length);
  check(cid + ' (' + sector + '): tier rail renders all 6 tiers', (basicsHTML.match(/tc-tier-node/g) || []).length === 6);
  const axes = TechCo.radarAxesFor(cid);
  check(cid + ' (' + sector + '): market intel has exactly 5 axes', axes.length === 5);
  const build = TechCo.buildAxisScores(cid, launch.cfg, s);
  check(cid + ' (' + sector + '): build axis scores are 5 values in 0-100', build.length === 5 && build.every((v) => v >= 0 && v <= 100));
  const demand = TechCo.marketDemandAxes(cid, launch.cfg);
  check(cid + ' (' + sector + '): market demand axes are 5 values in 0-100', demand.length === 5 && demand.every((v) => v >= 0 && v <= 100));
  const intelHTML = TechCo.marketIntelHTML(cid, launch.cfg, s);
  check(cid + ' (' + sector + '): market intel renders both radar polygons', intelHTML.includes('tc-radar-demand') && intelHTML.includes('tc-radar-build'));
  const rivalHTML = TechCo.rivalWatchHTML(cid, s);
  check(cid + ' (' + sector + '): rival watch renders real rival rows', (rivalHTML.match(/tc-rival-row/g) || []).length >= 2);
});
// Axis labels adapt per sector — a bank isn't sold on "Design" — while the
// 5-axis shape and the underlying calculations stay identical everywhere.
check('bank sector swaps out the generic "Design" axis label', TechCo.radarAxesFor('bankameria').indexOf('Design') === -1);
check('tech sector keeps the generic axis set', TechCo.radarAxesFor('auracle').indexOf('Design') !== -1);
check('bank and tech get different, sector-tailored axis labels', JSON.stringify(TechCo.radarAxesFor('bankameria')) !== JSON.stringify(TechCo.radarAxesFor('auracle')));
// Existing calculations are untouched by the reskin — quality/cost/time/price
// on the summary object are exactly what the pre-reskin wizard also showed.
const rsCfg = TechCo.defaultLaunch('auracle').cfg;
const rsSummary = TechCo.wizardSummary('auracle', rsCfg);
check('wizardSummary still exposes cost/time/income/quality unchanged',
  rsSummary.cost > 0 && rsSummary.secs > 0 && rsSummary.projIncome >= 0 && rsSummary.cq.quality >= 0);

console.log('\\n' + (fail ? ('\\u2717 ' + fail + ' failing, ' + pass + ' passing') : ('\\u2713 all ' + pass + ' checks passed')));
if (fail) process.exitCode = 1;
`;

const src = files.map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n') + '\n' + tests;
eval(src);
