/* =========================================================================
 * data/properties.js — per-business purchasable properties
 * -------------------------------------------------------------------------
 * Each business will eventually have its own distinct range of real-world
 * properties you can pick from when you start it — for now only the
 * Supermarket Chain has a catalog: 4 countries x 4 cities x 6 named
 * properties = 96 properties. Each property also carries a real, hand-
 * placed lat/lon (a genuine landmark/neighborhood within its city, chosen
 * to loosely fit its fictional name/desc) — that's what js/businesses.js
 * plots as a clickable marker on the World Map for every property actually
 * owned (see mapMarkersSVG/projectLatLon). The property picked at setup
 * does change what's charged: deposits and Buy It Outright scale by the
 * property's quality tier (STORE_TIERS index, "Store 1" modest .. "Store 6"
 * flagship — see js/businesses.js propertyDepositCost), on top of the
 * business's own ordinary cost curve.
 * ========================================================================= */

const BUSINESS_PROPERTIES = {
  supermarket: {
    countries: [
      {
        id: 'uk', name: 'United Kingdom', flag: '🇬🇧',
        cities: [
          { name: 'London', properties: [
            { name: 'Riverside Market',        sqft: 2500, desc: 'Waterfront location, high street position', lat: 51.5079, lon: -0.0877 },
            { name: 'Central Hub Supermarket', sqft: 4200, desc: '2-storey, prime shopping district', lat: 51.5154, lon: -0.142 },
            { name: 'Westfield Express',       sqft: 1800, desc: 'Compact strip mall, ample parking', lat: 51.5074, lon: -0.2216 },
            { name: 'Thames Valley Store',      sqft: 6000, desc: 'Suburban, recently refurbished', lat: 51.4613, lon: -0.3037 },
            { name: 'Kensington Square Market', sqft: 3500, desc: 'Upmarket area, modern facade', lat: 51.5009, lon: -0.1925 },
            { name: 'East London Fresh',        sqft: 5500, desc: 'Basement storage, loading dock', lat: 51.5265, lon: -0.0762 },
          ] },
          { name: 'Manchester', properties: [
            { name: 'Northern Star Supermarket', sqft: 3200, desc: 'City centre, high foot traffic', lat: 53.4808, lon: -2.2374 },
            { name: 'Trafford Fresh',            sqft: 7000, desc: 'Shopping centre anchor, 2 floors', lat: 53.4668, lon: -2.3512 },
            { name: 'Market Street Deli',        sqft: 2100, desc: 'Compact, near transit hub', lat: 53.4831, lon: -2.24 },
            { name: 'Spinningfields Express',    sqft: 4800, desc: 'Historic building, period charm', lat: 53.4813, lon: -2.253 },
            { name: 'Piccadilly Plaza Store',    sqft: 5200, desc: 'Modern development, 24/7 approved', lat: 53.4802, lon: -2.235 },
            { name: 'South Manchester Depot',    sqft: 6500, desc: 'Warehouse format, bulk storage', lat: 53.3921, lon: -2.2662 },
          ] },
          { name: 'Edinburgh', properties: [
            { name: 'Royal Mile Market',      sqft: 2800, desc: 'Tourist district, high seasonal traffic', lat: 55.95, lon: -3.1871 },
            { name: 'Leith Harbour Store',     sqft: 5000, desc: 'Waterfront location, dock access', lat: 55.9756, lon: -3.1734 },
            { name: 'Princes Street Express',  sqft: 3600, desc: 'Premium shopping street, compact', lat: 55.9522, lon: -3.1959 },
            { name: 'Holyrood Fresh',          sqft: 4200, desc: 'Near parliament, institutional clientele', lat: 55.9524, lon: -3.1719 },
            { name: 'West End Supermarket',    sqft: 2400, desc: 'Residential area, parking available', lat: 55.9483, lon: -3.2137 },
            { name: 'Portobello Square',       sqft: 6800, desc: 'Converted warehouse, modern conversion', lat: 55.9539, lon: -3.1105 },
          ] },
          { name: 'Liverpool', properties: [
            { name: 'Pier Head Market',        sqft: 3100, desc: 'Waterfront, heritage site location', lat: 53.4058, lon: -2.9958 },
            { name: 'Bold Street Express',     sqft: 2600, desc: 'Bohemian quarter, independent vibe', lat: 53.4028, lon: -2.977 },
            { name: 'Albert Dock Supermarket', sqft: 5800, desc: 'Tourist destination, 2-storey', lat: 53.4003, lon: -2.9925 },
            { name: 'Sefton Park Fresh',       sqft: 4100, desc: 'Suburban residential, family area', lat: 53.3809, lon: -2.928 },
            { name: 'City Centre Hub',         sqft: 6200, desc: 'Shopping precinct, modern build', lat: 53.4034, lon: -2.9836 },
            { name: 'Wavertree Depot',         sqft: 7100, desc: 'Warehouse format, bulk wholesale', lat: 53.3944, lon: -2.9134 },
          ] },
        ],
      },
      {
        id: 'ca', name: 'Canada', flag: '🇨🇦',
        cities: [
          { name: 'Toronto', properties: [
            { name: 'Downtown Core Market',      sqft: 4500, desc: 'Financial district, high earners', lat: 43.6483, lon: -79.3813 },
            { name: 'Distillery District Fresh', sqft: 3800, desc: 'Heritage precinct, boutique', lat: 43.6503, lon: -79.3593 },
            { name: 'Yorkville Express',         sqft: 2900, desc: 'Upscale residential, compact', lat: 43.6709, lon: -79.3936 },
            { name: 'Harbourfront Store',        sqft: 6200, desc: 'Waterfront, scenic location', lat: 43.6385, lon: -79.3816 },
            { name: 'Chinatown Central',         sqft: 5100, desc: 'Diverse clientele, specialty focus', lat: 43.6529, lon: -79.3975 },
            { name: 'North York Depot',          sqft: 7600, desc: 'Warehouse, suburban logistics hub', lat: 43.7615, lon: -79.4111 },
          ] },
          { name: 'Vancouver', properties: [
            { name: 'Gastown Market',       sqft: 3200, desc: 'Historic district, tourist traffic', lat: 49.2838, lon: -123.1088 },
            { name: 'Kitsilano Fresh',      sqft: 4800, desc: 'Beachside neighbourhood, lifestyle', lat: 49.2734, lon: -123.155 },
            { name: 'Downtown Express',     sqft: 2100, desc: 'Compact, transit-oriented', lat: 49.2827, lon: -123.1207 },
            { name: 'West End Supermarket', sqft: 5500, desc: 'Residential density, modern', lat: 49.2896, lon: -123.133 },
            { name: 'Richmond Centre Store', sqft: 6800, desc: 'Shopping mall anchor, 2 floors', lat: 49.1666, lon: -123.1336 },
            { name: 'Burnaby Warehouse',    sqft: 8200, desc: 'Industrial area, high capacity', lat: 49.2488, lon: -122.9805 },
          ] },
          { name: 'Montreal', properties: [
            { name: 'Old Montreal Market',          sqft: 3600, desc: 'Historic cobblestones, tourism', lat: 45.5019, lon: -73.554 },
            { name: 'Plateau Mont-Royal Fresh',     sqft: 4200, desc: 'Artistic quarter, indie shoppers', lat: 45.5234, lon: -73.582 },
            { name: 'Downtown Express',             sqft: 2400, desc: 'Central business district, compact', lat: 45.5017, lon: -73.5673 },
            { name: 'Griffintown Store',            sqft: 6100, desc: 'Redeveloped warehouse district', lat: 45.4919, lon: -73.5657 },
            { name: 'Côte-des-Neiges Supermarket',  sqft: 5700, desc: 'Residential, family-oriented', lat: 45.4966, lon: -73.6182 },
            { name: 'Laval Depot',                  sqft: 7900, desc: 'Suburban, bulk operations', lat: 45.6066, lon: -73.7124 },
          ] },
          { name: 'Calgary', properties: [
            { name: 'Downtown Core Market',   sqft: 3900, desc: 'Business district, office workers', lat: 51.0447, lon: -114.0719 },
            { name: 'Bow River Express',      sqft: 2700, desc: 'Scenic location, riverside', lat: 51.0486, lon: -114.0708 },
            { name: 'Chinook Supermarket',    sqft: 5400, desc: 'Shopping mall anchor, major footfall', lat: 51.0086, lon: -114.0714 },
            { name: 'Bridgeland Fresh',       sqft: 4600, desc: 'New development, modern amenities', lat: 51.0534, lon: -114.0503 },
            { name: 'West Springs Store',     sqft: 3200, desc: 'Affluent suburban, upscale', lat: 51.0764, lon: -114.2244 },
            { name: 'Industrial East Depot',  sqft: 8100, desc: 'Warehouse zone, distribution hub', lat: 50.9821, lon: -113.9622 },
          ] },
        ],
      },
      {
        id: 'au', name: 'Australia', flag: '🇦🇺',
        cities: [
          { name: 'Sydney', properties: [
            { name: 'Circular Quay Market',   sqft: 4100, desc: 'Iconic harbour, tourism magnet', lat: -33.8613, lon: 151.2108 },
            { name: 'Bondi Beach Express',    sqft: 3200, desc: 'Beachfront, seasonal surges', lat: -33.8908, lon: 151.2743 },
            { name: 'Central Sydney Fresh',   sqft: 6500, desc: 'CBD, office lunch crowd', lat: -33.8688, lon: 151.2093 },
            { name: 'Newtown Supermarket',    sqft: 2800, desc: 'Bohemian precinct, diverse', lat: -33.8966, lon: 151.1793 },
            { name: 'Westfield Store',        sqft: 7200, desc: 'Shopping centre anchor, 2 floors', lat: -33.8698, lon: 151.2082 },
            { name: 'Parramatta Warehouse',   sqft: 8600, desc: 'Suburban logistics, expansion hub', lat: -33.815, lon: 151.0011 },
          ] },
          { name: 'Melbourne', properties: [
            { name: 'Queen Victoria Market',   sqft: 3700, desc: 'Heritage precinct, farmers market vibe', lat: -37.8076, lon: 144.9568 },
            { name: 'Fitzroy Fresh',           sqft: 2900, desc: 'Hipster neighbourhood, artisan focus', lat: -37.7997, lon: 144.9784 },
            { name: 'CBD Express',             sqft: 5100, desc: 'Business district, weekday volume', lat: -37.8136, lon: 144.9631 },
            { name: 'South Yarra Supermarket', sqft: 4400, desc: 'Trendy residential, premium', lat: -37.839, lon: 144.993 },
            { name: 'Chadstone Centre Store',  sqft: 7800, desc: 'Major mall, highest traffic', lat: -37.8862, lon: 145.0863 },
            { name: 'Dandenong Depot',         sqft: 9100, desc: 'Warehouse zone, wholesale operations', lat: -37.9871, lon: 145.2148 },
          ] },
          { name: 'Brisbane', properties: [
            { name: 'South Bank Market',       sqft: 3500, desc: 'Cultural precinct, pedestrian plaza', lat: -27.4748, lon: 153.0192 },
            { name: 'Paddington Express',      sqft: 2600, desc: 'Hillside village, compact footprint', lat: -27.4599, lon: 153.0064 },
            { name: 'City Centre Fresh',       sqft: 5800, desc: 'CBD, river views, office clientele', lat: -27.4698, lon: 153.0251 },
            { name: 'Fortitude Valley Store',  sqft: 4200, desc: 'Entertainment quarter, evening trade', lat: -27.456, lon: 153.035 },
            { name: 'Sunnybank Supermarket',   sqft: 6400, desc: 'Multicultural hub, specialist goods', lat: -27.5701, lon: 153.0568 },
            { name: 'Logan Warehouse',         sqft: 8800, desc: 'Industrial suburb, high capacity', lat: -27.6392, lon: 153.1088 },
          ] },
          { name: 'Perth', properties: [
            { name: 'Kings Park Market',      sqft: 3300, desc: 'Premium location, parkside views', lat: -31.9598, lon: 115.842 },
            { name: 'Fremantle Express',      sqft: 2500, desc: 'Historic port town, boutique', lat: -32.0569, lon: 115.7439 },
            { name: 'CBD Fresh',              sqft: 5600, desc: 'City centre, corporate clientele', lat: -31.9505, lon: 115.8605 },
            { name: 'Cottesloe Beach Store',  sqft: 3900, desc: 'Coastal suburb, seasonal tourism', lat: -31.9959, lon: 115.7581 },
            { name: 'Westfield Innaloo',      sqft: 7100, desc: 'Shopping mall anchor, family destination', lat: -31.8886, lon: 115.8022 },
            { name: 'Kwinana Depot',          sqft: 9200, desc: 'Industrial area, bulk wholesale, port access', lat: -32.2386, lon: 115.7749 },
          ] },
        ],
      },
      {
        id: 'jp', name: 'Japan', flag: '🇯🇵',
        cities: [
          { name: 'Tokyo', properties: [
            { name: 'Shibuya Crossing Market', sqft: 4600, desc: "World's busiest intersection, peak traffic", lat: 35.6595, lon: 139.7005 },
            { name: 'Shinjuku Express',        sqft: 3100, desc: 'Entertainment district, 24/7 approved', lat: 35.6938, lon: 139.7034 },
            { name: 'Harajuku Fresh',          sqft: 2400, desc: 'Fashion precinct, youth market', lat: 35.6702, lon: 139.7027 },
            { name: 'Ginza Luxury Store',      sqft: 5200, desc: 'Upscale shopping, premium clientele', lat: 35.6716, lon: 139.766 },
            { name: 'Ikebukuro Supermarket',   sqft: 6800, desc: 'Transport hub, commuter volume', lat: 35.7295, lon: 139.7109 },
            { name: 'Chiba Warehouse',         sqft: 9400, desc: 'Industrial logistics, regional distribution', lat: 35.6073, lon: 140.1063 },
          ] },
          { name: 'Osaka', properties: [
            { name: 'Dotonbori Market',          sqft: 3800, desc: 'Entertainment district, neon lights', lat: 34.6687, lon: 135.5013 },
            { name: 'Umeda Express',             sqft: 4100, desc: 'Shopping complex, high footfall', lat: 34.7024, lon: 135.4959 },
            { name: 'Namba Fresh',               sqft: 2700, desc: 'Historic district, compact', lat: 34.6659, lon: 135.501 },
            { name: 'Kobe Port Store',           sqft: 5900, desc: 'Waterfront, import hub access', lat: 34.6553, lon: 135.43 },
            { name: 'Osaka Castle Supermarket',  sqft: 4500, desc: 'Cultural landmark, tourism', lat: 34.6873, lon: 135.5262 },
            { name: 'Yodogawa Depot',            sqft: 8700, desc: 'Warehouse precinct, bulk operations', lat: 34.7215, lon: 135.4816 },
          ] },
          { name: 'Kyoto', properties: [
            { name: 'Arashiyama Market',     sqft: 3200, desc: 'Bamboo forest, premium tourist traffic', lat: 35.0094, lon: 135.6667 },
            { name: 'Gion Express',          sqft: 2300, desc: 'Geisha district, upscale compact', lat: 35.0037, lon: 135.7788 },
            { name: 'Central Kyoto Fresh',   sqft: 4800, desc: 'Temple precinct, cultural clientele', lat: 35.0116, lon: 135.7681 },
            { name: 'Kawaramachi Store',     sqft: 5500, desc: 'Main shopping street, anchor position', lat: 35.008, lon: 135.769 },
            { name: 'Fushimi Supermarket',   sqft: 3600, desc: 'Sake brewery area, specialty focus', lat: 34.9393, lon: 135.7625 },
            { name: 'Uji Warehouse',         sqft: 7900, desc: 'Suburban expansion, tea region', lat: 34.8842, lon: 135.7998 },
          ] },
          { name: 'Yokohama', properties: [
            { name: 'Minato Mirai Market',      sqft: 4300, desc: 'Waterfront landmark, cosmopolitan', lat: 35.456, lon: 139.6317 },
            { name: 'Chinatown Express',        sqft: 2800, desc: 'Historic precinct, specialist goods', lat: 35.4437, lon: 139.6459 },
            { name: 'Central Yokohama Fresh',   sqft: 5700, desc: 'City centre, office district', lat: 35.466, lon: 139.6222 },
            { name: 'Kamakura Outpost Store',   sqft: 3100, desc: 'Beach town satellite, seasonal', lat: 35.3193, lon: 139.5466 },
            { name: 'Ramen Alley Supermarket',  sqft: 2200, desc: 'Food tourism district, niche', lat: 35.5088, lon: 139.618 },
            { name: 'Totsuka Warehouse',        sqft: 8900, desc: 'Suburban logistics, major hub', lat: 35.399, lon: 139.5311 },
          ] },
        ],
      },
    ],
  },
};

