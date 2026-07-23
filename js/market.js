/* =========================================================================
 * market.js — Invest engine: procedural prices, stats, candles, trading,
 *             dividends, and 100% ownership of companies & coins
 * -------------------------------------------------------------------------
 * PROCEDURAL MODEL — every price is a deterministic function of absolute
 * wall-clock time:
 *
 *   priceAt(asset, t) = refPrice
 *       × exp( clampedTrend )            long-run growth from a FIXED epoch
 *       × exp( vol · fbm(seed, t) )      organic multi-scale wiggle (regimes,
 *                                        vol spikes, crashes all emerge here)
 *       × managerFactor(asset, t)        the owner's Manage decisions
 *
 * Because it's a pure function of t (not a stored random walk) we can read
 * any price cheaply for the list, generate candle history back to each
 * asset's founding date on demand, and never step anything per tick.
 *
 * OWNERSHIP — one simple goal: buy shares/coins until you hold 100% of the
 * supply. At 100% the company/coin is fully YOURS: it pays owner income
 * every payout interval and unlocks the Manage decisions. Buying is capped
 * at the supply so you can never hold more than 100%.
 *
 * (The oil price used by the Oil & Gas / Transport businesses lives in
 * js/mechanics.js and is untouched — oil is just no longer tradeable.)
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

  /** Resolve (and cache) an asset's drift / vol / supply / founding / seeds. */
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
        supply: Math.round(Math.pow(10, mag)),   // shares outstanding
        volTurnover: 0.003 + srand(seed, 7) * 0.006,
        foundingSec: Date.UTC(def.founded, 0, 1) / 1000,
      };
    } else {
      // Crypto: supply and founding come straight from the data row.
      p = {
        seed,
        drift: def.drift || 0,
        vol: def.vol || 0,
        divYield: 0, // coins pay nothing — until you own them outright
        supply: def.supply || 0,
        foundingSec: def.founded ? Date.UTC(def.founded, 0, 1) / 1000 : EPOCH - 20 * YEAR,
      };
    }
    paramCache[def.id] = p;
    return p;
  }

  /** Total shares (stock) or coins (crypto) in existence. */
  function supplyOf(def) {
    return params(def).supply;
  }

  /* ------------------------- Owner (manage) fx --------------------------- */

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
    if (m.boostUntil && WALL() < m.boostUntil) f *= 1.10; // "cut costs / burn" window
    return f;
  }

  /* ------------------------------ Pricing -------------------------------- */

  /** Price of an asset at absolute time t (seconds). Pure + deterministic. */
  function priceAt(def, t) {
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

  /* ---------------------- Displayed "ticker" prices ----------------------- */
  // Every place a quote is shown (market list, detail header, portfolio) reads
  // the SAME per-asset display price, so one stock is always consistent across
  // the whole section. Each asset ticks on its OWN ~15s phase (staggered by a
  // hash of its id), so different stocks update at different moments rather than
  // all flipping in lockstep. The chart stays fully live/continuous.
  const TICKER_STEP = 15; // seconds between an asset's ticker updates
  function dispTimeFor(def) {
    const off = hashStr(def.id) % TICKER_STEP;         // 0..14 per-asset phase
    return Math.floor((nowSec() - off) / TICKER_STEP) * TICKER_STEP + off;
  }
  function dispPrice(id) { const d = ASSET_BY_ID[id]; return priceAt(d, dispTimeFor(d)); }
  function dispChangePct(id, sinceSec = DAY) {
    const def = ASSET_BY_ID[id];
    const t = dispTimeFor(def);
    const past = priceAt(def, t - sinceSec);
    if (past <= 0) return 0;
    return ((priceAt(def, t) - past) / past) * 100;
  }

  /* ------------------------------- Candles ------------------------------- */

  /**
   * Aggregate the continuous price sim over [b0, b1] into one OHLC candle:
   * open = first price, close = last price, high/low = max/min across the
   * interval (sampled). The forming (right-most) candle passes b1 = now, so its
   * close tracks the live price and it keeps updating until the boundary passes.
   */
  function aggregate(def, b0, b1) {
    const open = priceAt(def, b0);
    const close = priceAt(def, b1);
    let high = Math.max(open, close), low = Math.min(open, close);
    const steps = MARKET.CANDLE_SAMPLES;
    for (let s = 1; s < steps; s++) {
      const v = priceAt(def, b0 + (b1 - b0) * (s / steps));
      if (v > high) high = v;
      if (v < low) low = v;
    }
    return { time: b0, open, high, low, close };
  }

  /**
   * Generate OHLC candles for a timeframe (id from TIMEFRAMES). Exactly one
   * candle per `bucket` seconds — a NEW candle appears only when the interval
   * boundary passes, not every second. MAX (bucket null) aggregates the asset's
   * whole life into ≤MAX_CANDLES bars.
   */
  function candles(id, tfId) {
    const def = ASSET_BY_ID[id];
    const p = params(def);
    const now = nowSec();
    const tf = MARKET.TIMEFRAMES.find((t) => t.id === tfId) || MARKET.TIMEFRAMES[0];

    let bucket = tf.bucket, n;
    if (!bucket) {
      // MAX — span the asset's whole history back to its founding date.
      const life = Math.max(DAY, now - p.foundingSec);
      bucket = Math.max(60, life / MARKET.MAX_CANDLES);
      n = MARKET.MAX_CANDLES;
    } else {
      // Fixed interval: up to MAX_CANDLES bars, but never before the asset
      // existed (no invented pre-history for young coins).
      n = MARKET.MAX_CANDLES;
      const sinceStart = Math.floor((now - p.foundingSec) / bucket);
      if (sinceStart >= 2 && sinceStart + 1 < n) n = sinceStart + 1;
      n = Math.max(2, n);
    }

    const lastStart = Math.floor(now / bucket) * bucket;
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const b0 = lastStart - i * bucket;
      const b1 = Math.min(b0 + bucket, now);
      out.push(aggregate(def, b0, b1));
    }
    return out;
  }

  /* ------------------------------- Stats --------------------------------- */

  /** Static (price-independent) stat seeds, cached. */
  function staticStats(def) {
    if (statCache[def.id]) return statCache[def.id];
    const p = params(def);
    const s = { group: def.group, supply: p.supply, founded: def.founded };
    s.volPct = (p.vol || 0) * 100 * 12; // rough annualised volatility %
    if (def.group === 'stock') {
      s.pe = p.pe;
      s.divYield = p.divYield;
      s.pb = p.pb;
      s.avgVolume = Math.round(p.supply * p.volTurnover);
    }
    statCache[def.id] = s;
    return s;
  }

  /** Full live stats (market cap etc. move with price). */
  function stats(id) {
    const def = ASSET_BY_ID[id];
    const s = Object.assign({}, staticStats(def));
    const px = price(id);
    const owned = holding(id).shares;
    s.marketCap = px * s.supply;
    s.costToBuyOut = s.marketCap;
    s.available = Math.max(0, s.supply - owned);
    s.ownedShares = owned;
    if (def.group === 'stock') {
      s.companyValue = s.marketCap / s.pb; // ~book value
      s.eps = px / s.pe;
    }
    return s;
  }

  /* ------------------------------ Holdings ------------------------------- */

  function holding(id) {
    ensure();
    if (!state.portfolio[id]) state.portfolio[id] = { shares: 0, cost: 0 };
    return state.portfolio[id];
  }

  /**
   * Spend `cash` on an asset at the ask (fractional shares are expected here —
   * this is the "spend $X" path). Capped at 100% of supply and your balance.
   */
  function buy(id, cash) {
    const def = ASSET_BY_ID[id];
    const h = holding(id);
    const cap = supplyOf(def);
    const remaining = Math.max(0, cap - h.shares);
    if (remaining <= 0) return false;
    const ask = buyPrice(id);
    cash = Math.min(cash, state.balance, remaining * ask);
    if (cash < 0.01) return false;
    state.balance -= cash;
    h.shares += cash / ask;
    // Snap float dust so "buy MAX" lands exactly on 100%.
    if (cap - h.shares < cap * 1e-9) h.shares = cap;
    h.cost += cash;
    saveGame();
    return true;
  }

  /**
   * Buy an EXACT number of shares/coins at the ask — the "buy N shares" path.
   * Keeps the requested count precise (no cash round-trip drift) whenever the
   * player can afford it; only clamps if it exceeds supply or the balance.
   */
  function buyShares(id, shares) {
    const def = ASSET_BY_ID[id];
    const h = holding(id);
    const cap = supplyOf(def);
    const remaining = Math.max(0, cap - h.shares);
    if (remaining <= 0 || shares <= 0) return false;
    const ask = buyPrice(id);
    shares = Math.min(shares, remaining);
    if (shares * ask > state.balance) shares = state.balance / ask; // can't afford exact
    const cost = shares * ask;
    if (cost < 0.01) return false;
    state.balance -= cost;
    h.shares += shares;
    if (cap - h.shares < cap * 1e-9) h.shares = cap; // snap MAX to 100%
    h.cost += cost;
    saveGame();
    return true;
  }

  /**
   * Sell an EXACT number of shares/coins at the bid. Selling (essentially) the
   * whole position snaps to a clean full exit, and any sub-cent residue is
   * cleared, so nothing fractional is ever left lingering in the portfolio.
   * Profit-only counts as earnings.
   */
  function sellShares(id, shares) {
    const h = holding(id);
    if (h.shares <= 0 || shares <= 0) return false;
    if (shares >= h.shares * (1 - 1e-9)) shares = h.shares; // full exit
    shares = Math.min(shares, h.shares);
    const proceeds = shares * sellPrice(id);
    const costOut = (h.cost / h.shares) * shares;
    h.shares -= shares;
    h.cost -= costOut;
    // Clear any negligible (sub-cent) residue so the holding fully disappears.
    if (h.shares <= 0 || h.shares * price(id) < 0.01) { h.shares = 0; h.cost = 0; }
    state.balance += proceeds;
    const gain = proceeds - costOut;
    if (gain > 0) { state.totalEarned += gain; state.runEarned += gain; }
    saveGame();
    return true;
  }

  /** Sell a fraction (0..1) of a position — thin wrapper over sellShares. */
  function sell(id, frac) {
    const h = holding(id);
    return sellShares(id, h.shares * Math.min(1, Math.max(0, frac)));
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

  /* ----------------------- 100% ownership & manage ----------------------- */

  /** Fraction of the company/coin the player holds (0..1). */
  function ownedFrac(id) {
    const def = ASSET_BY_ID[id];
    const cap = supplyOf(def);
    return cap > 0 ? holding(id).shares / cap : 0;
  }

  /** True only at 100% — then it's fully yours. */
  function isOwned(id) {
    return ownedFrac(id) >= 0.999999;
  }

  /**
   * Apply a Manage decision (100% owners only). Returns {ok, msg}.
   *   growth   — invest cash → permanent upward price drift
   *   dividend — pay yourself cash now (5-min cooldown), slight value dip
   *   cutcosts — short +10% price window for 5 min (10-min cooldown)
   *   expand   — invest cash → permanent value increase
   * Same four levers for companies and coins (UI words them differently).
   */
  function manage(id, action) {
    const def = ASSET_BY_ID[id];
    const thing = def.group === 'crypto' ? 'coin' : 'company';
    if (!isOwned(id)) return { ok: false, msg: `You need to own 100% of the ${thing} first.` };
    const s = stats(id);
    const m = mgmtOf(id);
    const now = WALL();

    if (action === 'growth') {
      const cost = s.marketCap * 0.05;
      if (state.balance < cost) return { ok: false, msg: `Need ${formatMoney(cost)} to invest in growth.` };
      state.balance -= cost;
      m.growth = Math.min(0.4, (m.growth || 0) + 0.03);
      saveGame();
      return { ok: true, msg: `Invested ${formatMoney(cost)}. The price will trend upward.` };
    }
    if (action === 'dividend') {
      if (m.lastDivAt && now - m.lastDivAt < 300000) {
        return { ok: false, msg: `On cooldown (${formatDuration((300000 - (now - m.lastDivAt)) / 1000)}).` };
      }
      const payout = s.marketCap * 0.02;
      m.lastDivAt = now;
      m.valueBoost = Math.max(-0.3, (m.valueBoost || 0) - 0.01); // stripping weakens it slightly
      addEarnings(payout);
      saveGame();
      return { ok: true, msg: `Paid yourself ${formatMoney(payout)}.` };
    }
    if (action === 'cutcosts') {
      if (m.boostUntil && now < m.boostUntil) return { ok: false, msg: 'Boost already in effect.' };
      if (m.cutCooldown && now < m.cutCooldown) {
        return { ok: false, msg: `On cooldown (${formatDuration((m.cutCooldown - now) / 1000)}).` };
      }
      m.boostUntil = now + 300000;   // +10% for 5 min
      m.cutCooldown = now + 600000;  // 10-min cooldown
      saveGame();
      return { ok: true, msg: 'Price boosted 10% for 5 minutes.' };
    }
    if (action === 'expand') {
      const cost = s.marketCap * 0.10;
      if (state.balance < cost) return { ok: false, msg: `Need ${formatMoney(cost)} to expand.` };
      state.balance -= cost;
      m.valueBoost = (m.valueBoost || 0) + 0.15;
      saveGame();
      return { ok: true, msg: `Value permanently increased.` };
    }
    return { ok: false, msg: 'Unknown action.' };
  }

  function mgmtState(id) { return (state.market && state.market.mgmt[id]) || {}; }

  /* ---------------------- Dividends & owner income ------------------------ */

  function payDueDividends() {
    ensure();
    const now = WALL();
    let total = 0, intervals = 0;
    while (now >= state.market.nextDivAt && intervals < MARKET.DIV_MAX_CATCHUP) {
      for (const def of ASSET_DEFS) {
        const h = state.portfolio[def.id];
        if (!h || h.shares <= 0) continue;
        // Regular stock dividends on whatever you hold…
        const dy = params(def).divYield;
        if (dy) total += h.shares * price(def.id) * dy;
        // …plus owner income when the whole thing is yours (stock OR coin).
        if (isOwned(def.id)) total += price(def.id) * supplyOf(def) * MARKET.OWNER_INCOME_RATE;
      }
      state.market.nextDivAt += MARKET.DIV_INTERVAL_SEC * 1000;
      intervals++;
    }
    if (now >= state.market.nextDivAt) state.market.nextDivAt = now + MARKET.DIV_INTERVAL_SEC * 1000;
    if (total > 0) {
      addEarnings(total);
      if (typeof UI !== 'undefined') UI.showToast(`💰 <b>Income paid</b><br>+${formatMoney(total)} from dividends & owned assets.`);
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
  // payouts (cheap; runs at most a few times a minute).
  function tick() { payDueDividends(); }

  // Offline: prices already "moved" (function of t); just pay missed income.
  function applyOffline() { payDueDividends(); }

  return {
    ensure, tick, applyOffline,
    price, priceAt, buyPrice, sellPrice, changePct, candles,
    holding, buy, buyShares, sell, sellShares, portfolioSummary,
    dispPrice, dispChangePct,
    stats, params, supplyOf, timeframes: MARKET.TIMEFRAMES,
    ownedFrac, isOwned, manage, mgmtState,
    // Back-compat aliases (older callers/tests used "control" wording).
    controlFrac: ownedFrac, isControlled: isOwned,
  };
})();
