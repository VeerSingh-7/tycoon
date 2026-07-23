/* =========================================================================
 * data/stocks.js — Phase 4 (overhauled) DATA: fictional company roster
 * -------------------------------------------------------------------------
 * Every company is an ORIGINAL PARODY — no real company name or ticker is
 * used. Rows are compact: [id, name, ticker, sector, refPrice, founded].
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
  // id             name                 ticker  sector       refPrice  founded
  ['mango',        'Mango Inc',          'MNGO', 'tech',        210,   1976],
  ['envidia',      'Envidia',            'EVD',  'semi',        125,   1993],
  ['googol',       'Googol',             'GGL',  'tech',        180,   1998],
  ['macrosoft',    'Macrosoft',          'MCS',  'tech',        430,   1975],
  ['amazen',       'Amazen',             'AMZ',  'retail',      150,   1994],
  ['silicon_isle', 'Silicon Isle',       'SIL',  'semi',        175,   1987],
  ['broadwave',    'Broadwave',          'BRW',  'semi',        165,   1991],
  ['faceblock',    'Faceblock',          'FBK',  'tech',        500,   2004],
  ['tezla',        'Tezla',              'TZLA', 'auto',        240,   2003],
  ['yorkshire',    'Yorkshire Hathaway', 'YRK',  'fintech',     415,   1955],
  ['wallmarket',   'Wallmarket',         'WLM',  'retail',      70,    1962],
  ['morganpratt',  'Morgan & Pratt',     'MNP',  'bank',        210,   1871],
  ['elytilly',     'Ely Tilly',          'ETL',  'pharma',      780,   1876],
  ['vesa',         'Vesa',               'VSA',  'fintech',     285,   1958],
  ['mistercard',   'Mistercard',         'MIC',  'fintech',     480,   1966],
  ['auracle',      'Auracle',            'ARC',  'tech',        140,   1977],
  ['exonmobton',   'Exon Mobton',        'EXO',  'energy',      115,   1870],
  ['costko',       'Costko',             'CSK',  'retail',      850,   1983],
  ['netflex',      'Netflex',            'NFX',  'media',       640,   1997],
  ['jansen',       'Jansen & Jansen',    'JAJ',  'pharma',      155,   1886],
  ['proctorgambit','Proctor & Gambit',   'PNG',  'consumer',    165,   1837],
  ['novanordisk',  'Nordvia',            'NVK',  'pharma',      120,   1923],
  ['chokacola',    'Choka-Cola',         'CHK',  'consumer',    62,    1886],
  ['chevrol',      'Chevrol',            'CVR',  'energy',      155,   1879],
  ['bankameria',   'Apex Financial',     'APX',  'bank',        40,    1904],
  ['lithosystems', 'Litho Systems',      'LTH',  'semi',        900,   1984],
  ['samsong',      'Samsong',            'SMS',  'tech',        55,    1938],
  ['maisonlux',    'Maison Lux',         'MLX',  'luxury',      720,   1987],
  ['toyoda',       'Toyoda',             'TYD',  'auto',        190,   1937],
  ['dmd',          'Delta Micro',        'DMD',  'semi',        160,   1969],
  ['pipsico',      'Pipsico',            'PPS',  'consumer',    170,   1898],
  ['goldstein',    'Goldstein Sacks',    'GDS',  'bank',        470,   1869],
  ['horizontel',   'Horizon Telecom',    'HZN',  'telecom',     40,    1983],
  ['ayteetel',     'Aytee Telecom',      'ATE',  'telecom',     18,    1983],
  ['lindygas',     'Lindy Gas',          'LND',  'materials',   460,   1879],
  ['siegmens',     'Siegmens',           'SGM',  'industrial',  180,   1847],
  ['bravohill',    'BravoHill',          'BVH',  'materials',   58,    1885],
  ['dizzney',      'Dizzney',            'DZY',  'media',       100,   1923],
  ['zony',         'Zony',               'ZNY',  'media',       90,    1946],
  ['nyke',         'Nyke',               'NYK',  'consumer',    78,    1964],
  ['aerobus',      'Aerobus',            'ARB',  'aerospace',   160,   1970],
  ['boyoing',      'Boyoing',            'BYG',  'aerospace',   180,   1916],
  ['caterpillow',  'Caterpillow',        'CTP',  'industrial',  340,   1925],
  ['phizer',       'Phizer',             'PHZ',  'pharma',      28,    1849],
  ['nexteon',      'NextEon Energy',     'NXE',  'utility',     75,    1925],
  ['lockjaw',      'Lockjaw Martin',     'LKM',  'aerospace',   460,   1912],
  ['microne',      'Microne',            'MCN',  'semi',        100,   1978],
  ['ferraro',      'Ferraro',            'FRO',  'luxury',      400,   1939],
];

// Resolve compact rows into full asset defs (group 'stock'); market.js reads
// SECTOR_PROFILES + a per-id seed to fill in every other number on demand.
const STOCK_DEFS = STOCK_ROSTER.map(([id, name, ticker, sector, refPrice, founded]) => ({
  id, name, ticker, symbol: ticker, group: 'stock', sector, refPrice, founded,
}));

// The full tradeable universe (crypto + stocks) + id lookup.
const ASSET_DEFS = CRYPTO_DEFS.concat(STOCK_DEFS);
const ASSET_BY_ID = ASSET_DEFS.reduce((m, a) => { m[a.id] = a; return m; }, {});
