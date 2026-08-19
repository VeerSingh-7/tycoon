/* =========================================================================
 * storepage.js — Store Overview + Performance: one property's own page
 * -------------------------------------------------------------------------
 * Opened by tapping a property row in a Supermarket Chain's "Properties ·
 * X/16" list (js/businesses.js propertyOverviewHTML → BizDash.onClick).
 * Two screens:
 *   overview    — hero (category-gradient watermark, scrim, frosted-glass
 *                 back button/tenure chip/Health badge, tap-to-navigate
 *                 Health badge, property name + type/location, secondary
 *                 owner caption), star rating, solid Manage button, a
 *                 4-pill Summary/Schedule/Inventory/Marketing tab row
 *   performance — composite Health ring (avg of Satisfaction/Promotion/
 *                 Security category scores), a 4-way category switcher
 *                 (Satisfaction/Promotion/Security/Revenue), animated
 *                 metric bars, security equipment rows, and a Revenue
 *                 panel with an expenses accordion — reached ONLY via the
 *                 hero's Health badge, its own back control returns to
 *                 Overview (not a full close)
 *
 * All the underlying numbers come from js/data/properties.js
 * propertyMetrics() — deterministic/seeded per property, no new persisted
 * state. This module is purely presentational + its own tiny nav state.
 *
 * Every animated bar/ring starts at 0 and is nudged to its real value one
 * frame later (double rAF — the DOM needs a layout pass at width:0 / a
 * full dashoffset before the CSS transition will actually animate the
 * change), re-triggered every time a view or category panel becomes
 * active, same idea as the World Map's own direct-DOM-patch conventions
 * elsewhere in this app.
 * ========================================================================= */

