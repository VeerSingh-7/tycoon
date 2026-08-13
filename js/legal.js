/* =========================================================================
 * legal.js — Legal & Compliance (Services → Invest → Legal & Compliance)
 * -------------------------------------------------------------------------
 * Placeholder only — "Coming Soon" detail page, same pattern the other
 * Services entries used before they were built out (see js/hiring.js and
 * js/marketing.js for the real thing once this one gets built). No logic,
 * no data models, no persisted state.
 * ========================================================================= */

const Legal = (() => {
  function mount(el) {
    el.innerHTML = `
      <div class="coming-soon">
        <div class="cs-badge">COMING SOON</div>
        <h2>Legal &amp; Compliance</h2>
        <p>Contracts, lawsuits, patents, and regulatory risk across your empire.</p>
        <p class="muted">This service is on the way.</p>
      </div>
    `;
  }
  return { mount };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Legal;
