/* =========================================================================
 * businesses.js — Business tab: header, world map teaser, business cards
 * -------------------------------------------------------------------------
 * Fully data-driven from BUSINESS_DEFS. Cards come in three flavours:
 *   locked     — player level too low ("Unlocks at Level N")
 *   available  — can be started (needs money + a free business slot)
 *   owned      — level/income/staff/mechanic/upgrades/sell
 *
 * Two entry points sit above the list as a compact stat-panel toggle:
 * "My Businesses" (owned only) and "Purchasable" (the full catalog, same
 * three-flavour cards as before). Tapping either filters the list below
 * (listMode) and highlights that panel (.is-active) — a UI-only filter,
 * not persisted, reset on every mount().
 *
 * The World Map card is a wide hero-image card (background-image slot via
 * WORLD_MAP_IMAGE_URL, currently unset — falls back to a solid fill + a
 * centered icon). Opening it shows an actual 1:1, full-bleed, pannable AND
 * ZOOMABLE world map (img/map/world-map.svg — real country borders,
 * MIT-licensed, see CREDITS.md), fetched once and cached in memory.
 * Panning is just native scroll (the SVG renders wider than the viewport);
 * zoom changes that CSS width directly (mapWidthVw) via pinch or the +/-
 * buttons, with the touch/click point kept anchored under your
 * finger/cursor (setMapWidth's scroll-offset math) instead of drifting.
 * Tapping a country highlights it (.is-selected) and shows a small info
 * box next to the tap point with its name + a few DETERMINISTIC-BUT-FAKE
 * stats (countryInfoFor — seeded off the country code, so the same
 * country always shows the same numbers) — there's no real per-country
 * business data yet, this is intentionally just a placeholder for now.
 *
 * IMPORTANT: the map view's render() is idempotent (mapRenderState) —
 * ui.js re-renders the whole Business tab every ~500ms for the list's
 * mechanic countdowns, and re-injecting the ~1.2MB inline SVG on every one
 * of those ticks was destroying + recreating the fullscreen overlay that
 * often, which restarted its fadeIn animation each time and made the
 * bottom nav visibly flash through the momentarily-transparent overlay.
 * The map's own DOM is only touched when what it should show actually
 * changes (open/close, or the fetch finishing) — never on a plain timer
 * tick. Zooming, panning, selecting/deselecting a country and the info box
 * are all direct DOM writes for the same reason — none of them call
 * render() or touch the SVG's innerHTML.
 *
 * Events use DELEGATION on the container so the 2x/sec re-render (needed for
 * mechanic countdowns) never orphans listeners.
 * ========================================================================= */

