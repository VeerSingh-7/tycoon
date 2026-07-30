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
    eng: { label: 'Engineering',          blurb: 'Build speed · quality · research' },
    mkt: { label: 'Marketing & Sales',    blurb: 'Market share · product reception' },
    ops: { label: 'Operations & Support', blurb: 'Customer satisfaction · cost efficiency' },
  };
  const STAFF_SEED = { eng: 5, mkt: 4, ops: 4 };
  const STAFF_CFG = {
    HIRE_BASE: 3, HIRE_GROWTH: 0.5,   // hire = baseIncome × 3 × (1 + count×0.5)
    PAYROLL_PER_HEAD: 0.02,           // × baseIncome per head, per in-game day
    TRAIN_BASE: 8, TRAIN_MAX: 5,      // train = baseIncome × 8 × (1 + level)
  };

  // Research categories/levels/mass are defined per company in data/research.js.
  // A short one-line description of a research effect object (see research.js).
  function effectText(e) {
    if (!e) return '';
    const parts = [];
    if (e.u) parts.push('Unlocks ' + e.u[0]);
    if (e.inc) parts.push('+' + Math.round(e.inc * 100) + '% income');
    if (e.pr) parts.push('+' + Math.round(e.pr * 100) + '% price');
    if (e.mg) parts.push('+' + Math.round(e.mg * 100) + '% margin');
    if (e.q) parts.push('+' + e.q + ' quality');
    if (e.rc) parts.push('better launches');
    if (e.ct) parts.push('-' + Math.round(e.ct * 100) + '% costs');
    return parts.join(' · ');
  }

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
    // Research meta-game state (new shape). Old {done,active} saves are reset to
    // the new structure — a full research revamp; unlocked products are kept.
    if (!c.research || !c.research.levels) {
      c.research = { budget: 'standard', sci: { jr: 0, sr: 0, lead: 0 }, centers: {}, partners: {}, levels: {}, active: [], mass: {} };
    }
    if (!c.unlocked) c.unlocked = [];          // [ [name, phys], ... ] unlocked products
    if (c.cumProfit == null) c.cumProfit = 0;  // cumulative net profit (valuation input)
    if (c.valuation == null) c.valuation = marketCap(id);
    // Phase 3 — rivals & competitive standing.
    if (!c.rivals) c.rivals = seedRivals(id);
    if (c.edge == null) c.edge = 0;            // competitive edge from Compete actions (decays)
    if (c.innovBonus == null) c.innovBonus = 0;// innovation from sprints
    if (!c.leaders) c.leaders = {};            // categories the player is #1 in (claimed)
    if (c.undercutUntil == null) c.undercutUntil = 0;
    // Phase 4 — manufacturing, financial strategy, global expansion, events.
    if (c.manufacturing == null) c.manufacturing = hasManufacturing(id) ? 'outsource' : 'none';
    if (c.strategy == null) c.strategy = 'balanced';
    if (!c.regions) c.regions = { na: true };  // home region unlocked
    if (c.acqBonus == null) c.acqBonus = 0;    // permanent income from acquisitions
    if (c.event === undefined) c.event = null; // active themed event, if any
    if (c.nextEventAt == null) c.nextEventAt = now() + EVENT_FIRST_DELAY;
    if (c.supplyUntil == null) c.supplyUntil = 0;
    // Signature (each company's unique operation): a ladder level or a doctrine
    // stance. Seeded from data/signature.js; doctrines start on the middle stance.
    if (!c.signature) {
      const s = (typeof COMPANY_SIGNATURE !== 'undefined') ? COMPANY_SIGNATURE[id] : null;
      c.signature = { level: 0, stance: (s && s.kind === 'doctrine' && s.stances[1]) ? s.stances[1].id : null };
    }
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
    const pr = PRICINGS[p.pricing] || PRICINGS.balanced;
    return baseIncome(id) * p.incomeFrac * pr.incomeFactor * (Math.max(0, p.health) / 100)
      * researchMult(id) * manufacturingMult(id, p); // in-house lifts physical margins
  }

  /** A live product's market-share contribution (percentage points). A cheaper
   *  TIER reaches more buyers (volume), a flagship reaches fewer. */
  function productShare(id, p) {
    const pr = PRICINGS[p.pricing] || PRICINGS.balanced;
    const vol = (TECH_TIERS[p.tier] || TECH_TIERS.standard).volume || 1;
    return p.shareBase * pr.shareFactor * vol * (Math.max(0, p.health) / 100);
  }

  /* ================= Product Studio (in-depth product design) ============== */
  // A product's quality (0–100) comes from its SPECIFICATIONS, BUDGET across
  // design/eng/manufacturing/QA/marketing, and the TEAM you assign — backed by
  // the company's staff. Quality drives reception, income, price and unit sales.

  const ROLE_WEIGHT = { pm: 0.5, lead: 1.0, design: 0.8, swe: 0.9, hwe: 0.9, qa: 0.7, mkt: 0.6 };
  const RECEPTION_INCOME_MULT = { flop: 0.5, modest: 0.8, solid: 1.0, hit: 1.25, breakout: 1.6 };
  const NAME_WORDS = ['Nova', 'Vertex', 'Pulse', 'Aura', 'Zenith', 'Orbit', 'Flux', 'Apex', 'Halo', 'Prism', 'Nimbus', 'Vector', 'Echo', 'Lumina'];
  const NAME_SUFFIX = ['One', 'X', 'Pro', 'Air', 'Max', 'Ultra', 'Go', 'Plus'];

  const archetypeOf = (type) => TECH_ARCHETYPES[TECH_PRODUCT_ARCHETYPE[type]] || TECH_ARCHETYPES.generic;
  const specIndex = (cfg, specId) => (Number.isInteger(cfg.specs[specId]) ? cfg.specs[specId] : 1); // default mid

  function suggestName(id, type) {
    const h = hash(id + type + Math.floor(now() / 1000));
    return `${NAME_WORDS[h % NAME_WORDS.length]} ${NAME_SUFFIX[(h >> 4) % NAME_SUFFIX.length]}`;
  }
  function studioDefault(id, type) {
    const budget = {}; TECH_BUDGET_AREAS.forEach((a) => { budget[a.id] = 'standard'; });
    const team = {}; TECH_ROLES.forEach((r) => { team[r.id] = 'none'; });
    return { type, name: suggestName(id, type), tier: 'standard', specs: {}, budget, team };
  }
  const cloneCfg = (cfg) => ({ type: cfg.type, name: cfg.name, tier: cfg.tier, specs: Object.assign({}, cfg.specs), budget: Object.assign({}, cfg.budget), team: Object.assign({}, cfg.team) });

  /** Quality 0–100 plus the sub-scores, from specs + budget + team. */
  function computeQuality(id, cfg) {
    const arch = archetypeOf(cfg.type);
    let sp = 0, spMax = 0;
    for (const spec of arch.specs) { sp += spec[2][specIndex(cfg, spec[0])][1]; spMax += Math.max.apply(null, spec[2].map((o) => o[1])); }
    const specScore = spMax ? sp / spMax : 0.5;
    let bud = 0;
    for (const a of TECH_BUDGET_AREAS) bud += (TECH_BUDGET_LEVELS[cfg.budget[a.id]] || TECH_BUDGET_LEVELS.standard).v;
    bud /= TECH_BUDGET_AREAS.length;
    let tw = 0, twMax = 0;
    for (const role of TECH_ROLES) {
      let w = ROLE_WEIGHT[role.id];
      if (role.id === 'hwe') w *= arch.focus === 'hardware' ? 1.6 : 0.3;
      if (role.id === 'swe') w *= arch.focus === 'hardware' ? 0.5 : 1.5;
      const lvl = TECH_TEAM_LEVELS[cfg.team[role.id]] || TECH_TEAM_LEVELS.none;
      const backing = clamp(0.45 + groupEff(id, role.pool) * 0.05, 0.45, 1.3); // staff back the team
      tw += lvl.v * w * backing; twMax += w;
    }
    const teamScore = twMax ? clamp(tw / twMax, 0, 1.15) : 0;
    // Research breakthroughs add a flat quality bonus on top.
    const quality = clamp(100 * (0.45 * specScore + 0.25 * bud + 0.30 * teamScore) + researchQualityBonus(id) + sigQualityBonus(id), 3, 100);
    return { quality, specScore, budgetScore: bud, teamScore };
  }

  function deepBuildCost(id, cfg) {
    const arch = archetypeOf(cfg.type), tier = TECH_TIERS[cfg.tier] || TECH_TIERS.standard;
    let c = tier.costMult;
    for (const a of TECH_BUDGET_AREAS) c += (TECH_BUDGET_LEVELS[cfg.budget[a.id]] || TECH_BUDGET_LEVELS.standard).cost * 1.2;
    for (const role of TECH_ROLES) c += (TECH_TEAM_LEVELS[cfg.team[role.id]] || TECH_TEAM_LEVELS.none).cost * 0.8;
    for (const spec of arch.specs) c += spec[2][specIndex(cfg, spec[0])][2] * 0.4;
    return baseIncome(id) * c;
  }
  function deepBuildTime(id, cfg) {
    const tier = TECH_TIERS[cfg.tier] || TECH_TIERS.standard;
    const base = 140 + tier.costMult * 6;
    const pm = (TECH_TEAM_LEVELS[cfg.team.pm] || TECH_TEAM_LEVELS.none).v; // PM speeds delivery
    return Math.max(45, Math.round(base * clamp(buildSpeedMult(id) * (1 - pm * 0.15), 0.4, 1)));
  }
  const tierToPricing = (tier) => ((tier === 'economy' || tier === 'budget') ? 'budget' : tier === 'standard' ? 'balanced' : 'premium');

  function unitPriceOf(id, p) {
    const arch = archetypeOf(p.type), tier = TECH_TIERS[p.tier] || TECH_TIERS.standard;
    // Research (e.g. higher-density batteries) lets products command more.
    return arch.basePrice * tier.priceMult * (0.8 + 0.4 * (p.specScore != null ? p.specScore : 0.5)) * researchPriceMult(id) * sigPriceMult(id);
  }
  function productMargin(id, p) {
    const arch = archetypeOf(p.type);
    // Archetypes may set an explicit margin (pharma/luxury high, retail/auto low);
    // otherwise fall back to a focus-based default.
    let m = arch.margin != null ? arch.margin
      : (arch.focus === 'software' || arch.focus === 'ai' || arch.focus === 'social') ? 0.6 : 0.3;
    if (p.phys && co(id).manufacturing === 'inhouse') m += 0.06;
    const tierDef = TECH_TIERS[p.tier] || TECH_TIERS.standard;
    m += (tierDef.incomeMult - 1) * 0.3 + (tierDef.margin || 0) + researchMarginBonus(id) + sigMarginBonus(id);
    return clamp(m, 0.15, 0.85);
  }
  function unitsPerDay(id, p) { const up = unitPriceOf(id, p); return up > 0 ? productIncome(id, p) / up : 0; }

  function scoreToReception(score) {
    if (score < 1.2) return 'flop';
    if (score < 2.4) return 'modest';
    if (score < 3.6) return 'solid';
    if (score < 4.7) return 'hit';
    return 'breakout';
  }

  function makeDeepProduct(id, b, reception, cq) {
    const c = co(id), r = RECEPTIONS[reception], tier = b.cfg.tier;
    const hmax = clamp(85 + cq.quality * 0.3, 85, 118);
    const p = {
      pid: c.nextPid++, type: b.type, phys: b.phys, deep: true,
      name: b.name || b.type, tier,
      specs: Object.assign({}, b.cfg.specs), team: Object.assign({}, b.cfg.team), budget: Object.assign({}, b.cfg.budget),
      quality: Math.round(cq.quality), specScore: cq.specScore,
      pricing: tierToPricing(tier), shareBase: r.share,
      reception, rating: r.rating,
      incomeFrac: (0.02 + cq.quality / 100 * 0.24) * RECEPTION_INCOME_MULT[reception],
      health: hmax, healthMax: hmax, updates: 0, launchedAt: now(),
      unitPrice: 0, unitsSold: 0, revenue: 0, profit: 0,
    };
    p.unitPrice = unitPriceOf(id, p);
    return p;
  }

  /** Start a deep (Studio-designed) product build. */
  function startDeepBuild(id, cfg) {
    const c = co(id);
    const catItem = catalogFor(id).find((row) => row[0] === cfg.type);
    if (!catItem) return { ok: false, msg: 'Unknown product.' };
    if (isTypeBusy(id, cfg.type)) return { ok: false, msg: `${cfg.type} is already live or in development.` };
    if (!cfg.name || !cfg.name.trim()) cfg.name = cfg.type;
    const cost = deepBuildCost(id, cfg);
    if (c.cash < cost) return { ok: false, msg: `Need ${formatMoney(cost)} in company cash.` };
    c.cash -= cost;
    const secs = deepBuildTime(id, cfg);
    c.builds.push({ type: cfg.type, phys: !!catItem[1], deep: true, cfg: cloneCfg(cfg), name: cfg.name.trim(), cost, startMs: now(), endsAt: now() + secs * 1000 });
    saveGame();
    return { ok: true, msg: `${cfg.name} entered development.` };
  }

  /* ------------------------- Phase 2: Staff effects ------------------------ */

  // Effective strength of a group = headcount scaled by training (no payroll add).
  function groupEff(id, g) { const s = co(id).staff[g]; return s.count * (1 + 0.35 * s.training); }

  function buildSpeedMult(id) { return clamp(1 - groupEff(id, 'eng') * 0.02, 0.4, 1); }     // faster builds
  function shareMult(id) { return clamp(1 + groupEff(id, 'mkt') * 0.02, 1, 2.2); }
  function satTarget(id) { return clamp(50 + groupEff(id, 'ops') * 2 - strategySatPenalty(id), 0, 100); }
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

  /* ================= Research meta-game (categories, scientists) =========== */
  // Each company has a research tree (data/research.js) of categories with 5
  // levels; each level is a breakthrough with an effect. Effects aggregate into
  // income / price / margin / quality / reception / cost bonuses and product
  // UNLOCKS. Research is driven by a budget + scientists + centres + partners.

  const treeOf = (id) => researchTreeFor(id, (ASSET_BY_ID[id] || {}).sector);
  const rstate = (id) => co(id).research;

  /** Sum every effect the company has earned (levels + mass + partners). */
  function researchAgg(id) {
    const c = rstate(id), tree = treeOf(id);
    const a = { inc: 0, pr: 0, mg: 0, q: 0, rc: 0, ct: 0 };
    const add = (e) => { if (!e) return; a.inc += e.inc || 0; a.pr += e.pr || 0; a.mg += e.mg || 0; a.q += e.q || 0; a.rc += e.rc || 0; a.ct += e.ct || 0; };
    for (const cat of tree.categories) {
      const lvl = (c.levels && c.levels[cat.id]) || 0;
      for (let i = 0; i < lvl && i < cat.levels.length; i++) add(cat.levels[i][2]);
    }
    for (const m of (tree.mass || [])) if (c.mass && c.mass[m.id] === 'done') add(m.effect);
    for (const p of RESEARCH_PARTNERS) if (c.partners && c.partners[p.id]) { if (p.bonus.q) a.q += p.bonus.q; if (p.bonus.ct) a.ct += p.bonus.ct; }
    return a;
  }
  const researchMult = (id) => 1 + researchAgg(id).inc;               // company income ×
  const researchReceptionBonus = (id) => researchAgg(id).rc;          // launch reception +
  const researchCostCut = (id) => researchAgg(id).ct;                 // operating-cost cut +
  const researchQualityBonus = (id) => researchAgg(id).q;             // product quality +
  const researchPriceMult = (id) => 1 + researchAgg(id).pr;           // unit price ×
  const researchMarginBonus = (id) => researchAgg(id).mg;             // product margin +

  /* ============= Signature (each company's unique operation) =============== */
  // Every company has a bespoke signature (data/signature.js): an always-on
  // TRAIT plus either a 5-step LADDER program or a 3-way DOCTRINE dial. Their
  // effects aggregate here and fold into the same economy levers as research.
  const sigDef = (id) => (typeof COMPANY_SIGNATURE !== 'undefined' ? COMPANY_SIGNATURE[id] : null);
  const LADDER_COSTS = [10, 20, 34, 52, 78]; // × base income, per step (escalating)
  const sigState = (id) => co(id).signature;
  const sigStance = (id) => { // resolve the currently-selected doctrine stance object
    const s = sigDef(id); if (!s || s.kind !== 'doctrine') return null;
    return s.stances.find((x) => x.id === sigState(id).stance) || s.stances[1];
  };

  /** Sum every signature effect the company currently has (trait + program). */
  function sigAgg(id) {
    const a = { inc: 0, mg: 0, pr: 0, ct: 0, share: 0, q: 0 };
    const s = sigDef(id); if (!s) return a;
    const st = sigState(id);
    const add = (e) => { if (!e) return; a.inc += e.inc || 0; a.mg += e.mg || 0; a.pr += e.pr || 0; a.ct += e.ct || 0; a.share += e.share || 0; a.q += e.q || 0; };
    add(s.trait && s.trait.effect);
    if (s.kind === 'ladder') { const lvl = st.level || 0; for (let i = 0; i < lvl && i < s.steps.length; i++) add(s.steps[i][2]); }
    else if (s.kind === 'doctrine') { add((sigStance(id) || {}).effect); }
    return a;
  }
  const sigIncomeMult = (id) => 1 + sigAgg(id).inc;    // company income ×
  const sigCostCut = (id) => sigAgg(id).ct;            // operating-cost cut +
  const sigMarginBonus = (id) => sigAgg(id).mg;        // product margin +
  const sigPriceMult = (id) => 1 + sigAgg(id).pr;      // unit price ×
  const sigQualityBonus = (id) => sigAgg(id).q;        // product quality +
  const sigShareMult = (id) => 1 + sigAgg(id).share;   // market strength ×

  const ladderStepCost = (id, i) => baseIncome(id) * (LADDER_COSTS[i] != null ? LADDER_COSTS[i] : 90);

  /** Buy the next milestone of a ladder-type signature program. */
  function sigAdvanceLadder(id) {
    const s = sigDef(id), c = co(id); if (!s || s.kind !== 'ladder') return { ok: false, msg: 'No program.' };
    const st = sigState(id), lvl = st.level || 0;
    if (lvl >= s.steps.length) return { ok: false, msg: 'Program already complete.' };
    const cost = ladderStepCost(id, lvl);
    if (c.cash < cost) return { ok: false, msg: `Need ${formatMoney(cost)} in company cash.` };
    c.cash -= cost; st.level = lvl + 1; saveGame();
    if (dash && dash.id === id) rebuildDash();
    return { ok: true, msg: `${s.steps[lvl][0]} completed.` };
  }
  /** Select a doctrine stance. */
  function sigSetStance(id, stanceId) {
    const s = sigDef(id); if (!s || s.kind !== 'doctrine') return { ok: false, msg: 'No doctrine.' };
    if (!s.stances.some((x) => x.id === stanceId)) return { ok: false, msg: 'Unknown stance.' };
    sigState(id).stance = stanceId; saveGame();
    if (dash && dash.id === id) rebuildDash();
    return { ok: true, msg: 'Doctrine set.' };
  }

  /** One-line human summary of a signature effect object. */
  function sigEffectText(e) {
    if (!e) return '';
    const parts = [];
    const pc = (v) => (v > 0 ? '+' : '') + Math.round(v * 100) + '%';
    if (e.inc) parts.push(pc(e.inc) + ' income');
    if (e.mg) parts.push(pc(e.mg) + ' margin');
    if (e.pr) parts.push(pc(e.pr) + ' price');
    if (e.ct) parts.push(pc(e.ct) + ' lower costs');
    if (e.share) parts.push(pc(e.share) + ' market strength');
    if (e.q) parts.push('+' + e.q + ' quality');
    return parts.join(' · ');
  }

  // Operating-cost rate after Operations staff + research cost-cuts.
  function opexRate(id) {
    const opsCut = clamp(groupEff(id, 'ops') * 0.012, 0, 0.28);
    return clamp(CFG.OPEX - opsCut - researchCostCut(id) - sigCostCut(id) + strategyOpexDelta(id) + globalOpexAdd(id), 0.15, 0.70);
  }
  // Live catalog = base products + everything unlocked by research.
  function catalogFor(id) { return def(id).catalog.concat(co(id).unlocked); }

  /** Give a research-unlocked product type the company's spec archetype. */
  function pushUnlock(id, u) {
    const c = co(id);
    if (!u || c.unlocked.some((r) => r[0] === u[0])) return;
    c.unlocked.push(u);
    const baseType = def(id).catalog[0] && def(id).catalog[0][0];
    const archKey = baseType && (typeof TECH_PRODUCT_ARCHETYPE !== 'undefined' ? TECH_PRODUCT_ARCHETYPE[baseType] : null);
    if (archKey && typeof TECH_PRODUCT_ARCHETYPE !== 'undefined' && !TECH_PRODUCT_ARCHETYPE[u[0]]) TECH_PRODUCT_ARCHETYPE[u[0]] = archKey;
  }

  /* --------------------------- Research capacity --------------------------- */
  function researchPower(id) {
    const c = rstate(id);
    let p = (c.sci.jr || 0) * RESEARCH_SCI.jr.power + (c.sci.sr || 0) * RESEARCH_SCI.sr.power + (c.sci.lead || 0) * RESEARCH_SCI.lead.power;
    for (const ctr of RESEARCH_CENTERS) if (c.centers[ctr.id]) p += ctr.power;
    for (const pt of RESEARCH_PARTNERS) if (c.partners[pt.id] && pt.bonus.power) p += pt.bonus.power;
    return p + groupEff(id, 'eng') * 0.5;
  }
  function researchSpeed(id) {
    let s = RESEARCH_BUDGETS[rstate(id).budget || 'standard'].speed;
    for (const pt of RESEARCH_PARTNERS) if (rstate(id).partners[pt.id] && pt.bonus.speed) s += pt.bonus.speed;
    if (co(id).strategy === 'research') s += 0.2;
    return s;
  }
  const researchCapacity = (id) => clamp(1 + Math.floor(researchPower(id) / 12), 1, 8);
  function govDiscount(id) { const g = RESEARCH_PARTNERS.find((p) => p.id === 'gov'); return rstate(id).partners.gov ? (1 - g.bonus.discount) : 1; }

  // Priority of an individual project — speed vs cost.
  const PRIORITY = {
    low:    { label: 'Low',    speed: 0.7, cost: 0.8 },
    normal: { label: 'Normal', speed: 1.0, cost: 1.0 },
    high:   { label: 'High',   speed: 1.4, cost: 1.5 },
    crash:  { label: 'Crash',  speed: 2.0, cost: 2.5 },
  };
  const DEFAULT_ASSIGN = { lead: 0, jr: 0, sr: 0, priority: 'normal' };

  // Infrastructure power (centres + partners + engineering) — shared by all
  // projects; per-project ASSIGNED scientists add focused power on top.
  function infraPower(id) {
    const c = rstate(id);
    let p = 0;
    for (const ctr of RESEARCH_CENTERS) if (c.centers[ctr.id]) p += ctr.power;
    for (const pt of RESEARCH_PARTNERS) if (c.partners[pt.id] && pt.bonus.power) p += pt.bonus.power;
    return p + groupEff(id, 'eng') * 0.5;
  }
  // Scientists currently committed to running projects.
  function assignedRole(id, role) { return rstate(id).active.reduce((n, a) => n + (a[role] || 0), 0); }
  function availableSci(id, role, exclude) {
    let used = assignedRole(id, role);
    if (exclude) used -= (exclude[role] || 0);
    return Math.max(0, (rstate(id).sci[role] || 0) - used);
  }
  // Power of one project given its assigned team.
  function projPower(id, cfg) {
    cfg = cfg || DEFAULT_ASSIGN;
    return infraPower(id) + (cfg.jr || 0) * RESEARCH_SCI.jr.power + (cfg.sr || 0) * RESEARCH_SCI.sr.power + (cfg.lead || 0) * RESEARCH_SCI.lead.power * 1.5;
  }
  const priorityOf = (cfg) => PRIORITY[(cfg && cfg.priority) || 'normal'] || PRIORITY.normal;
  const projectCost = (id, toLevel, cfg) => baseIncome(id) * (8 * toLevel) * govDiscount(id) * priorityOf(cfg).cost;
  const projectDuration = (id, toLevel, cfg) => Math.max(20, Math.round((150 + toLevel * 40) / (1 + projPower(id, cfg) * 0.02) / researchSpeed(id) / priorityOf(cfg).speed));

  /** Ongoing R&D spend/day (budget + scientist salaries + centre upkeep). */
  function researchSpendPerDay(id) {
    const c = rstate(id);
    let s = RESEARCH_BUDGETS[c.budget || 'standard'].daily;
    for (const k in RESEARCH_SCI) s += (c.sci[k] || 0) * RESEARCH_SCI[k].pay;
    for (const ctr of RESEARCH_CENTERS) if (c.centers[ctr.id]) s += 0.05;
    return baseIncome(id) * s;
  }
  const totalResearchLevels = (id) => { const c = rstate(id); let n = 0; for (const k in c.levels) n += c.levels[k]; return n; };

  /* ----------------------------- Player actions ---------------------------- */
  function setBudget(id, b) { if (RESEARCH_BUDGETS[b]) { rstate(id).budget = b; saveGame(); if (dash && dash.id === id) rebuildDash(); } return { ok: true }; }

  function hireSci(id, role) {
    const c = rstate(id), r = RESEARCH_SCI[role];
    if (!r) return { ok: false, msg: 'Unknown role.' };
    const cost = baseIncome(id) * r.hire * (1 + (c.sci[role] || 0) * 0.5);
    if (co(id).cash < cost) return { ok: false, msg: `Need ${formatMoney(cost)} to hire.` };
    co(id).cash -= cost; c.sci[role] = (c.sci[role] || 0) + 1;
    saveGame(); if (dash && dash.id === id) rebuildDash();
    return { ok: true };
  }

  function buildCenter(id, cid) {
    const c = rstate(id), ctr = RESEARCH_CENTERS.find((x) => x.id === cid);
    if (!ctr) return { ok: false };
    if (c.centers[cid]) return { ok: false, msg: 'Already built.' };
    const cost = baseIncome(id) * ctr.costMult;
    if (co(id).cash < cost) return { ok: false, msg: `Need ${formatMoney(cost)}.` };
    co(id).cash -= cost; c.centers[cid] = true;
    saveGame(); if (dash && dash.id === id) rebuildDash();
    return { ok: true };
  }

  function formPartner(id, pid) {
    const c = rstate(id), pt = RESEARCH_PARTNERS.find((x) => x.id === pid);
    if (!pt) return { ok: false };
    if (c.partners[pid]) return { ok: false, msg: 'Already partnered.' };
    const cost = baseIncome(id) * pt.costMult;
    if (co(id).cash < cost) return { ok: false, msg: `Need ${formatMoney(cost)}.` };
    co(id).cash -= cost; c.partners[pid] = true;
    saveGame(); if (dash && dash.id === id) rebuildDash();
    return { ok: true };
  }

  const normAssign = (cfg) => ({
    lead: Math.max(0, Math.floor((cfg && cfg.lead) || 0)),
    jr: Math.max(0, Math.floor((cfg && cfg.jr) || 0)),
    sr: Math.max(0, Math.floor((cfg && cfg.sr) || 0)),
    priority: (cfg && PRIORITY[cfg.priority]) ? cfg.priority : 'normal',
  });
  // Clamp an assignment to the scientists actually available (excluding `exclude`).
  function clampAssign(id, a, exclude) {
    a.lead = Math.min(a.lead, availableSci(id, 'lead', exclude));
    a.jr = Math.min(a.jr, availableSci(id, 'jr', exclude));
    a.sr = Math.min(a.sr, availableSci(id, 'sr', exclude));
    return a;
  }

  /** Start researching the next level of a category (with optional team cfg). */
  function startProject(id, catId, cfg) {
    const c = rstate(id), tree = treeOf(id), cat = tree.categories.find((x) => x.id === catId);
    if (!cat) return { ok: false, msg: 'Unknown category.' };
    const cur = c.levels[catId] || 0;
    if (cur >= cat.levels.length) return { ok: false, msg: 'Fully researched.' };
    if (c.active.some((a) => a.cat === catId)) return { ok: false, msg: 'Already in progress.' };
    if (c.active.length >= researchCapacity(id)) return { ok: false, msg: 'No free research capacity — hire scientists.' };
    const a = clampAssign(id, normAssign(cfg));
    const to = cur + 1, cost = projectCost(id, to, a);
    if (co(id).cash < cost) return { ok: false, msg: `Need ${formatMoney(cost)}.` };
    co(id).cash -= cost;
    c.active.push({ cat: catId, to, startMs: now(), endsAt: now() + projectDuration(id, to, a) * 1000, lead: a.lead, jr: a.jr, sr: a.sr, priority: a.priority });
    saveGame(); if (dash && dash.id === id) rebuildDash();
    return { ok: true };
  }

  /** Re-assign the team / priority of an ACTIVE project (progress preserved). */
  function editProject(id, catId, cfg) {
    const c = rstate(id), a = c.active.find((x) => x.cat === catId);
    if (!a) return { ok: false, msg: 'Not in progress.' };
    const na = clampAssign(id, normAssign(cfg), a); // exclude this project's own team
    const frac = clamp((now() - a.startMs) / Math.max(1, a.endsAt - a.startMs), 0, 0.999);
    a.lead = na.lead; a.jr = na.jr; a.sr = na.sr; a.priority = na.priority;
    const total = projectDuration(id, a.to, a) * 1000;
    a.startMs = now() - frac * total; a.endsAt = a.startMs + total;
    saveGame(); if (dash && dash.id === id) rebuildDash();
    return { ok: true };
  }

  /** Start a mass "moonshot" project (with optional team cfg). */
  function startMass(id, massId, cfg) {
    const c = rstate(id), tree = treeOf(id), m = (tree.mass || []).find((x) => x.id === massId);
    if (!m) return { ok: false };
    if (c.mass[massId]) return { ok: false, msg: 'Already underway.' };
    const a = clampAssign(id, normAssign(cfg));
    const cost = baseIncome(id) * m.costMult * govDiscount(id) * priorityOf(a).cost;
    if (co(id).cash < cost) return { ok: false, msg: `Need ${formatMoney(cost)}.` };
    co(id).cash -= cost;
    const secs = Math.max(30, Math.round(m.secs / researchSpeed(id) / (1 + projPower(id, a) * 0.01) / priorityOf(a).speed));
    c.mass[massId] = { startMs: now(), endsAt: now() + secs * 1000, lead: a.lead, jr: a.jr, sr: a.sr, priority: a.priority };
    saveGame(); if (dash && dash.id === id) rebuildDash();
    return { ok: true };
  }

  /** Resolve finished research projects + mass projects (called from advance). */
  function resolveResearch(id) {
    const c = rstate(id), tree = treeOf(id);
    if (c.active && c.active.length) {
      const rest = [];
      for (const a of c.active) {
        if (now() >= a.endsAt) {
          c.levels[a.cat] = a.to;
          const cat = tree.categories.find((x) => x.id === a.cat);
          const eff = cat && cat.levels[a.to - 1] && cat.levels[a.to - 1][2];
          if (eff && eff.u) pushUnlock(id, eff.u);
        } else rest.push(a);
      }
      if (rest.length !== c.active.length) { c.active = rest; if (dash && dash.id === id) rebuildDash(); }
    }
    if (c.mass) {
      for (const m of (tree.mass || [])) {
        const st = c.mass[m.id];
        if (st && st !== 'done' && st.endsAt && now() >= st.endsAt) {
          c.mass[m.id] = 'done';
          if (m.effect && m.effect.u) pushUnlock(id, m.effect.u);
          if (dash && dash.id === id) rebuildDash();
        }
      }
    }
  }

  /* ===================== Phase 3: Rivals & market share ==================== */

  const RIVAL_CFG = {
    ACT_INTERVAL: 60 * 1000,  // min real ms between a rival's "acts"
    ACT_CHANCE: 0.15,         // chance a due rival acts on an advance
    MAX_EVOLVE_DAYS: 30,      // cap rival growth per advance (offline safety)
    EDGE_DECAY: 0.03,         // your competitive edge fades this much per in-game day
  };
  // Spend-to-shift-share actions (costs scale off base income).
  const COMPETE = {
    push:     { label: 'Marketing Push',    icon: '📣', costMult: 10, note: 'Lift your market share' },
    undercut: { label: 'Undercut Price',    icon: '🏷️', costMult: 8,  note: 'Steal rivals’ share (thins margin briefly)' },
    poach:    { label: 'Poach Talent',      icon: '🧲', costMult: 14, note: 'Out-hire the market leader' },
    innovate: { label: 'Innovation Sprint', icon: '⚡', costMult: 16, note: 'Out-research the field' },
  };
  // Categories the player is ranked in vs rivals; #1 in each is a long-term goal.
  const RANK_CATS = [
    { id: 'share',        label: 'Market Share' },
    { id: 'value',        label: 'Value' },
    { id: 'innovation',   label: 'Innovation' },
    { id: 'satisfaction', label: 'Satisfaction' },
    { id: 'profit',       label: 'Profit' },
  ];
  const LEADER_INCOME_BONUS = 0.03; // +3% company income per category led

  function seedRivals(id) {
    const cap = marketCap(id), base = baseIncome(id);
    return def(id).rivals.map((name) => {
      const s = hash(id + '#' + name);
      const innovation = 42 + ((s >> 3) % 48);
      return {
        name,
        strength: 6 + (s % 16),                 // competitive weight (vs your strength)
        rep: 46 + ((s >> 5) % 38),
        quality: 44 + ((s >> 8) % 46),
        satisfaction: 46 + ((s >> 11) % 40),
        innovation,
        value: cap * (0.25 + (s % 60) / 100),   // 0.25..0.85 × your market cap
        profit: base * (0.4 + innovation / 100),
        growth: 0.0015 + (innovation / 100) * 0.004, // per in-game day
        lastAct: 0,
      };
    });
  }

  // Your competitive strength = brand baseline + product share (× Marketing) + edge.
  function playerStrength(id) {
    const c = co(id);
    let s = c.baseShare;
    for (const p of c.products) s += productShare(id, p);
    return Math.max(0.5, (s * shareMult(id) + (c.edge || 0)) * sigShareMult(id));
  }
  function totalRivalStrength(id) { return co(id).rivals.reduce((n, r) => n + r.strength, 0); }

  /** Market share (%) — RELATIVE: your strength as a share of the whole field. */
  function marketShare(id) {
    const ps = playerStrength(id), tot = ps + totalRivalStrength(id);
    return clamp(tot > 0 ? (ps / tot) * 100 : 100, 0.5, 99);
  }
  // Market share directly scales income (≈1× at a "fair" share, up when you lead).
  function shareIncomeMult(id) { return clamp(0.6 + marketShare(id) / 100 * 1.5, 0.5, 2.2); }
  // Permanent income bonus for every ranking category you're #1 in.
  function leaderMult(id) { return 1 + LEADER_INCOME_BONUS * Object.keys(co(id).leaders || {}).length; }

  // Composite innovation score (research done, engineering, product ratings, sprints).
  function innovationScore(id) {
    const c = co(id);
    const doneCount = totalResearchLevels(id);
    let ratings = 0; for (const p of c.products) ratings += p.rating;
    return 40 + doneCount * 4 + groupEff(id, 'eng') * 0.5 + ratings * 1.5 + (c.innovBonus || 0);
  }

  const competeCost = (id, act) => baseIncome(id) * COMPETE[act].costMult;

  /** Spend company cash to shift market share toward you. */
  function compete(id, act) {
    const c = co(id);
    const cfg = COMPETE[act];
    if (!cfg) return { ok: false, msg: 'Unknown action.' };
    const cost = competeCost(id, act);
    if (c.cash < cost) return { ok: false, msg: `Need ${formatMoney(cost)} for ${cfg.label}.` };
    c.cash -= cost;
    const tot = totalRivalStrength(id) || 10;
    if (act === 'push') {
      c.edge = (c.edge || 0) + tot * 0.15;
    } else if (act === 'undercut') {
      c.rivals.forEach((r) => { r.strength *= 0.92; });
      c.undercutUntil = now() + 300000; // 5-min margin hit
    } else if (act === 'poach') {
      c.edge = (c.edge || 0) + tot * 0.10;
      const lead = c.rivals.slice().sort((a, b) => b.strength - a.strength)[0];
      if (lead) lead.strength *= 0.90;
    } else if (act === 'innovate') {
      c.edge = (c.edge || 0) + tot * 0.10;
      c.innovBonus = (c.innovBonus || 0) + 10;
    }
    checkLeadership(id);
    saveGame();
    if (dash && dash.id === id) rebuildDash();
    return { ok: true, msg: `${cfg.label} done — share shifting your way.` };
  }

  /* ------------------------------ Rankings -------------------------------- */

  function playerMetric(id, cat) {
    const c = co(id);
    if (cat === 'share') return marketShare(id);
    if (cat === 'value') return Math.max(c.valuation, valuationTarget(id));
    if (cat === 'innovation') return innovationScore(id);
    if (cat === 'satisfaction') return c.satisfaction;
    if (cat === 'profit') return netProfitPerDay(id);
    return 0;
  }
  function rivalMetric(id, r, cat) {
    if (cat === 'share') return (r.strength / (playerStrength(id) + totalRivalStrength(id))) * 100;
    if (cat === 'value') return r.value;
    if (cat === 'innovation') return r.innovation;
    if (cat === 'satisfaction') return r.satisfaction;
    if (cat === 'profit') return r.profit;
    return 0;
  }
  /** Player's 1-based rank in a category (1 = best). */
  function playerRank(id, cat) {
    const pv = playerMetric(id, cat);
    let rank = 1;
    for (const r of co(id).rivals) if (rivalMetric(id, r, cat) > pv) rank++;
    return rank;
  }
  /** Grant a one-time reward the first time the player reaches #1 in a category. */
  function checkLeadership(id) {
    const c = co(id);
    if (!c.leaders) c.leaders = {};
    for (const cat of RANK_CATS) {
      if (!c.leaders[cat.id] && playerRank(id, cat.id) === 1) {
        c.leaders[cat.id] = true;
        const bonus = baseIncome(id) * 50;
        c.cash += bonus;
        toast(`🏆 <b>#1 in ${cat.label}!</b><br>${companyName(id)} leads the industry: +${formatMoney(bonus)} and a permanent income boost.`);
      }
    }
  }

  /** Lightweight rival evolution: passive growth + occasional "acts". */
  function evolveRivals(id, days) {
    const c = co(id);
    const d = Math.min(days, RIVAL_CFG.MAX_EVOLVE_DAYS);
    const t = now();
    for (const r of c.rivals) {
      r.strength = clamp(r.strength * (1 + r.growth * d), 1, 800);
      r.value *= (1 + r.growth * 0.5 * d);
      r.profit *= (1 + r.growth * 0.3 * d);
      if (t - r.lastAct > RIVAL_CFG.ACT_INTERVAL && RNG() < RIVAL_CFG.ACT_CHANCE) {
        r.lastAct = t;
        const roll = RNG();
        let what;
        if (roll < 0.4) { r.strength *= 1.08; what = 'launched a new product'; }
        else if (roll < 0.7) { r.value *= 1.06; what = 'expanded into new markets'; }
        else { r.rep = clamp(r.rep + 4, 0, 100); what = 'ran a big ad campaign'; }
        if (dash && dash.id === id) toast(`🏭 <b>${r.name}</b> ${what}.`);
      }
    }
  }

  /* ==================== Phase 4: Industry-specific extras ================== */

  // Manufacturing — only for companies with physical products (Halcyon, Vireo
  // hardware, Cygnus robotics). Software/social companies skip it entirely.
  const MANU = {
    outsource: { label: 'Outsource', note: 'Cheap & fast — lower margin, less control', physMult: 0.95, quality: -0.2 },
    inhouse:   { label: 'In-house',  note: 'Costly to set up — better margin & quality, more control', physMult: 1.18, quality: 0.5, setupMult: 60 },
  };
  // Financial strategy stance (pick one).
  const STRATEGIES = {
    balanced:  { label: 'Balanced',        icon: '⚖️', note: 'No bias — steady as she goes.' },
    research:  { label: 'Research Focus',  icon: '🔬', note: '+ research success & innovation; lower profit now.' },
    marketing: { label: 'Marketing Focus', icon: '📣', note: 'Steadily wins market share; lower profit now.' },
    costcut:   { label: 'Cut Costs',       icon: '✂️', note: 'More profit now, but risks satisfaction & quality.' },
  };
  // Global expansion regions (simplified: income boost vs a cost drag).
  const REGIONS = [
    { id: 'na',    name: 'North America',        income: 0,    cost: 0,     costMult: 0 },  // home
    { id: 'eu',    name: 'Europe',               income: 0.12, cost: 0.03,  costMult: 15 },
    { id: 'apac',  name: 'Asia-Pacific',         income: 0.20, cost: 0.06,  costMult: 28 },
    { id: 'latam', name: 'Latin America',        income: 0.09, cost: 0.02,  costMult: 10 },
    { id: 'mea',   name: 'Middle East & Africa', income: 0.10, cost: 0.035, costMult: 12 },
  ];
  const REGION_BY_ID = Object.fromEntries(REGIONS.map((r) => [r.id, r]));
  // Rate-limited themed events (a choice with cost/benefit, dismissible).
  const EVENTS = [
    { id: 'viral',  icon: '🚀', title: 'Viral Hit',         desc: 'One of your products is blowing up online.',            a: { label: 'Pour money into it', cost: 12 }, b: { label: 'Let it ride' } },
    { id: 'breach', icon: '🔓', title: 'Security Incident',  desc: 'A data breach is making headlines.',                    a: { label: 'Fund a full cleanup', cost: 15 }, b: { label: 'Downplay it' } },
    { id: 'supply', icon: '📦', title: 'Supply Shortage',    desc: 'A key component just became scarce.', phys: true,       a: { label: 'Pay premium for supply', cost: 14 }, b: { label: 'Ride it out' } },
    { id: 'poach',  icon: '🧲', title: 'Talent Poaching',    desc: 'A rival is trying to hire away your engineers.',        a: { label: 'Make a counter-offer', cost: 13 }, b: { label: 'Let them walk' } },
  ];
  const EVENT_INTERVAL = 6 * 60 * 1000;   // ≥6 min between events
  const EVENT_FIRST_DELAY = 3 * 60 * 1000;

  const hasManufacturing = (id) => def(id).catalog.some((row) => row[1]);
  function manufacturingMult(id, p) {
    if (!p.phys) return 1;
    const m = co(id).manufacturing;
    return m === 'inhouse' ? MANU.inhouse.physMult : m === 'outsource' ? MANU.outsource.physMult : 1;
  }
  function manufacturingQuality(id) {
    const m = co(id).manufacturing;
    return m === 'inhouse' ? MANU.inhouse.quality : m === 'outsource' ? MANU.outsource.quality : 0;
  }
  const inhouseSetupCost = (id) => baseIncome(id) * MANU.inhouse.setupMult;
  function setManufacturing(id, mode) {
    const c = co(id);
    if (!hasManufacturing(id)) return { ok: false, msg: 'This company makes no physical products.' };
    if (c.manufacturing === mode) return { ok: false, msg: 'Already set.' };
    if (mode === 'inhouse') {
      const cost = inhouseSetupCost(id);
      if (c.cash < cost) return { ok: false, msg: `Need ${formatMoney(cost)} to build in-house.` };
      c.cash -= cost;
    }
    c.manufacturing = mode;
    saveGame();
    if (dash && dash.id === id) rebuildDash();
    return { ok: true, msg: mode === 'inhouse' ? 'Manufacturing brought in-house.' : 'Switched to outsourcing.' };
  }

  function setStrategy(id, s) {
    const c = co(id);
    if (!STRATEGIES[s]) return { ok: false, msg: 'Unknown strategy.' };
    c.strategy = s;
    saveGame();
    if (dash && dash.id === id) rebuildDash();
    return { ok: true, msg: `${STRATEGIES[s].label} in effect.` };
  }
  const strategyOpexDelta = (id) => ({ research: 0.05, marketing: 0.05, costcut: -0.10 }[co(id).strategy] || 0);
  const strategyResearchBonus = (id) => (co(id).strategy === 'research' ? 0.08 : 0);
  const strategySatPenalty = (id) => (co(id).strategy === 'costcut' ? 15 : 0);
  const strategyReceptionDelta = (id) => (co(id).strategy === 'costcut' ? -0.4 : 0);

  const globalIncomeMult = (id) => co(id).regions ? Object.keys(co(id).regions).reduce((m, r) => m + (REGION_BY_ID[r] ? REGION_BY_ID[r].income : 0), 1) : 1;
  const globalOpexAdd = (id) => co(id).regions ? Object.keys(co(id).regions).reduce((s, r) => s + (REGION_BY_ID[r] ? REGION_BY_ID[r].cost : 0), 0) : 0;
  const regionCost = (id, rid) => baseIncome(id) * REGION_BY_ID[rid].costMult;
  function unlockRegion(id, rid) {
    const c = co(id), reg = REGION_BY_ID[rid];
    if (!reg) return { ok: false, msg: 'Unknown region.' };
    if (c.regions[rid]) return { ok: false, msg: 'Already operating there.' };
    const cost = regionCost(id, rid);
    if (c.cash < cost) return { ok: false, msg: `Need ${formatMoney(cost)} to expand to ${reg.name}.` };
    c.cash -= cost; c.regions[rid] = true;
    saveGame();
    if (dash && dash.id === id) rebuildDash();
    return { ok: true, msg: `Now operating in ${reg.name}.` };
  }

  // Rival acquisition — only when you clearly dominate the rival.
  const canAcquire = (id, idx) => { const r = co(id).rivals[idx]; return r && r.strength <= playerStrength(id) * 0.5; };
  const acquireCost = (id, idx) => { const r = co(id).rivals[idx]; return baseIncome(id) * 40 + (r ? r.value * 0.15 : 0); };
  function acquireRival(id, idx) {
    const c = co(id), r = c.rivals[idx];
    if (!r) return { ok: false, msg: 'No such rival.' };
    if (!canAcquire(id, idx)) return { ok: false, msg: `${r.name} is too strong — weaken it first.` };
    const cost = acquireCost(id, idx);
    if (c.cash < cost) return { ok: false, msg: `Need ${formatMoney(cost)} to acquire ${r.name}.` };
    c.cash -= cost;
    c.edge = (c.edge || 0) + r.strength;   // absorb their market share
    c.acqBonus = (c.acqBonus || 0) + 0.02; // permanent +2% income
    c.reputation = clamp(c.reputation + 3, 0, 100);
    c.rivals.splice(idx, 1);
    checkLeadership(id);
    saveGame();
    if (dash && dash.id === id) rebuildDash();
    return { ok: true, msg: `Acquired ${r.name} — its market share is yours.` };
  }

  /* ------------------------------- Events --------------------------------- */

  function maybeRollEvent(id) {
    const c = co(id);
    if (c.event || now() < c.nextEventAt) return;
    const pool = EVENTS.filter((e) => !e.phys || hasManufacturing(id));
    const e = pool[Math.floor(RNG() * pool.length)];
    c.event = { id: e.id };
    c.nextEventAt = now() + EVENT_INTERVAL;
    toast(`${e.icon} <b>${e.title}</b><br>${companyName(id)} — a decision awaits in the More tab.`);
    saveGame();
    if (dash && dash.id === id) rebuildDash();
  }
  function eventDef(id) { const c = co(id); return c.event ? EVENTS.find((e) => e.id === c.event.id) : null; }
  function resolveEvent(id, choice) {
    const c = co(id), e = eventDef(id);
    if (!e) return { ok: false, msg: 'No active event.' };
    if (choice === 'dismiss') { c.event = null; saveGame(); if (dash && dash.id === id) rebuildDash(); return { ok: true, msg: 'Dismissed.' }; }
    const opt = choice === 'a' ? e.a : e.b;
    if (opt.cost) {
      const cost = baseIncome(id) * opt.cost;
      if (c.cash < cost) return { ok: false, msg: `Need ${formatMoney(cost)}.` };
      c.cash -= cost;
    }
    const rivalTot = totalRivalStrength(id) || 10;
    if (e.id === 'viral') c.edge = (c.edge || 0) + rivalTot * (choice === 'a' ? 0.25 : 0.08);
    else if (e.id === 'breach' && choice === 'b') { c.reputation = clamp(c.reputation - 8, 0, 100); c.satisfaction = clamp(c.satisfaction - 8, 0, 100); }
    else if (e.id === 'supply' && choice === 'b') c.supplyUntil = now() + (c.manufacturing === 'inhouse' ? 150000 : 300000);
    else if (e.id === 'poach' && choice === 'b') { c.edge = (c.edge || 0) * 0.7; if (c.staff.eng.count > 1) c.staff.eng.count--; }
    c.event = null;
    checkLeadership(id);
    saveGame();
    if (dash && dash.id === id) rebuildDash();
    return { ok: true, msg: 'Handled.' };
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
    // Phase 3/4: market share scales income; leadership, global reach and
    // acquisitions stack on top; a price undercut or supply shortage bite briefly.
    const undercut = (c.undercutUntil && now() < c.undercutUntil) ? 0.9 : 1;
    const supply = (c.supplyUntil && now() < c.supplyUntil) ? 0.85 : 1;
    return rev * shareIncomeMult(id) * leaderMult(id) * globalIncomeMult(id) * sigIncomeMult(id) * (1 + (c.acqBonus || 0)) * undercut * supply;
  }
  // Net profit = revenue − operating costs − payroll. Overspending on staff
  // makes this negative and burns company cash (see advance()).
  function netProfitPerDay(id) {
    const rev = revenuePerDay(id);
    return rev - rev * opexRate(id) - payrollPerDay(id) - researchSpendPerDay(id);
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
      buildsActive: c.builds.length,
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

    // TEMPORARY (testing): while infinite money is on, keep the company's own
    // cash topped up so you can freely test products, staff, research, etc.
    if (typeof INFINITE_MONEY !== 'undefined' && INFINITE_MONEY && c.cash < 1e12) c.cash = 1e13;

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
      // Accumulate lifetime sales, then decay + retire products.
      const retired = [];
      for (const p of c.products) {
        if (p.unitPrice) { // Studio products track units/revenue/profit
          const inc = productIncome(id, p) * days;
          p.revenue = (p.revenue || 0) + inc;
          p.profit = (p.profit || 0) + inc * productMargin(id, p);
          if (p.unitPrice > 0) p.unitsSold = (p.unitsSold || 0) + inc / p.unitPrice;
        }
        p.health -= CFG.DECAY_PER_DAY * days;
        if (p.health <= 0) retired.push(p);
      }
      if (retired.length) {
        c.products = c.products.filter((p) => p.health > 0);
        for (const p of retired) toast(`📦 <b>${p.type} retired</b><br>${companyName(id)} sunset an ageing product.`);
      }
      // Rivals grow & occasionally act; your competitive edge fades over time.
      evolveRivals(id, days);
      c.edge = Math.max(0, (c.edge || 0) * (1 - RIVAL_CFG.EDGE_DECAY * Math.min(days, 60)));
      // Phase 4 — financial-strategy passives.
      const sd = Math.min(days, 30);
      if (c.strategy === 'marketing') c.edge = (c.edge || 0) + totalRivalStrength(id) * 0.02 * sd;
      if (c.strategy === 'research') c.innovBonus = (c.innovBonus || 0) + 3 * sd;
    }

    // 4) Company valuation ratchets up toward its growth target.
    const target = valuationTarget(id);
    if (target > c.valuation) c.valuation = target;

    // 5) Claim any newly-earned industry leaderships (passive check).
    checkLeadership(id);

    // 6) Maybe surface a rate-limited themed event.
    maybeRollEvent(id);
  }

  function completeBuild(id, b) {
    const c = co(id);
    // Staff, research, in-house manufacturing quality and strategy all shift the
    // reception (physical products benefit from manufacturing control).
    const bonus = staffReceptionBonus(id) + researchReceptionBonus(id)
      + (b.phys ? manufacturingQuality(id) : 0) + strategyReceptionDelta(id);
    let reception, p;
    if (b.deep) {
      // Studio product: quality (specs + budget + team) drives the reception roll.
      const cq = computeQuality(id, b.cfg);
      reception = scoreToReception(cq.quality / 20 + bonus + RNG() * 1.4);
      p = makeDeepProduct(id, b, reception, cq);
    } else {
      reception = rollReception(b, bonus);
      p = makeProduct(id, b, reception);
    }
    c.products.push(p);
    const r = RECEPTIONS[reception];
    // Reception nudges brand reputation + customer satisfaction; a higher product
    // TIER lifts the brand a little more (halo effect), a budget tier less.
    const tierBrand = (b.deep && TECH_TIERS[b.cfg.tier]) ? (TECH_TIERS[b.cfg.tier].brand || 0) : 0;
    c.reputation = clamp(c.reputation + r.rep + tierBrand, 0, 100);
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

  // Bottom-of-screen pop-up notifications are disabled — the dashboard rebuilds
  // to reflect completions/events, so no banners are needed. Kept as a no-op so
  // every existing caller still works.
  function toast() { /* intentionally silent */ }

  /* ==================================================================== *
   *  DASHBOARD UI
   * ==================================================================== */

  let dash = null; // { id, el, tab, launch }  — null when closed
  let lastSoftRefresh = 0; // throttles the affordability soft-refresh (Staff/More)

  const companyName = (id) => (ASSET_BY_ID[id] ? ASSET_BY_ID[id].name : id);
  const TABS = [
    { id: 'products',  label: 'Products' },
    { id: 'signature', label: 'Signature' },
    { id: 'staff',     label: 'Staff' },
    { id: 'rnd',       label: 'Research' },
    { id: 'market',    label: 'Market' },
    { id: 'more',      label: 'More' },
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
    // The Product Studio takes over the whole screen — a dedicated design page,
    // not a panel under the dashboard chrome.
    if (dash.launch) { dash.el.innerHTML = wizardHTML(id); wireWizard(); return; }
    dash.el.innerHTML = `
      <div class="tc-head">
        <button class="icon-btn" id="tcClose" aria-label="Close">✕</button>
        <div class="tc-id">
          <div class="tc-co-name">${companyName(id)}</div>
          <div class="tc-co-sector">${d.label} · <span class="muted">${d.tagline}</span></div>
        </div>
      </div>

      <div class="tc-hero">
        <div class="tc-hero-label">Company Value</div>
        <div class="tc-hero-value" data-h="Company Value">${formatMoney(s.value)}</div>
        <div class="tc-hero-sub" data-hsub>${heroSub(s)}</div>
      </div>
      <div class="tc-headline">
        ${headStat('Net Profit / day', formatMoney(s.netProfitDay), s.netProfitDay >= 0 ? 'up' : 'down')}
        ${headStat('Cash', formatMoney(s.cash), s.cash < 0 ? 'down' : '')}
        ${headStat('Market Share', s.share.toFixed(1) + '%')}
      </div>

      <details class="tc-details">
        <summary>More stats</summary>
        <div class="tc-detail-grid">
          ${detStat('Revenue / day', formatMoney(s.revenueDay))}
          ${detStat('Payroll / day', formatMoney(s.payrollDay))}
          ${detStat('Employees', formatNumber(s.employees, 0))}
          ${detStat('Active Products', String(s.activeProducts) + (s.buildsActive ? ' · ' + s.buildsActive + ' building' : ''))}
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

  /** Hero subtitle: raw market cap + how much value YOUR management has added. */
  function heroSub(s) {
    const premium = s.marketCap > 0 ? (s.value / s.marketCap - 1) * 100 : 0;
    const tag = premium >= 0.05
      ? `<span class="up">+${premium.toFixed(1)}% from your management</span>`
      : `<span class="muted">build it up to grow this</span>`;
    return `Market cap ${formatMoney(s.marketCap)} · ${tag}`;
  }

  function headStat(label, value, cls = '') {
    return `<div class="tc-hstat"><span>${label}</span><b class="${cls}" data-h="${label}">${value}</b></div>`;
  }
  function detStat(label, value) {
    return `<div class="tc-dstat"><span>${label}</span><b data-d="${label}">${value}</b></div>`;
  }

  function tabHTML(id) {
    if (dash.detailPid != null) return productDetailHTML(id);
    switch (dash.tab) {
      case 'products':  return productsHTML(id);
      case 'signature': return signatureHTML(id);
      case 'staff':     return staffHTML(id);
      case 'rnd':       return dash.rDetail ? rDetailHTML(id) : researchHTML(id);
      case 'market':    return marketHTML(id);
      case 'more':      return moreHTML(id);
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
    const builds = c.builds.map((b) => buildRowHTML(id, b)).join('');
    const prods = c.products.length
      ? c.products.slice().sort((a, b) => productIncome(id, b) - productIncome(id, a)).map((p) => productRowHTML(id, p)).join('')
      : `<div class="tc-empty">No products yet. Develop your first one to start earning.</div>`;
    return `
      <button class="btn btn-gold btn-wide tc-new" data-tcact="newproduct">＋ Develop New Product</button>
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
            <button class="btn tc-mini" data-tcact="hire" data-group="${g}" ${c.cash >= hc ? '' : 'disabled'}>Hire · ${formatMoney(hc)}</button>
            <button class="btn tc-mini" data-tcact="train" data-group="${g}" ${maxed || c.cash < tc ? 'disabled' : ''}>${maxed ? 'Fully trained' : 'Train · ' + formatMoney(tc)}</button>
          </div>
        </div>`;
    };
    return `
      <div class="tc-staff-summary">
        <div><span>Payroll / day</span><b class="down">${formatMoney(s.payrollDay)}</b></div>
        <div><span>Active products</span><b>${s.activeProducts}</b></div>
        <div><span>Net profit / day</span><b class="${s.netProfitDay >= 0 ? 'up' : 'down'}">${formatMoney(s.netProfitDay)}</b></div>
      </div>
      <p class="tc-hint">Hiring adds ongoing payroll; Training is a one-off boost with no payroll. Keep net profit positive — overspending burns company cash.</p>
      ${['eng', 'mkt', 'ops'].map(card).join('')}
    `;
  }

  /* --------------------------- Research dashboard -------------------------- */

  const pips = (lvl, max) => '●'.repeat(lvl) + '○'.repeat(Math.max(0, max - lvl));

  function researchHTML(id) {
    const c = rstate(id), tree = treeOf(id), s = snapshot(id);
    const cap = researchCapacity(id), power = Math.round(researchPower(id));
    const techs = co(id).unlocked;

    // Active projects (category level-ups) with live progress — tap to manage.
    const activeRows = c.active.map((a) => {
      const cat = tree.categories.find((x) => x.id === a.cat);
      const total = a.endsAt - a.startMs, pct = clamp(((now() - a.startMs) / total) * 100, 0, 100);
      const left = Math.max(0, Math.ceil((a.endsAt - now()) / 1000));
      const name = cat ? cat.levels[a.to - 1][0] : '';
      const team = (a.lead || 0) + (a.sr || 0) + (a.jr || 0);
      return `<button class="tc-rproj" data-rproj="${a.cat}" data-tcact="ropen" data-kind="cat" data-rid="${a.cat}">
        <div class="tc-rproj-top"><b>${cat ? cat.icon + ' ' + name : ''}</b><span class="muted">Lvl ${a.to} · ${team} on it ›</span></div>
        <div class="tc-progress"><div class="tc-progress-fill" style="width:${pct}%"></div></div>
        <div class="tc-build-left"><span data-rleft="${a.cat}">${left > 0 ? formatDuration(left) + ' left' : 'Finishing…'}</span></div>
      </button>`;
    }).join('');

    // Category tech trees — each card taps through to a deep project view.
    const catRows = tree.categories.map((cat) => {
      const lvl = c.levels[cat.id] || 0, maxed = lvl >= cat.levels.length;
      const building = c.active.some((a) => a.cat === cat.id);
      const next = maxed ? null : cat.levels[lvl];
      const to = lvl + 1;
      const status = maxed ? `<span class="tc-r-done">✓ Maxed</span>` : building ? `<span class="tc-r-lock">In progress</span>` : `<span class="tc-cat-go">Manage ›</span>`;
      return `
        <button class="tc-cat" data-tcact="ropen" data-kind="cat" data-rid="${cat.id}">
          <div class="tc-cat-head">
            <div class="tc-cat-title">${cat.icon} ${cat.name}</div>
            <div class="tc-cat-pips">${pips(lvl, cat.levels.length)}</div>
          </div>
          ${next ? `<div class="tc-cat-next"><b>Next — Lvl ${to}: ${next[0]}</b> — ${next[1]}<div class="tc-cat-eff">${effectText(next[2])}</div></div>`
            : `<div class="tc-cat-next muted">Every breakthrough unlocked.</div>`}
          <div class="tc-cat-foot">${status}</div>
        </button>`;
    }).join('');

    // Scientists.
    const sciRow = Object.keys(RESEARCH_SCI).map((k) => {
      const r = RESEARCH_SCI[k], cost = baseIncome(id) * r.hire * (1 + (c.sci[k] || 0) * 0.5);
      return `<div class="tc-sci">
        <div><div class="tc-sci-n">${r.label}</div><div class="tc-sci-c">${c.sci[k] || 0} employed</div></div>
        <button class="btn tc-mini" data-tcact="rhire" data-role="${k}" ${co(id).cash >= cost ? '' : 'disabled'}>Hire · ${formatMoney(cost)}</button>
      </div>`;
    }).join('');

    // Research centres & partnerships.
    const centerRows = RESEARCH_CENTERS.map((ctr) => {
      const built = c.centers[ctr.id], cost = baseIncome(id) * ctr.costMult;
      return `<div class="tc-region ${built ? 'is-on' : ''}">
        <div class="tc-region-main"><div class="tc-region-name">${ctr.name}</div><div class="tc-region-trade">${ctr.region} · +${ctr.power} research power</div></div>
        <div class="tc-region-right">${built ? '<span class="tc-r-done">✓ Built</span>' : `<button class="btn tc-mini" data-tcact="rcenter" data-cid="${ctr.id}" ${co(id).cash >= cost ? '' : 'disabled'}>Build · ${formatMoney(cost)}</button>`}</div>
      </div>`;
    }).join('');
    const partnerRows = RESEARCH_PARTNERS.map((pt) => {
      const has = c.partners[pt.id], cost = baseIncome(id) * pt.costMult;
      return `<div class="tc-region ${has ? 'is-on' : ''}">
        <div class="tc-region-main"><div class="tc-region-name">${pt.name}</div><div class="tc-region-trade">${pt.desc}</div></div>
        <div class="tc-region-right">${has ? '<span class="tc-r-done">✓ Partnered</span>' : `<button class="btn tc-mini" data-tcact="rpartner" data-pid="${pt.id}" ${co(id).cash >= cost ? '' : 'disabled'}>Form · ${formatMoney(cost)}</button>`}</div>
      </div>`;
    }).join('');

    // Mass "moonshot" projects — tap to view details and staff them.
    const massRows = (tree.mass || []).map((m) => {
      const st = c.mass[m.id];
      let right;
      if (st === 'done') right = `<span class="tc-r-done">✓ Achieved</span>`;
      else if (st && st.endsAt) {
        const total = st.endsAt - st.startMs, pct = clamp(((now() - st.startMs) / total) * 100, 0, 100);
        const left = Math.max(0, Math.ceil((st.endsAt - now()) / 1000));
        right = `<div class="tc-r-active"><div class="tc-progress"><div class="tc-progress-fill" style="width:${pct}%"></div></div><span class="muted" data-mleft="${m.id}">${left > 0 ? formatDuration(left) + ' left' : 'Finishing…'}</span></div>`;
      } else right = `<span class="tc-cat-go">Manage ›</span>`;
      return `<button class="tc-mass ${st === 'done' ? 'is-done' : ''}" data-tcact="ropen" data-kind="mass" data-rid="${m.id}">
        <div class="tc-mass-main"><div class="tc-mass-name">🚀 ${m.name}</div><div class="tc-mass-desc">${m.desc}</div><div class="tc-cat-eff">${effectText(m.effect)}</div></div>
        <div class="tc-mass-right">${right}</div>
      </button>`;
    }).join('');

    // Budget selector.
    const budgetChips = Object.keys(RESEARCH_BUDGETS).map((k) =>
      `<button class="tc-chip ${c.budget === k ? 'on' : ''}" data-tcact="rbudget" data-b="${k}">${RESEARCH_BUDGETS[k].label}</button>`).join('');

    return `
      <div class="tc-rstats">
        ${detStat('Research Power', String(power))}
        ${detStat('Capacity', c.active.length + '/' + cap + ' projects')}
        ${detStat('Technologies', String(techs.length))}
        ${detStat('R&D Spend / day', formatMoney(researchSpendPerDay(id)))}
      </div>

      <div class="tc-field-label">Research Budget <span class="muted">${RESEARCH_BUDGETS[c.budget].daily}× base income/day · ${RESEARCH_BUDGETS[c.budget].speed}× speed</span></div>
      <div class="tc-chip-row">${budgetChips}</div>

      ${activeRows ? `<div class="tc-section-label">Active Projects</div><div class="tc-rproj-list">${activeRows}</div>` : ''}

      <div class="tc-section-label">Research Categories</div>
      <div class="tc-cat-list">${catRows}</div>

      <div class="tc-section-label">Scientists</div>
      <div class="tc-sci-list">${sciRow}</div>

      <div class="tc-section-label">Mass Projects</div>
      <p class="tc-hint">Moonshots — huge cost and time, but a breakthrough that transforms the company.</p>
      <div class="tc-mass-list">${massRows}</div>

      <div class="tc-section-label">Research Centres</div>
      <div class="tc-region-list">${centerRows}</div>

      <div class="tc-section-label">Partnerships</div>
      <div class="tc-region-list">${partnerRows}</div>

      ${techs.length ? `<div class="tc-section-label">Technologies Unlocked</div><div class="tc-tech-list">${techs.map((t) => `<span class="tc-tech">${t[0]}</span>`).join('')}</div>` : ''}
    `;
  }

  /* --------------------- Research project detail (deep) -------------------- */

  // A ± stepper that assigns scientists of a role to the open project.
  function assignStepper(id, role, cfg, activeProj) {
    const avail = availableSci(id, role, activeProj);
    const val = cfg[role] || 0;
    const label = RESEARCH_SCI[role].short;
    return `<div class="tc-assign">
      <div class="tc-assign-l"><b>${label}</b><small>${avail} available</small></div>
      <div class="tc-stepper">
        <button class="tc-step" data-tcact="rassign" data-role="${role}" data-delta="-1" ${val <= 0 ? 'disabled' : ''}>−</button>
        <span class="tc-step-v">${val}</span>
        <button class="tc-step" data-tcact="rassign" data-role="${role}" data-delta="1" ${avail <= 0 ? 'disabled' : ''}>+</button>
      </div>
    </div>`;
  }

  function assignPanel(id, cfg, activeProj) {
    const prio = Object.keys(PRIORITY).map((k) =>
      `<button class="tc-chip ${cfg.priority === k ? 'on' : ''}" data-tcact="rprio" data-p="${k}">${PRIORITY[k].label}</button>`).join('');
    return `
      <div class="tc-section-label">Assign Team</div>
      ${assignStepper(id, 'lead', cfg, activeProj)}
      ${assignStepper(id, 'sr', cfg, activeProj)}
      ${assignStepper(id, 'jr', cfg, activeProj)}
      <div class="tc-field-label">Priority <span class="muted">${PRIORITY[cfg.priority].speed}× speed · ${PRIORITY[cfg.priority].cost}× cost</span></div>
      <div class="tc-chip-row">${prio}</div>`;
  }

  function rDetailHTML(id) {
    const rd = dash.rDetail, c = rstate(id), tree = treeOf(id);
    const back = `<div class="tc-launch-head"><button class="icon-btn" data-tcact="rclose" aria-label="Back">‹</button><b>Research Project</b></div>`;

    if (rd.kind === 'cat') {
      const cat = tree.categories.find((x) => x.id === rd.id);
      if (!cat) return back + `<div class="tc-empty">Not found.</div>`;
      const lvl = c.levels[cat.id] || 0, maxed = lvl >= cat.levels.length;
      const active = c.active.find((a) => a.cat === cat.id);
      // Full 5-level roadmap.
      const road = cat.levels.map((L, i) => {
        const st = i < lvl ? 'done' : (active && active.to - 1 === i) ? 'active' : (i === lvl ? 'next' : 'locked');
        const tag = st === 'done' ? '✓' : st === 'active' ? '⏳' : st === 'next' ? '▸' : '🔒';
        return `<div class="tc-road tc-road-${st}">
          <div class="tc-road-l">${tag}</div>
          <div class="tc-road-m"><div class="tc-road-n">Lvl ${i + 1}: ${L[0]}</div><div class="tc-road-d">${L[1]}</div><div class="tc-cat-eff">${effectText(L[2])}</div></div>
        </div>`;
      }).join('');

      let action = '';
      if (maxed) action = `<div class="tc-empty">Every breakthrough in ${cat.name} is unlocked.</div>`;
      else {
        const to = lvl + 1, cfg = rd.cfg;
        const cost = projectCost(id, to, cfg), dur = projectDuration(id, to, cfg);
        if (active) {
          const total = active.endsAt - active.startMs, pct = clamp(((now() - active.startMs) / total) * 100, 0, 100);
          const left = Math.max(0, Math.ceil((active.endsAt - now()) / 1000));
          action = `
            <div class="tc-section-label">In Progress — Lvl ${active.to}: ${cat.levels[active.to - 1][0]}</div>
            <div class="tc-progress tc-progress-lg"><div class="tc-progress-fill" data-rdfill style="width:${pct}%"></div></div>
            <div class="tc-build-left"><span data-rdleft>${left > 0 ? formatDuration(left) + ' left' : 'Finishing…'}</span></div>
            ${assignPanel(id, cfg, active)}
            <button class="btn btn-gold btn-wide" data-tcact="reditcfg" data-rid="${cat.id}">Update Team</button>`;
        } else {
          const afford = co(id).cash >= cost;
          action = `
            <div class="tc-preview">
              <div><span>Cost</span><b class="${afford ? 'gold' : 'down'}">${formatMoney(cost)}</b></div>
              <div><span>Time</span><b>${formatDuration(dur)}</b></div>
              <div><span>Effect</span><b>${effectText(cat.levels[to - 1][2])}</b></div>
            </div>
            ${assignPanel(id, cfg, null)}
            <button class="btn btn-gold btn-wide" data-tcact="rstartcfg" data-rid="${cat.id}" ${afford ? '' : 'disabled'}>${afford ? 'Start Research' : 'Not enough cash'}</button>`;
        }
      }
      return `${back}
        <div class="tc-rd-title">${cat.icon} ${cat.name}</div>
        <div class="tc-rd-sub">${pips(lvl, cat.levels.length)} · Level ${lvl}/${cat.levels.length}</div>
        <div class="tc-section-label">Roadmap</div>
        <div class="tc-road-list">${road}</div>
        ${action}`;
    }

    // Mass moonshot detail.
    const m = (tree.mass || []).find((x) => x.id === rd.id);
    if (!m) return back + `<div class="tc-empty">Not found.</div>`;
    const st = c.mass[m.id], cfg = rd.cfg;
    const cost = baseIncome(id) * m.costMult * govDiscount(id) * priorityOf(cfg).cost;
    let action;
    if (st === 'done') action = `<div class="tc-empty">Achieved — this breakthrough is yours.</div>`;
    else if (st && st.endsAt) {
      const total = st.endsAt - st.startMs, pct = clamp(((now() - st.startMs) / total) * 100, 0, 100);
      const left = Math.max(0, Math.ceil((st.endsAt - now()) / 1000));
      action = `<div class="tc-section-label">In Progress</div>
        <div class="tc-progress tc-progress-lg"><div class="tc-progress-fill" data-rdfill style="width:${pct}%"></div></div>
        <div class="tc-build-left"><span data-rdleft>${left > 0 ? formatDuration(left) + ' left' : 'Finishing…'}</span></div>`;
    } else {
      const afford = co(id).cash >= cost;
      action = `
        <div class="tc-preview">
          <div><span>Cost</span><b class="${afford ? 'gold' : 'down'}">${formatMoney(cost)}</b></div>
          <div><span>Effect</span><b>${effectText(m.effect)}</b></div>
        </div>
        ${assignPanel(id, cfg, null)}
        <button class="btn btn-gold btn-wide" data-tcact="rmasscfg" data-rid="${m.id}" ${afford ? '' : 'disabled'}>${afford ? '🚀 Launch Moonshot' : 'Not enough cash'}</button>`;
    }
    return `${back}
      <div class="tc-rd-title">🚀 ${m.name}</div>
      <div class="tc-rd-sub">Mass Project · a company-defining breakthrough</div>
      <p class="tc-hint">${m.desc}</p>
      ${action}`;
  }

  /* ----------------------------- Signature tab ----------------------------- */
  // The company's ONE-OF-A-KIND operation: an always-on trait plus either a
  // 5-step ladder program you fund milestone-by-milestone, or a 3-way doctrine
  // dial you tune to your strategy. Data lives in data/signature.js.

  function signatureHTML(id) {
    const s = sigDef(id);
    if (!s) return placeholderHTML('No signature', '—', 'This company has no signature operation.');
    const st = sigState(id), agg = sigAgg(id), c = co(id);
    const summary = sigEffectText(agg) || 'No active bonuses yet';
    const traitTxt = sigEffectText(s.trait.effect);

    let body = '';
    if (s.kind === 'ladder') {
      const lvl = st.level || 0;
      const rows = s.steps.map((step, i) => {
        const done = i < lvl, next = i === lvl;
        const cls = done ? 'is-done' : next ? 'is-next' : 'is-locked';
        const cost = ladderStepCost(id, i);
        const mark = done ? '<span class="tc-sig-tick">✓</span>' : `<span class="tc-sig-num">${i + 1}</span>`;
        return `<div class="tc-sig-step ${cls}">
          ${mark}
          <div class="tc-sig-step-main">
            <div class="tc-sig-step-name">${step[0]}${done ? ' <span class="tc-sig-doneflag">Active</span>' : ''}</div>
            <div class="tc-sig-step-desc">${step[1]}</div>
            <div class="tc-sig-step-eff">${sigEffectText(step[2])}</div>
          </div>
          ${next ? `<button class="btn btn-gold tc-mini tc-sig-buy" data-tcact="sigadv" ${c.cash >= cost ? '' : 'disabled'}>${c.cash >= cost ? 'Fund · ' + formatMoney(cost) : formatMoney(cost)}</button>` : ''}
        </div>`;
      }).join('');
      const doneTxt = lvl >= s.steps.length ? '<p class="tc-hint">Program complete — every milestone unlocked.</p>' : '';
      body = `<div class="tc-section-label">Signature Program · ${lvl}/${s.steps.length}</div>
        <div class="tc-sig-track">${rows}</div>${doneTxt}`;
    } else if (s.kind === 'doctrine') {
      const cur = st.stance;
      const cards = s.stances.map((x) => {
        const on = x.id === cur;
        return `<button class="tc-sig-stance ${on ? 'on' : ''}" data-tcact="sigstance" data-stance="${x.id}">
          <div class="tc-sig-stance-top"><b>${x.label}</b>${on ? '<span class="tc-sig-onflag">Active</span>' : ''}</div>
          <div class="tc-sig-stance-desc">${x.desc}</div>
          <div class="tc-sig-step-eff">${sigEffectText(x.effect)}</div>
        </button>`;
      }).join('');
      body = `<div class="tc-section-label">Strategic Doctrine</div>
        <p class="tc-hint">Pick the stance that fits your strategy — switch any time, free.</p>
        <div class="tc-sig-stances">${cards}</div>`;
    }

    return `
      <div class="tc-sig-hero">
        <div class="tc-sig-icon">${s.icon}</div>
        <div class="tc-sig-hero-main">
          <div class="tc-sig-title">${s.title}</div>
          <div class="tc-sig-tag">${s.tagline}</div>
        </div>
      </div>
      <div class="tc-sig-bonus"><span>Active bonuses</span><b>${summary}</b></div>
      <div class="tc-sig-trait">
        <div class="tc-sig-trait-badge">Signature Trait</div>
        <div class="tc-sig-trait-name">${s.trait.name}</div>
        <div class="tc-sig-trait-desc">${s.trait.desc}</div>
        <div class="tc-sig-step-eff">${traitTxt} · always active</div>
      </div>
      ${body}`;
  }

  /* ------------------------------- Market tab ------------------------------ */

  const bar = (v, cls = '') => `<div class="tc-bar"><div class="tc-bar-fill ${cls}" style="width:${clamp(v, 0, 100)}%"></div></div>`;

  function marketHTML(id) {
    const c = co(id);
    const share = marketShare(id);
    const shareRank = playerRank(id, 'share');
    const total = c.rivals.length + 1;
    const denom = playerStrength(id) + totalRivalStrength(id);

    // Compete actions.
    const competeBtns = Object.keys(COMPETE).map((a) => {
      const cost = competeCost(id, a), afford = c.cash >= cost;
      return `<button class="btn tc-compete" data-tcact="compete" data-comp="${a}" ${afford ? '' : 'disabled'}>
        <b>${COMPETE[a].icon} ${COMPETE[a].label}</b><small>${COMPETE[a].note} · ${afford ? formatMoney(cost) : 'need ' + formatMoney(cost)}</small></button>`;
    }).join('');

    // Rankings — where you stand, and which #1 crowns you hold.
    const rankRows = RANK_CATS.map((cat) => {
      const rank = playerRank(id, cat.id), led = !!c.leaders[cat.id];
      return `<div class="tc-rank">
        <span>${cat.label}</span>
        <b class="${rank === 1 ? 'up' : ''}">#${rank}<small> / ${total}</small>${led ? ' 🏆' : ''}</b>
      </div>`;
    }).join('');

    // Rivals, strongest first.
    const rivalRows = c.rivals.slice().sort((a, b) => b.strength - a.strength).map((r) => {
      const rs = (r.strength / denom) * 100;
      return `<div class="tc-rival">
        <div class="tc-rival-top"><b>${r.name}</b><span>${rs.toFixed(1)}% share</span></div>
        <div class="tc-rival-bars">
          <div><span>Reputation</span>${bar(r.rep)}</div>
          <div><span>Innovation</span>${bar(r.innovation, 'alt')}</div>
        </div>
      </div>`;
    }).join('');

    const ledCount = Object.keys(c.leaders).length;
    return `
      <div class="tc-share-hero">
        <div class="tc-share-big" data-share>${share.toFixed(1)}%</div>
        <div class="tc-share-sub">your market share · ranked <b>#${shareRank} of ${total}</b>${ledCount ? ` · 🏆 ${ledCount}/5 crowns` : ''}</div>
        <div class="tc-share-track">
          <div class="tc-share-you" style="width:${clamp(share, 1, 100)}%"></div>
        </div>
      </div>

      <div class="tc-section-label">Compete for share</div>
      <div class="tc-compete-grid">${competeBtns}</div>

      <div class="tc-section-label">Become the Industry Leader</div>
      <div class="tc-rank-grid">${rankRows}</div>
      <p class="tc-hint">Reach <b>#1</b> in a category for a cash reward and a permanent +${Math.round(LEADER_INCOME_BONUS * 100)}% company income — five crowns to claim.</p>

      <div class="tc-section-label">Rivals (${c.rivals.length})</div>
      <div class="tc-rival-list">${rivalRows}</div>
    `;
  }

  /* -------------------------------- More tab ------------------------------- */

  function moreHTML(id) {
    const c = co(id);
    return `
      ${eventCardHTML(id)}

      <div class="tc-section-label">Financial Strategy</div>
      <div class="tc-strat-grid">${Object.keys(STRATEGIES).map((s) => {
        const on = c.strategy === s, S = STRATEGIES[s];
        return `<button class="tc-strat ${on ? 'on' : ''}" data-tcact="strategy" data-strat="${s}">
          <b>${S.icon} ${S.label}</b><small>${S.note}</small></button>`;
      }).join('')}</div>

      ${manufacturingHTML(id)}

      <div class="tc-section-label">Global Expansion</div>
      <div class="tc-region-list">${REGIONS.map((reg) => regionRowHTML(id, reg)).join('')}</div>

      <div class="tc-section-label">Rival Acquisition</div>
      <p class="tc-hint">Weaken a rival below half your strength (Compete tab), then buy it out to absorb its market share and gain a permanent +2% income.</p>
      <div class="tc-acq-list">${c.rivals.map((r, i) => acqRowHTML(id, r, i)).join('') || '<div class="tc-empty">No rivals left — you own the market.</div>'}</div>
    `;
  }

  function eventCardHTML(id) {
    const e = eventDef(id);
    if (!e) return '';
    const costTxt = (opt) => opt.cost ? ` · ${formatMoney(baseIncome(id) * opt.cost)}` : '';
    return `
      <div class="tc-event">
        <button class="tc-event-x" data-tcact="event" data-choice="dismiss" aria-label="Dismiss">✕</button>
        <div class="tc-event-icon">${e.icon}</div>
        <div class="tc-event-title">${e.title}</div>
        <div class="tc-event-desc">${e.desc}</div>
        <div class="tc-event-btns">
          <button class="btn btn-gold tc-mini" data-tcact="event" data-choice="a">${e.a.label}${costTxt(e.a)}</button>
          <button class="btn tc-mini" data-tcact="event" data-choice="b">${e.b.label}${costTxt(e.b)}</button>
        </div>
      </div>`;
  }

  function manufacturingHTML(id) {
    if (!hasManufacturing(id)) return '';
    const c = co(id);
    const opt = (mode) => {
      const on = c.manufacturing === mode, M = MANU[mode];
      const cost = mode === 'inhouse' && !on ? ` · setup ${formatMoney(inhouseSetupCost(id))}` : '';
      return `<button class="tc-strat ${on ? 'on' : ''}" data-tcact="manu" data-mode="${mode}">
        <b>${M.label}${on ? ' ✓' : ''}</b><small>${M.note}${cost}</small></button>`;
    };
    return `
      <div class="tc-section-label">Manufacturing</div>
      <p class="tc-hint">Applies to your physical products. In-house costs more upfront but lifts margins and product quality.</p>
      <div class="tc-strat-grid">${opt('outsource')}${opt('inhouse')}</div>`;
  }

  function regionRowHTML(id, reg) {
    const c = co(id);
    const owned = !!c.regions[reg.id];
    const right = reg.id === 'na'
      ? '<span class="tc-r-done">Home</span>'
      : owned
        ? '<span class="tc-r-done">✓ Active</span>'
        : `<button class="btn tc-mini" data-tcact="region" data-region="${reg.id}" ${c.cash >= regionCost(id, reg.id) ? '' : 'disabled'}>Expand · ${formatMoney(regionCost(id, reg.id))}</button>`;
    const trade = reg.id === 'na' ? 'Your home market' : `+${Math.round(reg.income * 100)}% income · +${Math.round(reg.cost * 100)}% costs`;
    return `
      <div class="tc-region ${owned ? 'is-on' : ''}">
        <div class="tc-region-main"><div class="tc-region-name">${reg.name}</div><div class="tc-region-trade">${trade}</div></div>
        <div class="tc-region-right">${right}</div>
      </div>`;
  }

  function acqRowHTML(id, r, i) {
    const weak = canAcquire(id, i);
    const right = weak
      ? `<button class="btn btn-gold tc-mini" data-tcact="acquire" data-idx="${i}" ${co(id).cash >= acquireCost(id, i) ? '' : 'disabled'}>Acquire · ${formatMoney(acquireCost(id, i))}</button>`
      : `<span class="tc-r-lock">Too strong</span>`;
    return `
      <div class="tc-region">
        <div class="tc-region-main"><div class="tc-region-name">${r.name}</div>
          <div class="tc-region-trade">${weak ? 'Weak enough to buy out' : 'Weaken it below half your strength first'}</div></div>
        <div class="tc-region-right">${right}</div>
      </div>`;
  }

  function buildRowHTML(id, b) {
    const total = b.endsAt - b.startMs;
    const pct = clamp(((now() - b.startMs) / total) * 100, 0, 100);
    const left = Math.max(0, Math.ceil((b.endsAt - now()) / 1000));
    // Deep (Studio) builds show name · type · tier; legacy builds show their tags.
    const title = b.deep && b.name ? escapeHtml(b.name) : b.type;
    const meta = b.deep
      ? `${b.type} · ${(TECH_TIERS[b.cfg.tier] || TECH_TIERS.standard).label}`
      : `${BUDGETS[b.budget].label} · ${QUALITIES[b.quality].label} · ${PRICINGS[b.pricing].label}`;
    return `
      <div class="tc-build" data-build="${b.type}">
        <div class="tc-build-top"><b>${title}</b><span class="muted">${meta}</span></div>
        <div class="tc-progress"><div class="tc-progress-fill" style="width:${pct}%"></div></div>
        <div class="tc-build-left"><span data-buildleft="${b.type}">${left > 0 ? formatDuration(left) + ' left' : 'Finishing…'}</span></div>
      </div>`;
  }

  function productRowHTML(id, p) {
    const inc = productIncome(id, p);
    const shr = productShare(id, p);
    const h = clamp(p.health, 0, 100);
    const title = (p.name && p.name !== p.type) ? p.name : p.type;
    const sub = `${(p.name && p.name !== p.type) ? p.type + ' · ' : ''}${starStr(p.rating)} · ${shr.toFixed(1)}% share`;
    return `
      <div class="tc-prod">
        <button class="tc-prod-main" data-tcact="proddetail" data-pid="${p.pid}">
          <div class="tc-prod-name">${escapeHtml(title)}${p.phys ? ' <span class="tc-tag">physical</span>' : ''}</div>
          <div class="tc-prod-sub">${sub}</div>
          <div class="tc-health"><div class="tc-health-fill ${healthClass(h)}" style="width:${h}%"></div></div>
        </button>
        <div class="tc-prod-right">
          <div class="tc-prod-inc">${formatMoney(inc)}<small>/day</small></div>
          <button class="btn tc-update" data-tcact="update" data-pid="${p.pid}" ${co(id).cash >= updateCost(id, p) ? '' : 'disabled'}>Update · ${formatMoney(updateCost(id, p))}</button>
        </div>
      </div>`;
  }

  /* ----------------------- Product Studio (wizard) ------------------------- */

  const escapeHtml = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escapeAttr = (v) => escapeHtml(v).replace(/"/g, '&quot;');
  const qualityWord = (q) => q < 25 ? 'Rough' : q < 45 ? 'Decent' : q < 65 ? 'Good' : q < 82 ? 'Great' : 'Exceptional';

  function defaultLaunch(id) {
    const cat = catalogFor(id);
    const firstFree = cat.find((row) => !isTypeBusy(id, row[0])) || cat[0];
    return { step: 0, cfg: studioDefault(id, firstFree[0]) };
  }

  function wizardSummary(id, cfg) {
    const cq = computeQuality(id, cfg);
    const arch = archetypeOf(cfg.type), tier = TECH_TIERS[cfg.tier] || TECH_TIERS.standard;
    const pricing = PRICINGS[tierToPricing(cfg.tier)] || PRICINGS.balanced;
    const projIncome = baseIncome(id) * (0.02 + cq.quality / 100 * 0.24) * pricing.incomeFactor * researchMult(id);
    const projPrice = arch.basePrice * tier.priceMult * (0.8 + 0.4 * cq.specScore);
    return { cq, arch, tier, cost: deepBuildCost(id, cfg), secs: deepBuildTime(id, cfg), projIncome, projPrice, projUnits: projPrice > 0 ? projIncome / projPrice : 0 };
  }

  const STUDIO_STEPS = ['Basics', 'Specs', 'Budget', 'Team', 'Review'];

  function wizardHTML(id) {
    const l = dash.launch, cfg = l.cfg, s = wizardSummary(id, cfg), afford = co(id).cash >= s.cost;
    const q = s.cq.quality;
    const body = [studioBasics, studioSpecs, studioBudget, studioTeam, studioReview][l.step](id, cfg, s);
    const steps = STUDIO_STEPS.map((name, i) => {
      const cls = i === l.step ? 'on' : i < l.step ? 'done' : '';
      return `<div class="tc-wiz-dot ${cls}"><span>${i < l.step ? '✓' : i + 1}</span><small>${name}</small></div>`;
    }).join('<div class="tc-wiz-sep"></div>');
    return `
      <div class="tc-wizard-page">
        <div class="tc-wiz-topbar">
          <button class="icon-btn" data-studio="back" aria-label="Back">‹</button>
          <div class="tc-wiz-title">
            <div class="tc-wiz-co">${companyName(id)}</div>
            <b>Product Studio</b>
          </div>
          <button class="icon-btn" data-studio="exit" aria-label="Close">✕</button>
        </div>
        <div class="tc-wiz-steps">${steps}</div>
        <div class="tc-wiz-summary">
          <div class="tc-wiz-q-top"><span>Projected quality</span><b>${Math.round(q)} · ${qualityWord(q)}</b></div>
          <div class="tc-bar"><div class="tc-bar-fill ${q > 65 ? 'good' : q > 40 ? 'alt' : 'warn'}" style="width:${q}%"></div></div>
          <div class="tc-wiz-metrics">
            <div><span>Est. cost</span><b class="${afford ? 'gold' : 'down'}">${formatMoney(s.cost)}</b></div>
            <div><span>Build time</span><b>${formatDuration(s.secs)}</b></div>
            <div><span>~ Income/day</span><b>${formatMoney(s.projIncome)}</b></div>
          </div>
        </div>
        <div class="tc-wiz-body">${body}</div>
        <div class="tc-wiz-nav">
          ${l.step > 0 ? `<button class="btn tc-wiz-back" data-studio="back">‹ Back</button>` : ''}
          ${l.step < 4
            ? `<button class="btn btn-gold btn-wide" data-studio="next">Next ›</button>`
            : `<button class="btn btn-gold btn-wide" data-studio="build" ${afford ? '' : 'disabled'}>${afford ? '🚀 Build & Release' : 'Not enough company cash'}</button>`}
        </div>
      </div>`;
  }

  function studioBasics(id, cfg, s) {
    const cat = catalogFor(id);
    const types = cat.map(([name, phys]) => {
      const busy = isTypeBusy(id, name), unlocked = co(id).unlocked.some((r) => r[0] === name);
      return `<button class="tc-type ${cfg.type === name ? 'on' : ''}" data-studio="type" data-val="${escapeAttr(name)}" ${busy ? 'disabled' : ''}>${name}${phys ? ' <span class="tc-tag">physical</span>' : ''}${unlocked ? ' <span class="tc-tag gold">flagship</span>' : ''}${busy ? ' <span class="muted">· live</span>' : ''}</button>`;
    }).join('');
    const tiers = Object.keys(TECH_TIERS).map((t) =>
      `<button class="tc-chip ${cfg.tier === t ? 'on' : ''}" data-studio="tier" data-val="${t}">${TECH_TIERS[t].label}</button>`).join('');
    return `
      <div class="tc-field-label">Product type <span class="muted">${s.arch.category}</span></div>
      <div class="tc-type-grid">${types}</div>
      <div class="tc-field-label">Product name</div>
      <input id="studioName" class="tc-name-input" type="text" maxlength="28" value="${escapeAttr(cfg.name)}" placeholder="Name your product" autocomplete="off">
      <div class="tc-field-label">Tier</div>
      <div class="tc-chip-row tc-tier-row">${tiers}</div>
      ${tierDetailHTML(cfg.tier)}`;
  }

  /** In-depth breakdown of the selected tier — what it means for the product. */
  function tierDetailHTML(tierId) {
    const t = TECH_TIERS[tierId] || TECH_TIERS.standard;
    const pos = (v) => (v > 0 ? '+' : '') + Math.round(v * 100) + '%';
    const reach = t.volume >= 1.3 ? 'Very wide' : t.volume >= 1.05 ? 'Wide' : t.volume >= 0.85 ? 'Balanced' : t.volume >= 0.6 ? 'Selective' : 'Exclusive';
    const brand = t.brand >= 3 ? 'Halo lift' : t.brand >= 1 ? 'Positive' : t.brand === 0 ? 'Neutral' : 'Slight drag';
    const cell = (label, val, cls = '') => `<div class="tc-tierstat"><span>${label}</span><b class="${cls}">${val}</b></div>`;
    return `
      <div class="tc-tier-detail">
        <div class="tc-tier-blurb">${t.blurb} · <span class="muted">for ${t.audience}</span></div>
        <div class="tc-tier-grid">
          ${cell('Unit price', '×' + t.priceMult.toFixed(2))}
          ${cell('Profit margin', pos(t.margin), t.margin >= 0 ? 'up' : 'down')}
          ${cell('Market reach', reach)}
          ${cell('Build cost', '×' + (t.costMult / 9).toFixed(2))}
          ${cell('Brand impact', brand)}
          ${cell('Positioning', t.label)}
        </div>
      </div>`;
  }

  function studioSpecs(id, cfg, s) {
    return `<p class="tc-hint">Choose each component. Higher-end parts raise quality and cost.</p>` +
      s.arch.specs.map((spec) => {
        const [sid, label, opts] = spec, cur = specIndex(cfg, sid);
        const chips = opts.map((o, i) =>
          `<button class="tc-chip ${cur === i ? 'on' : ''}" data-studio="spec" data-spec="${sid}" data-idx="${i}">${o[0]}</button>`).join('');
        return `<div class="tc-field-label">${label}</div><div class="tc-chip-row tc-spec-row">${chips}</div>`;
      }).join('');
  }

  function studioBudget(id, cfg) {
    return `<p class="tc-hint">Fund each area. More budget lifts quality but raises the build cost.</p>` +
      TECH_BUDGET_AREAS.map((a) => {
        const cur = cfg.budget[a.id] || 'standard';
        const chips = Object.keys(TECH_BUDGET_LEVELS).map((k) =>
          `<button class="tc-chip ${cur === k ? 'on' : ''}" data-studio="budget" data-area="${a.id}" data-val="${k}">${TECH_BUDGET_LEVELS[k].label}</button>`).join('');
        return `<div class="tc-field-label">${a.label}</div><div class="tc-chip-row">${chips}</div>`;
      }).join('');
  }

  function studioTeam(id, cfg) {
    return `<p class="tc-hint">Assign a team to each role. Bigger teams cost more; your company's staff (Staff tab) makes them more effective.</p>` +
      TECH_ROLES.map((role) => {
        const cur = cfg.team[role.id] || 'none';
        const chips = Object.keys(TECH_TEAM_LEVELS).map((k) =>
          `<button class="tc-chip ${cur === k ? 'on' : ''}" data-studio="team" data-role="${role.id}" data-val="${k}">${TECH_TEAM_LEVELS[k].label}</button>`).join('');
        return `<div class="tc-role"><div class="tc-role-head"><b>${role.label}</b><small>${role.desc}</small></div><div class="tc-chip-row">${chips}</div></div>`;
      }).join('');
  }

  function studioReview(id, cfg, s) {
    const specLines = s.arch.specs.map((sp) =>
      `<div class="tc-rev-row"><span>${sp[1]}</span><b>${sp[2][specIndex(cfg, sp[0])][0]}</b></div>`).join('');
    const team = TECH_ROLES.filter((r) => (cfg.team[r.id] || 'none') !== 'none');
    const teamLines = team.length
      ? team.map((r) => `<div class="tc-rev-row"><span>${r.label}</span><b>${TECH_TEAM_LEVELS[cfg.team[r.id]].label}</b></div>`).join('')
      : `<div class="tc-rev-row"><span>Team</span><b>None assigned</b></div>`;
    return `
      <div class="tc-rev-title">${escapeHtml(cfg.name || cfg.type)} <span class="tc-tag gold">${TECH_TIERS[cfg.tier].label}</span></div>
      <div class="tc-rev-sub">${cfg.type} · ${s.arch.category}</div>
      <div class="tc-section-label">Projected launch</div>
      <div class="tc-detail-grid">
        <div class="tc-dstat"><span>Quality</span><b>${Math.round(s.cq.quality)} / 100</b></div>
        <div class="tc-dstat"><span>~ ${s.arch.unit}/day</span><b>${formatNumber(s.projUnits, 0)}</b></div>
        <div class="tc-dstat"><span>~ Revenue/day</span><b>${formatMoney(s.projIncome)}</b></div>
        <div class="tc-dstat"><span>Unit price</span><b>${formatMoney(s.projPrice)}</b></div>
      </div>
      <div class="tc-section-label">Specifications</div>
      <div class="tc-rev-list">${specLines}</div>
      <div class="tc-section-label">Team</div>
      <div class="tc-rev-list">${teamLines}</div>`;
  }

  /* ------------------------- Product detail (sales) ------------------------ */

  function productDetailHTML(id) {
    const p = co(id).products.find((x) => x.pid === dash.detailPid);
    if (!p) return `<div class="tc-empty">Product not found.</div>`;
    const arch = archetypeOf(p.type), inc = productIncome(id, p), upd = unitsPerDay(id, p), h = clamp(p.health, 0, 100);
    const specLines = p.deep
      ? arch.specs.map((sp) => { const idx = Number.isInteger(p.specs[sp[0]]) ? p.specs[sp[0]] : 1; return `<div class="tc-rev-row"><span>${sp[1]}</span><b>${sp[2][idx][0]}</b></div>`; }).join('')
      : '';
    const team = p.deep ? TECH_ROLES.filter((r) => p.team && (p.team[r.id] || 'none') !== 'none') : [];
    const teamLines = team.map((r) => `<div class="tc-rev-row"><span>${r.label}</span><b>${TECH_TEAM_LEVELS[p.team[r.id]].label}</b></div>`).join('');
    return `
      <div class="tc-launch-head">
        <button class="icon-btn" data-tcact="closedetail" aria-label="Back">‹</button>
        <b>${escapeHtml(p.name || p.type)}</b>
      </div>
      <div class="tc-rev-sub">${p.type}${p.deep && TECH_TIERS[p.tier] ? ' · ' + TECH_TIERS[p.tier].label + ' · ' + arch.category : ''}</div>
      <div class="tc-detail-grid" style="margin-top:12px">
        <div class="tc-dstat"><span>Rating</span><b>${starStr(p.rating)}</b></div>
        <div class="tc-dstat"><span>Quality</span><b>${p.quality != null ? p.quality + '/100' : '—'}</b></div>
        <div class="tc-dstat"><span>Income / day</span><b class="up">${formatMoney(inc)}</b></div>
        <div class="tc-dstat"><span>Market share add</span><b>${productShare(id, p).toFixed(1)}%</b></div>
      </div>
      <div class="tc-section-label">Sales</div>
      <div class="tc-detail-grid">
        <div class="tc-dstat"><span>${arch.unit} / day</span><b>${formatNumber(upd, 0)}</b></div>
        <div class="tc-dstat"><span>Total ${arch.unit}</span><b>${formatNumber(p.unitsSold || 0, 0)}</b></div>
        <div class="tc-dstat"><span>Revenue (life)</span><b>${formatMoney(p.revenue || 0)}</b></div>
        <div class="tc-dstat"><span>Profit (life)</span><b class="up">${formatMoney(p.profit || 0)}</b></div>
      </div>
      <div class="tc-section-label">Product Health</div>
      <div class="tc-health tc-health-lg"><div class="tc-health-fill ${healthClass(h)}" style="width:${h}%"></div></div>
      <button class="btn btn-wide tc-update-wide" data-tcact="update" data-pid="${p.pid}" ${co(id).cash >= updateCost(id, p) ? '' : 'disabled'}>Update · restore health · ${formatMoney(updateCost(id, p))}</button>
      ${p.deep ? `<div class="tc-section-label">Specifications</div><div class="tc-rev-list">${specLines}</div>` : ''}
      ${teamLines ? `<div class="tc-section-label">Team</div><div class="tc-rev-list">${teamLines}</div>` : ''}
    `;
  }

  /* ------------------------------- Wiring ---------------------------------- */

  function wireDash() {
    const el = dash.el;
    el.querySelector('#tcClose').onclick = close;
    el.querySelectorAll('[data-tctab]').forEach((b) => b.onclick = () => {
      dash.launch = null; dash.detailPid = null; dash.rDetail = null;
      dash.tab = b.dataset.tctab; rebuildDash();
    });
    const body = el.querySelector('#tcBody');
    if (!body) return;

    body.querySelectorAll('[data-tcact]').forEach((b) => b.onclick = () => onAct(b.dataset.tcact, b.dataset));
    // Product Studio wizard controls + the product-name text input.
    body.querySelectorAll('[data-studio]').forEach((b) => b.onclick = () => { if (!b.disabled) onStudio(b.dataset); });
    const nameInput = body.querySelector('#studioName');
    if (nameInput) nameInput.oninput = (e) => { if (dash.launch) dash.launch.cfg.name = e.target.value; };
  }

  /** Wire the full-screen Product Studio page (no dashboard chrome present). */
  function wireWizard() {
    const el = dash.el;
    el.querySelectorAll('[data-studio]').forEach((b) => b.onclick = () => { if (!b.disabled) onStudio(b.dataset); });
    const nameInput = el.querySelector('#studioName');
    if (nameInput) nameInput.oninput = (e) => { if (dash.launch) dash.launch.cfg.name = e.target.value; };
  }

  /** Re-render the full-screen Product Studio page (keeps the user on it). */
  function refreshWizard() { dash.el.innerHTML = wizardHTML(dash.id); wireWizard(); }

  /** Leave the Studio and return to the Products tab. */
  function exitWizard() { dash.launch = null; dash.tab = 'products'; rebuildDash(); }

  /** Handle a click in the Product Studio wizard. */
  function onStudio(data) {
    const l = dash.launch; if (!l) return;
    const cfg = l.cfg, a = data.studio;
    if (a === 'exit')  { exitWizard(); return; }
    if (a === 'back')  { if (l.step > 0) { l.step--; refreshWizard(); } else exitWizard(); return; }
    if (a === 'next')  { if (l.step < 4) l.step++; refreshWizard(); return; }
    if (a === 'type')  { if (!isTypeBusy(dash.id, data.val)) { cfg.type = data.val; cfg.specs = {}; } refreshWizard(); return; }
    if (a === 'tier')  { cfg.tier = data.val; refreshWizard(); return; }
    if (a === 'spec')  { cfg.specs[data.spec] = Number(data.idx); refreshWizard(); return; }
    if (a === 'budget'){ cfg.budget[data.area] = data.val; refreshWizard(); return; }
    if (a === 'team')  { cfg.team[data.role] = data.val; refreshWizard(); return; }
    if (a === 'build') {
      const r = startDeepBuild(dash.id, cfg);
      if (r.ok) exitWizard();
      return;
    }
  }

  /** Open the deep research-project detail, seeding the team draft. */
  function openRDetail(id, kind, rid) {
    const c = rstate(id);
    let src = null;
    if (kind === 'cat') src = c.active.find((a) => a.cat === rid);
    else { const st = c.mass[rid]; if (st && st.endsAt) src = st; }
    const cfg = src ? { lead: src.lead || 0, sr: src.sr || 0, jr: src.jr || 0, priority: src.priority || 'normal' }
      : { lead: 0, sr: 0, jr: 0, priority: 'normal' };
    dash.rDetail = { kind, id: rid, cfg };
    refreshBody();
  }

  function refreshBody() {
    const body = dash.el.querySelector('#tcBody');
    if (body) { body.innerHTML = tabHTML(dash.id); wireDash(); }
  }

  function onAct(act, data) {
    const id = dash.id;
    if (act === 'newproduct')  { dash.detailPid = null; dash.launch = defaultLaunch(id); rebuildDash(); return; }
    if (act === 'proddetail')  { dash.detailPid = Number(data.pid); refreshBody(); return; }
    if (act === 'closedetail') { dash.detailPid = null; refreshBody(); return; }
    if (act === 'update') {
      const r = updateProduct(id, Number(data.pid));
      if (r.ok) rebuildDash();
      return;
    }
    if (act === 'hire')     { const r = hire(id, data.group);  if (!r.ok) toast(`⚠️ ${r.msg}`); return; }
    if (act === 'train')    { const r = train(id, data.group); if (!r.ok) toast(`⚠️ ${r.msg}`); return; }
    if (act === 'rbudget')  { setBudget(id, data.b); return; }
    if (act === 'rhire')    { const r = hireSci(id, data.role); if (!r.ok) toast(); return; }
    if (act === 'rcenter')  { const r = buildCenter(id, data.cid); if (r.ok) rebuildDash(); return; }
    if (act === 'rpartner') { const r = formPartner(id, data.pid); if (r.ok) rebuildDash(); return; }
    // Research project detail (deep management).
    if (act === 'ropen')    { openRDetail(id, data.kind, data.rid); return; }
    if (act === 'rclose')   { dash.rDetail = null; refreshBody(); return; }
    if (act === 'rassign')  { if (dash.rDetail) { const role = data.role, d = Number(data.delta); dash.rDetail.cfg[role] = Math.max(0, (dash.rDetail.cfg[role] || 0) + d); } refreshBody(); return; }
    if (act === 'rprio')    { if (dash.rDetail) dash.rDetail.cfg.priority = data.p; refreshBody(); return; }
    if (act === 'rstartcfg') { const r = startProject(id, data.rid, dash.rDetail.cfg); if (r.ok) { dash.rDetail = null; rebuildDash(); } return; }
    if (act === 'reditcfg')  { const r = editProject(id, data.rid, dash.rDetail.cfg); if (r.ok) { dash.rDetail = null; rebuildDash(); } return; }
    if (act === 'rmasscfg')  { const r = startMass(id, data.rid, dash.rDetail.cfg); if (r.ok) { dash.rDetail = null; rebuildDash(); } return; }
    // Signature (unique per-company operation).
    if (act === 'sigadv')    { const r = sigAdvanceLadder(id); if (!r.ok && r.msg) toast(`⚠️ ${r.msg}`); return; }
    if (act === 'sigstance') { sigSetStance(id, data.stance); return; }
    if (act === 'compete')  { const r = compete(id, data.comp); if (!r.ok) toast(`⚠️ ${r.msg}`); return; }
    if (act === 'strategy') { setStrategy(id, data.strat); return; }
    if (act === 'manu')     { const r = setManufacturing(id, data.mode); if (!r.ok) toast(`⚠️ ${r.msg}`); return; }
    if (act === 'region')   { const r = unlockRegion(id, data.region);   if (!r.ok) toast(`⚠️ ${r.msg}`); return; }
    if (act === 'acquire')  { const r = acquireRival(id, Number(data.idx)); if (!r.ok) toast(`⚠️ ${r.msg}`); return; }
    if (act === 'event')    { const r = resolveEvent(id, data.choice);   if (!r.ok) toast(`⚠️ ${r.msg}`); return; }
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
    const hsub = dash.el.querySelector('[data-hsub]');
    if (hsub) hsub.innerHTML = heroSub(s);
    set('[data-h="Net Profit / day"]', formatMoney(s.netProfitDay), s.netProfitDay >= 0 ? 'up' : 'down');
    set('[data-h="Cash"]', formatMoney(s.cash), s.cash < 0 ? 'down' : '');
    set('[data-h="Market Share"]', s.share.toFixed(1) + '%');
    set('[data-d="Revenue / day"]', formatMoney(s.revenueDay));
    set('[data-d="Payroll / day"]', formatMoney(s.payrollDay));
    set('[data-d="Active Products"]', String(s.activeProducts) + (s.buildsActive ? ' · ' + s.buildsActive + ' building' : ''));
    set('[data-d="Brand Reputation"]', Math.round(s.reputation) + '/100');
    set('[data-d="Customer Satisfaction"]', Math.round(s.satisfaction) + '/100');

    // Keep affordability of spend buttons fresh on the button-only tabs as cash
    // accrues (Staff / More have no sorted lists, so a soft rebuild is safe).
    if ((dash.tab === 'staff' || dash.tab === 'more' || dash.tab === 'signature') && !dash.launch) {
      const t = now();
      if (t - lastSoftRefresh > 2000) { lastSoftRefresh = t; refreshBody(); return; }
    }

    // Live market-share figure (Market tab).
    if (dash.tab === 'market' && !dash.launch) {
      const shEl = dash.el.querySelector('[data-share]');
      if (shEl) shEl.textContent = marketShare(id).toFixed(1) + '%';
    }

    // Live research progress in the open project detail.
    if (dash.tab === 'rnd' && dash.rDetail) {
      const c = rstate(id), rd = dash.rDetail;
      const src = rd.kind === 'cat' ? c.active.find((a) => a.cat === rd.id) : c.mass[rd.id];
      if (src && src.endsAt) {
        const pct = clamp(((now() - src.startMs) / (src.endsAt - src.startMs)) * 100, 0, 100);
        const fill = dash.el.querySelector('[data-rdfill]');
        if (fill) fill.style.width = pct + '%';
        const left = Math.max(0, Math.ceil((src.endsAt - now()) / 1000));
        const lt = dash.el.querySelector('[data-rdleft]');
        if (lt) lt.textContent = left > 0 ? formatDuration(left) + ' left' : 'Finishing…';
      }
      return;
    }

    // Live research progress bars + countdowns (Research tab).
    if (dash.tab === 'rnd' && !dash.launch) {
      const c = rstate(id);
      for (const a of c.active) {
        const row = dash.el.querySelector(`.tc-rproj[data-rproj="${a.cat}"]`);
        const total = a.endsAt - a.startMs, pct = clamp(((now() - a.startMs) / total) * 100, 0, 100);
        const fill = row && row.querySelector('.tc-progress-fill');
        if (fill) fill.style.width = pct + '%';
        const left = Math.max(0, Math.ceil((a.endsAt - now()) / 1000));
        const lt = dash.el.querySelector(`[data-rleft="${a.cat}"]`);
        if (lt) lt.textContent = left > 0 ? formatDuration(left) + ' left' : 'Finishing…';
      }
      const tree = treeOf(id);
      for (const m of (tree.mass || [])) {
        const st = c.mass[m.id];
        if (st && st.endsAt) {
          const left = Math.max(0, Math.ceil((st.endsAt - now()) / 1000));
          const lt = dash.el.querySelector(`[data-mleft="${m.id}"]`);
          if (lt) lt.textContent = left > 0 ? formatDuration(left) + ' left' : 'Finishing…';
        }
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
    baseIncome, snapshot, revenuePerDay, netProfitPerDay, marketShare, opexRate,
    startBuild, updateProduct, buildCost, updateCost, productIncome, productShare,
    rollReception, advance, ensureCompany, valuationTarget,
    // Phase 2 — staff, valuation:
    hire, train, hireCost, trainCost, payrollPerDay, groupEff,
    buildSpeedMult, shareMult, staffReceptionBonus,
    // Research meta-game:
    researchMult, researchReceptionBonus, researchQualityBonus, researchPriceMult,
    researchMarginBonus, researchCostCut, researchAgg, researchPower, researchCapacity,
    researchSpendPerDay, totalResearchLevels, catalogFor, treeOf,
    setBudget, hireSci, buildCenter, formPartner, startProject, startMass, editProject, resolveResearch,
    projectCost, projectDuration, availableSci, assignedRole, infraPower, projPower, PRIORITY,
    // Phase 3 — rivals, competitive share, rankings:
    shareIncomeMult, leaderMult, playerStrength, totalRivalStrength,
    innovationScore, compete, competeCost, playerRank, checkLeadership, evolveRivals,
    // Phase 4 — manufacturing, strategy, global, acquisition, events:
    hasManufacturing, manufacturingMult, setManufacturing, inhouseSetupCost,
    setStrategy, globalIncomeMult, globalOpexAdd, unlockRegion, regionCost,
    canAcquire, acquireCost, acquireRival, maybeRollEvent, resolveEvent, eventDef,
    // Signature — each company's unique operation:
    sigDef, sigAgg, sigAdvanceLadder, sigSetStance, ladderStepCost, sigEffectText,
    sigIncomeMult, sigMarginBonus, sigPriceMult, sigCostCut, sigShareMult, sigQualityBonus,
    // Product Studio (in-depth product design):
    computeQuality, deepBuildCost, deepBuildTime, startDeepBuild, studioDefault,
    archetypeOf, unitPriceOf, productMargin, unitsPerDay, scoreToReception, tierToPricing,
    // Config/data access for tests + future phases:
    CFG, BUDGETS, QUALITIES, PRICINGS, RECEPTIONS, STAFF, STAFF_CFG,
    COMPETE, RANK_CATS, RIVAL_CFG, LEADER_INCOME_BONUS, MANU, STRATEGIES, REGIONS, EVENTS,
    RESEARCH_SCI, RESEARCH_BUDGETS, RESEARCH_CENTERS, RESEARCH_PARTNERS,
    _state: (id) => co(id),
  };
})();
