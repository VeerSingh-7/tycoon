/* =========================================================================
 * marketing.js — Marketing & Growth (Services → Invest → Marketing & Growth)
 * -------------------------------------------------------------------------
 * BLANK FOR NOW (state.js SAVE_VERSION 25): campaigns for the 48 stock
 * companies have been removed — the screen shows a placeholder instead of a
 * company selector. Any player with an active (unresolved) campaign was
 * refunded its full budget as part of that migration; completed campaign
 * history, reputation and any already-granted income boosts are untouched
 * (already-realized value, not clawed back).
 *
 * Everything BELOW the selector — Quick/Advanced Campaign, the Agency
 * (IGB) guided flow, Influencer Deals, Sponsorships, Market Research — is
 * left fully intact and correct, just unreachable, since there's no company
 * card left to tap into it from. Kept rather than deleted so it's ready to
 * be re-pointed at a real data source (e.g. the Business tab's 14
 * businesses) later — the same "entry points only" choice already made for
 * the stock-side "Manage Company" removal. Quick Campaign itself (objective
 * + audience + a budget slider, one or two taps to launch, auto-suggested
 * channel mix, auto-picked marketing employee) and Advanced mode (manual
 * per-channel weighting, explicit spread tier, message picker, manual
 * staff) still share the one mktStartCampaign() engine call, unchanged.
 *
 * Uses the game's normal theme (base --gold/--bg-elev tokens, themeable
 * light/dark) — NOT the Product Studio blueprint reskin.
 * ========================================================================= */

// The in-fiction marketing agency: a conversational front-end on top of the
// Quick Campaign flow below — same "in-world service provider" family as the
// Hiring Agency (js/hiring.js's IGX / Irongate Talent Exchange), a sibling
// desk under the same Irongate name. Distinct identifier names (MKT_ prefix)
// since both files share one global script scope — a bare AGENCY_TAG here
// would collide with hiring.js's.
const MKT_AGENCY_TAG = 'IGB';
const MKT_AGENCY_NAME = 'Irongate Growth Bureau';

