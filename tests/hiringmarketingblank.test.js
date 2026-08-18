/* =========================================================================
 * tests/hiringmarketingblank.test.js — headless tests confirming Hiring &
 * Talent and Marketing & Growth are correctly blank for stock companies
 * (state.js SAVE_VERSION 25): no company listing anywhere, real player
 * spend refunded fairly, and the deeper engine machinery left intact.
 * -------------------------------------------------------------------------
 * Run:  node tests/hiringmarketingblank.test.js   (exit code 0 = all pass)
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
  'js/hiring.js',
  'js/marketing.js',
];

const tests = `
let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  \\u2713 ' + name); }
  else { fail++; console.log('  \\u2717 FAIL: ' + name); }
}
function approx(a, b, tol) { return Math.abs(a - b) <= Math.abs(b) * (tol == null ? 0.001 : tol); }

function stubEl(id) {
  return {
    id, innerHTML: '', dataset: {}, style: {}, _listeners: {},
    addEventListener(type, fn) { this._listeners[type] = fn; },
    removeEventListener(type) { delete this._listeners[type]; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest() { return null; },
    appendChild() {}, remove() {},
    classList: { add() {}, remove() {}, toggle() {} },
  };
}

/* ===================== A) Both screens are genuinely blank ===================== */
(function () {
  state = defaultState();
  state.balance = 1e15;
  Market.ensure();
  // Buy out a couple of stocks — if any listing logic survived, it would show here.
  Market.buy('auracle', 1e15);
  state.balance = 1e15;
  Market.buy('mango', 1e15);

  const hireRoot = stubEl('hireRoot');
  Hiring.mount(hireRoot);
  check('Hiring & Talent shows the blank placeholder', hireRoot.innerHTML.includes("isn't available right now"));
  check('Hiring & Talent lists NO stock company names', !hireRoot.innerHTML.includes(ASSET_BY_ID['auracle'].name) && !hireRoot.innerHTML.includes(ASSET_BY_ID['mango'].name));
  check('Hiring & Talent has no company-card grid at all', !hireRoot.innerHTML.includes('hire-co-grid'));
  check('Hiring & Talent has no leftover Market.isOwned-driven "% owned" text', !hireRoot.innerHTML.includes('% owned'));

  const mktRoot = stubEl('mktRoot');
  Marketing.mount(mktRoot);
  check('Marketing & Growth shows the blank placeholder', mktRoot.innerHTML.includes("isn't available right now"));
  check('Marketing & Growth lists NO stock company names', !mktRoot.innerHTML.includes(ASSET_BY_ID['auracle'].name) && !mktRoot.innerHTML.includes(ASSET_BY_ID['mango'].name));
  check('Marketing & Growth has no company-card grid at all', !mktRoot.innerHTML.includes('mk-co-grid'));
  check('Marketing & Growth has no "Talk to IGB" agency entry card', !mktRoot.innerHTML.includes('mk-agency-cta'));
  check('no undefined/NaN on either blank screen', !/undefined|NaN/.test(hireRoot.innerHTML) && !/undefined|NaN/.test(mktRoot.innerHTML));
})();

/* ===================== B) Business tab is completely unaffected ===================== */
(function () {
  state = defaultState();
  state.balance = 1e15;
  state.totalEarned = 1e20;
  for (const def of BUSINESS_DEFS) buyBusinessLevel(def.id);
  check('all 19 Business tab defs still exist and are untouched (13 + 6 Supermarket Chain slots)', BUSINESS_DEFS.length === 19);
  check('Business tab businesses are still ownable/leveled normally (unaffected by this change)', BUSINESS_DEFS.some((d) => getBiz(d.id).level > 0));
})();

