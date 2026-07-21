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
 * Six ids (mango, googol, tezla, amazen, ramble, burgerduke) are kept from
 * the original roster so existing player holdings survive the migration.
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
  ['novanordisk',  'Nova Nordisk',       'NVK',  'pharma',      120,   1923],
  ['homedeputy',   'Home Deputy',        'HMD',  'retail',      360,   1978],
  ['chokacola',    'Choka-Cola',         'CHK',  'consumer',    62,    1886],
  ['chevrol',      'Chevrol',            'CVR',  'energy',      155,   1879],
  ['bankameria',   'Bank of Ameria',     'BKA',  'bank',        40,    1904],
  ['jabvie',       'JabVie',             'JBV',  'pharma',      175,   2013],
  ['zapsystems',   'Zap Systems',        'ZAP',  'tech',        230,   1972],
  ['lithosystems', 'Litho Systems',      'LTH',  'semi',        900,   1984],
  ['nestly',       'Nestly',             'NST',  'consumer',    100,   1866],
  ['samsong',      'Samsong',            'SMS',  'tech',        55,    1938],
  ['broche',       'Broche',             'BRC',  'pharma',      300,   1896],
  ['murklabs',     'Murk Labs',          'MRX',  'pharma',      105,   1891],
  ['alibubba',     'Alibubba',           'BBA',  'retail',      80,    1999],
  ['maisonlux',    'Maison Lux',         'MLX',  'luxury',      720,   1987],
  ['toyoda',       'Toyoda',             'TYD',  'auto',        190,   1937],
  ['astrozenith',  'AstroZenith',        'AZN',  'pharma',      70,    1999],
  ['dmd',          "Devil's Micro",      'DMD',  'semi',        160,   1969],
  ['salesfarm',    'Salesfarm',          'SFM',  'tech',        260,   1999],
  ['frisco',       'Frisco',             'FRS',  'tech',        50,    1984],
  ['adobo',        'Adobo',              'ADB',  'tech',        520,   1982],
  ['qualcorp',     'Qualcorp',           'QLC',  'semi',        170,   1985],
  ['pipsico',      'Pipsico',            'PPS',  'consumer',    170,   1898],
  ['burgerduke',   'Burger Duke',        'BDK',  'retail',      62,    1955],
  ['clamenergy',   'Clam Energy',        'CLM',  'energy',      68,    1907],
  ['cyanmachines', 'Cyan Machines',      'CYM',  'tech',        190,   1911],
  ['hexabank',     'Hexabank',           'HXB',  'bank',        40,    1865],
  ['goldstein',    'Goldstein Sacks',    'GDS',  'bank',        470,   1869],
  ['mortimer',     'Mortimer Stanley',   'MST',  'bank',        100,   1935],
  ['yankeexpress', 'Yankee Express',     'YEX',  'fintech',     240,   1850],
  ['intron',       'Intron',             'ITN',  'semi',        35,    1968],
  ['horizontel',   'Horizon Telecom',    'HZN',  'telecom',     40,    1983],
  ['ayteetel',     'Aytee Telecom',      'ATE',  'telecom',     18,    1983],
  ['lonestar',     'Lonestar Instr.',    'LSI',  'semi',        195,   1930],
  ['lindygas',     'Lindy Gas',          'LND',  'materials',   460,   1879],
  ['unityhealth',  'UnityHealth',        'UNY',  'pharma',      520,   1977],
  ['phillipnorris','Phillip Norris',     'PMN',  'consumer',    105,   1847],
  ['wellscargo',   'Wells Cargo',        'WLC',  'bank',        60,    1852],
  ['loyalbank',    'Loyal Bank of Canada','LBC', 'bank',        120,   1864],
  ['colonialbank', 'Colonial Bank',      'CWB',  'bank',        110,   1911],
  ['siegmens',     'Siegmens',           'SGM',  'industrial',  180,   1847],
  ['mitsibushi',   'Mitsibushi Fin.',    'MFG',  'bank',        12,    1880],
  ['bravohill',    'BravoHill',          'BVH',  'materials',   58,    1885],
  ['dizzney',      'Dizzney',            'DZY',  'media',       100,   1923],
  ['zony',         'Zony',               'ZNY',  'media',       90,    1946],
  ['galahad',      'Galahad Sciences',   'GHD',  'pharma',      75,    1987],
  ['nyke',         'Nyke',               'NYK',  'consumer',    78,    1964],
  ['unibever',     'Unibever',           'UNB',  'consumer',    55,    1929],
  ['starbrucks',   'Starbrucks',         'SBR',  'retail',      95,    1971],
  ['shoppafy',     'Shoppafy',           'SHP',  'fintech',     75,    2006],
  ['paypail',      'PayPail',            'PYL',  'fintech',     65,    1998],
  ['aerobus',      'Aerobus',            'ARB',  'aerospace',   160,   1970],
  ['boyoing',      'Boyoing',            'BYG',  'aerospace',   180,   1916],
  ['caterpillow',  'Caterpillow',        'CTP',  'industrial',  340,   1925],
  ['deering',      'Deering',            'DRG',  'industrial',  400,   1837],
  ['unionpacifica','Union Pacifica',     'UPC',  'industrial',  240,   1862],
  ['blackboulder', 'Blackboulder',       'BBL',  'fintech',     800,   1988],
  ['chuckschwarb', 'Chuck Schwarb',      'CSB',  'fintech',     70,    1971],
  ['psglobal',     'P&S Global',         'PSG',  'fintech',     480,   1860],
  ['broodys',      "Broody's",           'BRD',  'fintech',     420,   1909],
  ['intwit',       'Intwit',             'ITW',  'tech',        620,   1983],
  ['servicewow',   'ServiceWow',         'SVW',  'tech',        780,   2004],
  ['omnigen',      'Omnigen',            'OMG',  'pharma',      280,   1980],
  ['phizer',       'Phizer',             'PHZ',  'pharma',      28,    1849],
  ['brimstol',     'Brimstol Squib',     'BSQ',  'pharma',      50,    1887],
  ['honeycomb',    'Honeycomb',          'HNC',  'industrial',  210,   1906],
  ['lowens',       "Lowen's",            'LWN',  'retail',      250,   1946],
  ['nexteon',      'NextEon Energy',     'NXE',  'utility',     75,    1925],
  ['rayotech',     'Rayotech',           'RYT',  'aerospace',   110,   1922],
  ['lockjaw',      'Lockjaw Martin',     'LKM',  'aerospace',   460,   1912],
  ['gxaero',       'GX Aerospace',       'GXA',  'aerospace',   170,   1892],
  ['microne',      'Microne',            'MCN',  'semi',        100,   1978],
  ['ramresearch',  'Ram Research',       'RAM',  'semi',        800,   1980],
  ['appliedmin',   'Applied Minerals',   'APM',  'semi',        200,   1967],
  ['anonalog',     'Anonalog Devices',   'ANL',  'semi',        220,   1965],
  ['limbholdings', 'Limb Holdings',      'LMB',  'semi',        130,   1990],
  ['bookit',       'Bookit',             'BKT',  'media',       3800,  1996],
  ['guber',        'Guber',              'GUB',  'fintech',     70,    2009],
  ['spottime',     'Spottime',           'SPT',  'media',       320,   2006],
  ['ferraro',      'Ferraro',            'FRO',  'luxury',      400,   1939],
  ['ramble',       'Ramble',             'RMBL', 'media',       60,    2005],
];

// Resolve compact rows into full asset defs (group 'stock'); market.js reads
// SECTOR_PROFILES + a per-id seed to fill in every other number on demand.
const STOCK_DEFS = STOCK_ROSTER.map(([id, name, ticker, sector, refPrice, founded]) => ({
  id, name, ticker, symbol: ticker, group: 'stock', sector, refPrice, founded,
}));

// The full tradeable universe (crypto + stocks) + id lookup.
const ASSET_DEFS = CRYPTO_DEFS.concat(STOCK_DEFS);
const ASSET_BY_ID = ASSET_DEFS.reduce((m, a) => { m[a.id] = a; return m; }, {});
