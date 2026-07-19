/* =========================================================================
 * chart.js — Self-contained HTML5-canvas candlestick chart (no libraries)
 * -------------------------------------------------------------------------
 * Replaces the TradingView CDN dependency: zero external code, fully
 * offline. API kept minimal for invest.js:
 *
 *   const chart = new CandleChart(containerEl);
 *   chart.setData(candles);   // [{time, open, high, low, close}, ...] asc
 *   chart.update(candle);     // replace last (same time) or append (newer)
 *   chart.destroy();
 *
 * Rendering: each candle = high–low wick line + open–close body rect,
 * green up / red down. The price axis auto-scales to the visible range
 * (with padding), a dashed gold line marks the live price, and the canvas
 * is devicePixelRatio-aware so it stays crisp on phones.
 * ========================================================================= */

class CandleChart {
  constructor(container) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'width:100%;height:100%;display:block;';
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.candles = [];
    this.maxBars = 90;

    // Theme (matches css/styles.css palette).
    this.COL = {
      up: '#3ddc84', down: '#ff5d5d',
      grid: '#1e2430', axis: '#8a93a6', live: '#f5c451',
    };
  }

  /** Replace the whole dataset (ascending time) and redraw. */
  setData(candles) {
    this.candles = candles.slice(-this.maxBars);
    this.draw();
  }

  /** Push the latest candle: same-time replaces, newer appends. */
  update(candle) {
    const last = this.candles[this.candles.length - 1];
    if (last && last.time === candle.time) {
      this.candles[this.candles.length - 1] = candle;
    } else if (!last || candle.time > last.time) {
      this.candles.push(candle);
      if (this.candles.length > this.maxBars) this.candles.shift();
    }
    this.draw();
  }

  destroy() {
    this.canvas.remove();
    this.candles = [];
  }

  /** Compact price label; more decimals for penny assets like Dogecorn. */
  fmtPrice(p) {
    if (p >= 10000) return formatNumber(p, 2);
    if (p >= 100) return p.toFixed(1);
    if (p >= 1) return p.toFixed(2);
    return p.toFixed(4);
  }

  draw() {
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0 || this.candles.length === 0) return;

    // Crisp rendering on high-DPI screens.
    if (this.canvas.width !== w * dpr || this.canvas.height !== h * dpr) {
      this.canvas.width = w * dpr;
      this.canvas.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Plot area (right margin hosts the price axis, bottom the time axis).
    const PAD_L = 8, PAD_R = 56, PAD_T = 10, PAD_B = 20;
    const plotW = w - PAD_L - PAD_R;
    const plotH = h - PAD_T - PAD_B;
    const data = this.candles;
    const n = data.length;

    // Auto-scale the price axis to the visible range (+5% padding).
    let min = Infinity, max = -Infinity;
    for (const c of data) {
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
    }
    const pad = (max - min) * 0.05 || max * 0.01 || 1;
    min -= pad; max += pad;
    const y = (p) => PAD_T + ((max - p) / (max - min)) * plotH;

    // Horizontal gridlines + price labels.
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textBaseline = 'middle';
    const GRID_LINES = 4;
    for (let i = 0; i <= GRID_LINES; i++) {
      const p = max - ((max - min) * i) / GRID_LINES;
      const gy = y(p);
      ctx.strokeStyle = this.COL.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD_L, gy);
      ctx.lineTo(PAD_L + plotW, gy);
      ctx.stroke();
      ctx.fillStyle = this.COL.axis;
      ctx.textAlign = 'left';
      ctx.fillText(this.fmtPrice(p), PAD_L + plotW + 6, gy);
    }

    // Candles: wick (high–low) + body (open–close).
    const xStep = plotW / n;
    const bodyW = Math.max(2, xStep * 0.65);
    for (let i = 0; i < n; i++) {
      const c = data[i];
      const cx = PAD_L + xStep * (i + 0.5);
      const col = c.close >= c.open ? this.COL.up : this.COL.down;

      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, y(c.high));
      ctx.lineTo(cx, y(c.low));
      ctx.stroke();

      const top = y(Math.max(c.open, c.close));
      const bot = y(Math.min(c.open, c.close));
      ctx.fillStyle = col;
      ctx.fillRect(cx - bodyW / 2, top, bodyW, Math.max(1, bot - top));
    }

    // Dashed live-price line + gold label on the axis.
    const live = data[n - 1].close;
    const ly = y(live);
    ctx.strokeStyle = this.COL.live;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(PAD_L, ly);
    ctx.lineTo(PAD_L + plotW, ly);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = this.COL.live;
    ctx.fillText(this.fmtPrice(live), PAD_L + plotW + 6, ly);

    // Time labels: first / middle / last candle.
    ctx.fillStyle = this.COL.axis;
    ctx.textBaseline = 'alphabetic';
    const stamps = [[0, 'left'], [Math.floor(n / 2), 'center'], [n - 1, 'right']];
    for (const [i, align] of stamps) {
      const t = new Date(data[i].time * 1000);
      const label = t.toTimeString().slice(0, 8);
      ctx.textAlign = align;
      ctx.fillText(label, PAD_L + xStep * (i + 0.5), h - 6);
    }
  }
}
