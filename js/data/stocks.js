/* =========================================================================
 * data/stocks.js — Phase 4 (overhauled) DATA: fictional company roster
 * -------------------------------------------------------------------------
 * Every company is an ORIGINAL, CUSTOM name — no real company name or ticker
 * is used. Rows are compact: [id, name, ticker, sector, refPrice, founded].
 * All other numbers (market cap, P/E, shares, dividend yield, volatility,
 * candle history) are generated procedurally in js/market.js from a seed —
 * we never hand-write 100+ stat blocks.
 *
 * `sector` keys map to SECTOR_PROFILES in js/data/markets.js.
 * Legacy ids (mango, googol, tezla, amazen, faceblock…) are unchanged so
 * existing player holdings survive. Roster trimmed to a curated 48 names;
 * holdings in removed tickers are converted to cash on load (state.js v10).
 * ========================================================================= */

const STOCK_ROSTER = [
  // id             name                          ticker  sector       refPrice  founded
  ['mango',        'Halcyon Digital',            'HALD', 'tech',        210,   1976],
  ['envidia',      'Ignis Semiconductors',       'IGNS', 'semi',        125,   1993],
  ['googol',       'Vireo Technologies',         'VIRO', 'tech',        180,   1998],
  ['macrosoft',    'Kestrel Software',           'KSTL', 'tech',        430,   1975],
  ['amazen',       'Emporia Commerce',           'EMPC', 'retail',      150,   1994],
  ['silicon_isle', 'Meridian Semiconductor',     'MRDS', 'semi',        175,   1987],
  ['broadwave',    'Pulsar Systems',             'PLSR', 'semi',        165,   1991],
  ['faceblock',    'Lumen Social',               'LMSO', 'tech',        500,   2004],
  ['tezla',        'Voltaris Motors',            'VLTR', 'auto',        240,   2003],
  ['yorkshire',    'Kingsley Holdings',          'KNGH', 'fintech',     415,   1955],
  ['wallmarket',   'Homestead Retail',           'HMSD', 'retail',      70,    1962],
  ['morganpratt',  'Ashford & Rowe',             'ASHR', 'bank',        210,   1871],
  ['elytilly',     'Aventine Pharmaceuticals',   'AVPH', 'pharma',      780,   1876],
  ['vesa',         'Nexpay',                     'NXPY', 'fintech',     285,   1958],
  ['mistercard',   'Orbital Pay',                'ORBP', 'fintech',     480,   1966],
  ['auracle',      'Cygnus Labs',                'CYGN', 'tech',        140,   1977],
  ['exonmobton',   'Ardent Petroleum',           'ARDP', 'energy',      115,   1870],
  ['costko',       'Warehaus Wholesale',         'WRHS', 'retail',      850,   1983],
  ['netflex',      'Cineflux Media',             'CFLX', 'media',       640,   1997],
  ['jansen',       'Solvane Pharma',             'SLVN', 'pharma',      155,   1886],
  ['proctorgambit','Clareon Consumer Goods',     'CLRN', 'consumer',    165,   1837],
  ['novanordisk',  'Aurelis Pharma',             'AURP', 'pharma',      120,   1923],
  ['chokacola',    'Cascade Beverages',          'CSCD', 'consumer',    62,    1886],
  ['chevrol',      'Bedrock Energy',             'BDRK', 'energy',      155,   1879],
  ['bankameria',   'First Meridian Bank',        'FMBK', 'bank',        40,    1904],
  ['lithosystems', 'Photon Systems',             'PHTN', 'semi',        900,   1984],
  ['samsong',      'Kaisho Electronics',         'KAIS', 'tech',        55,    1938],
  ['maisonlux',    'Valmont Couture',            'VLMC', 'luxury',      720,   1987],
  ['toyoda',       'Ridgeline Motors',           'RDGM', 'auto',        190,   1937],
  ['dmd',          'Ember Microsystems',         'EMBR', 'semi',        160,   1969],
  ['pipsico',      'Crestfield Foods',           'CRST', 'consumer',    170,   1898],
  ['goldstein',    'Sterling & Vance',           'STVC', 'bank',        470,   1869],
  ['horizontel',   'Northwind Telecom',          'NWND', 'telecom',     40,    1983],
  ['ayteetel',     'Beacon Communications',      'BCON', 'telecom',     18,    1983],
  ['lindygas',     'Atmos Industrial Gases',     'ATMS', 'materials',   460,   1879],
  ['siegmens',     'Rheinwerk Industrial',       'RHWK', 'industrial',  180,   1847],
  ['bravohill',    'Ironvale Mining',            'IRVL', 'materials',   58,    1885],
  ['dizzney',      'Fablewood Studios',          'FBLW', 'media',       100,   1923],
  ['zony',         'Silvercrest Entertainment',  'SLVC', 'media',       90,    1946],
  ['nyke',         'Stride Athletics',           'STRD', 'consumer',    78,    1964],
  ['aerobus',      'Vantair Aerospace',          'VNTR', 'aerospace',   160,   1970],
  ['boyoing',      'Aeronova Aerospace',         'ARNV', 'aerospace',   180,   1916],
  ['caterpillow',  'Colossus Equipment',         'CLEQ', 'industrial',  340,   1925],
  ['phizer',       'Helvara Pharma',             'HLVR', 'pharma',      28,    1849],
  ['nexteon',      'Radiant Utilities',          'RADU', 'utility',     75,    1925],
  ['lockjaw',      'Ironhold Defense',           'IRHD', 'aerospace',   460,   1912],
  ['microne',      'Corium Semiconductors',      'CORM', 'semi',        100,   1978],
  ['ferraro',      'Auressa Luxury',             'AURS', 'luxury',      400,   1939],
];

// Resolve compact rows into full asset defs (group 'stock'); market.js reads
// SECTOR_PROFILES + a per-id seed to fill in every other number on demand.
const STOCK_DEFS = STOCK_ROSTER.map(([id, name, ticker, sector, refPrice, founded]) => ({
  id, name, ticker, symbol: ticker, group: 'stock', sector, refPrice, founded,
}));

// The full tradeable universe (crypto + stocks) + id lookup.
const ASSET_DEFS = CRYPTO_DEFS.concat(STOCK_DEFS);
const ASSET_BY_ID = ASSET_DEFS.reduce((m, a) => { m[a.id] = a; return m; }, {});
