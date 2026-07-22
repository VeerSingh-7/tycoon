/* =========================================================================
 * assetstab.js — The Luxury tab: the collectible sets
 * -------------------------------------------------------------------------
 * Real estate moved to the Invest tab (it's an investment). This tab is now
 * just the luxury collection: one-off collectibles grouped into sets, where
 * completing a set grants a permanent global income multiplier.
 *
 * Every item card contains an <img> pointed at img/assets/<id>.png (hidden on
 * 404) over a coloured placeholder — drop an image file in and it appears,
 * no code changes.
 * ========================================================================= */

const AssetsTab = (() => {
  let container = null;

  function mount(el) {
    container = el;
    container.addEventListener('click', onClick);
    render();
  }

  function onClick(e) {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    if (btn.dataset.buylux && Assets.buyLuxury(btn.dataset.buylux)) {
      UI.renderBalance();
      render();
    }
  }

  /* ------------------------------ Render ------------------------------ */

  function render() {
    if (!container) return;
    container.innerHTML = `
      <div class="section-head">
        <h2>Luxury</h2>
        <div class="section-stat">${formatMoney(state.balance)} cash</div>
      </div>
      ${luxuryHTML()}
    `;
  }

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
    const rows = items.map((d) => luxuryRowHTML(d, set)).join('');
    return `
      <div class="section-head lux-set-head">
        <h2 class="lux-set-title">${set.icon} ${set.name}</h2>
        <div class="section-stat ${complete ? 'gold' : ''}">${p.owned}/${p.total} · ×${set.bonus}${complete ? ' ✓' : ''}</div>
      </div>
      <div class="asset-list">${rows}</div>`;
  }

  /** One collectible as a flush row — same language as the market lists. */
  function luxuryRowHTML(def, set) {
    const owned = Assets.ownsLuxury(def.id);
    const canBuy = !owned && state.balance >= def.price;
    return `
      <div class="asset-row lux-row ${owned ? 'is-owned' : ''}">
        <span class="logo-tile estate-tile" style="--ph:hsl(${set.hue}, 45%, 52%)"><span class="estate-emoji">${set.icon}</span></span>
        <div class="asset-name-wrap">
          <div class="asset-sym">${def.name}</div>
          <div class="asset-name">${owned ? 'Owned' : set.name}</div>
        </div>
        <div class="asset-price-wrap">
          ${owned
            ? '<div class="asset-change up">Owned ✓</div>'
            : `<button class="btn btn-sm ${canBuy ? 'btn-gold' : ''}" data-buylux="${def.id}" ${canBuy ? '' : 'disabled'}>${formatMoney(def.price)}</button>`}
        </div>
      </div>`;
  }

  return { mount, render };
})();
