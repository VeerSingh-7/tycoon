/* =========================================================================
 * chart.js — Self-contained HTML5-canvas price chart (no libraries)
 * -------------------------------------------------------------------------
 * Two modes, Trading-212 style:
 *   'line'    — smooth gold price line with a soft gradient area fill and a
 *               glowing live dot (the friendly default on detail pages)
 *   'candles' — professional candlesticks for the big fullscreen view:
 *               thin 1.25px wicks, capped body width with clean gaps,
 *               green up / red down, clear price axis
 *
 * API (used by invest.js):
 *   const chart = new CandleChart(containerEl, { mode: 'line' });
 *   chart.setData(candles);   // [{time, open, high, low, close}, ...] asc
 *   chart.update(candle);     // replace last (same time) or append (newer)
 *   chart.destroy();
 *
 * The price axis auto-scales to the visible range and the canvas is
 * devicePixelRatio-aware so it stays crisp on phones.
 * ========================================================================= */

class CandleChart {
  constructor(container, opts = {}) {
    this.container = container;
    this.mode = opts.mode || 'candles';
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'width:100%;height:100%;display:block;';
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.candles = [];
    this.maxBars = 140;

    // Theme (matches css/styles.css palette).
    this.COL = {
      up: '#3ddc84', down: '#ff5d5d',
      grid: '#1e2430', axis: '#8a93a6',
      line: '#f5c451', fillTop: 'rgba(245,196,81,0.26)', fillBot: 'rgba(245,196,81,0)',
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

  /** Compact price label; more decimals for micro-priced meme coins. */
  fmtPrice(p) {
    if (p >= 10000) return formatNumber(p, 2);
    if (p >= 100) return p.toFixed(1);
    if (p >= 1) return p.toFixed(2);
    if (p >= 0.01) return p.toFixed(4);
    return p.toPrecision(2);
  }

  draw() {
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0 || this.candles.length === 0) return;

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

    // Auto-scale to the visible range (+5% padding). The line view only
    // needs closes; candles need the full high/low span.
    let min = Infinity, max = -Infinity;
    for (const c of data) {
      const lo = this.mode === 'line' ? c.close : c.low;
      const hi = this.mode === 'line' ? c.close : c.high;
      if (lo < min) min = lo;
      if (hi > max) max = hi;
    }
    const pad = (max - min) * 0.05 || max * 0.01 || 1;
    min -= pad; max += pad;
    const y = (p) => PAD_T + ((max - p) / (max - min)) * plotH;
    const x = (i) => PAD_L + (plotW / n) * (i + 0.5);

    this.drawGrid(ctx, w, h, PAD_L, plotW, min, max, y);
    if (this.mode === 'line') this.drawLine(ctx, data, x, y, PAD_T, plotH, PAD_L, plotW);
    else this.drawCandles(ctx, data, x, y, plotW / n, PAD_L, plotW);
    this.drawTimeAxis(ctx, data, x, h);
  }

  /* ------------------------- Shared chrome ------------------------- */

  drawGrid(ctx, w, h, PAD_L, plotW, min, max, y) {
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
  }

  drawTimeAxis(ctx, data, x, h) {
    const n = data.length;
    ctx.fillStyle = this.COL.axis;
    ctx.textBaseline = 'alphabetic';
    const spanSec = n > 1 ? data[n - 1].time - data[0].time : 0;
    const useDate = spanSec >= 3 * 86400;      // days of history → dates
    const useSecs = !useDate && spanSec < 600; // sub-10-min windows → HH:MM:SS
    const stamps = [[0, 'left'], [Math.floor(n / 2), 'center'], [n - 1, 'right']];
    for (const [i, align] of stamps) {
      ctx.textAlign = align;
      ctx.fillText(this.stamp(data[i].time, useDate, useSecs), x(i), h - 6);
    }
  }

  stamp(sec, useDate, useSecs) {
    const d = new Date(sec * 1000);
    if (!useDate) return d.toTimeString().slice(0, useSecs ? 8 : 5);
    const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
    return `${d.getDate()} ${mon} '${String(d.getFullYear()).slice(2)}`;
  }

  /* ------------------------- Line / area mode ------------------------ */

  drawLine(ctx, data, x, y, PAD_T, plotH, PAD_L, plotW) {
    const n = data.length;

    // Smooth path through the closes (quadratic midpoint smoothing).
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(x(0), y(data[0].close));
      for (let i = 1; i < n; i++) {
        const mx = (x(i - 1) + x(i)) / 2;
        const my = (y(data[i - 1].close) + y(data[i].close)) / 2;
        ctx.quadraticCurveTo(x(i - 1), y(data[i - 1].close), mx, my);
      }
      ctx.lineTo(x(n - 1), y(data[n - 1].close));
    };

    // Soft gradient area under the line.
    const grad = ctx.createLinearGradient(0, PAD_T, 0, PAD_T + plotH);
    grad.addColorStop(0, this.COL.fillTop);
    grad.addColorStop(1, this.COL.fillBot);
    path();
    ctx.lineTo(x(n - 1), PAD_T + plotH);
    ctx.lineTo(x(0), PAD_T + plotH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // The line itself.
    path();
    ctx.strokeStyle = this.COL.line;
    ctx.lineWidth = 2.25;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Glowing live dot + gold price tag on the axis.
    const lx = x(n - 1), ly = y(data[n - 1].close);
    ctx.save();
    ctx.shadowColor = this.COL.line;
    ctx.shadowBlur = 9;
    ctx.fillStyle = this.COL.line;
    ctx.beginPath();
    ctx.arc(lx, ly, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = this.COL.line;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.fmtPrice(data[n - 1].close), PAD_L + plotW + 6, ly);
  }

  /* --------------------------- Candle mode --------------------------- */

  drawCandles(ctx, data, x, y, xStep, PAD_L, plotW) {
    const n = data.length;
    // Slim, real-trading-app proportions: narrow bodies (≤6px) with a clear
    // gap between them, wicks a 1px hairline — never chunky, whatever the count.
    const bodyW = Math.max(1, Math.min(xStep * 0.6, 6));

    for (let i = 0; i < n; i++) {
      const c = data[i];
      const cx = x(i);
      const col = c.close >= c.open ? this.COL.up : this.COL.down;

      // Wick: thin high–low hairline.
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, y(c.high));
      ctx.lineTo(cx, y(c.low));
      ctx.stroke();

      // Body: filled open–close rectangle.
      const top = y(Math.max(c.open, c.close));
      const bot = y(Math.min(c.open, c.close));
      ctx.fillStyle = col;
      ctx.fillRect(cx - bodyW / 2, top, bodyW, Math.max(1, bot - top));
    }

    // Dashed live-price line + gold tag on the axis.
    const live = data[n - 1].close;
    const ly = y(live);
    ctx.strokeStyle = this.COL.line;
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD_L, ly);
    ctx.lineTo(PAD_L + plotW, ly);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = this.COL.line;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.fmtPrice(live), PAD_L + plotW + 6, ly);
  }
}
