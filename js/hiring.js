/* =========================================================================
 * hiring.js — Hiring & Talent (Services → Invest → Hiring & Talent).
 * -------------------------------------------------------------------------
 * BLANK FOR NOW (state.js SAVE_VERSION 25): hiring for the 48 stock
 * companies has been removed — the screen shows a placeholder instead of a
 * company selector. Any player who'd already hired staff on a stock company
 * was refunded (TechCo.employeeHireCost, current value) and their roster
 * cleared as part of that migration.
 *
 * Everything BELOW the selector (companyHTML, the Agency flow, candidate
 * browsing/hiring/headhunt) is left fully intact and correct — it's just
 * unreachable, since there's no company card left to tap into it from. Kept
 * rather than deleted so it's ready to be re-pointed at a real data source
 * (e.g. the Business tab's 14 businesses) later, the same "entry points
 * only" choice already made for the stock-side "Manage Company" removal.
 * It still reads/writes the SAME co(id).employeeRoster Product Studio's
 * Team step uses — nothing here was ever a parallel system.
 * ========================================================================= */

// The in-fiction hiring agency: a conversational front-end layered on the
// roster/candidate/headhunt system above — it calls into those exact same
// functions, never a parallel system. See agencyPanelHTML/roleSheetHTML.
const AGENCY_TAG = 'IGX';
const AGENCY_NAME = 'Irongate Talent Exchange';

