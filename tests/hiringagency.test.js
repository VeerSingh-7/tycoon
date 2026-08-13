/* =========================================================================
 * tests/hiringagency.test.js — headless tests for the Hiring Agency guided
 * entry point layered on top of Hiring & Talent (js/hiring.js).
 * -------------------------------------------------------------------------
 * Run:  node tests/hiringagency.test.js   (exit code 0 = all pass, 1 = a failure)
 * Same load-and-eval + DOM-stub pattern as tests/bizdash.test.js /
 * tests/manageowned.test.js.
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
  'js/hiring.js',
];

const tests = `
let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  \\u2713 ' + name); }
  else { fail++; console.log('  \\u2717 FAIL: ' + name); }
}
function approx(a, b, tol) { return Math.abs(a - b) <= Math.abs(b) * (tol == null ? 0.001 : tol); }

// --- Minimal DOM stub, same shape as the other Invest-side tests. ---
const elStore = {};
function stubEl(id) {
  if (!elStore[id]) {
    elStore[id] = {
      id, className: '', innerHTML: '', dataset: {}, style: {}, value: '',
      _listeners: {},
      addEventListener(type, fn) { this._listeners[type] = fn; },
      removeEventListener() { this._listeners = {}; },
      querySelector(sel) {
        // Only the handful of ids/selectors Hiring actually queries.
        if (sel === '#hireRoleSearch') return this.innerHTML.includes('id="hireRoleSearch"') ? searchInputStub : null;
        if (sel === '#hireRoleSheetResults') return this.innerHTML.includes('id="hireRoleSheetResults"') ? resultsStub : null;
        return null;
      },
      querySelectorAll() { return []; },
      closest() { return null; },
      appendChild() {}, remove() {},
      classList: { add() {}, remove() {}, toggle() {} },
    };
  }
  return elStore[id];
}
const searchInputStub = { value: '', oninput: null };
const resultsStub = { innerHTML: '' };
function fakeTarget(h, id, extra) {
  return { closest: () => ({ dataset: Object.assign({ h, id }, extra || {}), disabled: false }) };
}

state = defaultState();
state.balance = 1e18;
Market.ensure();

// Two owned companies (different names) to check the greeting is per-company.
const CO_A = 'auracle';
const CO_B = 'mango';
check('sanity: both test companies are TechCo-managed', TechCo.isManaged(CO_A) && TechCo.isManaged(CO_B));
Market.buy(CO_A, 1e18);
state.balance = 1e18;
Market.buy(CO_B, 1e18);
check(CO_A + ' is 100% owned', Market.isOwned(CO_A));
check(CO_B + ' is 100% owned', Market.isOwned(CO_B));
TechCo.ensureCompany(CO_A).cash = 1e15;
TechCo.ensureCompany(CO_B).cash = 1e15;

const root = stubEl('hireRoot');
Hiring.mount(root);

/* ===================== A) Agency greeting renders per company ===================== */
root._listeners.click({ target: fakeTarget('pick', CO_A) });
check('agency panel renders on company selection', root.innerHTML.includes('hire-agency-panel'));
check('agency tag (IGX) appears', root.innerHTML.includes('IGX'));
check('greeting mentions the SELECTED company (auracle -> ' + ASSET_BY_ID[CO_A].name + ')', root.innerHTML.includes(ASSET_BY_ID[CO_A].name));
check('greeting does not mention the other company', !root.innerHTML.includes(ASSET_BY_ID[CO_B].name));
check('Standard Search tier is selected by default', /tc-chip on" data-h="tier" data-id="standard"|class="tc-chip on" data-h="tier" data-id="standard"/.test(root.innerHTML.replace(/\\s+/g, ' ')));
check('no undefined/NaN leaks into the agency panel', !/undefined|NaN/.test(root.innerHTML));

root._listeners.click({ target: fakeTarget('back') });
root._listeners.click({ target: fakeTarget('pick', CO_B) });
check('greeting updates for the newly selected company (' + ASSET_BY_ID[CO_B].name + ')', root.innerHTML.includes(ASSET_BY_ID[CO_B].name));
check('tier resets to Standard on a fresh company pick', root.innerHTML.includes('data-h="tier" data-id="standard"'));

/* ===================== B) Tier toggle routes to the exact same existing logic ===================== */
root._listeners.click({ target: fakeTarget('cat', 'research_tech') });
root._listeners.click({ target: fakeTarget('toggleRole', 'scientist') });
const standardHTML = root.innerHTML;
check('Standard tier shows the passive candidate pool', standardHTML.includes('Candidate pool'));
const poolBefore = TechCo.empPassivePoolFor(CO_B, 'scientist');
check('Standard tier pool matches TechCo.empPassivePoolFor exactly (same candidates, same names)', poolBefore.every((c) => standardHTML.includes(c.name)));

root._listeners.click({ target: fakeTarget('tier', 'priority') });
const priorityHTML = root.innerHTML;
check('switching to Priority Clearance does not spend any cash (browsing is still free)', TechCo.ensureCompany(CO_B).cash === 1e15);
check('Priority Clearance still shows the exact same candidate pool underneath (same data, just reordered)', poolBefore.every((c) => priorityHTML.includes(c.name)));
check('Priority Clearance emphasizes the headhunt CTA (gold) ahead of the passive pool', priorityHTML.indexOf('tc-emp-hunt') < priorityHTML.indexOf('Candidate pool'));
check('Standard tier (captured above) shows the passive pool ahead of the headhunt CTA', standardHTML.indexOf('Candidate pool') < standardHTML.indexOf('tc-emp-hunt'));

// Running an actual Priority Clearance search still calls the exact same
// TechCo.empRunHeadhunt/empSearchCost the pre-existing "hunt" button always did.
const cashBefore = TechCo.ensureCompany(CO_B).cash;
const expectedCost = TechCo.empSearchCost(CO_B, 'scientist', {});
root._listeners.click({ target: fakeTarget('hunt', 'scientist') });
check('running Priority Clearance spent exactly empSearchCost (real headhunt logic ran)', approx(cashBefore - TechCo.ensureCompany(CO_B).cash, expectedCost));
check('a headhunt search was recorded (empSearch counter incremented)', (TechCo.ensureCompany(CO_B).empSearch.scientist || 0) === 1);

/* ===================== C) Choose Role sheet: search + jump straight to the role ===================== */
const TEST_ROLES = [
  ['scientist', 'research_tech', 'Scientist'],
  ['product_manager', 'product_dev', 'Product Manager'],
  ['accountant', 'business', 'Accountant'],
  ['factory_manager', 'operations', 'Factory Manager'],
  ['salesperson', 'sales_marketing', 'Salesperson'],
  ['ceo', 'leadership', 'CEO'],
];
check('sanity: all 6 test roles exist in EMP_ROLES with the expected category', TEST_ROLES.every(([id, cat]) => EMP_ROLES[id] && EMP_ROLES[id].category === cat));

root._listeners.click({ target: fakeTarget('roleSheetOpen') });
check('role sheet opens as a full takeover (search input present)', root.innerHTML.includes('id="hireRoleSearch"'));
check('role sheet lists roles from every one of the 6 categories', TEST_ROLES.every(([, , label]) => root.innerHTML.includes(label)));
const escLabel = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); // matches hiring.js's own _esc
check('role sheet lists all ' + EMP_ROLE_IDS.length + ' roles when unfiltered', EMP_ROLE_IDS.every((rid) => root.innerHTML.includes(escLabel(EMP_ROLES[rid].label))));

