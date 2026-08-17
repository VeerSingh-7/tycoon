/* =========================================================================
 * tests/bizdash.test.js — headless tests for:
 *   Part 1: Real estate retired from the Business tab (refund migration +
 *           the new Invest-tab "Coming Soon" placeholder)
 *   Part 2: The dedicated per-business page (js/bizdash.js) for all 14
 *           businesses, every tab
 * -------------------------------------------------------------------------
 * Run:  node tests/bizdash.test.js   (exit code 0 = all pass, 1 = a failure)
 * Same load-and-eval pattern as tests/business.test.js / techco.test.js.
 * ========================================================================= */

const fs = require('fs');
const path = require('path');

globalThis.NOW = 1700000000000;
Date.now = () => globalThis.NOW;
let _perfNow = 0;
globalThis.performance = { now: () => _perfNow };
globalThis.addEventListener = () => {};
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

const ROOT = path.join(__dirname, '..');
const files = [
  'js/format.js',
  'js/chart.js',
  'js/logos.js',
  'js/data/businesses.js',
  'js/data/properties.js',
  'js/data/progression.js',
  'js/data/markets.js',
  'js/data/stocks.js',
  'js/data/assets.js',
  'js/data/techco.js',
  'js/data/techspecs.js',
  'js/data/bizdefs.js',
  'js/data/research.js',
  'js/data/signature.js',
  'js/data/employees.js',
  'js/data/marketing.js',
  'js/state.js',
  'js/engine.js',
  'js/mechanics.js',
  'js/progression.js',
  'js/market.js',
  'js/techco.js',
  'js/assets.js',
  'js/businesses.js',
  'js/bizdash.js',
  'js/invest.js',
];

