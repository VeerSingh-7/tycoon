/* =========================================================================
 * businesses.js — Business tab: header, management, business cards
 * -------------------------------------------------------------------------
 * Fully data-driven from BUSINESS_DEFS. Cards come in three flavours:
 *   locked     — player level too low ("Unlocks at Level N")
 *   available  — can be started (needs money + a free business slot)
 *   owned      — level/income/staff/mechanic/upgrades/sell
 *
 * Events use DELEGATION on the container so the 2x/sec re-render (needed for
 * mechanic countdowns) never orphans listeners.
 * ========================================================================= */

const Businesses = (() => {
  let container;

  function mount(el) {
    container = el;
    container.addEventListener('click', onClick);
    render();
  }

  /* ------------------------- Event delegation ------------------------- */

  function onClick(e) {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    const d = btn.dataset;
    let changed = false;

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
    container.innerHTML = bizTabHTML();
  }

  function bizTabHTML() {
    const level = playerLevel();
    let html = `
      <div class="section-head">
        <h2>Businesses</h2>
        <div class="section-stat">${formatRate(totalBusinessIncomePerSec())}</div>
      </div>
      <div class="biz-list">
    `;
    for (const def of BUSINESS_DEFS) html += businessCardHTML(def, level);
    html += '</div>';
    return html;
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