// Every one of the 6 independent Supermarket Chain instances (see
// js/data/businesses.js SUPERMARKET_CHAIN_DEFS) shares this exact same
// catalog — same 96 properties, same countries/cities. Registering the
// SAME object reference under each chain's own id means every existing
// BUSINESS_PROPERTIES[bizId]/hasPropertyCatalog(bizId) call site keeps
// working completely unchanged for chain ids too.
for (let i = 1; i <= SUPERMARKET_CHAIN_COUNT; i++) {
  BUSINESS_PROPERTIES['supermarket_' + i] = BUSINESS_PROPERTIES.supermarket;
}

/** True if this business has a property catalog to choose from during setup. */
function hasPropertyCatalog(bizId) {
  return !!BUSINESS_PROPERTIES[bizId];
}

/** Stable id for a property within its city (used in data-setup-property and
 *  recorded on the business) — a slug of its name, unique within the city. */
function propertySlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/* =========================================================================
 * Per-property detail generator (description, stats, amenities, financials)
 * -------------------------------------------------------------------------
 * Rather than hand-authoring ~400 individual data points across 96
 * properties, each store's position in its city's list (0-5, "Store 1"
 * through "Store 6") maps to a tier in STORE_TIERS carrying the ranges/
 * amenities/condition for that tier, and CITY_TIERS gives each city a
 * prominence factor. propertyDetails() combines those with a seeded
 * pseudo-random (seeded off the property's own name, so results are
 * stable across reloads and renders) to land every number somewhere
 * sensible within its tier's range, skewed toward the top for higher-tier
 * cities and the bottom for lower-tier ones. All money is $ regardless of
 * country, matching the rest of the game.
 * ========================================================================= */