const Businesses = (() => {
  let container;
  let listMode = 'all'; // 'all' | 'mine' — which businesses the list below shows
  let mapOpen = false;  // World Map overlay
  let mapRenderState = null; // null | 'loading' | 'loaded' — what's actually in the DOM for the map right now
  let openMenuId = null; // id of the owned business whose ⋮ menu is open (Sell), or null
  let worldMapSvg = null;    // fetched img/map/world-map.svg markup, cached once loaded
  let worldMapFetching = false;
  let countryNames = {};     // ISO code -> readable name, parsed from the fetched SVG's hidden label layer

  // The map's own aspect ratio (viewBox 1000 x 507.209 — a wide equirectangular
  // projection) doesn't match a phone's tall portrait screen, so a naive
  // "fit to width" zoomed-out state leaves a band of empty space above/below
  // the map. mapZoomMinVw/mapZoomMaxVw are computed per-device (see
  // computeMapZoomBounds) so "fully zoomed out" instead COVERS the whole
  // screen (like CSS object-fit:cover) — no blank space on any edge, ever,
  // at any zoom level from there up.
  const MAP_ASPECT = 507.209 / 1000; // svg intrinsic height/width
  let mapZoomMinVw = 350;  // recomputed by computeMapZoomBounds() every time the map opens
  let mapZoomMaxVw = 2200; // recomputed alongside it (a fixed multiple of the min, device-adaptive)
  let mapWidthVw = mapZoomMinVw; // current zoom level (the SVG's CSS width, in vw units)
  let pinchStartDist = null;
  let pinchStartWidthVw = null;
  let pinchRAF = null;      // requestAnimationFrame handle coalescing touchmove bursts
  let pinchPending = null;  // { targetVw, midX, midY } for the next coalesced frame
  let selectedCountryEl = null;   // the <g> currently highlighted, or null
  let selectedCountryCode = null; // its ISO code, or null

  // Set this to an image URL/path later to show a real photo behind the
  // World Map hero card. Left null for now — the card falls back to a
  // solid --bg-mid fill with a centered icon so it never looks broken.
  const WORLD_MAP_IMAGE_URL = null;

  const MAP_ICON = `<svg viewBox="0 0 40 40" class="hub-logo-svg" aria-hidden="true">
        <circle cx="17" cy="20" r="12" fill="currentColor" fill-opacity="0.15" stroke="currentColor" stroke-width="2.4"/>
        <path d="M5 20 L29 20" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M17 8 C22 13 22 27 17 32 C12 27 12 13 17 8 Z" fill="none" stroke="currentColor" stroke-width="1.6"/>
        <path d="M30 10 C34.5 10 38 13.5 38 18 C38 23.5 30 33 30 33 C30 33 22 23.5 22 18 C22 13.5 25.5 10 30 10 Z"
          fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`;

  // My Businesses: a small skyline — the businesses you already own.
  const NAV_ICON_MINE = `<svg viewBox="0 0 24 24" class="biz-nav-icon-svg" aria-hidden="true">
        <rect x="3" y="10" width="5" height="11" rx="1" fill="none" stroke="currentColor" stroke-width="1.8"/>
        <rect x="9.5" y="5" width="5" height="16" rx="1" fill="none" stroke="currentColor" stroke-width="1.8"/>
        <rect x="16" y="13" width="5" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`;

  // Purchasable: a catalog grid — everything you could start.
  const NAV_ICON_OWN = `<svg viewBox="0 0 24 24" class="biz-nav-icon-svg" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1.3" fill="none" stroke="currentColor" stroke-width="1.8"/>
        <rect x="14" y="3" width="7" height="7" rx="1.3" fill="none" stroke="currentColor" stroke-width="1.8"/>
        <rect x="3" y="14" width="7" height="7" rx="1.3" fill="none" stroke="currentColor" stroke-width="1.8"/>
        <rect x="14" y="14" width="7" height="7" rx="1.3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`;

  // Vertical "⋮" kebab — opens the per-card Sell menu on an owned business.
  const DOTS_ICON = `<svg viewBox="0 0 4 16" class="biz-menu-dots-svg" aria-hidden="true">
        <circle cx="2" cy="2" r="1.6" fill="currentColor"/>
        <circle cx="2" cy="8" r="1.6" fill="currentColor"/>
        <circle cx="2" cy="14" r="1.6" fill="currentColor"/></svg>`;

  /** A stylized (not survey-accurate) world map silhouette for the World Map
   *  placeholder page — hand-drawn continent blobs on a lat/long grid, all
   *  monochrome so it themes with dark/light like every other icon. */
  const WORLD_MAP_SVG = `
    <svg viewBox="0 0 360 180" class="biz-world-map-svg" aria-hidden="true">
      <g stroke="var(--border)" stroke-width="1">
        <line x1="0" y1="45" x2="360" y2="45"/>
        <line x1="0" y1="90" x2="360" y2="90"/>
        <line x1="0" y1="135" x2="360" y2="135"/>
        <line x1="90" y1="0" x2="90" y2="180"/>
        <line x1="180" y1="0" x2="180" y2="180"/>
        <line x1="270" y1="0" x2="270" y2="180"/>
      </g>
      <g fill="currentColor" fill-opacity="0.55">
        <path d="M40,15 C60,8 90,10 110,20 C130,28 135,45 125,55 C115,65 100,60 90,68
          C80,78 75,95 65,100 C55,90 50,75 45,60 C35,55 25,45 20,35 C22,25 30,18 40,15 Z"/>
        <path d="M100,75 C115,70 130,78 135,95 C140,115 130,140 115,155
          C105,150 95,135 92,115 C90,100 92,85 100,75 Z"/>
        <path d="M175,20 C190,15 205,18 212,28 C215,38 205,45 195,48
          C185,50 175,45 172,35 C170,28 172,23 175,20 Z"/>
        <path d="M180,55 C200,48 220,52 228,70 C235,90 232,115 220,140
          C210,155 195,150 188,135 C180,115 175,95 178,75 C179,68 178,60 180,55 Z"/>
        <path d="M215,15 C240,8 270,10 295,20 C315,28 330,35 335,48
          C330,58 315,55 300,60 C285,65 270,60 255,65 C240,68 225,60 215,50 C208,40 210,25 215,15 Z"/>
        <path d="M295,105 C310,100 325,105 330,115 C332,122 325,130 315,132
          C305,133 295,128 292,120 C291,115 292,108 295,105 Z"/>
      </g>
    </svg>`;

  function mount(el) {
    container = el;
    container.addEventListener('click', onClick);
    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    listMode = 'all';
    mapOpen = false;
    mapRenderState = null;
    openMenuId = null;
    render();
  }

  /* ------------------------- Event delegation ------------------------- */

  function onClick(e) {
    // The map screen owns every click while open: the close/zoom buttons
    // first, then anything else is treated as a country/ocean tap.
    if (mapOpen) {
      const mapBtn = e.target.closest('button');
      if (mapBtn && !mapBtn.disabled) {
        const md = mapBtn.dataset;
        if (md.bizNav === 'closeMap') { mapOpen = false; clearCountrySelection(); render(); return; }
        if (md.mapZoom) { zoomStep(md.mapZoom === 'in' ? 1 : -1); return; }
      }
      handleCountryClick(e);
      return;
    }

    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    const d = btn.dataset;
    let changed = false;

    if (d.bizNav === 'map') {
      mapOpen = true;
      computeMapZoomBounds();
      mapWidthVw = mapZoomMinVw; // open fully zoomed out (covering the screen, no blank space)
      selectedCountryEl = null;
      selectedCountryCode = null;
      fetchWorldMap();
      render();
      return;
    }
    if (d.bizNav === 'all' || d.bizNav === 'mine') { listMode = d.bizNav; render(); return; }
    if (d.bizMenu !== undefined) { openMenuId = openMenuId === d.bizMenu ? null : d.bizMenu; render(); return; }

    if (d.manage) { if (typeof BizDash !== 'undefined') BizDash.open(d.manage); return; }
    else if (d.buy) changed = buyBusinessLevel(d.buy);
    else if (d.upgrade) changed = buyBusinessUpgrade(d.biz, d.upgrade);
    else if (d.hire) changed = hireStaff(d.hire);
    else if (d.sell) {
      const def = BUSINESS_BY_ID[d.sell];
      const refund = SELL_REFUND_RATE * businessSpentOnLevels(def);
      const ok = confirm(`Sell ${def.name} for ${formatMoney(refund)}? This frees a business slot but resets its progress.`);
      openMenuId = null;
      if (ok) changed = sellBusiness(d.sell);
      else render(); // close the menu even when the sale is cancelled
    } else if (d.mechAction) {
      changed = Mechanics.action(d.biz, d.mechAction, d.arg);
      if (changed) saveGame();
    }

    if (changed) {
      UI.renderBalance();
      render();
    }
  }

  /* ------------------------------ Render ------------------------------ */

  /** The map view's own DOM (the ~1.2MB inline SVG) only gets touched when
   *  what it should show actually changes — see the file header for why
   *  (this is the fix for the bottom-nav flashing on the map screen). The
   *  business list keeps re-rendering normally for its mechanic countdowns. */
  function render() {
    if (!container) return;
    if (mapOpen) {
      const desired = worldMapSvg ? 'loaded' : 'loading';
      if (mapRenderState !== desired) {
        container.innerHTML = mapHTML();
        mapRenderState = desired;
        // Sync the current zoom level onto the freshly-created SVG element —
        // matters if the fetch resolved after the player had already zoomed
        // the (non-interactive) loading placeholder, which can't happen
        // today but costs nothing to keep correct.
        if (desired === 'loaded') {
          const svg = mapSvgEl();
          if (svg) svg.style.width = mapWidthVw + 'vw';
        }
      }
      return;
    }
    mapRenderState = null;
    container.innerHTML = bizTabHTML();
  }

  /** Fetch the real world map once and cache it in memory; the browser's
   *  own HTTP/service-worker cache makes every load after the first one
   *  (across the whole session, even after closing/reopening) instant. */
  function fetchWorldMap() {
    if (worldMapSvg || worldMapFetching || typeof fetch === 'undefined') return;
    worldMapFetching = true;
    fetch('img/map/world-map.svg')
      .then((res) => res.text())
      .then((svg) => {
        worldMapSvg = svg;
        countryNames = parseCountryNames(svg);
        worldMapFetching = false;
        if (mapOpen) render();
      })
      .catch(() => { worldMapFetching = false; });
  }

  /** The source file's hidden <g id="labels" display="none"> layer has one
   *  <text id="XX-label">Country Name</text> per country — parse that once
   *  instead of hand-maintaining our own ~250-entry ISO code table. */
  function parseCountryNames(svg) {
    const names = {};
    const re = /id="([A-Za-z]{2})-label"[^>]*>([^<]+)</g;
    let m;
    while ((m = re.exec(svg))) names[m[1].toUpperCase()] = m[2].trim();
    return names;
  }

  /* --------------------------- Map zoom/pan --------------------------- */
  // Panning is native scroll (the SVG just renders wider than the viewport);
  // zoom directly resizes it (mapWidthVw), keeping the pinch/click point
  // anchored in place via a scroll-offset adjustment so the view doesn't
  // drift toward a corner on every zoom step.
  //
  // Smoothness: button zoom gets a CSS width transition (a real animated
  // resize instead of an instant jump); pinch turns that transition OFF
  // (direct 1:1 finger tracking would otherwise fight/lag behind it) and
  // batches rapid touchmove events through one requestAnimationFrame, so a
  // burst of touch events collapses into at most one resize per frame
  // instead of layout-thrashing on every single one.

  function mapScreenEl() { return typeof document !== 'undefined' ? document.querySelector('.biz-worldmap-screen') : null; }
  function mapScrollEl() { return typeof document !== 'undefined' ? document.querySelector('.biz-worldmap-scroll') : null; }
  function mapSvgEl() { const s = mapScrollEl(); return s && s.querySelector ? s.querySelector('svg') : null; }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  const raf = typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame : (fn) => setTimeout(fn, 16);

  /** "Cover" sizing (like CSS object-fit:cover), computed per-device: the
   *  smallest width (in vw) at which the map's rendered height ALSO covers
   *  the full viewport height, so the fully-zoomed-out state never shows a
   *  strip of blank space above/below (the map is landscape, phones are
   *  portrait — a plain "fit to width" leaves a big gap otherwise). Max is
   *  a fixed multiple of that, so zoom depth scales with the device too —
   *  enough to make even a tiny island nation (Mauritius) a real tap target. */
  function computeMapZoomBounds() {
    const vw = (typeof window !== 'undefined' && window.innerWidth) || 400;
    const vh = (typeof window !== 'undefined' && window.innerHeight) || 800;
    const widthForHeightCoverPx = vh / MAP_ASPECT;
    const neededPx = Math.max(vw, widthForHeightCoverPx);
    mapZoomMinVw = (neededPx / vw) * 100;
    mapZoomMaxVw = mapZoomMinVw * 6;
  }

  /** Set the map's zoom to an ABSOLUTE width (in vw), keeping whatever's
   *  under (anchorX, anchorY) — a click/pinch-midpoint in viewport
   *  coordinates — visually anchored in place. No anchor = viewport center.
   *  The target size is computed ANALYTICALLY from the pre-change rect
   *  (not by re-reading getBoundingClientRect() after the style write) so
   *  this stays correct even while a CSS width transition is animating —
   *  reading the DOM again mid-transition would report a stale, in-between
   *  size and throw the anchor math off. */
  function setMapWidth(targetVw, anchorX, anchorY) {
    const newVw = clamp(targetVw, mapZoomMinVw, mapZoomMaxVw);
    const svg = mapSvgEl();
    const scroll = mapScrollEl();
    if (!svg || !scroll || newVw === mapWidthVw) { mapWidthVw = newVw; return; }

    const oldRect = svg.getBoundingClientRect();
    const scrollRect = scroll.getBoundingClientRect();
    const ax = anchorX != null ? anchorX - scrollRect.left : scrollRect.width / 2;
    const ay = anchorY != null ? anchorY - scrollRect.top : scrollRect.height / 2;
    const fracX = oldRect.width ? (scroll.scrollLeft + ax) / oldRect.width : 0;
    const fracY = oldRect.height ? (scroll.scrollTop + ay) / oldRect.height : 0;

    const viewportW = (typeof window !== 'undefined' && window.innerWidth) || 400;
    const aspect = oldRect.width ? oldRect.height / oldRect.width : MAP_ASPECT;
    const newWidthPx = (newVw / 100) * viewportW;
    const newHeightPx = newWidthPx * aspect;

    mapWidthVw = newVw;
    svg.style.width = mapWidthVw + 'vw';

    scroll.scrollLeft = fracX * newWidthPx - ax;
    scroll.scrollTop = fracY * newHeightPx - ay;
  }

  function zoomStep(dir) {
    setMapWidth(mapWidthVw * (dir > 0 ? 1.6 : 1 / 1.6));
  }

  function touchDist(a, b) {
    const dx = a.clientX - b.clientX, dy = a.clientY - b.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function onTouchStart(e) {
    if (!mapOpen || e.touches.length !== 2) return;
    pinchStartDist = touchDist(e.touches[0], e.touches[1]);
    pinchStartWidthVw = mapWidthVw;
    const svg = mapSvgEl();
    if (svg) svg.style.transition = 'none'; // direct 1:1 tracking, no animated lag while actively pinching
  }

  function onTouchMove(e) {
    if (!mapOpen || e.touches.length !== 2 || !pinchStartDist) return;
    if (e.cancelable) e.preventDefault(); // don't let a 2-finger move also try to scroll
    const dist = touchDist(e.touches[0], e.touches[1]);
    const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    pinchPending = { targetVw: pinchStartWidthVw * (dist / pinchStartDist), midX, midY };
    if (pinchRAF) return; // a frame is already queued — this event's data will still be used when it fires
    pinchRAF = raf(() => {
      pinchRAF = null;
      if (pinchPending) { setMapWidth(pinchPending.targetVw, pinchPending.midX, pinchPending.midY); pinchPending = null; }
    });
  }

  function onTouchEnd(e) {
    if (e.touches.length < 2) {
      pinchStartDist = null;
      pinchStartWidthVw = null;
      const svg = mapSvgEl();
      if (svg) svg.style.transition = 'width 0.22s ease-out'; // restore smooth animated zoom for the buttons
    }
  }

  /* ------------------------ Country selection ------------------------- */

  function clearCountrySelection() {
    if (selectedCountryEl && selectedCountryEl.classList) selectedCountryEl.classList.remove('is-selected');
    selectedCountryEl = null;
    selectedCountryCode = null;
    const box = typeof document !== 'undefined' ? document.getElementById('bizWorldMapInfo') : null;
    if (box && box.remove) box.remove();
  }

  /** Resolve a tap to the country <g> it landed in (multi-part countries
   *  have suffixed sub-territory ids like "us-" for insets — the leading 2
   *  letters always match the main id), toggle its highlight, and show/hide
   *  the info box. Tapping ocean/background or the already-selected country
   *  again clears the selection. Never calls render() — direct DOM writes
   *  only, so tapping never re-touches the (expensive) map SVG. */
  function handleCountryClick(e) {
    if (!worldMapSvg) return;
    const g = e.target.closest && e.target.closest('g[id]');
    const code = g && g.id && (g.id.match(/^[A-Za-z]{2}/) || [])[0];
    const name = code && countryNames[code.toUpperCase()];

    if (!name) { clearCountrySelection(); return; }
    if (selectedCountryEl === g) { clearCountrySelection(); return; }

    if (selectedCountryEl && selectedCountryEl.classList) selectedCountryEl.classList.remove('is-selected');
    if (g.classList) g.classList.add('is-selected');
    selectedCountryEl = g;
    selectedCountryCode = code.toUpperCase();
    showCountryInfo(name, selectedCountryCode, e.clientX, e.clientY);
  }

  /** Deterministic-but-fake per-country stats, seeded off the country code
   *  so the same country always shows the same numbers — there's no real
   *  per-country business data yet, this is a placeholder for now. */
  function seededRandom(seed) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (Math.imul(h, 31) + seed.charCodeAt(i)) >>> 0;
    return function next() {
      h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
      return h / 4294967296;
    };
  }
  const OPPORTUNITY_TIERS = ['Low', 'Medium', 'High'];
  function countryInfoFor(code) {
    const rand = seededRandom(code);
    return {
      population: formatNumber(Math.round(100000 + rand() * 1.4e9)),
      gdp: formatMoney(5e8 + rand() * 2e13),
      opportunity: OPPORTUNITY_TIERS[Math.floor(rand() * OPPORTUNITY_TIERS.length)],
    };
  }

  function showCountryInfo(name, code, x, y) {
    if (typeof document === 'undefined') return;
    let box = document.getElementById('bizWorldMapInfo');
    if (!box) {
      box = document.createElement('div');
      box.id = 'bizWorldMapInfo';
      box.className = 'biz-worldmap-info';
      const screen = mapScreenEl();
      if (screen && screen.appendChild) screen.appendChild(box);
    }
    const info = countryInfoFor(code);
    box.innerHTML = `
      <div class="biz-worldmap-info-name">${name}</div>
      <div class="biz-worldmap-info-stat"><span>Population</span><b>${info.population}</b></div>
      <div class="biz-worldmap-info-stat"><span>GDP</span><b>${info.gdp}</b></div>
      <div class="biz-worldmap-info-stat"><span>Opportunity</span><b>${info.opportunity}</b></div>
    `;
    positionInfoBox(box, x, y);
  }

  function positionInfoBox(box, x, y) {
    const vw = (typeof window !== 'undefined' && window.innerWidth) || 400;
    const vh = (typeof window !== 'undefined' && window.innerHeight) || 800;
    const rect = box.getBoundingClientRect ? box.getBoundingClientRect() : { width: 200, height: 110 };
    let left = (x != null ? x : vw / 2) + 14;
    let top = (y != null ? y : vh / 2) - rect.height / 2;
    if (left + rect.width > vw - 10) left = (x != null ? x : vw / 2) - rect.width - 14;
    left = clamp(left, 10, Math.max(10, vw - rect.width - 10));
    top = clamp(top, 10, Math.max(10, vh - rect.height - 10));
    box.style.left = left + 'px';
    box.style.top = top + 'px';
  }

  function bizTabHTML() {
    const level = playerLevel();
    const owned = BUSINESS_DEFS.filter((def) => getBiz(def.id).level > 0);
    const defs = listMode === 'mine' ? owned : BUSINESS_DEFS;
    let html = `
      <div class="section-head">
        <h2>Businesses</h2>
        <div class="section-stat">${formatRate(totalBusinessIncomePerSec())}</div>
      </div>

      <button class="biz-map-card" data-biz-nav="map" type="button" aria-label="Open World Map"
        ${WORLD_MAP_IMAGE_URL ? `style="background-image:url('${WORLD_MAP_IMAGE_URL}')"` : ''}>
        ${WORLD_MAP_IMAGE_URL ? '' : `<span class="biz-map-fallback">${MAP_ICON}</span>`}
        <span class="biz-map-scrim"></span>
        <span class="biz-map-overlay">
          <span class="biz-map-text">
            <span class="biz-map-title">World Map</span>
            <span class="biz-map-sub">See where your empire operates around the globe</span>
          </span>
          <span class="biz-map-arrow">›</span>
        </span>
      </button>

      <div class="biz-nav-grid">
        <button class="biz-nav-panel ${listMode === 'mine' ? 'is-active' : ''}" data-biz-nav="mine" type="button">
          <span class="biz-nav-top">
            <span class="biz-nav-icon">${NAV_ICON_MINE}</span>
            <span class="biz-nav-num">${owned.length}</span>
          </span>
          <span class="biz-nav-label">My Businesses</span>
        </button>
        <button class="biz-nav-panel biz-nav-panel--own ${listMode === 'all' ? 'is-active' : ''}" data-biz-nav="all" type="button">
          <span class="biz-nav-top">
            <span class="biz-nav-icon">${NAV_ICON_OWN}</span>
            <span class="biz-nav-num">${BUSINESS_DEFS.length}</span>
          </span>
          <span class="biz-nav-label">Purchasable</span>
        </button>
      </div>

      <div class="biz-list">
    `;
    if (listMode === 'mine' && defs.length === 0) {
      html += `<div class="bizd-empty">You don't own any businesses yet — tap "Purchasable" to get started.</div>`;
    } else {
      for (const def of defs) html += businessCardHTML(def, level);
    }
    html += '</div>';
    return html;
  }

  /** World Map — a real 1:1 world map (every country its own bordered
   *  region), fetched from img/map/world-map.svg. Shows the stylized
   *  continent teaser as a lightweight placeholder only while the real map
   *  is still loading (first open of the session). Full-bleed, edge-to-edge
   *  (no header row eating vertical space) and rendered far bigger than the
   *  viewport (.biz-worldmap-scroll's CSS width) so even the smallest
   *  countries are big enough to tap, panning/scrolling in both directions
   *  to reach them. */
  function mapHTML() {
    const body = worldMapSvg
      ? `<div class="biz-worldmap-scroll">${worldMapSvg}</div>`
      : `<div class="biz-worldmap-scroll biz-worldmap-loading">${WORLD_MAP_SVG}</div>`;
    return `
      <div class="biz-worldmap-screen">
        <button class="icon-btn biz-worldmap-close" data-biz-nav="closeMap" type="button" aria-label="Close">✕</button>
        ${body}
        ${worldMapSvg ? `
          <div class="biz-worldmap-zoom">
            <button class="biz-worldmap-zoom-btn" data-map-zoom="in" type="button" aria-label="Zoom in">+</button>
            <button class="biz-worldmap-zoom-btn" data-map-zoom="out" type="button" aria-label="Zoom out">−</button>
          </div>` : ''}
      </div>`;
  }

  function businessCardHTML(def, level) {
    const biz = getBiz(def.id);
    if (biz.level === 0 && level < def.unlockLevel) return lockedCardHTML(def);
    if (biz.level === 0) return availableCardHTML(def);
    return ownedCardHTML(def, biz);
  }

  /* Locked: shown dimmed with its unlock requirement — a visible next goal. */
  function lockedCardHTML(def) {
    return `
      <div class="card biz-card biz-locked">
        <div class="biz-head">
          <div class="biz-title-wrap">
            <div class="biz-name">${def.name}</div>
            <div class="biz-blurb">${def.blurb}</div>
          </div>
          <div class="lock-tag">🔒 Lv ${def.unlockLevel}</div>
        </div>
        <div class="progress-caption">Unlocks at player level ${def.unlockLevel}
          (${formatMoney(xpForLevel(def.unlockLevel))} lifetime earnings) · startup ${formatMoney(def.baseCost)}</div>
      </div>`;
  }

  /* Available: can be started if there's money and a free slot. */
  function availableCardHTML(def) {
    const cost = def.baseCost;
    const slotFree = usedSlots() < maxSlots();
    const canBuy = state.balance >= cost && slotFree;
    return `
      <div class="card biz-card not-owned">
        <div class="biz-head">
          <div class="biz-title-wrap">
            <div class="biz-name">${def.name}</div>
            <div class="biz-blurb">${def.blurb}</div>
          </div>
        </div>
        <div class="biz-stats">
          <div><span class="muted">Income</span><b class="gold">${formatRate(def.baseIncome)}</b></div>
          <div><span class="muted">Startup</span><b>${formatMoney(cost)}</b></div>
        </div>
        <button class="btn btn-wide ${canBuy ? 'btn-gold' : ''}" data-buy="${def.id}" ${canBuy ? '' : 'disabled'}>
          Start Business · ${formatMoney(cost)}</button>
        ${slotFree ? '' : '<div class="progress-caption">⚠️ No free business slot — level up or sell a business.</div>'}
      </div>`;
  }

  /* Owned: a compact summary — everything deeper (staff/mechanic/upgrades)
   * lives on the dedicated page (js/bizdash.js). Leveling is retired (no
   * more "Buy Level" purchase) — income is whatever it is at the level the
   * business is already at, frozen, ahead of a future business-tab rebuild.
   * The ⋮ menu is a quick Sell shortcut right on the card, in addition to
   * the same sell option already on the dedicated page's Overview tab —
   * both call the same sellBusiness() at the same 25%-of-spend refund. */
  function ownedCardHTML(def, biz) {
    const net = businessIncomePerSec(def);
    const menuOpen = openMenuId === def.id;
    const refund = SELL_REFUND_RATE * businessSpentOnLevels(def);

    return `
      <div class="card biz-card">
        <button class="biz-menu-btn" data-biz-menu="${def.id}" type="button" aria-label="${def.name} options">${DOTS_ICON}</button>
        ${menuOpen ? `
          <div class="biz-menu-pop">
            <button class="biz-menu-item" data-sell="${def.id}" type="button">
              Sell Business
              <span class="biz-menu-item-sub">${formatMoney(refund)} refund (25%)</span>
            </button>
          </div>` : ''}
        <div class="biz-head">
          <div class="biz-title-wrap">
            <div class="biz-name">${def.name}</div>
            <div class="biz-blurb">${def.blurb}</div>
          </div>
          <div class="biz-level">Lv ${biz.level}</div>
        </div>

        <div class="biz-stats">
          <div><span class="muted">Net income</span><b class="gold">${formatRate(net)}</b></div>
        </div>

        <button class="btn btn-wide biz-manage-btn" data-manage="${def.id}">Manage Business ›</button>
      </div>`;
  }

  /** Employees row: hire, salaries, capacity. Next-hire role is flavor text
   * cycling through the business's staffRoles list (still one staff counter). */
  function staffHTML(def, biz) {
    const cap = maxStaff(def);
    const cost = hireCost(def);
    const salaries = businessSalariesPerSec(def);
    const canHire = biz.staff < cap && state.balance >= cost;
    const boostPct = Math.round((staffBoost(def) - 1) * 100);
    const nextRole = def.staffRoles ? def.staffRoles[biz.staff % def.staffRoles.length] : null;
    return `
      <div class="staff-row">
        <div class="upgrade-info">
          <span class="upgrade-name">👥 Staff ${biz.staff}/${cap} <span class="up">+${boostPct}%</span></span>
          <span class="upgrade-desc">Salaries ${formatRate(salaries)}${nextRole && biz.staff < cap ? ` · Next hire: ${nextRole}` : ''}</span>
        </div>
        ${biz.staff >= cap
          ? '<span class="pill pill-locked">Staff full</span>'
          : `<button class="btn btn-sm ${canHire ? 'btn-gold' : ''}" data-hire="${def.id}" ${canHire ? '' : 'disabled'}>Hire ${formatMoney(cost)}</button>`}
      </div>`;
  }

  /** Named milestone-upgrade rows. */
  function upgradesHTML(def, biz) {
    let html = '';
    for (const up of def.upgrades) {
      const purchased = !!biz.upgrades[up.id];
      const unlocked = biz.level >= up.requiresLevel;
      const affordable = state.balance >= up.cost;

      let btn;
      if (purchased) btn = '<span class="pill pill-done">Owned</span>';
      else if (!unlocked) btn = `<span class="pill pill-locked">Lv ${up.requiresLevel}</span>`;
      else btn = `<button class="btn btn-sm ${affordable ? 'btn-gold' : ''}"
        data-upgrade="${up.id}" data-biz="${def.id}" ${affordable ? '' : 'disabled'}>${formatMoney(up.cost)}</button>`;

      html += `
        <div class="upgrade-row ${purchased ? 'is-done' : ''} ${!unlocked ? 'is-locked' : ''}">
          <div class="upgrade-info">
            <span class="upgrade-name">${up.name}</span>
            <span class="upgrade-desc">${up.desc}</span>
          </div>
          ${btn}
        </div>`;
    }
    return html;
  }

  // staffHTML/upgradesHTML are exported so the dedicated business page
  // (js/bizdash.js) can reuse them exactly as-is — no re-derived logic.
  return { mount, render, staffHTML, upgradesHTML };
})();
