/* =========================================================================
 * logos.js — Procedural stock-logo system (pure SVG, no image files)
 * -------------------------------------------------------------------------
 * One function — Logos.tile(def, cls) — renders a premium rounded app-icon
 * tile for ANY asset, everywhere it appears (markets list, detail, ticket).
 *
 *   - ~20 clean geometric symbols (hexagon, orbit, chevron, bars, shield,
 *     network, globe, bolt…) picked DETERMINISTICALLY from the company name,
 *     so a company always keeps its mark. ~1 in 4 companies get a bold
 *     monogram letterform instead — like real brands, some logos are letters.
 *   - A curated 14-colour palette; each company gets a subtle two-stop
 *     gradient derived from its name. Distinct, but one visual family.
 *   - Designed override: drop img/logos/<ticker>.svg in (ticker lowercased,
 *     e.g. mngo.svg) and it covers the generated logo automatically (a failed
 *     load is remembered per session so we never re-request missing files).
 *
 * Performance: the SVG string for each asset is built once and cached —
 * list rebuilds are pure string concatenation, nothing is drawn per frame.
 * ========================================================================= */

const Logos = (() => {
  const cache = {};        // id -> inner SVG string (built once)
  const missing = new Set(); // slugs whose .svg AND .png both 404'd this session
  const resolved = {};     // slug -> 'svg' | 'png' (the override file that loaded)

  /* ------------------------------ Hashing ------------------------------- */

  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  /* ------------------------------ Palette ------------------------------- */
  // Muted, modern two-stop gradients (135°). White symbols sit on all of them.

  const PALETTES = [
    ['#1d4ed8', '#3b82f6'], // sapphire
    ['#4338ca', '#6366f1'], // indigo
    ['#6d28d9', '#8b5cf6'], // violet
    ['#86198f', '#c026d3'], // orchid
    ['#831843', '#be185d'], // berry
    ['#991b1b', '#dc2626'], // crimson
    ['#b45309', '#f59e0b'], // amber
    ['#78350f', '#b45309'], // bronze
    ['#166534', '#16a34a'], // forest
    ['#0f766e', '#14b8a6'], // teal
    ['#155e75', '#0891b2'], // steel cyan
    ['#075985', '#0284c7'], // ocean
    ['#334155', '#64748b'], // slate
    ['#1f2937', '#4b5563'], // graphite
  ];

  /* ------------------------------ Symbols ------------------------------- */
  // Each draws inside a 100×100 viewBox, centred at (50,50), in white.
  // Strokes ~7 units → ~2.8px at 40px tile size: crisp and legible.

  const S = 'stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"';
  const F = 'fill="#fff"';

  const SYMBOLS = [
    // hexagon
    () => `<polygon points="50,26 70.8,38 70.8,62 50,74 29.2,62 29.2,38" ${S}/>`,
    // orbit
    () => `<circle cx="50" cy="50" r="11" ${F}/><ellipse cx="50" cy="50" rx="30" ry="12" ${S} transform="rotate(-24 50 50)"/>`,
    // double chevron
    () => `<polyline points="32,56 50,38 68,56" ${S}/><polyline points="32,72 50,54 68,72" ${S}/>`,
    // arc + dot
    () => `<path d="M30 68 A29 29 0 0 1 66 36" ${S} stroke-width="8"/><circle cx="71" cy="31" r="6" ${F}/>`,
    // rising bars
    () => `<rect x="30" y="52" width="10" height="20" rx="4" ${F}/><rect x="45" y="40" width="10" height="32" rx="4" ${F}/><rect x="60" y="28" width="10" height="44" rx="4" ${F}/>`,
    // shield
    () => `<path d="M50 26 L70 34 V52 C70 64 60 71 50 75 C40 71 30 64 30 52 V34 Z" ${S}/>`,
    // network
    () => `<line x1="50" y1="34" x2="35" y2="64" ${S} stroke-width="5"/><line x1="50" y1="34" x2="65" y2="64" ${S} stroke-width="5"/><line x1="35" y1="64" x2="65" y2="64" ${S} stroke-width="5"/><circle cx="50" cy="34" r="6.5" ${F}/><circle cx="35" cy="64" r="6.5" ${F}/><circle cx="65" cy="64" r="6.5" ${F}/>`,
    // diamond
    () => `<rect x="34" y="34" width="32" height="32" rx="5" ${S} transform="rotate(45 50 50)"/>`,
    // twin rings
    () => `<circle cx="42" cy="50" r="16" ${S}/><circle cx="58" cy="50" r="16" ${S}/>`,
    // triangle
    () => `<polygon points="50,29 72,69 28,69" ${S}/>`,
    // wave
    () => `<path d="M28 50 C36 34 44 34 50 50 C56 66 64 66 72 50" ${S}/>`,
    // plus
    () => `<rect x="44" y="27" width="12" height="46" rx="6" ${F}/><rect x="27" y="44" width="46" height="12" rx="6" ${F}/>`,
    // spark (4-point star)
    () => `<path d="M50 25 L56.5 43.5 75 50 56.5 56.5 50 75 43.5 56.5 25 50 43.5 43.5 Z" ${F}/>`,
    // layer stack
    () => `<polygon points="50,27 71,38 50,49 29,38" ${F}/><polyline points="29,50 50,61 71,50" ${S} stroke-width="6"/><polyline points="29,61 50,72 71,61" ${S} stroke-width="6"/>`,
    // globe
    () => `<circle cx="50" cy="50" r="23" ${S} stroke-width="6"/><ellipse cx="50" cy="50" rx="10" ry="23" ${S} stroke-width="5"/><line x1="27" y1="50" x2="73" y2="50" ${S} stroke-width="5"/>`,
    // bolt
    () => `<polygon points="55,25 37,54 48,54 44,75 63,45 52,45" ${F}/>`,
    // leaf
    () => `<path d="M50 73 C31 61 31 39 50 27 C69 39 69 61 50 73 Z" ${S}/><line x1="50" y1="70" x2="50" y2="46" ${S} stroke-width="5"/>`,
    // target
    () => `<circle cx="50" cy="50" r="22" ${S} stroke-width="6"/><circle cx="50" cy="50" r="11" ${S} stroke-width="5"/><circle cx="50" cy="50" r="3.5" ${F}/>`,
    // split square
    () => `<polygon points="30,30 62,30 30,62" ${F}/><polygon points="70,38 70,70 38,70" ${F}/>`,
  ];

  /* ------------------------------ Builder ------------------------------- */

  /** Deterministic style pick from the asset's id + name. */
  function styleOf(def) {
    let h = hashStr(def.id + '|' + def.name);
    // Avalanche mix — FNV's low bits cluster on short similar strings.
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = (h ^ (h >>> 12)) >>> 0;
    return {
      monogram: h % 4 === 0,               // ~25% get a letterform logo
      symbol: SYMBOLS[(h >>> 3) % SYMBOLS.length],
      palette: PALETTES[(h >>> 9) % PALETTES.length],
    };
  }

  /** Inner SVG for an asset (cached; identical on every call). */
  function svg(def) {
    if (cache[def.id]) return cache[def.id];
    const st = styleOf(def);
    const [c0, c1] = st.palette;
    const letter = (def.name || '?').trim().charAt(0).toUpperCase();

    const mark = st.monogram
      ? `<text x="50" y="50" dy=".36em" text-anchor="middle" font-family="-apple-system,'Segoe UI',Roboto,sans-serif" font-size="48" font-weight="800" fill="#fff">${letter}</text>`
      : `<g opacity=".96">${st.symbol()}</g>`;

    const out = `
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <linearGradient id="lg-${def.id}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="${c0}"/><stop offset="1" stop-color="${c1}"/>
          </linearGradient>
          <linearGradient id="hl-${def.id}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="rgba(255,255,255,.18)"/><stop offset=".55" stop-color="rgba(255,255,255,0)"/>
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="96" height="96" rx="24" fill="url(#lg-${def.id})"/>
        <rect x="2" y="2" width="96" height="96" rx="24" fill="url(#hl-${def.id})"/>
        <rect x="2.75" y="2.75" width="94.5" height="94.5" rx="23.4" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="1.5"/>
        ${mark}
      </svg>`;
    cache[def.id] = out;
    return out;
  }

  /** File slug for an asset's designed-logo override: its ticker, lowercased
   *  (e.g. MNGO -> mngo). Falls back to the id if a def has no ticker. */
  function slugOf(def) {
    return String(def.ticker || def.id).toLowerCase();
  }

  /**
   * THE one entry point: a logo tile for any asset.
   * cls: '' (40px row) | 'lg' (detail) | 'sm' (ticket).
   * If img/logos/<ticker>.svg OR .png exists it covers the generated logo (we
   * try .svg first, then .png). If neither exists the slug is remembered so
   * re-renders never re-request it.
   */
  function tile(def, cls = '') {
    const slug = slugOf(def);
    let img = '';
    if (!missing.has(slug)) {
      const ext = resolved[slug] || 'svg'; // start from the ext known to work
      img = `<img src="img/logos/${slug}.${ext}" alt="" loading="lazy" decoding="async" onload="Logos.hit(this,'${slug}','${ext}')" onerror="Logos.miss(this,'${slug}','${ext}')">`;
    }
    return `<span class="logo-tile ${cls}">${svg(def)}${img}</span>`;
  }

  /** onload hook: a designed override loaded — remember which extension worked
   *  and hide the generated mark so the tile takes the override's own shape. */
  function hit(el, slug, ext) {
    if (slug) resolved[slug] = ext;
    const tile = el && el.parentNode;
    if (tile && tile.classList) tile.classList.add('has-override');
  }

  /** onerror hook: if the .svg wasn't there, fall back to .png before giving
   *  up; if the .png is also missing, drop it and never ask for either again. */
  function miss(el, slug, ext) {
    if (ext === 'svg') {
      // Point both hooks at the .png attempt so a successful load records 'png'
      // (not the failed 'svg'), and a second failure marks the slug missing.
      el.onload = function () { Logos.hit(el, slug, 'png'); };
      el.onerror = function () { Logos.miss(el, slug, 'png'); };
      el.src = `img/logos/${slug}.png`;
      return;
    }
    missing.add(slug);
    if (el && el.remove) el.remove();
  }

  return { tile, svg, styleOf, hit, miss };
})();