const tests = `
let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  \\u2713 ' + name); }
  else { fail++; console.log('  \\u2717 FAIL: ' + name); }
}
function approx(a, b, tol) { return Math.abs(a - b) <= Math.abs(b) * (tol == null ? 0.01 : tol); }

/* ===================== A) Real estate refund migration (v23 -> v24) ===================== */
(function () {
  // A hand-built "real" v23 save: 3 property types owned with real progress
  // (different counts/cost bases), plus an untouched luxury collection.
  const oldSave = {
    version: 23,
    balance: 5000,
    totalEarned: 2000000,
    businesses: {},
    achievements: {},
    legacyPoints: 0, prestiges: 0, runEarned: 0, stats: { taps: 0 },
    effects: [], nextEventAt: 0, boosterReadyAt: 0,
    portfolio: {}, market: null,
    assets: {
      epoch: 1699000000,
      estate: {
        apartment: { count: 3, cost: 231000 },
        villa:     { count: 1, cost: 412000 },
        mansion:   { count: 2, cost: 5300000 },
      },
      luxury: { rusty_hatch: true, city_compact: true },
    },
    techco: null,
    lastSaved: Math.floor(Date.now() / 1000),
  };
  const expectedRefund = 231000 + 412000 + 5300000;
  const expectedUnits = 3 + 1 + 2;

  const migrated = migrate(JSON.parse(JSON.stringify(oldSave)));
  check('migration bumps version to latest (24)', migrated.version === SAVE_VERSION);
  check('real estate refund: before=' + oldSave.balance + ' expected+=' + expectedRefund + ' got=' + migrated.balance,
    approx(migrated.balance, oldSave.balance + expectedRefund, 0.0001));
  check('real estate refund notice has correct unit count', migrated.realEstateRefundNotice.units === expectedUnits);
  check('real estate refund notice has correct cash amount', approx(migrated.realEstateRefundNotice.cash, expectedRefund, 0.0001));
  check('assets.estate is deleted after migration', migrated.assets.estate === undefined);
  check('assets.epoch is deleted after migration', migrated.assets.epoch === undefined);
  check('assets.luxury is COMPLETELY untouched', migrated.assets.luxury.rusty_hatch === true && migrated.assets.luxury.city_compact === true && Object.keys(migrated.assets.luxury).length === 2);
  check('unrelated state (totalEarned) untouched', migrated.totalEarned === 2000000);

  // A save with no real estate at all sees zero disruption.
  const cleanSave = { version: 23, balance: 777, assets: { luxury: { gold_watch: true } } };
  const migratedClean = migrate(JSON.parse(JSON.stringify(cleanSave)));
  check('no-estate save: balance unchanged', migratedClean.balance === 777);
  check('no-estate save: no refund notice queued', !migratedClean.realEstateRefundNotice);
  check('no-estate save: luxury untouched', migratedClean.assets.luxury.gold_watch === true);

  // A save that never touched assets at all (assets: null) — the common case.
  const neverSave = { version: 23, balance: 42, assets: null };
  const migratedNever = migrate(JSON.parse(JSON.stringify(neverSave)));
  check('assets:null save migrates cleanly with no crash', migratedNever.version === SAVE_VERSION && migratedNever.balance === 42);
})();

/* ===================== A2) No leftover real-estate code paths ===================== */
check('Assets no longer exports buyEstate/sellEstate/estateSummary/rentPerSec', typeof Assets.buyEstate === 'undefined' && typeof Assets.sellEstate === 'undefined' && typeof Assets.estateSummary === 'undefined' && typeof Assets.rentPerSec === 'undefined');
check('Assets still exports the Luxury API untouched', typeof Assets.buyLuxury === 'function' && typeof Assets.luxuryMultiplier === 'function' && typeof Assets.collectionProgress === 'function');
check('ESTATE_DEFS/ESTATE_BY_ID no longer exist', typeof ESTATE_DEFS === 'undefined' && typeof ESTATE_BY_ID === 'undefined');
check('LUXURY_DEFS/LUXURY_BY_ID/LUXURY_SETS still exist untouched', Array.isArray(LUXURY_DEFS) && LUXURY_DEFS.length > 0 && typeof LUXURY_BY_ID === 'object' && Array.isArray(LUXURY_SETS));

/* ===================== B) Dedicated business page (BizDash) — all 14 x every tab ===================== */
state = defaultState();
state.balance = 1e15;
state.totalEarned = 1e20;
for (const def of BUSINESS_DEFS) {
  for (let i = 0; i < 30; i++) buyBusinessLevel(def.id);
  hireStaff(def.id);
}
check('BizDash.TABS has exactly Overview/Operations/Staff/Upgrades', BizDash.TABS.map((t) => t.id).join(',') === 'overview,operations,staff,upgrades');

for (const def of BUSINESS_DEFS) {
  for (const tab of BizDash.TABS) {
    const html = BizDash._renderTabHTML(def.id, tab.id);
    const clean = typeof html === 'string' && html.length > 0 && !/undefined|NaN/.test(html);
    check(def.id + ' / ' + tab.id + ' tab renders clean HTML', clean);
  }
}

// Overview tab: leveling is retired (no more buy-level lever), sell stays.
(function () {
  const html = BizDash._renderTabHTML('space', 'overview');
  check('overview tab has NO buy-level button (leveling retired)', !html.includes('data-buy="space"'));
  check('overview tab includes the real sell link (data-sell)', html.includes('data-sell="space"'));
})();

// Operations tab must be the SAME Mechanics.panelHTML output, not a re-derived copy.
for (const def of BUSINESS_DEFS) {
  const fromDash = BizDash._renderTabHTML(def.id, 'operations');
  const fromMechanics = Mechanics.panelHTML(def);
  check(def.id + ' operations tab reuses Mechanics.panelHTML verbatim', fromDash === fromMechanics);
}

// Staff tab must be the SAME Businesses.staffHTML output (job-role hiring wired
// into the existing simple staff counter, not a new system).
for (const def of BUSINESS_DEFS) {
  const fromDash = BizDash._renderTabHTML(def.id, 'staff');
  const fromBiz = '<div class="card">' + Businesses.staffHTML(def, getBiz(def.id)) + '</div>';
  check(def.id + ' staff tab reuses Businesses.staffHTML verbatim (job roles included)', fromDash === fromBiz);
  check(def.id + ' staff tab shows a real staffRoles job title', def.staffRoles.some((role) => fromDash.includes(role)));
}

// Upgrades tab must be the SAME Businesses.upgradesHTML output.
for (const def of BUSINESS_DEFS) {
  const fromDash = BizDash._renderTabHTML(def.id, 'upgrades');
  const fromBiz = '<div class="upgrade-list">' + Businesses.upgradesHTML(def, getBiz(def.id)) + '</div>';
  check(def.id + ' upgrades tab reuses Businesses.upgradesHTML verbatim', fromDash === fromBiz);
}

/* ===================== C) BizDash open/close lifecycle (minimal DOM stub) ===================== */
(function () {
  const created = [];
  globalThis.document = {
    createElement: (tag) => {
      const el = { tagName: tag, className: '', innerHTML: '', _listeners: {},
        addEventListener(type, fn) { this._listeners[type] = fn; },
        remove() { this._removed = true; } };
      created.push(el);
      return el;
    },
    body: { children: [], appendChild(el) { this.children.push(el); }, style: {} },
  };

  state = defaultState();
  state.balance = 1e15;
  state.totalEarned = 1e20;
  buyBusinessLevel('space');

  check('BizDash.open() refuses an unowned business', (function () {
    const before = created.length;
    BizDash.open('hotels'); // level 0, not owned yet
    return created.length === before; // no screen element created
  })());

  BizDash.open('space');
  const el = created[created.length - 1];
  check('BizDash.open() creates a screen element and appends it to body', document.body.children.includes(el));
  check('BizDash.open() renders real content (net income, tabs)', el.innerHTML.includes('Net Income') && el.innerHTML.includes('Operations'));
  check('document.body.style.overflow is locked while open', document.body.style.overflow === 'hidden');

  BizDash.close();
  check('BizDash.close() removes the screen element', el._removed === true);
  check('document.body.style.overflow is restored on close', document.body.style.overflow === '');
})();

/* ===================== C2) Overview's Property card + "Buy It Outright" ===================== */
(function () {
  const created = [];
  globalThis.document = {
    createElement: (tag) => {
      const el = { tagName: tag, className: '', innerHTML: '', _listeners: {},
        addEventListener(type, fn) { this._listeners[type] = fn; },
        remove() { this._removed = true; } };
      created.push(el);
      return el;
    },
    body: { children: [], appendChild(el) { this.children.push(el); }, style: {} },
  };
  function fakeBtn(dataset) { return { closest: () => ({ dataset, disabled: false }) }; }

  state = defaultState();
  state.balance = 1e15;
  state.totalEarned = 1e20;
  buyBusinessLevel('supermarket');
  const biz = getBiz('supermarket');
  const uk = BUSINESS_PROPERTIES.supermarket.countries.find((c) => c.id === 'uk');
  const london = uk.cities.find((c) => c.name === 'London');
  const riverside = london.properties[0]; // "Riverside Market"
  biz.property = { countryId: 'uk', city: 'London', propertyId: propertySlug(riverside.name), tenure: 'rent' };
  biz.brand = { storeType: 'grocery', companyName: 'Fresh Co' };

  BizDash.open('supermarket');
  const el = created[created.length - 1];
  check('Overview shows a Property card once biz.property is set', el.innerHTML.includes('Riverside Market') && el.innerHTML.includes('Fresh Co'));
  check('the Property card shows the store type and business type', el.innerHTML.includes('Grocery') && el.innerHTML.includes('Supermarket Chain'));
  check('while renting, the card offers Buy It Outright with a real cost', /data-buy-outright="supermarket"/.test(el.innerHTML) && el.innerHTML.includes('Buy It Outright'));
  check('tenure reads Rented before buying outright', el.innerHTML.includes('>Rented<'));

  const balBefore = state.balance;
  const levelBefore = biz.level;
  el._listeners.click({ target: fakeBtn({ buyOutright: 'supermarket' }) });
  check('Buy It Outright charges real money', state.balance < balBefore);
  check('Buy It Outright bumps the business level (same lever as every other purchase)', biz.level === levelBefore + 1);
  check('the property record now reads purchase, not rent', biz.property.tenure === 'purchase');

  const rerendered = created[created.length - 1];
  check('Overview re-renders showing Owned instead of Rented, with no further action offered', rerendered.innerHTML.includes('>Owned<')
    && !rerendered.innerHTML.includes('Buy It Outright') && rerendered.innerHTML.includes('Fully paid off'));

  BizDash.close();

  // A business with no property catalog gets no Property card at all.
  buyBusinessLevel('hotels');
  BizDash.open('hotels');
  const hotelsEl = created[created.length - 1];
  check('a business without a property catalog shows no Property card', !hotelsEl.innerHTML.includes('class="card-title">Property<'));
  BizDash.close();
})();

/* ===================== D) Invest tab: Real Estate "Coming Soon" placeholder ===================== */
// A minimal DOM stub good enough to drive Invest's real internal click
// handler (captured via addEventListener) through: mount -> tap "Finances"
// -> tap the "Real Estate" segment -> check the real rendered output.
(function () {
  const elStore = {};
  function stubEl(id) {
    if (!elStore[id]) {
      elStore[id] = {
        id, innerHTML: '', dataset: {}, style: {},
        _listeners: {},
        addEventListener(type, fn) { this._listeners[type] = fn; },
        removeEventListener() {},
        querySelector() { return null; },
        querySelectorAll() { return []; },
        closest() { return null; },
        appendChild() {}, remove() {},
        classList: { add() {}, remove() {}, toggle() {} },
      };
    }
    return elStore[id];
  }
  let anonN = 0;
  globalThis.document = {
    getElementById: (id) => stubEl(id),
    createElement: () => stubEl('anon' + (anonN++)),
    body: stubEl('body'),
    documentElement: stubEl('html'),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    hidden: false,
  };
  function fakeTarget(act, id) {
    return { closest: () => ({ dataset: { act, id }, disabled: false }) };
  }

  state = defaultState();
  Market.ensure();
  const container = stubEl('invRoot');
  Invest.mount(container);
  check('Invest.mount() lands on the Services hub', container.innerHTML.includes('Services'));

  // Tap "Finances" -> the Markets list, which owns the Stocks/Crypto/Real Estate toggle.
  container._listeners.click({ target: fakeTarget('finances') });
  check('Finances screen shows all three segments including Real Estate', /Stocks/.test(container.innerHTML) && /Crypto/.test(container.innerHTML) && /Real Estate/.test(container.innerHTML));

  // Tap the Real Estate segment -> the mktBody stub gets the Coming Soon markup.
  container._listeners.click({ target: fakeTarget('seg', 'estate') });
  const body = stubEl('mktBody');
  check('Real Estate segment renders the Coming Soon badge', body.innerHTML.includes('COMING SOON'));
  check('Real Estate segment mentions Real Estate by name', /Real Estate/.test(body.innerHTML));
  check('Real Estate placeholder has no undefined/NaN leaking in', !/undefined|NaN/.test(body.innerHTML));
  check('Real Estate placeholder does NOT show a stock/crypto asset list', !body.innerHTML.includes('asset-list'));

  // Stocks segment still works normally (regression: the new segment didn't break the others).
  container._listeners.click({ target: fakeTarget('seg', 'stock') });
  check('Stocks segment still renders a real asset list', stubEl('mktBody').innerHTML.includes('asset-list'));
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