const STORE_TIERS = [
  { // Store 1 — modest start
    rentMin: 1800, rentMax: 2200, buyMin: 185000, buyMax: 265000,
    trafficMin: 400, trafficMax: 600, parkingMin: 4, parkingMax: 10,
    condition: 'Good', hours: '7am – 10pm',
    amenities: ['POS System', 'Stockroom', 'Customer Toilets'],
  },
  { // Store 2 — established
    rentMin: 2200, rentMax: 2800, buyMin: 245000, buyMax: 340000,
    trafficMin: 600, trafficMax: 800, parkingMin: 8, parkingMax: 16,
    condition: 'Good', hours: '7am – 10pm',
    amenities: ['POS System', 'Loading Dock', 'Expanded Storage', 'Customer Toilets'],
  },
  { // Store 3 — established, better run
    rentMin: 2000, rentMax: 2600, buyMin: 225000, buyMax: 310000,
    trafficMin: 800, trafficMax: 1000, parkingMin: 10, parkingMax: 20,
    condition: 'Excellent', hours: '7am – 11pm',
    amenities: ['POS System', 'Loading Dock', 'Expanded Storage', 'CCTV Security'],
  },
  { // Store 4 — maturing destination
    rentMin: 3200, rentMax: 4000, buyMin: 370000, buyMax: 480000,
    trafficMin: 1000, trafficMax: 1300, parkingMin: 20, parkingMax: 35,
    condition: 'Excellent', hours: '6am – 11pm',
    amenities: ['Modern POS & Inventory Systems', 'Loading Dock', '24/7 Operations Ready', 'Staff Break Room'],
  },
  { // Store 5 — high performer
    rentMin: 4000, rentMax: 5200, buyMin: 480000, buyMax: 620000,
    trafficMin: 1300, trafficMax: 1650, parkingMin: 30, parkingMax: 50,
    condition: 'Premium', hours: '24/7 Approved',
    amenities: ['Modern POS & Inventory Systems', 'Refrigerated Units', '24/7 Operations Ready', 'Staff Break Room'],
  },
  { // Store 6 — flagship
    rentMin: 5600, rentMax: 7200, buyMin: 650000, buyMax: 950000,
    trafficMin: 1650, trafficMax: 2000, parkingMin: 45, parkingMax: 80,
    condition: 'Premium', hours: '24/7 Approved',
    amenities: ['Basement Storage', 'Refrigerated Units', 'Premium Security Systems', '24/7 Operations Ready'],
  },
];

