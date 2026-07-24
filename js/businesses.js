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
  const view = { tab: 'biz' }; // 'biz' | 'estate' — survives re-renders

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

    if (d.biztab) { view.tab = d.biztab; render(); return; }
    else if (d.buy) changed = buyBusinessLevel(d.buy);
    else if (d.upgrade) changed = buyBusinessUpgrade(d.biz, d.upgrade);
    else if (d.hire) changed = hireStaff(d.hire);
    else if (d.mgmt !== undefined) changed = buyManagementUpgrade();
    else if (d.buyestate) changed = Assets.buyEstate(d.buyestate);
    else if (d.sellestate) changed = Assets.sellEstate(d.sellestate);
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

  const tabToggleHTML = () => {
    const seg = (id, label) => `<button class="seg ${view.tab === id ? 'seg-active' : ''}" data-biztab="${id}">${label}</button>`;
    return `<div class="seg-row">${seg('biz', 'Businesses')}${seg('estate', 'Real Estate')}</div>`;
  };

  function render() {
    if (!container) return;
    container.innerHTML = view.tab === 'estate' ? estateTabHTML() : bizTabHTML();
  }

  function bizTabHTML() {
    const level = playerLevel();
    let html = `
      <div class="section-head">
        <h2>Businesses</h2>
        <div class="section-stat">${formatRate(totalBusinessIncomePerSec())}</div>
      </div>
      ${tabToggleHTML()}
      ${headerHTML(level)}
      ${managementHTML()}
      <div class="biz-list">
    `;
    for (const def of BUSINESS_DEFS) html += businessCardHTML(def, level);
    html += '</div>';
    return html;
  }

  /* --------------------------- Real estate ---------------------------- */
  // Buy property units for rent + appreciation. Rent feeds passive income
  // (engine.totalPassiveIncomePerSec) exactly as before — only the UI moved
  // here from the Invest tab.

  function estateTabHTML() {
    Assets.ensure();
    const sum = Assets.estateSummary();
    let html = `
      <div class="section-head">
        <h2>Real Estate</h2>
        <div class="section-stat">${formatRate(Assets.rentPerSec())} rent</div>
      </div>
      ${tabToggleHTML()}
      <div class="card">
        <div class="card-row">
          <div>
            <div class="card-title">🏠 Property Portfolio</div>
            <div class="card-sub">${sum.units} unit${sum.units === 1 ? '' : 's'} · invested ${formatMoney(sum.cost)}</div>
          </div>
          <div class="pf-numbers">
            <div class="pf-value">${formatMoney(sum.value)}</div>
            <div class="pf-pl ${sum.pl >= 0 ? 'up' : 'down'}">${sum.pl >= 0 ? '+' : '-'}${formatMoney(Math.abs(sum.pl))}</div>
          </div>
        </div>
      </div>`;
    for (const def of ESTATE_DEFS) html += estateCardHTML(def);
    return html;
  }

  function estateCardHTML(def) {
    const rec = (state.assets.estate && state.assets.estate[def.id]) || { count: 0, cost: 0 };
    const value = Assets.unitValue(def);
    const canBuy = state.balance >= value;
    const paybackSec = value / def.rentPerSec;
    const sellNet = value * (1 - ASSETS_CFG.ESTATE_SELL_FEE);
    return `
      <div class="card asset-card">
        <div class="asset-visual" style="--ph: hsl(${140 + def.tier * 30}, 42%, 44%)">
          <span class="asset-visual-icon">${def.icon}</span>
          ${rec.count > 0 ? `<span class="owned-badge">×${rec.count}</span>` : ''}
        </div>
        <div class="asset-body">
          <div class="asset-sym">${def.name}</div>
          <div class="mult-row"><span>Market value</span><b>${formatMoney(value)} <span class="up">+${(def.apprPerDay * 100).toFixed(1)}%/day</span></b></div>
          <div class="mult-row"><span>Rent per unit</span><b class="gold">${formatRate(def.rentPerSec)}</b></div>
          <div class="mult-row"><span>ROI payback</span><b>${formatDuration(paybackSec)}</b></div>
          <div class="chip-row">
            <button class="btn btn-sm ${canBuy ? 'btn-gold' : ''}" data-buyestate="${def.id}" ${canBuy ? '' : 'disabled'}>Buy ${formatMoney(value)}</button>
            ${rec.count > 0 ? `<button class="btn btn-sm" data-sellestate="${def.id}">Sell ${formatMoney(sellNet)}</button>` : ''}
          </div>
        </div>
      </div>`;
  }

  /** Player level + XP progress + slot usage. */
  function headerHTML(level) {
    const pct = (playerLevelProgress() * 100).toFixed(1);
    return `
      <div class="card meta-card">
        <div class="card-row">
          <div>
            <div class="card-title">Level ${level} ${Progression.currentTitle().name}</div>
            <div class="card-sub">Slots: <b class="gold">${usedSlots()}/${maxSlots()}</b> · next slot every 2 levels</div>
          </div>
          <div class="xp-num">${formatMoney(state.totalEarned)} <span class="muted">earned</span></div>
        </div>
        <div class="progress"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="progress-caption">Level ${level + 1} at ${formatMoney(xpForLevel(level + 1))} lifetime earnings</div>
      </div>`;
  }

  /** Global management upgrade card (staff efficiency). */
  function managementHTML() {
    const cost = managementUpgradeCost();
    const eff = Math.round(STAFF_OUTPUT_BONUS * 100 * (1 + MGMT_EFFICIENCY_PER_LEVEL * state.managementLevel));
    const afford = state.balance >= cost;
    return `
      <div class="card">
        <div class="card-row">
          <div>
            <div class="card-title">🧑‍💼 Management · Lv ${state.managementLevel}</div>
            <div class="card-sub">Each employee gives +${eff}% output. Upgrade: +25% staff efficiency (all businesses).</div>
          </div>
          <button class="btn btn-sm ${afford ? 'btn-gold' : ''}" data-mgmt ${afford ? '' : 'disabled'}>${formatMoney(cost)}</button>
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

  /* Owned: the full management view. */
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

        ${staffHTML(def, biz)}
        ${Mechanics.panelHTML(def)}
        <div class="upgrade-list">${upgradesHTML(def, biz)}</div>
        <button class="sell-link" data-sell="${def.id}">Sell business (25% refund, frees slot)</button>
      </div>`;
  }

  /** Employees row: hire, salaries, capacity. */
  function staffHTML(def, biz) {
    const cap = maxStaff(def);
    const cost = hireCost(def);
    const salaries = businessSalariesPerSec(def);
    const canHire = biz.staff < cap && state.balance >= cost;
    const boostPct = Math.round((staffBoost(def) - 1) * 100);
    return `
      <div class="staff-row">
        <div class="upgrade-info">
          <span class="upgrade-name">👥 Staff ${biz.staff}/${cap} <span class="up">+${boostPct}%</span></span>
          <span class="upgrade-desc">Salaries ${formatRate(salaries)} · +1 slot per 5 levels</span>
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

  return { mount, render };
})();
