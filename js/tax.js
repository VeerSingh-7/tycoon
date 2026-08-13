/* =========================================================================
 * tax.js — Tax & Treasury (Services → Invest → Tax & Treasury)
 * -------------------------------------------------------------------------
 * Placeholder only — "Coming Soon" detail page, same pattern the other
 * Services entries used before they were built out (see js/hiring.js and
 * js/marketing.js for the real thing once this one gets built). No logic,
 * no data models, no persisted state.
 * ========================================================================= */

const Tax = (() => {
  function mount(el) {
    el.innerHTML = `
      <div class="coming-soon">
        <div class="cs-badge">COMING SOON</div>
        <h2>Tax &amp; Treasury</h2>
        <p>Manage corporate tax rates, deductions, and audits.</p>
        <p class="muted">This service is on the way.</p>
      </div>
    `;
  }
  return { mount };
})();
