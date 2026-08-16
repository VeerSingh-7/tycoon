/* =========================================================================
 * businesses.js — Business tab: header, world map teaser, business cards
 * -------------------------------------------------------------------------
 * Fully data-driven from BUSINESS_DEFS. Cards come in three flavours:
 *   locked     — player level too low ("Unlocks at Level N")
 *   available  — can be started (needs money + a free business slot)
 *   owned      — level/income/staff/mechanic/upgrades/sell
 *
 * Two entry points sit above the list: "My Businesses" (owned only) and
 * "Businesses You Can Own" (the full catalog, same three-flavour cards as
 * before) — a UI-only filter (listMode), not persisted, reset on every
 * mount() same as the rest of the app's per-screen view state.
 *
 * The World Map card is a placeholder teaser (same "Coming Soon" pattern as
 * js/banking.js etc.) for a future feature showing where each business is
 * located on a real map — no location data or map rendering exists yet.
 *
 * Events use DELEGATION on the container so the 2x/sec re-render (needed for
 * mechanic countdowns) never orphans listeners.
 * ========================================================================= */

const Businesses = (() => {
  let container;
  let listMode = 'all'; // 'all' | 'mine' — which businesses the list below shows
  let mapOpen = false;  // World Map "Coming Soon" overlay

  const MAP_ICON = `<svg viewBox="0 0 40 40" class="hub-logo-svg" aria-hidden="true">
        <circle cx="17" cy="20" r="12" fill="currentColor" fill-opacity="0.15" stroke="currentColor" stroke-width="2.4"/>
        <path d="M5 20 L29 20" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M17 8 C22 13 22 27 17 32 C12 27 12 13 17 8 Z" fill="none" stroke="currentColor" stroke-width="1.6"/>
        <path d="M30 10 C34.5 10 38 13.5 38 18 C38 23.5 30 33 30 33 C30 33 22 23.5 22 18 C22 13.5 25.5 10 30 10 Z"
          fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`;

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
    listMode = 'all';
    mapOpen = false;
    render();
  }

  /* ------------------------- Event delegation ------------------------- */

  function onClick(e) {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    const d = btn.dataset;
    let changed = false;

    if (d.bizNav === 'map') { mapOpen = true; render(); return; }
    if (d.bizNav === 'closeMap') { mapOpen = false; render(); return; }
    if (d.bizNav === 'all' || d.bizNav === 'mine') { listMode = d.bizNav; render(); return; }

    if (d.manage) { if (typeof BizDash !== 'undefined') BizDash.open(d.manage); return; }
    else if (d.buy) changed = buyBusinessLevel(d.buy);
    else if (d.upgrade) changed = buyBusinessUpgrade(d.biz, d.upgrade);
    else if (d.hire) changed = hireStaff(d.hire);
    else if (d.sell) {
      const def = BUSINESS_BY_ID[d.sell];
      const refund = SELL_REFUND_RATE * businessSpentOnLevels(def);
      if (confirm(`Sell ${def.name} for ${formatMoney(refund)}? This frees a business slot but resets its progress.`)) {
        changed = sellBusiness(d.sell);
      }
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

  function render() {
    if (!container) return;
    container.innerHTML = mapOpen ? mapHTML() : bizTabHTML();
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

      <button class="card hub-card biz-map-card" data-biz-nav="map" type="button" aria-label="Open World Map">
        <span class="hub-logo">${MAP_ICON}</span>
        <span class="hub-text">
          <span class="hub-title">World Map</span>
          <span class="hub-sub">See where your empire operates around the globe</span>
        </span>
        <span class="hub-arrow">›</span>
      </button>

      <div class="stat-grid biz-nav-grid">
        <button class="stat-cell biz-nav-cell ${listMode === 'mine' ? 'on' : ''}" data-biz-nav="mine" type="button">
          <span>My Businesses</span>
          <b>${owned.length} owned</b>
        </button>
        <button class="stat-cell biz-nav-cell ${listMode === 'all' ? 'on' : ''}" data-biz-nav="all" type="button">
          <span class="biz-nav-condensed">Businesses You Can Own</span>
          <b>${BUSINESS_DEFS.length} total</b>
        </button>
      </div>

      <div class="biz-list">
    `;
    if (listMode === 'mine' && defs.length === 0) {
      html += `<div class="bizd-empty">You don't own any businesses yet — tap "Businesses You Can Own" to get started.</div>`;
    } else {
      for (const def of defs) html += businessCardHTML(def, level);
    }
    html += '</div>';
    return html;
  }

  /** World Map — placeholder teaser, same "Coming Soon" pattern as the
   *  Services placeholders (js/banking.js etc). No location data yet. */
  function mapHTML() {
    return `
      <div class="bizd-screen">
        <div class="bizd-head">
          <button class="icon-btn" data-biz-nav="closeMap" type="button" aria-label="Close">✕</button>
          <div class="bizd-id">
            <div class="bizd-co-name">World Map</div>
            <div class="bizd-co-sub">Your business empire, worldwide</div>
          </div>
        </div>
        ${WORLD_MAP_SVG}
        <div class="coming-soon">
          <div class="cs-badge">COMING SOON</div>
          <h2>World Map</h2>
          <p>A real map showing exactly where each of your businesses is located and operating around the world.</p>
          <p class="muted">Keep growing — every business you start will show up here.</p>
        </div>
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
          <div class="biz-icon">${def.icon}</div>
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
          <div class="biz-icon">${def.icon}</div>
          <div class="biz-title-wrap">
            <div class="biz-name">${def.name}</div>
            <div class="biz-blurb">${def.blurb}</div>
          </div>
        </div>
        <div class="biz-stats">
          <div><span class="muted">Income at Lv 1</span><b class="gold">${formatRate(def.baseIncome)}</b></div>
          <div><span class="muted">Startup</span><b>${formatMoney(cost)}</b></div>
        </div>
        <button class="btn btn-wide ${canBuy ? 'btn-gold' : ''}" data-buy="${def.id}" ${canBuy ? '' : 'disabled'}>
          Start Business · ${formatMoney(cost)}</button>
        ${slotFree ? '' : '<div class="progress-caption">⚠️ No free business slot — level up or sell a business.</div>'}
      </div>`;
  }

  /* Owned: a compact summary — everything (staff/mechanic/upgrades/sell)
   * lives on the dedicated page (js/bizdash.js). Leveling is retired (no
   * more "Buy Level" purchase) — income is whatever it is at the level the
   * business is already at, frozen, ahead of a future business-tab rebuild. */
  function ownedCardHTML(def, biz) {
    const net = businessIncomePerSec(def);

    return `
      <div class="card biz-card">
        <div class="biz-head">
          <div class="biz-icon">${def.icon}</div>
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