const Marketing = (() => {
  const view = {
    companyId: null, mode: 'list', quick: null, reportCid: null, advanced: false,
    infExpanded: null, infAudience: null, infEmpId: null,
    spExpanded: null, spTier: 'local',
    agency: null, // { step: 'business'|'channel'|'tier', search, companyId, channel } — the guided flow
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
    view.spExpanded = null; view.spTier = 'local'; view.agency = null;
    render();
  }

  function render() {
    if (!root) return;
    const body = view.agency ? agencyFlowHTML() : (view.companyId ? companyRoot(view.companyId) : selectorHTML());
    root.innerHTML = `<div class="mk-page">${body}</div>`;
    wireAgencySearch();
  }

  /** The business-search input is patched in place on every keystroke (never
   *  a full render()) so it never loses focus — same pattern as the Choose
   *  Role sheet in js/hiring.js and the Product Studio name field. */
  function wireAgencySearch() {
    const input = root.querySelector('#mkAgencyBizSearch');
    if (!input) return;
    input.oninput = (e) => {
      view.agency.search = e.target.value;
      const results = root.querySelector('#mkAgencyBizResults');
      if (results) results.innerHTML = agencyBizResultsHTML();
    };
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
    // Marketing Agency — a guided on-ramp into Quick Campaign, see below.
    else if (a === 'agencyStart') { view.agency = { step: 'business', search: '', companyId: null, channel: null }; render(); }
    else if (a === 'agencyCancel') { view.agency = null; render(); }
    else if (a === 'agencyBack') {
      if (view.agency.step === 'tier') view.agency.step = 'channel';
      else if (view.agency.step === 'channel') { view.agency.step = 'business'; view.agency.companyId = null; }
      render();
    }
    else if (a === 'agencyPickCompany') { view.agency.companyId = id; view.agency.step = 'channel'; render(); }
    else if (a === 'agencyPickChannel') { view.agency.channel = id; view.agency.step = 'tier'; render(); }
    else if (a === 'agencyPickTier') { doAgencyHandoff(id); }
  }

  function onInput(e) {
    const range = e.target.closest('[data-mk-range]');
    if (range && range.dataset.mkRange === 'budget') { view.quick.budgetFrac = +range.value / 100; renderBudgetPreview(); return; }
    const text = e.target.closest('[data-mk-text]');
    if (text && text.dataset.mkText === 'customMessage') { view.quick.customMessage = text.value; }
  }

  /* ------------------------------ Selector -------------------------------- */
  // Blank for now — see the file header. No company is ever reachable here,
  // so nothing below this point in the file (Quick Campaign, the Agency
  // flow, Influencer Deals, Sponsorships, Market Research) can currently be
  // navigated to.

  function selectorHTML() {
    return `
      <button class="back-link" data-act="hub">‹ Services</button>
      <div class="section-head"><h2>Marketing &amp; Growth</h2></div>
      <div class="card mk-empty">Marketing &amp; Growth isn't available right now — check back soon.</div>
    `;
  }

  /* ------------------------------ Marketing Agency --------------------------- *
   * A conversational, step-by-step on-ramp into Quick Campaign — every step
   * calls straight into the exact same TechCo.mkt* API and data/marketing.js
   * tables the Quick/Advanced forms already use. Nothing here is a second
   * campaign system: the flow ends by handing off into the real Advanced
   * form (quickFormHTML), pre-filled with what it already gathered, so the
   * player's channel + spread choices are genuinely respected by the exact
   * existing mktStartCampaign() call — not silently discarded.
   *   Step 1: business  — searchable picker, same Market.isOwned gate.
   *   Step 2: channel   — icon grid over the real MKT_CHANNELS list.
   *   Step 3: tier      — Local/Regional/National/Global, priced from the
   *                        real mktBudgetRange() thresholds mktStartCampaign
   *                        itself already uses to tell tiers apart, with a
   *                        reach preview from the real mktEffectiveness() +
   *                        mktEstimateReach() formulas.
   * "No thanks" cancels back to the Marketing & Growth home at any step. */

  function agencyIconSVG() {
    return `<svg viewBox="0 0 32 32" class="mk-agency-icon-svg" aria-hidden="true">
      <circle cx="9" cy="24" r="2.2" fill="currentColor"/>
      <path d="M13 20 A7.5 7.5 0 0 1 13 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M17 24 A11.5 11.5 0 0 1 17 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
    </svg>`;
  }

  function agencyFlowHTML() {
    if (view.agency.step === 'channel') return agencyChannelHTML();
    if (view.agency.step === 'tier') return agencyTierHTML();
    return agencyBusinessHTML();
  }

  function agencyCtaHTML() {
    return `
      <div class="card mk-agency-cta" data-mk="agencyStart" role="button" tabindex="0" aria-label="Talk to ${MKT_AGENCY_TAG}">
        <span class="mk-agency-icon">${agencyIconSVG()}</span>
        <div class="mk-agency-cta-text">
          <div class="card-title">Talk to ${MKT_AGENCY_TAG}</div>
          <div class="card-sub">Let ${MKT_AGENCY_NAME} walk you through a channel and a spend.</div>
        </div>
        <span class="hub-arrow">›</span>
      </div>`;
  }

  /** The greeting panel shown at the top of every agency step — the message
   *  changes with what's already been gathered, but it's the SAME panel. */
  function agencyGreetingHTML(def) {
    let msg;
    if (!def) msg = `${MKT_AGENCY_TAG} — which business would you like to promote today?`;
    else if (view.agency.step === 'channel') msg = `${MKT_AGENCY_TAG} — looking to promote ${_esc(def.name)}? Which channel would you like to use?`;
    else msg = `${MKT_AGENCY_TAG} — good pick. How far should this reach?`;
    return `
      <div class="mk-agency-panel">
        <div class="mk-agency-top">
          <span class="mk-agency-icon">${agencyIconSVG()}</span>
          <div class="mk-agency-name">${MKT_AGENCY_TAG} <span class="muted">// ${MKT_AGENCY_NAME}</span></div>
        </div>
        <div class="mk-agency-msg">${msg}</div>
      </div>`;
  }

  /* Step 1: business picker — every 100%-owned stock company, search-as-you-type. */

  function agencyBusinessHTML() {
    return `
      <button class="back-link" data-mk="agencyCancel">‹ Marketing &amp; Growth</button>
      ${agencyGreetingHTML(null)}
      <input id="mkAgencyBizSearch" class="mk-agency-search-input" type="text"
        placeholder="Search your companies…" value="${_esc(view.agency.search || '')}" autocomplete="off">
      <div id="mkAgencyBizResults" class="mk-agency-biz-list">${agencyBizResultsHTML()}</div>
    `;
  }

  function agencyBizResultsHTML() {
    const q = (view.agency.search || '').trim().toLowerCase();
    const owned = ASSET_DEFS.filter((d) => d.group === 'stock' && Market.isOwned(d.id));
    if (!owned.length) return `<div class="card mk-empty">Own 100% of a company first — the same rule as everywhere else in Marketing &amp; Growth.</div>`;
    const rows = owned.filter((d) => !q || d.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
    if (!rows.length) return `<div class="tc-hint">No companies match "${_esc(view.agency.search || '')}".</div>`;
    return rows.map((d) => `
      <button class="mk-agency-biz-row" data-mk="agencyPickCompany" data-id="${d.id}">
        ${Logos.tile(d)}
        <div class="mk-agency-biz-main"><b>${_esc(d.name)}</b><span class="card-sub">${_esc(SECTOR_DISPLAY[d.sector] || 'Company')}</span></div>
        <span class="hub-arrow">›</span>
      </button>`).join('');
  }

  /* Step 2: channel — icon grid over the real 15-channel list, grouped the
   * same Digital/Traditional/Physical way Advanced mode already groups it. */

  const MKT_CHAN_ICON = {
    social_media: '<circle cx="6" cy="12" r="2.3"/><circle cx="17" cy="6" r="2.3"/><circle cx="17" cy="18" r="2.3"/><path d="M8.1 10.8 14.9 7.2 M8.1 13.2 14.9 16.8"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.3 15.3 21 21"/>',
    video: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9 15 12 10 15 Z" fill="currentColor" stroke="none"/>',
    influencers: '<circle cx="9" cy="8" r="3"/><path d="M4 20c0-3.6 2.5-6 5-6s5 2.4 5 6"/><path d="M18 5.3 19 7.3 21.2 7.6 19.6 9 20 11.2 18 10.1 16 11.2 16.4 9 14.8 7.6 17 7.3 Z"/>',
    websites: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8h18"/><circle cx="6" cy="6" r=".7" fill="currentColor" stroke="none"/><circle cx="9" cy="6" r=".7" fill="currentColor" stroke="none"/>',
    email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 6.5 12 13 21 6.5"/>',
    tv: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8 M12 16v4"/>',
    radio: '<rect x="3" y="9" width="18" height="10" rx="2"/><path d="M8 9 6 3 M16 9 19 4"/><circle cx="8" cy="14" r="2"/><path d="M14 13h4 M14 16h4"/>',
    newspapers: '<path d="M4 4h13v14a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2 Z"/><path d="M7 8h7 M7 11h7 M7 14h4"/>',
    billboards: '<rect x="3" y="4" width="18" height="10" rx="1"/><path d="M8 20 9 14 M16 20 15 14"/>',
    magazines: '<path d="M5 3h11l3 3v15H5 Z"/><path d="M16 3v3h3"/><path d="M8 10h7 M8 13h7 M8 16h4"/>',
    store_promotions: '<path d="M11 3h7v7l-9 9-7-7 Z"/><circle cx="15" cy="7" r="1.4" fill="currentColor" stroke="none"/>',
    events: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18 M8 3v4 M16 3v4"/>',
    product_demos: '<path d="M12 3 21 8 21 16 12 21 3 16 3 8 Z"/><path d="M3 8 12 13 21 8 M12 13v8"/>',
    trade_shows: '<path d="M6 3v18"/><path d="M6 4h12l-3 4 3 4H6"/>',
  };
  function channelIconSVG(chId) {
    const p = MKT_CHAN_ICON[chId] || MKT_CHAN_ICON.events;
    return `<svg class="mk-chan-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  }

  function agencyChannelHTML() {
    const def = ASSET_BY_ID[view.agency.companyId];
    const cats = MKT_CHANNEL_CATEGORIES.map((cat) => {
      const chans = MKT_CHANNEL_IDS.filter((cid) => MKT_CHANNELS[cid].category === cat.id);
      const icons = chans.map((cid) => `
        <button class="mk-chan-icon-btn ${view.agency.channel === cid ? 'on' : ''}" data-mk="agencyPickChannel" data-id="${cid}">
          <span class="mk-chan-icon">${channelIconSVG(cid)}</span>
          <span class="mk-chan-icon-label">${MKT_CHANNELS[cid].label}</span>
        </button>`).join('');
      return `<div class="mk-field-label">${cat.label}</div><div class="mk-chan-icon-grid">${icons}</div>`;
    }).join('');
    return `
      <button class="back-link" data-mk="agencyBack">‹ Choose a different business</button>
      ${agencyGreetingHTML(def)}
      ${cats}
      <button class="mk-agency-cancel-link" data-mk="agencyCancel">No thanks, not right now</button>
    `;
  }

  /* Step 3: spread tier — package-style cards, priced from the REAL budget
   * thresholds mktStartCampaign already uses to tell Local/Regional/National/
   * Global apart, with a reach preview from the real effectiveness formula. */

  /** The budget a tier card advertises — the exact same threshold values
   *  mktStartCampaign's own auto-derive-spread-from-budget logic uses, so a
   *  tap here reproduces the tier it's labelled with, no new numbers. */
  function agencyTierBudget(id, tierId) {
    const range = TechCo.mktBudgetRange(id);
    if (tierId === 'local') return range.min;
    if (tierId === 'regional') return range.typical * 0.4;
    if (tierId === 'national') return range.typical * 1.2;
    return range.max * 0.6; // global
  }

  /** The objective/audience/channel/staff the flow infers by this point —
   *  same defaults Quick Campaign itself starts from (defaultQuick), plus
   *  the one channel just chosen — used only to preview effectiveness/reach. */
  function agencyInferredCamp(id) {
    const q = defaultQuick(id);
    return { audience: q.audience, message: null, channels: { [view.agency.channel]: 1 }, empId: (TechCo.mktBestBenchFor(id) || {}).id || null };
  }

  function agencyTierHTML() {
    const id = view.agency.companyId;
    const def = ASSET_BY_ID[id];
    const eff = TechCo.mktEffectiveness(id, agencyInferredCamp(id)).total;
    const funds = TechCo.empFunds(id);
    const cards = MKT_SPREAD_IDS.map((tid) => {
      const tier = MKT_SPREAD_TIERS[tid];
      const budget = agencyTierBudget(id, tid);
      const { reach } = TechCo.mktEstimateReach(budget, eff);
      const afford = funds >= budget;
      return `
        <button class="mk-tier-card ${afford ? '' : 'unaffordable'}" data-mk="agencyPickTier" data-id="${tid}" ${afford ? '' : 'disabled'}>
          <div class="mk-tier-name">${tier.label}</div>
          <div class="mk-tier-price">${formatMoney(budget)}</div>
          <div class="mk-tier-reach">~${formatNumber(reach)} reached · ${tier.days} day${tier.days === 1 ? '' : 's'}</div>
          ${!afford ? `<div class="mk-warn">Not enough company cash</div>` : ''}
        </button>`;
    }).join('');
    return `
      <button class="back-link" data-mk="agencyBack">‹ Change channel</button>
      ${agencyGreetingHTML(def)}
      <div class="mk-tier-grid">${cards}</div>
      <button class="mk-agency-cancel-link" data-mk="agencyCancel">No thanks, not right now</button>
    `;
  }

  /** Hand off into the REAL Quick Campaign form (Advanced mode, so the
   *  chosen spread + channel are actually respected by doLaunch() instead of
   *  being auto-derived) — pre-filled with everything the flow gathered.
   *  Objective/audience use Quick Campaign's own defaults and stay fully
   *  editable on the form, same as "quickly confirmed" implies; nothing here
   *  re-implements mktStartCampaign or its budget/effectiveness math. */
  function doAgencyHandoff(tierId) {
    const ag = view.agency, id = ag.companyId;
    const range = TechCo.mktBudgetRange(id);
    const budget = agencyTierBudget(id, tierId);
    const q = defaultQuick(id);
    q.budgetFrac = Math.max(0, Math.min(1, (budget - range.min) / Math.max(1, range.max - range.min)));
    q.spread = tierId;
    q.weights = { [ag.channel]: 2 }; // "Normal" weight, 100% of spend on the chosen channel
    view.agency = null;
    view.companyId = id;
    view.advanced = true;
    view.mode = 'quick';
    view.quick = q;
    render();
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
