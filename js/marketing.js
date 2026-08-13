/* =========================================================================
 * marketing.js — Marketing & Growth (Services → Invest → Marketing & Growth)
 * -------------------------------------------------------------------------
 * Quick Campaign (default): objective + audience + a budget slider, one or
 * two taps to launch — the system auto-suggests a channel mix (by sector
 * fit) and auto-picks the best-fit available marketing employee. An
 * Advanced toggle on the same form adds manual per-channel weighting, an
 * explicit spread tier, a message picker (or custom line), and manual staff
 * assignment — same mktStartCampaign() engine call either way.
 *
 * Uses the game's normal theme (base --gold/--bg-elev tokens, themeable
 * light/dark) — NOT the Product Studio blueprint reskin, which is scoped to
 * that wizard specifically.
 * ========================================================================= */

const Marketing = (() => {
  const view = {
    companyId: null, mode: 'list', quick: null, reportCid: null, advanced: false,
    infExpanded: null, infAudience: null, infEmpId: null,
    spExpanded: null, spTier: 'local',
  };
  let root = null;

  const _esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const pct1 = (v) => (Math.round(v * 1000) / 10).toFixed(1) + '%';

  function mount(el) {
    root = el;
    root.removeEventListener('click', onClick);
    root.addEventListener('click', onClick);
    root.removeEventListener('input', onInput);
    root.addEventListener('input', onInput);
    view.companyId = null; view.mode = 'list'; view.quick = null; view.reportCid = null; view.advanced = false;
    view.infExpanded = null; view.infAudience = null; view.infEmpId = null;
    view.spExpanded = null; view.spTier = 'local';
    render();
  }

  function render() {
    if (!root) return;
    root.innerHTML = `<div class="mk-page">${view.companyId ? companyRoot(view.companyId) : selectorHTML()}</div>`;
  }

  function companyRoot(id) {
    if (view.mode === 'quick') return quickFormHTML(id);
    if (view.mode === 'report') return reportHTML(id);
    if (view.mode === 'influencers') return influencersHTML(id);
    if (view.mode === 'sponsorships') return sponsorshipsHTML(id);
    if (view.mode === 'research') return researchHTML(id);
    return listHTML(id);
  }

  function onClick(e) {
    const t = e.target.closest('[data-mk]');
    if (!t || t.disabled) return;
    const a = t.dataset.mk, id = t.dataset.id;
    if (a === 'pick') { view.companyId = id; view.mode = 'list'; render(); }
    else if (a === 'back') { view.companyId = null; render(); }
    else if (a === 'toList') { view.mode = 'list'; render(); }
    else if (a === 'newCampaign') { view.mode = 'quick'; view.advanced = false; view.quick = defaultQuick(view.companyId); render(); }
    else if (a === 'cancelQuick') { view.mode = 'list'; render(); }
    else if (a === 'objective') { view.quick.objective = id; view.quick.messageIdx = 0; view.quick.customMessage = ''; render(); }
    else if (a === 'audience') { view.quick.audience = id; render(); }
    else if (a === 'launch') { doLaunch(); }
    else if (a === 'viewReport') { view.reportCid = +id; view.mode = 'report'; render(); }
    else if (a === 'closeReport') { view.mode = 'list'; render(); }
    else if (a === 'relaunch') { view.mode = 'quick'; view.advanced = false; view.quick = relaunchQuick(view.companyId, +id); render(); }
    else if (a === 'toggleAdvanced') { view.advanced = !view.advanced; render(); }
    else if (a === 'spread') { view.quick.spread = id; render(); }
    else if (a === 'chanWeight') { const w = (view.quick.weights[id] || 0); view.quick.weights[id] = (w + 1) % 4; render(); }
    else if (a === 'message') { view.quick.messageIdx = +id; view.quick.customMessage = ''; render(); }
    else if (a === 'staffAuto') { view.quick.empId = null; render(); }
    else if (a === 'staff') { view.quick.empId = id; render(); }
    // Influencer Deals
    else if (a === 'navInfluencers') { view.mode = 'influencers'; view.infExpanded = null; render(); }
    else if (a === 'infExpand') { const i = +id; view.infExpanded = view.infExpanded === i ? null : i; view.infAudience = null; view.infEmpId = null; render(); }
    else if (a === 'infAudience') { view.infAudience = id; render(); }
    else if (a === 'infStaffAuto') { view.infEmpId = null; render(); }
    else if (a === 'infStaff') { view.infEmpId = id; render(); }
    else if (a === 'infSign') { doSignInfluencer(+id); }
    // Sponsorships
    else if (a === 'navSponsorships') { view.mode = 'sponsorships'; view.spExpanded = null; render(); }
    else if (a === 'spExpand') { view.spExpanded = view.spExpanded === id ? null : id; view.spTier = 'local'; render(); }
    else if (a === 'spTier') { view.spTier = id; render(); }
    else if (a === 'spSign') { doSignSponsorship(id); }
    // Market Research
    else if (a === 'navResearch') { view.mode = 'research'; render(); }
    else if (a === 'runResearch') { doRunResearch(id); }
  }

  function onInput(e) {
    const range = e.target.closest('[data-mk-range]');
    if (range && range.dataset.mkRange === 'budget') { view.quick.budgetFrac = +range.value / 100; renderBudgetPreview(); return; }
    const text = e.target.closest('[data-mk-text]');
    if (text && text.dataset.mkText === 'customMessage') { view.quick.customMessage = text.value; }
  }

  /* ------------------------------ Selector -------------------------------- */

  function selectorHTML() {
    const stocks = ASSET_DEFS.filter((d) => d.group === 'stock').slice().sort((a, b) => a.name.localeCompare(b.name));
    const owned = stocks.filter((d) => Market.isOwned(d.id));
    const locked = stocks.filter((d) => !Market.isOwned(d.id));
    return `
      <button class="back-link" data-act="hub">‹ Services</button>
      <div class="section-head"><h2>Marketing &amp; Growth</h2></div>
      <p class="mk-hint">Own 100% of a company to run campaigns for it — the same rule as Hiring &amp; Talent.</p>
      ${owned.length
        ? `<div class="mk-co-grid">${owned.map((d) => mkCoCardHTML(d, true)).join('')}</div>`
        : `<div class="card mk-empty">Own 100% of a company to unlock its Marketing &amp; Growth desk.</div>`}
      ${locked.length ? `<div class="section-head"><h2>Not Yet Owned</h2></div><div class="mk-co-grid">${locked.map((d) => mkCoCardHTML(d, false)).join('')}</div>` : ''}
    `;
  }

  function mkCoCardHTML(def, unlocked) {
    if (!unlocked) {
      const pct = Market.ownedFrac(def.id) * 100;
      const pctText = pct <= 0 ? 'Not owned' : (pct >= 1 ? pct.toFixed(1) : pct.toFixed(2)) + '% owned';
      return `
        <div class="mk-co-card locked">
          ${Logos.tile(def)}
          <div class="mk-co-name">${_esc(def.name)}</div>
          <div class="card-sub">${pctText}</div>
        </div>`;
    }
    const rep = (state.techco && state.techco[def.id]) ? state.techco[def.id].reputation : null;
    return `
      <button class="mk-co-card" data-mk="pick" data-id="${def.id}">
        ${Logos.tile(def)}
        <div class="mk-co-name">${_esc(def.name)}</div>
        <div class="card-sub">${rep != null ? 'Reputation ' + Math.round(rep) + '/100' : 'Not yet opened'}</div>
      </button>`;
  }

  /* -------------------------------- Company list --------------------------- */

  function listHTML(id) {
    const def = ASSET_BY_ID[id];
    const c = TechCo.ensureCompany(id);
    const m = c.marketing;
    const mult = TechCo.marketingIncomeMult(id);
    return `
      <button class="back-link" data-mk="back">‹ Marketing &amp; Growth</button>
      <div class="section-head"><h2>${_esc(def.name)}</h2></div>
      <div class="card mk-rep-card">
        <div class="card-row">
          <div><div class="card-title">Brand Reputation</div><div class="card-sub">Moves with launches, campaigns and growth</div></div>
          <div class="mk-rep-num">${Math.round(c.reputation)}<span>/100</span></div>
        </div>
        <div class="mk-rep-bar"><div class="mk-rep-fill" style="width:${clampPct(c.reputation)}%"></div></div>
        ${mult > 1 ? `<div class="card-sub mk-boost-note">Active campaign boost: +${pct1(mult - 1)} revenue</div>` : ''}
      </div>
      <button class="btn btn-gold btn-wide" data-mk="newCampaign">+ New Campaign</button>
      <div class="mk-nav-row">
        <button class="btn mk-nav-btn" data-mk="navInfluencers">🎤 Influencer Deals</button>
        <button class="btn mk-nav-btn" data-mk="navSponsorships">🏟️ Sponsorships</button>
        <button class="btn mk-nav-btn" data-mk="navResearch">📊 Market Research</button>
      </div>
      ${m.campaigns.length ? activeCampaignsHTML(id, m.campaigns) : ''}
      <div class="section-head"><h2>Recent Campaigns</h2></div>
      ${m.history.length ? `<div class="mk-history">${m.history.map((r) => historyRowHTML(r)).join('')}</div>` : `<div class="card mk-empty">No campaigns yet — launch your first one above.</div>`}
    `;
  }

  function activeCampaignsHTML(id, campaigns) {
    const now = Date.now();
    return `
      <div class="section-head"><h2>In Progress</h2></div>
      <div class="mk-history">${campaigns.map((camp) => {
        const obj = MKT_OBJECTIVES[camp.objective];
        const left = Math.max(0, camp.endsAt - now);
        return `
          <div class="card mk-hist-row">
            <div class="card-row">
              <div><div class="card-title">${obj.label}</div><div class="card-sub">${MKT_AUDIENCES[camp.audience]} · ${MKT_SPREAD_TIERS[camp.spread].label}</div></div>
              <div class="card-sub">${formatDuration(left / 1000)} left</div>
            </div>
          </div>`;
      }).join('')}</div>`;
  }

  function historyRowHTML(r) {
    const obj = MKT_OBJECTIVES[r.objective];
    return `
      <button class="card mk-hist-row" data-mk="viewReport" data-id="${r.cid}">
        <div class="card-row">
          <div><div class="card-title">${obj.label}</div><div class="card-sub">${MKT_AUDIENCES[r.audience]} · ${MKT_SPREAD_TIERS[r.spread].label}</div></div>
          <div class="mk-hist-right">
            <div class="${r.salesPct >= 0 ? 'up' : 'down'}">+${r.salesPct}% sales</div>
            <div class="card-sub">${formatMoney(r.spent)}</div>
          </div>
        </div>
      </button>`;
  }

  const clampPct = (v) => Math.max(0, Math.min(100, v));

  /* ------------------------------ Quick Campaign ---------------------------- */

  function defaultQuick(id) {
    const sector = TechCo.mktSector(id);
    const audiences = MKT_SECTOR_AUDIENCES[sector] || [];
    return {
      objective: 'brand_awareness', audience: audiences[0] || 'families', budgetFrac: 0.21, // ~typical on the slider
      spread: null, weights: {}, empId: null, messageIdx: 0, customMessage: '',
    };
  }
  function relaunchQuick(id, cid) {
    const c = TechCo.ensureCompany(id);
    const r = c.marketing.history.find((h) => h.cid === cid);
    const q = defaultQuick(id);
    if (r) { q.objective = r.objective; q.audience = r.audience; }
    return q;
  }

  function budgetFromFrac(id, frac) {
    const range = TechCo.mktBudgetRange(id);
    return range.min + (range.max - range.min) * frac;
  }

  function quickFormHTML(id) {
    const def = ASSET_BY_ID[id];
    const sector = TechCo.mktSector(id);
    const audiences = MKT_SECTOR_AUDIENCES[sector] || [];
    const q = view.quick;
    const objChips = MKT_OBJECTIVE_IDS.map((oid) =>
      `<button class="chip ${q.objective === oid ? 'chip-active' : ''}" data-mk="objective" data-id="${oid}">${MKT_OBJECTIVES[oid].label}</button>`).join('');
    const audChips = audiences.map((aid) =>
      `<button class="chip ${q.audience === aid ? 'chip-active' : ''}" data-mk="audience" data-id="${aid}">${MKT_AUDIENCES[aid]}</button>`).join('');
    const range = TechCo.mktBudgetRange(id);
    const sliderVal = Math.round(q.budgetFrac * 100);
    return `
      <button class="back-link" data-mk="cancelQuick">‹ ${_esc(def.name)}</button>
      <div class="section-head"><h2>New Campaign</h2></div>
      <div class="card">
        <div class="card-title">Objective</div>
        <div class="chip-row">${objChips}</div>
      </div>
      <div class="card">
        <div class="card-title">Target Audience</div>
        <div class="card-sub">${_esc(SECTOR_DISPLAY[sector] || 'This sector')}'s real customer base</div>
        <div class="chip-row">${audChips}</div>
        ${view.advanced ? otherAudiencesHTML(id) : ''}
      </div>
      <div class="card">
        <div class="card-title">Budget</div>
        <input type="range" min="0" max="100" value="${sliderVal}" class="slider" data-mk-range="budget">
        <div class="card-sub mk-budget-range"><span>${formatMoney(range.min)}</span><span>${formatMoney(range.max)}</span></div>
        <div id="mkBudgetPreview">${budgetPreviewHTML(id)}</div>
      </div>
      ${view.advanced ? advancedSpreadHTML(id) + advancedChannelsHTML(id) + advancedMessageHTML(id) + advancedStaffHTML(id) : ''}
      <button class="mk-advanced-toggle" data-mk="toggleAdvanced">${view.advanced ? '‹ Back to Quick Campaign' : 'Advanced: pick channels, message &amp; staff manually ›'}</button>
      <button class="btn btn-gold btn-wide" data-mk="launch">Launch Campaign</button>
    `;
  }

  function budgetPreviewHTML(id) {
    const q = view.quick;
    const budget = budgetFromFrac(id, q.budgetFrac);
    const mix = view.advanced ? resolvedChannels(id, q) : mktSuggestChannels(TechCo.mktSector(id), 3);
    const staff = q.empId ? TechCo.findEmployee(id, q.empId) : TechCo.mktBestBenchFor(id);
    const range = TechCo.mktBudgetRange(id);
    const afford = TechCo.empFunds(id) >= budget;
    return `
      <div class="mk-preview">
        <div class="mk-preview-budget">${formatMoney(budget)}</div>
        <div class="card-sub">${view.advanced ? 'Channel mix' : 'Auto channel mix'}: ${Object.keys(mix).map((c) => MKT_CHANNELS[c].label).join(', ')}</div>
        <div class="card-sub">${staff ? 'Running with ' + _esc(staff.name) + ' (' + EMP_ROLES[staff.roleId].label + ')' : 'No marketing staff hired — runs at baseline effectiveness'}</div>
        ${!afford ? `<div class="card-sub mk-warn">Not enough company cash for this budget (need ${formatMoney(budget)}).</div>` : ''}
        ${budget < range.min * 0.999 ? `<div class="card-sub mk-warn">Below the minimum campaign budget.</div>` : ''}
      </div>`;
  }
  function renderBudgetPreview() {
    const el = document.getElementById('mkBudgetPreview');
    if (el) el.innerHTML = budgetPreviewHTML(view.companyId);
  }

  /* --------------------------- Advanced controls ---------------------------- */

  /** Every audience OUTSIDE the sector's real customer base, with its fit%
   *  shown plainly — Advanced players can knowingly target off-base, Quick
   *  Campaign never offers the option. */
  function otherAudiencesHTML(id) {
    const sector = TechCo.mktSector(id);
    const inList = MKT_SECTOR_AUDIENCES[sector] || [];
    const others = Object.keys(MKT_AUDIENCES).filter((aid) => inList.indexOf(aid) < 0);
    const q = view.quick;
    return `
      <div class="mk-field-label">Other Audiences <span class="card-sub">(off-base — weaker fit)</span></div>
      <div class="chip-row">${others.map((aid) =>
        `<button class="chip ${q.audience === aid ? 'chip-active' : ''}" data-mk="audience" data-id="${aid}">${MKT_AUDIENCES[aid]} · ${Math.round(mktAudienceFit(sector, aid) * 100)}%</button>`).join('')}</div>`;
  }

  function advancedSpreadHTML(id) {
    const q = view.quick;
    const auto = !q.spread;
    return `
      <div class="card">
        <div class="card-title">Spread</div>
        <div class="chip-row">
          <button class="chip ${auto ? 'chip-active' : ''}" data-mk="spread" data-id="">Auto</button>
          ${MKT_SPREAD_IDS.map((sid) => `<button class="chip ${q.spread === sid ? 'chip-active' : ''}" data-mk="spread" data-id="${sid}">${MKT_SPREAD_TIERS[sid].label}</button>`).join('')}
        </div>
      </div>`;
  }

  function advancedChannelsHTML(id) {
    const sector = TechCo.mktSector(id);
    const q = view.quick;
    const WEIGHT_LABEL = ['—', 'Light', 'Normal', 'Heavy'];
    const cats = MKT_CHANNEL_CATEGORIES.map((cat) => {
      const chans = MKT_CHANNEL_IDS.filter((cid) => MKT_CHANNELS[cid].category === cat.id);
      const chips = chans.map((cid) => {
        const w = q.weights[cid] || 0;
        return `<button class="chip mk-chan-chip ${w ? 'chip-active' : ''}" data-mk="chanWeight" data-id="${cid}">${MKT_CHANNELS[cid].label}<small>${WEIGHT_LABEL[w]} · ${Math.round(mktChannelSectorFit(cid, sector) * 100)}% fit</small></button>`;
      }).join('');
      return `<div class="mk-field-label">${cat.label}</div><div class="chip-row">${chips}</div>`;
    }).join('');
    return `
      <div class="card">
        <div class="card-title">Channels</div>
        <div class="card-sub">Tap to cycle a channel's spend weight: — → Light → Normal → Heavy. Leave all at — for the auto mix.</div>
        ${cats}
      </div>`;
  }

  function advancedMessageHTML(id) {
    const q = view.quick;
    const list = MKT_MESSAGES[q.objective] || [];
    const custom = !!(q.customMessage && q.customMessage.trim());
    return `
      <div class="card">
        <div class="card-title">Message</div>
        <div class="chip-row">${list.map((m, i) =>
          `<button class="chip ${!custom && q.messageIdx === i ? 'chip-active' : ''}" data-mk="message" data-id="${i}">${_esc(m.text)}</button>`).join('')}</div>
        <div class="card-sub" style="margin-top:8px">Or write your own — matching words move the tag-match bonus the same way:</div>
        <input type="text" class="mk-text-input" placeholder="e.g. Trusted, high-performance, built for value" data-mk-text="customMessage" value="${_esc(q.customMessage)}">
      </div>`;
  }

  function advancedStaffHTML(id) {
    const q = view.quick;
    const bench = TechCo.mktBenchFor(id);
    return `
      <div class="card">
        <div class="card-title">Marketing Staff</div>
        ${bench.length ? `<div class="chip-row">
            <button class="chip ${!q.empId ? 'chip-active' : ''}" data-mk="staffAuto">Auto (best fit)</button>
            ${bench.map((e) => `<button class="chip ${q.empId === e.id ? 'chip-active' : ''}" data-mk="staff" data-id="${e.id}">${_esc(e.name)} · ${EMP_ROLES[e.roleId].label}</button>`).join('')}
          </div>`
          : `<div class="card-sub">No Sales &amp; Marketing staff hired yet — hire some from Hiring &amp; Talent to boost campaigns.</div>`}
      </div>`;
  }

  function resolvedChannels(id, q) {
    const weighted = Object.keys(q.weights).filter((k) => q.weights[k] > 0);
    if (!weighted.length) return mktSuggestChannels(TechCo.mktSector(id), 3);
    const total = weighted.reduce((s, k) => s + q.weights[k], 0);
    const out = {};
    weighted.forEach((k) => { out[k] = q.weights[k] / total; });
    return out;
  }
  function resolvedMessage(q) {
    if (q.customMessage && q.customMessage.trim()) {
      const t = q.customMessage.toLowerCase();
      return { text: q.customMessage, tags: MKT_TAG_VOCAB.filter((tag) => t.indexOf(tag) >= 0) };
    }
    const list = MKT_MESSAGES[q.objective] || [];
    return list[q.messageIdx] || list[0] || null;
  }

  function doLaunch() {
    const id = view.companyId, q = view.quick;
    const budget = budgetFromFrac(id, q.budgetFrac);
    const channels = view.advanced ? resolvedChannels(id, q) : mktSuggestChannels(TechCo.mktSector(id), 3);
    const empId = view.advanced ? q.empId : ((TechCo.mktBestBenchFor(id) || {}).id || null);
    const message = view.advanced ? resolvedMessage(q) : ((MKT_MESSAGES[q.objective] || [])[0] || null);
    const spread = view.advanced ? (q.spread || null) : null;
    const r = TechCo.mktStartCampaign(id, { objective: q.objective, audience: q.audience, budget, channels, empId, message, spread });
    if (!r.ok) { if (typeof UI !== 'undefined') UI.showToast(r.msg); return; }
    view.mode = 'list';
    render();
  }

  /* -------------------------------- Report ---------------------------------- */

  function reportHTML(id) {
    const def = ASSET_BY_ID[id];
    const c = TechCo.ensureCompany(id);
    const r = c.marketing.history.find((h) => h.cid === view.reportCid);
    if (!r) { view.mode = 'list'; return listHTML(id); }
    const obj = MKT_OBJECTIVES[r.objective];
    const roiCls = r.roi >= 0 ? 'up' : 'down';
    return `
      <button class="back-link" data-mk="closeReport">‹ ${_esc(def.name)}</button>
      <div class="section-head"><h2>${obj.label} — Report</h2></div>
      <div class="card">
        <div class="card-sub">${MKT_AUDIENCES[r.audience]} · ${MKT_SPREAD_TIERS[r.spread].label} spread</div>
        <div class="mk-report-grid">
          <div><span>Spent</span><b>${formatMoney(r.spent)}</b></div>
          <div><span>Reach</span><b>${formatNumber(r.reach)}</b></div>
          <div><span>New Customers</span><b>${formatNumber(r.newCustomers)}</b></div>
          <div><span>Sales Increase</span><b class="up">+${r.salesPct}%</b></div>
          <div><span>Reputation</span><b class="${r.reputationDelta >= 0 ? 'up' : 'down'}">${r.reputationDelta >= 0 ? '+' : ''}${r.reputationDelta}</b></div>
          <div><span>ROI</span><b class="${roiCls}">${r.roi >= 0 ? '+' : ''}${pct1(r.roi)}</b></div>
        </div>
      </div>
      <div class="mk-decision">
        <button class="btn btn-gold" data-mk="relaunch" data-id="${r.cid}">Increase Spend ›</button>
        <button class="btn" data-mk="closeReport">Stop for Now</button>
      </div>
    `;
  }

  /* ---------------------------- Influencer Deals ---------------------------- */

  function influencersHTML(id) {
    const def = ASSET_BY_ID[id];
    const c = TechCo.ensureCompany(id);
    const pool = TechCo.mktInfluencerPoolFor(id);
    const cards = pool.map((inf, i) => influencerCardHTML(id, inf, i)).join('');
    const history = c.marketing.influencerDeals;
    return `
      <button class="back-link" data-mk="toList">‹ ${_esc(def.name)}</button>
      <div class="section-head"><h2>Influencer Deals</h2></div>
      <p class="mk-hint">Outcomes aren't guaranteed — a well-matched audience, skilled staff and bought research all shift the odds toward Extremely Well.</p>
      <div class="mk-history">${cards}</div>
      <div class="section-head"><h2>Past Deals</h2></div>
      ${history.length ? `<div class="mk-history">${history.map(influencerHistoryRowHTML).join('')}</div>` : `<div class="card mk-empty">No deals signed yet.</div>`}
    `;
  }

  function influencerCardHTML(id, inf, i) {
    const sector = TechCo.mktSector(id);
    const open = view.infExpanded === i;
    const cost = TechCo.mktInfluencerCost(id, inf);
    const head = `
      <button class="card mk-hist-row" data-mk="infExpand" data-id="${i}">
        <div class="card-row">
          <div><div class="card-title">${_esc(inf.name)}</div><div class="card-sub">${inf.tierLabel} · ${formatNumber(inf.followers)} followers · ${MKT_AUDIENCES[inf.audienceTag]}</div></div>
          <div class="mk-hist-right"><div>${formatMoney(cost)}</div><div class="card-sub">~${formatNumber(inf.estReach)} reach</div></div>
        </div>
      </button>`;
    if (!open) return head;
    const audiences = MKT_SECTOR_AUDIENCES[sector] || [];
    const audience = view.infAudience || inf.audienceTag;
    const bench = TechCo.mktBenchFor(id);
    const score = TechCo.mktInfluencerScore(id, audience, view.infEmpId);
    const probs = TechCo.mktInfluencerProbs(score);
    const afford = TechCo.empFunds(id) >= cost;
    return `
      <div class="card mk-expanded-card">
        ${head}
        <div class="mk-field-label">Target Audience</div>
        <div class="chip-row">${audiences.map((aid) =>
          `<button class="chip ${audience === aid ? 'chip-active' : ''}" data-mk="infAudience" data-id="${aid}">${MKT_AUDIENCES[aid]}</button>`).join('')}</div>
        <div class="mk-field-label">Marketing Staff</div>
        <div class="chip-row">
          <button class="chip ${!view.infEmpId ? 'chip-active' : ''}" data-mk="infStaffAuto">Auto (best fit)</button>
          ${bench.map((e) => `<button class="chip ${view.infEmpId === e.id ? 'chip-active' : ''}" data-mk="infStaff" data-id="${e.id}">${_esc(e.name)}</button>`).join('')}
        </div>
        <div class="mk-odds-row">
          <div><span>Extremely Well</span><b class="up">${Math.round(probs.great * 100)}%</b></div>
          <div><span>Normally</span><b>${Math.round(probs.normal * 100)}%</b></div>
          <div><span>Poorly</span><b class="down">${Math.round(probs.poor * 100)}%</b></div>
        </div>
        <button class="btn btn-gold btn-wide" data-mk="infSign" data-id="${i}" ${afford ? '' : 'disabled'}>Sign for ${formatMoney(cost)}</button>
        ${!afford ? `<div class="card-sub mk-warn">Not enough company cash.</div>` : ''}
      </div>`;
  }

  function influencerHistoryRowHTML(d) {
    const cls = d.outcome === 'great' ? 'up' : d.outcome === 'poor' ? 'down' : '';
    const label = d.outcome === 'great' ? 'Extremely Well' : d.outcome === 'poor' ? 'Poorly' : 'Normally';
    return `
      <div class="card mk-hist-row">
        <div class="card-row">
          <div><div class="card-title">${_esc(d.name)}</div><div class="card-sub">${d.tierLabel} · ${MKT_AUDIENCES[d.audience]}</div></div>
          <div class="mk-hist-right"><div class="${cls}">${label}</div><div class="card-sub">${formatMoney(d.fee)}</div></div>
        </div>
      </div>`;
  }

  function doSignInfluencer(i) {
    const id = view.companyId;
    const pool = TechCo.mktInfluencerPoolFor(id);
    const inf = pool[i];
    if (!inf) return;
    const r = TechCo.mktSignInfluencer(id, inf, { audience: view.infAudience || inf.audienceTag, empId: view.infEmpId });
    if (!r.ok) { if (typeof UI !== 'undefined') UI.showToast(r.msg); return; }
    const label = r.deal.outcome === 'great' ? 'Extremely well!' : r.deal.outcome === 'poor' ? 'Poorly.' : 'Normally.';
    if (typeof UI !== 'undefined') UI.showToast(`🎤 <b>${_esc(inf.name)}'s deal went ${label}</b><br>Reach ~${formatNumber(r.deal.reach)}.`);
    view.infExpanded = null;
    render();
  }

  /* ------------------------------- Sponsorships ------------------------------ */

  function sponsorshipsHTML(id) {
    const def = ASSET_BY_ID[id];
    const c = TechCo.ensureCompany(id);
    const cards = SPONSORSHIP_PROPERTIES.map((p) => sponsorshipCardHTML(id, p)).join('');
    const active = c.marketing.sponsorships.filter((s) => s.untilMs > Date.now());
    const past = c.marketing.sponsorships.filter((s) => s.untilMs <= Date.now());
    return `
      <button class="back-link" data-mk="toList">‹ ${_esc(def.name)}</button>
      <div class="section-head"><h2>Sponsorships</h2></div>
      <p class="mk-hint">Long-running brand deals — an immediate reputation lift plus a modest passive boost that lasts for the sponsorship's term.</p>
      ${active.length ? `<div class="section-head"><h2>Active</h2></div><div class="mk-history">${active.map(sponsorshipHistoryRowHTML).join('')}</div>` : ''}
      <div class="section-head"><h2>Available Properties</h2></div>
      <div class="mk-history">${cards}</div>
      ${past.length ? `<div class="section-head"><h2>Past</h2></div><div class="mk-history">${past.map(sponsorshipHistoryRowHTML).join('')}</div>` : ''}
    `;
  }

  function sponsorshipCardHTML(id, p) {
    const sector = TechCo.mktSector(id);
    const open = view.spExpanded === p.id;
    const fit = mktSponsorshipFit(p, sector);
    const head = `
      <button class="card mk-hist-row" data-mk="spExpand" data-id="${p.id}">
        <div class="card-row">
          <div><div class="card-title">${_esc(p.name)}</div><div class="card-sub">${p.kind}</div></div>
          <div class="card-sub">${Math.round(fit * 100)}% fit</div>
        </div>
      </button>`;
    if (!open) return head;
    const tier = SPONSORSHIP_TIERS[view.spTier];
    const cost = TechCo.mktSponsorshipCost(id, view.spTier);
    const afford = TechCo.empFunds(id) >= cost;
    return `
      <div class="card mk-expanded-card">
        ${head}
        <div class="mk-field-label">Tier</div>
        <div class="chip-row">${SPONSORSHIP_TIER_IDS.map((tid) =>
          `<button class="chip ${view.spTier === tid ? 'chip-active' : ''}" data-mk="spTier" data-id="${tid}">${SPONSORSHIP_TIERS[tid].label}</button>`).join('')}</div>
        <div class="card-sub" style="margin-top:8px">Up to +${(tier.repMax * fit).toFixed(1)} reputation · runs ${tier.costMult * 10} in-game days</div>
        <button class="btn btn-gold btn-wide" data-mk="spSign" data-id="${p.id}" ${afford ? '' : 'disabled'}>Sponsor for ${formatMoney(cost)}</button>
        ${!afford ? `<div class="card-sub mk-warn">Not enough company cash.</div>` : ''}
      </div>`;
  }

  function sponsorshipHistoryRowHTML(s) {
    const active = s.untilMs > Date.now();
    return `
      <div class="card mk-hist-row">
        <div class="card-row">
          <div><div class="card-title">${_esc(s.propertyName)}</div><div class="card-sub">${s.kind} · ${SPONSORSHIP_TIERS[s.tier].label}</div></div>
          <div class="mk-hist-right"><div class="up">+${s.repGain} rep</div><div class="card-sub">${active ? formatDuration((s.untilMs - Date.now()) / 1000) + ' left' : 'Ended'}</div></div>
        </div>
      </div>`;
  }

  function doSignSponsorship(propertyId) {
    const id = view.companyId;
    const r = TechCo.mktStartSponsorship(id, propertyId, view.spTier);
    if (!r.ok) { if (typeof UI !== 'undefined') UI.showToast(r.msg); return; }
    if (typeof UI !== 'undefined') UI.showToast(`🏟️ <b>${_esc(r.sponsorship.propertyName)} sponsorship signed</b><br>+${r.sponsorship.repGain} reputation.`);
    view.spExpanded = null;
    render();
  }

  /* ----------------------------- Market Research ----------------------------- */

  function researchHTML(id) {
    const def = ASSET_BY_ID[id];
    const c = TechCo.ensureCompany(id);
    const sector = TechCo.mktSector(id);
    const audiences = MKT_SECTOR_AUDIENCES[sector] || [];
    const cost = TechCo.mktResearchCost(id);
    const hasResearcher = TechCo.mktHasResearcher(id);
    const rows = audiences.map((aid) => {
      const insight = c.marketing.researchInsights[aid];
      return `
        <div class="card">
          <div class="card-row">
            <div class="card-title">${MKT_AUDIENCES[aid]}</div>
            ${!insight ? `<button class="btn btn-sm" data-mk="runResearch" data-id="${aid}">Research · ${formatMoney(cost)}</button>` : ''}
          </div>
          ${insight ? `<div class="card-sub mk-insight">"${_esc(insight.text)}"</div><button class="btn btn-sm" data-mk="runResearch" data-id="${aid}">Re-run · ${formatMoney(cost)}</button>` : `<div class="card-sub">No insight bought yet — nudges recommended messages for this audience.</div>`}
        </div>`;
    }).join('');
    return `
      <button class="back-link" data-mk="toList">‹ ${_esc(def.name)}</button>
      <div class="section-head"><h2>Market Research</h2></div>
      <p class="mk-hint">${hasResearcher ? 'A Market Researcher on staff halves the cost and sharpens the read.' : 'Hire a Market Researcher (Hiring &amp; Talent) to halve research cost and sharpen the read.'}</p>
      ${rows}
    `;
  }

  function doRunResearch(audience) {
    const id = view.companyId;
    const r = TechCo.mktRunResearch(id, audience);
    if (!r.ok) { if (typeof UI !== 'undefined') UI.showToast(r.msg); return; }
    render();
  }

  return { mount };
})();
