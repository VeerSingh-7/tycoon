/* =========================================================================
 * storepage.js — Store Overview + Performance: one property's own page
 * -------------------------------------------------------------------------
 * Opened by tapping a property row in a Supermarket Chain's "Properties ·
 * X/16" list (js/businesses.js propertyOverviewHTML → BizDash.onClick).
 * Two views sharing one tab row:
 *   overview    — hero (storefrontSVG watermark, scrim, back button,
 *                 tenure chip, tap-to-navigate Health badge, title/
 *                 location), star rating, Manage button, Capacity ring
 *                 card, Weekly Traffic line-chart card
 *   performance — composite Health ring (avg of Satisfaction/Promotion/
 *                 Security category scores), a 4-way category switcher
 *                 (Satisfaction/Promotion/Security/Revenue), animated
 *                 metric bars, security equipment rows, and a Revenue
 *                 panel with an expenses accordion
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
  let nav = null; // { bizId, idx, view: 'overview'|'performance', cat: 'satisfaction', expensesOpen: false }

  const raf = typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame : (fn) => setTimeout(fn, 16);
  const escapeHtml = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const CAT_LABELS = [
    { id: 'satisfaction', label: 'Satisfaction' },
    { id: 'promotion', label: 'Promotion' },
    { id: 'security', label: 'Security' },
    { id: 'revenue', label: 'Revenue' },
  ];

  /* ------------------------------ Lifecycle ------------------------------ */

  function open(bizId, idx) {
    const def = BUSINESS_BY_ID[bizId];
    const resolved = def && typeof Businesses !== 'undefined' ? Businesses.resolveOwnedProperties(bizId)[idx] : null;
    if (!def || !resolved) return;
    nav = { bizId, idx, view: 'overview', cat: 'satisfaction', expensesOpen: false };
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
    return { def, biz, owned, metrics, companyName };
  }

  /* -------------------------------- Click --------------------------------- */

  function onClick(e) {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    const d = btn.dataset;

    if (d.storeNav === 'close') { close(); return; }
    if (d.storeNav === 'manage') { close(); return; } // BizDash's Manage Business screen is already open underneath
    if (d.storeNav === 'performance') { nav.view = 'performance'; render(); return; }
    if (d.storeView) { nav.view = d.storeView; render(); return; }
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
    const { def, owned, metrics, companyName } = c;
    const isPurchased = owned.raw.tenure === 'purchase';
    const stars = Math.round(metrics.health / 10) / 2; // 0-100 health -> 0-5 stars in 0.5 steps
    const reviewCount = 30 + Math.round(metrics.traffic.today / 3);

    return `
      <div class="store-hero">
        <div class="store-hero-art">${storefrontSVG(owned.property, owned.cityObj.name)}</div>
        <div class="store-hero-scrim"></div>
        <button class="icon-btn store-hero-close" data-store-nav="close" type="button" aria-label="Close">✕</button>
        <span class="store-chip">${isPurchased ? 'Owned' : 'Rented'}</span>
        <button class="store-health-badge" data-store-nav="performance" type="button" aria-label="View Performance">
          <span class="store-health-badge-num">${metrics.health}</span>
          <span class="store-health-badge-label">HEALTH</span>
        </button>
        <div class="store-hero-text">
          <div class="store-hero-title">${escapeHtml(companyName)}</div>
          <div class="store-hero-loc">${escapeHtml(owned.property.name)} · ${escapeHtml(owned.cityObj.name)}, ${escapeHtml(owned.country.name)}</div>
        </div>
      </div>

      <div class="store-rating-row">
        <span class="store-stars">${starsHTML(stars)}</span>
        <span class="store-rating-num">${stars.toFixed(1)}</span>
        <span class="store-rating-count">(${reviewCount} reviews)</span>
      </div>

      <button class="btn btn-wide store-manage-btn" data-store-nav="manage" type="button">Manage Business ›</button>

      ${tabRowHTML('overview')}

      <div class="store-body">
        ${capacityCardHTML(metrics)}
        ${trafficCardHTML(metrics)}
      </div>
    `;
  }

  function starsHTML(stars) {
    const full = Math.floor(stars);
    const half = stars - full >= 0.5;
    let out = '';
    for (let i = 0; i < 5; i++) out += i < full ? '★' : (i === full && half ? '⯪' : '☆');
    return out;
  }

  function tabRowHTML(active) {
    return `
      <div class="store-tab-row">
        <button class="store-tab ${active === 'overview' ? 'is-active' : ''}" data-store-view="overview" type="button">Overview</button>
        <button class="store-tab ${active === 'performance' ? 'is-active' : ''}" data-store-view="performance" type="button">Performance</button>
      </div>`;
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
            ${ringSVG(pct, 120, 12)}
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

  function trafficCardHTML(metrics) {
    const series = metrics.traffic.series;
    const w = 300, h = 110, pad = 8;
    const maxV = Math.max(...series) * 1.1;
    const minV = Math.min(...series) * 0.9;
    const stepX = (w - pad * 2) / (series.length - 1);
    const pts = series.map((v, i) => {
      const x = pad + i * stepX;
      const y = pad + (h - pad * 2) * (1 - (v - minV) / (maxV - minV || 1));
      return [x, y];
    });
    const linePath = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    const areaPath = linePath + ` L${pts[pts.length - 1][0].toFixed(1)},${h - pad} L${pts[0][0].toFixed(1)},${h - pad} Z`;
    const gridLines = [0.25, 0.5, 0.75].map((f) => `<line x1="${pad}" y1="${(pad + (h - pad * 2) * f).toFixed(1)}" x2="${w - pad}" y2="${(pad + (h - pad * 2) * f).toFixed(1)}" class="store-chart-grid"></line>`).join('');
    return `
      <div class="card">
        <div class="card-title">Weekly Traffic</div>
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
        <div class="store-traffic-legend">
          <span>Today <b>${metrics.traffic.today.toLocaleString()}</b></span>
          <span>Yesterday <b>${metrics.traffic.yesterday.toLocaleString()}</b></span>
        </div>
      </div>`;
  }

  /* ------------------------------ Performance ------------------------------ */

  function performanceHTML(c) {
    const { metrics, companyName } = c;
    return `
      <div class="bizd-head">
        <button class="icon-btn" data-store-nav="close" type="button" aria-label="Close">✕</button>
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

      ${tabRowHTML('performance')}

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
