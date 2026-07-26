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
    if (root[id]) return root[id];
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
    return co;
  }

  function co(id) { return ensureCompany(id); }

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

  /** A live product's income contribution ($/in-game day), scaled by pricing
   *  and its current health. */
  function productIncome(id, p) {
    const pr = PRICINGS[p.pricing];
    return baseIncome(id) * p.incomeFrac * pr.incomeFactor * (Math.max(0, p.health) / 100);
  }

  /** A live product's market-share contribution (percentage points). */
  function productShare(id, p) {
    const pr = PRICINGS[p.pricing];
    return p.shareBase * pr.shareFactor * (Math.max(0, p.health) / 100);
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
    let rev = baseIncome(id); // baseline operations
    for (const p of c.products) rev += productIncome(id, p);
    return rev;
  }
  function netProfitPerDay(id) {
    const rev = revenuePerDay(id);
    return rev - rev * CFG.OPEX;
  }
  function marketShare(id) {
    const c = co(id);
    let s = c.baseShare;
    for (const p of c.products) s += productShare(id, p);
    return clamp(s, 0.5, 95);
  }

  function snapshot(id) {
    const c = co(id);
    return {
      value: marketCap(id),
      netProfitDay: netProfitPerDay(id),
      cash: c.cash,
      share: marketShare(id),
      revenueDay: revenuePerDay(id),
      employees: c.employees,
      activeProducts: c.products.length,
      reputation: c.reputation,
      satisfaction: c.satisfaction,
      baseIncomeDay: baseIncome(id),
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

    // 2) Age products / accrue cash over the in-game days elapsed.
    let days = (t - c.lastMs) / (CFG.DAY_SECONDS * 1000);
    c.lastMs = t;
    if (days > 0) {
      days = Math.min(days, CFG.MAX_ACCRUE_DAYS);
      // Cash from net profit over the window (uses current product set — close
      // enough; products change on the scale of minutes, cash accrues smoothly).
      c.cash += netProfitPerDay(id) * days;
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
  }

  function completeBuild(id, b) {
    const c = co(id);
    const reception = rollReception(b);
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
    const d = def(id);
    const catItem = d.catalog.find((row) => row[0] === opts.type);
    if (!catItem) return { ok: false, msg: 'Unknown product.' };
    if (isTypeBusy(id, opts.type)) return { ok: false, msg: `${opts.type} is already live or in development.` };
    const cost = buildCost(id, opts.budget);
    if (c.cash < cost) return { ok: false, msg: `Need ${formatMoney(cost)} in company cash.` };
    c.cash -= cost;
    const secs = QUALITIES[opts.quality].seconds;
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
    { id: 'rnd',      label: 'R&D' },
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
          ${detStat('Employees', formatNumber(s.employees, 0))}
          ${detStat('Active Products', String(s.activeProducts))}
          ${detStat('Brand Reputation', Math.round(s.reputation) + '/100')}
          ${detStat('Customer Satisfaction', Math.round(s.satisfaction) + '/100')}
          ${detStat('Base Income / day', formatMoney(s.baseIncomeDay))}
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
      case 'staff':    return placeholderHTML('Staff', '👥', 'Hire Engineering, Marketing and Operations teams and train them for quality — coming in the next phase.');
      case 'rnd':      return placeholderHTML('R&D', '🔬', `Research ${def(id).rnd.slice(0, 2).join(', ')} and more to unlock new product types and multipliers — coming soon.`);
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
    const d = def(id);
    const firstFree = d.catalog.find((row) => !isTypeBusy(id, row[0]));
    return { type: firstFree ? firstFree[0] : d.catalog[0][0], budget: 'standard', quality: 'standard', pricing: 'balanced' };
  }

  function oddsWord(l) {
    const score = BUDGETS[l.budget].score + QUALITIES[l.quality].score; // 0..4
    return ['Long shot', 'Modest odds', 'Fair odds', 'Good odds', 'Great odds'][score];
  }

  function launchHTML(id) {
    const d = def(id), l = dash.launch, c = co(id);
    const cost = buildCost(id, l.budget);
    const secs = QUALITIES[l.quality].seconds;
    const projInc = baseIncome(id) * 0.09 * PRICINGS[l.pricing].incomeFactor; // "Solid"-tier preview
    const afford = c.cash >= cost;
    const chip = (act, key, cur, map) => Object.keys(map).map((k) =>
      `<button class="tc-chip ${cur === k ? 'on' : ''}" data-tcset="${act}" data-val="${k}">${map[k].label}</button>`).join('');
    const catalogBtns = d.catalog.map(([name, phys]) => {
      const busy = isTypeBusy(id, name);
      return `<button class="tc-type ${l.type === name ? 'on' : ''}" data-tctype="${name}" ${busy ? 'disabled' : ''}>
        ${name}${phys ? ' <span class="tc-tag">physical</span>' : ''}${busy ? ' <span class="muted">· live</span>' : ''}</button>`;
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
    set('[data-d="Active Products"]', String(s.activeProducts));
    set('[data-d="Brand Reputation"]', Math.round(s.reputation) + '/100');
    set('[data-d="Customer Satisfaction"]', Math.round(s.satisfaction) + '/100');

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

  return {
    isManaged, open, close, tick, applyOffline,
    // Engine/economy (also used by tests):
    baseIncome, snapshot, revenuePerDay, netProfitPerDay, marketShare,
    startBuild, updateProduct, buildCost, updateCost, productIncome, productShare,
    rollReception, advance, ensureCompany,
    // Config/data access for tests + future phases:
    CFG, BUDGETS, QUALITIES, PRICINGS, RECEPTIONS,
    _state: (id) => co(id),
  };
})();