const Hiring = (() => {
  const view = { companyId: null, cat: null, openRole: null, tier: 'standard', roleSheet: false, roleSearch: '' };
  let root = null;

  const _esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function mount(el) {
    root = el;
    root.removeEventListener('click', onClick);
    root.addEventListener('click', onClick);
    // fresh, like every other Services screen
    view.companyId = null; view.cat = null; view.openRole = null;
    view.tier = 'standard'; view.roleSheet = false; view.roleSearch = '';
    render();
  }

  function render() {
    if (!root) return;
    const body = !view.companyId ? selectorHTML()
      : view.roleSheet ? roleSheetHTML()
      : companyHTML(view.companyId);
    root.innerHTML = `<div class="tc-wizard-page hire-page">${body}</div>`;
    wireRoleSearch();
  }

  /** The role sheet's search input is patched in place on every keystroke
   *  (never a full render()) so it never loses focus or cursor position —
   *  same pattern as the Product Studio name field in js/techco.js. */
  function wireRoleSearch() {
    const input = root.querySelector('#hireRoleSearch');
    if (!input) return;
    input.oninput = (e) => {
      view.roleSearch = e.target.value;
      const results = root.querySelector('#hireRoleSheetResults');
      if (results) results.innerHTML = roleSheetResultsHTML();
    };
  }

  function onClick(e) {
    const t = e.target.closest('[data-h]');
    if (!t || t.disabled) return;
    const a = t.dataset.h, id = t.dataset.id;
    if (a === 'pick') {
      view.companyId = id; view.cat = EMP_CATEGORIES[0].id; view.openRole = null;
      view.tier = 'standard'; view.roleSheet = false; view.roleSearch = '';
      render();
    }
    else if (a === 'back') { view.companyId = null; view.roleSheet = false; render(); }
    else if (a === 'cat') { view.cat = id; view.openRole = null; render(); }
    else if (a === 'toggleRole') { view.openRole = view.openRole === id ? null : id; render(); }
    else if (a === 'hire') { doHire(t.dataset.role, t.dataset.src, +t.dataset.idx); }
    else if (a === 'hunt') { doHunt(id); }
    else if (a === 'release') { doRelease(id); }
    else if (a === 'tier') { view.tier = id; render(); }
    else if (a === 'roleSheetOpen') { view.roleSheet = true; view.roleSearch = ''; render(); }
    else if (a === 'roleSheetClose') { view.roleSheet = false; render(); }
    else if (a === 'roleSheetPick') {
      const role = EMP_ROLES[id];
      if (!role) return;
      view.cat = role.category; view.openRole = id; view.roleSheet = false;
      render();
    }
  }

  function warn(msg) { if (msg && typeof UI !== 'undefined' && UI.showToast) UI.showToast(msg); }

  function doHire(roleId, src, idx) {
    const id = view.companyId;
    const pool = src === 'hunt' ? TechCo.empHeadhuntPoolFor(id, roleId, {}) : TechCo.empPassivePoolFor(id, roleId);
    const r = TechCo.empHire(id, roleId, pool[idx]);
    if (!r.ok) warn(r.msg); else render();
  }
  function doHunt(roleId) {
    const r = TechCo.empRunHeadhunt(view.companyId, roleId, {});
    if (!r.ok) warn(r.msg); else render();
  }
  function doRelease(empId) {
    const r = TechCo.empRelease(view.companyId, empId);
    if (!r.ok) warn(r.msg); else render();
  }

  /* ------------------------------ Selector -------------------------------- */
  // Blank for now — see the file header. No company is ever reachable here,
  // so nothing below this point in the file can currently be navigated to.

  function selectorHTML() {
    return `
      <div class="tc-wiz-topbar"><div class="tc-wiz-title"><b>Hiring &amp; Talent</b></div></div>
      <p class="tc-hint">Hiring &amp; Talent isn't available right now — check back soon.</p>
    `;
  }

  /* -------------------------------- Company -------------------------------- */

  function companyHTML(id) {
    const def = ASSET_BY_ID[id];
    const c = TechCo.ensureCompany(id);
    const roster = c.employeeRoster;
    const payroll = TechCo.rosterPayrollPerDay(id);

    // Every stock company is TechCo-managed (see data/bizdefs.js — the 43
    // sector-generic companies get an auto-generated profile alongside the
    // 5 hand-crafted ones), so this screen only ever lists stocks and they
    // all get the full Product Studio-aware stats panel.
    const stats = techStatsHTML(id, payroll);

    const cats = EMP_CATEGORIES.map((cat) =>
      `<button class="tc-chip ${view.cat === cat.id ? 'on' : ''}" data-h="cat" data-id="${cat.id}">${cat.label}</button>`).join('');
    const roles = EMP_ROLES_BY_CATEGORY(view.cat || EMP_CATEGORIES[0].id);
    const roleSeats = roles.map((roleId) => hireRoleSeatHTML(id, roleId, view.openRole === roleId)).join('');

    return `
      <div class="tc-wiz-topbar">
        <button class="icon-btn" data-h="back" aria-label="Back">‹</button>
        <div class="tc-wiz-title"><div class="tc-wiz-co">Hiring &amp; Talent</div><b>${_esc(def.name)}</b></div>
      </div>
      ${agencyPanelHTML(def)}
      ${stats}
      <div class="tc-field-label">Roles <span class="muted">${roster.length} on staff · ${formatMoney(payroll)}/day payroll</span></div>
      <div class="tc-chip-row hire-cat-row">${cats}</div>
      <div class="tc-emp-seats">${roleSeats}</div>
    `;
  }

  function techStatsHTML(id, payroll) {
    const s = TechCo.snapshot(id);
    const incomeMult = TechCo.hiringIncomeMult(id), costCut = TechCo.hiringCostCut(id);
    const qBonus = TechCo.hiringQualityBonus(id), spMult = TechCo.hiringSpeedMult(id);
    return `
      <div class="tc-side-card hire-stats-card">
        <div class="tc-side-title">Company Snapshot</div>
        <div class="tc-wiz-metrics hire-metrics-top">
          <div><span>Net profit/day</span><b class="${s.netProfitDay >= 0 ? 'up' : 'down'}">${formatMoney(s.netProfitDay)}</b></div>
          <div><span>Cash</span><b>${formatMoney(s.cash)}</b></div>
          <div><span>Full payroll</span><b>${formatMoney(s.payrollDay)}/day</b></div>
        </div>
        <div class="tc-wiz-metrics">
          <div><span>Revenue bonus</span><b class="amber">+${Math.round((incomeMult - 1) * 100)}%</b></div>
          <div><span>Cost efficiency</span><b class="amber">-${Math.round(costCut * 100)}%</b></div>
          <div><span>Product Dev bonus</span><b class="amber">${qBonus > 0 ? '+' + qBonus.toFixed(1) + ' qual · -' + Math.round((1 - spMult) * 100) + '% time' : '—'}</b></div>
        </div>
      </div>`;
  }

  /* -------------------------------- Agency ---------------------------------- *
   * A conversational front-end on top of the roster/candidate/headhunt system
   * above — every button here calls straight into the same TechCo.emp* API
   * hireRoleSeatHTML already uses. Two tiers map onto what already exists:
   *   Standard Search    -> TechCo.empPassivePoolFor (unchanged)
   *   Priority Clearance -> TechCo.empHeadhuntPoolFor / empSearchCost /
   *                         empRunHeadhunt (unchanged cost/filter/pool math —
   *                         filters stay {} exactly as the existing screen
   *                         already calls them). Not given a new unlock gate;
   *                         it was already cost-gated by empSearchCost scaling
   *                         with company size, which is enough on its own. */

  function agencyIconSVG() {
    return `<svg viewBox="0 0 32 32" class="hire-agency-icon-svg" aria-hidden="true">
      <circle cx="16" cy="16" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/>
      <circle cx="16" cy="16" r="2" fill="currentColor"/>
      <path d="M16 5 L16 11 M16 21 L16 27 M5 16 L11 16 M21 16 L27 16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
  }

  function agencyPanelHTML(def) {
    return `
      <div class="hire-agency-panel">
        <div class="hire-agency-top">
          <span class="hire-agency-icon">${agencyIconSVG()}</span>
          <div class="hire-agency-name">${AGENCY_TAG} <span class="muted">// ${AGENCY_NAME}</span></div>
        </div>
        <div class="hire-agency-msg">${AGENCY_TAG} — looking to staff ${_esc(def.name)}? Choose a role to begin.</div>
        <div class="tc-chip-row hire-tier-row">
          <button class="tc-chip ${view.tier === 'standard' ? 'on' : ''}" data-h="tier" data-id="standard">Standard Search</button>
          <button class="tc-chip ${view.tier === 'priority' ? 'on' : ''}" data-h="tier" data-id="priority">Priority Clearance</button>
        </div>
        <button class="btn tc-mini hire-role-sheet-btn" data-h="roleSheetOpen">🔍 Choose a Role ›</button>
      </div>`;
  }

  /** Every role across all 6 categories, filtered by search-as-you-type. */
  function roleSheetResultsHTML() {
    const q = (view.roleSearch || '').trim().toLowerCase();
    const catLabel = (catId) => (EMP_CATEGORIES.find((c) => c.id === catId) || {}).label || catId;
    const roles = EMP_ROLE_IDS
      .map((rid) => ({ id: rid, label: EMP_ROLES[rid].label, category: EMP_ROLES[rid].category }))
      .filter((r) => !q || r.label.toLowerCase().includes(q))
      .sort((a, b) => a.label.localeCompare(b.label));
    if (!roles.length) return `<div class="tc-hint">No roles match "${_esc(view.roleSearch || '')}".</div>`;
    return roles.map((r) => `
      <button class="hire-role-row" data-h="roleSheetPick" data-id="${r.id}">
        <div class="hire-role-row-main"><b>${_esc(r.label)}</b><span class="tc-emp-cand-sub">${_esc(catLabel(r.category))}</span></div>
        <span class="hub-arrow">›</span>
      </button>`).join('');
  }

  function roleSheetHTML() {
    return `
      <div class="tc-wiz-topbar">
        <button class="icon-btn" data-h="roleSheetClose" aria-label="Close">✕</button>
        <div class="tc-wiz-title"><div class="tc-wiz-co">${AGENCY_TAG} — Role Directory</div><b>Choose a Role</b></div>
      </div>
      <input id="hireRoleSearch" class="hire-role-search-input" type="text"
        placeholder="Search all ${EMP_ROLE_IDS.length} roles…" value="${_esc(view.roleSearch || '')}" autocomplete="off">
      <div id="hireRoleSheetResults" class="hire-role-sheet-list">${roleSheetResultsHTML()}</div>
    `;
  }

  /* --------------------------------- Roles --------------------------------- */

  function hireRoleSeatHTML(id, roleId, open) {
    const role = EMP_ROLES[roleId];
    const c = TechCo.ensureCompany(id);
    const roster = c.employeeRoster.filter((e) => e.roleId === roleId);
    const rosterHTML = roster.map((e) => hireRosterCardHTML(id, e)).join('');
    const head = `
      <button class="tc-emp-card ${roster.length ? 'on' : 'empty'}" data-h="toggleRole" data-id="${roleId}">
        <div class="tc-emp-card-top"><b class="${roster.length ? '' : 'muted'}">${role.label}</b><span class="tc-emp-fit ${roster.length ? 'good' : ''}">${roster.length ? roster.length + ' hired' : 'Browse'}</span></div>
        <div class="tc-emp-cand-sub">${open ? 'Tap to collapse' : 'Tap to browse candidates'}</div>
      </button>`;
    if (!open) return `<div class="tc-emp-seat">${head}${rosterHTML}</div>`;

    // Standard vs Priority Clearance (the agency's tier toggle) only changes
    // WHICH of these sections leads and how the search CTA is styled — the
    // pool, the headhunt results, the cost and the hire buttons underneath
    // are the exact same TechCo.emp* calls either way.
    const funds = TechCo.empFunds(id);
    const pool = TechCo.empPassivePoolFor(id, roleId);
    const searches = (c.empSearch && c.empSearch[roleId]) || 0;
    const hunted = searches > 0 ? TechCo.empHeadhuntPoolFor(id, roleId, {}) : null;
    const huntCost = TechCo.empSearchCost(id, roleId, {});
    const poolHTML = `<div class="tc-emp-group-label">Candidate pool</div>${pool.map((cand, i) => hireCandidateCardHTML(id, cand, roleId, 'passive', i, funds)).join('')}`;
    const huntHTML = hunted
      ? `<div class="tc-emp-group-label">Headhunt results</div>${hunted.map((cand, i) => hireCandidateCardHTML(id, cand, roleId, 'hunt', i, funds)).join('')}`
      : '';
    const priority = view.tier === 'priority';
    const huntBtn = `<button class="btn tc-mini tc-emp-hunt ${priority ? 'btn-gold' : ''}" data-h="hunt" data-id="${roleId}" ${funds >= huntCost ? '' : 'disabled'}>🔍 Headhunt a sharper pool · ${formatMoney(huntCost)}</button>`;
    const sections = priority
      ? `${huntBtn}${huntHTML}${poolHTML}`
      : `${poolHTML}${huntHTML}${huntBtn}`;
    return `
      <div class="tc-emp-seat open">
        ${head}${rosterHTML}
        <div class="tc-emp-browse">${sections}</div>
      </div>`;
  }

  function hireRosterCardHTML(id, e) {
    const busy = TechCo.empIsBusy(id, e.id);
    const stats = EMP_ATTRS.filter((a) => e.attrs[a] != null)
      .map((a) => `<div><span>${EMP_ATTR_LABELS[a].split(' ')[0]}</span><b>${e.attrs[a]}</b></div>`).join('');
    return `
      <div class="tc-emp-cand">
        <div class="tc-emp-cand-top"><b>${_esc(e.name)}</b><span class="tc-emp-fit ${e.overall >= 75 ? 'good' : e.overall >= 50 ? 'alt' : 'warn'}">Overall ${e.overall}</span></div>
        <div class="tc-emp-cand-sub">${_esc(e.speciality)} · ${formatMoney(e.salaryYear)}/yr · Satisfaction ${e.satisfaction}%</div>
        <div class="tc-emp-stat-row">${stats}</div>
        ${busy
          ? `<div class="tc-hint hire-busy-hint">Assigned to an active build in Product Studio.</div>`
          : `<button class="btn tc-mini" data-h="release" data-id="${e.id}">Release</button>`}
      </div>`;
  }

  function hireCandidateCardHTML(id, c, roleId, src, idx, funds) {
    const cost = TechCo.employeeHireCost(id, c);
    const stats = EMP_ATTRS.filter((a) => c.attrs[a] != null)
      .map((a) => `<div><span>${EMP_ATTR_LABELS[a].split(' ')[0]}</span><b>${c.attrs[a]}</b></div>`).join('');
    return `
      <div class="tc-emp-cand">
        <div class="tc-emp-cand-top"><b>${_esc(c.name)}</b><span class="tc-emp-fit ${c.overall >= 75 ? 'good' : c.overall >= 50 ? 'alt' : 'warn'}">Overall ${c.overall}</span></div>
        <div class="tc-emp-cand-sub">${_esc(c.speciality)} · ${formatMoney(c.salaryYear)}/yr</div>
        <div class="tc-emp-stat-row">${stats}</div>
        <button class="btn btn-gold tc-mini" data-h="hire" data-role="${roleId}" data-src="${src}" data-idx="${idx}" ${funds >= cost ? '' : 'disabled'}>Hire · ${formatMoney(c.signingBonus)} signing</button>
      </div>`;
  }

  return { mount };
})();
