/* =========================================================================
 * invest.js — Phase 4 (overhauled) UI: our own pro mobile trading screen
 * -------------------------------------------------------------------------
 * Stocks + crypto only (real estate lives on the Business tab). Screens:
 *   list       — Portfolio card (→ Holdings) + a Stocks / Crypto toggle, then
 *                a clean list of the selected group
 *   detail     — ticker/name header, big price + today & month %, inline chart
 *                (tap → fullscreen), Your Investment, Stats, Buyout / Manage,
 *                pinned Buy / Sell bar
 *   fullscreen — big chart + 1S/1MIN/1H/1D/1W/1M/MAX timeframe row
 *   ticket     — Buy/Sell amount (slider + quick %), then Review order
 *
 * Performance: rows are patched in place each second, and ONLY rows that are
 * actually on screen (IntersectionObserver) — 170 assets cost nothing while
 * scrolled away or collapsed. Only the open asset runs the full chart.
 * ========================================================================= */

const Invest = (() => {
  const view = {
    mode: 'list', seg: 'stock', pfSeg: 'stock', q: '',
    assetId: null, tf: MARKET.DEFAULT_TF,
    returnTo: 'list', // where a detail's back button goes (list or portfolio)
    scrollY: 0,       // saved list/portfolio scroll to restore on back
  };

  // Rows are patched every tick with each asset's staggered display price
  // (Market.dispPrice) — the value only actually changes on that asset's own
  // ~15s phase, so different stocks visibly update at different moments.

  // Categories on the dedicated Portfolio page.
  const PF_SEGS = [
    { id: 'stock',  label: 'Stocks' },
    { id: 'crypto', label: 'Crypto' },
  ];
  let container = null;
  let chart = null, chartAsset = null, chartTf = null;       // inline chart
  let chartSig = null;                                       // last redraw signature (gates redraws)
  let fs = null;                                             // fullscreen {chart, tf, sig}

  // Redraw signature for an asset+timeframe. It changes when a NEW bar forms
  // for the timeframe (so the chart advances at that cadence — 1S per second,
  // 1W weekly, 1M monthly …) OR when the displayed quote ticks (so the live
  // price on the chart always equals the header/list number to the penny, on
  // every timeframe). Between those, nothing redraws, so long timeframes don't
  // churn on every render tick.
  function chartSigOf(id, tf) {
    const secs = Market.tfBucketSecs(id, tf);
    const bar = Math.floor((Date.now() / 1000) / secs);
    return bar + '|' + Market.quoteEpoch(id);
  }
  let trade = null;                                          // full-screen trade page
  let bodyTimer = 0;                                         // search debounce
  let visObserver = null;                                    // on-screen rows
  const visibleIds = new Set();

  /** Lock/unlock page scroll behind a full-screen overlay. */
  function lockScroll(on) { try { document.body.style.overflow = on ? 'hidden' : ''; } catch (e) {} }

  /* Preserve the list/portfolio scroll position when opening & closing a
     detail, so tapping a row near the bottom doesn't jump you to the top. */
  function getScroll() {
    return window.pageYOffset || document.documentElement.scrollTop || (document.body && document.body.scrollTop) || 0;
  }
  function setScroll(y) { try { window.scrollTo(0, y); } catch (e) {} }
  function restoreScroll(y) {
    // Wait for the rebuilt list to lay out before restoring the offset.
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setScroll(y || 0));
    else setScroll(y || 0);
  }

  const plCls = (v) => (v >= 0 ? 'up' : 'down');
  const sign = (v) => (v >= 0 ? '+' : '');
  // List rows show a ▲/▼ arrow with the magnitude (the arrow carries the sign).
  const changeText = (v) => `${v >= 0 ? '▲' : '▼'} ${Math.abs(v).toFixed(2)}%`;
  // A detail's back button names where it returns to.
  const backLabel = () => (view.returnTo === 'portfolio' ? 'Portfolio' : 'Markets');
  // Profit/loss shown Trading-212 style: money made/lost AND the % together.
  const plStr = (pl, pct) => {
    const s = pl >= 0 ? '+' : '-';
    return `${s}${formatMoney(Math.abs(pl))} (${s}${Math.abs(pct).toFixed(2)}%)`;
  };
  // Ownership % with adaptive precision so even a small real stake is visible
  // (never a flat "0.00%" when you actually hold shares).
  const ownPctStr = (pct) => {
    if (pct <= 0) return '0%';
    if (pct >= 1) return pct.toFixed(2) + '%';
    if (pct >= 0.01) return pct.toFixed(3) + '%';
    return pct.toPrecision(2) + '%';
  };

  /* --------------------------- Segments ----------------------------- */
  // One simple toggle: Stocks | Crypto. Holdings is reached by tapping the
  // Portfolio card. (Real estate lives on the Business tab.)

  const SEGS = [
    { id: 'stock',  label: 'Stocks' },
    { id: 'crypto', label: 'Crypto' },
  ];

  function matchSeg(def) {
    if (view.seg === 'held') return Market.holding(def.id).shares > 0;
    return def.group === view.seg;
  }

  function mount(el) {
    container = el;
    container.addEventListener('click', onClick);
    destroyChart();
    render();
  }

  /* --------------------------- Event handling ---------------------------- */

  function onClick(e) {
    const t = e.target.closest('[data-act]');
    if (!t || t.disabled) return;
    const a = t.dataset.act;
    const id = t.dataset.id;

    if (a === 'open') { view.scrollY = getScroll(); view.returnTo = view.mode === 'portfolio' ? 'portfolio' : 'list'; view.mode = 'detail'; view.assetId = id; view.tf = MARKET.DEFAULT_TF; destroyChart(); render(); setScroll(0); }
    // From a detail, go back to wherever it was opened from (Portfolio or
    // Markets) AND restore the exact scroll position you left. The Portfolio
    // page's own back-link always returns to Markets.
    else if (a === 'back') { view.mode = view.mode === 'portfolio' ? 'list' : (view.returnTo === 'portfolio' ? 'portfolio' : 'list'); destroyChart(); render(); restoreScroll(view.scrollY); }
    else if (a === 'portfolio') { view.mode = 'portfolio'; destroyChart(); render(); }
    else if (a === 'pfSeg') { view.pfSeg = id; render(); }
    else if (a === 'browse') { view.mode = 'list'; view.seg = id; destroyChart(); render(); }
    else if (a === 'seg') { view.seg = id; render(); }
    else if (a === 'tf') { view.tf = id; if (chart) { chart.setData(Market.candles(view.assetId, view.tf)); chartTf = view.tf; chartSig = chartSigOf(view.assetId, view.tf); } markTf(); }
    else if (a === 'fullscreen') openFullscreen();
    else if (a === 'buy') openTicket('buy');
    else if (a === 'sell') openTicket('sell');
    else if (a === 'manage') doManage(t.dataset.action);
  }

  function render() {
    if (!container) return;
    if (view.mode === 'detail') renderDetail();
    else if (view.mode === 'portfolio') renderPortfolio();
    else renderList();
  }

  /* ------------------------------ List view ------------------------------ */

  function fmtShares(s) {
    if (s >= 1000) return formatNumber(s);
    return (Math.round(s * 10000) / 10000).toString();
  }

  /** Portfolio total across your securities (stocks + crypto), using the same
   *  synced display price as the rows. */
  function grandTotal() {
    return Market.portfolioSummary();
  }

  function renderList() {
    const g = grandTotal();
    container.innerHTML = `
      <div class="section-head"><h2>Markets</h2></div>
      <div class="card pf-card pf-card-lg" data-act="portfolio" role="button">
        <div class="card-row">
          <div><div class="card-title">Portfolio</div><div class="card-sub">Stocks · Crypto</div></div>
          <div class="pf-numbers">
            <div class="pf-value" id="pfcVal">${formatMoney(g.value)}</div>
            <div class="pf-pl ${plCls(g.pl)}" id="pfcPl">${plStr(g.pl, g.plPct)}</div>
          </div>
        </div>
        <button class="btn btn-wide pf-view-btn" data-act="portfolio">View Portfolio ›</button>
      </div>
      <div class="seg-row">${SEGS.map((s) =>
        `<button class="seg ${view.seg === s.id ? 'seg-active' : ''}" data-act="seg" data-id="${s.id}">${s.label}</button>`).join('')}</div>
      <div id="mktBody"></div>
    `;
    renderBody();
  }

  /** Live-update the Markets Portfolio summary card (value + P/L). */
  function patchPortfolioCard() {
    const val = document.getElementById('pfcVal');
    if (!val) return; // card not on screen
    const g = grandTotal();
    val.textContent = formatMoney(g.value);
    const pl = document.getElementById('pfcPl');
    if (pl) { pl.textContent = plStr(g.pl, g.plPct); pl.className = `pf-pl ${plCls(g.pl)}`; }
  }

  /** Rebuild only the list body (a clean list of the selected segment). */
  function renderBody() {
    const el = document.getElementById('mktBody');
    if (!el) return;
    const q = view.q.trim().toLowerCase();
    const pool = q
      ? ASSET_DEFS.filter((d) => d.name.toLowerCase().includes(q) || d.ticker.toLowerCase().includes(q))
      : ASSET_DEFS.filter(matchSeg);
    el.innerHTML = pool.length
      ? `<div class="asset-list">${pool.map((d) => rowHTML(d, Market.dispPrice(d.id), Market.dispChangePct(d.id))).join('')}</div>`
      : emptyHTML();
    observeRows();
  }

  function rowHTML(def, p, ch) {
    const h = Market.holding(def.id);
    const sub = h.shares > 0
      ? `Holding ${fmtShares(h.shares)} · ${def.ticker}`
      : `${def.ticker} · ${def.group === 'stock' ? def.sector : def.group}`;
    return `
      <button class="asset-row" data-act="open" data-id="${def.id}">
        ${Logos.tile(def)}
        <div class="asset-name-wrap">
          <div class="asset-sym">${def.name}</div>
          <div class="asset-name">${sub}</div>
        </div>
        <div class="asset-price-wrap">
          <div class="asset-price" data-price="${def.id}">${formatMoney(p)}</div>
          <div class="asset-change ${plCls(ch)}" data-change="${def.id}">${changeText(ch)}</div>
        </div>
      </button>`;
  }

  function emptyHTML() {
    if (view.q.trim()) return '<div class="coming-soon"><p>Nothing matches your search.</p></div>';
    return `<div class="coming-soon"><p>${view.seg === 'held' ? 'No holdings yet — open a market and buy.' : 'Nothing here yet.'}</p></div>`;
  }

  /* ---------------------------- Portfolio page --------------------------- */
  // A dedicated page: pick Stocks / Crypto and see what you own. Empty
  // categories show a "Not owned" prompt that links straight to buying.

  function renderPortfolio() {
    container.innerHTML = `
      <button class="back-link" data-act="back">‹ Markets</button>
      <div class="section-head"><h2>Portfolio</h2></div>
      <div class="seg-row">${PF_SEGS.map((s) =>
        `<button class="seg ${view.pfSeg === s.id ? 'seg-active' : ''}" data-act="pfSeg" data-id="${s.id}">${s.label}</button>`).join('')}</div>
      <div id="pfBody">${portfolioBodyHTML()}</div>
    `;
  }

  function portfolioBodyHTML() {
    const owned = ASSET_DEFS.filter((d) => d.group === view.pfSeg && Market.holding(d.id).shares > 0);
    if (!owned.length) return emptyOwnedHTML(view.pfSeg);
    return `<div class="asset-list">${owned.map(pfRowHTML).join('')}</div>`;
  }

  /** "Not owned" state with a call-to-action that jumps to that market. */
  function emptyOwnedHTML(seg) {
    const noun = seg === 'stock' ? 'stocks' : 'crypto';
    const label = seg === 'stock' ? 'Stocks' : 'Crypto';
    return `
      <div class="pf-empty">
        <div class="pf-empty-title">Not owned</div>
        <div class="pf-empty-sub">You don't own any ${noun} yet.</div>
        <button class="btn btn-gold btn-wide" data-act="browse" data-id="${seg}">Buy ${label} ›</button>
      </div>`;
  }

  /** Portfolio row: the VALUE of what you hold, with your profit/loss in money
   *  AND % (relative to what you paid) right beneath it — Trading-212 style. */
  function pfRowHTML(def) {
    const h = Market.holding(def.id);
    const value = h.shares * Market.dispPrice(def.id);
    const pl = value - h.cost;
    const pct = h.cost > 0 ? (pl / h.cost) * 100 : 0;
    return `
      <button class="asset-row" data-act="open" data-id="${def.id}">
        ${Logos.tile(def)}
        <div class="asset-name-wrap">
          <div class="asset-sym">${def.name}</div>
          <div class="asset-name">${fmtShares(h.shares)} ${def.ticker}</div>
        </div>
        <div class="asset-price-wrap">
          <div class="asset-price" data-pfval="${def.id}">${formatMoney(value)}</div>
          <div class="asset-change ${plCls(pl)}" data-pfpl="${def.id}">${plStr(pl, pct)}</div>
        </div>
      </button>`;
  }

  /** Patch the Portfolio's values + P/L in place (no full re-render). */
  function patchPortfolio() {
    container.querySelectorAll('.asset-row').forEach((row) => {
      const id = row.dataset.id;
      if (!id) return;
      const h = Market.holding(id);
      const value = h.shares * Market.dispPrice(id);
      const cost = h.cost;
      const pl = value - cost;
      const pct = cost > 0 ? (pl / cost) * 100 : 0;
      const ve = row.querySelector(`[data-pfval="${id}"]`);
      if (ve) ve.textContent = formatMoney(value);
      const pe = row.querySelector(`[data-pfpl="${id}"]`);
      if (pe) { pe.textContent = plStr(pl, pct); pe.className = `asset-change ${plCls(pl)}`; }
    });
  }

  /** Track which rows are on screen so refresh() only patches those. */
  function observeRows() {
    if (typeof IntersectionObserver === 'undefined') return; // patch-all fallback
    if (visObserver) visObserver.disconnect();
    visibleIds.clear();
    visObserver = new IntersectionObserver((entries) => {
      for (const en of entries) {
        const id = en.target.dataset.id;
        if (en.isIntersecting) visibleIds.add(id);
        else visibleIds.delete(id);
      }
    });
    container.querySelectorAll('.asset-row').forEach((r) => visObserver.observe(r));
  }

  /* ----------------------------- Detail view ----------------------------- */

  function renderDetail() {
    const def = ASSET_BY_ID[view.assetId];
    const s = Market.stats(view.assetId);
    const holdingHTML = investmentPanel(def);
    container.innerHTML = `
      <button class="back-link" data-act="back">‹ ${backLabel()}</button>
      <div class="detail-head">
        ${Logos.tile(def, 'lg')}
        <div><div class="asset-sym big">${def.name}</div>
          <div class="asset-name">${def.ticker} · ${def.group === 'stock' ? def.sector + ' · stock' : def.group}${def.unit ? ' · ' + def.unit : ''}</div></div>
      </div>
      <div class="detail-price-row">
        <div class="detail-price" id="invPrice">${formatMoney(Market.dispPrice(def.id))}</div>
      </div>
      <div class="change-row" id="invChanges">${changesHTML(def)}</div>

      <div class="chart-wrap">
        <div class="chart-box" data-act="fullscreen" id="invChart"></div>
      </div>
      <div class="chip-row tf-row" id="tfRow">${tfChipsHTML()}<button class="chip tf-fs" data-act="fullscreen" aria-label="Full screen chart">⛶</button></div>

      ${highlightsHTML(def, s)}
      ${holdingHTML}
      <div class="card">${statsHTML(def, s)}</div>
      ${ownershipHTML(def, s)}
      <div class="trade-spacer"></div>
      <div class="trade-bar">
        <button class="btn btn-gold trade-btn" data-act="buy">Buy</button>
        <button class="btn trade-btn" data-act="sell">Sell</button>
      </div>
    `;
    initInlineChart();
  }

  function changesHTML(def) {
    const today = Market.dispChangePct(def.id, MARKET.DAY);
    const month = Market.dispChangePct(def.id, 30 * MARKET.DAY);
    return `
      <div class="chg-pill ${plCls(today)}"><span>Today</span> ${sign(today)}${today.toFixed(2)}%</div>
      <div class="chg-pill ${plCls(month)}"><span>1 Month</span> ${sign(month)}${month.toFixed(2)}%</div>`;
  }

  /** Prominent, plain-language highlights: what the whole company is worth (=
   *  what a full buyout costs) and how many units are still up for grabs. */
  function highlightsHTML(def, s) {
    const availLabel = def.group === 'crypto' ? 'Coins to buy' : 'Shares to buy';
    return `
      <div class="detail-highlights">
        <div class="dh-tile"><span>Company value</span><b>${formatMoney(s.marketCap)}</b></div>
        <div class="dh-tile"><span>${availLabel}</span><b>${formatNumber(s.available)}</b></div>
      </div>`;
  }

  function tfChipsHTML() {
    return Market.timeframes.map((tf) =>
      `<button class="chip tf-chip ${view.tf === tf.id ? 'chip-active' : ''}" data-act="tf" data-id="${tf.id}">${tf.label}</button>`).join('');
  }
  function markTf() {
    const row = document.getElementById('tfRow');
    if (row) row.querySelectorAll('.tf-chip').forEach((c) => c.classList.toggle('chip-active', c.dataset.id === view.tf));
  }

  function investmentPanel(def) {
    const h = Market.holding(def.id);
    if (h.shares <= 0) return '';
    const value = h.shares * Market.dispPrice(def.id);
    const pl = value - h.cost;
    const plPct = h.cost > 0 ? (pl / h.cost) * 100 : 0;
    return `
      <div class="card invest-panel" id="invPanel">
        <div class="card-title">Your Investment</div>
        <div class="stat-grid">
          <div class="stat-cell"><span class="muted">Value</span><b>${formatMoney(value)}</b></div>
          <div class="stat-cell"><span class="muted">Profit / Loss</span><b class="${plCls(pl)}">${plStr(pl, plPct)}</b></div>
          <div class="stat-cell"><span class="muted">Shares</span><b>${fmtShares(h.shares)}</b></div>
          <div class="stat-cell"><span class="muted">Avg price</span><b>${formatMoney(h.cost / h.shares)}</b></div>
        </div>
      </div>`;
  }

  // Plain-language stats — useful facts, no P/E / book-value jargon. Volatility
  // becomes an easy Low/Medium/High risk rating.
  const SECTOR_NAMES = {
    tech: 'Technology', semi: 'Semiconductors', bank: 'Banking', fintech: 'Fintech',
    pharma: 'Pharma', energy: 'Energy', consumer: 'Consumer', retail: 'Retail',
    auto: 'Automotive', aerospace: 'Aerospace', industrial: 'Industrial',
    telecom: 'Telecom', media: 'Media', utility: 'Utility', materials: 'Materials',
    luxury: 'Luxury',
  };

  function statsHTML(def, s) {
    const risk = s.volPct < 35 ? 'Low' : s.volPct < 60 ? 'Medium' : 'High';
    const dy = Math.min(8, (s.divYield || 0) * 500);
    const rows = [];
    if (def.group === 'stock') {
      rows.push(['Sector', SECTOR_NAMES[def.sector] || def.sector]);
      rows.push(['Founded', String(s.founded)]);
      rows.push(['Dividend', dy >= 0.05 ? dy.toFixed(1) + '% / yr' : 'None']);
      rows.push(['Total shares', formatNumber(s.supply)]);
      rows.push(['Risk', risk]);
      rows.push(['Ownership', ownPctStr(Market.ownedFrac(def.id) * 100)]);
    } else {
      rows.push(['Type', 'Cryptocurrency']);
      rows.push(['Since', String(s.founded)]);
      rows.push(['Total coins', formatNumber(s.supply)]);
      rows.push(['Risk', risk]);
    }
    return `<div class="card-title">Stats</div><div class="stat-grid">${
      rows.map(([k, v]) => `<div class="stat-cell"><span class="muted">${k}</span><b>${v}</b></div>`).join('')
    }</div>`;
  }

  /* ---------------------- 100% Ownership / Manage ------------------------ */

  // Same four levers for companies and coins — different, friendly wording.
  const MANAGE_LABELS = {
    stock: {
      growth:   ['📈', 'Invest in growth', 'price trends up over time'],
      dividend: ['💵', 'Pay yourself', 'cash now'],
      cutcosts: ['✂️', 'Cut costs', '+10% price for 5 min'],
      expand:   ['🏗️', 'Expand', 'raises company value'],
    },
    crypto: {
      growth:   ['⚙️', 'Upgrade the network', 'price trends up over time'],
      dividend: ['🪙', 'Mint yourself coins', 'cash now'],
      cutcosts: ['🔥', 'Burn supply', '+10% price for 5 min'],
      expand:   ['🌐', 'Major exchange listing', 'raises coin value'],
    },
  };

  function ownershipHTML(def, s) {
    const frac = Market.ownedFrac(def.id);
    if (Market.isOwned(def.id)) return manageHTML(def, s);
    const pct = frac * 100;
    const units = def.group === 'crypto' ? 'coins' : 'shares';
    // Cost to buy the rest to 100%, at the SAME price the Company value uses,
    // so the two numbers reconcile (whole company = value when you own none).
    const restCost = s.remainingCost;
    const income = s.marketCap * MARKET.OWNER_INCOME_RATE;
    return `
      <div class="card buyout-card">
        <div class="buyout-head">
          <div class="buyout-title">Own ${def.name}</div>
          <div class="buyout-badge">${ownPctStr(pct)} owned</div>
        </div>
        <div class="buyout-bar"><div class="buyout-fill" style="width:${Math.min(100, Math.max(pct, pct > 0 ? 1.5 : 0))}%"></div></div>
        <div class="buyout-stats">
          <div><span>Buy the rest</span><b class="gold">${formatMoney(restCost)}</b></div>
          <div><span>Pays you when owned</span><b>${formatMoney(income)} / 5 min</b></div>
        </div>
        <div class="buyout-note">Own <b>100%</b> of the ${units} and ${def.name} is fully yours — it pays income every 5 minutes and you call the shots. Use <b>Buy → MAX</b> to add more.</div>
      </div>`;
  }

  function manageHTML(def, s) {
    const L = MANAGE_LABELS[def.group] || MANAGE_LABELS.stock;
    const m = Market.mgmtState(def.id);
    const now = Date.now();
    const divCd = m.lastDivAt && now - m.lastDivAt < 300000;
    const cutActive = m.boostUntil && now < m.boostUntil;
    const btn = (action, disabled, costText) => {
      const [icon, title, effect] = L[action];
      return `<button class="btn manage-btn" data-act="manage" data-action="${action}" ${disabled ? 'disabled' : ''}>
        ${icon} <b>${title}</b><small>${costText} · ${effect}</small></button>`;
    };
    return `
      <div class="card manage-card">
        <div class="card-title">👑 ${def.name} <span class="owned-badge">100% yours</span></div>
        <div class="card-sub">Pays you ${formatMoney(s.marketCap * MARKET.OWNER_INCOME_RATE)} every 5 min. Make a call:</div>
        <div class="manage-grid">
          ${btn('growth', false, 'Costs ' + formatMoney(s.marketCap * 0.05))}
          ${btn('dividend', divCd, divCd ? 'On cooldown' : 'Get ' + formatMoney(s.marketCap * 0.02))}
          ${btn('cutcosts', cutActive, cutActive ? 'Boost active' : 'Free')}
          ${btn('expand', false, 'Costs ' + formatMoney(s.marketCap * 0.10))}
        </div>
      </div>`;
  }

  function doManage(action) {
    const r = Market.manage(view.assetId, action);
    UI.showToast(`${r.ok ? '👑' : '⚠️'} ${r.msg}`, { tone: r.ok ? 'good' : 'bad' });
    if (r.ok) { UI.renderBalance(); render(); }
  }

  /* ------------------------------- Charts -------------------------------- */

  function initInlineChart() {
    const el = document.getElementById('invChart');
    if (!el) return;
    // Detail pages use the friendly line/area view; candles live fullscreen.
    chart = new CandleChart(el, { mode: 'line' });
    chartAsset = view.assetId; chartTf = view.tf;
    chart.setData(Market.candles(view.assetId, view.tf));
    chartSig = chartSigOf(view.assetId, view.tf);
  }
  function destroyChart() {
    if (chart) { try { chart.destroy(); } catch (e) {} }
    chart = null; chartAsset = null; chartTf = null; chartSig = null;
  }

  function openFullscreen() {
    const def = ASSET_BY_ID[view.assetId];
    lockScroll(true);
    const ov = document.createElement('div');
    ov.className = 'fs-screen';
    ov.innerHTML = `
      <div class="fs-head">
        ${Logos.tile(def)}
        <div class="fs-id"><div class="asset-sym big">${def.name}</div><div class="asset-name">${def.ticker}</div></div>
        <div class="fs-price" id="fsPrice">${formatMoney(Market.dispPrice(def.id))}</div>
        <button class="icon-btn" id="fsClose" aria-label="Close full screen">✕</button>
      </div>
      <div class="fs-chart" id="fsChart"></div>
      <div class="chip-row fs-tf">${Market.timeframes.map((tf) =>
        `<button class="chip tf-chip ${view.tf === tf.id ? 'chip-active' : ''}" data-fstf="${tf.id}">${tf.label}</button>`).join('')}</div>
    `;
    document.body.appendChild(ov);
    const chEl = ov.querySelector('#fsChart');
    const redraw = () => { if (fs) { fs.chart.setData(Market.candles(view.assetId, fs.tf)); fs.sig = chartSigOf(view.assetId, fs.tf); } };
    fs = { chart: new CandleChart(chEl, { mode: 'candles' }), tf: view.tf, priceEl: ov.querySelector('#fsPrice'), el: ov, redraw, sig: chartSigOf(view.assetId, view.tf) };
    // Draw after layout so the flex-filled chart has real dimensions (also
    // covers orientation changes: recompute on resize).
    requestAnimationFrame(redraw);
    window.addEventListener('resize', redraw);
    const close = () => { window.removeEventListener('resize', redraw); ov.remove(); fs = null; lockScroll(false); };
    ov.querySelector('#fsClose').addEventListener('click', close);
    ov.querySelectorAll('[data-fstf]').forEach((b) => b.addEventListener('click', () => {
      fs.tf = b.dataset.fstf; view.tf = fs.tf;
      ov.querySelectorAll('.tf-chip').forEach((c) => c.classList.toggle('chip-active', c.dataset.fstf === fs.tf));
      redraw();
      markTf();
    }));
  }

  /* ------------------------------ Trade ticket --------------------------- */

  function openTicket(side) {
    const def = ASSET_BY_ID[view.assetId];
    const h = Market.holding(def.id);
    if (side === 'sell' && h.shares <= 0) { UI.showToast('⚠️ You have no shares to sell.', { tone: 'bad' }); return; }

    // Canonical input = { mode: 'cash'|'shares', amount } in that unit; the
    // other value is derived live from the current price. `all` records that
    // the player chose MAX/ALL, so a whole-position trade is honoured exactly
    // (not a cash figure that tiny price ticks make fall short → leftover dust).
    const st = { side, mode: 'cash', amount: 0, step: 'enter', all: false };
    const ov = document.createElement('div');
    ov.className = 'trade-screen';
    lockScroll(true);
    document.body.appendChild(ov);

    const px = () => (side === 'buy' ? Market.buyPrice(def.id) : Market.sellPrice(def.id));
    const remainingSupply = () => Math.max(0, Market.supplyOf(def) - h.shares);
    const capShares = () => (side === 'buy' ? Math.min(remainingSupply(), state.balance / px()) : h.shares);
    const capCash = () => (side === 'buy' ? Math.min(state.balance, remainingSupply() * px()) : h.shares * px());
    const capForMode = () => (st.mode === 'cash' ? capCash() : capShares());

    function derive() {
      const p = px();
      let shares, cash;
      if (st.mode === 'cash') {
        cash = Math.max(0, Math.min(st.amount, capCash()));
        shares = p > 0 ? cash / p : 0;
      } else {
        shares = Math.max(0, Math.min(st.amount, capShares()));
        cash = shares * p;
      }
      return { p, shares, cash };
    }
    function amtStr() {
      const v = st.amount;
      if (!isFinite(v) || v <= 0) return '';
      const r = st.mode === 'cash' ? Math.round(v * 100) / 100 : Math.round(v * 10000) / 10000;
      return String(r);
    }
    function altStr(d) {
      return st.mode === 'cash' ? `≈ ${fmtShares(d.shares)} ${def.ticker}` : `≈ ${formatMoney(d.cash)}`;
    }

    function close() { ov.remove(); trade = null; lockScroll(false); }

    function drawEnter() {
      const d = derive();
      const frac = capForMode() > 0 ? Math.min(1, st.amount / capForMode()) : 0;
      const after = side === 'buy' ? state.balance - d.cash : state.balance + d.cash;
      ov.innerHTML = `
        <div class="trade-head">
          ${Logos.tile(def, 'sm')}
          <div class="trade-id"><div class="asset-sym">${side === 'buy' ? 'Buy' : 'Sell'} ${def.name}</div>
            <div class="asset-name">${def.ticker}</div></div>
          <button class="icon-btn" id="tkClose" aria-label="Close">✕</button>
        </div>
        <div class="trade-live"><span class="muted">${side === 'buy' ? 'Ask' : 'Bid'}</span> <b id="tkPx">${formatMoney(d.p)}</b></div>

        <div class="trade-amount-card">
          <div class="amount-mode-label">Enter amount as</div>
          <div class="amount-toggle">
            <button class="amt-mode ${st.mode === 'cash' ? 'on' : ''}" data-mode="cash">Cash ($)</button>
            <button class="amt-mode ${st.mode === 'shares' ? 'on' : ''}" data-mode="shares">Shares</button>
          </div>
          <div class="amount-input-wrap">
            ${st.mode === 'cash' ? '<span class="amt-prefix">$</span>' : ''}
            <input id="tkAmt" class="amount-input" inputmode="decimal" type="text" value="${amtStr()}" placeholder="0" aria-label="Amount">
            ${st.mode === 'shares' ? `<span class="amt-suffix">${def.ticker}</span>` : ''}
          </div>
          <div class="amount-tip">Tap the number to type an exact ${st.mode === 'cash' ? 'cash amount' : 'number of shares'}</div>
          <div class="amount-alt" id="tkAlt">${altStr(d)}</div>
        </div>

        <input type="range" min="0" max="100" value="${Math.round(frac * 100)}" class="slider" id="tkSlider">
        <div class="chip-row ticket-quick">${[10, 25, 50, 100].map((q) =>
          `<button class="chip" data-q="${q}">${q === 100 ? (side === 'buy' ? 'MAX' : 'ALL') : q + '%'}</button>`).join('')}</div>

        <div class="trade-summary">
          <div class="mult-row"><span>${side === 'buy' ? 'Spend' : 'Receive'}</span><b id="tkCash">${formatMoney(d.cash)}</b></div>
          <div class="mult-row"><span>Shares</span><b id="tkShares">${fmtShares(d.shares)}</b></div>
          <div class="mult-row"><span>Price (${side === 'buy' ? 'ask' : 'bid'})</span><b id="tkSumPx">${formatMoney(d.p)}</b></div>
          <div class="mult-row"><span>Cash after</span><b id="tkAfter">${formatMoney(after)}</b></div>
        </div>
        <div class="trade-cta">
          <button class="btn btn-gold btn-wide" id="tkReview" ${d.cash < 0.01 ? 'disabled' : ''}>Review order</button>
        </div>`;
      wireEnter();
    }

    function patchSummary() {
      if (ov.isConnected === false || st.step !== 'enter') return;
      const d = derive();
      const after = side === 'buy' ? state.balance - d.cash : state.balance + d.cash;
      const set = (id, txt) => { const el = ov.querySelector(id); if (el) el.textContent = txt; };
      set('#tkCash', formatMoney(d.cash));
      set('#tkShares', fmtShares(d.shares));
      set('#tkSumPx', formatMoney(d.p));
      set('#tkPx', formatMoney(d.p));
      set('#tkAfter', formatMoney(after));
      set('#tkAlt', altStr(d));
      const capM = capForMode();
      const sl = ov.querySelector('#tkSlider');
      if (sl) sl.value = Math.round((capM > 0 ? Math.min(1, st.amount / capM) : 0) * 100);
      const rv = ov.querySelector('#tkReview');
      if (rv) rv.disabled = d.cash < 0.01;
    }

    function setFraction(f) {
      st.all = f >= 0.999999; // MAX / ALL / slider pinned to the top
      st.amount = f * capForMode();
      const inp = ov.querySelector('#tkAmt');
      if (inp) inp.value = amtStr();
      patchSummary();
    }

    function wireEnter() {
      ov.querySelector('#tkClose').onclick = close;
      ov.querySelector('#tkAmt').oninput = (e) => {
        st.all = false; // a typed amount is a specific amount, not "everything"
        st.amount = parseFloat(String(e.target.value).replace(/[^0-9.]/g, '')) || 0;
        patchSummary();
      };
      ov.querySelectorAll('[data-mode]').forEach((b) => b.onclick = () => {
        if (b.dataset.mode === st.mode) return;
        const d = derive();
        st.amount = b.dataset.mode === 'cash' ? d.cash : d.shares; // keep value across units
        st.mode = b.dataset.mode;
        drawEnter();
      });
      ov.querySelector('#tkSlider').oninput = (e) => setFraction(e.target.value / 100);
      ov.querySelectorAll('[data-q]').forEach((b) => b.onclick = () => setFraction(b.dataset.q / 100));
      ov.querySelector('#tkReview').onclick = () => { const d = derive(); if (d.cash >= 0.01) { st.step = 'review'; drawReview(); } };
    }

    function drawReview() {
      const d = derive();
      const after = side === 'buy'
        ? { cash: state.balance - d.cash, shares: h.shares + d.shares }
        : { cash: state.balance + d.cash, shares: h.shares - d.shares };
      ov.innerHTML = `
        <div class="trade-head">
          <button class="icon-btn" id="tkBack" aria-label="Back">‹</button>
          <div class="trade-id"><div class="asset-sym">Review order</div>
            <div class="asset-name">${side === 'buy' ? 'Buy' : 'Sell'} ${def.ticker}</div></div>
          <button class="icon-btn" id="tkClose2" aria-label="Close">✕</button>
        </div>
        <div class="review-list">
          <div class="mult-row"><span>Action</span><b class="${side === 'buy' ? 'gold' : ''}">${side === 'buy' ? 'BUY' : 'SELL'} ${def.ticker}</b></div>
          <div class="mult-row"><span>Shares</span><b>${fmtShares(d.shares)}</b></div>
          <div class="mult-row"><span>Price (${side === 'buy' ? 'ask' : 'bid'})</span><b>${formatMoney(d.p)}</b></div>
          <div class="mult-row mult-total"><span>${side === 'buy' ? 'Total cost' : 'Total proceeds'}</span><b class="gold">${formatMoney(d.cash)}</b></div>
          <div class="mult-row"><span>Cash after</span><b>${formatMoney(after.cash)}</b></div>
          <div class="mult-row"><span>Shares after</span><b>${fmtShares(after.shares)}</b></div>
        </div>
        <div class="trade-cta">
          <button class="btn btn-gold btn-wide" id="tkConfirm">Confirm ${side === 'buy' ? 'Buy' : 'Sell'}</button>
          <button class="btn btn-wide" id="tkCancel">Back</button>
        </div>`;
      ov.querySelector('#tkBack').onclick = () => { st.step = 'enter'; drawEnter(); };
      ov.querySelector('#tkClose2').onclick = close;
      ov.querySelector('#tkCancel').onclick = () => { st.step = 'enter'; drawEnter(); };
      ov.querySelector('#tkConfirm').onclick = () => {
        const c = derive();
        let ok;
        if (side === 'buy') {
          // MAX spends all available cash; shares mode buys the EXACT count;
          // cash mode spends the exact cash typed.
          if (st.all) ok = Market.buy(def.id, state.balance);
          else if (st.mode === 'shares') ok = Market.buyShares(def.id, c.shares);
          else ok = Market.buy(def.id, c.cash);
        } else {
          // ALL sells the ENTIRE position (no leftover); otherwise the exact
          // amount. A whole-position sell also snaps to a clean full exit.
          ok = Market.sellShares(def.id, st.all ? h.shares : c.shares);
        }
        close();
        if (ok) {
          UI.renderBalance();
          UI.showToast(`${side === 'buy' ? '🟢 Bought' : '🔴 Sold'} ${fmtShares(c.shares)} ${def.ticker}`, { tone: 'good' });
          render();
        }
      };
    }

    // Start at 25% and keep the live price / summary ticking while open.
    st.amount = 0.25 * capCash();
    trade = { refresh: patchSummary };
    drawEnter();
  }

  /* ------------------------------- Refresh ------------------------------- */

  function refresh() {
    if (!container) return;

    // Portfolio page: patch owned rows' value + P/L in place each tick (the
    // numbers only actually change on each asset's own staggered ~15s phase).
    if (view.mode === 'portfolio') { patchPortfolio(); return; }

    if (view.mode === 'list') {
      patchPortfolioCard(); // keep the Portfolio summary value + P/L live
      // Patch prices in place — and ONLY for rows currently on screen. Each
      // uses its own staggered display price, so they update at different times.
      container.querySelectorAll('.asset-row').forEach((row) => {
        const id = row.dataset.id;
        if (visObserver && !visibleIds.has(id)) return;
        const pe = row.querySelector(`[data-price="${id}"]`);
        if (pe) pe.textContent = formatMoney(Market.dispPrice(id));
        const ce = row.querySelector(`[data-change="${id}"]`);
        if (ce) {
          const ch = Market.dispChangePct(id);
          ce.textContent = changeText(ch);
          ce.className = `asset-change ${plCls(ch)}`;
        }
      });
      return;
    }

    // Detail: patch price, changes, position; push newest candle.
    const def = ASSET_BY_ID[view.assetId];
    const pe = document.getElementById('invPrice');
    if (pe) pe.textContent = formatMoney(Market.dispPrice(def.id));
    const chg = document.getElementById('invChanges');
    if (chg) chg.innerHTML = changesHTML(def);
    const panel = document.getElementById('invPanel');
    if (panel && Market.holding(def.id).shares > 0) {
      const tmp = document.createElement('div');
      tmp.innerHTML = investmentPanel(def);
      panel.innerHTML = tmp.firstElementChild.innerHTML;
    }
    // Redraw when a new bar forms for the timeframe OR when the quote ticks, so
    // the chart advances at the right cadence AND its live price stays exactly
    // in step with the header number — never one, never the other stale.
    if (chart && chartAsset === view.assetId) {
      const sig = chartSigOf(def.id, view.tf);
      if (sig !== chartSig || chartTf !== view.tf) {
        chart.setData(Market.candles(def.id, view.tf));
        chartTf = view.tf; chartSig = sig;
      }
    }
    // Fullscreen chart, if open (same signature gate).
    if (fs) {
      if (fs.priceEl) fs.priceEl.textContent = formatMoney(Market.dispPrice(def.id));
      const sig = chartSigOf(def.id, fs.tf);
      if (sig !== fs.sig) { fs.chart.setData(Market.candles(def.id, fs.tf)); fs.sig = sig; }
    }
    // Full-screen trade page: keep its live price + summary current.
    if (trade) trade.refresh();
  }

  return { mount, refresh };
})();