/* ===================== C) Real-save migration: actual before/after numbers ===================== */
(function () {
  // A realistic v24 save: 3 stock companies with real hiring history, one
  // with an ACTIVE (unresolved) campaign, one with a RESOLVED campaign in
  // history (must NOT be refunded — that value was already realized).
  state = defaultState();
  Market.ensure();
  state.balance = 1e15;
  Market.buy('auracle', 1e15);
  state.balance = 1e15;
  Market.buy('mango', 1e15);
  state.balance = 1e15;
  Market.buy('googol', 1e15);

  TechCo.ensureCompany('auracle').cash = 1e15;
  TechCo.ensureCompany('mango').cash = 1e15;
  TechCo.ensureCompany('googol').cash = 1e15;

  // auracle: 2 hires (a real roster to refund).
  const pool1 = TechCo.empPassivePoolFor('auracle', 'ai_engineer');
  TechCo.empHire('auracle', 'ai_engineer', pool1[0]);
  const pool2 = TechCo.empPassivePoolFor('auracle', 'product_manager');
  TechCo.empHire('auracle', 'product_manager', pool2[0]);

  // mango: 1 hire AND an active in-progress campaign (budget already spent).
  const pool3 = TechCo.empPassivePoolFor('mango', 'accountant');
  TechCo.empHire('mango', 'accountant', pool3[0]);
  const mangoCampRes = TechCo.mktStartCampaign('mango', { objective: 'brand_awareness', audience: (MKT_SECTOR_AUDIENCES[TechCo.mktSector('mango')] || ['families'])[0], budget: TechCo.mktBudgetRange('mango').typical });
  check('sanity: mango campaign started for real (budget actually deducted)', mangoCampRes.ok === true);

  // googol: a RESOLVED campaign already in history — must be left alone.
  const googolCampRes = TechCo.mktStartCampaign('googol', { objective: 'brand_awareness', audience: (MKT_SECTOR_AUDIENCES[TechCo.mktSector('googol')] || ['families'])[0], budget: TechCo.mktBudgetRange('googol').typical });
  globalThis.NOW += (googolCampRes.campaign.endsAt - googolCampRes.campaign.startMs) + 1000;
  TechCo.advance('googol');
  check('sanity: googol campaign fully resolved into history before migration', TechCo.ensureCompany('googol').marketing.history.length === 1 && TechCo.ensureCompany('googol').marketing.campaigns.length === 0);

  // Compute the expected refund BEFORE serializing (mirrors what a real save holds).
  const expectedRosterRefund =
    TechCo.ensureCompany('auracle').employeeRoster.reduce((s, e) => s + TechCo.employeeHireCost('auracle', e), 0) +
    TechCo.ensureCompany('mango').employeeRoster.reduce((s, e) => s + TechCo.employeeHireCost('mango', e), 0);
  const expectedCampaignRefund = TechCo.ensureCompany('mango').marketing.campaigns.reduce((s, c) => s + c.budget, 0);
  const expectedTotal = expectedRosterRefund + expectedCampaignRefund;
  const googolHistoryBefore = JSON.stringify(TechCo.ensureCompany('googol').marketing.history);
  const googolRepBefore = TechCo.ensureCompany('googol').reputation;

  // Round-trip exactly like a real save: JSON round-trip the whole state,
  // stamp it as v24, run it through migrate() for real.
  const savedLikeReal = JSON.parse(JSON.stringify(state));
  savedLikeReal.version = 24;
  const beforeBalance = savedLikeReal.balance;

  const migrated = migrate(savedLikeReal);
  check('migration bumps version to the latest (25)', migrated.version === SAVE_VERSION);
  check('migration refund: before=' + beforeBalance.toFixed(2) + ' expected+=' + Math.round(expectedTotal) + ' got=' + migrated.balance.toFixed(2),
    approx(migrated.balance, beforeBalance + expectedTotal));
  check('migration queues a one-time notice naming all 2 affected companies (auracle, mango — googol untouched)', migrated.hiringMarketingRefundNotice && migrated.hiringMarketingRefundNotice.companies === 2);

  check('auracle roster cleared', migrated.techco['auracle'].employeeRoster.length === 0);
  check('mango roster cleared', migrated.techco['mango'].employeeRoster.length === 0);
  check('mango active campaign cleared', migrated.techco['mango'].marketing.campaigns.length === 0);
  check('googol (no active spend) balance-affecting fields untouched: history unchanged', JSON.stringify(migrated.techco['googol'].marketing.history) === googolHistoryBefore);
  check('googol reputation untouched (already-realized value, not clawed back)', migrated.techco['googol'].reputation === googolRepBefore);
  check('googol has no employeeRoster to begin with, migration does not invent one', (migrated.techco['googol'].employeeRoster || []).length === 0);

  // A save that never touched Hiring/Marketing at all sees zero disruption.
  const cleanSave = { version: 24, balance: 555, techco: { wallmarket: { employeeRoster: [], marketing: { campaigns: [] } } } };
  const migratedClean = migrate(JSON.parse(JSON.stringify(cleanSave)));
  check('a save with no roster/campaign spend is undisturbed (balance unchanged)', migratedClean.balance === 555);
  check('a save with no roster/campaign spend gets no refund notice', !migratedClean.hiringMarketingRefundNotice);

  // A save with no techco field at all (never played the stock side) migrates cleanly.
  const neverSave = { version: 24, balance: 10, techco: null };
  const migratedNever = migrate(JSON.parse(JSON.stringify(neverSave)));
  check('a save with techco:null migrates cleanly to latest with no crash', migratedNever.version === SAVE_VERSION && migratedNever.balance === 10);
})();

/* ===================== D) Deeper engine machinery is intact (kept, not deleted) ===================== */
check('TechCo.empHire still exists (roster engine kept, just unreachable from the UI)', typeof TechCo.empHire === 'function');
check('TechCo.mktStartCampaign still exists (campaign engine kept, just unreachable from the UI)', typeof TechCo.mktStartCampaign === 'function');
check('TechCo.employeeHireCost still exists (used by the v25 refund itself)', typeof TechCo.employeeHireCost === 'function');

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
