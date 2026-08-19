/* =========================================================================
 * storepage.js — Store Overview + Performance: one property's own page
 * -------------------------------------------------------------------------
 * Direct port of design-reference store-pages-reworked.html's #store and
 * #perf views — same structure/markup, same CSS custom properties, same
 * icon symbol library (see ICON_SPRITE), same switchView()/switchCat()/
 * toggleExpenses()/animateBars() behavior — translated into this app's own
 * component format (store-* classes, data-store-* attributes routed
 * through BizDash's existing click-delegation convention) and wired to
 * real per-property data instead of the reference's placeholder numbers.
 *
 * Opened by tapping a property row in a Supermarket Chain's "Properties ·
 * X/16" list (js/businesses.js propertyOverviewHTML → BizDash.onClick).
 * Two screens, one StorePage instance per open() call:
 *   overview    — hero (fixed gradient + i-store watermark + scrim, frosted
 *                 back button/tenure chip, health badge inline with the
 *                 title), star rating, solid Manage button, a
 *                 Summary/Schedule/Inventory/Marketing pill tab row; the
 *                 Summary tab itself is Capacity -> Yesterday's Traffic ->
 *                 the health summary card (ring + status + description,
 *                 see healthSummaryCardHTML — shared with Performance so
 *                 both places render the exact same component)
 *   performance — opens straight into the Satisfaction/Promotion/Security/
 *                 Revenue category switcher, all four panels, and the
 *                 Expenses Breakdown accordion (no health summary at its
 *                 top anymore — that now lives in Summary) — reached via
 *                 the hero's Health badge OR by scrolling Summary, its own
 *                 back control returns to Overview for the SAME property
 *                 (matches the reference's switchView() intent)
 *
 * All the underlying numbers come from js/data/properties.js
 * propertyMetrics() — deterministic/seeded per property, no new persisted
 * state. This module is purely presentational + its own tiny nav state.
 *
 * Every animated bar/ring starts at 0 and is nudged to its real value one
 * frame later (double rAF — the DOM needs a layout pass at width:0 / a
 * full dashoffset before the CSS transition will actually animate the
 * change), re-triggered every time a view or category panel becomes
 * active — matches the reference's animateBars() re-trigger-on-every-
 * switch behavior.
 * ========================================================================= */

