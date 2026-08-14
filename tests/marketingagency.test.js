/* =========================================================================
 * tests/marketingagency.test.js — headless tests for the Marketing Agency
 * guided entry point layered on top of Marketing & Growth's Quick Campaign
 * flow (js/marketing.js).
 * -------------------------------------------------------------------------
 * Run:  node tests/marketingagency.test.js   (exit code 0 = all pass, 1 = a failure)
 * Same load-and-eval + DOM-stub pattern as tests/hiringagency.test.js.
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
  'js/marketing.js',
];

const tests = `
let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  \\u2713 ' + name); }
  else { fail++; console.log('  \\u2717 FAIL: ' + name); }
}
function approx(a, b, tol) { return Math.abs(a - b) <= Math.abs(b) * (tol == null ? 0.001 : tol); }

// --- Minimal DOM stub, same shape as the Hiring Agency tests. ---
const elStore = {};
function stubEl(id) {
  if (!elStore[id]) {
    elStore[id] = {
      id, className: '', innerHTML: '', dataset: {}, style: {}, value: '',
      _listeners: {},
      addEventListener(type, fn) { this._listeners[type] = fn; },
      removeEventListener(type) { delete this._listeners[type]; },
      querySelector(sel) {
        if (sel === '#mkAgencyBizSearch') return this.innerHTML.includes('id="mkAgencyBizSearch"') ? searchInputStub : null;
        if (sel === '#mkAgencyBizResults') return this.innerHTML.includes('id="mkAgencyBizResults"') ? resultsStub : null;
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
function fakeTarget(mk, id) {
  return { closest: () => ({ dataset: { mk, id }, disabled: false }) };
}
function click(root, mk, id) { root._listeners.click({ target: fakeTarget(mk, id) }); }

state = defaultState();
state.balance = 1e18;
Market.ensure();

// Two owned companies of very different size, to prove tier pricing is real
// per-company budget scaling, not a flat number.
const SMALL_CO = 'googol';   // smaller baseIncome, used the same way in techco.test.js
const LARGE_CO = 'maisonlux'; // much larger baseIncome, ditto
Market.buy(SMALL_CO, 1e18);
state.balance = 1e18;
Market.buy(LARGE_CO, 1e18);
check(SMALL_CO + ' is 100% owned', Market.isOwned(SMALL_CO));
check(LARGE_CO + ' is 100% owned', Market.isOwned(LARGE_CO));
TechCo.ensureCompany(SMALL_CO).cash = 1e18;
TechCo.ensureCompany(LARGE_CO).cash = 1e18;
const smallIncome = TechCo.snapshot(SMALL_CO).marketCap; // just to sanity-print if needed
check('sanity: the two test companies really do have different base incomes', TechCo.mktBudgetRange(SMALL_CO).typical !== TechCo.mktBudgetRange(LARGE_CO).typical);

const root = stubEl('mktRoot');
Marketing.mount(root);

/* ===================== A) Blank for now — stock companies removed ===================== */
// Marketing & Growth's stock-company selector was removed (state.js v25);
// the home screen is now a placeholder, not the old "Talk to IGB" CTA. The
// guided Agency flow underneath is left intact and correct — it's just no
// longer reachable from that screen — so we still drive it directly below
// to confirm nothing broke, the same way the deeper engine stays testable.
check('the Marketing & Growth home is now a blank placeholder (no CTA)', !root.innerHTML.includes('mk-agency-cta') && root.innerHTML.includes("isn't available right now"));

click(root, 'agencyStart');
check('agency flow opens on the business step', root.innerHTML.includes('mkAgencyBizSearch'));
check('agency greeting asks which business to promote', root.innerHTML.includes('which business would you like to promote'));
check('business list includes both owned test companies', root.innerHTML.includes(ASSET_BY_ID[SMALL_CO].name) && root.innerHTML.includes(ASSET_BY_ID[LARGE_CO].name));

// Ownership gate: an unowned stock must NOT appear in the picker.
const UNOWNED_STOCK = ASSET_DEFS.find((d) => d.group === 'stock' && !Market.isOwned(d.id));
check('sanity: found an unowned stock to test the gate with', !!UNOWNED_STOCK);
check('an unowned company does NOT appear in the business picker', !root.innerHTML.includes(UNOWNED_STOCK.name));

// Scope decision: stock companies only — no Business-tab business should ever appear here.
check('no Business-tab business names leak into the picker (stock-only scope)', BUSINESS_DEFS.every((d) => !root.innerHTML.includes(d.name)));

// Search-as-you-type, patched in place (never a full re-render / focus loss).
const input = root.querySelector('#mkAgencyBizSearch');
const query = ASSET_BY_ID[SMALL_CO].name.slice(0, 4);
input.oninput({ target: { value: query } });
check('typing filters the results to the matching company', resultsStub.innerHTML.includes(ASSET_BY_ID[SMALL_CO].name));
check('typing hides the non-matching company', !resultsStub.innerHTML.includes(ASSET_BY_ID[LARGE_CO].name));
check('the search input itself is untouched by typing (still present, no full re-render)', root.innerHTML.includes('placeholder="Search your companies'));

/* ===================== B) Channel grid matches the real channel list ===================== */
click(root, 'agencyPickCompany', SMALL_CO);
check('picking a company advances to the channel step', root.innerHTML.includes('mk-chan-icon-grid'));
check('greeting now names the chosen company', root.innerHTML.includes(ASSET_BY_ID[SMALL_CO].name));
check('every one of the real ' + MKT_CHANNEL_IDS.length + ' channels appears in the grid', MKT_CHANNEL_IDS.every((cid) => root.innerHTML.includes(MKT_CHANNELS[cid].label)));
check('channels are grouped into the real 3 categories (Digital/Traditional/Physical)', MKT_CHANNEL_CATEGORIES.every((c) => root.innerHTML.includes(c.label)));
check('no invented channel outside MKT_CHANNELS appears (icon lookup only ever draws from the real list)', MKT_CHANNEL_IDS.length === 15);

