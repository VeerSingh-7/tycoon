/* =========================================================================
 * training.js — Training & Development (Services → Invest → Training & Development)
 * -------------------------------------------------------------------------
 * Placeholder only — "Coming Soon" detail page, same pattern the other
 * Services entries used before they were built out (see js/hiring.js and
 * js/marketing.js for the real thing once this one gets built). No logic,
 * no data models, no persisted state.
 * ========================================================================= */

const Training = (() => {
  function mount(el) {
    el.innerHTML = `
      <div class="coming-soon">
        <div class="cs-badge">COMING SOON</div>
        <h2>Training &amp; Development</h2>
        <p>Train your employees — sharpen their skills and boost their performance.</p>
        <p class="muted">This service is on the way.</p>
      </div>
    `;
  }
  return { mount };
})();
