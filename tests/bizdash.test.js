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

/* ===================== C2) Manage Business is Coming Soon for chains; propertyOverviewHTML/buyPropertyOutright still work as pure functions ===================== */
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
  buyBusinessLevel('supermarket_1');
  const biz = getBiz('supermarket_1');
  const uk = BUSINESS_PROPERTIES.supermarket.countries.find((c) => c.id === 'uk');
  const london = uk.cities.find((c) => c.name === 'London');
  const riverside = london.properties[0]; // "Riverside Market"
  biz.properties.push({ countryId: 'uk', city: 'London', propertyId: propertySlug(riverside.name), tenure: 'rent' });
  biz.brand = { storeType: 'grocery', companyName: 'Fresh Co' };

  BizDash.open('supermarket_1');
  const el = created[created.length - 1];
  check('Manage Business on a Supermarket Chain shows Coming Soon, not the tabbed dashboard', el.innerHTML.includes('COMING SOON'));
  check('the Coming Soon screen still names the specific chain', el.innerHTML.includes('Supermarket Chain 1'));
  check('the Coming Soon screen has no tabs (Overview/Operations/Staff/Upgrades all gone)', !el.innerHTML.includes('data-bizd-tab'));
  check('the Coming Soon screen offers no Properties card or Buy It Outright button', !el.innerHTML.includes('Properties ·') && !el.innerHTML.includes('Buy It Outright'));
  check('the Coming Soon screen offers no Add Property button', !el.innerHTML.includes('data-add-property'));
  check('the Coming Soon screen is still closable', el.innerHTML.includes('data-bizd-close'));
  BizDash.close();

  // A non-chain business is completely unaffected — still the full tabbed dashboard.
  buyBusinessLevel('hotels');
  BizDash.open('hotels');
  const hotelsEl = created[created.length - 1];
  check('a non-chain business still opens the real tabbed dashboard, not Coming Soon', !hotelsEl.innerHTML.includes('COMING SOON') && hotelsEl.innerHTML.includes('Net Income'));
  check('a non-chain business without a property catalog shows no Properties card', !hotelsEl.innerHTML.includes('card-title">Properties'));
  BizDash.close();

  // propertyOverviewHTML and buyPropertyOutright are unreachable through
  // BizDash's UI now, but the underlying functions are still exported and
  // still correct — exercised directly here as pure functions (per the
  // user: Manage Business's features get rebuilt/re-wired their own way
  // later, this logic isn't deleted, just currently unreachable from the UI).
  const overviewHtml = Businesses.propertyOverviewHTML(BUSINESS_BY_ID['supermarket_1'], biz);
  check('propertyOverviewHTML (called directly) still renders the Properties card correctly', overviewHtml.includes('Riverside Market')
    && overviewHtml.includes('Fresh Co') && overviewHtml.includes('Properties · 1/16'));
  check('propertyOverviewHTML (called directly) still offers Buy It Outright, keyed "bizId:index"', /data-buy-outright="supermarket_1:0"/.test(overviewHtml));

  const balBefore = state.balance;
  const levelBefore = biz.level;
  const outrightOk = Businesses.buyPropertyOutright('supermarket_1:0');
  check('buyPropertyOutright (called directly) still charges real money and succeeds', outrightOk === true && state.balance < balBefore);
  check('buyPropertyOutright (called directly) still bumps the business level', biz.level === levelBefore + 1);
  check('buyPropertyOutright (called directly) still flips the property record to purchase', biz.properties[0].tenure === 'purchase');
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
  check('"My Businesses" owned cards still show Manage Business', container.innerHTML.includes('Manage Business'));
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

  // Projection sanity: equirectangular onto the 1000 x 507.209 viewBox.
  check('projection: x = (lon+180)/360*1000', approx(markers[0].x, (riverside.lon + 180) / 360 * 1000, 0.0001));
  check('projection: y = (90-lat)/180*507.209', approx(markers[0].y, (90 - riverside.lat) / 180 * 507.209, 0.0001));
  check('two properties in the SAME city (London) land at genuinely different map points', markers[0].x !== markers[1].x || markers[0].y !== markers[1].y);
  check('a property in a different country/city lands far away on the map (Sydney vs London)', Math.abs(markers[2].x - markers[0].x) > 100);

  // A business with no property catalog contributes zero markers.
  buyBusinessLevel('hotels');
  const markersAfterHotels = Businesses._worldMapMarkers();
  check('a business without a property catalog adds no markers', markersAfterHotels.length === 3);

  // Marker detail popup — the same premium listing template, read-only.
  biz.brand = { storeType: 'grocery', companyName: 'Fresh Co' };
  const detailHtml = Businesses._mapPropertyDetailHTML('supermarket_1', 0);
  check('the marker detail popup shows the real property name', detailHtml.includes('Riverside Market'));
  check('the marker detail popup shows the owning company name', detailHtml.includes('Fresh Co'));
  check('the marker detail popup shows the chain name', detailHtml.includes('Supermarket Chain 1'));
  check('the marker detail popup shows a real back/close control', detailHtml.includes('data-biz-nav="closeMapDetail"'));
  check('the marker detail popup is read-only (no Pay Deposit / Buy It Outright actions)', !detailHtml.includes('Pay Deposit') && !detailHtml.includes('Buy It Outright'));

  const detailHtml2 = Businesses._mapPropertyDetailHTML('supermarket_1', 2);
  check('a different index shows that property instead (Circular Quay Market, Sydney)', detailHtml2.includes('Circular Quay Market') && detailHtml2.includes('Sydney'));

  const missingHtml = Businesses._mapPropertyDetailHTML('supermarket_1', 99);
  check('an out-of-range index degrades gracefully instead of crashing', typeof missingHtml === 'string' && missingHtml.length > 0);
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