const StorePage = (() => {
  let el = null; // the .bizd-screen element this module owns, or null when closed
  let nav = null; // { bizId, idx, view: 'overview'|'performance', tab: 'summary', cat: 'satisfaction', expensesOpen: false }

  const raf = typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame : (fn) => setTimeout(fn, 16);
  const escapeHtml = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /* --------------------------- Icon symbol library -------------------------- */
  /* Verbatim from store-pages-reworked.html's <defs> — only the symbols this
   * page actually uses. Re-embedded at the top of every render (el.innerHTML
   * is fully replaced each time, so there's no id-collision risk). */
  const ICON_SPRITE = `<svg style="display:none">
    <defs>
      <symbol id="i-chevron-left" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></symbol>
      <symbol id="i-star" viewBox="0 0 24 24"><path d="M12 3l2.6 5.9 6.4.6-4.8 4.3 1.4 6.3L12 16.9 6.4 20.1l1.4-6.3L3 9.5l6.4-.6L12 3z"/></symbol>
      <symbol id="i-alert" viewBox="0 0 24 24"><path d="M12 4L2 20h20L12 4z"/><line x1="12" y1="10" x2="12" y2="15"/><circle cx="12" cy="18" r="0.8" fill="currentColor" stroke="none"/></symbol>
      <symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="7.5" r="0.8" fill="currentColor" stroke="none"/></symbol>
      <symbol id="i-arrow-right" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></symbol>
      <symbol id="i-store" viewBox="0 0 24 24"><path d="M4 9l1-5h14l1 5"/><path d="M4 9v11h16V9"/><path d="M9 20v-6h6v6"/><path d="M4 9c0 1.4 1.1 2.5 2.5 2.5S9 10.4 9 9c0 1.4 1.1 2.5 2.5 2.5S14 10.4 14 9c0 1.4 1.1 2.5 2.5 2.5S19 10.4 19 9"/></symbol>
      <symbol id="i-smile" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="1" fill="currentColor" stroke="none"/><path d="M8 14c1.2 1.6 2.8 2.4 4 2.4s2.8-.8 4-2.4"/></symbol>
      <symbol id="i-chat" viewBox="0 0 24 24"><path d="M4 5h16v11H9l-4 4V5z"/></symbol>
      <symbol id="i-tag" viewBox="0 0 24 24"><path d="M20 12l-8 8-9-9V4h7l10 8z"/><circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none"/></symbol>
      <symbol id="i-home" viewBox="0 0 24 24"><path d="M4 11l8-6 8 6"/><path d="M6 10v9h12v-9"/></symbol>
      <symbol id="i-check-shield" viewBox="0 0 24 24"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/><path d="M9 12l2 2 4-4"/></symbol>
      <symbol id="i-megaphone" viewBox="0 0 24 24"><path d="M3 10v4h3l6 4V6L6 10H3z"/><path d="M14 9a4 4 0 0 1 0 6"/></symbol>
      <symbol id="i-trending" viewBox="0 0 24 24"><polyline points="3,17 9,11 13,15 21,7"/><polyline points="15,7 21,7 21,13"/></symbol>
      <symbol id="i-target" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.3"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></symbol>
      <symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/></symbol>
      <symbol id="i-camera" viewBox="0 0 24 24"><rect x="3" y="8" width="14" height="10" rx="2"/><path d="M17 11l4-2v8l-4-2"/><circle cx="10" cy="13" r="2.4"/></symbol>
      <symbol id="i-door" viewBox="0 0 24 24"><rect x="6" y="3" width="12" height="18" rx="1"/><circle cx="15" cy="12" r="1" fill="currentColor" stroke="none"/></symbol>
      <symbol id="i-wallet" viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M16.5 12h3.5v3h-3.5a1.5 1.5 0 0 1 0-3z"/></symbol>
      <symbol id="i-chevron-down" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></symbol>
    </defs>
  </svg>`;

  /** <svg class="store-icon [extraCls]"><use href="#id"/></svg> — extraCls
   *  layers on top of the base .store-icon rule the same way the
   *  reference's descendant selectors (.stars .icon, .card-title .icon,
   *  etc.) layer on top of its shared .icon base class. */
  function iconUse(id, extraCls) {
    return `<svg class="${extraCls ? 'store-icon ' + extraCls : 'store-icon'}" aria-hidden="true"><use href="#${id}"></use></svg>`;
  }

  const CAT_META = [
    { id: 'satisfaction', label: 'Satisfaction', icon: 'i-smile' },
    { id: 'promotion', label: 'Promotion', icon: 'i-megaphone' },
    { id: 'security', label: 'Security', icon: 'i-shield' },
    { id: 'revenue', label: 'Revenue', icon: 'i-wallet' },
  ];

  const STORE_TABS = [
    { id: 'summary', label: 'Summary' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'marketing', label: 'Marketing' },
  ];

  /** red/amber/green by value — the reference's own metric coloring
   *  (0% -> red, ~40-65% -> amber, ~75-100% -> green) applied as one
   *  consistent rule across every bar/badge on the Performance page. */
  function scoreColorVar(v) { return v < 35 ? 'var(--red)' : v < 70 ? 'var(--amber)' : 'var(--green)'; }
  function scoreSoftVar(v) { return v < 35 ? 'var(--red-soft)' : v < 70 ? 'var(--amber-soft)' : 'var(--green-soft)'; }

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
    const typeLabel = biz.brand && biz.brand.storeType
      ? ((Businesses.STORE_TYPES.find((t) => t.id === biz.brand.storeType) || {}).label || def.name)
      : def.name;
    return { def, biz, owned, metrics, typeLabel };
  }

  /* -------------------------------- Click --------------------------------- */

  function onClick(e) {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    const d = btn.dataset;

    if (d.storeNav === 'close') { close(); return; } // fully exits back to BizDash's Manage screen
    if (d.storeNav === 'back') { nav.view = 'overview'; render(); return; } // Performance's own back -> Overview, same property, stays open
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

  /** Matches the reference's animateBars(scope): every bar/ring in the
   *  freshly-drawn screen starts at 0 and is nudged to its real value one
   *  frame later (double rAF so the 0-state actually paints first). */
  function animateIn() {
    raf(() => raf(() => {
      if (!el) return;
      el.querySelectorAll('[data-anim-w]').forEach((bar) => { bar.style.width = bar.dataset.animW + '%'; });
      el.querySelectorAll('[data-anim-ring]').forEach((ring) => { ring.style.strokeDashoffset = ring.dataset.animRing; });
    }));
  }

  /* -------------------------------- Overview ------------------------------- */

  function overviewHTML(c) {
    const { def, owned, metrics, typeLabel } = c;
    const isPurchased = owned.raw.tenure === 'purchase';
    const starsCount = Math.max(0, Math.min(5, Math.round(metrics.health / 20)));
    const ratingNote = starsCount === 0
      ? 'New listing — ratings build over time'
      : (30 + Math.round(metrics.traffic.total / 3)).toLocaleString() + ' reviews';

    return `
      ${ICON_SPRITE}
      <div class="store-hero">
        <div class="store-hero-watermark">${iconUse('i-store')}</div>
        <div class="store-hero-scrim"></div>
        <button class="store-hero-close" data-store-nav="close" type="button" aria-label="Close">${iconUse('i-chevron-left')}</button>
        <span class="store-chip">${isPurchased ? 'OWNED' : 'RENTED'}</span>
        <div class="store-hero-content">
          <div>
            <div class="store-hero-title">${escapeHtml(owned.property.name)}</div>
            <div class="store-hero-loc">${escapeHtml(typeLabel)} · ${escapeHtml(owned.cityObj.name)}, ${escapeHtml(owned.country.name)}</div>
          </div>
          <button class="store-health-badge" data-store-nav="performance" type="button" aria-label="View Performance">
            <span class="store-health-badge-num">${metrics.health}%</span>
            <span class="store-health-badge-label">HEALTH</span>
          </button>
        </div>
      </div>

      <div class="store-rating-row">
        <div class="store-stars">${starsHTML(starsCount)}</div>
        <div class="store-rating-note">${ratingNote}</div>
      </div>

      <button class="store-manage-btn" data-store-nav="manage" type="button">Manage Business ${iconUse('i-arrow-right')}</button>

      ${tabRowHTML(nav.tab)}

      <div class="store-body">
        ${storeTabBodyHTML(nav.tab, c)}
      </div>
    `;
  }

  /** Fixed count of filled/outline i-star icons (0-5) — matches the
   *  reference's own star-building loop exactly, just driven by a real
   *  health-derived count instead of a hardcoded 3/5. */
  function starsHTML(count) {
    let out = '';
    for (let i = 0; i < 5; i++) out += iconUse('i-star', i < count ? 'is-filled' : '');
    return out;
  }

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
    return capacityCardHTML(c.metrics) + trafficCardHTML(c.metrics) + healthSummaryCardHTML(c.metrics); // 'summary'
  }

  /** SVG ring gauge — a track circle plus a fill circle whose
   *  stroke-dasharray covers the full circumference and whose
   *  stroke-dashoffset is animated from "fully hidden" to the real value
   *  (see animateIn) via data-anim-ring. colorVar is applied inline (like
   *  the reference's own inline stroke colors) so the same markup can
   *  drive a fixed blue ring (Capacity) or a status-colored one (Health). */
  function ringSVG(pct, size, r, stroke, colorVar, extraClass) {
    const c = 2 * Math.PI * r;
    const offset = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
    const cx = size / 2, cy = size / 2;
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="store-ring ${extraClass || ''}">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" class="store-ring-track" stroke-width="${stroke}"></circle>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${colorVar}" stroke-width="${stroke}"
          stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"
          stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${c.toFixed(2)}"
          data-anim-ring="${offset.toFixed(2)}"></circle>
      </svg>`;
  }

  function capacityCardHTML(metrics) {
    const { current, max } = metrics.capacity;
    const pct = max > 0 ? Math.round((current / max) * 100) : 0;
    let note = '';
    if (pct >= 90) {
      note = `<div class="store-alert-inline">${iconUse('i-alert')}<div><div class="store-alert-txt">${current} customers this hour</div><div class="store-alert-sub">Near full capacity — footfall may be turning customers away</div></div></div>`;
    } else if (pct <= 30) {
      note = `<div class="store-tip-inline">${iconUse('i-info')}<div class="store-alert-txt">Footfall is well under capacity — a local promotion could help fill the floor</div></div>`;
    }
    return `
      <div class="store-section-divider"><div class="store-section-dot"></div><div class="store-section-label">Hourly Capacity</div></div>
      <div class="store-card">
        <div class="store-capacity-top">
          <div class="store-ring-wrap">
            ${ringSVG(pct, 88, 38, 8, 'var(--blue)', 'store-capacity-ring')}
            <div class="store-ring-center"><div class="store-ring-num">${current}</div><div class="store-ring-den">/ ${max} HR</div></div>
          </div>
          <div class="store-capacity-legend">
            <div class="store-legend-row"><span class="store-legend-dot store-legend-dot-fill"></span>Current <span class="muted">— ${current} customers/hour</span></div>
            <div class="store-legend-row"><span class="store-legend-dot store-legend-dot-track"></span>Building max <span class="muted">— ${max} customers/hour</span></div>
          </div>
        </div>
        ${note}
      </div>`;
  }

  /** Summary tab — Yesterday's Traffic: a single Total figure and a 24-hour
   *  line/area chart (var(--muted) line/fill, matching the reference
   *  exactly), plus a real busiest-hour footer note in the reference's
   *  footer-note slot. */
  function trafficCardHTML(metrics) {
    const hourly = metrics.traffic.hourly;
    const w = 300, h = 80;
    const maxV = Math.max.apply(null, hourly) * 1.1 || 1;
    const stepX = w / (hourly.length - 1);
    const pts = hourly.map((v, i) => [i * stepX, h - (v / maxV) * (h - 6)]);
    const linePath = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    const areaPath = linePath + ` L${pts[pts.length - 1][0].toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z`;

    let peakIdx = 0;
    for (let i = 1; i < hourly.length; i++) if (hourly[i] > hourly[peakIdx]) peakIdx = i;
    const peakHour = peakIdx === 0 ? '12 AM' : peakIdx === 12 ? '12 PM' : peakIdx > 12 ? (peakIdx - 12) + ' PM' : peakIdx + ' AM';

    return `
      <div class="store-section-divider"><div class="store-section-dot"></div><div class="store-section-label">Yesterday's Traffic</div></div>
      <div class="store-card">
        <div class="store-traffic-head">
          <div class="store-traffic-sub">Customers per hour</div>
          <div class="store-traffic-total"><div class="store-traffic-total-val">${metrics.traffic.total.toLocaleString()}</div><div class="store-traffic-total-label">TOTAL</div></div>
        </div>
        <svg class="store-traffic-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
          <defs><linearGradient id="storeTrafficFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--muted)" stop-opacity="0.18"></stop><stop offset="100%" stop-color="var(--muted)" stop-opacity="0"></stop></linearGradient></defs>
          <line x1="0" y1="20" x2="${w}" y2="20" class="store-chart-grid"></line>
          <line x1="0" y1="50" x2="${w}" y2="50" class="store-chart-grid"></line>
          <path d="${areaPath}" fill="url(#storeTrafficFade)"></path>
          <path d="${linePath}" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round"></path>
        </svg>
        <div class="store-footer-note">Busiest around ${peakHour} — ${hourly[peakIdx].toLocaleString()} customers</div>
      </div>`;
  }

  /** Schedule tab — real operating hours for this property's tier, plus
   *  staffing (chain-wide, since staff isn't tracked per-property). The
   *  reference doesn't define this tab's content (it's an inert pill in
   *  the mockup) — built here using its own section-divider + card
   *  language for visual consistency with Summary. */
  function scheduleCardHTML(c) {
    const { def, biz, owned } = c;
    const tier = STORE_TIERS[owned.storeIndex];
    const cap = maxStaff(def);
    const pct = cap > 0 ? Math.min(100, Math.round((biz.staff / cap) * 100)) : 0;
    return `
      <div class="store-section-divider"><div class="store-section-dot"></div><div class="store-section-label">Operating Hours</div></div>
      <div class="store-card">
        <div class="store-sched-hours">${escapeHtml(tier.hours)}</div>
        <div class="store-sched-sub">7 days a week</div>
      </div>
      <div class="store-section-divider"><div class="store-section-dot"></div><div class="store-section-label">Staffing</div></div>
      <div class="store-card">
        <div class="store-metric-row">
          <div class="store-metric-head"><div class="store-metric-label">Staff on Payroll</div><div class="store-metric-val">${biz.staff}/${cap}</div></div>
          <div class="store-metric-bar-track"><div class="store-metric-bar-fill" data-anim-w="${pct}" style="background:var(--blue);"></div></div>
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
      <div class="store-section-divider"><div class="store-section-dot"></div><div class="store-section-label">Amenities</div></div>
      <div class="store-card">
        <div class="store-amenity-list">
          ${tier.amenities.map((a) => `<div class="store-amenity-row"><span class="store-amenity-dot"></span>${escapeHtml(a)}</div>`).join('')}
        </div>
      </div>
      ${capacityCardHTML(metrics)}`;
  }

  /** Marketing tab — a condensed snapshot distinct from Performance's
   *  Promotion category (which already breaks Traffic Index/Marketing out
   *  as their own bars): one headline score, a qualitative read, and a
   *  pointer to the full breakdown rather than repeating it. */
  function marketingCardHTML(c) {
    const p = c.metrics.promotion;
    const tierLabel = p.score >= 70 ? 'Strong' : p.score >= 45 ? 'Developing' : 'Minimal';
    return `
      <div class="store-section-divider"><div class="store-section-dot"></div><div class="store-section-label">Marketing Snapshot</div></div>
      <div class="store-card">
        <div class="store-mkt-score-row">
          <span class="store-mkt-score">${p.score}%</span>
          <span class="store-mkt-tier">${tierLabel} presence</span>
        </div>
        <div class="store-mkt-note">Traffic Index <b>${p.trafficIndex}%</b> · Marketing spend <b>${p.marketing}%</b>. Full breakdown is on the Performance page, under Promotion.</div>
      </div>`;
  }

  /* ------------------------------ Performance ------------------------------ */

  /** Status tier for the health hero — thresholds chosen so the
   *  reference's own example (health 32 -> amber "Needs Attention") lands
   *  correctly; not literally specified in the reference beyond that one
   *  data point. */
  function healthStatus(health) {
    if (health < 30) return { label: 'Critical', colorVar: 'var(--red)' };
    if (health < 65) return { label: 'Needs Attention', colorVar: 'var(--amber)' };
    return { label: 'Performing Well', colorVar: 'var(--green)' };
  }

  /** Real equivalent of the reference's hardcoded health-copy description —
   *  names whichever of Satisfaction/Promotion/Security is actually
   *  dragging this property down (or says so if none are). */
  function healthDescHTML(metrics) {
    const cats = [
      { label: 'low satisfaction', score: metrics.satisfaction.score },
      { label: 'weak promotion', score: metrics.promotion.score },
      { label: 'no strong security coverage', score: metrics.security.score },
    ].sort((a, b) => a.score - b.score);
    const weak = cats.filter((c) => c.score < 50).slice(0, 2);
    if (weak.length === 0) return 'Satisfaction, promotion, and security are all holding up well — this store is performing solidly across the board.';
    const names = weak.map((c) => c.label);
    const joined = names.length === 2 ? names[0] + ' and ' + names[1] : names[0];
    const capped = joined.charAt(0).toUpperCase() + joined.slice(1);
    return `${capped} ${names.length === 2 ? 'are' : 'is'} dragging this store down — start with staffing.`;
  }

  /** The health hero — ring + status label + one-line reason. Lives on the
   *  Summary tab (below Yesterday's Traffic); Performance opens straight
   *  into the category switcher instead of repeating it. Kept as its own
   *  function so the health badge's tap-through to Performance and this
   *  inline card can never drift out of sync with each other. */
  function healthSummaryCardHTML(metrics) {
    const status = healthStatus(metrics.health);
    return `
      <div class="store-section-divider"><div class="store-section-dot"></div><div class="store-section-label">Health Score</div></div>
      <div class="store-health-hero">
        <div class="store-ring-wrap store-health-ring-wrap">
          ${ringSVG(metrics.health, 104, 44, 9, status.colorVar, 'store-health-ring')}
          <div class="store-ring-center"><div class="store-ring-num store-health-ring-num">${metrics.health}%</div><div class="store-ring-den store-health-ring-den">SCORE</div></div>
        </div>
        <div class="store-health-copy">
          <div class="store-health-status" style="color:${status.colorVar};">${status.label}</div>
          <div class="store-health-desc">${healthDescHTML(metrics)}</div>
        </div>
      </div>`;
  }

  function performanceHTML(c) {
    const { metrics, owned } = c;
    return `
      ${ICON_SPRITE}
      <div class="bizd-head">
        <button class="store-perf-back" data-store-nav="back" type="button" aria-label="Back to Overview">${iconUse('i-chevron-left')}</button>
        <div class="bizd-id">
          <div class="bizd-co-name">${escapeHtml(owned.property.name)}</div>
          <div class="bizd-co-sub">Performance Overview</div>
        </div>
      </div>

      <div class="store-cat-tabs">
        ${CAT_META.map((cat) => `<button class="store-cat-tab ${nav.cat === cat.id ? 'is-active' : ''}" data-store-cat="${cat.id}" type="button">${iconUse(cat.icon)} ${cat.label}</button>`).join('')}
      </div>

      <div class="store-cat-panel">
        ${catPanelHTML(nav.cat, metrics)}
      </div>
    `;
  }

  function catPanelHTML(cat, metrics) {
    if (cat === 'promotion') return promotionPanelHTML(metrics.promotion);
    if (cat === 'security') return securityPanelHTML(metrics.security);
    if (cat === 'revenue') return revenuePanelHTML(metrics.revenue);
    return satisfactionPanelHTML(metrics.satisfaction);
  }

  function metricRowHTML(icon, label, val) {
    const color = scoreColorVar(val);
    return `
      <div class="store-metric-row">
        <div class="store-metric-head"><div class="store-metric-label">${iconUse(icon)} ${label}</div><div class="store-metric-val" style="color:${color};">${val}%</div></div>
        <div class="store-metric-bar-track"><div class="store-metric-bar-fill" data-anim-w="${val}" style="background:${color};"></div></div>
      </div>`;
  }

  function satisfactionPanelHTML(sat) {
    const rows = [
      ['i-smile', 'Satisfaction', sat.score],
      ['i-chat', 'Customer Service', sat.customerService],
      ['i-tag', 'Pricing', sat.pricing],
      ['i-home', 'Interior', sat.interior],
      ['i-check-shield', 'Cleanliness', sat.cleanliness],
    ];
    return `<div class="store-card">
      <div class="store-card-title-row"><div class="store-card-title">${iconUse('i-smile')} Satisfaction</div></div>
      ${rows.map(([icon, label, val]) => metricRowHTML(icon, label, val)).join('')}
    </div>`;
  }

  function promotionPanelHTML(promo) {
    const rows = [
      ['i-megaphone', 'Promotion', promo.score],
      ['i-trending', 'Traffic Index', promo.trafficIndex],
      ['i-target', 'Marketing', promo.marketing],
    ];
    return `<div class="store-card">
      <div class="store-card-title-row"><div class="store-card-title">${iconUse('i-megaphone')} Promotion</div></div>
      ${rows.map(([icon, label, val]) => metricRowHTML(icon, label, val)).join('')}
    </div>`;
  }

  function securityPanelHTML(sec) {
    const color = scoreColorVar(sec.score);
    const soft = scoreSoftVar(sec.score);
    const items = [
      ['i-camera', 'CCTV Cameras', sec.cctvOwned, sec.cctvTotal],
      ['i-door', 'Door Alarms', sec.doorAlarmOwned, sec.doorAlarmTotal],
    ];
    const alert = !sec.guardAssigned
      ? `<div class="store-sec-alert">${iconUse('i-alert')}<span>Security equipment can't be operated because no Security Guard is assigned.</span></div>`
      : '';
    return `<div class="store-card">
      <div class="store-card-title-row">
        <div class="store-card-title">${iconUse('i-shield')} Security</div>
        <div class="store-card-badge" style="background:${soft}; color:${color};">${sec.score}%</div>
      </div>
      <div class="store-metric-bar-track" style="margin-bottom:16px;"><div class="store-metric-bar-fill" data-anim-w="${sec.score}" style="background:${color};"></div></div>
      ${items.map(([icon, label, owned, total]) => `<div class="store-sec-item"><div class="store-sec-icon">${iconUse(icon)}</div><div class="store-sec-label">${label}</div><div class="store-sec-count">${owned}/${total}</div></div>`).join('')}
      ${alert}
    </div>`;
  }

  function revenuePanelHTML(rev) {
    return `<div class="store-card">
      <div class="store-card-title-row"><div class="store-card-title">${iconUse('i-wallet')} Revenue</div></div>
      <div class="store-rev-amount">${formatMoney(rev.monthly)}</div>
      <button class="store-rev-expand" data-store-expenses-toggle type="button">
        <span class="store-rev-expand-label">${iconUse('i-trending')} Expenses Breakdown</span>
        ${iconUse('i-chevron-down', 'store-rev-chevron')}
      </button>
      <div class="store-rev-body" id="storeRevBody">
        ${rev.expenses.map((e) => `<div class="store-rev-row"><span>${escapeHtml(e.label)}</span><span>${formatMoney(e.amount)}</span></div>`).join('')}
      </div>
    </div>`;
  }

  /** Toggling the expenses accordion is a direct DOM patch (matches the
   *  reference's own toggleExpenses(), and this app's established
   *  convention of not re-rendering for a pure open/close state change). */
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
