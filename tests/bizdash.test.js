/* =========================================================================
 * tests/bizdash.test.js — headless tests for:
 *   Part 1: Real estate retired from the Business tab (refund migration +
 *           the new Invest-tab "Coming Soon" placeholder)
 *   Part 2: The dedicated per-business page (js/bizdash.js) for all 19
 *           businesses (13 + 6 Supermarket Chain slots), every tab
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
  'js/storepage.js',
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

/* ===================== B) Dedicated business page (BizDash) — all 19 x every tab ===================== */
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

/* ===================== C2) Manage Business: focused property screen with real rent-vs-buy choice ===================== */
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
  buyBusinessLevel('supermarket_1');
  const biz = getBiz('supermarket_1');
  const uk = BUSINESS_PROPERTIES.supermarket.countries.find((c) => c.id === 'uk');
  const london = uk.cities.find((c) => c.name === 'London');
  const riverside = london.properties[0]; // "Riverside Market"
  biz.properties.push({ countryId: 'uk', city: 'London', propertyId: propertySlug(riverside.name), tenure: 'rent' });
  biz.brand = { storeType: 'grocery', companyName: 'Fresh Co' };

  BizDash.open('supermarket_1');
  const el = created[created.length - 1];
  check('Manage Business on a Supermarket Chain shows the property, not the tabbed dashboard', !el.innerHTML.includes('data-bizd-tab'));
  check('Manage Business names the specific chain', el.innerHTML.includes('Supermarket Chain 1'));
  check('Manage Business shows the real Properties card (photo, company, location)', el.innerHTML.includes('Riverside Market') && el.innerHTML.includes('Fresh Co'));
  check('Manage Business shows the rent-vs-buy choice for the still-renting property', el.innerHTML.includes('Pay Rent Monthly') && el.innerHTML.includes('Buy It Outright'));
  check('the rent option shows a real, non-zero monthly figure', (function () {
    const idx = el.innerHTML.indexOf('Pay Rent Monthly');
    return idx >= 0 && /[$][1-9]/.test(el.innerHTML.slice(idx, idx + 80));
  })());
  check('Staff/Upgrades/Operations remain Coming Soon (not rebuilt yet)', el.innerHTML.includes('COMING SOON'));
  check('Manage Business is still closable', el.innerHTML.includes('data-bizd-close'));

  // Buying outright from the real rendered screen works end to end.
  const balBefore = state.balance;
  el._listeners.click({ target: fakeBtn({ buyOutright: 'supermarket_1:0' }) });
  check('Buy It Outright from the real Manage Business screen charges money and flips tenure', state.balance < balBefore && biz.properties[0].tenure === 'purchase');
  const rerendered = created[created.length - 1];
  check('once purchased, the property shows Owned on both sides of the choice, no further action', rerendered.innerHTML.includes('✓ Owned')
    && !rerendered.innerHTML.includes('✓ Current'));
  BizDash.close();

  // A non-chain business is completely unaffected — still the full tabbed dashboard.
  buyBusinessLevel('hotels');
  BizDash.open('hotels');
  const hotelsEl = created[created.length - 1];
  check('a non-chain business still opens the real tabbed dashboard', hotelsEl.innerHTML.includes('data-bizd-tab') && hotelsEl.innerHTML.includes('Net Income'));
  check('a non-chain business without a property catalog shows no Properties card', !hotelsEl.innerHTML.includes('card-title">Properties'));
  BizDash.close();
})();

