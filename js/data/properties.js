/* =========================================================================
 * data/properties.js — per-business purchasable properties
 * -------------------------------------------------------------------------
 * Each business will eventually have its own distinct range of real-world
 * properties you can pick from when you start it — for now only the
 * Supermarket Chain has a catalog: 4 countries x 4 cities x 6 property
 * tiers = 96 properties. Picking one during Start Business setup is purely
 * flavor for now (recorded on the business record, see engine.js getBiz)
 * — it doesn't change the business's real startup cost or income, which
 * stay exactly what they already are for every business.
 * ========================================================================= */

const PROPERTY_TIERS = [
  { id: 'corner',     name: 'Corner Store',        blurb: 'A small local shop on a residential corner.' },
  { id: 'highstreet', name: 'High Street Unit',     blurb: 'A storefront on the main shopping street.' },
  { id: 'retailpark', name: 'Retail Park Store',    blurb: 'A larger unit in an out-of-town retail park.' },
  { id: 'mall',       name: 'Shopping Centre Unit', blurb: 'An anchor unit inside a busy shopping centre.' },
  { id: 'flagship',   name: 'Flagship Store',       blurb: 'A large, high-visibility flagship location.' },
  { id: 'hub',        name: 'Distribution Hub',     blurb: 'A logistics hub supplying the whole region.' },
];

const BUSINESS_PROPERTIES = {
  supermarket: {
    countries: [
      { id: 'uk', name: 'United Kingdom', cities: ['London', 'Manchester', 'Edinburgh', 'Liverpool'] },
      { id: 'ca', name: 'Canada',         cities: ['Toronto', 'Vancouver', 'Montreal', 'Calgary'] },
      { id: 'au', name: 'Australia',      cities: ['Sydney', 'Melbourne', 'Brisbane', 'Perth'] },
      { id: 'jp', name: 'Japan',          cities: ['Tokyo', 'Osaka', 'Kyoto', 'Yokohama'] },
    ],
  },
};

/** True if this business has a property catalog to choose from during setup. */
function hasPropertyCatalog(bizId) {
  return !!BUSINESS_PROPERTIES[bizId];
}
