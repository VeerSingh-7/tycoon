/* =========================================================================
 * bizdash.js — Business tab: dedicated per-business page
 * -------------------------------------------------------------------------
 * One shared, parameterized page for all 14 businesses — the same "one
 * component, not N bespoke ones" principle the stock side's TechCo
 * dashboard (js/techco.js `open`/`rebuildDash`) used for its 48 companies,
 * back when it had a reachable entry point (since removed — buy/sell +
 * passive owner income only now for stocks/crypto).
 *
 * This module does NOT redefine or re-derive any business's mechanics: the
 * Operations tab is just Mechanics.panelHTML(def) (already built), and the
 * Staff/Upgrades tabs are Businesses.staffHTML/upgradesHTML (already built,
 * exported from js/businesses.js) — this page only exposes them properly
 * instead of cramming everything into the list card.
 *
 * Visual style matches the Business tab's own look (.card, .biz-stats,
 * .upgrade-list, gold accents, themeable light/dark tokens) — NOT the
 * Product Studio blueprint reskin, which is a separate, unrelated screen.
 * ========================================================================= */

const BizDash = (() => {
  let dash = null; // { id, el, tab } — null when closed

  const TABS = [
    { id: 'overview',   label: 'Overview' },
    { id: 'operations', label: 'Operations' },
    { id: 'staff',       label: 'Staff' },
    { id: 'upgrades',    label: 'Upgrades' },
  ];

  function open(id) {
    const def = BUSINESS_BY_ID[id];
    if (!def || getBiz(id).level <= 0) return; // only owned businesses have a dedicated page
    const el = document.createElement('div');
    el.className = 'bizd-screen';
    el.addEventListener('click', onClick);
    document.body.appendChild(el);
    dash = { id, el, tab: 'overview' };
    lock(true);
    render();
  }

  function close() {
    if (!dash) return;
    dash.el.remove();
    dash = null;
    lock(false);
  }

  function lock(on) { try { document.body.style.overflow = on ? 'hidden' : ''; } catch (e) {} }

  function onClick(e) {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    const d = btn.dataset;

    if (d.bizdClose !== undefined) { close(); return; }
    if (d.bizdTab) { dash.tab = d.bizdTab; render(); return; }

    let changed = false;
    if (d.buy) changed = buyBusinessLevel(d.buy);
    else if (d.upgrade) changed = buyBusinessUpgrade(d.biz, d.upgrade);
    else if (d.hire) changed = hireStaff(d.hire);
    else if (d.mechAction) { changed = Mechanics.action(d.biz, d.mechAction, d.arg); if (changed) saveGame(); }
    else if (d.sell) {
      const def = BUSINESS_BY_ID[d.sell];
      const refund = SELL_REFUND_RATE * businessSpentOnLevels(def);
      if (confirm(`Sell ${def.name} for ${formatMoney(refund)}? This frees a business slot but resets its progress.`)) {
        if (sellBusiness(d.sell)) {
          close();
          UI.renderBalance();
          if (typeof Businesses !== 'undefined') Businesses.render();
          return;
        }
      }
      return;
    }

    if (changed) {
      UI.renderBalance();
      render();
      if (typeof Businesses !== 'undefined') Businesses.render(); // keep the list card's numbers in sync underneath
    }
  }

  function render() {
    if (!dash) return;
    const id = dash.id, def = BUSINESS_BY_ID[id], biz = getBiz(id);
    if (biz.level <= 0) { close(); return; } // sold from elsewhere while open

    dash.el.innerHTML = `
      <div class="bizd-head">
        <button class="icon-btn" data-bizd-close aria-label="Close">✕</button>
        <div class="bizd-id">
          <div class="bizd-co-name">${def.icon} ${def.name}</div>
          <div class="bizd-co-sub">${def.blurb}</div>
        </div>
        <div class="bizd-level">Lv ${biz.level}</div>
      </div>

      <div class="bizd-hero">
        <div class="bizd-hero-label">Net Income</div>
        <div class="bizd-hero-value">${formatRate(businessIncomePerSec(def))}</div>
        <div class="bizd-hero-sub">Staff ${biz.staff}/${maxStaff(def)} · ${Object.keys(biz.upgrades).length}/${def.upgrades.length} upgrades owned</div>
      </div>

      <div class="bizd-tabs">${TABS.map((t) =>
        `<button class="bizd-tab ${dash.tab === t.id ? 'on' : ''}" data-bizd-tab="${t.id}">${t.label}</button>`).join('')}</div>

      <div class="bizd-body" id="bizdBody">${tabHTML(dash.tab, def, biz)}</div>
    `;
  }

  function tabHTML(tab, def, biz) {
    if (tab === 'operations') return operationsHTML(def);
    if (tab === 'staff') return `<div class="card">${Businesses.staffHTML(def, biz)}</div>`;
    if (tab === 'upgrades') return `<div class="upgrade-list">${Businesses.upgradesHTML(def, biz)}</div>`;
    return overviewHTML(def, biz);
  }

  function operationsHTML(def) {
    // Every business in the 14-business overhaul has exactly one mechanic
    // lever (js/mechanics.js) — this just surfaces the SAME panel the list
    // card used to show, on its own tab instead of crammed inline.
    const panel = Mechanics.panelHTML(def);
    return panel || `<div class="bizd-empty">No live operations lever for this business — just level up and hire staff.</div>`;
  }

  function overviewHTML(def, biz) {
    const net = businessIncomePerSec(def);
    const nextCost = businessNextCost(def);
    const canBuy = state.balance >= nextCost;
    const ms = nextMilestone(biz.level);
    const refund = SELL_REFUND_RATE * businessSpentOnLevels(def);
    return `
      <div class="card">
        <div class="biz-stats">
          <div><span class="muted">Net income</span><b class="gold">${formatRate(net)}</b></div>
          <div><span class="muted">Next level</span><b>${formatMoney(nextCost)}</b></div>
        </div>
        <button class="btn btn-wide ${canBuy ? 'btn-gold' : ''}" data-buy="${def.id}" ${canBuy ? '' : 'disabled'}>
          Buy Level ${biz.level + 1} · ${formatMoney(nextCost)}</button>
        <div class="progress-caption">💥 Output ×2 at Lv ${ms} (milestone)</div>
      </div>
      <button class="sell-link" data-sell="${def.id}">Sell business — ${formatMoney(refund)} refund (25%), frees slot</button>
    `;
  }

  /** Test-only hook: render one business's tab content directly, with no DOM
   * involved — lets tests exhaustively check every business × every tab. */
  function _renderTabHTML(id, tab) {
    const def = BUSINESS_BY_ID[id];
    const biz = getBiz(id);
    return tabHTML(tab, def, biz);
  }

  return { open, close, TABS, _renderTabHTML };
})();
