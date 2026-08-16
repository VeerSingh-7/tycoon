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

      <button class="card hub-card" data-biz-nav="map" type="button" aria-label="Open World Map">
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
          <span>Businesses You Can Own</span>
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

  /* Owned: a compact summary — quick-buy stays here for the idle-clicking
   * loop, everything else (staff/mechanic/upgrades/sell) lives on the
   * dedicated page (js/bizdash.js) — mirrors how the stock side's list row
   * keeps buy/sell inline while any deeper management lives elsewhere. */
  function ownedCardHTML(def, biz) {
    const net = businessIncomePerSec(def);
    const nextCost = businessNextCost(def);
    const canBuy = state.balance >= nextCost;
    const ms = nextMilestone(biz.level);

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
          <div><span class="muted">Next level</span><b>${formatMoney(nextCost)}</b></div>
        </div>

        <button class="btn btn-wide ${canBuy ? 'btn-gold' : ''}" data-buy="${def.id}" ${canBuy ? '' : 'disabled'}>
          Buy Level ${biz.level + 1} · ${formatMoney(nextCost)}</button>
        <div class="progress-caption">💥 Output ×2 at Lv ${ms} (milestone)</div>

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
          ? '<span class="pill pill-locked">Level up</span>'
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