/* ===================== C3) Renting a property is a real, ongoing cost ===================== */
(function () {
  state = defaultState();
  state.balance = 1e15;
  state.totalEarned = 1e20;
  buyBusinessLevel('supermarket_1');
  const def = BUSINESS_BY_ID['supermarket_1'];
  const biz = getBiz('supermarket_1');
  const uk = BUSINESS_PROPERTIES.supermarket.countries.find((c) => c.id === 'uk');
  const london = uk.cities.find((c) => c.name === 'London');
  const property = london.properties[0];

  const incomeBefore = businessIncomePerSec(def);
  biz.properties.push({ countryId: 'uk', city: 'London', propertyId: propertySlug(property.name), tenure: 'rent' });
  const incomeWhileRenting = businessIncomePerSec(def);
  check('net income drops once a property is actively being rented (a real ongoing cost)', incomeWhileRenting < incomeBefore);

  const expectedMonthlyRent = propertyDetails(property, 'London', 0).financials.monthlyRent;
  const expectedRentPerSec = expectedMonthlyRent / (30 * 86400);
  check('the income drop matches the property own displayed monthlyRent, converted to per-second', approx(incomeBefore - incomeWhileRenting, expectedRentPerSec, 0.001));

  Businesses.buyPropertyOutright('supermarket_1:0');
  check('buying the property outright removes it from the rent drain (businessRentPerSec drops to 0)', businessRentPerSec(def) === 0);
  const incomeAfterBuying = businessIncomePerSec(def);
  check('income after buying is higher than while renting (rent gone, and the purchase itself bumped level/income)', incomeAfterBuying > incomeWhileRenting);

  // A business with no property catalog is completely unaffected.
  buyBusinessLevel('hotels');
  const hotelsDef = BUSINESS_BY_ID['hotels'];
  check('businessRentPerSec is a no-op for businesses without a property catalog', businessRentPerSec(hotelsDef) === 0);
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

  // Back to the hub, then into the new Suppliers category.
  container._listeners.click({ target: fakeTarget('hub') });
  check('Services hub now lists a Suppliers card', container.innerHTML.includes('Suppliers'));
  container._listeners.click({ target: fakeTarget('suppliers') });
  check('Suppliers screen shows a real, non-empty generated business name', (function () {
    const m = container.innerHTML.match(/hub-title">([^<]+)</);
    return !!m && m[1].trim().length > 0;
  })());
  check('Suppliers screen describes it as a Supermarket Chain supplier', /Supermarket Chain[^<]*supplier/i.test(container.innerHTML));
  check('Suppliers screen has no undefined/NaN leaking in', !/undefined|NaN/.test(container.innerHTML));
  check('Suppliers screen has a back link to Services', container.innerHTML.includes('‹ Services'));

  // The generated name is stable across visits (same seed every time).
  const firstName = (container.innerHTML.match(/hub-title">([^<]+)</) || [])[1];
  container._listeners.click({ target: fakeTarget('hub') });
  container._listeners.click({ target: fakeTarget('suppliers') });
  const secondName = (container.innerHTML.match(/hub-title">([^<]+)</) || [])[1];
  check('the generated supplier name is stable across repeat visits (seeded, not random)', firstName === secondName);
})();

/* ===================== E) Supermarket Chain: one catalog row, repeatable purchase ===================== */
(function () {
  function bizStubContainer() {
    return {
      innerHTML: '', _listeners: {},
      addEventListener(type, fn) { this._listeners[type] = fn; },
      removeEventListener() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
    };
  }
  function fakeBizBtn(dataset) { return { closest: () => ({ dataset, disabled: false }) }; }
  globalThis.document = {
    getElementById: () => null,
    createElement: () => ({ style: {}, addEventListener() {} }),
    body: { style: {} },
    querySelector: () => null,
    querySelectorAll: () => [],
  };

  state = defaultState();
  state.balance = 1e15;
  state.totalEarned = 1e20;
  const container = bizStubContainer();
  Businesses.mount(container); // default listMode 'all'

  check('Purchasable catalog shows exactly ONE "Supermarket Chain" row (0 chains open)',
    (container.innerHTML.match(/Supermarket Chain</g) || []).length === 1);
  check('the family row offers Start Business targeting chain 1', /data-buy="supermarket_1"/.test(container.innerHTML));
  check('no supermarket_2..6 purchase buttons appear individually', ![2, 3, 4, 5, 6].some((i) => container.innerHTML.includes('data-buy="supermarket_' + i + '"')));
  check('"Purchasable" count is the consolidated 14 (13 non-chain + 1 chain row), not the raw 19 defs', (function () {
    const idx = container.innerHTML.indexOf('biz-nav-num">14</span>');
    return idx >= 0 && container.innerHTML.slice(idx, idx + 150).includes('Purchasable');
  })());

  buyBusinessLevel('supermarket_1');
  Businesses.render();
  check('catalog now offers "Open Another Chain" (1/6 open)', container.innerHTML.includes('Open Another Chain') && container.innerHTML.includes('1/6 chains open'));
  check('"Open Another Chain" targets the next sequential chain id', /data-buy="supermarket_2"/.test(container.innerHTML));
  check('still exactly one Supermarket Chain row while some are open', (container.innerHTML.match(/Supermarket Chain</g) || []).length === 1);

  for (let i = 2; i <= 6; i++) buyBusinessLevel('supermarket_' + i);
  Businesses.render();
  check('catalog shows the max-chains message once all 6 are open', container.innerHTML.includes('Max amount of chains purchased'));
  check('no purchase button remains on the maxed-out family row', ![1, 2, 3, 4, 5, 6].some((i) => container.innerHTML.includes('data-buy="supermarket_' + i + '"')));

  // "My Businesses" still lists every opened chain as its own separate card.
  container._listeners.click({ target: fakeBizBtn({ bizNav: 'mine' }) });
  check('"My Businesses" lists all 6 opened chains individually, each with its own Manage button',
    [1, 2, 3, 4, 5, 6].every((i) => container.innerHTML.includes('data-manage="supermarket_' + i + '"')));
})();

/* ===================== F) Property deposits scale with quality tier ===================== */
(function () {
  function bizStubContainer() {
    return {
      innerHTML: '', _listeners: {},
      addEventListener(type, fn) { this._listeners[type] = fn; },
      removeEventListener() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
    };
  }
  function fakeBizBtn(dataset) { return { closest: () => ({ dataset, disabled: false }) }; }
  globalThis.document = {
    getElementById: () => null,
    createElement: () => ({ style: {}, addEventListener() {} }),
    body: { style: {} },
    querySelector: () => null,
    querySelectorAll: () => [],
  };

  state = defaultState();
  state.balance = 1e15;
  state.totalEarned = 1e20;
  const container = bizStubContainer();
  Businesses.mount(container);

  // formatMoney abbreviates >= $10,000 ("$10.78K", not "$10,780.00") — parse
  // both the plain and the K/M/B/T-suffixed forms rather than assuming one.
  const MONEY_SUFFIX_MULT = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };
  function parseMoney(str) {
    const m = str.match(/[$]([0-9,.]+)([KMBT]?)/);
    if (!m) return NaN;
    return parseFloat(m[1].split(',').join('')) * (MONEY_SUFFIX_MULT[m[2]] || 1);
  }

  container._listeners.click({ target: fakeBizBtn({ buy: 'supermarket_1' }) }); // opens the setup wizard (Details stage)
  container._listeners.click({ target: fakeBizBtn({ setupType: 'grocery' }) });
  container._listeners.click({ target: fakeBizBtn({ setupContinueStage: '' }) }); // -> Property browse (London, UK is the default first city)

  check('the property browse screen shows the max-properties-per-franchise note', container.innerHTML.includes('Maximum of 16 properties per Supermarket Chain franchise'));

  // London's list (js/data/properties.js) is: [0] Riverside Market (Store 1,
  // modest) .. [5] East London Fresh (Store 6, flagship) — real named
  // properties, not synthetic test fixtures.
  container._listeners.click({ target: fakeBizBtn({ setupProperty: propertySlug('Riverside Market') }) });
  const store1Cost = parseMoney((container.innerHTML.match(/Pay Deposit .{1,3}[$][0-9,.]+[KMBT]?/) || [''])[0]);

  container._listeners.click({ target: fakeBizBtn({ setupBack: '' }) }); // back to browse without depositing
  container._listeners.click({ target: fakeBizBtn({ setupProperty: propertySlug('East London Fresh') }) });
  const store6Cost = parseMoney((container.innerHTML.match(/Pay Deposit .{1,3}[$][0-9,.]+[KMBT]?/) || [''])[0]);

  check('a modest Store 1 property has a real, finite deposit cost', Number.isFinite(store1Cost) && store1Cost > 0);
  check('a flagship Store 6 property costs more to deposit on than a modest Store 1', store6Cost > store1Cost);
  check('the Store 6 : Store 1 deposit ratio matches the designed tier multipliers (2.2x : 0.6x)', approx(store6Cost / store1Cost, 2.2 / 0.6, 0.02));

  // Actually pay the (cheaper) Store 1 deposit, then confirm Buy It Outright
  // on THAT specific property also reflects its own (low) tier cost.
  container._listeners.click({ target: fakeBizBtn({ setupBack: '' }) });
  container._listeners.click({ target: fakeBizBtn({ setupProperty: propertySlug('Riverside Market') }) });
  const balBeforeDeposit = state.balance;
  container._listeners.click({ target: fakeBizBtn({ setupRent: '' }) });
  check('the deposit actually charged matches the price shown on the listing', approx(balBeforeDeposit - state.balance, store1Cost, 0.001));

  const balBeforeOutright = state.balance;
  const outrightOk = Businesses.buyPropertyOutright('supermarket_1:0');
  check('Buy It Outright on the same Store 1 property succeeds', outrightOk === true);
  const outrightCost = balBeforeOutright - state.balance;
  check('Buy It Outright cost is also finite and real (Store 1 tier, not a flat unscaled price)', Number.isFinite(outrightCost) && outrightCost > 0);
})();

/* ===================== G) Business list cards no longer show Income/Startup ===================== */
(function () {
  function bizStubContainer() {
    return {
      innerHTML: '', _listeners: {},
      addEventListener(type, fn) { this._listeners[type] = fn; },
      removeEventListener() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
    };
  }
  function fakeBizBtn(dataset) { return { closest: () => ({ dataset, disabled: false }) }; }
  globalThis.document = {
    getElementById: () => null,
    createElement: () => ({ style: {}, addEventListener() {} }),
    body: { style: {} },
    querySelector: () => null,
    querySelectorAll: () => [],
  };

  state = defaultState();
  state.balance = 1e15;
  state.totalEarned = 1e20;
  const container = bizStubContainer();
  Businesses.mount(container); // listMode 'all' — every not-yet-owned card, including the chain family card

  check('Purchasable list shows no "Income" stat on any card', !container.innerHTML.includes('>Income<'));
  check('Purchasable list shows no "Startup" cost box on any card', !container.innerHTML.includes('>Startup<') && !container.innerHTML.includes('>Startup from<'));

  buyBusinessLevel('supermarket_1');
  buyBusinessLevel('hotels');
  Businesses.render();
  container._listeners.click({ target: fakeBizBtn({ bizNav: 'mine' }) });
  check('"My Businesses" owned cards show no "Net income" stat either', !container.innerHTML.includes('>Net income<'));
  check('"My Businesses" owned cards are themselves the Manage tap target (no separate button)', /data-manage="hotels"/.test(container.innerHTML)
    && !container.innerHTML.includes('Manage Business'));
})();

/* ===================== H) World Map property markers ===================== */
(function () {
  state = defaultState();
  state.balance = 1e15;
  state.totalEarned = 1e20;
  buyBusinessLevel('supermarket_1');
  const biz = getBiz('supermarket_1');
  const uk = BUSINESS_PROPERTIES.supermarket.countries.find((c) => c.id === 'uk');
  const au = BUSINESS_PROPERTIES.supermarket.countries.find((c) => c.id === 'au');
  const london = uk.cities.find((c) => c.name === 'London');
  const sydney = au.cities.find((c) => c.name === 'Sydney');
  const riverside = london.properties[0];   // London, real coords
  const centralHub = london.properties[1];  // London too — same city, different real landmark
  const circularQuay = sydney.properties[0]; // Sydney — a different country entirely

  biz.properties.push({ countryId: 'uk', city: 'London', propertyId: propertySlug(riverside.name), tenure: 'rent' });
  biz.properties.push({ countryId: 'uk', city: 'London', propertyId: propertySlug(centralHub.name), tenure: 'rent' });
  biz.properties.push({ countryId: 'au', city: 'Sydney', propertyId: propertySlug(circularQuay.name), tenure: 'rent' });

  const markers = Businesses._worldMapMarkers();
  check('one marker exists per owned property (3 owned -> 3 markers)', markers.length === 3);
  check('every marker is keyed "bizId:idx" matching biz.properties order', markers.every((m, i) => m.bizId === 'supermarket_1' && m.idx === i));
  check('every marker carries the real lat/lon from the catalog (not a generic city-center guess)',
    markers[0].lat === riverside.lat && markers[0].lon === riverside.lon
    && markers[2].lat === circularQuay.lat && markers[2].lon === circularQuay.lon);

  // Projection sanity: per-country affine fit (js/businesses.js
  // MAP_COUNTRY_PROJECTION), calibrated against the real map SVG's own
  // getBBox() per country — NOT a single global equirectangular formula
  // (that one put a London property's marker over Germany, and even a
  // global regression still put a Vancouver property in the ocean).
  const UK_PROJ = { sx: 2.2842, ox: 476.29, sy: -2.9131, oy: 242.26 };
  const AU_PROJ = { sx: 3.7445, ox: 352.02, sy: -4.0979, oy: 244.06 };
  check('UK marker matches the calibrated UK projection', approx(markers[0].x, riverside.lon * UK_PROJ.sx + UK_PROJ.ox, 0.0001)
    && approx(markers[0].y, riverside.lat * UK_PROJ.sy + UK_PROJ.oy, 0.0001));
  check('AU marker matches the calibrated AU projection (different constants than UK)', approx(markers[2].x, circularQuay.lon * AU_PROJ.sx + AU_PROJ.ox, 0.0001)
    && approx(markers[2].y, circularQuay.lat * AU_PROJ.sy + AU_PROJ.oy, 0.0001));
  check('two properties in the SAME city (London) land at genuinely different map points', markers[0].x !== markers[1].x || markers[0].y !== markers[1].y);
  check('same-city markers are separated by a real, visually-distinguishable margin (not sub-pixel apart)',
    Math.hypot(markers[0].x - markers[1].x, markers[0].y - markers[1].y) > 1.0);
  check('a property in a different country/city lands far away on the map (Sydney vs London)', Math.abs(markers[2].x - markers[0].x) > 100);
  check('UK marker actually lands within the real UK landmass on the map (not another country)',
    markers[0].x >= 457.6 - 1 && markers[0].x <= 480.3 + 1 && markers[0].y >= 65.0 - 1 && markers[0].y <= 96.9 + 1);
  check('AU marker actually lands within the real Australia landmass on the map', markers[2].x >= 775.7 - 1 && markers[2].x <= 927.3 + 1
    && markers[2].y >= 285.2 - 1 && markers[2].y <= 422.8 + 1);

  // Regression: Vancouver (a real west-coast Canadian property) used to
  // land ~23 units out in the Pacific Ocean under a single global
  // projection formula — the per-country fit must place it inside
  // Canada's real bbox on the map, same as every other Canadian city.
  (function () {
    const ca = BUSINESS_PROPERTIES.supermarket.countries.find((c) => c.id === 'ca');
    const vancouver = ca.cities.find((c) => c.name === 'Vancouver');
    const gastown = vancouver.properties[0];
    const CA_PROJ = { sx: 2.4628, ox: 511.28, sy: -2.7156, oy: 234.92 };
    const x = gastown.lon * CA_PROJ.sx + CA_PROJ.ox;
    const y = gastown.lat * CA_PROJ.sy + CA_PROJ.oy;
    check('Vancouver (a real west-coast Canadian city) lands inside Canada real bbox on the map, not out in the ocean',
      x >= 164.0 - 1 && x <= 381.7 + 1 && y >= 9.2 - 1 && y <= 121.7 + 1);
  })();

  // A business with no property catalog contributes zero markers.
  buyBusinessLevel('hotels');
  const markersAfterHotels = Businesses._worldMapMarkers();
  check('a business without a property catalog adds no markers', markersAfterHotels.length === 3);

  // Marker detail popup — a compact COMPANY IDENTITY card (store type,
  // business name, company name, which property/location), not the full
  // real-estate listing page.
  biz.brand = { storeType: 'jewellery', companyName: 'Singh' };
  const detailHtml = Businesses._mapPropertyDetailHTML('supermarket_1', 0);
  check('the marker detail popup shows the company name', detailHtml.includes('Singh'));
  check('the marker detail popup shows the store type', detailHtml.includes('Jewellery'));
  check('the marker detail popup shows the business name', detailHtml.includes('Supermarket Chain 1'));
  check('the marker detail popup shows which property/location this is', detailHtml.includes('Riverside Market') && detailHtml.includes('London'));
  check('the marker detail popup shows a real back/close control', detailHtml.includes('data-biz-nav="closeMapDetail"'));
  check('the marker detail popup offers a Manage Business link, not property-listing actions',
    /data-manage="supermarket_1"/.test(detailHtml) && !detailHtml.includes('Pay Deposit') && !detailHtml.includes('Buy It Outright'));
  check('the marker detail popup is NOT the full real-estate listing (no "About This Property" prose)', !detailHtml.includes('About This Property'));

  const detailHtml2 = Businesses._mapPropertyDetailHTML('supermarket_1', 2);
  check('a different index shows that property instead (Circular Quay Market, Sydney)', detailHtml2.includes('Circular Quay Market') && detailHtml2.includes('Sydney'));

  // Tapping "Manage Business" from the marker card closes the map and opens BizDash.
  (function () {
    globalThis.document = {
      createElement: (tag) => ({ tagName: tag, className: '', innerHTML: '', _listeners: {}, addEventListener(type, fn) { this._listeners[type] = fn; }, remove() {} }),
      body: { children: [], appendChild(el) { this.children.push(el); }, style: {} },
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
    };
    const container = { innerHTML: '', _listeners: {}, addEventListener(type, fn) { this._listeners[type] = fn; }, removeEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
    Businesses.mount(container);
    container._listeners.click({ target: { closest: () => ({ dataset: { bizNav: 'map' }, disabled: false }) } });
    mapPropertyDetail_setForTest();
    function mapPropertyDetail_setForTest() {
      // simulate a marker tap the same way onClick does
      container._listeners.click({ target: { closest: () => ({ dataset: { mapMarker: 'supermarket_1:0' }, disabled: false }) } });
    }
    container._listeners.click({ target: { closest: () => ({ dataset: { manage: 'supermarket_1' }, disabled: false }) } });
    check('tapping Manage Business from the marker card opens the real BizDash overlay', document.body.children.length === 1
      && document.body.children[0].innerHTML.includes('Supermarket Chain 1'));
  })();

  const missingHtml = Businesses._mapPropertyDetailHTML('supermarket_1', 99);
  check('an out-of-range index degrades gracefully instead of crashing', typeof missingHtml === 'string' && missingHtml.length > 0);
})();

/* ===================== I) propertyMetrics — deterministic, distinct, composite Health formula ===================== */
(function () {
  const uk = BUSINESS_PROPERTIES.supermarket.countries.find((c) => c.id === 'uk');
  const london = uk.cities.find((c) => c.name === 'London');
  const p0 = london.properties[0], p3 = london.properties[3], p5 = london.properties[5];

  const m0a = propertyMetrics(p0, 'London', 0);
  const m0b = propertyMetrics(p0, 'London', 0);
  check('propertyMetrics is fully deterministic (same property -> byte-identical output)', JSON.stringify(m0a) === JSON.stringify(m0b));

  const m3 = propertyMetrics(p3, 'London', 3);
  const m5 = propertyMetrics(p5, 'London', 5);
  check('different properties land on genuinely different metrics', m0a.health !== m3.health || m0a.satisfaction.score !== m3.satisfaction.score);
  check('a third different property is also distinct from the first two', (m5.health !== m0a.health || m5.security.score !== m0a.security.score)
    && (m5.health !== m3.health || m5.revenue.monthly !== m3.revenue.monthly));

  check('composite Health = average of Satisfaction/Promotion/Security category scores (NOT revenue)',
    m0a.health === Math.round((m0a.satisfaction.score + m0a.promotion.score + m0a.security.score) / 3));

  check('capacity max matches the same sqft/100 formula the property listing page already shows', m0a.capacity.max === Math.round(p0.sqft / 100));
  check('capacity current never exceeds max', m0a.capacity.current <= m0a.capacity.max && m3.capacity.current <= m3.capacity.max);

  check('security counts stay within their own totals', m0a.security.cctvOwned <= m0a.security.cctvTotal && m0a.security.doorAlarmOwned <= m0a.security.doorAlarmTotal);

  const d0 = propertyDetails(p0, 'London', 0);
  check('revenue.monthly reuses the exact same expectedAnnualRevenue/12 already shown on the listing page', m0a.revenue.monthly === Math.round(d0.financials.expectedAnnualRevenue / 12));
  check('revenue expenses sum to totalExpenses exactly', m0a.revenue.expenses.reduce((s, e) => s + e.amount, 0) === m0a.revenue.totalExpenses);
  check('netProfit = monthly revenue - totalExpenses', m0a.revenue.netProfit === m0a.revenue.monthly - m0a.revenue.totalExpenses);
  check('one of the expense line items is the property’s own real monthlyRent', m0a.revenue.expenses.some((e) => e.label === 'Rent' && e.amount === d0.financials.monthlyRent));

  check('traffic has a 24-hour breakdown for yesterday, and total is the sum of those hours', m0a.traffic.hourly.length === 24
    && m0a.traffic.total === m0a.traffic.hourly.reduce((s, v) => s + v, 0));
  check('every hourly traffic figure is non-negative', m0a.traffic.hourly.every((v) => v >= 0));
})();

/* ===================== J) StorePage: Store Overview + Performance ===================== */
(function () {
  const created = [];
  function stubEl(tag) {
    const elx = {
      tagName: tag, className: '', innerHTML: '', _listeners: {},
      addEventListener(type, fn) { this._listeners[type] = fn; },
      remove() { this._removed = true; },
      querySelector() { return null; }, querySelectorAll() { return []; },
    };
    created.push(elx);
    return elx;
  }
  globalThis.document = {
    createElement: (tag) => stubEl(tag),
    body: { children: [], appendChild(elx) { this.children.push(elx); } },
  };
  function fakeBtn(dataset) { return { closest: () => ({ dataset, disabled: false }) }; }

  state = defaultState();
  state.balance = 1e15;
  state.totalEarned = 1e20;
  buyBusinessLevel('supermarket_1');
  const biz = getBiz('supermarket_1');
  const uk = BUSINESS_PROPERTIES.supermarket.countries.find((c) => c.id === 'uk');
  const london = uk.cities.find((c) => c.name === 'London');
  const riverside = london.properties[0];
  const eastLondon = london.properties[5];
  biz.properties.push({ countryId: 'uk', city: 'London', propertyId: propertySlug(riverside.name), tenure: 'rent' });
  biz.properties.push({ countryId: 'uk', city: 'London', propertyId: propertySlug(eastLondon.name), tenure: 'purchase' });
  biz.brand = { storeType: 'jewellery', companyName: 'Singh' };

  StorePage.open('supermarket_1', 0);
  check('StorePage.open() appends one real screen to the page', document.body.children.length === 1);
  const el = created[created.length - 1];
  check('Overview shows the real property name and company name', el.innerHTML.includes('Riverside Market') && el.innerHTML.includes('Singh'));
  check('Overview shows the tenure chip matching this property’s real tenure (Rented)', el.innerHTML.includes('>Rented<'));
  check('Overview shows a real Health number matching propertyMetrics', el.innerHTML.includes('store-health-badge-num">' + propertyMetrics(riverside, 'London', 0).health + '<'));
  check('Overview has all 4 tab pills and defaults to Summary (Yesterday’s Traffic)', el.innerHTML.includes('>Summary<') && el.innerHTML.includes('>Schedule<')
    && el.innerHTML.includes('>Inventory<') && el.innerHTML.includes('>Marketing<') && el.innerHTML.includes('Yesterday'));

  // Tab switching within Overview (Summary/Schedule/Inventory/Marketing).
  el._listeners.click({ target: fakeBtn({ storeTab: 'schedule' }) });
  const schedEl = created[created.length - 1];
  check('Schedule tab shows real operating hours for this property’s tier', schedEl.innerHTML.includes('Operating Hours'));

  el._listeners.click({ target: fakeBtn({ storeTab: 'inventory' }) });
  const invEl = created[created.length - 1];
  check('Inventory tab shows the property’s real amenities and the Capacity ring', invEl.innerHTML.includes('Amenities') && invEl.innerHTML.includes('Capacity'));

  el._listeners.click({ target: fakeBtn({ storeTab: 'marketing' }) });
  const mktEl = created[created.length - 1];
  check('Marketing tab is a condensed snapshot, not the Performance Promotion bars', mktEl.innerHTML.includes('Marketing Snapshot') && !mktEl.innerHTML.includes('Loyalty Program'));

  el._listeners.click({ target: fakeBtn({ storeTab: 'summary' }) });

  // Health badge tap -> Performance.
  el._listeners.click({ target: fakeBtn({ storeNav: 'performance' }) });
  const perfEl = created[created.length - 1];
  check('tapping the Health badge navigates to Performance', perfEl.innerHTML.includes('Health Score') && perfEl.innerHTML.includes('store-cat-tabs'));
  check('Performance defaults to the Satisfaction category', perfEl.innerHTML.includes('Customer Service'));

  // Category switching.
  el._listeners.click({ target: fakeBtn({ storeCat: 'security' }) });
  const secEl = created[created.length - 1];
  check('switching to the Security category shows real equipment counts', secEl.innerHTML.includes('CCTV Cameras'));
  const m = propertyMetrics(riverside, 'London', 0);
  check('Security panel shows this exact property’s real CCTV owned/total', secEl.innerHTML.includes('>' + m.security.cctvOwned + '/' + m.security.cctvTotal + '<'));

  el._listeners.click({ target: fakeBtn({ storeCat: 'revenue' }) });
  const revEl = created[created.length - 1];
  check('switching to the Revenue category shows a real monthly figure and an expenses accordion', revEl.innerHTML.includes('Monthly Revenue') && revEl.innerHTML.includes('Expenses ·'));

  // Performance's own back control returns to Overview (does not close the whole screen).
  el._listeners.click({ target: fakeBtn({ storeNav: 'back' }) });
  check('Performance’s back control returns to Overview, not a full close', created[created.length - 1].innerHTML.includes('Yesterday')
    && document.body.children.length === 1);

  // Expenses accordion state (logic-level — see the real headless-browser
  // check for the actual CSS class/visual confirmation).
  el._listeners.click({ target: fakeBtn({ storeNav: 'performance' }) });
  el._listeners.click({ target: fakeBtn({ storeCat: 'revenue' }) });
  check('expenses start collapsed', StorePage._state().expensesOpen === false);
  el._listeners.click({ target: fakeBtn({ storeExpensesToggle: '' }) });
  check('tapping the expenses row opens the accordion (state flips)', StorePage._state().expensesOpen === true);
  el._listeners.click({ target: fakeBtn({ storeExpensesToggle: '' }) });
  check('tapping it again closes the accordion', StorePage._state().expensesOpen === false);

  // Manage -> closes StorePage (BizDash's own Manage screen is already open underneath in the real app).
  const beforeClose = document.body.children.length;
  el._listeners.click({ target: fakeBtn({ storeNav: 'manage' }) });
  check('Manage closes the StorePage overlay', created[created.length - 1]._removed === true);

  // A second, different property shows genuinely different real data through the exact same page.
  StorePage.open('supermarket_1', 1);
  const el2 = created[created.length - 1];
  check('a different owned property opens its own distinct Store Overview', el2.innerHTML.includes('East London Fresh') && !el2.innerHTML.includes('Riverside Market'));
  check('the second property shows its own real tenure (Owned, not Rented)', el2.innerHTML.includes('>Owned<') && !el2.innerHTML.includes('>Rented<'));
  const health2 = propertyMetrics(eastLondon, 'London', 5).health;
  check('the second property shows its own real, distinct Health number', el2.innerHTML.includes('store-health-badge-num">' + health2 + '<') && health2 !== propertyMetrics(riverside, 'London', 0).health);

  // A third owned property, in a different country entirely.
  const au = BUSINESS_PROPERTIES.supermarket.countries.find((c) => c.id === 'au');
  const sydney = au.cities.find((c) => c.name === 'Sydney');
  const circularQuay = sydney.properties[0];
  biz.properties.push({ countryId: 'au', city: 'Sydney', propertyId: propertySlug(circularQuay.name), tenure: 'rent' });
  StorePage.open('supermarket_1', 2);
  const el3 = created[created.length - 1];
  check('a third owned property (a different country) also opens its own distinct page', el3.innerHTML.includes('Circular Quay Market') && el3.innerHTML.includes('Sydney, Australia'));

  // Invalid index degrades gracefully.
  const beforeInvalid = created.length;
  StorePage.open('supermarket_1', 99);
  check('opening an out-of-range property index does not create a broken screen', created.length === beforeInvalid);
})();

/* ===================== K) Property list rows open their own Store Overview ===================== */
(function () {
  const created = [];
  globalThis.document = {
    createElement: (tag) => {
      const elx = { tagName: tag, className: '', innerHTML: '', _listeners: {},
        addEventListener(type, fn) { this._listeners[type] = fn; },
        remove() {},
        querySelector() { return null; }, querySelectorAll() { return []; } };
      created.push(elx);
      return elx;
    },
    body: { children: [], appendChild(elx) { this.children.push(elx); }, style: {} },
  };
  function fakeBtn(dataset) { return { closest: () => ({ dataset, disabled: false }) }; }

  state = defaultState();
  state.balance = 1e15;
  state.totalEarned = 1e20;
  buyBusinessLevel('supermarket_1');
  const biz = getBiz('supermarket_1');
  const uk = BUSINESS_PROPERTIES.supermarket.countries.find((c) => c.id === 'uk');
  const london = uk.cities.find((c) => c.name === 'London');
  biz.properties.push({ countryId: 'uk', city: 'London', propertyId: propertySlug(london.properties[0].name), tenure: 'rent' });
  biz.brand = { storeType: 'grocery', companyName: 'Fresh Co' };

  const html = Businesses.propertyOverviewHTML(BUSINESS_BY_ID['supermarket_1'], biz);
  check('each property row in the Properties list is a real clickable target keyed "bizId:index"', /data-open-store="supermarket_1:0"/.test(html));

  BizDash.open('supermarket_1');
  const dashEl = created[created.length - 1];
  dashEl._listeners.click({ target: fakeBtn({ openStore: 'supermarket_1:0' }) });
  check('tapping a property row in the real Manage Business screen opens its Store Overview', document.body.children.length === 2
    && document.body.children[1].innerHTML.includes('Riverside Market'));
})();

/* ===================== L) Redesigned owned-business card ===================== */
(function () {
  function bizStubContainer() {
    return {
      innerHTML: '', _listeners: {},
      addEventListener(type, fn) { this._listeners[type] = fn; },
      removeEventListener() {},
      querySelector() { return null; }, querySelectorAll() { return []; },
    };
  }
  function fakeBizBtn(dataset) { return { closest: () => ({ dataset, disabled: false }) }; }
  globalThis.document = {
    getElementById: () => null,
    createElement: () => ({ style: {}, addEventListener() {} }),
    body: { style: {} },
    querySelector: () => null, querySelectorAll: () => [],
  };

  state = defaultState();
  state.balance = 1e15;
  state.totalEarned = 1e20;
  buyBusinessLevel('supermarket_1');
  const chainBiz = getBiz('supermarket_1');
  const uk = BUSINESS_PROPERTIES.supermarket.countries.find((c) => c.id === 'uk');
  const london = uk.cities.find((c) => c.name === 'London');
  chainBiz.properties.push({ countryId: 'uk', city: 'London', propertyId: propertySlug(london.properties[0].name), tenure: 'rent' });
  chainBiz.brand = { storeType: 'jewellery', companyName: 'Singh' };
  buyBusinessLevel('entvenue');

  const container = bizStubContainer();
  Businesses.mount(container);
  container._listeners.click({ target: fakeBizBtn({ bizNav: 'mine' }) });
  const html = container.innerHTML;

  check('the old "Lv X" level badge is gone from owned cards', !html.includes('class="biz-level"'));
  check('the old "Chain X/6" progress indicator is gone from owned cards', !html.includes('chains open') && !html.includes('biz-chain-badge'));
  check('no per-second income figure appears on the Supermarket Chain card itself (the header total above the list is a separate, pre-existing summary)',
    !html.slice(html.indexOf('Singh'), html.indexOf('Singh') + 900).includes('/s<'));

  check('Supermarket Chain 1 (has a type + properties) shows its real company name and type pill', html.includes('>Singh<') && html.includes('>Jewellery<'));
  check('Supermarket Chain 1 shows a real Properties stat (1/16)', html.includes('>1/16<'));
  check('Supermarket Chain 1 shows a Value stat with a real, non-zero figure', (function () {
    const idx = html.indexOf('Singh');
    const chunk = html.slice(idx, idx + 900);
    const labelIdx = chunk.indexOf('biz-card-stat-label">Value<');
    if (labelIdx < 0) return false;
    const valueIdx = chunk.indexOf('biz-card-stat-value">', labelIdx);
    const value = chunk.slice(valueIdx + 'biz-card-stat-value">'.length, chunk.indexOf('<', valueIdx + 'biz-card-stat-value">'.length));
    return value !== '$0.00' && value.length > 0;
  })());
  check('Value matches the same businessSpentOnLevels figure the Sell menu already uses', html.includes('>' + formatMoney(businessSpentOnLevels(BUSINESS_BY_ID['supermarket_1'])) + '<'));

  check('Entertainment Venue Company (no type, no properties) shows the Value stat alone', (function () {
    const idx = html.indexOf('Entertainment Venue Company');
    if (idx < 0) return false;
    const chunk = html.slice(idx - 300, idx + 700);
    return chunk.includes('biz-card-stat-label">Value<') && !chunk.includes('biz-card-stat-label">Properties<') && !/biz-card-type-pill/.test(chunk.slice(0, 400));
  })());

  check('each business type gets its own distinct gradient tile class', html.includes('biz-logo-tile-supermarket') && html.includes('biz-logo-tile-entvenue'));
  check('the whole card (not a separate button) is the real Manage tap target', /data-manage="supermarket_1"/.test(html) && /data-manage="entvenue"/.test(html));

  // Tapping the card still opens the right business's real dedicated page.
  globalThis.document = {
    createElement: (tag) => ({ tagName: tag, className: '', innerHTML: '', _listeners: {}, addEventListener(type, fn) { this._listeners[type] = fn; }, remove() {} }),
    body: { children: [], appendChild(el) { this.children.push(el); }, style: {} },
  };
  container._listeners.click({ target: fakeBizBtn({ manage: 'entvenue' }) });
  check('tapping the card opens that exact business’s Manage page', document.body.children.length === 1 && document.body.children[0].innerHTML.includes('Entertainment Venue Company'));

  // The kebab (⋮) Sell menu stays independently clickable and doesn't trigger navigation.
  const beforeMenuClick = document.body.children.length;
  container._listeners.click({ target: fakeBizBtn({ bizMenu: 'entvenue' }) });
  check('the ⋮ menu button toggles independently of the card tap (no extra Manage page opened)', document.body.children.length === beforeMenuClick);
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
