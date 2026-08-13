/* =========================================================================
 * tests/manageowned.test.js — headless tests for "Manage Your Owned
 * Companies": the new box under the Portfolio card on the Invest tab, and
 * the requirement that every 100%-owned stock/coin is ONLY manageable from
 * that dedicated page (not from its own detail page, not from Portfolio).
 * -------------------------------------------------------------------------
 * Run:  node tests/manageowned.test.js   (exit code 0 = all pass, 1 = a failure)
 * Same load-and-eval + DOM-stub pattern as tests/bizdash.test.js.
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

// --- Minimal DOM stub: real enough to capture Invest's real click handler
// (via addEventListener) and drive it, and real enough for TechCo.open() to
// append/remove a screen element from document.body. ---
const elStore = {};
function stubEl(id) {
  if (!elStore[id]) {
    elStore[id] = {
      id, className: '', innerHTML: '', dataset: {}, style: {},
      _listeners: {},
      addEventListener(type, fn) { this._listeners[type] = fn; },
      removeEventListener() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
      closest() { return null; },
      appendChild() {}, remove() { this._removed = true; },
      classList: { add() {}, remove() {}, toggle() {} },
    };
  }
  return elStore[id];
}
let anonN = 0;
const bodyChildren = [];
globalThis.document = {
  getElementById: (id) => (id === 'invChart' ? null : stubEl(id)), // skip real chart init — not under test here

  createElement: (tag) => { const el = stubEl('anon' + (anonN++)); el.tagName = tag; return el; },
  body: { style: {}, appendChild(el) { bodyChildren.push(el); }, style: {} },
  documentElement: stubEl('html'),
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
  hidden: false,
};
globalThis.window = { pageYOffset: 0, scrollTo() {} };
function fakeTarget(act, id, action) {
  return { closest: () => ({ dataset: { act, id, action }, disabled: false }) };
}
globalThis.UI = { showToast() {}, renderBalance() {} };

state = defaultState();
state.balance = 1e18;
Market.ensure();

const container = stubEl('invRoot');
Invest.mount(container);
container._listeners.click({ target: fakeTarget('finances') });

/* ===================== A0) No box at all when nothing is owned ===================== */
check('Markets list shows NO Manage box when nothing is owned', !container.innerHTML.includes('Manage Your Owned Companies'));

// One TECH-managed company (a stock) and one plain crypto coin — every stock
// is TechCo-managed in this game, so the simple 4-lever path only ever
// applies to crypto. Both bought out to exactly 100%.
const TECH_ID = 'auracle';
const PLAIN_ID = 'bitcorn';
check('sanity: auracle is TechCo-managed', TechCo.isManaged(TECH_ID));
check('sanity: bitcorn (crypto) is NOT TechCo-managed', !TechCo.isManaged(PLAIN_ID));
Market.buy(TECH_ID, 1e18);
state.balance = 1e18; // buy() spends balance; top back up for the second buyout
Market.buy(PLAIN_ID, 1e18);
check('auracle is 100% owned after buyout', Market.isOwned(TECH_ID));
check('bitcorn is 100% owned after buyout', Market.isOwned(PLAIN_ID));

container._listeners.click({ target: fakeTarget('finances') }); // re-render Markets now that we own things

/* ===================== A) The box under Portfolio, on Markets ===================== */
check('Markets list shows the Manage Your Owned Companies box once something is owned', container.innerHTML.includes('Manage Your Owned Companies'));
check('the box reports the correct owned count (2)', /2 companies you run/.test(container.innerHTML));
check('the box appears AFTER the Portfolio card in the markup', container.innerHTML.indexOf('Portfolio') < container.innerHTML.indexOf('Manage Your Owned Companies'));
check('the crown emoji is gone from the box', !container.innerHTML.includes('👑'));

/* ===================== B) Tapping the box opens the dedicated page, split by Stocks/Crypto ===================== */
container._listeners.click({ target: fakeTarget('manageOwned') });
check('Manage Owned Companies page has its own header', container.innerHTML.includes('Manage Your Owned Companies') && container.innerHTML.includes('back-link'));
check('Manage Owned Companies page has a Stocks/Crypto segment toggle', container.innerHTML.includes('data-act="mgmtSeg"') && /Stocks/.test(container.innerHTML) && /Crypto/.test(container.innerHTML));
check('default segment (Stocks) shows the tech company dashboard entry', container.innerHTML.includes('Manage Company') && container.innerHTML.includes('tc-entry'));
check('default segment (Stocks) does NOT show the crypto coin', !container.innerHTML.includes('Upgrade the network'));
check('no undefined/NaN leaks into the Manage Owned page (Stocks)', !/undefined|NaN/.test(container.innerHTML));

