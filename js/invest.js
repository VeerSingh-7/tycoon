/* =========================================================================
 * invest.js — Phase 4 (overhauled) UI: our own pro mobile trading screen
 * -------------------------------------------------------------------------
 * Dark + gold identity, rounded cards, our own candlestick canvas. Screens:
 *   list       — search bar → filter chips (All / Stocks / Crypto /
 *                Commodities / Property / Savings & Bonds / ★ Watchlist /
 *                Holdings) → sort control (Top Movers / A–Z / Price) →
 *                clean sections with collapsible headers (stocks by sector,
 *                commodities by sub-group)
 *   detail     — ticker/name header + watch star, big price + today & month
 *                %, inline chart (tap → fullscreen), Your Investment, Stats,
 *                Buyout / Manage, pinned Buy / Sell bar
 *   fullscreen — big chart + 1D/1W/1M/3M/1Y/Max timeframe row
 *   ticket     — Buy/Sell amount (slider + quick %), then Review order
 *
 * Performance: rows are patched in place each second, and ONLY rows that are
 * actually on screen (IntersectionObserver) — 170 assets cost nothing while
 * scrolled away or collapsed. Only the open asset runs the full chart.
 * ========================================================================= */

const Invest = (() => {
  const view = {
    mode: 'list', seg: 'stock', q: '',
    assetId: null, tf: MARKET.DEFAULT_TF,
  };
  let container = null;
  let chart = null, chartAsset = null, chartTf = null;       // inline chart
  let fs = null;                                             // fullscreen {chart, tf}
  let bodyTimer = 0;                                         // search debounce
  let visObserver = null;                                    // on-screen rows
  const visibleIds = new Set();

  const plCls = (v) => (v >= 0 ? 'up' : 'down');
  const sign = (v) => (v >= 0 ? '+' : '');

  /* --------------------------- Segments ----------------------------- */
  // One simple toggle: Stocks | Crypto | Holdings. That's the whole nav.

  const SEGS = [
    { id: 'stock',  label: '📈 Stocks' },
    { id: 'crypto', label: '🪙 Crypto' },
    { id: 'held',   label: '💼 Holdings' },
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

    if (a === 'open') { view.mode = 'detail'; view.assetId = id; view.tf = MARKET.DEFAULT_TF; destroyChart(); render(); }
    else if (a === 'back') { view.mode = 'list'; destroyChart(); render(); }
    else if (a === 'seg') { view.seg = id; render(); }
    else if (a === 'tf') { view.tf = id; if (chart) { chart.setData(Market.candles(view.assetId, view.tf)); chartTf = view.tf; } markTf(); }
    else if (a === 'fullscreen') openFullscreen();
    else if (a === 'buy') openTicket('buy');
    else if (a === 'sell') openTicket('sell');
    else if (a === 'manage') doManage(t.dataset.action);
  }

  function render() {
    if (!container) return;
    if (view.mode === 'detail') renderDetail();
    else renderList();
  }

  /* ------------------------------ List view ------------------------------ */

  function fmtShares(s) {
    if (s >= 1000) return formatNumber(s);
    return (Math.round(s * 10000) / 10000).toString();
  }

  function renderList() {
    const sum = Market.portfolioSummary();
    container.innerHTML = `
      <div class="section-head"><h2>Markets</h2><div class="section-stat">${formatMoney(state.balance)} cash</div></div>
      <div class="card pf-card" data-act="seg" data-id="held" role="button">
        <div class="card-row">
          <div><div class="card-title">💼 Portfolio</div><div class="card-sub">Cost basis ${formatMoney(sum.cost)}</div></div>
          <div class="pf-numbers">
            <div class="pf-value">${formatMoney(sum.value)}</div>
            <div class="pf-pl ${plCls(sum.pl)}">${sign(sum.pl)}${formatMoney(sum.pl)} (${sign(sum.plPct)}${sum.plPct.toFixed(1)}%)</div>
          </div>
        </div>
      </div>
      <div class="search-wrap">
        <span class="search-ico">🔍</span>
        <input id="mktSearch" class="search-input" type="search" placeholder="Search any asset…"
          value="${view.q.replace(/"/g, '&quot;')}" autocomplete="off" autocorrect="off" spellcheck="false">
      </div>
      <div class="seg-row">${SEGS.map((s) =>
        `<button class="seg ${view.seg === s.id ? 'seg-active' : ''}" data-act="seg" data-id="${s.id}">${s.label}</button>`).join('')}</div>
      <div id="mktBody"></div>
    `;
    const inp = container.querySelector('#mktSearch');
    inp.addEventListener('input', () => {
      view.q = inp.value;
      clearTimeout(bodyTimer);
      bodyTimer = setTimeout(renderBody, 140); // debounce; input keeps focus
    });
    renderBody();
  }

  /**
   * Rebuild only the list body (keeps the search input focused).
   * Searching looks across EVERYTHING so any asset is findable instantly;
   * otherwise it's a plain, clean list of the selected segment.
   */
  function renderBody() {
    const el = document.getElementById('mktBody');
    if (!el) return;
    const q = view.q.trim().toLowerCase();
    const pool = q
      ? ASSET_DEFS.filter((d) => d.name.toLowerCase().includes(q) || d.ticker.toLowerCase().includes(q))
      : ASSET_DEFS.filter(matchSeg);
    el.innerHTML = pool.map((d) => rowHTML(d, Market.price(d.id), Market.changePct(d.id))).join('') || emptyHTML();
    observeRows();
  }

  function rowHTML(def, p, ch) {
    const h = Market.holding(def.id);
    return `
      <button class="card asset-row" data-act="open" data-id="${def.id}">
        ${Logos.tile(def)}
        <div class="asset-name-wrap">
          <div class="asset-sym">${def.name}${h.shares > 0 ? ' <span class="hold-dot">●</span>' : ''}</div>
          <div class="asset-name">${def.ticker} · ${def.group === 'stock' ? def.sector : def.group}${h.shares > 0 ? ` · ${fmtShares(h.shares)}` : ''}</div>
        </div>
        <div class="asset-price-wrap">
          <div class="asset-price" data-price="${def.id}">${formatMoney(p)}</div>
          <div class="asset-change ${plCls(ch)}" data-change="${def.id}">${sign(ch)}${ch.toFixed(2)}%</div>
        </div>
      </button>`;
  }

  function emptyHTML() {
    if (view.q.trim()) return '<div class="coming-soon"><p>Nothing matches your search.</p></div>';
    return `<div class="coming-soon"><p>${view.seg === 'held' ? 'No holdings yet — open a market and buy.' : 'Nothing here yet.'}</p></div>`;
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
      <button class="back-link" data-act="back">‹ Markets</button>
      <div class="detail-head">
        ${Logos.tile(def, 'lg')}
        <div><div class="asset-sym big">${def.name}</div>
          <div class="asset-name">${def.ticker} · ${def.group === 'stock' ? def.sector + ' · stock' : def.group}${def.unit ? ' · ' + def.unit : ''}</div></div>
      </div>
      <div class="detail-price-row">
        <div class="detail-price" id="invPrice">${formatMoney(Market.price(def.id))}</div>
      </div>
      <div class="change-row" id="invChanges">${changesHTML(def)}</div>

      <div class="chart-wrap">
        <div class="chart-box" data-act="fullscreen" id="invChart"></div>
        <button class="fs-btn" data-act="fullscreen" aria-label="Fullscreen candlestick chart">⛶</button>
      </div>
      <div class="chip-row tf-row" id="tfRow">${tfChipsHTML()}</div>

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
    const today = Market.changePct(def.id, MARKET.DAY);
    const month = Market.changePct(def.id, 30 * MARKET.DAY);
    return `
      <div class="chg-pill ${plCls(today)}"><span>Today</span> ${sign(today)}${today.toFixed(2)}%</div>
      <div class="chg-pill ${plCls(month)}"><span>1 Month</span> ${sign(month)}${month.toFixed(2)}%</div>`;
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
    const px = Market.price(def.id);
    const value = h.shares * px;
    const pl = value - h.cost;
    const plPct = (pl / h.cost) * 100;
    return `
      <div class="card invest-panel" id="invPanel">
        <div class="card-title">Your Investment</div>
        <div class="stat-grid">
          <div class="stat-cell"><span class="muted">Value</span><b>${formatMoney(value)}</b></div>
          <div class="stat-cell"><span class="muted">Return</span><b class="${plCls(pl)}">${sign(pl)}${formatMoney(pl)} (${sign(plPct)}${plPct.toFixed(1)}%)</b></div>
          <div class="stat-cell"><span class="muted">Shares</span><b>${fmtShares(h.shares)}</b></div>
          <div class="stat-cell"><span class="muted">Avg price</span><b>${formatMoney(h.cost / h.shares)}</b></div>
        </div>
      </div>`;
  }

  function statsHTML(def, s) {
    const rows = [];
    rows.push(['Volatility', Math.min(99, s.volPct).toFixed(0) + '%']);
    rows.push(['Market cap', formatMoney(s.marketCap)]);
    if (def.group === 'stock') {
      rows.push(['Company value', formatMoney(s.companyValue)]);
      rows.push(['Avg volume', formatNumber(s.avgVolume) + ' /day']);
      rows.push(['P/E ratio', s.pe.toFixed(1)]);
      rows.push(['Dividend yield', (Math.min(8, s.divYield * 500)).toFixed(2) + '%']);
      rows.push(['Shares available', formatNumber(s.available)]);
    } else {
      rows.push(['Coin supply', formatNumber(s.supply)]);
      rows.push(['Coins available', formatNumber(s.available)]);
      rows.push(['Around since', s.founded]);
    }
    rows.push(['Cost to buy out', formatMoney(s.costToBuyOut)]);
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
    const thing = def.group === 'crypto' ? 'coin' : 'company';
    const units = def.group === 'crypto' ? 'coins' : 'shares';
    const restCost = s.available * Market.buyPrice(def.id);
    return `
      <div class="card buyout-card">
        <div class="card-title">${def.group === 'crypto' ? '🪙' : '🏛️'} Own ${def.name}</div>
        <div class="card-sub">Buy ${units} until you own <b>100%</b> — then it's fully yours:
          it pays you income every 5 minutes and you make the big decisions.</div>
        <div class="mult-row"><span>You own</span><b>${pct.toFixed(2)}%</b></div>
        <div class="mult-row"><span>Buy the rest (use Buy → MAX)</span><b class="gold">${formatMoney(restCost)}</b></div>
        <div class="progress"><div class="progress-fill" style="width:${Math.min(100, pct)}%"></div></div>
        <div class="progress-caption">${pct.toFixed(1)}% / 100% owned · pays ${formatMoney(s.marketCap * MARKET.OWNER_INCOME_RATE)} per 5 min once yours</div>
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
  }
  function destroyChart() {
    if (chart) { try { chart.destroy(); } catch (e) {} }
    chart = null; chartAsset = null; chartTf = null;
  }

  function openFullscreen() {
    const def = ASSET_BY_ID[view.assetId];
    const ov = document.createElement('div');
    ov.className = 'overlay fs-overlay';
    ov.innerHTML = `
      <div class="fs-head">
        ${Logos.tile(def)}
        <div><div class="asset-sym big">${def.name}</div><div class="asset-name">${def.ticker}</div></div>
        <div class="fs-price" id="fsPrice">${formatMoney(Market.price(def.id))}</div>
        <button class="btn btn-sm" id="fsClose">✕</button>
      </div>
      <div class="fs-chart" id="fsChart"></div>
      <div class="chip-row fs-tf">${Market.timeframes.map((tf) =>
        `<button class="chip tf-chip ${view.tf === tf.id ? 'chip-active' : ''}" data-fstf="${tf.id}">${tf.label}</button>`).join('')}</div>
    `;
    document.body.appendChild(ov);
    const chEl = ov.querySelector('#fsChart');
    fs = { chart: new CandleChart(chEl, { mode: 'candles' }), tf: view.tf, priceEl: ov.querySelector('#fsPrice') };
    fs.chart.setData(Market.candles(view.assetId, fs.tf));
    ov.querySelector('#fsClose').addEventListener('click', () => { ov.remove(); fs = null; });
    ov.querySelectorAll('[data-fstf]').forEach((b) => b.addEventListener('click', () => {
      fs.tf = b.dataset.fstf; view.tf = fs.tf;
      ov.querySelectorAll('.tf-chip').forEach((c) => c.classList.toggle('chip-active', c.dataset.fstf === fs.tf));
      fs.chart.setData(Market.candles(view.assetId, fs.tf));
      markTf();
    }));
  }

  /* ------------------------------ Trade ticket --------------------------- */

  function openTicket(side) {
    const def = ASSET_BY_ID[view.assetId];
    const h = Market.holding(def.id);
    if (side === 'sell' && h.shares <= 0) { UI.showToast('⚠️ You have no shares to sell.', { tone: 'bad' }); return; }

    const st = { side, pct: 0.25, step: 'enter' };
    const ov = document.createElement('div');
    ov.className = 'overlay';
    document.body.appendChild(ov);

    function calc() {
      const px = side === 'buy' ? Market.buyPrice(def.id) : Market.sellPrice(def.id);
      if (side === 'buy') {
        const cash = state.balance * st.pct;
        return { px, cash, shares: cash / px };
      }
      const shares = h.shares * st.pct;
      return { px, cash: shares * px, shares };
    }

    function drawEnter() {
      const c = calc();
      const quick = [10, 25, 50, 100];
      ov.innerHTML = `
        <div class="modal ticket">
          <div class="ticket-head"><span class="ticket-title ${side === 'buy' ? 'gold' : ''}">${Logos.tile(def, 'sm')} ${side === 'buy' ? 'Buy' : 'Sell'} ${def.name}</span>
            <button class="btn btn-sm" id="tkClose">✕</button></div>
          <div class="ticket-price">${formatMoney(c.px)} <span class="muted">${side === 'buy' ? 'ask' : 'bid'}</span></div>
          <input type="range" min="0" max="100" value="${Math.round(st.pct * 100)}" class="slider" id="tkSlider">
          <div class="chip-row ticket-quick">${quick.map((q) =>
            `<button class="chip" data-q="${q}">${q === 100 ? (side === 'buy' ? 'MAX' : 'ALL') : q + '%'}</button>`).join('')}</div>
          <div class="ticket-readout">
            <div><span class="muted">${side === 'buy' ? 'Spend' : 'Receive'}</span><b>${formatMoney(c.cash)}</b></div>
            <div><span class="muted">Shares</span><b>${fmtShares(c.shares)}</b></div>
          </div>
          <button class="btn btn-gold btn-wide" id="tkReview" ${c.cash < 0.01 ? 'disabled' : ''}>Review order</button>
        </div>`;
      ov.querySelector('#tkClose').onclick = () => ov.remove();
      ov.querySelector('#tkSlider').oninput = (e) => { st.pct = e.target.value / 100; drawEnter(); };
      ov.querySelectorAll('[data-q]').forEach((b) => b.onclick = () => { st.pct = b.dataset.q / 100; drawEnter(); });
      ov.querySelector('#tkReview').onclick = () => { st.step = 'review'; drawReview(); };
    }

    function drawReview() {
      const c = calc();
      const after = side === 'buy'
        ? { cash: state.balance - c.cash, shares: h.shares + c.shares }
        : { cash: state.balance + c.cash, shares: h.shares - c.shares };
      ov.innerHTML = `
        <div class="modal ticket">
          <div class="ticket-head"><span>Review order</span><button class="btn btn-sm" id="tkBack">‹</button></div>
          <div class="review-list">
            <div class="mult-row"><span>Action</span><b class="${side === 'buy' ? 'gold' : ''}">${side === 'buy' ? 'BUY' : 'SELL'} ${def.ticker}</b></div>
            <div class="mult-row"><span>Shares</span><b>${fmtShares(c.shares)}</b></div>
            <div class="mult-row"><span>Price (${side === 'buy' ? 'ask' : 'bid'})</span><b>${formatMoney(c.px)}</b></div>
            <div class="mult-row mult-total"><span>${side === 'buy' ? 'Total cost' : 'Total proceeds'}</span><b class="gold">${formatMoney(c.cash)}</b></div>
            <div class="mult-row"><span>Cash after</span><b>${formatMoney(after.cash)}</b></div>
            <div class="mult-row"><span>Shares after</span><b>${fmtShares(after.shares)}</b></div>
          </div>
          <button class="btn btn-gold btn-wide" id="tkConfirm">Confirm ${side === 'buy' ? 'Buy' : 'Sell'}</button>
          <button class="btn btn-wide" id="tkCancel">Cancel</button>
        </div>`;
      ov.querySelector('#tkBack').onclick = () => { st.step = 'enter'; drawEnter(); };
      ov.querySelector('#tkCancel').onclick = () => ov.remove();
      ov.querySelector('#tkConfirm').onclick = () => {
        const ok = side === 'buy' ? Market.buy(def.id, c.cash) : Market.sell(def.id, st.pct);
        ov.remove();
        if (ok) {
          UI.renderBalance();
          UI.showToast(`${side === 'buy' ? '🟢 Bought' : '🔴 Sold'} ${fmtShares(c.shares)} ${def.ticker}`, { tone: 'good' });
          render();
        }
      };
    }

    drawEnter();
  }

  /* ------------------------------- Refresh ------------------------------- */

  function refresh() {
    if (!container) return;

    if (view.mode === 'list') {
      // Patch prices in place — and ONLY for rows currently on screen.
      container.querySelectorAll('.asset-row').forEach((row) => {
        const id = row.dataset.id;
        if (visObserver && !visibleIds.has(id)) return;
        const pe = row.querySelector(`[data-price="${id}"]`);
        if (pe) pe.textContent = formatMoney(Market.price(id));
        const ce = row.querySelector(`[data-change="${id}"]`);
        if (ce) {
          const ch = Market.changePct(id);
          ce.textContent = `${sign(ch)}${ch.toFixed(2)}%`;
          ce.className = `asset-change ${plCls(ch)}`;
        }
      });
      return;
    }

    // Detail: patch price, changes, position; push newest candle.
    const def = ASSET_BY_ID[view.assetId];
    const pe = document.getElementById('invPrice');
    if (pe) pe.textContent = formatMoney(Market.price(def.id));
    const chg = document.getElementById('invChanges');
    if (chg) chg.innerHTML = changesHTML(def);
    const panel = document.getElementById('invPanel');
    if (panel && Market.holding(def.id).shares > 0) {
      const tmp = document.createElement('div');
      tmp.innerHTML = investmentPanel(def);
      panel.innerHTML = tmp.firstElementChild.innerHTML;
    }
    if (chart && chartAsset === view.assetId) {
      if (chartTf !== view.tf) { chart.setData(Market.candles(def.id, view.tf)); chartTf = view.tf; }
      else { const list = Market.candles(def.id, view.tf); if (list.length) chart.update(list[list.length - 1]); }
    }
    // Fullscreen chart, if open.
    if (fs) {
      if (fs.priceEl) fs.priceEl.textContent = formatMoney(Market.price(def.id));
      const list = Market.candles(def.id, fs.tf);
      if (list.length) fs.chart.update(list[list.length - 1]);
    }
  }

  return { mount, refresh };
})();
