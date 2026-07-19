/* =========================================================================
 * assetstab.js — Phase 5 UI: the Assets tab (Real Estate + Luxury)
 * -------------------------------------------------------------------------
 * Two sections behind a toggle. Every item card contains an <img> pointed
 * at img/assets/<id>.png (hidden on 404) over a coloured placeholder — drop
 * an image file in and it appears, no code changes.
 * ========================================================================= */

const AssetsTab = (() => {
  const view = { section: 'estate' }; // survives tab switches
  let container = null;

  function mount(el) {
    container = el;
    container.addEventListener('click', onClick);
    render();
  }

  function onClick(e) {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    const d = btn.dataset;
    let changed = false;

    if (d.section) { view.section = d.section; render(); return; }
    else if (d.buyestate) changed = Assets.buyEstate(d.buyestate);
    else if (d.sellestate) changed = Assets.sellEstate(d.sellestate);
    else if (d.buylux) changed = Assets.buyLuxury(d.buylux);

    if (changed) {
      UI.renderBalance();
      render();
    }
  }

  /** The drop-in image hook: hidden if img/assets/<id>.png doesn't exist. */
  function imgHTML(id) {
    return `<img class="asset-img" src="img/assets/${id}.png" alt="" loading="lazy"
      onerror="this.style.display='none'">`;
  }

  function plSign(v) { return v >= 0 ? '+' : ''; }

  /* ------------------------------ Render ------------------------------ */

  function render() {
    if (!container) return;
    const chips = `
      <div class="chip-row invest-filters">
        <button class="chip ${view.section === 'estate' ? 'chip-active' : ''}" data-section="estate">🏠 Real Estate</button>
        <button class="chip ${view.section === 'luxury' ? 'chip-active' : ''}" data-section="luxury">💎 Luxury</button>
      </div>`;
    container.innerHTML = `
      <div class="section-head">
        <h2>Assets</h2>
        <div class="section-stat">${formatMoney(state.balance)} cash</div>
      </div>
      ${chips}
      ${view.section === 'estate' ? estateHTML() : luxuryHTML()}
    `;
  }

  /* --------------------------- Real estate ---------------------------- */

  function estateHTML() {
    const sum = Assets.estateSummary();
    let html = `
      <div class="card">
        <div class="card-row">
          <div>
            <div class="card-title">🏠 Property Portfolio</div>
            <div class="card-sub">${sum.units} unit${sum.units === 1 ? '' : 's'} · basis ${formatMoney(sum.cost)}</div>
          </div>
          <div class="pf-numbers">
            <div class="pf-value">${formatMoney(sum.value)}</div>
            <div class="pf-pl ${sum.pl >= 0 ? 'up' : 'down'}">${plSign(sum.pl)}${formatMoney(sum.pl)} · rent ${formatRate(Assets.rentPerSec())}</div>
          </div>
        </div>
      </div>`;

    for (const def of ESTATE_DEFS) html += estateCardHTML(def);
    return html;
  }

  function estateCardHTML(def) {
    const rec = state.assets.estate[def.id] || { count: 0, cost: 0 };
    const value = Assets.unitValue(def);
    const canBuy = state.balance >= value;
    // ROI: how long one unit's rent takes to pay back its market price.
    const paybackSec = value / def.rentPerSec;
    const sellNet = value * (1 - ASSETS_CFG.ESTATE_SELL_FEE);

    return `
      <div class="card asset-card">
        <div class="asset-visual" style="--ph: hsl(${140 + def.tier * 30}, 30%, 22%)">
          ${imgHTML(def.id)}
          <span class="asset-visual-icon">${def.icon}</span>
          ${rec.count > 0 ? `<span class="owned-badge">×${rec.count}</span>` : ''}
        </div>
        <div class="asset-body">
          <div class="asset-sym">${def.name}</div>
          <div class="mult-row"><span>Market value</span><b>${formatMoney(value)} <span class="up">+${(def.apprPerDay * 100).toFixed(1)}%/day</span></b></div>
          <div class="mult-row"><span>Rent per unit</span><b class="gold">${formatRate(def.rentPerSec)}</b></div>
          <div class="mult-row"><span>ROI payback</span><b>${formatDuration(paybackSec)}</b></div>
          <div class="chip-row">
            <button class="btn btn-sm ${canBuy ? 'btn-gold' : ''}" data-buyestate="${def.id}" ${canBuy ? '' : 'disabled'}>
              Buy ${formatMoney(value)}</button>
            ${rec.count > 0 ? `<button class="btn btn-sm" data-sellestate="${def.id}">Sell ${formatMoney(sellNet)}</button>` : ''}
          </div>
        </div>
      </div>`;
  }

  /* ------------------------------ Luxury ------------------------------- */

  function luxuryHTML() {
    const prog = Assets.collectionProgress();
    const pct = ((prog.owned / prog.total) * 100).toFixed(0);
    let html = `
      <div class="card">
        <div class="card-row">
          <div>
            <div class="card-title">💎 Collection</div>
            <div class="card-sub">Complete sets for permanent income bonuses</div>
          </div>
          <div class="pf-numbers">
            <div class="pf-value">${prog.owned}/${prog.total}</div>
            <div class="pf-pl gold">×${Assets.luxuryMultiplier().toFixed(2)} active</div>
          </div>
        </div>
        <div class="progress"><div class="progress-fill" style="width:${pct}%"></div></div>
      </div>`;

    for (const set of LUXURY_SETS) html += setHTML(set);
    return html;
  }

  function setHTML(set) {
    const p = Assets.setProgress(set.id);
    const complete = p.owned === p.total;
    const items = LUXURY_DEFS.filter((d) => d.set === set.id);
    const cards = items.map((d) => luxuryCardHTML(d, set)).join('');
    return `
      <div class="section-head lux-set-head">
        <h2 class="lux-set-title">${set.icon} ${set.name}</h2>
        <div class="section-stat ${complete ? 'gold' : ''}">${p.owned}/${p.total} · ×${set.bonus}${complete ? ' ✓' : ''}</div>
      </div>
      <div class="ach-grid">${cards}</div>`;
  }

  function luxuryCardHTML(def, set) {
    const owned = Assets.ownsLuxury(def.id);
    const canBuy = !owned && state.balance >= def.price;
    return `
      <div class="ach-card asset-card lux-card ${owned ? 'ach-done' : ''}">
        <div class="asset-visual lux-visual" style="--ph: hsl(${set.hue}, 35%, 24%)">
          ${imgHTML(def.id)}
          <span class="asset-visual-icon">${set.icon}</span>
        </div>
        <div class="ach-name">${def.name}</div>
        ${owned
          ? '<div class="ach-reward">Owned ✓</div>'
          : `<button class="btn btn-sm ${canBuy ? 'btn-gold' : ''}" data-buylux="${def.id}" ${canBuy ? '' : 'disabled'}>${formatMoney(def.price)}</button>`}
      </div>`;
  }

  return { mount, render };
})();
