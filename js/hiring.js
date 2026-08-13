/* =========================================================================
 * hiring.js — Hiring & Talent: the standalone, company-wide recruitment
 * screen (Services → Invest → Hiring & Talent).
 * -------------------------------------------------------------------------
 * This is the second consumer of the Recruitment/Employee system foundation
 * (js/data/employees.js + the engine in js/techco.js) — the Product Studio
 * Team step was the first. Both read/write the SAME co(id).employeeRoster;
 * nothing here is a parallel system or a second copy of that data.
 *
 * Gate: only companies the player owns 100% (Market.isOwned) are hireable —
 * the same rule Product Studio and the Portfolio Manage section already use.
 * Scope: stock companies only (48 of them) — crypto coins have no staff.
 *
 * Mechanical effect: a company's roster contributes a small AMBIENT bonus,
 * scaled off each category's AVERAGE Overall (never headcount) — see the
 * "Hiring & Talent — company-wide ambient roster effects" block in
 * js/techco.js for the exact formula and the percentages chosen.
 * ========================================================================= */

const Hiring = (() => {
  const view = { companyId: null, cat: null, openRole: null };
  let root = null;

  const _esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function mount(el) {
    root = el;
    root.removeEventListener('click', onClick);
    root.addEventListener('click', onClick);
    view.companyId = null; view.cat = null; view.openRole = null; // fresh, like every other Services screen
    render();
  }

  function render() {
    if (!root) return;
    root.innerHTML = `<div class="tc-wizard-page hire-page">${view.companyId ? companyHTML(view.companyId) : selectorHTML()}</div>`;
  }

  function onClick(e) {
    const t = e.target.closest('[data-h]');
    if (!t || t.disabled) return;
    const a = t.dataset.h, id = t.dataset.id;
    if (a === 'pick') { view.companyId = id; view.cat = EMP_CATEGORIES[0].id; view.openRole = null; render(); }
    else if (a === 'back') { view.companyId = null; render(); }
    else if (a === 'cat') { view.cat = id; view.openRole = null; render(); }
    else if (a === 'toggleRole') { view.openRole = view.openRole === id ? null : id; render(); }
    else if (a === 'hire') { doHire(t.dataset.role, t.dataset.src, +t.dataset.idx); }
    else if (a === 'hunt') { doHunt(id); }
    else if (a === 'release') { doRelease(id); }
  }

  function warn(msg) { if (msg && typeof UI !== 'undefined' && UI.showToast) UI.showToast(msg); }

  function doHire(roleId, src, idx) {
    const id = view.companyId;
    const pool = src === 'hunt' ? TechCo.empHeadhuntPoolFor(id, roleId, {}) : TechCo.empPassivePoolFor(id, roleId);
    const r = TechCo.empHireGeneral(id, roleId, pool[idx]);
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

  function selectorHTML() {
    const stocks = ASSET_DEFS.filter((d) => d.group === 'stock').slice().sort((a, b) => a.name.localeCompare(b.name));
    const owned = stocks.filter((d) => Market.isOwned(d.id));
    const locked = stocks.filter((d) => !Market.isOwned(d.id));
    return `
      <div class="tc-wiz-topbar"><div class="tc-wiz-title"><b>Hiring &amp; Talent</b></div></div>
      <p class="tc-hint">Own 100% of a company to build out its staff. Every hire's stats, salary and category shape a small ongoing bonus for that company — never a replacement for its existing income.</p>
      ${owned.length
        ? `<div class="tc-section-label">Your Companies</div><div class="hire-co-grid">${owned.map((d) => hireCoCardHTML(d, true)).join('')}</div>`
        : `<div class="tc-hint">You don't own 100% of any company yet — buy one out on the Markets tab first.</div>`}
      <div class="tc-section-label">Not Yet Owned</div>
      <div class="hire-co-grid">${locked.map((d) => hireCoCardHTML(d, false)).join('')}</div>
    `;
  }

  function hireCoCardHTML(def, unlocked) {
    const roster = (state.techco && state.techco[def.id] && state.techco[def.id].employeeRoster) || [];
    if (!unlocked) {
      const pct = Market.ownedFrac(def.id) * 100;
      const pctText = pct <= 0 ? 'Not owned' : (pct >= 1 ? pct.toFixed(1) : pct.toFixed(2)) + '% owned';
      return `
        <div class="hire-co-card locked">
          ${Logos.tile(def)}
          <div class="hire-co-name">${_esc(def.name)}</div>
          <div class="tc-emp-cand-sub muted">${pctText}<br>Own 100% to hire staff here</div>
        </div>`;
    }
    return `
      <button class="hire-co-card" data-h="pick" data-id="${def.id}">
        ${Logos.tile(def)}
        <div class="hire-co-name">${_esc(def.name)}</div>
        <div class="tc-emp-cand-sub">${roster.length} on staff</div>
      </button>`;
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

    const funds = TechCo.empFunds(id);
    const pool = TechCo.empPassivePoolFor(id, roleId);
    const searches = (c.empSearch && c.empSearch[roleId]) || 0;
    const hunted = searches > 0 ? TechCo.empHeadhuntPoolFor(id, roleId, {}) : null;
    const huntCost = TechCo.empSearchCost(id, roleId, {});
    const poolHTML = `<div class="tc-emp-group-label">Candidate pool</div>${pool.map((cand, i) => hireCandidateCardHTML(id, cand, roleId, 'passive', i, funds)).join('')}`;
    const huntHTML = hunted
      ? `<div class="tc-emp-group-label">Headhunt results</div>${hunted.map((cand, i) => hireCandidateCardHTML(id, cand, roleId, 'hunt', i, funds)).join('')}`
      : '';
    return `
      <div class="tc-emp-seat open">
        ${head}${rosterHTML}
        <div class="tc-emp-browse">
          ${poolHTML}
          ${huntHTML}
          <button class="btn tc-mini tc-emp-hunt" data-h="hunt" data-id="${roleId}" ${funds >= huntCost ? '' : 'disabled'}>🔍 Headhunt a sharper pool · ${formatMoney(huntCost)}</button>
        </div>
      </div>`;
  }

  function hireRosterCardHTML(id, e) {
    const busy = TechCo.empIsBusy(id, e.id);
    const stats = EMP_ATTRS.filter((a) => e.attrs[a] != null)
      .map((a) => `<div><span>${EMP_ATTR_LABELS[a].split(' ')[0]}</span><b>${e.attrs[a]}</b></div>`).join('');
    return `
      <div class="tc-emp-cand hire-roster-card">
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

if (typeof module !== 'undefined' && module.exports) module.exports = Hiring;
