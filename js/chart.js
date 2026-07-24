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

    // Colours are pulled live from the CSS theme variables (see syncTheme),
    // so the chart follows the light/dark theme on every draw.
    this.COL = {
      up: '#16a34a', down: '#dc2626',
      grid: '#eef1f5', axis: '#667085',
      line: '#2563eb', fillTop: 'rgba(37,99,235,0.16)', fillBot: 'rgba(37,99,235,0)',
    };
  }

  /** Read the current theme's palette from CSS custom properties. */
  syncTheme() {
    if (typeof getComputedStyle === 'undefined') return;
    const cs = getComputedStyle(document.documentElement);
    const v = (name, fallback) => {
      const val = cs.getPropertyValue(name);
      return val && val.trim() ? val.trim() : fallback;
    };
    this.COL = {
      up: v('--green', '#16a34a'),
      down: v('--danger', '#dc2626'),
      grid: v('--chart-grid', '#eef1f5'),
      axis: v('--muted', '#667085'),
      line: v('--gold', '#2563eb'),
      fillTop: v('--chart-fill-top', 'rgba(37,99,235,0.16)'),
      fillBot: v('--chart-fill-bot', 'rgba(37,99,235,0)'),
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

  draw() {
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0 || this.candles.length === 0) return;
    this.syncTheme(); // follow the active light/dark theme

    if (this.canvas.width !== w * dpr || this.canvas.height !== h * dpr) {
      this.canvas.width = w * dpr;
      this.canvas.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Plot area (right margin hosts the price axis, bottom the time axis).
    const PAD_L = 8, PAD_R = 62, PAD_T = 10, PAD_B = 20;
    const plotW = w - PAD_L - PAD_R;
    const plotH = h - PAD_T - PAD_B;

    // Thin the data so the shape is spread out and legible instead of a tight
    // wall of wiggles. Candles get a wide ~14px slot (clear gaps); the line
    // keeps ~9px between points so its dips and curves breathe.
    let data = this.candles;
    const slot = this.mode === 'line' ? 9 : 14;
    const fit = Math.max(this.mode === 'line' ? 20 : 14, Math.floor(plotW / slot));
    if (data.length > fit) data = data.slice(-fit);
    const n = data.length;

    // Auto-scale to the visible range. The line view only needs closes; candles
    // need the full high/low span.
    let min = Infinity, max = -Infinity;
    for (const c of data) {
      const lo = this.mode === 'line' ? c.close : c.low;
      const hi = this.mode === 'line' ? c.close : c.high;
      if (lo < min) min = lo;
      if (hi > max) max = hi;
    }
    // Keep a sane minimum vertical span so a near-flat window isn't zoomed into
    // giant candles — quiet stretches should read as calm, not exploded.
    const mid = (max + min) / 2 || 1;
    const minSpan = mid * 0.012;
    if (max - min < minSpan) { max = mid + minSpan / 2; min = mid - minSpan / 2; }
    const pad = (max - min) * 0.08 || max * 0.01 || 1;
    min -= pad; max += pad;
    const y = (p) => PAD_T + ((max - p) / (max - min)) * plotH;
    const x = (i) => PAD_L + (plotW / n) * (i + 0.5);

    // Trading-212-style price axis: a ladder of evenly spaced "nice" price
    // levels (round numbers, consistent decimals, never overlapping). The live
    // price rides in a coloured pill that hides any ladder label it collides
    // with, so nothing ever prints on top of anything else.
    const axis = this.priceTicks(min, max, plotH);
    const liveP = data[n - 1].close;
    const liveY = y(liveP);

    this.drawGrid(ctx, w, h, PAD_L, plotW, y, axis, liveY);
    if (this.mode === 'line') this.drawLine(ctx, data, x, y, PAD_T, plotH, PAD_L, plotW);
    else this.drawCandles(ctx, data, x, y, plotW / n, PAD_L, plotW);
    // Live-price pill last, so it sits cleanly above the grid labels.
    this.drawPriceTag(ctx, this.axisLabel(liveP, axis.decimals), liveY, PAD_L + plotW, w, this.COL.line);
    this.drawTimeAxis(ctx, data, h, PAD_L, plotW);
  }

  /* ------------------------- Price axis ladder ------------------------- */

  /**
   * Evenly spaced "nice" price levels across [min, max] — the ladder on the
   * right. Steps snap to 1/2/2.5/5 ×10ⁿ so labels land on round numbers, and
   * the count is capped by the available height (~one label per 26px) so they
   * never crowd. `decimals` is shared by every label so the pennies line up.
   */
  priceTicks(min, max, plotH) {
    const range = max - min;
    if (!(range > 0)) return { ticks: [min], decimals: 2, step: 1 };
    const maxTicks = Math.max(2, Math.floor(plotH / 19));
    const rawStep = range / maxTicks;
    const pow = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const frac = rawStep / pow;
    const niceFrac = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10;
    const step = niceFrac * pow;
    // Enough decimals to render the step, but always at least pennies for
    // normal prices (and more for micro-priced coins) so the rise reads neatly.
    let decimals = Math.max(0, Math.ceil(-Math.log10(step) - 1e-9));
    if (max < 10000) decimals = Math.max(decimals, 2);
    if (max < 1) decimals = Math.max(decimals, 4);
    if (max < 0.01) decimals = Math.max(decimals, 6);
    decimals = Math.min(decimals, 8);
    const ticks = [];
    for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) ticks.push(v);
    return { ticks, decimals, step };
  }

  /** Axis/pill label: fixed decimals + thousands separators; compact if huge. */
  axisLabel(p, decimals) {
    if (p >= 10000) return formatNumber(p, 2);
    return p.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /** Filled coloured price pill in the right margin (white text). */
  drawPriceTag(ctx, text, yPos, rightX, w, color) {
    const tagH = 15, x0 = rightX + 3, x1 = w - 1;
    const yy = Math.round(yPos);
    ctx.fillStyle = color;
    this.roundRect(ctx, x0, yy - tagH / 2, x1 - x0, tagH, 3);
    ctx.fill();
    ctx.font = '600 10px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, (x0 + x1) / 2, yy);
  }

  /* ------------------------- Shared chrome ------------------------- */

  drawGrid(ctx, w, h, PAD_L, plotW, y, axis, liveY) {
    ctx.font = '10px -apple-system, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    const rightX = PAD_L + plotW;
    const labelX = w - 4;
    for (const p of axis.ticks) {
      const gy = Math.round(y(p)) + 0.5;   // snap to pixel → crisp 1px line
      ctx.strokeStyle = this.COL.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD_L, gy);
      ctx.lineTo(rightX, gy);
      ctx.stroke();
      // Skip a label that would collide with the live-price pill.
      if (Math.abs(y(p) - liveY) < 9) continue;
      ctx.fillStyle = this.COL.axis;
      ctx.textAlign = 'right';
      ctx.fillText(this.axisLabel(p, axis.decimals), labelX, Math.round(y(p)));
    }
  }

  /**
   * Time axis, Trading-212 style: a few evenly spaced absolute date/time stamps
   * across the plot, in the granularity that suits the visible span — clock time
   * for intraday, "12 Mar" for weeks, "Mar '25" for months, years for MAX. The
   * count fits the width (~one per 64px); ends anchor to the plot edges and the
   * rest sit at even fractions between them, so nothing bunches up.
   */
  drawTimeAxis(ctx, data, h, PAD_L, plotW) {
    const n = data.length;
    if (n < 2) return;
    ctx.fillStyle = this.COL.axis;
    ctx.textBaseline = 'alphabetic';
    ctx.font = '10px -apple-system, system-ui, sans-serif';
    const t0 = data[0].time, span = data[n - 1].time - t0;
    // Pick the label granularity from the visible span.
    let fmt;
    if (span < 5 * 60) fmt = 'secs';            // < 5 min → HH:MM:SS
    else if (span < 2 * 86400) fmt = 'time';    // < 2 days → HH:MM
    else if (span < 120 * 86400) fmt = 'day';   // < ~4 months → 12 Mar
    else if (span < 4 * 365 * 86400) fmt = 'month'; // < ~4 years → Mar '25
    else fmt = 'year';                          // MAX → 2025
    const k = Math.max(2, Math.min(5, Math.floor(plotW / 64)));
    for (let j = 0; j < k; j++) {
      const f = j / (k - 1);
      const first = j === 0, last = j === k - 1;
      ctx.textAlign = first ? 'left' : last ? 'right' : 'center';
      const lx = first ? PAD_L : last ? PAD_L + plotW : Math.round(PAD_L + f * plotW);
      ctx.fillText(this.axisTime(t0 + f * span, fmt), lx, h - 6);
    }
  }

  /** Absolute date/time label at the chosen granularity. */
  axisTime(sec, fmt) {
    const d = new Date(sec * 1000);
    const p2 = (x) => String(x).padStart(2, '0');
    if (fmt === 'secs') return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
    if (fmt === 'time') return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
    const mon = CandleChart.MONTHS[d.getMonth()];
    if (fmt === 'day') return `${d.getDate()} ${mon}`;
    if (fmt === 'month') return `${mon} '${String(d.getFullYear()).slice(2)}`;
    return String(d.getFullYear());
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
    // The live-price pill is drawn by draw() over the axis (shared with candles).
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
    // The live-price pill is drawn by draw() over the axis (shared with line mode).
  }
}

CandleChart.MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
