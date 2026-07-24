/* =========================================================================
 * format.js — Number & money formatting
 * -------------------------------------------------------------------------
 * ECONOMY RULE (GAME_PLAN.md §9): money is tracked as floating point
 * internally. Small amounts display with two decimals ($12.60); the K/M/B/T
 * abbreviation only kicks in at $10,000 and above.
 * ========================================================================= */

// Suffix ladder. Extends past trillions for the late-game economy.
const NUMBER_SUFFIXES = [
  '', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc',
];

// Abbreviation threshold — below this, numbers are shown in full.
const ABBREV_THRESHOLD = 10000;

/**
 * Format a raw number: full with separators below 10,000 ("4,900"),
 * compact above ("1.2K", "3.4M", "5.6B", "7.8T").
 * @param {number} value
 * @param {number} decimals  significant decimals for the compact mantissa
 * @returns {string}
 */
function formatNumber(value, decimals = 2) {
  if (value === null || value === undefined || !isFinite(value)) return '0';
  const negative = value < 0;
  const n = Math.abs(value);

  if (n < ABBREV_THRESHOLD) {
    // Full number, thousands separators, up to 1 decimal for fractions.
    const s = n.toLocaleString('en-US', { maximumFractionDigits: n % 1 ? 1 : 0 });
    return (negative ? '-' : '') + s;
  }

  // Compact tier (guaranteed >= 1 here since n >= 10,000).
  let tier = Math.floor(Math.log10(n) / 3);
  if (tier >= NUMBER_SUFFIXES.length) tier = NUMBER_SUFFIXES.length - 1;

  const scaled = n / Math.pow(1000, tier);
  // Trim trailing zeros (1.20 -> 1.2, 5.00 -> 5)
  const mantissa = scaled.toFixed(decimals).replace(/\.?0+$/, '');

  return (negative ? '-' : '') + mantissa + NUMBER_SUFFIXES[tier];
}

/**
 * Format money with a leading $.
 * Below $10,000: exact with two decimals — "$12.60", "$4,900.00" — but sub-$1
 * values (e.g. meme coins) get enough decimals to show ~2 significant figures
 * so a real price never collapses to "$0.00" ("$0.000020", "$0.045").
 * From $10,000: compact — "$12.6K", "$3.4M", "$7.8T".
 */
function formatMoney(value, decimals = 2) {
  if (value === null || value === undefined || !isFinite(value)) return '$0.00';
  const negative = value < 0;
  const n = Math.abs(value);
  const sign = negative ? '-' : '';

  if (n < ABBREV_THRESHOLD) {
    let dp = 2;
    if (n > 0 && n < 1) {
      // First significant digit position: -1 for 0.x, -5 for 0.0000x. Show two
      // significant figures, capped so we never print an absurd tail.
      const firstSig = Math.floor(Math.log10(n));
      dp = Math.min(8, Math.max(2, 1 - firstSig));
    }
    return sign + '$' + n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  }
  return sign + '$' + formatNumber(n, decimals);
}

/**
 * Format a per-second rate, e.g. "$8.00/s", "$3.4M/s".
 */
function formatRate(value) {
  return formatMoney(value) + '/s';
}

/**
 * Human-friendly duration from seconds, e.g. "2h 5m", "45s".
 * Used by offline popup, project/build timers and cooldowns.
 */
function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  const parts = [];
  if (days) parts.push(days + 'd');
  if (hours) parts.push(hours + 'h');
  if (mins) parts.push(mins + 'm');
  if (!days && !hours && (secs || !mins)) parts.push(secs + 's');
  return parts.slice(0, 2).join(' ') || '0s';
}
