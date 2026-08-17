/* =========================================================================
 * data/properties.js — per-business purchasable properties
 * -------------------------------------------------------------------------
 * Each business will eventually have its own distinct range of real-world
 * properties you can pick from when you start it — for now only the
 * Supermarket Chain has a catalog: 4 countries x 4 cities x 6 named
 * properties = 96 properties. Picking one during Start Business setup is
 * purely flavor for now (recorded on the business record, see engine.js
 * getBiz) — it doesn't change the business's real startup cost or income,
 * which stay exactly what they already are for every business.
 * ========================================================================= */

const BUSINESS_PROPERTIES = {
  supermarket: {
    countries: [
      {
        id: 'uk', name: 'United Kingdom', flag: '🇬🇧',
        cities: [
          { name: 'London', properties: [
            { name: 'Riverside Market',        sqft: 2500, desc: 'Waterfront location, high street position' },
            { name: 'Central Hub Supermarket', sqft: 4200, desc: '2-storey, prime shopping district' },
            { name: 'Westfield Express',       sqft: 1800, desc: 'Compact strip mall, ample parking' },
            { name: 'Thames Valley Store',      sqft: 6000, desc: 'Suburban, recently refurbished' },
            { name: 'Kensington Square Market', sqft: 3500, desc: 'Upmarket area, modern facade' },
            { name: 'East London Fresh',        sqft: 5500, desc: 'Basement storage, loading dock' },
          ] },
          { name: 'Manchester', properties: [
            { name: 'Northern Star Supermarket', sqft: 3200, desc: 'City centre, high foot traffic' },
            { name: 'Trafford Fresh',            sqft: 7000, desc: 'Shopping centre anchor, 2 floors' },
            { name: 'Market Street Deli',        sqft: 2100, desc: 'Compact, near transit hub' },
            { name: 'Spinningfields Express',    sqft: 4800, desc: 'Historic building, period charm' },
            { name: 'Piccadilly Plaza Store',    sqft: 5200, desc: 'Modern development, 24/7 approved' },
            { name: 'South Manchester Depot',    sqft: 6500, desc: 'Warehouse format, bulk storage' },
          ] },
          { name: 'Edinburgh', properties: [
            { name: 'Royal Mile Market',      sqft: 2800, desc: 'Tourist district, high seasonal traffic' },
            { name: 'Leith Harbour Store',     sqft: 5000, desc: 'Waterfront location, dock access' },
            { name: 'Princes Street Express',  sqft: 3600, desc: 'Premium shopping street, compact' },
            { name: 'Holyrood Fresh',          sqft: 4200, desc: 'Near parliament, institutional clientele' },
            { name: 'West End Supermarket',    sqft: 2400, desc: 'Residential area, parking available' },
            { name: 'Portobello Square',       sqft: 6800, desc: 'Converted warehouse, modern conversion' },
          ] },
          { name: 'Liverpool', properties: [
            { name: 'Pier Head Market',        sqft: 3100, desc: 'Waterfront, heritage site location' },
            { name: 'Bold Street Express',     sqft: 2600, desc: 'Bohemian quarter, independent vibe' },
            { name: 'Albert Dock Supermarket', sqft: 5800, desc: 'Tourist destination, 2-storey' },
            { name: 'Sefton Park Fresh',       sqft: 4100, desc: 'Suburban residential, family area' },
            { name: 'City Centre Hub',         sqft: 6200, desc: 'Shopping precinct, modern build' },
            { name: 'Wavertree Depot',         sqft: 7100, desc: 'Warehouse format, bulk wholesale' },
          ] },
        ],
      },
      {
        id: 'ca', name: 'Canada', flag: '🇨🇦',
        cities: [
          { name: 'Toronto', properties: [
            { name: 'Downtown Core Market',      sqft: 4500, desc: 'Financial district, high earners' },
            { name: 'Distillery District Fresh', sqft: 3800, desc: 'Heritage precinct, boutique' },
            { name: 'Yorkville Express',         sqft: 2900, desc: 'Upscale residential, compact' },
            { name: 'Harbourfront Store',        sqft: 6200, desc: 'Waterfront, scenic location' },
            { name: 'Chinatown Central',         sqft: 5100, desc: 'Diverse clientele, specialty focus' },
            { name: 'North York Depot',          sqft: 7600, desc: 'Warehouse, suburban logistics hub' },
          ] },
          { name: 'Vancouver', properties: [
            { name: 'Gastown Market',       sqft: 3200, desc: 'Historic district, tourist traffic' },
            { name: 'Kitsilano Fresh',      sqft: 4800, desc: 'Beachside neighbourhood, lifestyle' },
            { name: 'Downtown Express',     sqft: 2100, desc: 'Compact, transit-oriented' },
            { name: 'West End Supermarket', sqft: 5500, desc: 'Residential density, modern' },
            { name: 'Richmond Centre Store', sqft: 6800, desc: 'Shopping mall anchor, 2 floors' },
            { name: 'Burnaby Warehouse',    sqft: 8200, desc: 'Industrial area, high capacity' },
          ] },
          { name: 'Montreal', properties: [
            { name: 'Old Montreal Market',          sqft: 3600, desc: 'Historic cobblestones, tourism' },
            { name: 'Plateau Mont-Royal Fresh',     sqft: 4200, desc: 'Artistic quarter, indie shoppers' },
            { name: 'Downtown Express',             sqft: 2400, desc: 'Central business district, compact' },
            { name: 'Griffintown Store',            sqft: 6100, desc: 'Redeveloped warehouse district' },
            { name: 'Côte-des-Neiges Supermarket',  sqft: 5700, desc: 'Residential, family-oriented' },
            { name: 'Laval Depot',                  sqft: 7900, desc: 'Suburban, bulk operations' },
          ] },
          { name: 'Calgary', properties: [
            { name: 'Downtown Core Market',   sqft: 3900, desc: 'Business district, office workers' },
            { name: 'Bow River Express',      sqft: 2700, desc: 'Scenic location, riverside' },
            { name: 'Chinook Supermarket',    sqft: 5400, desc: 'Shopping mall anchor, major footfall' },
            { name: 'Bridgeland Fresh',       sqft: 4600, desc: 'New development, modern amenities' },
            { name: 'West Springs Store',     sqft: 3200, desc: 'Affluent suburban, upscale' },
            { name: 'Industrial East Depot',  sqft: 8100, desc: 'Warehouse zone, distribution hub' },
          ] },
        ],
      },
      {
        id: 'au', name: 'Australia', flag: '🇦🇺',
        cities: [
          { name: 'Sydney', properties: [
            { name: 'Circular Quay Market',   sqft: 4100, desc: 'Iconic harbour, tourism magnet' },
            { name: 'Bondi Beach Express',    sqft: 3200, desc: 'Beachfront, seasonal surges' },
            { name: 'Central Sydney Fresh',   sqft: 6500, desc: 'CBD, office lunch crowd' },
            { name: 'Newtown Supermarket',    sqft: 2800, desc: 'Bohemian precinct, diverse' },
            { name: 'Westfield Store',        sqft: 7200, desc: 'Shopping centre anchor, 2 floors' },
            { name: 'Parramatta Warehouse',   sqft: 8600, desc: 'Suburban logistics, expansion hub' },
          ] },
          { name: 'Melbourne', properties: [
            { name: 'Queen Victoria Market',   sqft: 3700, desc: 'Heritage precinct, farmers market vibe' },
            { name: 'Fitzroy Fresh',           sqft: 2900, desc: 'Hipster neighbourhood, artisan focus' },
            { name: 'CBD Express',             sqft: 5100, desc: 'Business district, weekday volume' },
            { name: 'South Yarra Supermarket', sqft: 4400, desc: 'Trendy residential, premium' },
            { name: 'Chadstone Centre Store',  sqft: 7800, desc: 'Major mall, highest traffic' },
            { name: 'Dandenong Depot',         sqft: 9100, desc: 'Warehouse zone, wholesale operations' },
          ] },
          { name: 'Brisbane', properties: [
            { name: 'South Bank Market',       sqft: 3500, desc: 'Cultural precinct, pedestrian plaza' },
            { name: 'Paddington Express',      sqft: 2600, desc: 'Hillside village, compact footprint' },
            { name: 'City Centre Fresh',       sqft: 5800, desc: 'CBD, river views, office clientele' },
            { name: 'Fortitude Valley Store',  sqft: 4200, desc: 'Entertainment quarter, evening trade' },
            { name: 'Sunnybank Supermarket',   sqft: 6400, desc: 'Multicultural hub, specialist goods' },
            { name: 'Logan Warehouse',         sqft: 8800, desc: 'Industrial suburb, high capacity' },
          ] },
          { name: 'Perth', properties: [
            { name: 'Kings Park Market',      sqft: 3300, desc: 'Premium location, parkside views' },
            { name: 'Fremantle Express',      sqft: 2500, desc: 'Historic port town, boutique' },
            { name: 'CBD Fresh',              sqft: 5600, desc: 'City centre, corporate clientele' },
            { name: 'Cottesloe Beach Store',  sqft: 3900, desc: 'Coastal suburb, seasonal tourism' },
            { name: 'Westfield Innaloo',      sqft: 7100, desc: 'Shopping mall anchor, family destination' },
            { name: 'Kwinana Depot',          sqft: 9200, desc: 'Industrial area, bulk wholesale, port access' },
          ] },
        ],
      },
      {
        id: 'jp', name: 'Japan', flag: '🇯🇵',
        cities: [
          { name: 'Tokyo', properties: [
            { name: 'Shibuya Crossing Market', sqft: 4600, desc: "World's busiest intersection, peak traffic" },
            { name: 'Shinjuku Express',        sqft: 3100, desc: 'Entertainment district, 24/7 approved' },
            { name: 'Harajuku Fresh',          sqft: 2400, desc: 'Fashion precinct, youth market' },
            { name: 'Ginza Luxury Store',      sqft: 5200, desc: 'Upscale shopping, premium clientele' },
            { name: 'Ikebukuro Supermarket',   sqft: 6800, desc: 'Transport hub, commuter volume' },
            { name: 'Chiba Warehouse',         sqft: 9400, desc: 'Industrial logistics, regional distribution' },
          ] },
          { name: 'Osaka', properties: [
            { name: 'Dotonbori Market',          sqft: 3800, desc: 'Entertainment district, neon lights' },
            { name: 'Umeda Express',             sqft: 4100, desc: 'Shopping complex, high footfall' },
            { name: 'Namba Fresh',               sqft: 2700, desc: 'Historic district, compact' },
            { name: 'Kobe Port Store',           sqft: 5900, desc: 'Waterfront, import hub access' },
            { name: 'Osaka Castle Supermarket',  sqft: 4500, desc: 'Cultural landmark, tourism' },
            { name: 'Yodogawa Depot',            sqft: 8700, desc: 'Warehouse precinct, bulk operations' },
          ] },
          { name: 'Kyoto', properties: [
            { name: 'Arashiyama Market',     sqft: 3200, desc: 'Bamboo forest, premium tourist traffic' },
            { name: 'Gion Express',          sqft: 2300, desc: 'Geisha district, upscale compact' },
            { name: 'Central Kyoto Fresh',   sqft: 4800, desc: 'Temple precinct, cultural clientele' },
            { name: 'Kawaramachi Store',     sqft: 5500, desc: 'Main shopping street, anchor position' },
            { name: 'Fushimi Supermarket',   sqft: 3600, desc: 'Sake brewery area, specialty focus' },
            { name: 'Uji Warehouse',         sqft: 7900, desc: 'Suburban expansion, tea region' },
          ] },
          { name: 'Yokohama', properties: [
            { name: 'Minato Mirai Market',      sqft: 4300, desc: 'Waterfront landmark, cosmopolitan' },
            { name: 'Chinatown Express',        sqft: 2800, desc: 'Historic precinct, specialist goods' },
            { name: 'Central Yokohama Fresh',   sqft: 5700, desc: 'City centre, office district' },
            { name: 'Kamakura Outpost Store',   sqft: 3100, desc: 'Beach town satellite, seasonal' },
            { name: 'Ramen Alley Supermarket',  sqft: 2200, desc: 'Food tourism district, niche' },
            { name: 'Totsuka Warehouse',        sqft: 8900, desc: 'Suburban logistics, major hub' },
          ] },
        ],
      },
    ],
  },
};

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