// A simple prominence factor per city (0.85-1.15) — nudges generated numbers
// toward the top of each store tier's range for bigger/more prominent
// cities, the bottom for smaller ones, without hardcoding every number.
const CITY_TIERS = {
  London: 1.15, Tokyo: 1.15, Sydney: 1.15, Toronto: 1.15,
  Manchester: 1.05, Osaka: 1.05, Melbourne: 1.05, Vancouver: 1.05,
  Edinburgh: 0.95, Montreal: 0.95, Brisbane: 0.95, Yokohama: 0.95,
  Liverpool: 0.85, Calgary: 0.85, Perth: 0.85, Kyoto: 0.85,
};

// Two variants per store tier (12 total) — real-estate-listing style prose:
// a hook woven around the property's own short desc tag, concrete numbers
// (sqft/traffic/parking) pulled from THIS property's own generated stats,
// and a closing line pitched at that tier's kind of buyer (fixer-upper ->
// flagship). Two variants per tier means two properties in the same tier
// don't read identically apart from their name/city — which one a given
// property gets is picked deterministically (seededFraction) in
// propertyDetails() below.
const DESC_VARIANTS = [
  [ // Store 1 — modest, budget entry point
    (p, city, s) => `A modest, no-frills entry point into the ${city} market, ${p.name} offers ${p.desc.toLowerCase()} across a compact ${s.sqft.toLocaleString()} sq ft footprint. The fit-out is basic and daily footfall — currently around ${s.dailyTraffic.toLocaleString()} visitors — is still building, but that's exactly the appeal: a low-cost foothold with real upside as the surrounding block develops. Best suited to an operator happy to put in the early groundwork.`,
    (p, city, s) => `${p.name} is a lean, budget-conscious ${s.sqft.toLocaleString()} sq ft store — ${p.desc.toLowerCase()} — that's only just finding its rhythm in ${city}. Foot traffic sits around ${s.dailyTraffic.toLocaleString()} a day for now, amenities are basic, and the condition reflects a property that hasn't seen much recent investment. It's an undervalued starting point rather than a finished product.`,
  ],
  [ // Store 2 — established, growing
    (p, city, s) => `${p.name} has settled into a dependable rhythm since opening, offering ${p.desc.toLowerCase()} across ${s.sqft.toLocaleString()} sq ft in ${city}. Daily footfall has climbed to roughly ${s.dailyTraffic.toLocaleString()} shoppers, a loading dock and expanded storage now support a fuller shelf range, and the store reads as a steady, unglamorous performer.`,
    (p, city, s) => `A step up from a bare-bones starter, ${p.name} pairs ${p.desc.toLowerCase()} with proper back-of-house facilities across ${s.sqft.toLocaleString()} sq ft. With around ${s.dailyTraffic.toLocaleString()} visitors a day and a loading dock now in place, it's a store that's clearly through its awkward early phase and into consistent, repeatable trading.`,
  ],
  [ // Store 3 — well-run, excellent condition
    (p, city, s) => `${p.name} is a well-regarded fixture of the ${city} scene, prized for ${p.desc.toLowerCase()} and kept in excellent condition throughout its ${s.sqft.toLocaleString()} sq ft. CCTV coverage and extended trading hours have helped push daily footfall past ${s.dailyTraffic.toLocaleString()}, and it now ranks among the more reliable, low-drama performers in the portfolio.`,
    (p, city, s) => `Sitting in excellent condition, ${p.name} combines ${p.desc.toLowerCase()} with a security-conscious fit-out across ${s.sqft.toLocaleString()} sq ft. Extended hours and around ${s.dailyTraffic.toLocaleString()} daily visitors make it a genuinely solid, well-run store rather than a project — the kind of location that mostly looks after itself.`,
  ],
  [ // Store 4 — maturing destination, recent investment
    (p, city, s) => `${p.name} has grown into a genuine ${city} destination, built around ${p.desc.toLowerCase()} across a substantial ${s.sqft.toLocaleString()} sq ft. Modern point-of-sale and inventory systems, near round-the-clock readiness, and a dedicated staff break room all point to real recent investment — and footfall of roughly ${s.dailyTraffic.toLocaleString()} a day backs it up.`,
    (p, city, s) => `Spanning ${s.sqft.toLocaleString()} sq ft, ${p.name} pairs ${p.desc.toLowerCase()} with a noticeably upgraded operation: modern systems, near-24-hour readiness, and space for staff to properly run shifts. It's pulling in around ${s.dailyTraffic.toLocaleString()} shoppers daily and reads as a location the chain has deliberately invested behind.`,
  ],
  [ // Store 5 — high performer, premium
    (p, city, s) => `${p.name} ranks among the strongest performers in ${city}, combining ${p.desc.toLowerCase()} with refrigerated units, 24/7 operating approval, and ${s.parking} on-site parking spaces across ${s.sqft.toLocaleString()} sq ft. Daily footfall of roughly ${s.dailyTraffic.toLocaleString()} visitors puts it firmly in the upper tier of the whole chain.`,
    (p, city, s) => `With ${p.desc.toLowerCase()} and a premium fit-out across ${s.sqft.toLocaleString()} sq ft, ${p.name} is built to run around the clock — refrigerated storage, full 24/7 approval, and ${s.parking} parking spaces all point to a serious, high-volume operation pulling in close to ${s.dailyTraffic.toLocaleString()} shoppers a day.`,
  ],
  [ // Store 6 — flagship
    (p, city, s) => `${p.name} is the flagship of the entire ${city} portfolio — ${p.desc.toLowerCase()}, basement storage, premium security, and full 24/7 trading across a commanding ${s.sqft.toLocaleString()} sq ft. With ${s.parking} parking spaces and roughly ${s.dailyTraffic.toLocaleString()} visitors passing through daily, every system here is built for sustained, high-volume trading rather than everyday convenience.`,
    (p, city, s) => `Nothing about ${p.name} is understated: ${p.desc.toLowerCase()} sits alongside basement storage, premium security systems, and true 24/7 operations across ${s.sqft.toLocaleString()} sq ft — the largest format in the ${city} lineup. At close to ${s.dailyTraffic.toLocaleString()} shoppers a day and ${s.parking} parking spaces, this is the anchor location the rest of the portfolio is built around.`,
  ],
];

