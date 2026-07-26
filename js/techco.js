/* =========================================================================
 * techco.js — Tech-sector company management (Phase 1: Dashboard + Products)
 * -------------------------------------------------------------------------
 * When you own 100% of one of the five TECH companies (see data/techco.js) a
 * "Manage Company" button opens a fullscreen operations dashboard. Phase 1
 * delivers the dashboard shell (headline + detail stats, tabbed layout) and a
 * complete PRODUCT DEVELOPMENT loop: launch products from that company's own
 * catalog, choose Budget / Quality / Pricing, wait out a build timer, roll a
 * market reception, then watch the product earn — and decay — over time.
 *
 * GLOBAL RULE: every cost and reward scales off the company's BASE PASSIVE
 * INCOME (a function of its live market cap), never flat cash. Base income is
 * the single unit that everything else is a multiple/percentage of.
 *
 * Each company keeps its OWN independent state in state.techco[id], persisted
 * to localStorage. Build/decay timers use wall-clock time, so they advance on
 * the game tick AND while the app is closed; completions fire a toast.
 *
 * Phases 2–5 layer Staff, R&D, Valuation, Rivals, Manufacturing and events on
 * top — the tab bar (Products | Staff | R&D | Market | More) is already here.
 * ========================================================================= */

const TechCo = (() => {
  /* --------------------------------- Config -------------------------------- */

  const CFG = {
    INCOME_RATE: 0.001,   // base passive income per in-game DAY = marketCap × this
    DAY_SECONDS: 20,      // real seconds per in-game day (sim runs accelerated)
    OPEX: 0.50,           // Phase-1 operating cost as a fraction of revenue
    SEED_DAYS: 20,        // starting company cash = this many days of base income
    DECAY_PER_DAY: 2.5,   // product health lost per in-game day
    MAX_ACCRUE_DAYS: 3000,// cap a single cash-accrual jump (long offline)
    HEALTH_MAX: 120,
  };

  // Budget tiers: bigger budget → higher one-off cost and better reception odds.
  const BUDGETS = {
    lean:        { label: 'Lean',        costMult: 6,  score: 0, note: 'Cheap & cheerful' },
    standard:    { label: 'Standard',    costMult: 14, score: 1, note: 'A solid effort' },
    blockbuster: { label: 'Blockbuster', costMult: 30, score: 2, note: 'Bet the house' },
  };
  // Quality tiers: better quality → longer build, better odds, fresher launch.
  const QUALITIES = {
    rush:     { label: 'Rush',     seconds: 90,  score: 0, health: 85,  note: 'Fast, rough edges' },
    standard: { label: 'Standard', seconds: 180, score: 1, health: 100, note: 'Balanced build' },
    polished: { label: 'Polished', seconds: 300, score: 2, health: 118, note: 'Slow, refined' },
  };
  // Pricing: margin vs volume. Premium = income per sale up, reach down; Budget
  // = income per sale down, market-share reach up.
  const PRICINGS = {
    premium:  { label: 'Premium',  incomeFactor: 1.25, shareFactor: 0.70, note: 'High margin, low volume' },
    balanced: { label: 'Balanced', incomeFactor: 1.00, shareFactor: 1.00, note: 'Middle of the road' },
    budget:   { label: 'Budget',   incomeFactor: 0.80, shareFactor: 1.45, note: 'Low margin, high volume' },
  };

  // Market reception outcomes, worst → best. `incomeFrac` = share of base income
  // this product adds (before pricing & health); `share` = market-share points.
  const RECEPTIONS = {
    flop:     { label: 'Flop',     emoji: '💤', incomeFrac: 0.010, rating: 1, share: 0.3, rep: -4, sat: -3 },
    modest:   { label: 'Modest',   emoji: '🙂', incomeFrac: 0.035, rating: 2, share: 0.8, rep: +1, sat: +1 },
    solid:    { label: 'Solid',    emoji: '👍', incomeFrac: 0.080, rating: 3, share: 1.6, rep: +3, sat: +2 },
    hit:      { label: 'Hit',      emoji: '🔥', incomeFrac: 0.150, rating: 4, share: 3.0, rep: +6, sat: +4 },
    breakout: { label: 'Breakout', emoji: '🚀', incomeFrac: 0.260, rating: 5, share: 5.5, rep: +9, sat: +6 },
  };

  // ---- Phase 2: Staff groups (three meaningful teams, not 7 departments) ----
  const STAFF = {
    eng: { label: 'Engineering',          blurb: 'Build speed · quality · project slots' },
    mkt: { label: 'Marketing & Sales',    blurb: 'Market share · product reception' },
    ops: { label: 'Operations & Support', blurb: 'Customer satisfaction · cost efficiency' },
  };
  const STAFF_SEED = { eng: 5, mkt: 4, ops: 4 };
  const STAFF_CFG = {
    HIRE_BASE: 3, HIRE_GROWTH: 0.5,   // hire = baseIncome × 3 × (1 + count×0.5)
    PAYROLL_PER_HEAD: 0.02,           // × baseIncome per head, per in-game day
    TRAIN_BASE: 8, TRAIN_MAX: 5,      // train = baseIncome × 8 × (1 + level)
  };

  // ---- Phase 2: Research tree (shared 5-tier template; names/flagship per co) ----
  // Tier i requires every lower tier done. Tier 3 unlocks the company's flagship
  // product (def.unlockProduct). Costs/timers scale off base income.
  const RESEARCH_TIERS = [
    { costMult: 8,   seconds: 120, success: 0.90, effect: { kind: 'reception', bonus: 0.6 } },
    { costMult: 18,  seconds: 240, success: 0.82, effect: { kind: 'cost',      cut: 0.06 } },
    { costMult: 35,  seconds: 400, success: 0.75, effect: { kind: 'income',    mult: 1.15 } },
    { costMult: 60,  seconds: 600, success: 0.68, effect: { kind: 'unlock' } },
    { costMult: 100, seconds: 900, success: 0.60, effect: { kind: 'income',    mult: 1.25 } },
  ];
  const effectText = (e) => e.kind === 'reception' ? 'Better product reception'
    : e.kind === 'cost' ? `Cut operating costs ${Math.round(e.cut * 100)}%`
    : e.kind === 'income' ? `Company income ×${e.mult}`
    : 'Unlock a flagship product';

  const RNG = () => Math.random();

  /* ------------------------------ Small utils ------------------------------ */

  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const now = () => Date.now();

  function isManaged(id) { return !!TECHCO_DEFS[id]; }
  function def(id) { return TECHCO_DEFS[id]; }

  /* --------------------------- Per-company state --------------------------- */

  function ensureRoot() {
    if (!state.techco) state.techco = {};
    return state.techco;
  }

  /** Live market cap of the company (its real, tradeable value). */
  function marketCap(id) {
    return (typeof Market !== 'undefined' && Market.stats) ? Market.stats(id).marketCap : 0;
  }

  /** THE scaling unit: base passive income per in-game day. Everything else is
   *  a multiple/percentage of this — never flat cash. */
  function baseIncome(id) {
    return marketCap(id) * CFG.INCOME_RATE;
  }

  /** Create a company's state the first time it's opened at 100% ownership. */
  function ensureCompany(id) {
    const root = ensureRoot();
    if (root[id]) { normalize(root[id], id); return root[id]; } // back-fill older (v13) states
    const d = def(id);
    const seed = hash(id + '#techco');
    const cap = marketCap(id);
    const co = {
      founded: now(),
      lastMs: now(),
      cash: baseIncome(id) * CFG.SEED_DAYS,
      products: [],          // live products (see makeProduct)
      builds: [],            // in-progress developments
      nextPid: 1,
      // Static-ish company character (seeded so it's stable per company).
      baseShare: 6 + (seed % 13),               // 6..18% baseline market share
      reputation: 52 + (hash(id + '#rep') % 17), // 52..68
      satisfaction: 54 + (hash(id + '#sat') % 15),// 54..68
      employees: clamp(Math.round(cap / 2.5e7), 4000, 250000),
    };
    root[id] = co;
    normalize(co, id);
    return co;
  }

  /** Fill in Phase-2 fields on new or older (v13) company states, in place. */
  function normalize(c, id) {
    if (!c.staff) c.staff = {
      eng: { count: STAFF_SEED.eng, training: 0 },
      mkt: { count: STAFF_SEED.mkt, training: 0 },
      ops: { count: STAFF_SEED.ops, training: 0 },
    };
    if (!c.research) c.research = { done: {}, active: null };
    if (!c.unlocked) c.unlocked = [];          // [ [name, phys], ... ] from research
    if (c.cumProfit == null) c.cumProfit = 0;  // cumulative net profit (valuation input)
    if (c.valuation == null) c.valuation = marketCap(id);
  }

  function co(id) { const c = ensureCompany(id); normalize(c, id); return c; }

  /* ----------------------------- Product model ----------------------------- */

  function makeProduct(id, build, reception) {
    const c = co(id);
    const r = RECEPTIONS[reception];
    const q = QUALITIES[build.quality];
    return {
      pid: c.nextPid++,
      type: build.type,
      phys: build.phys,
      budget: build.budget,
      quality: build.quality,
      pricing: build.pricing,
      reception,
      rating: r.rating,
      incomeFrac: r.incomeFrac,     // captured at launch
      shareBase: r.share,
      health: q.health,
      healthMax: q.health,
      updates: 0,
      launchedAt: now(),
    };
  }

  /** A live product's income contribution ($/in-game day), scaled by pricing,
   *  its current health, and company-wide research multipliers. */
  function productIncome(id, p) {
    const pr = PRICINGS[p.pricing];
    return baseIncome(id) * p.incomeFrac * pr.incomeFactor * (Math.max(0, p.health) / 100) * researchMult(id);
  }

  /** A live product's market-share contribution (percentage points). */
  function productShare(id, p) {
    const pr = PRICINGS[p.pricing];
    return p.shareBase * pr.shareFactor * (Math.max(0, p.health) / 100);
  }

  /* ------------------------- Phase 2: Staff effects ------------------------ */

  // Effective strength of a group = headcount scaled by training (no payroll add).
  function groupEff(id, g) { const s = co(id).staff[g]; return s.count * (1 + 0.35 * s.training); }

  function buildSpeedMult(id) { return clamp(1 - groupEff(id, 'eng') * 0.02, 0.4, 1); }     // faster builds
  function concurrentSlots(id) { return clamp(1 + Math.floor(groupEff(id, 'eng') / 4), 1, 5); }
  function shareMult(id) { return clamp(1 + groupEff(id, 'mkt') * 0.02, 1, 2.2); }
  function satTarget(id) { return clamp(50 + groupEff(id, 'ops') * 2, 0, 100); }
  function staffReceptionBonus(id) {
    return clamp(groupEff(id, 'eng') * 0.015 + groupEff(id, 'mkt') * 0.03, 0, 2);
  }
  function payrollPerDay(id) {
    const c = co(id), heads = c.staff.eng.count + c.staff.mkt.count + c.staff.ops.count;
    return baseIncome(id) * STAFF_CFG.PAYROLL_PER_HEAD * heads;
  }
  function hireCost(id, g) { return baseIncome(id) * STAFF_CFG.HIRE_BASE * (1 + co(id).staff[g].count * STAFF_CFG.HIRE_GROWTH); }
  function trainCost(id, g) { return baseIncome(id) * STAFF_CFG.TRAIN_BASE * (1 + co(id).staff[g].training); }

  function hire(id, g) {
    const c = co(id); const cost = hireCost(id, g);
    if (c.cash < cost) return { ok: false, msg: `Need ${formatMoney(cost)} to hire.` };
    c.cash -= cost; c.staff[g].count++; saveGame();
    if (dash && dash.id === id) rebuildDash();
    return { ok: true, msg: `Hired into ${STAFF[g].label}.` };
  }
  function train(id, g) {
    const c = co(id);
    if (c.staff[g].training >= STAFF_CFG.TRAIN_MAX) return { ok: false, msg: 'Already fully trained.' };
    const cost = trainCost(id, g);
    if (c.cash < cost) return { ok: false, msg: `Need ${formatMoney(cost)} to train.` };
    c.cash -= cost; c.staff[g].training++; saveGame();
    if (dash && dash.id === id) rebuildDash();
    return { ok: true, msg: `${STAFF[g].label} trained.` };
  }

  /* ----------------------- Phase 2: Research effects ----------------------- */

  const researchDone = (id, tier) => !!co(id).research.done[tier];
  function researchMult(id) {
    let m = 1;
    RESEARCH_TIERS.forEach((t, i) => { if (t.effect.kind === 'income' && researchDone(id, i)) m *= t.effect.mult; });
    return m;
  }
  function researchCostCut(id) {
    let cut = 0;
    RESEARCH_TIERS.forEach((t, i) => { if (t.effect.kind === 'cost' && researchDone(id, i)) cut += t.effect.cut; });
    return cut;
  }
  function researchReceptionBonus(id) {
    let b = 0;
    RESEARCH_TIERS.forEach((t, i) => { if (t.effect.kind === 'reception' && researchDone(id, i)) b += t.effect.bonus; });
    return b;
  }
  // Operating-cost rate after Operations staff + research cost-cuts.
  function opexRate(id) {
    const opsCut = clamp(groupEff(id, 'ops') * 0.012, 0, 0.28);
    return clamp(CFG.OPEX - opsCut - researchCostCut(id), 0.15, CFG.OPEX);
  }
  // Live catalog = base products + any flagship products unlocked by research.
  function catalogFor(id) { return def(id).catalog.concat(co(id).unlocked); }

  const researchName = (id, tier) => def(id).research[tier] || ('Tier ' + (tier + 1));
  const researchAvailable = (id, tier) => {
    if (researchDone(id, tier)) return false;
    for (let i = 0; i < tier; i++) if (!researchDone(id, i)) return false;
    return true;
  };
  const researchCost = (id, tier) => baseIncome(id) * RESEARCH_TIERS[tier].costMult;
  const researchSuccess = (id, tier) => clamp(RESEARCH_TIERS[tier].success + groupEff(id, 'eng') * 0.008, RESEARCH_TIERS[tier].success, 0.95);

  function startResearch(id, tier) {
    const c = co(id);
    if (c.research.active) return { ok: false, msg: 'A research project is already running.' };
    if (!researchAvailable(id, tier)) return { ok: false, msg: 'Complete the previous project first.' };
    const cost = researchCost(id, tier);
    if (c.cash < cost) return { ok: false, msg: `Need ${formatMoney(cost)} to research.` };
    c.cash -= cost;
    c.research.active = { tier, cost, startMs: now(), endsAt: now() + RESEARCH_TIERS[tier].seconds * 1000 };
    saveGame();
    return { ok: true, msg: `${researchName(id, tier)} research started.` };
  }

  function resolveResearch(id) {
    const c = co(id);
    const a = c.research.active;
    if (!a || now() < a.endsAt) return;
    c.research.active = null;
    const tier = a.tier, t = RESEARCH_TIERS[tier];
    if (RNG() < researchSuccess(id, tier)) {
      c.research.done[tier] = true;
      if (t.effect.kind === 'unlock') {
        const up = def(id).unlockProduct;
        if (up && !c.unlocked.some((r) => r[0] === up[0])) c.unlocked.push(up);
        toast(`🔬 <b>${researchName(id, tier)} complete!</b><br>Unlocked a flagship product: ${up ? up[0] : ''}.`);
      } else {
        toast(`🔬 <b>${researchName(id, tier)} complete!</b><br>${effectText(t.effect)}.`);
      }
    } else {
      c.cash += a.cost * 0.6; // 60% refunded on a failed project — a real gamble
      toast(`⚠️ <b>${researchName(id, tier)} failed</b><br>60% of the budget was recovered. Try again.`);
    }
    saveGame();
    if (dash && dash.id === id) rebuildDash();
  }

  /* --------------------------- Reception rolling --------------------------- */

  /** Roll a market reception, shifted by budget + quality (+ future staff/R&D).
   *  Returns a reception key. */
  function rollReception(build, bonus = 0) {
    const score = BUDGETS[build.budget].score + QUALITIES[build.quality].score + bonus + RNG() * 2;
    if (score < 1.2) return 'flop';
    if (score < 2.4) return 'modest';
    if (score < 3.6) return 'solid';
    if (score < 4.7) return 'hit';
    return 'breakout';
  }

  /* ------------------------------ Aggregate stats -------------------------- */

  function revenuePerDay(id) {
    const c = co(id);
    let rev = baseIncome(id) * researchMult(id); // baseline operations (× research)
    for (const p of c.products) rev += productIncome(id, p);
    return rev;
  }
  // Net profit = revenue − operating costs − payroll. Overspending on staff
  // makes this negative and burns company cash (see advance()).
  function netProfitPerDay(id) {
    const rev = revenuePerDay(id);
    return rev - rev * opexRate(id) - payrollPerDay(id);
  }
  function marketShare(id) {
    const c = co(id);
    let s = c.baseShare;
    for (const p of c.products) s += productShare(id, p);
    return clamp(s * shareMult(id), 0.5, 95);
  }

  // Valuation target: grows with market cap, product portfolio, research and
  // market share, plus retained (cumulative) profit. Valuation only ratchets up.
  function valuationTarget(id) {
    const c = co(id);
    let ratingSum = 0;
    for (const p of c.products) ratingSum += p.rating;
    return marketCap(id) * (1 + 0.02 * ratingSum) * researchMult(id) * (1 + marketShare(id) / 150)
      + c.cumProfit * 0.3;
  }

  function snapshot(id) {
    const c = co(id);
    return {
      value: Math.max(c.valuation, valuationTarget(id)), // headline "Company Value"
      marketCap: marketCap(id),
      netProfitDay: netProfitPerDay(id),
      cash: c.cash,
      share: marketShare(id),
      revenueDay: revenuePerDay(id),
      payrollDay: payrollPerDay(id),
      employees: c.employees,
      activeProducts: c.products.length,
      slots: concurrentSlots(id),
      slotsUsed: c.builds.length,
      reputation: c.reputation,
      satisfaction: c.satisfaction,
      baseIncomeDay: baseIncome(id),
      researchMult: researchMult(id),
    };
  }

  /* ---------------------------- Time advancement --------------------------- */

  /** Advance ONE company: complete any finished builds, decay products, accrue
   *  cash for the elapsed real time. Wall-clock based, so offline counts too. */
  function advance(id) {
    const c = co(id);
    const t = now();

    // 1) Resolve finished builds (may resolve several after a long absence).
    if (c.builds.length) {
      const done = [];
      c.builds = c.builds.filter((b) => {
        if (t >= b.endsAt) { done.push(b); return false; }
        return true;
      });
      for (const b of done) completeBuild(id, b);
    }

    // 2) Resolve a finished research project (success/failure roll).
    resolveResearch(id);

    // 3) Age products / accrue cash & profit over the in-game days elapsed.
    let days = (t - c.lastMs) / (CFG.DAY_SECONDS * 1000);
    c.lastMs = t;
    if (days > 0) {
      days = Math.min(days, CFG.MAX_ACCRUE_DAYS);
      // Net profit (revenue − costs − payroll) over the window. Can be negative
      // if payroll is bloated → company cash burns down.
      const net = netProfitPerDay(id) * days;
      c.cash += net;
      c.cumProfit = Math.max(0, c.cumProfit + net); // retained earnings (valuation input)
      // Customer satisfaction eases toward the Operations-staff target.
      c.satisfaction += (satTarget(id) - c.satisfaction) * clamp(days * 0.1, 0, 1);
      c.satisfaction = clamp(c.satisfaction, 0, 100);
      // Decay + retire products.
      const retired = [];
      for (const p of c.products) {
        p.health -= CFG.DECAY_PER_DAY * days;
        if (p.health <= 0) retired.push(p);
      }
      if (retired.length) {
        c.products = c.products.filter((p) => p.health > 0);
        for (const p of retired) toast(`📦 <b>${p.type} retired</b><br>${companyName(id)} sunset an ageing product.`);
      }
    }

    // 4) Company valuation ratchets up toward its growth target.
    const target = valuationTarget(id);
    if (target > c.valuation) c.valuation = target;
  }

  function completeBuild(id, b) {
    const c = co(id);
    // Staff (Engineering quality + Marketing) and research push reception upward.
    const reception = rollReception(b, staffReceptionBonus(id) + researchReceptionBonus(id));
    const p = makeProduct(id, b, reception);
    c.products.push(p);
    const r = RECEPTIONS[reception];
    // Reception nudges brand reputation + customer satisfaction.
    c.reputation = clamp(c.reputation + r.rep, 0, 100);
    c.satisfaction = clamp(c.satisfaction + r.sat, 0, 100);
    toast(`${r.emoji} <b>${p.type}: ${r.label}!</b><br>${companyName(id)} launched a new product (${'★'.repeat(r.rating)}).`);
    saveGame();
    if (dash && dash.id === id) rebuildDash();
  }

  /** Advance every company that has state (called from the game tick + offline). */
  function advanceAll() {
    const root = state.techco;
    if (!root) return;
    for (const id of TECHCO_IDS) if (root[id]) advance(id);
  }

  /* ------------------------------ Player actions --------------------------- */

  /** Cost to develop a product at the given budget (scales off base income). */
  function buildCost(id, budget) {
    return baseIncome(id) * BUDGETS[budget].costMult;
  }

  /** Start developing a product. Returns { ok, msg }. */
  function startBuild(id, opts) {
    const c = co(id);
    const catItem = catalogFor(id).find((row) => row[0] === opts.type);
    if (!catItem) return { ok: false, msg: 'Unknown product.' };
    if (c.builds.length >= concurrentSlots(id)) return { ok: false, msg: 'All build slots busy — hire Engineering for more.' };
    if (isTypeBusy(id, opts.type)) return { ok: false, msg: `${opts.type} is already live or in development.` };
    const cost = buildCost(id, opts.budget);
    if (c.cash < cost) return { ok: false, msg: `Need ${formatMoney(cost)} in company cash.` };
    c.cash -= cost;
    const secs = QUALITIES[opts.quality].seconds * buildSpeedMult(id); // Engineering speeds builds
    c.builds.push({
      type: opts.type,
      phys: !!catItem[1],
      budget: opts.budget,
      quality: opts.quality,
      pricing: opts.pricing,
      cost,
      startMs: now(),
      endsAt: now() + secs * 1000,
    });
    saveGame();
    return { ok: true, msg: `${opts.type} entered development.` };
  }

  function isTypeBusy(id, type) {
    const c = co(id);
    return c.products.some((p) => p.type === type) || c.builds.some((b) => b.type === type);
  }

  /** Cost to update a live product (rising, scales off base income). */
  function updateCost(id, p) {
    return baseIncome(id) * (2 + p.updates);
  }
  /** Restore/boost a product's health — diminishing returns each time. */
  function updateProduct(id, pid) {
    const c = co(id);
    const p = c.products.find((x) => x.pid === pid);
    if (!p) return { ok: false, msg: 'Product not found.' };
    const cost = updateCost(id, p);
    if (c.cash < cost) return { ok: false, msg: `Need ${formatMoney(cost)} to update.` };
    const restore = 55 * Math.pow(0.8, p.updates); // diminishing returns
    c.cash -= cost;
    p.updates++;
    p.health = clamp(p.health + restore, 0, CFG.HEALTH_MAX);
    if (p.rating < 5 && RNG() < 0.35) p.rating++; // occasional rating bump
    c.satisfaction = clamp(c.satisfaction + 1, 0, 100);
    saveGame();
    return { ok: true, msg: `${p.type} updated (+${Math.round(restore)} health).` };
  }

  /* -------------------------------- Tick hooks ----------------------------- */

  function tick() {
    advanceAll();
    if (dash) patchDash();
  }
  function applyOffline() { advanceAll(); }

  /* --------------------------------- Toasts -------------------------------- */

  let toastWrap = null;
  function toast(html) {
    if (typeof document === 'undefined') return;
    if (!toastWrap) {
      toastWrap = document.createElement('div');
      toastWrap.className = 'tc-toast-wrap';
      document.body.appendChild(toastWrap);
    }
    const el = document.createElement('div');
    el.className = 'tc-toast';
    el.innerHTML = html;
    toastWrap.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    const kill = () => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); };
    el.addEventListener('click', kill);
    setTimeout(kill, 6000);
  }

  /* ==================================================================== *
   *  DASHBOARD UI
   * ==================================================================== */

  let dash = null; // { id, el, tab, launch }  — null when closed

  const companyName = (id) => (ASSET_BY_ID[id] ? ASSET_BY_ID[id].name : id);
  const TABS = [
    { id: 'products', label: 'Products' },
    { id: 'staff',    label: 'Staff' },
    { id: 'rnd',      label: 'Research' },
    { id: 'market',   label: 'Market' },
    { id: 'more',     label: 'More' },
  ];

  function open(id) {
    if (!isManaged(id)) return;
    if (typeof Market !== 'undefined' && Market.isOwned && !Market.isOwned(id)) return;
    ensureCompany(id);
    advance(id);
    lock(true);
    const el = document.createElement('div');
    el.className = 'tc-screen';
    document.body.appendChild(el);
    dash = { id, el, tab: 'products', launch: null };
    rebuildDash();
  }
  function close() {
    if (!dash) return;
    dash.el.remove();
    dash = null;
    lock(false);
  }
  function lock(on) { try { document.body.style.overflow = on ? 'hidden' : ''; } catch (e) {} }

  const starStr = (n) => '★★★★★☆☆☆☆☆'.slice(5 - n, 10 - n);
  const healthClass = (h) => (h > 60 ? 'good' : h > 30 ? 'warn' : 'bad');

  /** Full rebuild of the dashboard body (used on tab switch / state changes). */
  function rebuildDash() {
    if (!dash) return;
    const id = dash.id, d = def(id), s = snapshot(id);
    dash.el.innerHTML = `
      <div class="tc-head">
        <button class="icon-btn" id="tcClose" aria-label="Close">✕</button>
        <div class="tc-id">
          <div class="tc-co-name">${companyName(id)}</div>
          <div class="tc-co-sector">${d.label} · <span class="muted">${d.tagline}</span></div>
        </div>
      </div>

      <div class="tc-headline">
        ${headStat('Company Value', formatMoney(s.value))}
        ${headStat('Net Profit / day', formatMoney(s.netProfitDay), s.netProfitDay >= 0 ? 'up' : 'down')}
        ${headStat('Cash', formatMoney(s.cash))}
        ${headStat('Market Share', s.share.toFixed(1) + '%')}
      </div>

      <details class="tc-details">
        <summary>More stats</summary>
        <div class="tc-detail-grid">
          ${detStat('Revenue / day', formatMoney(s.revenueDay))}
          ${detStat('Payroll / day', formatMoney(s.payrollDay))}
          ${detStat('Employees', formatNumber(s.employees, 0))}
          ${detStat('Active Products', s.activeProducts + ' · ' + s.slotsUsed + '/' + s.slots + ' slots')}
          ${detStat('Brand Reputation', Math.round(s.reputation) + '/100')}
          ${detStat('Customer Satisfaction', Math.round(s.satisfaction) + '/100')}
        </div>
      </details>

      <div class="tc-tabs">${TABS.map((t) =>
        `<button class="tc-tab ${dash.tab === t.id ? 'on' : ''}" data-tctab="${t.id}">${t.label}</button>`).join('')}</div>

      <div class="tc-body" id="tcBody">${tabHTML(id)}</div>
    `;
    wireDash();
  }

  function headStat(label, value, cls = '') {
    return `<div class="tc-hstat"><span>${label}</span><b class="${cls}" data-h="${label}">${value}</b></div>`;
  }
  function detStat(label, value) {
    return `<div class="tc-dstat"><span>${label}</span><b data-d="${label}">${value}</b></div>`;
  }

  function tabHTML(id) {
    if (dash.launch) return launchHTML(id);
    switch (dash.tab) {
      case 'products': return productsHTML(id);
      case 'staff':    return staffHTML(id);
      case 'rnd':      return researchHTML(id);
      case 'market':   return placeholderHTML('Market', '🏆', `Track ${def(id).rivals.length} rivals (${def(id).rivals.join(', ')}), fight for market share and become #1 — coming soon.`);
      case 'more':     return placeholderHTML('More', '🌍', 'Manufacturing, financial strategy, global expansion, rival acquisitions and events — coming soon.');
      default: return '';
    }
  }

  function placeholderHTML(title, emoji, desc) {
    return `<div class="tc-placeholder"><div class="tc-ph-emoji">${emoji}</div>
      <div class="tc-ph-title">${title}</div><p>${desc}</p></div>`;
  }

  /* ------------------------------ Products tab ----------------------------- */

  function productsHTML(id) {
    const c = co(id);
    const slots = concurrentSlots(id), full = c.builds.length >= slots;
    const builds = c.builds.map((b) => buildRowHTML(id, b)).join('');
    const prods = c.products.length
      ? c.products.slice().sort((a, b) => productIncome(id, b) - productIncome(id, a)).map((p) => productRowHTML(id, p)).join('')
      : `<div class="tc-empty">No products yet. Develop your first one to start earning.</div>`;
    return `
      <button class="btn btn-gold btn-wide tc-new" data-tcact="newproduct" ${full ? 'disabled' : ''}>
        ${full ? 'All build slots busy — hire Engineering' : '＋ Develop New Product'}</button>
      <div class="tc-slot-note">Build slots: <b>${c.builds.length}/${slots}</b> · more from Engineering staff</div>
      ${builds ? `<div class="tc-section-label">In Development</div><div class="tc-build-list">${builds}</div>` : ''}
      <div class="tc-section-label">Product Portfolio</div>
      <div class="tc-prod-list">${prods}</div>
    `;
  }

  /* -------------------------------- Staff tab ------------------------------ */

  function staffHTML(id) {
    const c = co(id);
    const s = snapshot(id);
    const card = (g) => {
      const st = c.staff[g], hc = hireCost(id, g), tc = trainCost(id, g);
      const maxed = st.training >= STAFF_CFG.TRAIN_MAX;
      return `
        <div class="tc-staff">
          <div class="tc-staff-head"><b>${STAFF[g].label}</b><span class="muted">${STAFF[g].blurb}</span></div>
          <div class="tc-staff-stats">
            <div><span>Teams</span><b>${st.count}</b></div>
            <div><span>Training</span><b>${'●'.repeat(st.training)}${'○'.repeat(STAFF_CFG.TRAIN_MAX - st.training)}</b></div>
          </div>
          <div class="tc-staff-btns">
            <button class="btn tc-mini" data-tcact="hire" data-group="${g}">Hire · ${formatMoney(hc)}</button>
            <button class="btn tc-mini" data-tcact="train" data-group="${g}" ${maxed ? 'disabled' : ''}>${maxed ? 'Fully trained' : 'Train · ' + formatMoney(tc)}</button>
          </div>
        </div>`;
    };
    return `
      <div class="tc-staff-summary">
        <div><span>Payroll / day</span><b class="down">${formatMoney(s.payrollDay)}</b></div>
        <div><span>Build slots</span><b>${s.slots}</b></div>
        <div><span>Net profit / day</span><b class="${s.netProfitDay >= 0 ? 'up' : 'down'}">${formatMoney(s.netProfitDay)}</b></div>
      </div>
      <p class="tc-hint">Hiring adds ongoing payroll; Training is a one-off boost with no payroll. Keep net profit positive — overspending burns company cash.</p>
      ${['eng', 'mkt', 'ops'].map(card).join('')}
    `;
  }

  /* ------------------------------ Research tab ----------------------------- */

  function researchHTML(id) {
    const c = co(id);
    const rows = RESEARCH_TIERS.map((t, i) => {
      const done = researchDone(id, i);
      const active = c.research.active && c.research.active.tier === i;
      const avail = researchAvailable(id, i) && !c.research.active;
      const name = researchName(id, i);
      let right;
      if (done) right = `<span class="tc-r-done">✓ Done</span>`;
      else if (active) {
        const a = c.research.active, total = a.endsAt - a.startMs;
        const pct = clamp(((now() - a.startMs) / total) * 100, 0, 100);
        const left = Math.max(0, Math.ceil((a.endsAt - now()) / 1000));
        right = `<div class="tc-r-active"><div class="tc-progress"><div class="tc-progress-fill" style="width:${pct}%"></div></div>
          <span class="muted" data-rleft>${left > 0 ? formatDuration(left) + ' left' : 'Finishing…'}</span></div>`;
      } else if (avail) {
        right = `<button class="btn tc-mini" data-tcact="research" data-tier="${i}">Research · ${formatMoney(researchCost(id, i))}</button>`;
      } else {
        right = `<span class="tc-r-lock">🔒 Locked</span>`;
      }
      return `
        <div class="tc-research ${done ? 'is-done' : ''} ${active ? 'is-active' : ''}">
          <div class="tc-research-main">
            <div class="tc-research-name">${name}</div>
            <div class="tc-research-eff">${effectText(t.effect)}${avail ? ` · ${Math.round(researchSuccess(id, i) * 100)}% success · ${formatDuration(RESEARCH_TIERS[i].seconds)}` : ''}</div>
          </div>
          <div class="tc-research-right">${right}</div>
        </div>`;
    }).join('');
    return `
      <p class="tc-hint">Research unlocks along a path — finish one project to reach the next. Each has a success chance (Engineering staff improves it); a failure refunds 60%.</p>
      <div class="tc-research-list">${rows}</div>
    `;
  }

  function buildRowHTML(id, b) {
    const total = b.endsAt - b.startMs;
    const pct = clamp(((now() - b.startMs) / total) * 100, 0, 100);
    const left = Math.max(0, Math.ceil((b.endsAt - now()) / 1000));
    return `
      <div class="tc-build" data-build="${b.type}">
        <div class="tc-build-top"><b>${b.type}</b><span class="muted">${BUDGETS[b.budget].label} · ${QUALITIES[b.quality].label} · ${PRICINGS[b.pricing].label}</span></div>
        <div class="tc-progress"><div class="tc-progress-fill" style="width:${pct}%"></div></div>
        <div class="tc-build-left"><span data-buildleft="${b.type}">${left > 0 ? formatDuration(left) + ' left' : 'Finishing…'}</span></div>
      </div>`;
  }

  function productRowHTML(id, p) {
    const inc = productIncome(id, p);
    const shr = productShare(id, p);
    const h = clamp(p.health, 0, 100);
    return `
      <div class="tc-prod" data-pid="${p.pid}">
        <div class="tc-prod-main">
          <div class="tc-prod-name">${p.type}${p.phys ? ' <span class="tc-tag">physical</span>' : ''}</div>
          <div class="tc-prod-sub">${starStr(p.rating)} · ${PRICINGS[p.pricing].label} · ${shr.toFixed(1)}% share</div>
          <div class="tc-health"><div class="tc-health-fill ${healthClass(h)}" style="width:${h}%"></div></div>
        </div>
        <div class="tc-prod-right">
          <div class="tc-prod-inc">${formatMoney(inc)}<small>/day</small></div>
          <button class="btn tc-update" data-tcact="update" data-pid="${p.pid}">Update</button>
        </div>
      </div>`;
  }

  /* ----------------------------- Launch flow ------------------------------- */

  function defaultLaunch(id) {
    const cat = catalogFor(id);
    const firstFree = cat.find((row) => !isTypeBusy(id, row[0]));
    return { type: firstFree ? firstFree[0] : cat[0][0], budget: 'standard', quality: 'standard', pricing: 'balanced' };
  }

  function oddsWord(l) {
    const score = BUDGETS[l.budget].score + QUALITIES[l.quality].score; // 0..4
    return ['Long shot', 'Modest odds', 'Fair odds', 'Good odds', 'Great odds'][score];
  }

  function launchHTML(id) {
    const d = def(id), l = dash.launch, c = co(id);
    const cost = buildCost(id, l.budget);
    const secs = QUALITIES[l.quality].seconds;
    const projInc = baseIncome(id) * 0.09 * PRICINGS[l.pricing].incomeFactor * researchMult(id); // "Solid"-tier preview
    const afford = c.cash >= cost;
    const chip = (act, key, cur, map) => Object.keys(map).map((k) =>
      `<button class="tc-chip ${cur === k ? 'on' : ''}" data-tcset="${act}" data-val="${k}">${map[k].label}</button>`).join('');
    const catalogBtns = catalogFor(id).map(([name, phys]) => {
      const busy = isTypeBusy(id, name);
      const unlocked = c.unlocked.some((r) => r[0] === name);
      return `<button class="tc-type ${l.type === name ? 'on' : ''}" data-tctype="${name}" ${busy ? 'disabled' : ''}>
        ${name}${phys ? ' <span class="tc-tag">physical</span>' : ''}${unlocked ? ' <span class="tc-tag gold">flagship</span>' : ''}${busy ? ' <span class="muted">· live</span>' : ''}</button>`;
    }).join('');
    return `
      <div class="tc-launch">
        <div class="tc-launch-head">
          <button class="icon-btn" data-tcact="cancelnew" aria-label="Back">‹</button>
          <b>Develop a Product</b>
        </div>

        <div class="tc-field-label">Product — from ${companyName(id)}'s catalog</div>
        <div class="tc-type-grid">${catalogBtns}</div>

        <div class="tc-field-label">Budget <span class="muted">${BUDGETS[l.budget].note}</span></div>
        <div class="tc-chip-row">${chip('budget', 'budget', l.budget, BUDGETS)}</div>

        <div class="tc-field-label">Quality <span class="muted">${QUALITIES[l.quality].note}</span></div>
        <div class="tc-chip-row">${chip('quality', 'quality', l.quality, QUALITIES)}</div>

        <div class="tc-field-label">Pricing <span class="muted">${PRICINGS[l.pricing].note}</span></div>
        <div class="tc-chip-row">${chip('pricing', 'pricing', l.pricing, PRICINGS)}</div>

        <div class="tc-preview">
          <div><span>Cost</span><b class="${afford ? 'gold' : 'down'}">${formatMoney(cost)}</b></div>
          <div><span>Build time</span><b>${formatDuration(secs)}</b></div>
          <div><span>Reception odds</span><b>${oddsWord(l)}</b></div>
          <div><span>Projected income</span><b>~${formatMoney(projInc)}/day</b></div>
        </div>

        <button class="btn btn-gold btn-wide" data-tcact="startbuild" ${afford ? '' : 'disabled'}>
          ${afford ? 'Start Development' : 'Not enough company cash'}</button>
      </div>`;
  }

  /* ------------------------------- Wiring ---------------------------------- */

  function wireDash() {
    const el = dash.el;
    el.querySelector('#tcClose').onclick = close;
    el.querySelectorAll('[data-tctab]').forEach((b) => b.onclick = () => {
      if (dash.launch) dash.launch = null;
      dash.tab = b.dataset.tctab; rebuildDash();
    });
    const body = el.querySelector('#tcBody');
    if (!body) return;

    body.querySelectorAll('[data-tcact]').forEach((b) => b.onclick = () => onAct(b.dataset.tcact, b.dataset));
    body.querySelectorAll('[data-tctype]').forEach((b) => b.onclick = () => {
      if (b.disabled) return; dash.launch.type = b.dataset.tctype; refreshBody();
    });
    body.querySelectorAll('[data-tcset]').forEach((b) => b.onclick = () => {
      dash.launch[b.dataset.tcset] = b.dataset.val; refreshBody();
    });
  }

  function refreshBody() {
    const body = dash.el.querySelector('#tcBody');
    if (body) { body.innerHTML = tabHTML(dash.id); wireDash(); }
  }

  function onAct(act, data) {
    const id = dash.id;
    if (act === 'newproduct') { dash.launch = defaultLaunch(id); refreshBody(); return; }
    if (act === 'cancelnew')  { dash.launch = null; refreshBody(); return; }
    if (act === 'startbuild') {
      const r = startBuild(id, dash.launch);
      if (r.ok) { dash.launch = null; rebuildDash(); }
      else toast(`⚠️ ${r.msg}`);
      return;
    }
    if (act === 'update') {
      const r = updateProduct(id, Number(data.pid));
      if (!r.ok) toast(`⚠️ ${r.msg}`);
      else rebuildDash();
      return;
    }
    if (act === 'hire')     { const r = hire(id, data.group);  if (!r.ok) toast(`⚠️ ${r.msg}`); return; }
    if (act === 'train')    { const r = train(id, data.group); if (!r.ok) toast(`⚠️ ${r.msg}`); return; }
    if (act === 'research') { const r = startResearch(id, Number(data.tier)); if (r.ok) rebuildDash(); else toast(`⚠️ ${r.msg}`); return; }
  }

  /* --------------------------- Live patch (per tick) ----------------------- */

  function patchDash() {
    if (!dash) return;
    const id = dash.id, s = snapshot(id);
    const set = (sel, val, cls) => {
      const e = dash.el.querySelector(sel);
      if (e) { e.textContent = val; if (cls !== undefined) e.className = cls; }
    };
    set('[data-h="Company Value"]', formatMoney(s.value));
    set('[data-h="Net Profit / day"]', formatMoney(s.netProfitDay), s.netProfitDay >= 0 ? 'up' : 'down');
    set('[data-h="Cash"]', formatMoney(s.cash));
    set('[data-h="Market Share"]', s.share.toFixed(1) + '%');
    set('[data-d="Revenue / day"]', formatMoney(s.revenueDay));
    set('[data-d="Payroll / day"]', formatMoney(s.payrollDay));
    set('[data-d="Active Products"]', s.activeProducts + ' · ' + s.slotsUsed + '/' + s.slots + ' slots');
    set('[data-d="Brand Reputation"]', Math.round(s.reputation) + '/100');
    set('[data-d="Customer Satisfaction"]', Math.round(s.satisfaction) + '/100');

    // Live research progress bar + countdown (Research tab).
    if (dash.tab === 'rnd' && !dash.launch) {
      const a = co(id).research.active;
      if (a) {
        const total = a.endsAt - a.startMs;
        const pct = clamp(((now() - a.startMs) / total) * 100, 0, 100);
        const fill = dash.el.querySelector('.tc-research.is-active .tc-progress-fill');
        if (fill) fill.style.width = pct + '%';
        const left = Math.max(0, Math.ceil((a.endsAt - now()) / 1000));
        const lt = dash.el.querySelector('[data-rleft]');
        if (lt) lt.textContent = left > 0 ? formatDuration(left) + ' left' : 'Finishing…';
      }
    }

    // Live build progress bars + countdown (only while on the Products tab).
    if (dash.tab === 'products' && !dash.launch) {
      const c = co(id);
      for (const b of c.builds) {
        // Product types contain no quotes, so a quoted attribute selector is safe.
        const row = dash.el.querySelector(`.tc-build[data-build="${b.type}"]`);
        const total = b.endsAt - b.startMs;
        const pct = clamp(((now() - b.startMs) / total) * 100, 0, 100);
        const fill = row && row.querySelector('.tc-progress-fill');
        if (fill) fill.style.width = pct + '%';
        const left = Math.max(0, Math.ceil((b.endsAt - now()) / 1000));
        const lt = dash.el.querySelector(`[data-buildleft="${b.type}"]`);
        if (lt) lt.textContent = left > 0 ? formatDuration(left) + ' left' : 'Finishing…';
      }
    }
  }

  /* ------------------------------- Exports --------------------------------- */

  /** Total valuation of every company under management — feeds net worth. */
  function empireValue() {
    const root = state.techco;
    if (!root) return 0;
    let v = 0;
    for (const id of TECHCO_IDS) if (root[id]) v += snapshot(id).value;
    return v;
  }
  function managedCount() {
    const root = state.techco;
    if (!root) return 0;
    return TECHCO_IDS.filter((id) => root[id]).length;
  }

  return {
    isManaged, open, close, tick, applyOffline, empireValue, managedCount,
    // Engine/economy (also used by tests):
    baseIncome, snapshot, revenuePerDay, netProfitPerDay, marketShare,
    startBuild, updateProduct, buildCost, updateCost, productIncome, productShare,
    rollReception, advance, ensureCompany, valuationTarget,
    // Phase 2 — staff, research, valuation:
    hire, train, hireCost, trainCost, payrollPerDay, opexRate, groupEff,
    concurrentSlots, buildSpeedMult, shareMult, staffReceptionBonus,
    startResearch, researchCost, researchSuccess, researchAvailable, researchDone,
    researchMult, catalogFor,
    // Config/data access for tests + future phases:
    CFG, BUDGETS, QUALITIES, PRICINGS, RECEPTIONS, STAFF, STAFF_CFG, RESEARCH_TIERS,
    _state: (id) => co(id),
  };
})();