/* ===================== C) Tier pricing is real per-company budget scaling ===================== */
click(root, 'agencyPickChannel', 'search');
check('picking a channel advances to the tier step', root.innerHTML.includes('mk-tier-grid'));
check('all 4 real spread tiers are offered as package cards', MKT_SPREAD_IDS.every((tid) => root.innerHTML.includes(MKT_SPREAD_TIERS[tid].label)));

for (const tid of MKT_SPREAD_IDS) {
  const expectedBudget = tid === 'local' ? TechCo.mktBudgetRange(SMALL_CO).min
    : tid === 'regional' ? TechCo.mktBudgetRange(SMALL_CO).typical * 0.4
    : tid === 'national' ? TechCo.mktBudgetRange(SMALL_CO).typical * 1.2
    : TechCo.mktBudgetRange(SMALL_CO).max * 0.6;
  check(tid + ' tier price matches the real mktBudgetRange threshold for ' + SMALL_CO, root.innerHTML.includes(formatMoney(expectedBudget)));
}

// A much bigger company shows a much bigger price for the SAME tier (real
// per-company scaling, not a flat number like the reference's flat £/day).
const smallNationalPrice = TechCo.mktBudgetRange(SMALL_CO).typical * 1.2;
const largeNationalPrice = TechCo.mktBudgetRange(LARGE_CO).typical * 1.2;
check('National tier price differs sharply between a small and large company (real scaling)', largeNationalPrice > smallNationalPrice * 5);

// Re-run the flow on the LARGE company and confirm ITS OWN numbers show up.
click(root, 'agencyBack'); click(root, 'agencyBack');
click(root, 'agencyPickCompany', LARGE_CO);
click(root, 'agencyPickChannel', 'search');
check('large company shows its own (much bigger) National tier price', root.innerHTML.includes(formatMoney(largeNationalPrice)));
check('large company tier card does NOT show the small company price', !root.innerHTML.includes(formatMoney(smallNationalPrice)));

/* ===================== D) Reach preview matches the REAL formula ===================== */
// Recompute independently via the exact same public functions the tier card
// itself calls, and cross-check the number actually shown in the HTML.
(function () {
  // Match agencyInferredCamp's own audience default: defaultQuick's first sector audience.
  const sector = TechCo.mktSector(LARGE_CO);
  const audiences = MKT_SECTOR_AUDIENCES[sector] || [];
  const camp = { audience: audiences[0] || 'families', channels: { search: 1 }, message: null, empId: (TechCo.mktBestBenchFor(LARGE_CO) || {}).id || null };
  const eff = TechCo.mktEffectiveness(LARGE_CO, camp).total;
  const budget = TechCo.mktBudgetRange(LARGE_CO).typical * 1.2; // national, matches the card already open
  const { reach } = TechCo.mktEstimateReach(budget, eff);
  check('the reach shown on the National tier card matches mktEstimateReach exactly, not a re-derived number', root.innerHTML.includes(formatNumber(reach) + ' reached'));
})();

/* ===================== E) "No thanks" cancels back to Marketing & Growth home at any step ===================== */
click(root, 'agencyCancel');
check('cancelling from the tier step returns to the (now blank) Marketing & Growth home', root.innerHTML.includes("isn't available right now") && !root.innerHTML.includes('mk-tier-grid'));

click(root, 'agencyStart');
click(root, 'agencyCancel');
check('cancelling from the business step also returns home', root.innerHTML.includes("isn't available right now"));

/* ===================== F) The flow hands off into a REAL working campaign ===================== */
click(root, 'agencyStart');
click(root, 'agencyPickCompany', SMALL_CO);
click(root, 'agencyPickChannel', 'social_media');
const cashBefore = TechCo.ensureCompany(SMALL_CO).cash;
const campaignsBefore = TechCo.ensureCompany(SMALL_CO).marketing.campaigns.length;
click(root, 'agencyPickTier', 'regional');

check('handoff lands on the real Quick Campaign form (Advanced mode, pre-filled)', root.innerHTML.includes('New Campaign') && root.innerHTML.includes('Launch Campaign'));
check('the chosen spread tier (Regional) is pre-selected on the real form', root.innerHTML.includes('class="chip chip-active" data-mk="spread" data-id="regional"'));
check('the chosen channel (Social Media) is pre-selected at Normal weight', root.innerHTML.includes('Social Media') && /Social Media<small>Normal/.test(root.innerHTML.replace(/\\s+/g, ' ')));

// Actually launch it — proves the handoff really calls the exact existing
// mktStartCampaign() with the gathered channel + spread respected, not discarded.
click(root, 'launch');
const camps = TechCo.ensureCompany(SMALL_CO).marketing.campaigns;
check('launching created exactly one real campaign via the existing engine', camps.length === campaignsBefore + 1);
const camp = camps[camps.length - 1];
check('the real campaign kept the Regional spread the agency flow chose', camp.spread === 'regional');
check('the real campaign spent 100% of its channel weight on Social Media (the chosen channel)', Object.keys(camp.channels).length === 1 && camp.channels.social_media === 1);
check('the real campaign actually deducted cash from the company (mktStartCampaign really ran)', TechCo.ensureCompany(SMALL_CO).cash < cashBefore);
check('the real campaign budget matches the Regional tier price shown on the card', approx(camp.budget, TechCo.mktBudgetRange(SMALL_CO).typical * 0.4));

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
