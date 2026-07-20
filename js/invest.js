/* =========================================================================
 * invest.js — Phase 4 (overhauled) UI: our own pro mobile trading screen
 * -------------------------------------------------------------------------
 * Dark + gold identity, rounded cards, our own candlestick canvas. Screens:
 *   list       — markets grouped by category, filter chips, tap a row
 *   detail     — ticker/name header, big price + today & month %, inline
 *                chart (tap → fullscreen), Your Investment, Stats, Buyout /
 *                Manage, and a pinned Buy / Sell bar
 *   fullscreen — big chart + 1D/1W/1M/3M/1Y/Max timeframe row
 *   ticket     — Buy/Sell amount (slider + quick %), then Review order
 *
 * Performance: the list patches numbers in place (no rebuild); only the OPEN
 * asset runs the full candle chart. Prices are procedural (js/market.js).
 * ========================================================================= */

const Invest = (() => {
  const view = { mode: 'list', filter: 'all', assetId: null, tf: MARKET.DEFAULT_TF };
  let container = null;
  let chart = null, chartAsset = null, chartTf = null;       // inline chart
  let fs = null;                                             // fullscreen {chart, tf}

  const plCls = (v) => (v >= 0 ? 'up' : 'down');
  const sign = (v) => (v >= 0 ? '+' : '');

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
    else if (a === 'filter') { view.filter = id; render(); }
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
    const chips = [{ id: 'all', label: 'All', icon: '🌐' }]
      .concat(Market.groups)
      .concat([{ id: 'held', label: 'Holdings', icon: '💼' }])
      .map((g) => `<button class="chip ${view.filter === g.id ? 'chip-active' : ''}" data-act="filter" data-id="${g.id}">${g.icon} ${g.label}</button>`)
      .join('');

    // Which groups to show (grouped headers only in 'all').
    let body = '';
    if (view.filter === 'held') {
      const held = ASSET_DEFS.filter((d) => Market.holding(d.id).shares > 0);
      body = held.length ? held.map(rowHTML).join('') : emptyHTML('No holdings yet — open a market and buy.');
    } else if (view.filter === 'all') {
      for (const g of Market.groups) {
        const items = ASSET_DEFS.filter((d) => d.group === g.id);
        if (!items.length) continue;
        body += `<div class="mkt-group-head">${g.icon} ${g.label} <span class="muted">${items.length}</span></div>`;
        body += items.map(rowHTML).join('');
      }
    } else {
      body = ASSET_DEFS.filter((d) => d.group === view.filter).map(rowHTML).join('');
    }

    container.innerHTML = `
      <div class="section-head"><h2>Markets</h2><div class="section-stat">${formatMoney(state.balance)} cash</div></div>
      <div class="card pf-card" data-act="filter" data-id="held" role="button">
        <div class="card-row">
          <div><div class="card-title">💼 Portfolio</div><div class="card-sub">Cost basis ${formatMoney(sum.cost)}</div></div>
          <div class="pf-numbers">
            <div class="pf-value">${formatMoney(sum.value)}</div>
            <div class="pf-pl ${plCls(sum.pl)}">${sign(sum.pl)}${formatMoney(sum.pl)} (${sign(sum.plPct)}${sum.plPct.toFixed(1)}%)</div>
          </div>
        </div>
      </div>
      <div class="chip-row invest-filters">${chips}</div>
      <div class="asset-list">${body}</div>
    `;
  }

  function rowHTML(def) {
    const p = Market.price(def.id);
    const ch = Market.changePct(def.id);
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

  function emptyHTML(msg) { return `<div class="coming-soon"><p>${msg}</p></div>`; }

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

      <div class="chart-box" data-act="fullscreen" id="invChart"></div>
      <div class="chip-row tf-row" id="tfRow">${tfChipsHTML()}</div>

      ${holdingHTML}
      <div class="card">${statsHTML(def, s)}</div>
      ${buyoutHTML(def, s)}
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
    if (def.group === 'stock') {
      rows.push(['Market cap', formatMoney(s.marketCap)]);
      rows.push(['Company value', formatMoney(s.companyValue)]);
      rows.push(['Avg volume', formatNumber(s.avgVolume) + ' /day']);
      rows.push(['P/E ratio', s.pe.toFixed(1)]);
      rows.push(['Dividend yield', (Math.min(8, s.divYield * 500)).toFixed(2) + '%']);
      rows.push(['Shares available', formatNumber(s.sharesAvailable)]);
      rows.push(['Cost to buy out', formatMoney(s.costToBuyOut)]);
    } else {
      if (def.unit) rows.push(['Priced', def.unit]);
      if (s.divYield) rows.push(['Yield', (Math.min(8, s.divYield * 500)).toFixed(2) + '%']);
      if (def.issuer) rows.push(['Issuer', def.issuer]);
      rows.push(['Category', (Market.groups.find((g) => g.id === def.group) || {}).label || def.group]);
    }
    return `<div class="card-title">Stats</div><div class="stat-grid">${
      rows.map(([k, v]) => `<div class="stat-cell"><span class="muted">${k}</span><b>${v}</b></div>`).join('')
    }</div>`;
  }

  /* ------------------------- Buyout / Manage ----------------------------- */

  function buyoutHTML(def, s) {
    if (def.group !== 'stock') return '';
    const frac = Market.controlFrac(def.id);
    if (frac >= 0.5) return manageHTML(def, s, frac);
    const pct = (frac * 100);
    return `
      <div class="card buyout-card">
        <div class="card-title">🏛️ Take over ${def.name}</div>
        <div class="card-sub">Own <b>50%</b> of shares to control the company and unlock strategic decisions.</div>
        <div class="mult-row"><span>You own</span><b>${pct.toFixed(2)}% of shares</b></div>
        <div class="mult-row"><span>Cost to buy the whole company</span><b class="gold">${formatMoney(s.costToBuyOut)}</b></div>
        <div class="progress"><div class="progress-fill" style="width:${Math.min(100, pct * 2)}%"></div></div>
        <div class="progress-caption">${pct >= 50 ? 'Controlled!' : `${pct.toFixed(1)}% / 50% to control`}</div>
      </div>`;
  }

  function manageHTML(def, s, frac) {
    const m = Market.mgmtState(def.id);
    const now = Date.now();
    const divCd = m.lastDivAt && now - m.lastDivAt < 300000;
    const cutActive = m.boostUntil && now < m.boostUntil;
    return `
      <div class="card manage-card">
        <div class="card-title">👑 Manage ${def.name} <span class="owned-badge">${(frac * 100).toFixed(0)}% owned</span></div>
        <div class="card-sub">You control the company. Make a call:</div>
        <div class="manage-grid">
          <button class="btn manage-btn" data-act="manage" data-action="growth">
            📈 <b>Invest in growth</b><small>Costs ${formatMoney(s.marketCap * 0.05)} · price trends up over time</small></button>
          <button class="btn manage-btn" data-act="manage" data-action="dividend" ${divCd ? 'disabled' : ''}>
            💵 <b>Pay yourself</b><small>${divCd ? 'On cooldown' : 'Cash now: ' + formatMoney(s.marketCap * 0.02)}</small></button>
          <button class="btn manage-btn" data-act="manage" data-action="cutcosts" ${cutActive ? 'disabled' : ''}>
            ✂️ <b>Cut costs</b><small>${cutActive ? 'Boost active' : '+10% price for 5 min'}</small></button>
          <button class="btn manage-btn" data-act="manage" data-action="expand">
            🏗️ <b>Expand</b><small>Costs ${formatMoney(s.marketCap * 0.10)} · raises company value</small></button>
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
    chart = new CandleChart(el);
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
    fs = { chart: new CandleChart(chEl), tf: view.tf, priceEl: ov.querySelector('#fsPrice') };
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
      for (const def of ASSET_DEFS) {
        const pe = container.querySelector(`[data-price="${def.id}"]`);
        if (!pe) continue; // not in the current filter
        pe.textContent = formatMoney(Market.price(def.id));
        const ce = container.querySelector(`[data-change="${def.id}"]`);
        if (ce) {
          const ch = Market.changePct(def.id);
          ce.textContent = `${sign(ch)}${ch.toFixed(2)}%`;
          ce.className = `asset-change ${plCls(ch)}`;
        }
      }
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
