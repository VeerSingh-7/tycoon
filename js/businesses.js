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
 * IMPORTANT: render() is idempotent for every overlay (lastRenderKey) —
 * ui.js re-renders the whole Business tab every ~500ms for the list's
 * mechanic countdowns, and re-injecting a fullscreen overlay's markup on
 * every one of those ticks (worst case, the map's ~1.2MB inline SVG) would
 * destroy + recreate it that often, restarting its fadeIn animation each
 * time and making the bottom nav visibly flash through the momentarily-
 * transparent overlay. Every overlay's own DOM is only touched when what it
 * should show actually changes — never on a plain timer tick. Zooming,
 * panning, selecting/deselecting a country and the info box are all direct
 * DOM writes for the same reason — none of them call render() either.
 *
 * Starting a business with a property catalog (js/data/properties.js — for
 * now just the Supermarket Chain) opens a staged setup wizard instead of
 * buying instantly (SETUP_STAGES — just "Property" for now, more can be
 * appended later). That one stage is ONE screen: a country selector (flag
 * + name, tap for a dropdown of the other 3) at the top, a horizontally-
 * scrollable city bar below it, and the selected city's real properties
 * listed underneath — switching country or city updates that same screen
 * in place. Tapping a property opens a "Coming Soon" page (every
 * property, for now — the actual per-property purchase flow isn't wired
 * up yet, on purpose, while this browsing UI is still being built).
 *
 * Events use DELEGATION on the container so the 2x/sec re-render (needed for
 * mechanic countdowns) never orphans listeners.
 * ========================================================================= */

const Businesses = (() => {
  let container;
  let listMode = 'all'; // 'all' | 'mine' — which businesses the list below shows
  let mapOpen = false;  // World Map overlay
  let propertiesOpen = false; // Properties overlay — a read-only browser of every property in the game
  let propertiesBrowse = null; // { countryId, city, countryDropdownOpen, viewPropertyId } while Properties is open
  let setupFlow = null; // { bizId, step, countryId, city, tierId } — Start Business property-picker, or null when closed
  // A single signature for "what's actually in the DOM right now" across every
  // overlay (map/properties/setup) — render() only touches innerHTML when
  // this changes, never on a bare periodic tick. Without this, ui.js's
  // ~500ms Business-tab re-render (for the list's mechanic countdowns) would
  // recreate whichever overlay is open that often, restarting its fadeIn
  // animation each time and flashing the bottom nav through the momentarily
  // transparent overlay — the exact bug the map version of this had.
  let lastRenderKey = null;
  let openMenuId = null; // id of the owned business whose ⋮ menu is open (Sell), or null
  let worldMapSvg = null;    // fetched img/map/world-map.svg markup, cached once loaded
  let worldMapFetching = false;
  let countryNames = {};     // ISO code -> readable name, parsed from the fetched SVG's hidden label layer

  // The map's own aspect ratio (viewBox 1000 x 507.209 — a wide equirectangular
  // projection) doesn't match a phone's tall portrait screen. mapZoomMinVw/
  // mapZoomMaxVw are computed per-device (see computeMapZoomBounds) and
  // depend on orientation: portrait COVERS the whole screen (no blank space,
  // cropping width instead — the map is much wider than any portrait
  // screen), landscape CONTAINS the whole map instead (its full scale stays
  // visible, even if that means a slim letterbox margin) since a landscape
  // screen is often close enough to the map's own wide aspect ratio that
  // cropping it doesn't buy much and hiding part of the map does cost more.
  const MAP_ASPECT = 507.209 / 1000; // svg intrinsic height/width

  // Continuous zoom-hold (the +/- buttons): a quick tap still does one
  // discrete step (onClick's d.mapZoom, unchanged); holding past this delay
  // starts a smooth per-frame zoom that runs until released.
  const ZOOM_HOLD_DELAY_MS = 260;
  const ZOOM_HOLD_STEP = 1.025;
  let zoomHoldTimer = null;
  let zoomHoldActive = false;
  let mapZoomMinVw = 350;  // recomputed by computeMapZoomBounds() every time the map opens
  let mapZoomMaxVw = 2200; // recomputed alongside it (a fixed multiple of the min, device-adaptive)
  let mapWidthVw = mapZoomMinVw; // current zoom level (the SVG's CSS width, in vw units)
  let pinchStartDist = null;
  let pinchStartWidthVw = null;
  let pinchRAF = null;      // requestAnimationFrame handle coalescing touchmove bursts
  let pinchPending = null;  // { targetVw, midX, midY } for the next coalesced frame
  let selectedCountryEl = null;   // the <g> currently highlighted, or null
  let selectedCountryCode = null; // its ISO code, or null

  // Setup wizard Step 3's signature pad: pointer-driven freehand drawing on
  // a <canvas>, wired once at container mount (delegated, like the zoom-hold
  // above) rather than re-wired on every render — the canvas element only
  // gets created once per visit to the signature screen (render()'s
  // lastRenderKey doesn't change while drawing), so the strokes persist.
  let sigDrawing = false;
  let sigLastX = 0;
  let sigLastY = 0;

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

  // Properties: a small house/plot outline.
  const PROPERTY_ICON = `<svg viewBox="0 0 40 40" class="hub-logo-svg" aria-hidden="true">
        <path d="M8 20 L20 9 L32 20 V32 H8 Z" fill="currentColor" fill-opacity="0.15" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>
        <path d="M16 32 V22 H24 V32" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>`;

  const HEART_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 20.5 C12 20.5 3 15 3 8.7 C3 5.7 5.35 3.5 8.1 3.5 C9.9 3.5 11.3 4.4 12 5.7 C12.7 4.4 14.1 3.5 15.9 3.5 C18.65 3.5 21 5.7 21 8.7 C21 15 12 20.5 12 20.5 Z"/></svg>`;

  /** Favorite-property state: a pure-cosmetic, persisted flag per property
   *  (no gameplay effect). Keyed on cityName + property slug — property
   *  names alone aren't guaranteed unique across the whole 96-property
   *  catalog, so this reuses the same composite key storefrontSVG's own
   *  seed uses. Lazily created on first access (same pattern as engine.js's
   *  getBiz()) rather than added to state.js's defaultState(), so no
   *  SAVE_VERSION bump is needed — old saves just get it on first touch. */
  function getFavorites() {
    if (!state.favoriteProperties) state.favoriteProperties = {};
    return state.favoriteProperties;
  }

  function favoriteKey(property, cityName) {
    return cityName + '_' + propertySlug(property.name);
  }

  function isFavorite(property, cityName) {
    return !!getFavorites()[favoriteKey(property, cityName)];
  }

  /** Toggles the favorite flag and patches the DOM directly instead of
   *  going through render() — matches this file's established pattern
   *  (handleCountryClick does the same) for state changes that shouldn't
   *  wait on/be disrupted by the periodic re-render loop, and lets the
   *  fav-pop animation replay cleanly on every tap. */
  function toggleFavoriteClick(btn) {
    const key = btn.dataset.setupFavorite;
    const favs = getFavorites();
    if (favs[key]) delete favs[key]; else favs[key] = true;
    saveGame();
    const active = !!favs[key];
    if (btn.classList) {
      btn.classList.toggle('is-fav', active);
      btn.classList.remove('fav-pop');
      if (typeof btn.offsetWidth !== 'undefined') void btn.offsetWidth; // restart the CSS animation
      btn.classList.add('fav-pop');
    }
    if (btn.setAttribute) btn.setAttribute('aria-pressed', String(active));
  }

  // 3-letter code per city, matching the [CITYCODE]-[NUM].jpg filename
  // convention real storefront photos will use once they're dropped into
  // img/storefronts/ — the card's <img> just points at that path; nothing
  // in the code needs to change when the files show up.
  const CITY_CODES = {
    London: 'LON', Manchester: 'MAN', Edinburgh: 'EDI', Liverpool: 'LIV',
    Toronto: 'TOR', Vancouver: 'VAN', Montreal: 'MTL', Calgary: 'CAL',
    Sydney: 'SYD', Melbourne: 'MEL', Brisbane: 'BRI', Perth: 'PER',
    Tokyo: 'TYO', Osaka: 'OSA', Kyoto: 'KYO', Yokohama: 'YOK',
  };

  function propertyImagePath(cityName, storeIndex) {
    const code = CITY_CODES[cityName] || cityName.slice(0, 3).toUpperCase();
    return `img/storefronts/${code}-${String(storeIndex + 1).padStart(2, '0')}.jpg`;
  }

  /** "1,850" -> "1.9K", "590" -> "590" — a compact thousands abbreviation
   *  for daily-footfall figures on the card (distinct from format.js's
   *  formatMoney/formatNumber, whose abbreviation threshold is $10,000+ —
   *  traffic here never gets that high, so those would just print the
   *  number in full). */
  function formatTrafficCompact(n) {
    if (n < 1000) return String(n);
    return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }

  /** Compact horizontal property card, shared by the setup wizard's browse
   *  screen and the read-only Properties browser — a 120px square photo
   *  thumbnail (falls back to a plain shop emoji until real photos land in
   *  img/storefronts/, no code change needed when they do) on the left,
   *  name/meta/price/stats on the right. Deliberately monochrome (no accent
   *  colors) — that's reserved for the detail page this card opens into.
   *  Every figure comes from this property's own generated stats
   *  (propertyDetails), same as the detail page — never hardcoded. */
  function propertyRowHTML(p, cityName, storeIndex) {
    const d = propertyDetails(p, cityName, storeIndex);
    const monthlyRent = Math.round(d.financials.monthlyRent);
    return `
      <button class="card biz-prop-card" data-setup-property="${propertySlug(p.name)}" type="button">
        <span class="biz-prop-thumb">
          <span class="biz-prop-thumb-fallback" aria-hidden="true">🏪</span>
          <img class="biz-prop-thumb-img" src="${propertyImagePath(cityName, storeIndex)}" alt=""
            loading="lazy" onerror="this.style.opacity='0'">
        </span>
        <span class="biz-prop-content">
          <span class="biz-prop-top">
            <span class="biz-prop-name">${escapeHtml(p.name)}</span>
            <span class="biz-prop-chevron">›</span>
          </span>
          <span class="biz-prop-meta">
            <span class="biz-prop-tag">${p.sqft.toLocaleString()} sq ft</span>
            <span class="biz-prop-tag">${escapeHtml(d.stats.condition)}</span>
          </span>
          <span class="biz-prop-footer">
            <span class="biz-prop-price">
              <span class="biz-prop-price-value">$${monthlyRent.toLocaleString()}</span>
              <span class="biz-prop-price-label">Monthly Rent</span>
            </span>
            <span class="biz-prop-stats">
              <span class="biz-prop-stat">
                <span class="biz-prop-stat-value">${formatTrafficCompact(d.stats.dailyTraffic)}</span>
                <span class="biz-prop-stat-label">Traffic</span>
              </span>
              <span class="biz-prop-stat">
                <span class="biz-prop-stat-value">${d.amenities.length}</span>
                <span class="biz-prop-stat-label">Amenities</span>
              </span>
            </span>
          </span>
        </span>
      </button>`;
  }

  /** Hidden gradient defs (never rendered visibly on their own) that the real
   *  map's country paths reference via fill="url(#bizMapLand)". A DELIBERATE
   *  exception to the app's monochrome system, at explicit request: a
   *  latitude-based stylized approximation of a natural-color satellite
   *  view — polar ice near the top/bottom, green temperate/tropical bands,
   *  a yellow desert band at roughly the real-world desert latitudes
   *  (Sahara/Arabia/Gobi in the north, Kalahari/outback/Atacama in the
   *  south) either side of a slightly richer equatorial green. It's not a
   *  literal photo — no real satellite image shares this file's projection
   *  closely enough to align coastlines pixel-for-pixel, so a gradient tied
   *  to the SVG's own coordinate space (userSpaceOnUse) was the reliable
   *  way to get real shading that still pans/zooms correctly with the map
   *  instead of a mismatched image underneath it. The ocean's blue comes
   *  from .biz-worldmap-scroll's own CSS background instead (see
   *  css/styles.css) — it doesn't need geographic alignment. */
  const MAP_COLOR_DEFS = `
    <svg width="0" height="0" style="position:absolute" aria-hidden="true">
      <defs>
        <linearGradient id="bizMapLand" x1="0" y1="0" x2="0" y2="507.209" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#EAF2F2"/>
          <stop offset="6%" stop-color="#CFE3D0"/>
          <stop offset="18%" stop-color="#6FA96C"/>
          <stop offset="30%" stop-color="#D9C36A"/>
          <stop offset="42%" stop-color="#5FAE5E"/>
          <stop offset="50%" stop-color="#3F9450"/>
          <stop offset="58%" stop-color="#5FAE5E"/>
          <stop offset="70%" stop-color="#D9C36A"/>
          <stop offset="82%" stop-color="#6FA96C"/>
          <stop offset="94%" stop-color="#CFE3D0"/>
          <stop offset="100%" stop-color="#EAF2F2"/>
        </linearGradient>
      </defs>
    </svg>`;

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
    container.addEventListener('pointerdown', onZoomPointerDown);
    container.addEventListener('pointerup', stopZoomHold);
    container.addEventListener('pointercancel', stopZoomHold);
    container.addEventListener('pointerleave', stopZoomHold);
    container.addEventListener('pointerdown', onSignaturePointerDown);
    container.addEventListener('pointermove', onSignaturePointerMove);
    container.addEventListener('pointerup', onSignaturePointerUp);
    container.addEventListener('pointercancel', onSignaturePointerUp);
    container.addEventListener('pointerleave', onSignaturePointerUp);
    listMode = 'all';
    mapOpen = false;
    propertiesOpen = false;
    propertiesBrowse = null;
    setupFlow = null;
    lastRenderKey = null;
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

    if (setupFlow) { onSetupClick(e); return; }
    if (propertiesOpen) { onPropertiesClick(e); return; }

    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    const d = btn.dataset;
    let changed = false;

    if (d.bizNav === 'map') {
      mapOpen = true;
      computeMapZoomBounds();
      mapWidthVw = mapZoomMinVw; // open fully zoomed out (covering/containing per orientation)
      selectedCountryEl = null;
      selectedCountryCode = null;
      fetchWorldMap();
      render();
      return;
    }
    if (d.bizNav === 'properties') { openPropertiesBrowse(); return; }
    if (d.bizNav === 'closeProperties') { propertiesOpen = false; propertiesBrowse = null; render(); return; }
    if (d.bizNav === 'all' || d.bizNav === 'mine') { listMode = d.bizNav; render(); return; }
    if (d.bizMenu !== undefined) { openMenuId = openMenuId === d.bizMenu ? null : d.bizMenu; render(); return; }

    if (d.manage) { if (typeof BizDash !== 'undefined') BizDash.open(d.manage); return; }
    else if (d.buy) {
      // A business with its own property catalog gets a staged setup
      // (choose a property) instead of buying instantly — d.buy only ever
      // fires from "Start Business" now (level 0 -> 1), leveling further is
      // retired, so there's no ambiguity about which purchase this is.
      if (hasPropertyCatalog(d.buy)) { openBusinessSetup(d.buy); return; }
      changed = buyBusinessLevel(d.buy);
    }
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

  /** Every overlay's own DOM is only touched when what it should show
   *  actually changes — see the file header for why (this is the fix for
   *  the bottom-nav flashing bug). The business list keeps re-rendering
   *  normally for its mechanic countdowns. */
  function render() {
    if (!container) return;
    if (mapOpen) {
      const desired = 'map:' + (worldMapSvg ? 'loaded' : 'loading');
      if (lastRenderKey !== desired) {
        container.innerHTML = mapHTML();
        lastRenderKey = desired;
        // Sync the current zoom level onto the freshly-created SVG element —
        // matters if the fetch resolved after the player had already zoomed
        // the (non-interactive) loading placeholder, which can't happen
        // today but costs nothing to keep correct.
        if (desired === 'map:loaded') {
          const svg = mapSvgEl();
          if (svg) svg.style.width = mapWidthVw + 'vw';
        }
      }
      return;
    }
    if (propertiesOpen) {
      const desired = 'props:' + propertiesBrowse.countryId + ':' + propertiesBrowse.city + ':' + propertiesBrowse.countryDropdownOpen + ':' + propertiesBrowse.viewPropertyId;
      if (lastRenderKey !== desired) container.innerHTML = propertiesHTML();
      lastRenderKey = desired;
      return;
    }
    if (setupFlow) {
      const desired = 'setup:' + setupFlow.stage + ':' + setupFlow.step + ':' + setupFlow.countryId + ':' + setupFlow.city + ':' + setupFlow.propertyId + ':' + setupFlow.countryDropdownOpen + ':' + setupFlow.tenure + ':' + setupFlow.storeType;
      if (lastRenderKey !== desired) {
        container.innerHTML = setupHTML();
        lastRenderKey = desired;
        // Size the signature canvas's pixel buffer once, right after it's
        // created — never again while the player is still on this screen,
        // or their strokes would be wiped (see the section header comment
        // on the signature helpers below).
        if (setupFlow.step === 'signature') setupSignatureCanvas();
      }
      return;
    }
    lastRenderKey = null;
    container.innerHTML = bizTabHTML();
  }

  /** Properties — a read-only browser of every property that exists in the
   *  game right now (every business with a catalog; today that's just
   *  Supermarket Chain's 96). Same country/city browse UI as the setup
   *  wizard's Step 1, and tapping a property opens the exact same premium
   *  listing page — just without Rent/Purchase, since there's no specific
   *  "business being started" context out here. */
  function openPropertiesBrowse() {
    const catalogBizId = BUSINESS_DEFS.find((d) => hasPropertyCatalog(d.id)).id;
    const firstCountry = BUSINESS_PROPERTIES[catalogBizId].countries[0];
    propertiesOpen = true;
    propertiesBrowse = {
      bizId: catalogBizId,
      countryId: firstCountry.id, city: firstCountry.cities[0].name,
      countryDropdownOpen: false, viewPropertyId: null,
    };
    render();
  }

  function onPropertiesClick(e) {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    const d = btn.dataset;

    if (d.bizNav === 'closeProperties') { propertiesOpen = false; propertiesBrowse = null; render(); return; }
    if (d.setupFavorite) { toggleFavoriteClick(btn); return; }
    if (d.setupBack !== undefined) { propertiesBrowse.viewPropertyId = null; render(); return; }
    if (d.setupCountryToggle !== undefined) { propertiesBrowse.countryDropdownOpen = !propertiesBrowse.countryDropdownOpen; render(); return; }
    if (d.setupCountry) {
      const country = BUSINESS_PROPERTIES[propertiesBrowse.bizId].countries.find((c) => c.id === d.setupCountry);
      propertiesBrowse.countryId = d.setupCountry;
      propertiesBrowse.city = country.cities[0].name;
      propertiesBrowse.countryDropdownOpen = false;
      render();
      return;
    }
    if (d.setupCity) { propertiesBrowse.city = d.setupCity; propertiesBrowse.countryDropdownOpen = false; render(); return; }
    if (d.setupProperty) { propertiesBrowse.viewPropertyId = d.setupProperty; render(); return; }
  }

  function propertiesHTML() {
    const def = BUSINESS_BY_ID[propertiesBrowse.bizId];
    const catalog = BUSINESS_PROPERTIES[def.id];
    const country = catalog.countries.find((c) => c.id === propertiesBrowse.countryId);
    const cityObj = country.cities.find((c) => c.name === propertiesBrowse.city) || country.cities[0];

    let body;
    if (propertiesBrowse.viewPropertyId) {
      const storeIndex = cityObj.properties.findIndex((p) => propertySlug(p.name) === propertiesBrowse.viewPropertyId);
      const property = cityObj.properties[storeIndex];
      body = propertyListingHTML(def, property, cityObj, country, storeIndex, '');
    } else {
      body = propertiesBrowseListHTML(def, catalog, country, cityObj, propertiesBrowse.countryDropdownOpen);
    }

    const closeOrBackBtn = propertiesBrowse.viewPropertyId
      ? `<button class="icon-btn" data-setup-back type="button" aria-label="Back">‹</button>`
      : `<button class="icon-btn" data-biz-nav="closeProperties" type="button" aria-label="Close">✕</button>`;

    return `
      <div class="bizd-screen">
        <div class="bizd-head">
          ${closeOrBackBtn}
          <div class="bizd-id">
            <div class="bizd-co-name">Properties</div>
            <div class="bizd-co-sub">Every property in the game — browse only</div>
          </div>
        </div>
        ${body}
      </div>`;
  }

  /** Country selector + city scroller + property list — identical structure
   *  to setupBrowseHTML, just reading propertiesBrowse instead of setupFlow
   *  (the two screens are only ever open one at a time). */
  /** Country selector + city scroller, STICKY to the top of the scrolling
   *  screen so it stays reachable however far you scroll into a city's
   *  property list — previously plain in-flow content, which meant
   *  scrolling down a longer list scrolled the only way to change city
   *  out of view too. Shared by the setup wizard's browse screen and the
   *  read-only Properties browser (identical markup, different state). */
  function propertyBrowseHeaderHTML(country, otherCountries, cityObj, dropdownOpen) {
    return `
      <div class="biz-browse-sticky">
        <div class="biz-setup-country">
          <button class="biz-setup-country-btn" data-setup-country-toggle type="button" aria-label="Change country">
            <span class="biz-setup-flag">${country.flag}</span>
            <span class="biz-setup-country-name">${country.name}</span>
            <span class="biz-setup-country-chevron">${dropdownOpen ? '︿' : '⌄'}</span>
          </button>
          ${dropdownOpen ? `
            <div class="biz-setup-country-dropdown">
              ${otherCountries.map((c) => `
                <button class="biz-setup-country-option" data-setup-country="${c.id}" type="button">
                  <span class="biz-setup-flag">${c.flag}</span>${c.name}
                </button>`).join('')}
            </div>` : ''}
        </div>
        <div class="biz-setup-scroller">
          ${country.cities.map((c) => `
            <button class="biz-setup-chip ${c.name === cityObj.name ? 'is-active' : ''}" data-setup-city="${c.name}" type="button">${c.name}</button>`).join('')}
        </div>
      </div>`;
  }

  function propertiesBrowseListHTML(def, catalog, country, cityObj, dropdownOpen) {
    const otherCountries = catalog.countries.filter((c) => c.id !== country.id);
    return `
      ${propertyBrowseHeaderHTML(country, otherCountries, cityObj, dropdownOpen)}
      <div class="biz-list">
        ${cityObj.properties.map((p, i) => propertyRowHTML(p, cityObj.name, i)).join('')}
      </div>`;
  }

  /* ------------------------- Business setup flow ------------------------ */
  // A multi-STAGE wizard for a business with its own property catalog
  // (js/data/properties.js) — SETUP_STAGES lists the stages: "Business
  // Details" (stage 1 — store type, company name, suppliers), "Property"
  // (stage 2), then "Signature" (stage 3). Only stage indices show in the
  // header ("Step 1 of 3"); each stage internally walks through its own
  // sequence of steps.
  //
  // Stage 1 (Business Details) is ONE scrollable page — pick a store type,
  // name the company, and a suppliers placeholder — all on the same
  // screen, no sub-navigation. "Continue to Step 2" (enabled once a store
  // type is picked) moves on to Property.
  //
  // Stage 2 (Property) is ONE browse screen: a country selector (flag +
  // name, tap for a dropdown of the other 3) at the top, a horizontally-
  // scrollable city bar below it, and the selected city's 6 real
  // properties listed underneath — switching country or city just updates
  // that same screen in place. Tapping a property opens ITS real generated
  // listing (js/data/properties.js propertyDetails — description, key
  // stats, amenities, financials) with Rent/Purchase actions. Either one
  // starts the business for real (same buyBusinessLevel() + cost as every
  // other business — the property is flavor, not a separate charge) and
  // unlocks "Continue to Step 3".
  //
  // Stage 3 (Signature) is a canvas the player draws on with a finger —
  // "Finish Setup" (enabled once a stroke has been drawn) saves the store
  // type + company name collected in Stage 1 plus the signature onto
  // biz.brand and closes the wizard — it's the last step.
  //
  // Businesses WITHOUT a catalog are completely unaffected — still buy
  // instantly, no wizard at all.

  const SETUP_STAGES = [
    { id: 'details', label: 'Business Details' },
    { id: 'property', label: 'Property' },
    { id: 'signature', label: 'Signature' },
  ];

  const STORE_TYPES = [
    { id: 'jewellery', label: 'Jewellery' },
    { id: 'grocery', label: 'Grocery' },
    { id: 'electronics', label: 'Electronics & Tech' },
    { id: 'fashion', label: 'Clothing & Fashion' },
    { id: 'home', label: 'Home & Furniture' },
    { id: 'pharmacy', label: 'Pharmacy & Health' },
  ];

  const escapeHtml = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escapeAttr = (v) => escapeHtml(v).replace(/"/g, '&quot;');

  function openBusinessSetup(bizId) {
    const firstCountry = BUSINESS_PROPERTIES[bizId].countries[0];
    setupFlow = {
      bizId, stage: 0, step: 'details',
      countryId: firstCountry.id, city: firstCountry.cities[0].name,
      propertyId: null, countryDropdownOpen: false, tenure: null,
      storeType: null, companyName: '',
    };
    render();
  }

  function onSetupClick(e) {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    const d = btn.dataset;

    if (d.bizNav === 'closeSetup') { setupFlow = null; render(); return; }
    if (d.setupFavorite) { toggleFavoriteClick(btn); return; }
    if (d.setupBack !== undefined) {
      if (setupFlow.step === 'signature') { setupFlow.stage = 1; setupFlow.step = 'property'; }
      else if (setupFlow.step === 'property') setupFlow.step = 'browse';
      else if (setupFlow.step === 'browse') { setupFlow.stage = 0; setupFlow.step = 'details'; }
      render();
      return;
    }
    if (d.setupCountryToggle !== undefined) { setupFlow.countryDropdownOpen = !setupFlow.countryDropdownOpen; render(); return; }
    if (d.setupCountry) {
      const country = BUSINESS_PROPERTIES[setupFlow.bizId].countries.find((c) => c.id === d.setupCountry);
      setupFlow.countryId = d.setupCountry;
      setupFlow.city = country.cities[0].name; // land on the first city so properties show immediately
      setupFlow.countryDropdownOpen = false;
      render();
      return;
    }
    if (d.setupCity) { setupFlow.city = d.setupCity; setupFlow.countryDropdownOpen = false; render(); return; }
    if (d.setupProperty) {
      setupFlow.propertyId = d.setupProperty;
      setupFlow.step = 'property';
      render();
      return;
    }
    if (d.setupRent !== undefined || d.setupPurchase !== undefined) {
      // Guard against a double-charge: if the player backs out to the
      // property page after already renting/buying (it keeps showing a
      // "Continue to Step 3" confirmation, not the actions, but this is
      // cheap insurance regardless), don't let a second buyBusinessLevel()
      // fire.
      if (getBiz(setupFlow.bizId).level > 0) return;
      const tenure = d.setupRent !== undefined ? 'rent' : 'purchase';
      if (buyBusinessLevel(setupFlow.bizId)) {
        const biz = getBiz(setupFlow.bizId);
        biz.property = { countryId: setupFlow.countryId, city: setupFlow.city, propertyId: setupFlow.propertyId, tenure };
        saveGame();
        setupFlow.tenure = tenure;
        UI.renderBalance();
        render();
        if (typeof Businesses !== 'undefined') Businesses.render();
      }
      return;
    }
    if (d.setupContinueStage !== undefined) {
      if (setupFlow.step === 'details') {
        // Leaving the details page for good — snapshot whatever's
        // currently typed in the name field, since that input won't exist
        // once we're on the Property stage (see d.setupType's comment for
        // why this snapshot pattern is needed at all).
        const input = container && container.querySelector ? container.querySelector('[data-company-name-input]') : null;
        const typed = input && typeof input.value === 'string' ? input.value.trim() : '';
        setupFlow.companyName = typed || BUSINESS_BY_ID[setupFlow.bizId].name;
        setupFlow.stage = 1;
        setupFlow.step = 'browse';
      } else if (setupFlow.step === 'property') {
        setupFlow.stage = 2;
        setupFlow.step = 'signature';
      }
      render();
      return;
    }
    if (d.setupType) {
      // The details page is one long scroll with no per-field "Next" — a
      // type tap re-renders in place (storeType is part of lastRenderKey)
      // to update the chip highlight/checkmark, so snapshot whatever's
      // currently typed in the name field first or that re-render would
      // wipe it back to its last-saved value.
      const input = container && container.querySelector ? container.querySelector('[data-company-name-input]') : null;
      if (input && typeof input.value === 'string') setupFlow.companyName = input.value;
      setupFlow.storeType = d.setupType;
      render();
      return;
    }
    if (d.setupSignatureClear !== undefined) { clearSignatureCanvas(); disableFinishButton(); return; }
    if (d.setupFinish !== undefined) {
      const canvas = signatureCanvasEl();
      const biz = getBiz(setupFlow.bizId);
      biz.brand = {
        storeType: setupFlow.storeType,
        companyName: setupFlow.companyName || BUSINESS_BY_ID[setupFlow.bizId].name,
        signature: canvas && typeof canvas.toDataURL === 'function' ? canvas.toDataURL() : null,
      };
      saveGame();
      setupFlow = null;
      render();
      if (typeof Businesses !== 'undefined') Businesses.render();
      return;
    }
  }

  function setupHTML() {
    const def = BUSINESS_BY_ID[setupFlow.bizId];
    const stage = SETUP_STAGES[setupFlow.stage];
    let body;
    if (setupFlow.step === 'property') body = setupPropertyHTML(def);
    else if (setupFlow.step === 'details') body = setupDetailsHTML(def);
    else if (setupFlow.step === 'signature') body = setupSignatureHTML(def);
    else body = setupBrowseHTML(def);

    const closeOrBackBtn = setupFlow.step === 'details'
      ? `<button class="icon-btn" data-biz-nav="closeSetup" type="button" aria-label="Close">✕</button>`
      : `<button class="icon-btn" data-setup-back type="button" aria-label="Back">‹</button>`;

    return `
      <div class="bizd-screen">
        <div class="bizd-head">
          ${closeOrBackBtn}
          <div class="bizd-id">
            <div class="bizd-co-name">${def.name} — Setup</div>
            <div class="bizd-co-sub">Step ${setupFlow.stage + 1} of ${SETUP_STAGES.length} · ${stage.label}</div>
          </div>
        </div>
        ${body}
      </div>`;
  }

  /** Country selector (flag + name, tap for a dropdown of the other 3) +
   *  horizontally-scrollable city bar + the selected city's properties,
   *  all one screen — switching country or city updates it in place. */
  function setupBrowseHTML(def) {
    const catalog = BUSINESS_PROPERTIES[def.id];
    const country = catalog.countries.find((c) => c.id === setupFlow.countryId);
    const cityObj = country.cities.find((c) => c.name === setupFlow.city) || country.cities[0];
    const otherCountries = catalog.countries.filter((c) => c.id !== country.id);
    return `
      ${propertyBrowseHeaderHTML(country, otherCountries, cityObj, setupFlow.countryDropdownOpen)}
      <div class="biz-list">
        ${cityObj.properties.map((p, i) => propertyRowHTML(p, cityObj.name, i)).join('')}
      </div>`;
  }

  /** The shared premium listing template — a real-estate-style page: a
   *  full-bleed hero, a key-stats pill bar, an "About This Property"
   *  paragraph (the generated narrative description), a label/value
   *  details grid, and the amenities list — used both by the setup
   *  wizard's property screen (actionsHTML = Rent/Purchase buttons) and
   *  the read-only Properties browser (actionsHTML = ''). Every number is
   *  this property's own generated figure (js/data/properties.js
   *  propertyDetails) — nothing here is shared/generic across properties. */
  function propertyListingHTML(def, property, cityObj, country, storeIndex, actionsHTML) {
    const d = propertyDetails(property, cityObj.name, storeIndex);
    const biz = getBiz(def.id);
    const isActive = !!(biz.property && biz.property.propertyId === propertySlug(property.name));
    const ownedBy = isActive ? ((biz.brand && biz.brand.companyName) || def.name) : 'Available';
    const typeLabel = isActive && biz.brand && biz.brand.storeType
      ? ((STORE_TYPES.find((t) => t.id === biz.brand.storeType) || {}).label || def.name)
      : def.name;
    const capacity = Math.round(property.sqft / 100);
    const trafficIndex = Math.round(d.stats.dailyTraffic / 50);
    const dailyRent = d.financials.monthlyRent / 30;
    const favKey = favoriteKey(property, cityObj.name);
    const favActive = isFavorite(property, cityObj.name);

    return `
      <div class="biz-listing-hero">
        <div class="biz-listing-hero-art">${storefrontSVG(property, cityObj.name)}</div>
        <div class="biz-listing-hero-wash"></div>
        <div class="biz-listing-hero-scrim"></div>
        <button class="biz-fav-btn ${favActive ? 'is-fav' : ''}" data-setup-favorite="${favKey}" type="button"
          aria-label="Favorite this property" aria-pressed="${favActive}">${HEART_ICON}</button>
        <div class="biz-listing-hero-text">
          <div class="biz-listing-hero-name">${escapeHtml(property.name)}</div>
          <div class="biz-listing-hero-loc">${escapeHtml(cityObj.name)}, ${escapeHtml(country.name)}</div>
        </div>
      </div>
      <div class="biz-listing-body">
        <div class="biz-pills">
          <div class="biz-pill"><span class="biz-pill-label">Capacity</span><span class="biz-pill-value capacity">${capacity}</span></div>
          <div class="biz-pill"><span class="biz-pill-label">Traffic</span><span class="biz-pill-value traffic">${trafficIndex}</span></div>
          <div class="biz-pill"><span class="biz-pill-label">Amenities</span><span class="biz-pill-value amenities">${d.amenities.length}</span></div>
          <div class="biz-pill"><span class="biz-pill-label">Value</span><span class="biz-pill-value value">${formatMoney(d.financials.purchasePrice)}</span></div>
        </div>

        <div class="biz-listing-section-title about">About This Property</div>
        <p class="biz-listing-desc">${escapeHtml(d.description)}</p>

        <div class="biz-listing-section-title details">Property Details</div>
        <div class="biz-detail-grid">
          <div class="biz-detail-row"><span class="biz-detail-label">Owned By</span><span class="biz-detail-value">${escapeHtml(ownedBy)}</span></div>
          <div class="biz-detail-row"><span class="biz-detail-label">Type</span><span class="biz-detail-value">${escapeHtml(typeLabel)}</span></div>
          <div class="biz-detail-row"><span class="biz-detail-label">Condition</span><span class="biz-detail-value">${escapeHtml(d.stats.condition)}</span></div>
          <div class="biz-detail-row"><span class="biz-detail-label">Customer Capacity</span><span class="biz-detail-value mono">${capacity}</span></div>
          <div class="biz-detail-row"><span class="biz-detail-label">Traffic Index</span><span class="biz-detail-value mono">${trafficIndex}</span></div>
          <div class="biz-detail-row"><span class="biz-detail-label">Parking Spaces</span><span class="biz-detail-value mono">${d.stats.parking}</span></div>
          <div class="biz-detail-row"><span class="biz-detail-label">Hours Approved</span><span class="biz-detail-value">${escapeHtml(d.stats.hours)}</span></div>
          <div class="biz-detail-row"><span class="biz-detail-label">Daily Rent</span><span class="biz-detail-value mono">${formatMoney(dailyRent)}</span></div>
          <div class="biz-detail-row"><span class="biz-detail-label">Monthly Rent</span><span class="biz-detail-value mono">${formatMoney(d.financials.monthlyRent)}</span></div>
          <div class="biz-detail-row"><span class="biz-detail-label">Purchase Price</span><span class="biz-detail-value mono">${formatMoney(d.financials.purchasePrice)}</span></div>
          <div class="biz-detail-row"><span class="biz-detail-label">Est. Annual Revenue</span><span class="biz-detail-value mono">${formatMoney(d.financials.expectedAnnualRevenue)}</span></div>
        </div>

        <div class="biz-listing-section-title amenities">Amenities</div>
        <div class="biz-amenity-list">
          ${d.amenities.map((a) => `<span class="biz-amenity-pill">${escapeHtml(a)}</span>`).join('')}
        </div>

        ${actionsHTML}
      </div>`;
  }

  /** Stage 2's property screen: the shared listing, plus Rent/Purchase (or,
   *  once started, a confirmation card + "Continue to Step 3"). Both
   *  actions start the business the same way every other business starts
   *  (buyBusinessLevel, same baseCost) — the property is flavor and a
   *  chosen tenure, not a separate charge. */
  function setupPropertyHTML(def) {
    const catalog = BUSINESS_PROPERTIES[def.id];
    const country = catalog.countries.find((c) => c.id === setupFlow.countryId);
    const cityObj = country.cities.find((c) => c.name === setupFlow.city);
    const storeIndex = cityObj.properties.findIndex((p) => propertySlug(p.name) === setupFlow.propertyId);
    const property = cityObj.properties[storeIndex];
    const cost = businessNextCost(def);
    const canBuy = state.balance >= cost;
    const started = getBiz(def.id).level > 0;

    const actionsHTML = started ? `
        <div class="card" style="margin-top:6px">
          <div class="card-title">${setupFlow.tenure === 'purchase' ? 'Purchased' : 'Deposit Paid'}</div>
          <div class="progress-caption" style="text-align:left;margin-top:4px">${property.name} is now open for business.</div>
        </div>
        <button class="btn btn-wide btn-gold" data-setup-continue-stage type="button">Continue to Step 3 ›</button>`
      : `
        <button class="btn btn-wide ${canBuy ? 'btn-deposit' : ''}" data-setup-rent type="button" ${canBuy ? '' : 'disabled'}>
          Pay Deposit · ${formatMoney(cost)}</button>
        <button class="btn btn-wide ${canBuy ? 'btn-gold' : ''}" data-setup-purchase type="button" ${canBuy ? '' : 'disabled'}>
          Buy Now · ${formatMoney(cost)}</button>`;

    return propertyListingHTML(def, property, cityObj, country, storeIndex, actionsHTML);
  }

  /** Stage 1, ONE scrollable page: numbered step cards for store type,
   *  company name, and suppliers (placeholder). Selecting a type
   *  re-renders in place (storeType is part of render()'s lastRenderKey)
   *  — the name field is snapshotted into setupFlow.companyName first so
   *  a still-unsaved typed name survives that re-render (see
   *  onSetupClick's d.setupType handler). "Continue to Step 2" (enabled
   *  once a type is picked) snapshots the name one more time and moves on
   *  to Property. */
  function setupDetailsHTML(def) {
    const nameVal = setupFlow.companyName || def.name;
    const typeDone = !!setupFlow.storeType;
    return `
      <div class="section-head" style="margin-top:14px"><h2>Business Details</h2></div>
      <div class="progress-caption" style="text-align:left;margin:0 2px 18px">Everything ${escapeHtml(def.name)} needs before picking a property — one page, no rush.</div>

      <div class="biz-step-card ${typeDone ? 'is-done' : ''}">
        <div class="biz-step-head">
          <span class="biz-step-badge">01</span>
          <div class="biz-step-titles">
            <div class="biz-step-title">Store Type</div>
            <div class="biz-step-sub">What will it primarily sell?</div>
          </div>
          <span class="biz-step-check">${typeDone ? '✓' : ''}</span>
        </div>
        <div class="biz-step-body">
          <div class="biz-type-grid">
            ${STORE_TYPES.map((t) => `
              <button class="biz-type-chip ${setupFlow.storeType === t.id ? 'is-active' : ''}" data-setup-type="${t.id}" type="button">${t.label}</button>`).join('')}
          </div>
        </div>
      </div>

      <div class="biz-step-card is-done">
        <div class="biz-step-head">
          <span class="biz-step-badge">02</span>
          <div class="biz-step-titles">
            <div class="biz-step-title">Company Name</div>
            <div class="biz-step-sub">Shown to customers above the door.</div>
          </div>
          <span class="biz-step-check">✓</span>
        </div>
        <div class="biz-step-body">
          <input class="mk-text-input" data-company-name-input type="text" maxlength="40"
            value="${escapeAttr(nameVal)}" placeholder="${escapeAttr(def.name)}" autocomplete="off">
        </div>
      </div>

      <div class="biz-step-card">
        <div class="biz-step-head">
          <span class="biz-step-badge">03</span>
          <div class="biz-step-titles">
            <div class="biz-step-title">Suppliers</div>
            <div class="biz-step-sub">Sourcing deals and contracts.</div>
          </div>
        </div>
        <div class="biz-step-body">
          <div class="coming-soon" style="padding:26px 12px">
            <div class="cs-badge">COMING SOON</div>
            <p class="muted">No suppliers hooked up yet — on the way.</p>
          </div>
        </div>
      </div>

      <button class="btn btn-wide btn-gold" data-setup-continue-stage type="button" ${typeDone ? '' : 'disabled'}>Continue to Step 2 ›</button>`;
  }

  /** Stage 3 (the last step): draw a signature on the canvas to finish.
   *  Drawing itself is wired via delegated pointer listeners at mount time
   *  (onSignaturePointerDown/Move/Up — see the section below) rather than
   *  re-wired on every render, since the canvas element is only created
   *  once per visit to this screen (render()'s lastRenderKey doesn't
   *  change while drawing), so strokes persist. "Finish Setup" starts
   *  disabled — the first stroke enables it directly via the DOM (see
   *  onSignaturePointerDown), not through a full re-render, which would
   *  wipe the canvas. */
  function setupSignatureHTML(def) {
    const name = setupFlow.companyName || def.name;
    return `
      <div class="section-head" style="margin-top:14px"><h2>Sign to Confirm</h2></div>
      <div class="progress-caption" style="text-align:left;margin:0 2px 18px">Draw your signature below to officially open ${escapeHtml(name)}.</div>
      <div class="biz-sig-wrap">
        <canvas class="biz-sig-canvas" data-signature-canvas></canvas>
      </div>
      <div class="biz-sig-hint">Sign with your finger above</div>
      <div class="biz-sig-actions">
        <button class="btn" data-setup-signature-clear type="button">Clear</button>
        <button class="btn btn-wide btn-gold" data-setup-finish type="button" disabled>Finish Setup</button>
      </div>`;
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

  /** Computed per-device, per-orientation:
   *   - Portrait (screen taller than wide, the common case): COVER sizing
   *     (like CSS object-fit:cover) — the smallest width at which the map's
   *     rendered height ALSO covers the full viewport height, so the
   *     fully-zoomed-out state never shows blank space above/below (the map
   *     is landscape-shaped, a plain "fit to width" would leave a big gap).
   *   - Landscape (screen wider than tall): CONTAIN sizing instead — the
   *     map's full scale stays visible (letterboxed on the sides if the
   *     screen is proportionally even wider than the map) rather than
   *     cropping any of it away, since a landscape screen is often already
   *     close to the map's own wide aspect ratio.
   *  Max is a fixed multiple of whichever minimum applies, so zoom depth
   *  scales with the device too — enough to make even a tiny island nation
   *  (Mauritius) a real tap target. */
  function computeMapZoomBounds() {
    const vw = (typeof window !== 'undefined' && window.innerWidth) || 400;
    const vh = (typeof window !== 'undefined' && window.innerHeight) || 800;
    const heightMatchedWidthPx = vh / MAP_ASPECT;
    const neededPx = vw > vh
      ? Math.min(vw, heightMatchedWidthPx)  // landscape: contain (may letterbox)
      : Math.max(vw, heightMatchedWidthPx); // portrait: cover (crops width)
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

  /** Pressing and holding a zoom button (past ZOOM_HOLD_DELAY_MS, so a quick
   *  tap still just does the one discrete zoomStep above) zooms smoothly,
   *  a small step every animation frame, until released. */
  function onZoomPointerDown(e) {
    if (!mapOpen) return;
    const btn = e.target.closest && e.target.closest('.biz-worldmap-zoom-btn');
    if (!btn) return;
    const dir = btn.dataset.mapZoom === 'in' ? 1 : -1;
    zoomHoldTimer = setTimeout(() => startZoomHold(dir), ZOOM_HOLD_DELAY_MS);
  }

  function startZoomHold(dir) {
    zoomHoldActive = true;
    const step = () => {
      if (!zoomHoldActive) return;
      setMapWidth(mapWidthVw * (dir > 0 ? ZOOM_HOLD_STEP : 1 / ZOOM_HOLD_STEP));
      raf(step);
    };
    raf(step);
  }

  function stopZoomHold() {
    if (zoomHoldTimer) { clearTimeout(zoomHoldTimer); zoomHoldTimer = null; }
    zoomHoldActive = false;
  }

  /* ------------------------- Signature pad (Step 3) ---------------------- */

  function signatureCanvasEl() {
    return container && container.querySelector ? container.querySelector('[data-signature-canvas]') : null;
  }

  function finishButtonEl() {
    return container && container.querySelector ? container.querySelector('[data-setup-finish]') : null;
  }

  /** The first stroke unlocks Finish Setup — a direct DOM patch (not a
   *  render()) so it doesn't touch/recreate the canvas mid-draw. */
  function enableFinishButton() {
    const btn = finishButtonEl();
    if (!btn) return;
    btn.disabled = false;
    if (btn.removeAttribute) btn.removeAttribute('disabled');
  }

  function disableFinishButton() {
    const btn = finishButtonEl();
    if (!btn) return;
    btn.disabled = true;
    if (btn.setAttribute) btn.setAttribute('disabled', '');
  }

  /** Sizes the canvas's backing pixel buffer to match its on-screen box,
   *  devicePixelRatio-aware so strokes stay crisp on phones — same approach
   *  as chart.js's canvas. Called once right after the signature screen's
   *  HTML is created. */
  function setupSignatureCanvas() {
    const canvas = signatureCanvasEl();
    if (!canvas || typeof canvas.getContext !== 'function') return;
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const w = canvas.clientWidth || 300;
    const h = canvas.clientHeight || 200;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  function signatureStrokeColor() {
    if (typeof getComputedStyle !== 'function' || typeof document === 'undefined') return '#F4F4F3';
    const v = getComputedStyle(document.documentElement).getPropertyValue('--text');
    return (v && v.trim()) || '#F4F4F3';
  }

  function signaturePoint(canvas, e) {
    const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onSignaturePointerDown(e) {
    if (!setupFlow || setupFlow.step !== 'signature') return;
    const canvas = e.target.closest && e.target.closest('[data-signature-canvas]');
    if (!canvas) return;
    e.preventDefault();
    sigDrawing = true;
    const p = signaturePoint(canvas, e);
    sigLastX = p.x; sigLastY = p.y;
    drawSignatureSegment(canvas, p.x, p.y, p.x + 0.01, p.y + 0.01); // a tap still leaves a dot
    enableFinishButton();
  }

  function onSignaturePointerMove(e) {
    if (!sigDrawing) return;
    const canvas = e.target.closest && e.target.closest('[data-signature-canvas]');
    if (!canvas) return;
    e.preventDefault();
    const p = signaturePoint(canvas, e);
    drawSignatureSegment(canvas, sigLastX, sigLastY, p.x, p.y);
    sigLastX = p.x; sigLastY = p.y;
  }

  function onSignaturePointerUp() {
    sigDrawing = false;
  }

  function drawSignatureSegment(canvas, x0, y0, x1, y1) {
    if (typeof canvas.getContext !== 'function') return;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = signatureStrokeColor();
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  function clearSignatureCanvas() {
    const canvas = signatureCanvasEl();
    if (!canvas || typeof canvas.getContext !== 'function') return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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

      <button class="card hub-card" data-biz-nav="properties" type="button" aria-label="Open Properties">
        <span class="hub-logo">${PROPERTY_ICON}</span>
        <span class="hub-text">
          <span class="hub-title">Properties</span>
          <span class="hub-sub">The property you own for each of your businesses</span>
        </span>
        <span class="hub-arrow">›</span>
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
      ? `${MAP_COLOR_DEFS}<div class="biz-worldmap-scroll">${worldMapSvg}</div>`
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
          Start Business</button>
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