// One template per store tier — 2 sentences, increasing in sophistication
// from "modest start" (tier 0) to "flagship" (tier 5), weaving in each
// property's own short desc tag.
const DESC_TEMPLATES = [
  (p, city) => `${p.name} is a modest entry point into the ${city} market, with ${p.desc.toLowerCase()}. It's finding its footing with steady local demand, and there's clear room to grow as the surrounding area develops.`,
  (p, city) => `${p.name} has built a loyal local following since opening, offering ${p.desc.toLowerCase()}. Foot traffic has grown steadily, and the store now runs as a dependable part of the ${city} network.`,
  (p, city) => `${p.name} is a well-regarded fixture in ${city}, known for ${p.desc.toLowerCase()}. Its excellent condition and improving footfall make it one of the more reliable performers in the portfolio.`,
  (p, city) => `${p.name} has grown into a genuine ${city} destination, benefiting from ${p.desc.toLowerCase()}. Recent investment in the fit-out and operating hours has lifted both revenue and reputation.`,
  (p, city) => `${p.name} ranks among the strongest performers in ${city}, combining ${p.desc.toLowerCase()} with premium fittings and extended hours. It's a genuine anchor location for the chain.`,
  (p, city) => `${p.name} is the flagship of the ${city} portfolio, defined by ${p.desc.toLowerCase()}. Every system, from refrigeration to security, is built for round-the-clock, high-volume trading.`,
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

  return {
    description: DESC_TEMPLATES[storeIndex](property, cityName),
    stats: { sqft: property.sqft, dailyTraffic, condition: tier.condition, parking, hours: tier.hours },
    amenities: tier.amenities,
    financials: { monthlyRent, annualRent, purchasePrice, expectedAnnualRevenue },
  };
}
