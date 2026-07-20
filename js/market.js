/* =========================================================================
 * market.js — Phase 4 (overhauled) engine: procedural prices, stats,
 *             candles, trading, dividends, company buyouts
 * -------------------------------------------------------------------------
 * PROCEDURAL MODEL — every price is a deterministic function of absolute
 * wall-clock time:
 *
 *   priceAt(asset, t) = refPrice
 *       × exp( clampedTrend )            long-run growth from a FIXED epoch
 *       × exp( vol · fbm(seed, t) )      organic multi-scale wiggle (regimes,
 *                                        vol spikes, crashes all emerge here)
 *       × managerFactor(asset, t)        player buyout decisions
 *
 * Because it's a pure function of t (not of a stored random walk), we can:
 *   - read any asset's current price cheaply for the 170-row list,
 *   - generate candle history back to any founding date on demand,
 *   - run the FULL chart only for the asset that's open — nothing is stepped
 *     per tick, so 170 assets cost nothing when you're not looking at them.
 *
 * Crude Oil is special-cased to Mechanics.oilPrice() so it shares the exact
 * cycle the Oil & Gas and Transport businesses react to. Cash is flat;
 * Savings grows smoothly. Trading semantics (spread, cost basis, profit-only
 * earnings, dividends) match the previous phase.
 * ========================================================================= */

