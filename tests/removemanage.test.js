/* =========================================================================
 * tests/removemanage.test.js — headless tests confirming "Manage Company"
 * has been fully removed for every stock and crypto: no entry points, no
 * boxes, no buttons anywhere — while Buy/Sell, the "Owned" status, and the
 * existing passive 100%-owner income are all completely untouched.
 * -------------------------------------------------------------------------
 * Run:  node tests/removemanage.test.js   (exit code 0 = all pass, 1 = a failure)
 * Same load-and-eval + DOM-stub pattern as the other Invest-side tests.
 * ========================================================================= */

const fs = require('fs');
const path = require('path');

globalThis.NOW = 1700000000000;
Date.now = () => globalThis.NOW;
let _perfNow = 0;
globalThis.performance = { now: () => _perfNow };
globalThis.addEventListener = () => {};
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
globalThis.window = { pageYOffset: 0, scrollTo() {} };
globalThis.UI = { showToast() {}, renderBalance() {} };

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

// --- Minimal DOM stub, same shape as the other Invest-side tests. ---
const elStore = {};
function stubEl(id) {
  if (!elStore[id]) {
    elStore[id] = {
      id, className: '', innerHTML: '', dataset: {}, style: {},
      _listeners: {},
      addEventListener(type, fn) { this._listeners[type] = fn; },
      removeEventListener(type) { delete this._listeners[type]; },
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
  getElementById: (id) => (id === 'invChart' ? null : stubEl(id)), // skip real chart init — not under test
  createElement: (tag) => { const el = stubEl('anon' + (anonN++)); el.tagName = tag; return el; },
  body: stubEl('body'),
  documentElement: stubEl('html'),
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
  hidden: false,
};
function click(root, act, id) { root._listeners.click({ target: { closest: () => ({ dataset: { act, id }, disabled: false }) } }); }

state = defaultState();
state.balance = 1e18;
Market.ensure();

// One TechCo-managed stock and one crypto coin, both bought out to 100% —
// exactly the two cases the old "Manage" system used to branch on.
const STOCK_ID = 'auracle';
const CRYPTO_ID = 'bitcorn';
Market.buy(STOCK_ID, 1e18);
state.balance = 1e18;
Market.buy(CRYPTO_ID, 1e18);
check(STOCK_ID + ' is 100% owned', Market.isOwned(STOCK_ID));
check(CRYPTO_ID + ' is 100% owned', Market.isOwned(CRYPTO_ID));

const root = stubEl('invRoot');
Invest.mount(root);
click(root, 'finances');

/* ===================== A) No "Manage" box on Markets ===================== */
check('Markets list has NO "Manage Your Owned Companies" box (removed entirely)', !root.innerHTML.includes('Manage Your Owned Companies') && !root.innerHTML.includes('manageOwned'));
check('Markets list has no leftover "Manage Company" text anywhere', !root.innerHTML.includes('Manage Company'));

/* ===================== B) manageOwned mode no longer exists at all ===================== */
click(root, 'manageOwned'); // simulate a stray click on a data-act that no longer has a handler
check('a stray manageOwned click does nothing (no such mode/handler exists anymore)', root.innerHTML.includes('Markets')); // still on Markets, unaffected

/* ===================== C) Owned STOCK detail page: no management, still says Owned ===================== */
click(root, 'open', STOCK_ID);
check('owned stock detail page shows "100% owned"', root.innerHTML.includes('100% owned'));
check('owned stock detail page has NO "Manage Company" button', !root.innerHTML.includes('Manage Company'));
check('owned stock detail page has NO "Manage Your Owned Companies" button', !root.innerHTML.includes('Manage Your Owned Companies'));
check('owned stock detail page has NO data-act="managehub" anywhere', !root.innerHTML.includes('data-act="managehub"'));
check('owned stock detail page has NO data-act="manage" anywhere', !root.innerHTML.includes('data-act="manage"'));
check('owned stock detail page has NO data-act="manageOwned" anywhere', !root.innerHTML.includes('data-act="manageOwned"'));
check('owned stock detail page still has working Buy and Sell buttons', root.innerHTML.includes('data-act="buy"') && root.innerHTML.includes('data-act="sell"'));
check('owned stock detail page mentions the passive owner income (unchanged, still automatic)', /pays you .* automatically/i.test(root.innerHTML));
check('no undefined/NaN on the owned stock detail page', !/undefined|NaN/.test(root.innerHTML));

/* ===================== D) Owned CRYPTO detail page: same — no 4-lever system ===================== */
click(root, 'back');
click(root, 'open', CRYPTO_ID);
check('owned crypto detail page shows "100% owned"', root.innerHTML.includes('100% owned'));
check('owned crypto detail page has NO manage-grid (the old 4-lever system)', !root.innerHTML.includes('manage-grid'));
check('owned crypto detail page has NO "Invest in growth" / "Upgrade the network" levers', !root.innerHTML.includes('Upgrade the network') && !root.innerHTML.includes('Invest in growth'));
check('owned crypto detail page still has working Buy and Sell buttons', root.innerHTML.includes('data-act="buy"') && root.innerHTML.includes('data-act="sell"'));
check('no undefined/NaN on the owned crypto detail page', !/undefined|NaN/.test(root.innerHTML));

/* ===================== E) The list/row "Owned" tag is untouched ===================== */
click(root, 'back');
click(root, 'seg', 'stock');
const mktBody = document.getElementById('mktBody'); // renderBody() patches this sub-element directly, not root.innerHTML
check('owned stock still shows the "Owned" tag in the browse list', mktBody.innerHTML.includes('owned-tag'));

/* ===================== F) TechCo.open() / Market.manage() are unreachable from the UI, but NOT deleted ===================== */
let openedWith = null;
const realOpen = TechCo.open;
TechCo.open = (id) => { openedWith = id; };
click(root, 'managehub', STOCK_ID); // the old action name — should no longer exist as a handler at all
check('there is no way left in the UI to call TechCo.open() (managehub action removed)', openedWith === null);
TechCo.open = realOpen;
check('TechCo.open itself still EXISTS in the engine (not deleted, just unreachable)', typeof TechCo.open === 'function');
check('Market.manage itself still EXISTS in the engine (not deleted, just unreachable)', typeof Market.manage === 'function');

/* ===================== G) Passive owner income keeps accruing automatically (unchanged) ===================== */
(function () {
  const before = state.balance;
  globalThis.NOW += 400 * 1000; // advance well past the 5-minute dividend interval
  Market.applyOffline(400); // catches up owner income for real, same as returning from being away
  check('owned assets still pay their passive owner income automatically in the background', state.balance > before);
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
