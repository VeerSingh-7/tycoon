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

/* E) The build does NOT complete before its timer, and DOES after. */
globalThis.NOW += (TechCo.QUALITIES.standard.seconds - 5) * 1000; // 5s before done
TechCo.advance(ID);
check('build still in progress just before its timer', c.builds.length === 1 && c.products.length === 0);
globalThis.NOW += 10 * 1000; // now past the timer
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

/* G) Net profit = revenue − costs; revenue = base + product income. */
const rev = TechCo.revenuePerDay(ID);
check('revenue = base income + product income', approx(rev, TechCo.baseIncome(ID) + TechCo.productIncome(ID, prod)));
check('net profit = revenue × (1 − OPEX)', approx(TechCo.netProfitPerDay(ID), rev * (1 - TechCo.CFG.OPEX)));

/* H) Market share aggregates the company baseline + product contributions. */
check('market share = baseShare + product share', approx(TechCo.marketShare(ID), c.baseShare + TechCo.productShare(ID, prod)));

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
check('save migrates to v13', out.version === 13);
check('cash kept through migration', out.balance === 12345);
check('holdings kept through migration', out.portfolio.mango.shares === 7);

console.log('\\n' + (fail ? ('\\u2717 ' + fail + ' failing, ' + pass + ' passing') : ('\\u2713 all ' + pass + ' checks passed')));
if (fail) process.exitCode = 1;
`;

const src = files.map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n') + '\n' + tests;
eval(src);