for (const [roleId, catId, label] of TEST_ROLES) {
  // Fresh company pick each time so we can verify the jump lands cleanly.
  root._listeners.click({ target: fakeTarget('back') });
  root._listeners.click({ target: fakeTarget('pick', CO_A) });
  root._listeners.click({ target: fakeTarget('roleSheetOpen') });

  // Search-as-you-type: typing a substring of the role's label filters the list.
  const query = label.slice(0, 4);
  const input = root.querySelector('#hireRoleSearch');
  input.oninput({ target: { value: query } });
  check(roleId + ': typing "' + query + '" filters the list down to matches', resultsStub.innerHTML.includes(label));
  check(roleId + ': search does not touch the input itself (no full re-render / focus loss)', root.innerHTML.includes('placeholder="Search all'));

  // Tap the role -> jumps straight into its candidate view.
  root._listeners.click({ target: fakeTarget('roleSheetPick', roleId) });
  check(roleId + ': tapping the role closes the sheet', !root.innerHTML.includes('id="hireRoleSearch"'));
  check(roleId + ': tapping the role selects its category tab (' + catId + ')', root.innerHTML.includes('class="tc-chip on" data-h="cat" data-id="' + catId + '"'));
  check(roleId + ': tapping the role opens straight into its candidate view (Candidate pool visible)', root.innerHTML.includes('Candidate pool') && root.innerHTML.includes(label));
  const rolePool = TechCo.empPassivePoolFor(CO_A, roleId);
  check(roleId + ': the opened candidate view is the exact same pool empPassivePoolFor returns', rolePool.every((c) => root.innerHTML.includes(c.name)));
}

/* ===================== D) Existing functionality completely unchanged underneath ===================== */
// The category tabs still work exactly as before (no dependency on the agency/sheet).
root._listeners.click({ target: fakeTarget('back') });
root._listeners.click({ target: fakeTarget('pick', CO_A) });
root._listeners.click({ target: fakeTarget('cat', 'business') });
check('category tabs still work unchanged', root.innerHTML.includes('class="tc-chip on" data-h="cat" data-id="business"'));

// Hiring a candidate through the normal flow still calls TechCo.empHire for real.
root._listeners.click({ target: fakeTarget('toggleRole', 'accountant') });
const rosterBefore = TechCo.ensureCompany(CO_A).employeeRoster.length;
root._listeners.click({ target: fakeTarget('hire', null, { role: 'accountant', src: 'passive', idx: '0' }) });
check('hiring through the (unchanged) candidate card grew the real roster', TechCo.ensureCompany(CO_A).employeeRoster.length === rosterBefore + 1);

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
