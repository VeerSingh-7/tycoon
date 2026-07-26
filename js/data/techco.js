/* =========================================================================
 * data/techco.js — Tech-sector company management: static definitions
 * -------------------------------------------------------------------------
 * The five TECH companies the player can run at 100% ownership. Each maps to
 * an existing tradeable stock (by id, so holdings/ownership carry over) and
 * carries its OWN industry, product catalog, unit metric and named AI rivals.
 *
 * This file is DATA ONLY. All economics (income scaling, product receptions,
 * ageing, cash) live in js/techco.js and scale off each company's base
 * passive income — never flat cash. Rivals/R&D data here is used from Phase 1
 * (rivals) and Phases 2–3 onward; defining it now keeps saves stable.
 *
 * Catalog rows: [name, physical] — physical products invoke Manufacturing
 * (Phase 4). Software/social catalogs are entirely non-physical.
 * ========================================================================= */

const TECHCO_DEFS = {
  // Halcyon Digital — Consumer Electronics (physical hardware throughout).
  mango: {
    id: 'mango',
    label: 'Consumer Electronics',
    tagline: 'Devices people hold in their hands.',
    metric: 'units sold',        // what a product ships
    metricShort: 'units',
    physicalDefault: true,
    catalog: [
      ['Smartphones', true], ['Laptops', true], ['Tablets', true],
      ['Smartwatches', true], ['Smart TVs', true], ['Wireless Earbuds', true],
      ['Smart Home Devices', true], ['Gaming Accessories', true],
      ['Desktops', true], ['Monitors', true],
    ],
    rivals: ['Meridian Devices', 'Auric Electronics', 'Nimbus Hardware', 'Vantage Consumer'],
    rnd: ['Custom Silicon', 'Edge-to-Edge Displays', 'All-Day Battery', 'On-Device AI'],
  },

  // Vireo Technologies — Cloud Computing & Enterprise (mixed hardware + platform).
  googol: {
    id: 'googol',
    label: 'Cloud & Enterprise',
    tagline: 'The backbone other companies run on.',
    metric: 'deployments',
    metricShort: 'deploys',
    physicalDefault: false,
    catalog: [
      ['Cloud Servers', true], ['Data Centres', true], ['AI Computing Hardware', true],
      ['Enterprise Storage', true], ['Network Equipment', true],
      ['Business Cloud Platforms', false], ['Cybersecurity Appliances', true],
      ['Server Racks', true], ['Database Platforms', false], ['Developer Platforms', false],
    ],
    rivals: ['Stratus Cloud', 'Corvus Systems', 'Helix Enterprise', 'Beacon Cloudworks'],
    rnd: ['Liquid Cooling', 'AI Accelerators', 'Zero-Trust Security', 'Global Edge Network'],
  },

  // Kestrel Software — pure Software (no manufacturing, high margins).
  macrosoft: {
    id: 'macrosoft',
    label: 'Software',
    tagline: 'Ship bits, not boxes — margins are king.',
    metric: 'licenses',
    metricShort: 'licenses',
    physicalDefault: false,
    catalog: [
      ['Office Suite', false], ['Accounting', false], ['Project Management', false],
      ['Business Management', false], ['Graphic Design', false], ['Video Editing', false],
      ['Antivirus', false], ['Operating System', false], ['Web Browser', false],
      ['Developer Tools', false],
    ],
    rivals: ['Quill Systems', 'Apex Softworks', 'Cobalt Software', 'Ledger Labs'],
    rnd: ['Next-Gen Kernel', 'Cloud Sync', 'AI Copilots', 'Cross-Platform Runtime'],
  },

  // Lumen Social — Social Media & Platforms (users/engagement + ads).
  faceblock: {
    id: 'faceblock',
    label: 'Social & Platforms',
    tagline: 'Grow the audience; the ads follow.',
    metric: 'active users',
    metricShort: 'users',
    physicalDefault: false,
    engagement: true,            // monetised by users/engagement, not units
    catalog: [
      ['Social Platform', false], ['Messaging App', false], ['Short-Form Video', false],
      ['Live Streaming', false], ['Photo Sharing', false], ['Community Forums', false],
      ['Creator Platform', false], ['Music Streaming', false], ['Podcast Platform', false],
      ['Online Marketplace', false],
    ],
    rivals: ['Vibe Networks', 'Chatter', 'Pulse Media', 'Circle Social'],
    rnd: ['Recommendation Engine', 'Creator Payouts', 'Ad Auction 2.0', 'Trust & Safety AI'],
  },

  // Cygnus Labs — AI & Robotics (R&D-heavy; robotics products are physical).
  auracle: {
    id: 'auracle',
    label: 'AI & Robotics',
    tagline: 'Frontier research that ships as product.',
    metric: 'queries',
    metricShort: 'queries',
    physicalDefault: false,
    catalog: [
      ['AI Assistants', false], ['AI Chatbots', false], ['AI Coding Tools', false],
      ['AI Image Generation', false], ['AI Video Generation', false],
      ['Robotics', true], ['Industrial Automation', true], ['Medical AI', false],
      ['Self-Driving Software', false], ['ML Platforms', false],
    ],
    rivals: ['Synthsphere AI', 'Cortex Robotics', 'Neuronix', 'Automata Labs'],
    rnd: ['Frontier Model', 'Robotic Dexterity', 'Autonomy Stack', 'AGI Alignment'],
  },
};

// Stable ordering + quick membership check for the five managed companies.
const TECHCO_IDS = ['mango', 'googol', 'macrosoft', 'faceblock', 'auracle'];
