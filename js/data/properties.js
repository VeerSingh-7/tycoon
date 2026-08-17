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