function seededFraction(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(h, 31) + seed.charCodeAt(i)) >>> 0;
  h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
  return h / 4294967296;
}

function scaleInRange(min, max, cityFactor, seed) {
  const tierFrac = Math.max(0, Math.min(1, (cityFactor - 0.85) / 0.30));
  const rand = seededFraction(seed);
  const frac = Math.max(0, Math.min(1, tierFrac * 0.7 + rand * 0.3));
  return Math.round(min + frac * (max - min));
}

/** Full generated listing for one property: description, key stats,
 *  amenities, and financials. storeIndex is the property's 0-based
 *  position within its city's 6-store list ("Store 1" = index 0). */
function propertyDetails(property, cityName, storeIndex) {
  const tier = STORE_TIERS[storeIndex];
  const cityFactor = CITY_TIERS[cityName] || 1.0;
  const seed = propertySlug(property.name);

  const monthlyRent = scaleInRange(tier.rentMin, tier.rentMax, cityFactor, seed + '_rent');
  const purchasePrice = scaleInRange(tier.buyMin, tier.buyMax, cityFactor, seed + '_buy');
  const dailyTraffic = scaleInRange(tier.trafficMin, tier.trafficMax, cityFactor, seed + '_traffic');
  const parking = scaleInRange(tier.parkingMin, tier.parkingMax, cityFactor, seed + '_park');
  const annualRent = monthlyRent * 12;
  // Expected annual revenue at capacity — a flavor real-estate-style yield
  // estimate (daily footfall x an average basket x days/year), independent
  // of the game's own business income formulas.
  const avgSpend = 14 + seededFraction(seed + '_spend') * 8; // ~$14-22 average basket
  const expectedAnnualRevenue = Math.round(dailyTraffic * avgSpend * 365);
  const stats = { sqft: property.sqft, dailyTraffic, condition: tier.condition, parking, hours: tier.hours };

  const variants = DESC_VARIANTS[storeIndex];
  const variant = variants[Math.floor(seededFraction(seed + '_desc') * variants.length) % variants.length];

  return {
    description: variant(property, cityName, stats),
    stats,
    amenities: tier.amenities,
    financials: { monthlyRent, annualRent, purchasePrice, expectedAnnualRevenue },
  };
}

