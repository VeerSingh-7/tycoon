/* =========================================================================
 * banking.js — Banking & Finance (Services → Invest → Banking & Finance)
 * -------------------------------------------------------------------------
 * Placeholder only — "Coming Soon" detail page, same pattern the other
 * Services entries used before they were built out (see js/hiring.js and
 * js/marketing.js for the real thing once this one gets built). No logic,
 * no data models, no persisted state.
 * ========================================================================= */

const Banking = (() => {
  function mount(el) {
    el.innerHTML = `
      <div class="coming-soon">
        <div class="cs-badge">COMING SOON</div>
        <h2>Banking &amp; Finance</h2>
        <p>Loans, credit lines, and interest on your companies' cash reserves.</p>
        <p class="muted">This service is on the way.</p>
      </div>
    `;
  }
  return { mount };
})();