const Market = (() => {
  const WALL = () => Date.now();
  const nowSec = () => WALL() / 1000;
  const { EPOCH, DAY, YEAR } = MARKET;

  // Derived params + stats are pure functions of id → cache them (never saved).
  const paramCache = {};
  const statCache = {};

  /* ------------------------- Deterministic noise ------------------------- */

  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  /** Seeded pseudo-random in [0,1) from (seed, integer index). */
  function srand(seed, i) {
    let h = Math.imul(seed ^ Math.imul(i | 0, 0x9e3779b1), 0x85ebca6b);
    h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  /** Smooth value noise in [0,1) over a continuous coordinate x. */
  function vnoise(seed, x) {
    const i = Math.floor(x), f = x - i;
    const a = srand(seed, i), b = srand(seed, i + 1);
    const u = f * f * (3 - 2 * f); // smoothstep
    return a + (b - a) * u;
  }

  // Fractal noise over TIME (days). Long periods dominate so multi-month
  // swings are large while intraday is gentle. Output roughly [-6, 6].
  const FBM_PERIODS = [730, 180, 45, 10, 2.5, 0.4]; // days
  const FBM_AMPS =    [2.6, 1.7, 1.0, 0.6, 0.35, 0.18];
  function fbm(seed, tDays) {
    let v = 0;
    for (let k = 0; k < FBM_PERIODS.length; k++) {
      v += FBM_AMPS[k] * (vnoise(seed + k * 131, tDays / FBM_PERIODS[k]) - 0.5) * 2;
    }
    return v;
  }

  /* ---------------------------- Asset params ----------------------------- */

  /** Resolve (and cache) an asset's drift / vol / founding / stat seeds. */
  function params(def) {
    if (paramCache[def.id]) return paramCache[def.id];
    const seed = hashStr(def.id);
    let p;
    if (def.group === 'stock') {
      const prof = SECTOR_PROFILES[def.sector] || SECTOR_PROFILES.tech;
      const pick = (i, [lo, hi]) => lo + srand(seed, i) * (hi - lo);
      const mag = 8.6 + srand(seed, 6) * 2.1; // shares outstanding 10^8.6..10^10.7
      p = {
        seed,
        drift: prof.drift * (0.75 + srand(seed, 1) * 0.5),
        vol: prof.vol * (0.8 + srand(seed, 2) * 0.5),
        pe: pick(3, prof.pe),
        divYield: pick(4, prof.div),
        pb: pick(5, prof.pb),
        shares: Math.round(Math.pow(10, mag)),
        floatFrac: 0.45 + srand(seed, 8) * 0.4,
        volTurnover: 0.003 + srand(seed, 7) * 0.006,
        foundingSec: Date.UTC(def.founded, 0, 1) / 1000,
      };
    } else {
      p = {
        seed,
        drift: def.drift || 0,
        vol: def.vol || 0,
        divYield: def.divYield || 0,
        foundingSec: EPOCH - 60 * YEAR, // long backstory for Max charts
      };
    }
    paramCache[def.id] = p;
    return p;
  }

  /* ------------------------- Manager (buyout) fx ------------------------- */

  function mgmtOf(id) {
    ensure();
    if (!state.market.mgmt[id]) state.market.mgmt[id] = {};
    return state.market.mgmt[id];
  }
  function mgmtGrowth(def) {
    const m = state.market && state.market.mgmt[def.id];
    return m && m.growth ? m.growth : 0;
  }
  function managerFactor(def, t) {
    const m = state.market && state.market.mgmt[def.id];
    if (!m) return 1;
    let f = 1 + (m.valueBoost || 0);
    if (m.boostUntil && WALL() < m.boostUntil) f *= 1.10; // "cut costs" window
    return f;
  }

  /* ------------------------------ Pricing -------------------------------- */

  /** Price of an asset at absolute time t (seconds). Pure + deterministic. */
  function priceAt(def, t) {
    if (def.flat) return def.refPrice;
    if (def.savings) {
      return def.refPrice * Math.exp((params(def).drift) * (t - EPOCH) / YEAR);
    }
    if (def.oilLinked && typeof Mechanics !== 'undefined') {
      return def.refPrice * Mechanics.oilPrice(Math.max(0, nowSec() - t));
    }
    const p = params(def);
    // Trend clamped so century-old firms aren't astronomically priced and
    // history reads as a gentle climb, not a hockey stick.
    const expo = Math.max(-3.0, (p.drift + mgmtGrowth(def)) * (t - EPOCH) / YEAR);
    const noise = p.vol * fbm(p.seed, t / DAY)
      + p.vol * 0.15 * (vnoise(p.seed + 777, t / 12) - 0.5) * 2; // fast live tick
    let price = def.refPrice * Math.exp(expo) * Math.exp(noise) * managerFactor(def, t);
    // Sanity clamps only (prevent 0/Infinity); wide enough to never shape.
    return Math.min(def.refPrice * 1e6, Math.max(def.refPrice * 1e-6, price));
  }

  function price(id) { return priceAt(ASSET_BY_ID[id], nowSec()); }
  function buyPrice(id) { return price(id) * (1 + MARKET.SPREAD); }
  function sellPrice(id) { return price(id) * (1 - MARKET.SPREAD); }

  /** % change of current price vs `sinceSec` ago (default 1 day). */
  function changePct(id, sinceSec = DAY) {
    const def = ASSET_BY_ID[id];
    const now = nowSec();
    const past = priceAt(def, now - sinceSec);
    if (past <= 0) return 0;
    return ((priceAt(def, now) - past) / past) * 100;
  }

  /* ------------------------------- Candles ------------------------------- */

  /** Generate OHLC candles on demand for a timeframe (id from TIMEFRAMES). */
  function candles(id, tfId) {
    const def = ASSET_BY_ID[id];
    const p = params(def);
    const now = nowSec();
    const tf = MARKET.TIMEFRAMES.find((t) => t.id === tfId) || MARKET.TIMEFRAMES[0];

    let span = tf.span, bucket = tf.bucket;
    if (!span) { // Max: founding → now
      span = Math.max(DAY, now - p.foundingSec);
      bucket = Math.max(3600, span / MARKET.MAX_CANDLES);
    }
    let n = Math.min(MARKET.MAX_CANDLES, Math.max(2, Math.floor(span / bucket)));
    const lastStart = Math.floor(now / bucket) * bucket;

    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const b0 = lastStart - i * bucket;
      const b1 = Math.min(b0 + bucket, now);
      const open = priceAt(def, b0);
      const close = priceAt(def, b1);
      let high = Math.max(open, close), low = Math.min(open, close);
      for (let s = 1; s < MARKET.CANDLE_SAMPLES; s++) {
        const v = priceAt(def, b0 + (b1 - b0) * (s / MARKET.CANDLE_SAMPLES));
        if (v > high) high = v;
        if (v < low) low = v;
      }
      out.push({ time: b0, open, high, low, close });
    }
    return out;
  }

  /* ------------------------------- Stats --------------------------------- */

  /** Static (price-independent) stat seeds, cached. */
  function staticStats(def) {
    if (statCache[def.id]) return statCache[def.id];
    const p = params(def);
    const s = { group: def.group };
    if (def.group === 'stock') {
      s.shares = p.shares;
      s.pe = p.pe;
      s.divYield = p.divYield;
      s.pb = p.pb;
      s.volPct = p.vol * 100 * 12;           // rough annualised volatility %
      s.avgVolume = Math.round(p.shares * p.volTurnover);
      s.publicShares = Math.round(p.shares * p.floatFrac);
      s.founded = def.founded;
    } else {
      s.volPct = (p.vol || 0) * 100 * 12;
      s.divYield = p.divYield;
    }
    statCache[def.id] = s;
    return s;
  }

  /** Full live stats (market cap etc. move with price). */
  function stats(id) {
    const def = ASSET_BY_ID[id];
    const s = Object.assign({}, staticStats(def));
    const px = price(id);
    if (def.group === 'stock') {
      s.marketCap = px * s.shares;
      s.companyValue = s.marketCap / s.pb;   // ~book value
      s.eps = px / s.pe;
      s.costToBuyOut = s.marketCap;
      const owned = holding(id).shares;
      s.sharesAvailable = Math.max(0, s.publicShares - owned);
      s.ownedShares = owned;
    }
    return s;
  }

  /* ------------------------------ Holdings ------------------------------- */

  function holding(id) {
    ensure();
    if (!state.portfolio[id]) state.portfolio[id] = { shares: 0, cost: 0 };
    return state.portfolio[id];
  }

  function buy(id, cash) {
    cash = Math.min(cash, state.balance);
    if (cash < 0.01) return false;
    const h = holding(id);
    state.balance -= cash;
    h.shares += cash / buyPrice(id);
    h.cost += cash;
    saveGame();
    return true;
  }

  /** Sell a fraction of a position at the bid. Profit-only counts as earnings. */
  function sell(id, frac) {
    const h = holding(id);
    const shares = h.shares * Math.min(1, Math.max(0, frac));
    if (shares <= 0) return false;
    const proceeds = shares * sellPrice(id);
    const costOut = (h.cost / h.shares) * shares;
    h.shares -= shares;
    h.cost -= costOut;
    if (h.shares < 1e-9) { h.shares = 0; h.cost = 0; }
    state.balance += proceeds;
    const gain = proceeds - costOut;
    if (gain > 0) { state.totalEarned += gain; state.runEarned += gain; }
    saveGame();
    return true;
  }

  function portfolioSummary() {
    ensure();
    let value = 0, cost = 0;
    for (const def of ASSET_DEFS) {
      const h = state.portfolio[def.id];
      if (h && h.shares > 0) { value += h.shares * price(def.id); cost += h.cost; }
    }
    return { value, cost, pl: value - cost, plPct: cost > 0 ? ((value - cost) / cost) * 100 : 0 };
  }

  /* ------------------------- Company buyouts ----------------------------- */

  /** Fraction of a company the player owns (share count / shares outstanding). */
  function controlFrac(id) {
    const def = ASSET_BY_ID[id];
    if (def.group !== 'stock') return 0;
    return holding(id).shares / staticStats(def).shares;
  }
  function isControlled(id) { return controlFrac(id) >= 0.5; }

  /**
   * Apply a "Manage company" decision (owner-only). Returns {ok, msg}.
   *   growth   — invest cash → permanent upward price drift
   *   dividend — pay yourself cash now (5-min cooldown), slight value dip
   *   cutcosts — short 10% price boost for 5 min (10-min cooldown)
   *   expand   — invest cash → permanent company-value (price) increase
   */
  function manage(id, action) {
    if (!isControlled(id)) return { ok: false, msg: 'You need to own 50% of the company first.' };
    const s = stats(id);
    const m = mgmtOf(id);
    const now = WALL();

    if (action === 'growth') {
      const cost = s.marketCap * 0.05;
      if (state.balance < cost) return { ok: false, msg: `Need ${formatMoney(cost)} to invest in growth.` };
      state.balance -= cost;
      m.growth = Math.min(0.4, (m.growth || 0) + 0.03);
      saveGame();
      return { ok: true, msg: `Invested ${formatMoney(cost)}. Share price will trend upward.` };
    }
    if (action === 'dividend') {
      if (m.lastDivAt && now - m.lastDivAt < 300000) {
        return { ok: false, msg: `Dividend on cooldown (${formatDuration((300000 - (now - m.lastDivAt)) / 1000)}).` };
      }
      const payout = s.marketCap * 0.02;
      m.lastDivAt = now;
      m.valueBoost = Math.max(-0.3, (m.valueBoost || 0) - 0.01); // stripping weakens it slightly
      addEarnings(payout);
      saveGame();
      return { ok: true, msg: `Paid yourself ${formatMoney(payout)} in dividends.` };
    }
    if (action === 'cutcosts') {
      if (m.boostUntil && now < m.boostUntil) return { ok: false, msg: 'Cost-cutting already in effect.' };
      if (m.cutCooldown && now < m.cutCooldown) {
        return { ok: false, msg: `Cost-cutting on cooldown (${formatDuration((m.cutCooldown - now) / 1000)}).` };
      }
      m.boostUntil = now + 300000;   // +10% for 5 min
      m.cutCooldown = now + 600000;  // 10-min cooldown
      saveGame();
      return { ok: true, msg: 'Costs cut — share price boosted 10% for 5 minutes.' };
    }
    if (action === 'expand') {
      const cost = s.marketCap * 0.10;
      if (state.balance < cost) return { ok: false, msg: `Need ${formatMoney(cost)} to expand.` };
      state.balance -= cost;
      m.valueBoost = (m.valueBoost || 0) + 0.15;
      saveGame();
      return { ok: true, msg: `Expanded operations. Company value rose ${formatMoney(cost * 1.5)}.` };
    }
    return { ok: false, msg: 'Unknown action.' };
  }

  function mgmtState(id) { return (state.market && state.market.mgmt[id]) || {}; }

  /* ------------------------------ Dividends ------------------------------ */

  function payDueDividends() {
    ensure();
    const now = WALL();
    let total = 0, intervals = 0;
    while (now >= state.market.nextDivAt && intervals < MARKET.DIV_MAX_CATCHUP) {
      for (const def of ASSET_DEFS) {
        const dy = params(def).divYield;
        if (!dy) continue;
        const h = state.portfolio[def.id];
        if (h && h.shares > 0) total += h.shares * price(def.id) * dy;
      }
      state.market.nextDivAt += MARKET.DIV_INTERVAL_SEC * 1000;
      intervals++;
    }
    if (now >= state.market.nextDivAt) state.market.nextDivAt = now + MARKET.DIV_INTERVAL_SEC * 1000;
    if (total > 0) {
      addEarnings(total);
      if (typeof UI !== 'undefined') UI.showToast(`💰 <b>Income paid</b><br>+${formatMoney(total)} in dividends & coupons.`);
      saveGame();
    }
  }

  /* --------------------------- Lifecycle hooks --------------------------- */

  function ensure() {
    if (!state.market || !state.market.mgmt) {
      state.market = { nextDivAt: WALL() + MARKET.DIV_INTERVAL_SEC * 1000, mgmt: {} };
    }
    if (!state.portfolio) state.portfolio = {};
  }

  // Prices are pure functions of time — nothing to step. Tick only handles
  // dividend payouts (cheap; runs at most a few times a minute).
  function tick() { payDueDividends(); }

  // Offline: prices already "moved" (function of t); just pay missed coupons.
  function applyOffline() { payDueDividends(); }

  return {
    ensure, tick, applyOffline,
    price, priceAt, buyPrice, sellPrice, changePct, candles,
    holding, buy, sell, portfolioSummary,
    stats, params, groups: MARKET_GROUPS, timeframes: MARKET.TIMEFRAMES,
    controlFrac, isControlled, manage, mgmtState,
  };
})();