/* =========================================================================
 * Procedural storefront illustration (storefrontSVG)
 * -------------------------------------------------------------------------
 * A genuine "image" for every one of the 96 listings without a single
 * image FILE: a flat-design shopfront scene assembled entirely from inline
 * SVG shapes, with the property's own name rendered as its signage.
 * Every visual trait (sky, wall color, window count, door color, awning
 * style, roofline, sign shape) is picked deterministically from this one
 * property's seed, so the same property always looks the same across
 * reloads, but the combinatorics (8 sky x 10 wall x 8 awning x 6 door x 2
 * window-count x 3 roofline x 3 sign shape) comfortably cover all 96
 * without visible repeats. Costs 0 KB of asset storage — it's markup, not
 * a photo, generated at render time exactly like the World Map's gradient.
 * ========================================================================= */

const SKY_GRADIENTS = [
  ['#FDEBD3', '#F6C6A0'], ['#CDE7F0', '#A9D6E5'], ['#F4E1D2', '#E8B4B8'],
  ['#E0F4F4', '#B8E1DD'], ['#FFF3D6', '#FFD9A0'], ['#DCEEFB', '#BFDDF2'],
  ['#F7E3EE', '#E9C6DD'], ['#EAF2E3', '#CFE3C0'],
];
const WALL_COLORS = ['#E8D5B7', '#D4A373', '#B08968', '#C89F6C', '#EDC9AF', '#DDBEA9', '#A98467', '#E3C7A6', '#CBB6A3', '#D9C2A3'];
const AWNING_COLORS = ['#D64545', '#2E86AB', '#2EC4B6', '#F5A623', '#6C5CE7', '#E056FD', '#FF8C42', '#3E7C4A'];
const DOOR_COLORS = ['#4A3728', '#1D3557', '#3D405B', '#264653', '#6B2737', '#2B2118'];