const StorePage = (() => {
  let el = null; // the .bizd-screen element this module owns, or null when closed
  let nav = null; // { bizId, idx, view: 'overview'|'performance', tab: 'summary', cat: 'satisfaction', expensesOpen: false }

  const raf = typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame : (fn) => setTimeout(fn, 16);
  const escapeHtml = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const CAT_LABELS = [
    { id: 'satisfaction', label: 'Satisfaction' },
    { id: 'promotion', label: 'Promotion' },
    { id: 'security', label: 'Security' },
    { id: 'revenue', label: 'Revenue' },
  ];

  const STORE_TABS = [
    { id: 'summary', label: 'Summary' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'marketing', label: 'Marketing' },
  ];

  /* ------------------------------ Lifecycle ------------------------------ */

  function open(bizId, idx) {
    const def = BUSINESS_BY_ID[bizId];
    const resolved = def && typeof Businesses !== 'undefined' ? Businesses.resolveOwnedProperties(bizId)[idx] : null;
    if (!def || !resolved) return;
    nav = { bizId, idx, view: 'overview', tab: 'summary', cat: 'satisfaction', expensesOpen: false };
    el = document.createElement('div');
    el.className = 'bizd-screen store-screen';
    el.addEventListener('click', onClick);
    document.body.appendChild(el);
    render();
  }

  function close() {
    if (!el) return;
    el.remove();
    el = null;
    nav = null;
  }

  /* current context, resolved fresh every render (properties/tenure can
   * change underneath — e.g. Buy It Outright from this same session) */
  function ctx() {
    const def = BUSINESS_BY_ID[nav.bizId];
    const biz = getBiz(nav.bizId);
    const owned = Businesses.resolveOwnedProperties(nav.bizId)[nav.idx];
    if (!def || !owned) return null;
    const metrics = propertyMetrics(owned.property, owned.cityObj.name, owned.storeIndex);
    const companyName = (biz.brand && biz.brand.companyName) || def.name;
    const typeLabel = biz.brand && biz.brand.storeType
      ? ((Businesses.STORE_TYPES.find((t) => t.id === biz.brand.storeType) || {}).label || def.name)
      : def.name;
    const category = def.chainIndex ? 'supermarket' : def.id;
    return { def, biz, owned, metrics, companyName, typeLabel, category };
  }

  /* -------------------------------- Click --------------------------------- */

  function onClick(e) {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    const d = btn.dataset;

    if (d.storeNav === 'close') { close(); return; } // fully exits back to BizDash's Manage screen
    if (d.storeNav === 'back') { nav.view = 'overview'; render(); return; } // Performance's own back -> Overview, stays open
    if (d.storeNav === 'manage') { close(); return; } // BizDash's Manage Business screen is already open underneath
    if (d.storeNav === 'performance') { nav.view = 'performance'; render(); return; }
    if (d.storeTab) { nav.tab = d.storeTab; render(); return; }
    if (d.storeCat) { nav.cat = d.storeCat; render(); return; }
    if (d.storeExpensesToggle !== undefined) { nav.expensesOpen = !nav.expensesOpen; patchExpenses(); return; }
  }

  /* ------------------------------- Render --------------------------------- */

  function render() {
    if (!el || !nav) return;
    const c = ctx();
    if (!c) { close(); return; } // property no longer resolvable (sold/edge case) — don't strand a broken screen open
    el.innerHTML = nav.view === 'performance' ? performanceHTML(c) : overviewHTML(c);
    animateIn();
  }

  /** Kicks every ring/bar in the freshly-drawn screen from 0 to its real
   *  value one frame later, so the fill is always seen animating in —
   *  matches the reference's animateBars() re-trigger-on-every-render
   *  behavior. */
  function animateIn() {
    raf(() => raf(() => {
      if (!el) return;
      el.querySelectorAll('[data-anim-w]').forEach((bar) => { bar.style.width = bar.dataset.animW + '%'; });
      el.querySelectorAll('[data-anim-ring]').forEach((ring) => { ring.style.strokeDashoffset = ring.dataset.animRing; });
    }));
  }

  /* -------------------------------- Overview ------------------------------- */

  function overviewHTML(c) {
    const { def, biz, owned, metrics, companyName, typeLabel, category } = c;
    const isPurchased = owned.raw.tenure === 'purchase';
    const stars = Math.round(metrics.health / 10) / 2; // 0-100 health -> 0-5 stars in 0.5 steps
    const reviewCount = 30 + Math.round(metrics.traffic.total / 3);

    return `
      <div class="store-hero">
        <div class="store-hero-art biz-logo-tile-${category}">
          <span class="store-hero-watermark" aria-hidden="true">${def.icon || '🏢'}</span>
        </div>
        <div class="store-hero-scrim"></div>
        <button class="store-hero-close" data-store-nav="close" type="button" aria-label="Close">✕</button>
        <span class="store-chip">${isPurchased ? 'Owned' : 'Rented'}</span>
        <button class="store-health-badge" data-store-nav="performance" type="button" aria-label="View Performance">
          <span class="store-health-badge-num">${metrics.health}</span>
          <span class="store-health-badge-label">HEALTH</span>
        </button>
        <div class="store-hero-text">
          <div class="store-hero-title">${escapeHtml(owned.property.name)}</div>
          <div class="store-hero-loc">${escapeHtml(typeLabel)} · ${escapeHtml(owned.cityObj.name)}, ${escapeHtml(owned.country.name)}</div>
        </div>
      </div>

      <div class="store-owner-caption">${escapeHtml(companyName)}</div>

      <div class="store-rating-row">
        <span class="store-stars">${starsHTML(stars)}</span>
        <span class="store-rating-num">${stars.toFixed(1)}</span>
        <span class="store-rating-count">(${reviewCount} reviews)</span>
      </div>

      <button class="store-manage-btn" data-store-nav="manage" type="button">Manage Business <span class="store-manage-arrow" aria-hidden="true">→</span></button>

      ${tabRowHTML(nav.tab)}

      <div class="store-body">
        ${storeTabBodyHTML(nav.tab, c)}
      </div>
    `;
  }

  /** Reusable star icon (fill/outline/half via a 50/50 gradient clip) — one
   *  shape reused 5x, replacing the old mixed Unicode glyphs (one of which
   *  rendered as an unrelated list icon in some fonts). */
  function starIconSVG(state) {
    const STAR_PATH = 'M12 2.5l2.9 6.06 6.6.79-4.86 4.6 1.27 6.55L12 17.9l-5.91 3.6 1.27-6.55-4.86-4.6 6.6-.79z';
    if (state === 'half') {
      return `<svg viewBox="0 0 24 24" class="store-star" aria-hidden="true">
        <defs><linearGradient id="storeStarHalfFill" x1="0" y1="0" x2="1" y2="0">
          <stop offset="50%" stop-color="currentColor"></stop>
          <stop offset="50%" stop-color="transparent"></stop>
        </linearGradient></defs>
        <path d="${STAR_PATH}" fill="url(#storeStarHalfFill)" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"></path>
      </svg>`;
    }
    return `<svg viewBox="0 0 24 24" class="store-star" aria-hidden="true">
      <path d="${STAR_PATH}" fill="${state === 'full' ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"></path>
    </svg>`;
  }

  function starsHTML(stars) {
    const full = Math.floor(stars);
    const half = stars - full >= 0.5;
    let out = '';
    for (let i = 0; i < 5; i++) out += starIconSVG(i < full ? 'full' : (i === full && half ? 'half' : 'empty'));
    return out;
  }

  /** Pill-style tab row — Summary/Schedule/Inventory/Marketing, Overview
   *  screen only. Performance is a separate page reached via the Health
   *  badge, not one of these tabs. */
  function tabRowHTML(active) {
    return `
      <div class="store-tab-row">
        ${STORE_TABS.map((t) => `<button class="store-tab ${active === t.id ? 'is-active' : ''}" data-store-tab="${t.id}" type="button">${t.label}</button>`).join('')}
      </div>`;
  }

  function storeTabBodyHTML(tab, c) {
    if (tab === 'schedule') return scheduleCardHTML(c);
    if (tab === 'inventory') return inventoryCardHTML(c);
    if (tab === 'marketing') return marketingCardHTML(c);
    return trafficCardHTML(c.metrics); // 'summary'
  }

  /** SVG ring gauge — a track circle plus a fill circle whose
   *  stroke-dasharray covers the full circumference and whose
   *  stroke-dashoffset is animated from "fully hidden" to the real value
   *  (see animateIn) via data-anim-ring. */
  function ringSVG(pct, size, stroke, extraClass) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const offset = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
    const cx = size / 2, cy = size / 2;
    return `
      <svg viewBox="0 0 ${size} ${size}" class="store-ring ${extraClass || ''}">
        <circle cx="${cx}" cy="${cy}" r="${r}" class="store-ring-track" stroke-width="${stroke}" fill="none"></circle>
        <circle cx="${cx}" cy="${cy}" r="${r}" class="store-ring-fill" stroke-width="${stroke}" fill="none"
          stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"
          stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${c.toFixed(2)}"
          data-anim-ring="${offset.toFixed(2)}"></circle>
      </svg>`;
  }

  function capacityCardHTML(metrics) {
    const { current, max } = metrics.capacity;
    const pct = max > 0 ? Math.round((current / max) * 100) : 0;
    let note = '';
    if (pct >= 90) note = `<div class="store-alert-inline">⚠ Near full capacity — footfall may be turning customers away at peak times.</div>`;
    else if (pct <= 30) note = `<div class="store-tip-inline">💡 Footfall is well under capacity — a local promotion could help fill the floor.</div>`;
    return `
      <div class="card">
        <div class="card-title">Capacity</div>
        <div class="store-ring-row">
          <div class="store-ring-wrap">
            ${ringSVG(pct, 120, 12, 'store-capacity-ring')}
            <div class="store-ring-center">
              <span class="store-ring-pct">${pct}%</span>
            </div>
          </div>
          <div class="store-capacity-legend">
            <div class="store-legend-row"><span class="store-legend-dot store-legend-dot-fill"></span>Current <b>${current}</b></div>
            <div class="store-legend-row"><span class="store-legend-dot store-legend-dot-track"></span>Max <b>${max}</b> / hr</div>
          </div>
        </div>
        ${note}
      </div>`;
  }

  /** Summary tab — Yesterday's Traffic: a single Total figure top-right and
   *  a 24-hour line/area chart below it, replacing the old 7-day chart. */
  function trafficCardHTML(metrics) {
    const hourly = metrics.traffic.hourly;
    const w = 300, h = 110, pad = 8;
    const maxV = Math.max.apply(null, hourly) * 1.15 || 1;
    const stepX = (w - pad * 2) / (hourly.length - 1);
    const pts = hourly.map((v, i) => {
      const x = pad + i * stepX;
      const y = pad + (h - pad * 2) * (1 - v / maxV);
      return [x, y];
    });
    const linePath = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    const areaPath = linePath + ` L${pts[pts.length - 1][0].toFixed(1)},${h - pad} L${pts[0][0].toFixed(1)},${h - pad} Z`;
    const gridLines = [0.25, 0.5, 0.75].map((f) => `<line x1="${pad}" y1="${(pad + (h - pad * 2) * f).toFixed(1)}" x2="${w - pad}" y2="${(pad + (h - pad * 2) * f).toFixed(1)}" class="store-chart-grid"></line>`).join('');
    return `
      <div class="card">
        <div class="store-traffic-head">
          <div class="card-title">Yesterday's Traffic</div>
          <div class="store-traffic-total"><span class="store-traffic-total-label">Total</span><span class="store-traffic-total-val">${metrics.traffic.total.toLocaleString()}</span></div>
        </div>
        <svg viewBox="0 0 ${w} ${h}" class="store-traffic-chart" preserveAspectRatio="none">
          <defs>
            <linearGradient id="storeTrafficFade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--chart-fill-top)"></stop>
              <stop offset="100%" stop-color="var(--chart-fill-bot)"></stop>
            </linearGradient>
          </defs>
          ${gridLines}
          <path d="${areaPath}" fill="url(#storeTrafficFade)" stroke="none"></path>
          <path d="${linePath}" fill="none" stroke="var(--gold)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"></path>
        </svg>
      </div>`;
  }

  /** Schedule tab — real operating hours for this property's tier, plus
   *  staffing (chain-wide, since staff isn't tracked per-property). */
  function scheduleCardHTML(c) {
    const { def, biz, owned } = c;
    const tier = STORE_TIERS[owned.storeIndex];
    const cap = maxStaff(def);
    const pct = cap > 0 ? Math.min(100, Math.round((biz.staff / cap) * 100)) : 0;
    return `
      <div class="card">
        <div class="card-title">Operating Hours</div>
        <div class="store-sched-hours">${escapeHtml(tier.hours)}</div>
        <div class="store-sched-sub">7 days a week</div>
      </div>
      <div class="card">
        <div class="card-title">Chain Staffing</div>
        <div class="store-metric-row">
          <div class="store-metric-label">Staff on Payroll</div>
          <div class="store-metric-bar-track"><div class="store-metric-bar-fill" data-anim-w="${pct}" style="width:0%"></div></div>
          <div class="store-metric-val">${biz.staff}/${cap}</div>
        </div>
        <div class="store-sched-sub">Shared across every property in this chain, not tracked per-store.</div>
      </div>`;
  }

  /** Inventory tab — the property's real amenities (from its store tier)
   *  plus the same Capacity ring shown as a floor/footfall stat. */
  function inventoryCardHTML(c) {
    const { owned, metrics } = c;
    const tier = STORE_TIERS[owned.storeIndex];
    return `
      <div class="card">
        <div class="card-title">Amenities</div>
        <div class="store-amenity-list">
          ${tier.amenities.map((a) => `<div class="store-amenity-row"><span class="store-amenity-dot"></span>${escapeHtml(a)}</div>`).join('')}
        </div>
      </div>
      ${capacityCardHTML(metrics)}`;
  }

  /** Marketing tab — a condensed snapshot distinct from Performance's
   *  Promotion category (which already breaks Local Marketing/Loyalty/
   *  Social Reach out as three bars): one headline score, a qualitative
   *  read, and a pointer to the full breakdown rather than repeating it. */
  function marketingCardHTML(c) {
    const p = c.metrics.promotion;
    const tierLabel = p.score >= 70 ? 'Strong' : p.score >= 45 ? 'Developing' : 'Minimal';
    const channels = [['Local Marketing', p.localMarketing], ['Loyalty Program', p.loyaltyProgram], ['Social Reach', p.socialReach]];
    channels.sort((a, b) => b[1] - a[1]);
    const strongest = channels[0];
    return `
      <div class="card store-mkt-card">
        <div class="card-title">Marketing Snapshot</div>
        <div class="store-mkt-score-row">
          <span class="store-mkt-score">${p.score}%</span>
          <span class="store-mkt-tier">${tierLabel} presence</span>
        </div>
        <div class="store-mkt-note">Strongest channel: <b>${escapeHtml(strongest[0])}</b> (${strongest[1]}%). Full breakdown is on the Performance page, under Promotion.</div>
      </div>`;
  }

  /* ------------------------------ Performance ------------------------------ */

  function performanceHTML(c) {
    const { metrics, companyName } = c;
    return `
      <div class="bizd-head">
        <button class="icon-btn" data-store-nav="back" type="button" aria-label="Back to Overview">✕</button>
        <div class="bizd-id">
          <div class="bizd-co-name">${escapeHtml(companyName)}</div>
          <div class="bizd-co-sub">Performance</div>
        </div>
      </div>

      <div class="store-health-hero">
        <div class="store-ring-wrap store-health-ring-wrap">
          ${ringSVG(metrics.health, 160, 14, 'store-health-ring')}
          <div class="store-ring-center">
            <span class="store-health-hero-num">${metrics.health}</span>
            <span class="store-health-hero-label">Health Score</span>
          </div>
        </div>
      </div>

      <div class="store-cat-tabs">
        ${CAT_LABELS.map((cat) => `<button class="store-cat-tab ${nav.cat === cat.id ? 'is-active' : ''}" data-store-cat="${cat.id}" type="button">${cat.label}</button>`).join('')}
      </div>

      <div class="store-cat-panel">
        ${catPanelHTML(nav.cat, metrics)}
      </div>
    `;
  }

  function catPanelHTML(cat, metrics) {
    if (cat === 'promotion') return metricBarsHTML(metrics.promotion, [
      ['localMarketing', 'Local Marketing'], ['loyaltyProgram', 'Loyalty Program'], ['socialReach', 'Social Reach'],
    ]);
    if (cat === 'security') return securityPanelHTML(metrics.security);
    if (cat === 'revenue') return revenuePanelHTML(metrics.revenue);
    return metricBarsHTML(metrics.satisfaction, [
      ['customerService', 'Customer Service'], ['pricing', 'Pricing'], ['interior', 'Interior'], ['cleanliness', 'Cleanliness'],
    ]);
  }

  function metricBarsHTML(cat, fields) {
    const rows = fields.map(([key, label]) => `
      <div class="store-metric-row">
        <div class="store-metric-label">${label}</div>
        <div class="store-metric-bar-track"><div class="store-metric-bar-fill" data-anim-w="${cat[key]}" style="width:0%"></div></div>
        <div class="store-metric-val">${cat[key]}%</div>
      </div>`).join('');
    return `<div class="card">${rows}</div>`;
  }

  function securityPanelHTML(sec) {
    return `
      <div class="card">
        <div class="store-sec-item">
          <span class="store-sec-label">CCTV Cameras</span>
          <span class="store-sec-val ${sec.cctvOwned >= sec.cctvTotal ? 'store-sec-val-good' : ''}">${sec.cctvOwned}/${sec.cctvTotal}</span>
        </div>
        <div class="store-sec-item">
          <span class="store-sec-label">Door Alarm</span>
          <span class="store-sec-val ${sec.doorAlarmOwned >= sec.doorAlarmTotal ? 'store-sec-val-good' : ''}">${sec.doorAlarmOwned}/${sec.doorAlarmTotal}</span>
        </div>
        <div class="store-sec-item">
          <span class="store-sec-label">Security Guard</span>
          <span class="store-sec-val ${sec.guardAssigned ? 'store-sec-val-good' : ''}">${sec.guardAssigned ? 'Assigned' : 'Not Assigned'}</span>
        </div>
      </div>`;
  }

  function revenuePanelHTML(rev) {
    const profitClass = rev.netProfit >= 0 ? 'up' : 'down';
    return `
      <div class="card">
        <div class="store-rev-summary">
          <div><span class="muted">Monthly Revenue</span><b class="gold">${formatMoney(rev.monthly)}</b></div>
          <div><span class="muted">Net Profit</span><b class="${profitClass}">${formatMoney(rev.netProfit)}</b></div>
        </div>
        <button class="store-rev-expand" data-store-expenses-toggle type="button">
          <span>Expenses · ${formatMoney(rev.totalExpenses)}</span>
          <span class="store-rev-chevron">⌄</span>
        </button>
        <div class="store-rev-body" id="storeRevBody">
          ${rev.expenses.map((e) => `<div class="store-rev-row"><span>${escapeHtml(e.label)}</span><b>${formatMoney(e.amount)}</b></div>`).join('')}
        </div>
      </div>`;
  }

  /** Toggling the expenses accordion is a direct DOM patch (matches this
   *  app's established convention of not re-rendering for a pure
   *  open/close state change) — height/opacity transition on .store-rev-body
   *  plus a chevron rotation, no bar/ring re-animation needed. */
  function patchExpenses() {
    if (!el) return;
    const body = el.querySelector('#storeRevBody');
    const btn = el.querySelector('[data-store-expenses-toggle]');
    if (body) body.classList.toggle('is-open', nav.expensesOpen);
    if (btn) btn.classList.toggle('is-open', nav.expensesOpen);
  }

  /** Test-only hook: current nav state, since it's otherwise a private
   *  closure variable — lets tests verify state-level behavior (e.g. the
   *  expenses accordion toggling) even where the test harness's mock DOM
   *  can't meaningfully run real querySelector/classList. */
  function _state() { return nav ? Object.assign({}, nav) : null; }

  return { open, close, _state };
})();
