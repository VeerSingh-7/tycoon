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

  /** The drop-in image hook: hidden if img/assets/<id>.png doesn't exist. */
  function imgHTML(id) {
    return `<img class="asset-img" src="img/assets/${id}.png" alt="" loading="lazy"
      onerror="this.style.display='none'">`;
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