function storefrontPick(list, seed) {
  return list[Math.floor(seededFraction(seed) * list.length) % list.length];
}

/** One SVG window with a frame + crossbar, at (x, y), given width/height. */
function storefrontWindow(x, y, w, h, frameColor) {
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="#CFE8EE" stroke="${frameColor}" stroke-width="3"/>
    <line x1="${x + w / 2}" y1="${y}" x2="${x + w / 2}" y2="${y + h}" stroke="${frameColor}" stroke-width="2"/>
    <line x1="${x}" y1="${y + h / 2}" x2="${x + w}" y2="${y + h / 2}" stroke="${frameColor}" stroke-width="2"/>`;
}

/** Roofline sitting on top of the main building rect (x=40..360, top y=70). */
function storefrontRoofline(style, wallColor) {
  if (style === 'stepped') return `<rect x="150" y="52" width="100" height="20" fill="${wallColor}"/>`;
  if (style === 'pediment') return `<polygon points="140,70 200,45 260,70" fill="${wallColor}"/>`;
  return `<rect x="40" y="65" width="320" height="6" fill="${wallColor}"/>`; // flat cornice line
}

/** Full illustrated shopfront scene for one property — a self-contained
 *  <svg> string (viewBox 0 0 400 280, matches the hero's aspect closely
 *  enough with preserveAspectRatio="xMidYMid slice" doing the rest). */
function storefrontSVG(property, cityName) {
  const seed = cityName + '_' + propertySlug(property.name);
  const sky = storefrontPick(SKY_GRADIENTS, seed + '_sky');
  const wallColor = storefrontPick(WALL_COLORS, seed + '_wall');
  const awningColor = storefrontPick(AWNING_COLORS, seed + '_awning');
  const doorColor = storefrontPick(DOOR_COLORS, seed + '_door');
  const roofStyle = storefrontPick(['flat', 'stepped', 'pediment'], seed + '_roof');
  const striped = seededFraction(seed + '_stripe') > 0.5;
  const windowsPerSide = 1 + Math.floor(seededFraction(seed + '_win') * 2); // 1 or 2

  const doorW = 56, doorX = 200 - doorW / 2, doorY = 150, doorH = 80;
  const winY = 96, winH = 54;
  const sideSpan = (doorX - 46) / windowsPerSide;
  let windows = '';
  for (let i = 0; i < windowsPerSide; i++) {
    const lw = 46 + i * sideSpan + (sideSpan - 40) / 2;
    windows += storefrontWindow(lw, winY, 40, winH, doorColor);
    const rx = doorX + doorW + i * sideSpan + (sideSpan - 40) / 2;
    windows += storefrontWindow(rx, winY, 40, winH, doorColor);
  }

  const awningStripes = striped
    ? [0, 1, 2, 3, 4].map((i) => `<rect x="${40 + i * 64}" y="128" width="32" height="14" fill="${i % 2 ? '#FFFFFF' : awningColor}"/>`).join('')
    : `<rect x="40" y="128" width="320" height="14" fill="${awningColor}"/>`;

  const name = property.name;
  const signW = Math.max(120, Math.min(260, 60 + name.length * 9));
  const signX = 200 - signW / 2;

  return `<svg viewBox="0 0 400 280" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeHtml(name)} storefront">
    <defs>
      <linearGradient id="sky-${seed}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${sky[0]}"/><stop offset="100%" stop-color="${sky[1]}"/>
      </linearGradient>
    </defs>
    <rect width="400" height="280" fill="url(#sky-${seed})"/>
    <rect x="0" y="226" width="400" height="54" fill="#B7B7B1"/>
    <rect x="0" y="223" width="400" height="4" fill="#94948E"/>
    ${storefrontRoofline(roofStyle, wallColor)}
    <rect x="40" y="70" width="320" height="160" fill="${wallColor}"/>
    ${windows}
    <rect x="${doorX}" y="${doorY}" width="${doorW}" height="${doorH}" rx="3" fill="${doorColor}"/>
    <circle cx="${doorX + doorW - 9}" cy="${doorY + doorH / 2}" r="2.4" fill="#F5D67B"/>
    ${awningStripes}
    <path d="M40,142 L28,164 L372,164 L360,142 Z" fill="${awningColor}" fill-opacity="0.85"/>
    <rect x="${signX}" y="92" width="${signW}" height="26" rx="5" fill="#FFFFFF" stroke="${doorColor}" stroke-width="2"/>
    <text x="200" y="109" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="800"
      font-size="13" fill="${doorColor}" textLength="${signW - 18}" lengthAdjust="spacingAndGlyphs">${escapeHtml(name)}</text>
  </svg>`;
}

function escapeHtml(v) {
  return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
