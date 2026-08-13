/* =========================================================================
 * shop.js — Shop & Upgrades (Services → Invest → Shop & Upgrades)
 * -------------------------------------------------------------------------
 * Placeholder only — "Coming Soon" detail page, same pattern the other
 * Services entries used before they were built out (see js/hiring.js and
 * js/marketing.js for the real thing once this one gets built). No logic,
 * no data models, no persisted state.
 * ========================================================================= */

const Shop = (() => {
  function mount(el) {
    el.innerHTML = `
      <div class="coming-soon">
        <div class="cs-badge">COMING SOON</div>
        <h2>Shop &amp; Upgrades</h2>
        <p>Premium upgrades, cosmetics, and boosts for your empire.</p>
        <p class="muted">This service is on the way.</p>
      </div>
    `;
  }
  return { mount };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Shop;
