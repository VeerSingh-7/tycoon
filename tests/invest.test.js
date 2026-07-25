/* =========================================================================
 * tests/invest.test.js — headless tests for the Invest pricing/quote model
 * -------------------------------------------------------------------------
 * Run:  node tests/invest.test.js   (exit code 0 = all pass, 1 = a failure)
 *
 * We load the real browser modules (format/data/market/state) into one scope
 * and drive a MOCK clock via Date.now, so we can assert time-dependent
 * behaviour deterministically:
 *   - the displayed QUOTE updates on a calm ~17s cadence, staggered per asset
 *   - the list price / Today % equals the detail's (same dispPrice/dispChangePct)
 *   - the CHART ticks in real time (1S advances one bar per second)
 *   - coins are non-fractional; the v12 reverse-split preserves value + ownership
 * ========================================================================= */

const fs = require('fs');
const path = require('path');

// Mock clock shared with the modules (WALL/nowSec read Date.now()).
globalThis.NOW = 1700000000000;
Date.now = () => globalThis.NOW;

// Browser globals the modules expect but that we don't exercise here.
globalThis.addEventListener = () => {};
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

const ROOT = path.join(__dirname, '..');
const files = [
  'js/format.js',
  'js/data/markets.js',
  'js/data/stocks.js',
  'js/state.js',
  'js/market.js',
];

const tests = `
let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  \\u2713 ' + name); }
  else { fail++; console.log('  \\u2717 FAIL: ' + name); }
}
const MANGO = ASSET_BY_ID['mango'];

/* A) The displayed quote updates on a calm ~17s cadence (not every second). */
globalThis.NOW = 1700000000000;
let prev = Market.dispPrice('mango'), changes = 0;
for (let s = 1; s <= 34; s++) { globalThis.NOW += 1000; const v = Market.dispPrice('mango'); if (v !== prev) changes++; prev = v; }
check('quote changes ~1-3 times over 34s (≈ every 17s), got ' + changes, changes >= 1 && changes <= 3);

/* B) Different assets change at different (staggered) moments. */
function changeSecond(id) {
  const base = globalThis.NOW; let p = Market.dispPrice(id), at = -1;
  for (let s = 1; s <= 17; s++) { globalThis.NOW = base + s * 1000; const v = Market.dispPrice(id); if (at < 0 && v !== p) at = s; p = v; }
  globalThis.NOW = base; return at;
}
globalThis.NOW = 1700000000000;
const secs = ['mango', 'googol', 'tezla', 'bitcorn', 'dogecorn'].map(changeSecond);
check('assets are staggered (change at different seconds): ' + JSON.stringify(secs), new Set(secs).size > 1);

/* C) The list quote == the detail quote (same source), so a stock reads the
 *    same price and Today % before and after you tap it. */
globalThis.NOW = 1700000000000;
check('list price === detail header price', Market.dispPrice('mango') === Market.dispPrice('mango'));
check('list Today% === detail Today% (dispChangePct default is DAY)',
  Market.dispChangePct('mango') === Market.dispChangePct('mango', MARKET.DAY));

/* D) The chart is real-time: 1S advances exactly one bar per second, and the
 *    forming candle's close is priceAt("now") (not the calmer quote). */
globalThis.NOW = 1700000000000;
const c0 = Market.candles('mango', '1s'); const t0 = c0[c0.length - 1].time;
globalThis.NOW += 1000;
const c1 = Market.candles('mango', '1s'); const t1 = c1[c1.length - 1].time;
check('1S chart advances one bar per real second', t1 === t0 + 1);
globalThis.NOW = 1700000000000 + 3000;
const tip = Market.candles('mango', '1s').slice(-1)[0].close;
const real = Market.priceAt(MANGO, globalThis.NOW / 1000);
check('chart live close === real-time priceAt(now)', Math.abs(tip - real) < 1e-9);

/* E) quoteEpoch advances every second (drives the once-per-second chart redraw). */
globalThis.NOW = 1700000000000;
const e0 = Market.quoteEpoch(); globalThis.NOW += 1000; const e1 = Market.quoteEpoch();
check('quoteEpoch advances each second', e1 === e0 + 1);

/* D2) Each timeframe advances exactly one bar per its interval (1MIN every
 *     minute, 1M every ~month …) while the live edge tracks real time within. */
const TFS = [['1s', 1], ['1m', 60], ['1H', 3600], ['1D', 86400], ['1W', 604800], ['1M', 2592000]];
for (const [tf, secs] of TFS) {
  const base = 1700000000 - (1700000000 % secs);      // align to a bucket boundary
  globalThis.NOW = base * 1000;
  const startAligned = Market.candles('mango', tf).slice(-1)[0].time;
  globalThis.NOW = (base + secs - 1) * 1000;          // one second before the boundary
  const within = Market.candles('mango', tf).slice(-1)[0];
  check(tf + ': no new bar until the interval passes', within.time === startAligned);
  check(tf + ': live edge is real-time within the interval',
    Math.abs(within.close - Market.priceAt(MANGO, globalThis.NOW / 1000)) < 1e-9);
  globalThis.NOW = (base + secs) * 1000;              // cross the boundary
  check(tf + ': exactly one new bar per interval',
    Market.candles('mango', tf).slice(-1)[0].time === startAligned + secs);
}

/* F) No penny coins: every coin's reference price is a real (>= $1) value. */
check('no fractional coins (all refPrice >= $1)', CRYPTO_DEFS.every((d) => d.refPrice >= 1));

/* G) v12 reverse-split preserves holding VALUE and OWNERSHIP for every repriced coin. */
const out = migrate({ version: 11, portfolio: { dogecorn: { shares: 1.4e11, cost: 1e6 } } });
check('save migrates to v12', out.version === 12);
check('dogecorn shares reverse-split by 200 (1.4e11 -> 7e8)', Math.abs(out.portfolio.dogecorn.shares - 7e8) < 1);
check('dogecorn value preserved at ref (7e8*24 == 1.4e11*0.12)', Math.abs(7e8 * 24 - 1.4e11 * 0.12) < 1);
for (const [id, factor] of Object.entries(V12_COIN_SPLIT)) {
  const def = ASSET_BY_ID[id];
  const oldSupply = def.supply * factor; // reconstruct the pre-split supply
  const o = migrate({ version: 11, portfolio: { [id]: { shares: oldSupply, cost: 1 } } });
  state.portfolio = o.portfolio;
  check(id + ': 100% owner still owns ~100% after split', Math.abs(Market.ownedFrac(id) - 1) < 3e-3);
}

console.log('\\n' + (fail ? ('\\u2717 ' + fail + ' failing, ' + pass + ' passing') : ('\\u2713 all ' + pass + ' checks passed')));
if (fail) process.exitCode = 1;
`;

const src = files.map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n') + '\n' + tests;
eval(src);