container._listeners.click({ target: fakeTarget('mgmtSeg', 'crypto') });
check('switching to Crypto shows the crypto coin manage card', container.innerHTML.includes('manage-grid') && container.innerHTML.includes('Upgrade the network'));
check('switching to Crypto hides the tech company (a stock)', !container.innerHTML.includes('tc-entry'));
check('no undefined/NaN leaks into the Manage Owned page (Crypto)', !/undefined|NaN/.test(container.innerHTML));
container._listeners.click({ target: fakeTarget('mgmtSeg', 'stock') }); // leave it back on Stocks for the rest of the run

/* ===================== C) Portfolio no longer has an inline Manage section ===================== */
container._listeners.click({ target: fakeTarget('portfolio') });
check('Portfolio page has no "Manage" section header anymore', !container.innerHTML.includes('pf-manage-head'));
check('Portfolio page has no pf-manage-list (levers/dashboard entries) anymore', !container.innerHTML.includes('pf-manage-list'));

/* ===================== D) An owned asset's OWN detail page: teaser only, no controls ===================== */
container._listeners.click({ target: fakeTarget('finances') }); // back to Markets first
container._listeners.click({ target: fakeTarget('open', PLAIN_ID) });
check('owned plain stock detail page shows the teaser card', container.innerHTML.includes('owned-teaser-card') && container.innerHTML.includes('Manage Your Owned Companies'));
check('owned plain stock detail page does NOT show the 4 manage levers', !container.innerHTML.includes('manage-grid'));
check('owned plain stock detail page does NOT expose a raw data-act="manage" button', !container.innerHTML.includes('data-act="manage"'));

container._listeners.click({ target: fakeTarget('back') });
container._listeners.click({ target: fakeTarget('open', TECH_ID) });
check('owned tech company detail page shows the teaser card', container.innerHTML.includes('owned-teaser-card'));
check('owned tech company detail page does NOT show the old tc-entry dashboard snapshot', !container.innerHTML.includes('tc-entry'));
check('owned tech company detail page does NOT expose data-act="managehub" directly', !container.innerHTML.includes('data-act="managehub"'));

/* ===================== E) A NOT-owned asset is unaffected (regression) ===================== */
container._listeners.click({ target: fakeTarget('back') });
const UNOWNED_ID = 'wallmarket'; // any stock we never bought
container._listeners.click({ target: fakeTarget('open', UNOWNED_ID) });
check('an unowned asset still shows the normal buyout card', container.innerHTML.includes('buyout-card'));
check('an unowned asset does NOT show the owned teaser', !container.innerHTML.includes('owned-teaser-card'));

/* ===================== F) Clicking through from the Manage page actually works ===================== */
container._listeners.click({ target: fakeTarget('back') });
container._listeners.click({ target: fakeTarget('finances') });
container._listeners.click({ target: fakeTarget('manageOwned') });

// The crypto coin's "growth" lever, on the Crypto segment: routes through
// doManage -> Market.manage.
container._listeners.click({ target: fakeTarget('mgmtSeg', 'crypto') });
const balBefore = state.balance;
container._listeners.click({ target: fakeTarget('manage', PLAIN_ID, 'growth') });
check('the growth lever from the Manage page actually spent cash (Market.manage ran for real)', state.balance < balBefore);

// The tech company's "Manage Company" button, on the Stocks segment: routes
// through TechCo.open(). The dashboard's own DOM wiring is already
// exhaustively covered by techco.test.js — here we only need to confirm the
// click reaches it with the right id, so swap in a spy instead of running
// the real render.
container._listeners.click({ target: fakeTarget('mgmtSeg', 'stock') });
let openedWith = null;
const realTechCoOpen = TechCo.open;
TechCo.open = (id) => { openedWith = id; };
container._listeners.click({ target: fakeTarget('managehub', TECH_ID) });
check('the "Manage Company" button from the Manage page calls TechCo.open with the right id', openedWith === TECH_ID);
TechCo.open = realTechCoOpen;

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
