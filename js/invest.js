/* =========================================================================
 * invest.js — Phase 4 UI: the Trading 212–style Invest tab
 * -------------------------------------------------------------------------
 * Two views inside the tab:
 *   list   — portfolio summary, group filters, live asset rows
 *   detail — big price, candlestick chart (TradingView Lightweight Charts,
 *            loaded from CDN + cached by the service worker), timeframe
 *            toggle, position card, Buy/Sell with spread
 *
 * The chart library is optional at runtime: if the CDN script hasn't loaded
 * (first-ever visit while offline), the tab still works — prices, trading
 * and portfolio all function; the chart area shows a note and recovers
 * automatically once the library is available.
 * ========================================================================= */

const Invest = (() => {
  // View state survives tab switches so you come back to the same screen.
  const view = { mode: 'list', filter: 'all', assetId: null, tf: 10 };
  let container = null;
  let chart = null, series = null, chartAsset = null, chartTf = null;

  const GROUPS = [
    { id: 'all', label: 'All' },
    { id: 'stock', label: 'Stocks' },
    { id: 'crypto', label: 'Crypto' },
    { id: 'commodity', label: 'Commodities' },
    { id: 'held', label: 'Holdings' },
  ];
  const BUY_FRACS = [[0.1, '10%'], [0.25, '25%'], [0.5, '50%'], [1, 'MAX']];
  const SELL_FRACS = [[0.25, '25%'], [0.5, '50%'], [1, 'ALL']];

  function mount(el) {
    container = el;
    container.addEventListener('click', onClick);
    destroyChart(); // the old tab DOM is gone; never reuse a dead chart
    render();
  }

  /* --------------------------- Event delegation --------------------------- */

  function onClick(e) {
    const btn = e.target.closest('[data-asset],[data-back],[data-filter],[data-tf],[data-buyfrac],[data-sellfrac]');
    if (!btn || btn.disabled) return;
    const d = btn.dataset;

    if (d.asset) { view.mode = 'detail'; view.assetId = d.asset; destroyChart(); render(); }
    else if (d.back !== undefined) { view.mode = 'list'; destroyChart(); render(); }
    else if (d.filter) { view.filter = d.filter; render(); }
    else if (d.tf) { view.tf = parseInt(d.tf, 10); render(); }
    else if (d.buyfrac) {
      if (Market.buy(view.assetId, state.balance * parseFloat(d.buyfrac))) refresh(true);
    } else if (d.sellfrac) {
      if (Market.sell(view.assetId, parseFloat(d.sellfrac))) refresh(true);
    }
  }

  /* ------------------------------- Render -------------------------------- */

  function render() {
    if (!container) return;
    if (view.mode === 'detail') renderDetail();
    else renderList();
  }

  /** Fraction-of-a-share formatting for positions. */
  function fmtShares(s) {
    if (s >= 1000) return formatNumber(s);
    return (Math.round(s * 10000) / 10000).toString();
  }

  function plClass(v) { return v >= 0 ? 'up' : 'down'; }
  function plSign(v) { return v >= 0 ? '+' : ''; }

  /* ------------------------------ List view ------------------------------ */

  function renderList() {
    const sum = Market.portfolioSummary();
    const chips = GROUPS.map((g) =>
      `<button class="chip ${view.filter === g.id ? 'chip-active' : ''}" data-filter="${g.id}">${g.label}</button>`).join('');

    const rows = ASSET_DEFS.filter((a) => {
      if (view.filter === 'all') return true;
      if (view.filter === 'held') return Market.holding(a.id).shares > 0;
      return a.group === view.filter;
    }).map((a) => assetRowHTML(a)).join('');

    container.innerHTML = `
      <div class="section-head">
        <h2>Invest</h2>
        <div class="section-stat">${formatMoney(state.balance)} cash</div>
      </div>
      <div class="card">
        <div class="card-row">
          <div>
            <div class="card-title">📊 Portfolio</div>
            <div class="card-sub">Cost basis ${formatMoney(sum.cost)}</div>
          </div>
          <div class="pf-numbers">
            <div class="pf-value">${formatMoney(sum.value)}</div>
            <div class="pf-pl ${plClass(sum.pl)}">${plSign(sum.pl)}${formatMoney(sum.pl)} (${plSign(sum.plPct)}${sum.plPct.toFixed(1)}%)</div>
          </div>
        </div>
      </div>
      <div class="chip-row invest-filters">${chips}</div>
      <div class="asset-list">${rows || '<div class="coming-soon"><p>No holdings yet — buy something!</p></div>'}</div>
      <div class="progress-caption">Spread: buy +${(MARKET.SPREAD * 100).toFixed(1)}% / sell −${(MARKET.SPREAD * 100).toFixed(1)}% · stocks pay dividends every ${MARKET.DIV_INTERVAL_SEC / 60} min</div>
    `;
  }

  function assetRowHTML(a) {
    const p = Market.price(a.id);
    const ch = Market.changePct(a.id);
    const h = Market.holding(a.id);
    return `
      <button class="card asset-row" data-asset="${a.id}">
        <div class="biz-icon">${a.icon}</div>
        <div class="asset-name-wrap">
          <div class="asset-sym">${a.symbol} ${a.divYield ? '<span class="div-tag">DIV</span>' : ''}</div>
          <div class="asset-name">${a.name}${h.shares > 0 ? ` · ${fmtShares(h.shares)} sh` : ''}</div>
        </div>
        <div class="asset-price-wrap">
          <div class="asset-price" data-price="${a.id}">${formatMoney(p)}</div>
          <div class="asset-change ${plClass(ch)}" data-change="${a.id}">${plSign(ch)}${ch.toFixed(2)}%</div>
        </div>
      </button>`;
  }

  /* ----------------------------- Detail view ----------------------------- */

  function renderDetail() {
    const a = ASSET_BY_ID[view.assetId];
    const tfChips = MARKET.CANDLE_TFS.map((tf) =>
      `<button class="chip ${view.tf === tf ? 'chip-active' : ''}" data-tf="${tf}">${tf < 60 ? tf + 's' : (tf / 60) + 'm'}</button>`).join('');
    const buyBtns = BUY_FRACS.map(([f, l]) =>
      `<button class="btn btn-sm btn-gold" data-buyfrac="${f}">${l}</button>`).join('');
    const sellBtns = SELL_FRACS.map(([f, l]) =>
      `<button class="btn btn-sm" data-sellfrac="${f}">${l}</button>`).join('');

    container.innerHTML = `
      <button class="back-link" data-back>‹ Markets</button>
      <div class="detail-head">
        <div class="biz-icon">${a.icon}</div>
        <div>
          <div class="asset-sym">${a.symbol} · ${a.name}</div>
          <div class="asset-name">${a.group}${a.divYield ? ` · dividend ${(a.divYield * 100).toFixed(2)}%/5min` : ''}${a.oilLinked ? ' · linked to your Oil & Gas market' : ''}</div>
        </div>
      </div>
      <div class="detail-price-row">
        <div class="detail-price" id="invPrice"></div>
        <div class="detail-change" id="invChange"></div>
      </div>
      <div id="invChart" class="chart-box"></div>
      <div class="chip-row">${tfChips}</div>
      <div class="card" id="invPosition"></div>
      <div class="card">
        <div class="card-title">Buy <span class="muted">@ <span id="invAsk"></span> · % of cash</span></div>
        <div class="chip-row">${buyBtns}</div>
        <div class="card-title" style="margin-top:12px">Sell <span class="muted">@ <span id="invBid"></span> · % of position</span></div>
        <div class="chip-row">${sellBtns}</div>
      </div>
    `;
    initChart();
    refresh(true);
  }

  function positionHTML(a) {
    const h = Market.holding(a.id);
    if (h.shares <= 0) {
      return '<div class="card-sub">No position. Buy low, sell high — prices really do fall.</div>';
    }
    const p = Market.price(a.id);
    const value = h.shares * p;
    const avg = h.cost / h.shares;
    const pl = value - h.cost;
    const plPct = (pl / h.cost) * 100;
    return `
      <div class="card-title">Your position</div>
      <div class="mult-row"><span>Shares</span><b>${fmtShares(h.shares)}</b></div>
      <div class="mult-row"><span>Avg buy price</span><b>${formatMoney(avg)}</b></div>
      <div class="mult-row"><span>Value</span><b>${formatMoney(value)}</b></div>
      <div class="mult-row mult-total"><span>P/L</span>
        <b class="${plClass(pl)}">${plSign(pl)}${formatMoney(pl)} (${plSign(plPct)}${plPct.toFixed(1)}%)</b></div>`;
  }

  /* -------------------------------- Chart -------------------------------- */

  function initChart() {
    const el = document.getElementById('invChart');
    if (!el) return;
    if (typeof LightweightCharts === 'undefined') {
      el.innerHTML = '<div class="chart-fallback">📉 Chart library loading… trading works meanwhile.</div>';
      chart = null;
      return;
    }
    el.innerHTML = '';
    chart = LightweightCharts.createChart(el, {
      autoSize: true,
      layout: { background: { color: 'transparent' }, textColor: '#8a93a6', fontSize: 11 },
      grid: { vertLines: { color: '#1e2430' }, horzLines: { color: '#1e2430' } },
      timeScale: { timeVisible: true, secondsVisible: true, borderColor: '#262d3a' },
      rightPriceScale: { borderColor: '#262d3a' },
      crosshair: { mode: 0 },
    });
    series = chart.addCandlestickSeries({
      upColor: '#3ddc84', downColor: '#ff5d5d',
      wickUpColor: '#3ddc84', wickDownColor: '#ff5d5d',
      borderVisible: false,
    });
    chartAsset = view.assetId;
    chartTf = view.tf;
    series.setData(Market.candles(view.assetId, view.tf));
    chart.timeScale().scrollToRealTime();
  }

  function destroyChart() {
    if (chart) { try { chart.remove(); } catch (e) { /* container already gone */ } }
    chart = null; series = null; chartAsset = null; chartTf = null;
  }

  /* ------------------------------- Refresh -------------------------------- */

  /**
   * Light per-second update (called from ui.js). Never rebuilds the DOM in
   * detail view — updates text + pushes the latest candle to the chart.
   */
  function refresh(force) {
    if (!container) return;

    if (view.mode === 'list') {
      for (const a of ASSET_DEFS) {
        const priceEl = container.querySelector(`[data-price="${a.id}"]`);
        const chEl = container.querySelector(`[data-change="${a.id}"]`);
        if (priceEl) priceEl.textContent = formatMoney(Market.price(a.id));
        if (chEl) {
          const ch = Market.changePct(a.id);
          chEl.textContent = `${plSign(ch)}${ch.toFixed(2)}%`;
          chEl.className = `asset-change ${plClass(ch)}`;
        }
      }
      return;
    }

    // Detail view
    const a = ASSET_BY_ID[view.assetId];
    if (!a) return;
    const p = Market.price(a.id);
    const ch = Market.changePct(a.id);
    const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    set('invPrice', formatMoney(p));
    set('invAsk', formatMoney(Market.buyPrice(a.id)));
    set('invBid', formatMoney(Market.sellPrice(a.id)));
    const chEl = document.getElementById('invChange');
    if (chEl) {
      chEl.textContent = `${plSign(ch)}${ch.toFixed(2)}%`;
      chEl.className = `detail-change ${plClass(ch)}`;
    }
    const pos = document.getElementById('invPosition');
    if (pos && (force || !pos.dataset.tick || (Date.now() / 1000 | 0) % 2 === 0)) {
      pos.innerHTML = positionHTML(a);
      pos.dataset.tick = '1';
    }

    // Chart: recreate if the library just arrived or asset/tf changed,
    // else push only the newest candle (cheap).
    if (!chart && typeof LightweightCharts !== 'undefined') initChart();
    if (chart && (chartAsset !== view.assetId || chartTf !== view.tf)) {
      series.setData(Market.candles(view.assetId, view.tf));
      chartAsset = view.assetId; chartTf = view.tf;
    } else if (series) {
      const list = Market.candles(view.assetId, view.tf);
      if (list.length) series.update(list[list.length - 1]);
    }
  }

  return { mount, refresh };
})();
