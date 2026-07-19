/* =========================================================================
 * market.js — Phase 4 engine: price simulation, candles, dividends, trading
 * -------------------------------------------------------------------------
 * Simulation model (per non-oil asset, stepped once per second):
 *   log-return r = (regimeDrift + reversion·ln(base/price))·dt
 *                + vol · volSpike · sqrt(dt) · gauss()  [+ shock while active]
 *   - REGIMES: drift redrawn every 2–8 min in ±maxDrift → bull/bear phases
 *   - VOL SPIKES: rare 2–4× volatility bursts for 30–90s
 *   - SHOCKS: rare crashes/rallies (±40–100% of shockMax over 12 steps)
 *   - REVERSION + price clamps keep the sim stable over days of play
 * Crude Oil skips all of that: its price is Mechanics.oilPrice() × base —
 * the exact cycle the Oil & Gas / Transport businesses already use.
 *
 * All market state (prices, regimes, candles) and the portfolio live inside
 * `state` and therefore save/load with everything else.
 * ========================================================================= */

const Market = (() => {
  const WALL = () => Date.now();

  /* ---------------------------- State setup ---------------------------- */

  /** Lazily create market state + any assets added since the save. */
  function ensure() {
    if (!state.market) {
      state.market = { assets: {}, nextDivAt: WALL() + MARKET.DIV_INTERVAL_SEC * 1000 };
    }
    for (const def of ASSET_DEFS) {
      if (!state.market.assets[def.id]) {
        state.market.assets[def.id] = freshAsset(def);
      }
    }
    if (!state.portfolio) state.portfolio = {};
  }

  function freshAsset(def) {
    const a = {
      price: def.basePrice,
      drift: 0, regimeUntil: 0,          // current bull/bear regime
      volMult: 1, volUntil: 0,           // volatility spike state
      shock: 0, shockSteps: 0,           // active crash/rally, spread over steps
      candles: { 10: [], 60: [] },       // closed candles per timeframe
      cur: { 10: null, 60: null },       // the forming candle per timeframe
    };
    // Seed 90 minutes of history so charts are alive on first open.
    const nowSec = WALL() / 1000;
    const step10 = 10;
    for (let t = nowSec - MARKET.SEED_SEC; t <= nowSec; t += step10) {
      stepAsset(def, a, step10, t);
    }
    return a;
  }

  /* --------------------------- Price stepping --------------------------- */

  /** Standard normal via Box–Muller. */
  function gauss() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Advance one asset by dt seconds at wall-time tSec, then update candles. */
  function stepAsset(def, a, dt, tSec) {
    if (def.oilLinked && typeof Mechanics !== 'undefined') {
      // Shared oil cycle; offset = how far in the past this sample is.
      const ago = Math.max(0, WALL() / 1000 - tSec);
      a.price = def.basePrice * Mechanics.oilPrice(ago);
    } else if (!def.oilLinked) {
      const nowMs = tSec * 1000;

      // Bull/bear regime: redraw drift every 2–8 minutes.
      if (nowMs >= a.regimeUntil) {
        a.drift = (Math.random() * 2 - 1) * def.maxDrift;
        a.regimeUntil = nowMs + (120 + Math.random() * 360) * 1000;
      }
      // Volatility spikes: ~1 per 10 min, 2–4× for 30–90s.
      if (nowMs >= a.volUntil) a.volMult = 1;
      if (Math.random() < dt / 600) {
        a.volMult = 2 + Math.random() * 2;
        a.volUntil = nowMs + (30 + Math.random() * 60) * 1000;
      }
      // Crashes & rallies: ~1 per 40 min, applied over 12 steps.
      if (a.shockSteps <= 0 && Math.random() < dt / 2400) {
        const size = def.shockMax * (0.4 + Math.random() * 0.6);
        a.shock = (Math.random() < 0.5 ? -1 : 1) * size / 12;
        a.shockSteps = 12;
      }

      let r = (a.drift + MARKET.REVERSION * Math.log(def.basePrice / a.price)) * dt +
        def.vol * a.volMult * Math.sqrt(dt) * gauss();
      if (a.shockSteps > 0) { r += a.shock; a.shockSteps--; }

      a.price *= Math.exp(r);
      // Hard stability clamps: the sim can never NaN or run away.
      a.price = Math.min(def.basePrice * 50, Math.max(def.basePrice * 0.05, a.price));
    }
    updateCandles(a, tSec);
  }

  /** Fold the current price into the forming candle of each timeframe. */
  function updateCandles(a, tSec) {
    for (const tf of MARKET.CANDLE_TFS) {
      const slot = Math.floor(tSec / tf) * tf;
      let cur = a.cur[tf];
      if (!cur || cur.time !== slot) {
        // Guard: a sample older than the forming candle (e.g. offline catch-up
        // over a window a freshly-seeded asset already covered) must never
        // append out-of-order candles — charts require ascending time.
        if (cur && slot < cur.time) continue;
        if (cur) {
          a.candles[tf].push(cur);
          if (a.candles[tf].length > MARKET.CANDLES_KEPT) a.candles[tf].shift();
        }
        a.cur[tf] = { time: slot, open: a.price, high: a.price, low: a.price, close: a.price };
      } else {
        cur.high = Math.max(cur.high, a.price);
        cur.low = Math.min(cur.low, a.price);
        cur.close = a.price;
      }
    }
  }

  /* ------------------------------- Ticking ------------------------------- */

  let _acc = 0;

  /** Engine hook: steps the whole market once per accumulated second. */
  function tick(dt) {
    ensure();
    _acc += dt;
    while (_acc >= MARKET.STEP_SEC) {
      _acc -= MARKET.STEP_SEC;
      const tSec = WALL() / 1000;
      for (const def of ASSET_DEFS) stepAsset(def, state.market.assets[def.id], MARKET.STEP_SEC, tSec);
    }
    payDueDividends();
  }

  /** Coarse catch-up for time the app was closed (called from state.js). */
  function applyOffline(secs) {
    ensure();
    secs = Math.min(secs, MARKET.OFFLINE_CAP_SEC);
    if (secs < MARKET.STEP_SEC) return;
    const steps = Math.min(MARKET.OFFLINE_MAX_STEPS, Math.ceil(secs));
    const dtPer = secs / steps;
    const start = WALL() / 1000 - secs;
    for (let i = 1; i <= steps; i++) {
      const tSec = start + i * dtPer;
      for (const def of ASSET_DEFS) stepAsset(def, state.market.assets[def.id], dtPer, tSec);
    }
  }

  /* ------------------------------ Dividends ------------------------------ */

  /** Pay every due dividend interval (catches up after offline, capped). */
  function payDueDividends() {
    const now = WALL();
    let total = 0, intervals = 0;
    while (now >= state.market.nextDivAt && intervals < MARKET.DIV_MAX_CATCHUP) {
      for (const def of ASSET_DEFS) {
        if (!def.divYield) continue;
        const h = state.portfolio[def.id];
        if (h && h.shares > 0) total += h.shares * price(def.id) * def.divYield;
      }
      state.market.nextDivAt += MARKET.DIV_INTERVAL_SEC * 1000;
      intervals++;
    }
    // Drop anything beyond the catch-up cap.
    if (now >= state.market.nextDivAt) state.market.nextDivAt = now + MARKET.DIV_INTERVAL_SEC * 1000;

    if (total > 0) {
      addEarnings(total);
      if (typeof UI !== 'undefined') {
        UI.showToast(`💰 <b>Dividends paid</b><br>+${formatMoney(total)} from your stock holdings.`);
      }
      saveGame();
    }
  }

  /* ------------------------------- Prices ------------------------------- */

  function price(id) { ensure(); return state.market.assets[id].price; }
  function buyPrice(id) { return price(id) * (1 + MARKET.SPREAD); }
  function sellPrice(id) { return price(id) * (1 - MARKET.SPREAD); }

  /** % change vs ~90 minutes ago (first candle of the 1m history). */
  function changePct(id) {
    ensure();
    const a = state.market.assets[id];
    const hist = a.candles[60];
    const ref = hist.length ? hist[0].open : a.price;
    return ((a.price - ref) / ref) * 100;
  }

  /** Candles for the chart: closed history + the live forming candle. */
  function candles(id, tf) {
    ensure();
    const a = state.market.assets[id];
    const list = a.candles[tf].slice();
    if (a.cur[tf]) list.push({ ...a.cur[tf] });
    return list;
  }

  /* ------------------------------- Trading ------------------------------- */

  function holding(id) {
    ensure();
    if (!state.portfolio[id]) state.portfolio[id] = { shares: 0, cost: 0 };
    return state.portfolio[id];
  }

  /** Spend `cash` on an asset at the ask (mid + spread). */
  function buy(id, cash) {
    cash = Math.min(cash, state.balance);
    if (cash < 1) return false;
    const h = holding(id);
    state.balance -= cash;
    h.shares += cash / buyPrice(id);
    h.cost += cash;
    saveGame();
    return true;
  }

  /**
   * Sell a fraction of the position at the bid (mid − spread).
   * Realized PROFIT (only) counts as earnings → XP/Legacy; losses are yours.
   */
  function sell(id, frac) {
    const h = holding(id);
    const shares = h.shares * Math.min(1, frac);
    if (shares <= 0) return false;
    const proceeds = shares * sellPrice(id);
    const costOut = (h.cost / h.shares) * shares;
    h.shares -= shares;
    h.cost -= costOut;
    if (h.shares < 1e-9) { h.shares = 0; h.cost = 0; }
    state.balance += proceeds;
    const gain = proceeds - costOut;
    if (gain > 0) {
      state.totalEarned += gain;
      state.runEarned += gain;
    }
    saveGame();
    return true;
  }

  /** Portfolio totals for the Invest header: value, cost basis, P/L. */
  function portfolioSummary() {
    ensure();
    let value = 0, cost = 0;
    for (const def of ASSET_DEFS) {
      const h = state.portfolio[def.id];
      if (h && h.shares > 0) {
        value += h.shares * price(def.id);
        cost += h.cost;
      }
    }
    return { value, cost, pl: value - cost, plPct: cost > 0 ? ((value - cost) / cost) * 100 : 0 };
  }

  return {
    ensure, tick, applyOffline,
    price, buyPrice, sellPrice, changePct, candles,
    holding, buy, sell, portfolioSummary,
  };
})();
