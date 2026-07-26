/* =========================================================================
 * data/bizdefs.js — Management profiles for EVERY stock (all 16 sectors)
 * -------------------------------------------------------------------------
 * The tech-company management system (dashboard, products, staff, research,
 * market, more) is generalised to every tradeable STOCK. Each sector has a
 * "kit": a tailored product catalogue, a spec archetype, a research tree, an
 * unlockable flagship, a unit metric and a pool of rival names. Every company
 * then gets its own 4 rivals drawn deterministically from its sector pool, so
 * competition is tailored per company. A handful of companies with a distinct
 * product line (beverages, athletics, mining, defence …) get bespoke catalogs.
 *
 * This file runs AFTER data/stocks.js, data/techco.js and data/techspecs.js:
 * it adds new spec archetypes, extends TECHCO_DEFS with a profile for each
 * stock, extends TECH_PRODUCT_ARCHETYPE, and grows TECHCO_IDS. The five hand-
 * crafted tech companies are left untouched.
 * ========================================================================= */

/* ------------------- Spec archetypes for the new sectors ------------------ */
// Format mirrors data/techspecs.js: specs [id,label,[[opt,quality,cost],…]].
// `margin` overrides the focus-based product margin; `focus` weights the team.
Object.assign(TECH_ARCHETYPES, {
  semiconductor: {
    category: 'Semiconductors', unit: 'chips', basePrice: 420, focus: 'hardware', margin: 0.35,
    specs: [
      ['node', 'Process Node', [['7 nm', 1, 1], ['3 nm', 2, 2], ['2 nm', 3, 3.5]]],
      ['arch', 'Architecture', [['Standard', 1, 1], ['Advanced', 2, 2], ['Custom', 3, 3]]],
      ['yield', 'Yield', [['Baseline', 1, 1], ['High', 2, 1.5], ['Best-in-class', 3, 2.5]]],
      ['power', 'Efficiency', [['Standard', 1, 1], ['Low-power', 2, 2], ['Ultra-efficient', 3, 3]]],
    ],
  },
  auto: {
    category: 'Automotive', unit: 'vehicles', basePrice: 46000, focus: 'hardware', margin: 0.18,
    specs: [
      ['drive', 'Powertrain', [['Hybrid', 1, 1], ['Electric', 2, 2], ['Performance EV', 3, 3.5]]],
      ['range', 'Range', [['Standard', 1, 1], ['Long', 2, 2], ['Extended', 3, 3]]],
      ['auto', 'Autonomy', [['Assisted', 1, 1], ['Advanced', 2, 2], ['Self-driving', 3, 3.5]]],
      ['interior', 'Interior', [['Standard', 1, 1], ['Premium', 2, 2], ['Luxury', 3, 3]]],
    ],
  },
  fintech: {
    category: 'Fintech', unit: 'accounts', basePrice: 45, focus: 'software', margin: 0.55,
    specs: [
      ['ux', 'Experience', [['Functional', 1, 1], ['Polished', 2, 2], ['Best-in-class', 3, 3]]],
      ['fees', 'Fees', [['Standard', 1, 1], ['Low', 2, 2], ['Zero-fee', 3, 3]]],
      ['speed', 'Speed', [['Next-day', 1, 1], ['Same-day', 2, 2], ['Instant', 3, 2.5]]],
      ['sec', 'Security', [['Standard', 1, 1], ['Advanced', 2, 2], ['Bank-grade', 3, 3]]],
    ],
  },
  banking: {
    category: 'Banking', unit: 'accounts', basePrice: 600, focus: 'software', margin: 0.55,
    specs: [
      ['rate', 'Rates', [['Standard', 1, 1], ['Competitive', 2, 2], ['Market-leading', 3, 3]]],
      ['fees', 'Fees', [['Standard', 1, 1], ['Low', 2, 2], ['No fees', 3, 2.5]]],
      ['digital', 'Digital', [['Branch-first', 1, 1], ['Online', 2, 2], ['App-first', 3, 3]]],
      ['advisory', 'Advisory', [['Basic', 1, 1], ['Dedicated', 2, 2], ['Private banking', 3, 3]]],
    ],
  },
  pharma: {
    category: 'Pharmaceuticals', unit: 'prescriptions', basePrice: 320, focus: 'software', margin: 0.7,
    specs: [
      ['efficacy', 'Efficacy', [['Effective', 1, 1], ['High', 2, 2], ['Breakthrough', 3, 3.5]]],
      ['safety', 'Safety', [['Standard', 1, 1], ['Strong', 2, 2], ['Best-in-class', 3, 3]]],
      ['trials', 'Trials', [['Regional', 1, 1], ['Multi-centre', 2, 2], ['Global Phase III', 3, 3.5]]],
      ['delivery', 'Delivery', [['Tablet', 1, 1], ['Injectable', 2, 1.5], ['Long-acting', 3, 2.5]]],
    ],
  },
  energy: {
    category: 'Energy', unit: 'barrels', basePrice: 90, focus: 'hardware', margin: 0.25,
    specs: [
      ['extract', 'Extraction', [['Conventional', 1, 1], ['Advanced', 2, 2], ['Deepwater/Shale', 3, 3]]],
      ['eff', 'Efficiency', [['Standard', 1, 1], ['Optimised', 2, 2], ['Best-in-class', 3, 2.5]]],
      ['clean', 'Emissions', [['Standard', 1, 1], ['Lower-carbon', 2, 2], ['Carbon-captured', 3, 3]]],
      ['scale', 'Scale', [['Regional', 1, 1], ['National', 2, 2], ['Global', 3, 3]]],
    ],
  },
  telecom: {
    category: 'Telecom', unit: 'subscribers', basePrice: 55, focus: 'software', margin: 0.45,
    specs: [
      ['coverage', 'Coverage', [['Urban', 1, 1], ['National', 2, 2], ['Nationwide+', 3, 3]]],
      ['speed', 'Speed', [['4G', 1, 1], ['5G', 2, 2], ['5G+ / Fibre', 3, 3]]],
      ['reliab', 'Reliability', [['Standard', 1, 1], ['High', 2, 2], ['Carrier-grade', 3, 3]]],
      ['price', 'Pricing', [['Standard', 1, 1], ['Value', 2, 2], ['Unlimited', 3, 2.5]]],
    ],
  },
  industrial: {
    category: 'Industrials', unit: 'units', basePrice: 9000, focus: 'hardware', margin: 0.28,
    specs: [
      ['power', 'Power', [['Standard', 1, 1], ['High-output', 2, 2], ['Heavy-duty', 3, 3]]],
      ['precision', 'Precision', [['Standard', 1, 1], ['Fine', 2, 2], ['Ultra-precise', 3, 3]]],
      ['durab', 'Durability', [['Standard', 1, 1], ['Rugged', 2, 2], ['Industrial-grade', 3, 3]]],
      ['auto', 'Automation', [['Manual', 1, 1], ['Semi-auto', 2, 2], ['Fully automated', 3, 3.5]]],
    ],
  },
  utility: {
    category: 'Utilities', unit: 'connections', basePrice: 130, focus: 'hardware', margin: 0.22,
    specs: [
      ['reliab', 'Reliability', [['Standard', 1, 1], ['High', 2, 2], ['Resilient grid', 3, 3]]],
      ['clean', 'Sustainability', [['Fossil', 1, 1], ['Mixed', 2, 2], ['Renewable', 3, 3.5]]],
      ['grid', 'Grid Tech', [['Legacy', 1, 1], ['Smart meters', 2, 2], ['Smart grid', 3, 3]]],
      ['price', 'Pricing', [['Standard', 1, 1], ['Competitive', 2, 1.5], ['Low-cost', 3, 2.5]]],
    ],
  },
  retail: {
    category: 'Retail', unit: 'sales', basePrice: 60, focus: 'software', margin: 0.22,
    specs: [
      ['select', 'Selection', [['Curated', 1, 1], ['Wide', 2, 2], ['Everything', 3, 3]]],
      ['price', 'Pricing', [['Standard', 1, 1], ['Value', 2, 2], ['Lowest', 3, 2.5]]],
      ['exp', 'Experience', [['Basic', 1, 1], ['Polished', 2, 2], ['Seamless omnichannel', 3, 3]]],
      ['chain', 'Supply Chain', [['Standard', 1, 1], ['Fast', 2, 2], ['Same-day', 3, 3]]],
    ],
  },
  consumer: {
    category: 'Consumer Goods', unit: 'units', basePrice: 14, focus: 'hardware', margin: 0.4,
    specs: [
      ['quality', 'Quality', [['Standard', 1, 1], ['Premium', 2, 2], ['Best-in-class', 3, 3]]],
      ['brand', 'Brand', [['Value', 1, 1], ['Trusted', 2, 2], ['Iconic', 3, 3]]],
      ['pack', 'Packaging', [['Basic', 1, 1], ['Refined', 2, 1.5], ['Sustainable premium', 3, 2.5]]],
      ['dist', 'Distribution', [['Regional', 1, 1], ['National', 2, 2], ['Global', 3, 3]]],
    ],
  },
  media: {
    category: 'Media', unit: 'subscribers', basePrice: 16, focus: 'social', margin: 0.55,
    specs: [
      ['content', 'Content', [['Solid', 1, 1], ['Strong', 2, 2], ['Must-watch', 3, 3.5]]],
      ['talent', 'Star Power', [['Emerging', 1, 1], ['Established', 2, 2], ['A-list', 3, 3]]],
      ['prod', 'Production', [['Standard', 1, 1], ['High-end', 2, 2], ['Blockbuster', 3, 3.5]]],
      ['reach', 'Reach', [['Regional', 1, 1], ['National', 2, 2], ['Global', 3, 3]]],
    ],
  },
  luxury: {
    category: 'Luxury', unit: 'units', basePrice: 6000, focus: 'hardware', margin: 0.65,
    specs: [
      ['craft', 'Craftsmanship', [['Fine', 1, 1], ['Master', 2, 2], ['Atelier', 3, 3.5]]],
      ['mat', 'Materials', [['Premium', 1, 1], ['Rare', 2, 2], ['Finest', 3, 3.5]]],
      ['design', 'Design', [['Classic', 1, 1], ['Signature', 2, 2], ['Iconic', 3, 3]]],
      ['excl', 'Exclusivity', [['Limited', 1, 1], ['Rare', 2, 2], ['One-of-a-kind', 3, 3]]],
    ],
  },
  aerospace: {
    category: 'Aerospace & Defence', unit: 'units', basePrice: 60000000, focus: 'hardware', margin: 0.22,
    specs: [
      ['perf', 'Performance', [['Standard', 1, 1], ['High', 2, 2], ['Cutting-edge', 3, 3.5]]],
      ['range', 'Range', [['Short-haul', 1, 1], ['Long-haul', 2, 2], ['Ultra-long', 3, 3]]],
      ['avionics', 'Avionics', [['Standard', 1, 1], ['Advanced', 2, 2], ['Next-gen', 3, 3]]],
      ['reliab', 'Reliability', [['Certified', 1, 1], ['Proven', 2, 2], ['Flawless', 3, 3]]],
    ],
  },
  materials: {
    category: 'Materials', unit: 'tonnes', basePrice: 900, focus: 'hardware', margin: 0.2,
    specs: [
      ['purity', 'Purity / Grade', [['Standard', 1, 1], ['High', 2, 2], ['Ultra-pure', 3, 3]]],
      ['extract', 'Extraction', [['Conventional', 1, 1], ['Advanced', 2, 2], ['Automated', 3, 3]]],
      ['scale', 'Scale', [['Regional', 1, 1], ['National', 2, 2], ['Global', 3, 3]]],
      ['sustain', 'Sustainability', [['Standard', 1, 1], ['Cleaner', 2, 1.5], ['Carbon-neutral', 3, 3]]],
    ],
  },
});

/* ------------------------------ Sector kits ------------------------------- */
const SECTOR_DISPLAY = {
  tech: 'Technology', semi: 'Semiconductors', bank: 'Banking', fintech: 'Fintech',
  pharma: 'Pharmaceuticals', energy: 'Energy', retail: 'Retail', auto: 'Automotive',
  aerospace: 'Aerospace & Defence', industrial: 'Industrials', telecom: 'Telecom',
  media: 'Media', utility: 'Utilities', materials: 'Materials',
  consumer: 'Consumer Goods', luxury: 'Luxury',
};

const SECTOR_KITS = {
  tech: { // non-crafted tech (consumer electronics) — reuses tech archetypes
    metric: 'units', metricShort: 'units', physicalDefault: true, archetype: 'mobile',
    tagline: 'Devices and gadgets people love.',
    catalog: [['Smartphones', true], ['Laptops', true], ['Tablets', true], ['Smartwatches', true],
      ['Smart TVs', true], ['Wireless Earbuds', true], ['Monitors', true], ['Desktops', true]],
    research: ['Custom Silicon', 'Edge-to-Edge Displays', 'All-Day Battery', 'Foldable Displays', 'On-Device AI'],
    unlockProduct: ['Foldable Phones', true],
    rivalPool: ['Nimbus Devices', 'Apex Electronics', 'Meridian Tech', 'Cobalt Devices', 'Vertex Electronics', 'Nova Devices', 'Prism Tech', 'Summit Electronics', 'Helix Devices', 'Aurora Tech'],
  },
  semi: {
    metric: 'chips', metricShort: 'chips', physicalDefault: true, archetype: 'semiconductor',
    tagline: 'The silicon everything runs on.',
    catalog: [['CPUs', true], ['GPUs', true], ['Memory Chips', true], ['Storage Controllers', true],
      ['Mobile SoCs', true], ['AI Accelerators', true], ['Network Chips', true], ['Power ICs', true]],
    research: ['Smaller Node', '3D Stacking', 'Chiplet Design', 'Photonic I/O', 'Quantum-Ready Process'],
    unlockProduct: ['Neuromorphic Chips', true],
    rivalPool: ['Nexus Silicon', 'Volt Micro', 'Cinder Semiconductors', 'Arcadia Chips', 'Titan Logic', 'Pileus Micro', 'Halon Semi', 'Zephyr Silicon', 'Cobalt Micro', 'Draco Semiconductors'],
  },
  retail: {
    metric: 'sales', metricShort: 'sales', physicalDefault: false, archetype: 'retail',
    tagline: 'Where everyone shops.',
    catalog: [['Grocery', false], ['Apparel', false], ['Electronics Retail', false], ['Home Goods', false],
      ['Online Marketplace', false], ['Membership Club', false], ['Private Label', false], ['Fast Delivery', false]],
    research: ['Supply-Chain AI', 'Same-Day Delivery', 'Checkout-Free Stores', 'Loyalty Engine', 'Global Sourcing'],
    unlockProduct: ['Autonomous Stores', false],
    rivalPool: ['MarketPoint', 'Everly Retail', 'ValueMart', 'Gantry Goods', 'Harbor Stores', 'Peak Retail', 'Crestmart', 'Junction Retail', 'Nimbus Goods', 'Orchard Retail'],
  },
  auto: {
    metric: 'vehicles', metricShort: 'vehicles', physicalDefault: true, archetype: 'auto',
    tagline: 'Moving the world forward.',
    catalog: [['EV Sedan', true], ['EV SUV', true], ['Electric Truck', true], ['Sports Car', true],
      ['Compact EV', true], ['Autonomous Driving', false], ['Battery Packs', true], ['Charging Network', true]],
    research: ['Solid-State Battery', 'Full Self-Driving', '800V Architecture', 'In-House Batteries', 'Robotaxi'],
    unlockProduct: ['Robotaxi Fleet', false],
    rivalPool: ['Velocitas Motors', 'Ironclad Auto', 'Apex Vehicles', 'Terra Motors', 'Vantage Auto', 'Cobalt Cars', 'Meridian Motors', 'Solace Auto', 'Drift Motors', 'Nova Motors'],
  },
  fintech: {
    metric: 'accounts', metricShort: 'accounts', physicalDefault: false, archetype: 'fintech',
    tagline: 'Money, reinvented.',
    catalog: [['Payment App', false], ['Digital Wallet', false], ['POS Systems', false], ['Buy Now, Pay Later', false],
      ['Money Transfer', false], ['Card Issuing', false], ['Merchant Platform', false], ['Neobank', false]],
    research: ['Real-Time Rails', 'Fraud AI', 'Open Banking', 'Embedded Finance', 'Stablecoin Rails'],
    unlockProduct: ['Super App', false],
    rivalPool: ['PayNova', 'Swift Pay', 'Ledgerly', 'Fluxpay', 'Cobalt Finance', 'Tapstream', 'Verto Pay', 'Nimbus Pay', 'Arc Financial', 'Zenith Pay'],
  },
  bank: {
    metric: 'accounts', metricShort: 'accounts', physicalDefault: false, archetype: 'banking',
    tagline: 'Trusted with the world’s money.',
    catalog: [['Checking Accounts', false], ['Savings Accounts', false], ['Mortgages', false], ['Credit Cards', false],
      ['Personal Loans', false], ['Business Loans', false], ['Wealth Management', false], ['Investment Banking', false]],
    research: ['Digital Banking', 'AI Underwriting', 'Fraud Shield', 'Robo-Advisor', 'Instant Payments'],
    unlockProduct: ['Private Banking', false],
    rivalPool: ['Sterling Trust', 'Crown Financial', 'Hallmark Bank', 'Pinnacle Bank', 'Meridian Trust', 'Ironbank', 'Regent Financial', 'Ashfield Bank', 'Cobalt Bank', 'Harbor Trust'],
  },
  pharma: {
    metric: 'prescriptions', metricShort: 'scripts', physicalDefault: false, archetype: 'pharma',
    tagline: 'Science that heals.',
    catalog: [['Cardio Drug', false], ['Oncology Drug', false], ['Diabetes Treatment', false], ['Vaccine', false],
      ['Immunology Drug', false], ['Neurology Drug', false], ['Rare Disease Drug', false], ['Generics', false]],
    research: ['Phase III Trials', 'mRNA Platform', 'Gene Therapy', 'AI Drug Discovery', 'Biologics Scale-Up'],
    unlockProduct: ['Gene Therapy Line', false],
    rivalPool: ['Novara Bio', 'Helix Pharma', 'Caldera Therapeutics', 'Aster Pharma', 'Corvus Pharma', 'Zenith Bio', 'Pallium Labs', 'Meridian Bio', 'Ardent Health', 'Lumen Bio'],
  },
  consumer: {
    metric: 'units', metricShort: 'units', physicalDefault: true, archetype: 'consumer',
    tagline: 'Brands in every home.',
    catalog: [['Flagship Brand', true], ['Value Line', true], ['Premium Line', true], ['New Launch', true],
      ['Seasonal Range', true], ['Health Line', true], ['Bulk Range', true], ['DTC Line', true]],
    research: ['Brand Refresh', 'Health Reformulation', 'Sustainable Packaging', 'DTC Channel', 'Global Expansion'],
    unlockProduct: ['Super-Premium Line', true],
    rivalPool: ['Everbrand', 'Vista Goods', 'Cordial Brands', 'Summit Consumer', 'Meadow Foods', 'Pinnacle Brands', 'Aurora Goods', 'Crest Brands', 'Nova Consumer', 'Harbor Brands'],
  },
  energy: {
    metric: 'barrels', metricShort: 'barrels', physicalDefault: true, archetype: 'energy',
    tagline: 'Powering the economy.',
    catalog: [['Crude Oil', true], ['Natural Gas', true], ['Refining', true], ['Petrochemicals', true],
      ['Offshore Drilling', true], ['LNG', true], ['Pipelines', true], ['Renewables', true]],
    research: ['Deepwater Drilling', 'Carbon Capture', 'LNG Export', 'Shale Tech', 'Green Hydrogen'],
    unlockProduct: ['Hydrogen Plants', true],
    rivalPool: ['Helios Energy', 'Apex Petroleum', 'Vanguard Energy', 'Terra Energy', 'Cobalt Oil', 'Summit Petroleum', 'Pioneer Fuels', 'Nova Energy', 'Draco Petroleum', 'Meridian Oil'],
  },
  media: {
    metric: 'subscribers', metricShort: 'subs', physicalDefault: false, archetype: 'media',
    tagline: 'Stories the world watches.',
    catalog: [['Streaming Service', false], ['Original Series', false], ['Films', false], ['TV Network', false],
      ['Documentaries', false], ['Kids Content', false], ['Live Events', false], ['Ad Tier', false]],
    research: ['Recommendation AI', 'Original Franchise', 'Global Localization', 'Ad-Supported Tier', 'Interactive Content'],
    unlockProduct: ['Blockbuster Franchise', false],
    rivalPool: ['Vista Media', 'Apex Studios', 'Nova Networks', 'Meridian Media', 'Crown Studios', 'Prism Media', 'Aurora Films', 'Cobalt Entertainment', 'Summit Media', 'Radiant Studios'],
  },
  luxury: {
    metric: 'units', metricShort: 'units', physicalDefault: true, archetype: 'luxury',
    tagline: 'The art of the exceptional.',
    catalog: [['Handbags', true], ['Ready-to-Wear', true], ['Watches', true], ['Jewellery', true],
      ['Fragrances', true], ['Eyewear', true], ['Leather Goods', true], ['Footwear', true]],
    research: ['Master Artisans', 'Signature Line', 'Flagship Boutiques', 'Sustainable Luxury', 'Bespoke Program'],
    unlockProduct: ['One-of-One Collection', true],
    rivalPool: ['Lumière', 'Adorné', 'Régal', 'Vellamo', 'Castellane', 'Aurelle', 'Montclair', 'Séraphin', 'Valcour', 'Dorée'],
  },
  telecom: {
    metric: 'subscribers', metricShort: 'subs', physicalDefault: false, archetype: 'telecom',
    tagline: 'Keeping the world connected.',
    catalog: [['5G Network', false], ['Broadband', false], ['Mobile Plans', false], ['Fibre Internet', false],
      ['Enterprise Connectivity', false], ['IoT Network', false], ['TV Bundles', false], ['Roaming', false]],
    research: ['5G Standalone', 'Fibre Rollout', 'Network Slicing', '6G Research', 'Satellite Backhaul'],
    unlockProduct: ['Satellite Internet', false],
    rivalPool: ['Vertex Telecom', 'Nimbus Networks', 'Apex Comms', 'Meridian Mobile', 'Cobalt Telecom', 'Summit Wireless', 'Nova Comms', 'Harbor Networks', 'Prism Telecom', 'Radiant Wireless'],
  },
  industrial: {
    metric: 'units', metricShort: 'units', physicalDefault: true, archetype: 'industrial',
    tagline: 'The machines that build everything.',
    catalog: [['Turbines', true], ['Factory Automation', true], ['Heavy Machinery', true], ['Industrial Robots', true],
      ['Power Generators', true], ['Rail Systems', true], ['HVAC Systems', true], ['Motors & Drives', true]],
    research: ['Predictive Maintenance', 'Industrial IoT', 'Robotics Line', 'Energy Efficiency', 'Additive Manufacturing'],
    unlockProduct: ['Autonomous Factories', true],
    rivalPool: ['Vanguard Industrial', 'Apex Machinery', 'Meridian Industrial', 'Titan Works', 'Cobalt Systems', 'Summit Industrial', 'Ironforge', 'Nova Industrial', 'Helix Machinery', 'Draco Industrial'],
  },
  materials: {
    metric: 'tonnes', metricShort: 'tonnes', physicalDefault: true, archetype: 'materials',
    tagline: 'The raw materials of industry.',
    catalog: [['Steel', true], ['Copper', true], ['Aluminium', true], ['Specialty Alloys', true],
      ['Industrial Chemicals', true], ['Cement', true], ['Polymers', true], ['Rare Earths', true]],
    research: ['Efficient Extraction', 'Purity Refinement', 'Automated Processing', 'Carbon-Neutral Ops', 'New Reserves'],
    unlockProduct: ['Advanced Composites', true],
    rivalPool: ['Bedrock Materials', 'Apex Mining', 'Meridian Materials', 'Cobalt Resources', 'Summit Minerals', 'Ironpeak', 'Nova Materials', 'Terra Resources', 'Helix Mining', 'Draco Metals'],
  },
  aerospace: {
    metric: 'units', metricShort: 'units', physicalDefault: true, archetype: 'aerospace',
    tagline: 'Engineering for sky and space.',
    catalog: [['Narrow-Body Jets', true], ['Wide-Body Jets', true], ['Regional Jets', true], ['Cargo Aircraft', true],
      ['Business Jets', true], ['Helicopters', true], ['Aircraft Engines', true], ['Avionics', true]],
    research: ['Next-Gen Engine', 'Composite Airframe', 'Hypersonics', 'Autonomous Flight', 'Sustainable Fuel'],
    unlockProduct: ['Spaceplane', true],
    rivalPool: ['Aeronix', 'Skybound', 'Meridian Aerospace', 'Apex Aviation', 'Cobalt Defence', 'Summit Aerospace', 'Nova Aviation', 'Helix Aero', 'Vanguard Defence', 'Draco Aerospace'],
  },
  utility: {
    metric: 'connections', metricShort: 'connections', physicalDefault: true, archetype: 'utility',
    tagline: 'Keeping the lights on.',
    catalog: [['Electricity Grid', true], ['Natural Gas Distribution', true], ['Water Services', true], ['Solar Farms', true],
      ['Wind Farms', true], ['Grid Storage', true], ['Smart Metering', true], ['District Heating', true]],
    research: ['Smart Grid', 'Battery Storage', 'Renewable Transition', 'Demand Response', 'Grid Resilience'],
    unlockProduct: ['Fusion Pilot', true],
    rivalPool: ['Voltaic Power', 'Meridian Utilities', 'Apex Energy Co', 'Cobalt Power', 'Summit Utilities', 'Nova Grid', 'Helix Power', 'Vanguard Utilities', 'Terra Power', 'Draco Energy'],
  },
};

/* --------- Per-company catalog overrides (distinct product lines) --------- */
const COMPANY_KITS = {
  // Consumer goods — each company makes something different.
  chokacola: { tagline: 'Refreshment for the world.',
    catalog: [['Cola', true], ['Diet Cola', true], ['Energy Drink', true], ['Sparkling Water', true], ['Fruit Juice', true], ['Sports Drink', true], ['Iced Tea', true], ['Bottled Water', true]] },
  nyke: { tagline: 'Gear for every athlete.',
    catalog: [['Running Shoes', true], ['Basketball Shoes', true], ['Athletic Apparel', true], ['Training Gear', true], ['Football Boots', true], ['Sports Bags', true], ['Smart Wearables', true], ['Yoga Line', true]] },
  pipsico: { tagline: 'Food people reach for.',
    catalog: [['Snacks', true], ['Cereal', true], ['Frozen Meals', true], ['Condiments', true], ['Dairy', true], ['Confectionery', true], ['Beverages', true], ['Pet Food', true]] },
  proctorgambit: { tagline: 'Everyday household essentials.',
    catalog: [['Detergent', true], ['Shampoo', true], ['Toothpaste', true], ['Skincare', true], ['Cleaning Supplies', true], ['Diapers', true], ['Razors', true], ['Air Care', true]] },
  // Media — streaming vs studio vs games.
  netflex: { tagline: 'Streaming the world’s stories.',
    catalog: [['Streaming Service', false], ['Original Series', false], ['Films', false], ['Documentaries', false], ['Kids Content', false], ['Live Sports', false], ['Reality TV', false], ['Ad Tier', false]] },
  dizzney: { tagline: 'Magic on every screen.',
    catalog: [['Animated Films', false], ['Blockbuster Films', false], ['Theme Parks', true], ['TV Series', false], ['Streaming', false], ['Merchandise', true], ['Franchises', false], ['Kids Content', false]] },
  zony: { tagline: 'Games, film and sound.',
    catalog: [['Video Games', false], ['Game Consoles', true], ['Films', false], ['Music Label', false], ['TV', false], ['Streaming', false], ['VR Games', false], ['Esports', false]] },
  // Materials — gases vs mining.
  lindygas: { tagline: 'The gases industry breathes.', archetype: 'materials',
    catalog: [['Oxygen', true], ['Nitrogen', true], ['Hydrogen', true], ['Argon', true], ['Helium', true], ['Specialty Gases', true], ['CO₂', true], ['Medical Gases', true]] },
  bravohill: { tagline: 'Digging up what the world needs.', archetype: 'materials',
    catalog: [['Iron Ore', true], ['Copper', true], ['Gold', true], ['Lithium', true], ['Aluminium Ore', true], ['Coal', true], ['Nickel', true], ['Rare Earths', true]] },
  // Aerospace — defence specialist.
  lockjaw: { tagline: 'Defence and deterrence.',
    catalog: [['Fighter Jets', true], ['Missiles', true], ['Military Drones', true], ['Radar Systems', true], ['Naval Systems', true], ['Satellites', true], ['Defence Electronics', true], ['Armoured Vehicles', true]] },
  // Luxury — couture vs maison.
  maisonlux: { tagline: 'Haute couture and fine goods.',
    catalog: [['Haute Couture', true], ['Handbags', true], ['Ready-to-Wear', true], ['Fragrances', true], ['Watches', true], ['Jewellery', true], ['Eyewear', true], ['Leather Goods', true]] },
  ferraro: { tagline: 'The pinnacle of craftsmanship.',
    catalog: [['Supercars', true], ['Grand Tourers', true], ['Watches', true], ['Jewellery', true], ['Yachts', true], ['Fine Leather', true], ['Fragrances', true], ['Limited Editions', true]] },
};

/* --------------------------- Build every profile -------------------------- */
(function buildBusinessProfiles() {
  function bhash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function pickRivals(id, pool) {
    const out = [], used = {}; let h = bhash(id + '#riv');
    while (out.length < 4 && out.length < pool.length) {
      const idx = h % pool.length;
      if (!used[idx]) { used[idx] = 1; out.push(pool[idx]); }
      h = (Math.imul(h ^ (h >>> 13), 0x9e3779b1)) >>> 0;
    }
    return out;
  }

  for (const sdef of STOCK_DEFS) {
    const id = sdef.id;
    if (TECHCO_DEFS[id]) continue;              // keep the 5 hand-crafted tech companies
    const kit = SECTOR_KITS[sdef.sector];
    if (!kit) continue;                          // (every stock sector has a kit)
    const ov = COMPANY_KITS[id] || {};
    const catalog = ov.catalog || kit.catalog;
    const archetype = ov.archetype || kit.archetype;

    TECHCO_DEFS[id] = {
      id,
      label: SECTOR_DISPLAY[sdef.sector] || 'Company',
      tagline: ov.tagline || kit.tagline,
      metric: ov.metric || kit.metric,
      metricShort: kit.metricShort,
      physicalDefault: kit.physicalDefault,
      catalog,
      rivals: pickRivals(id, kit.rivalPool),
      research: kit.research,
      unlockProduct: ov.unlockProduct || kit.unlockProduct,
    };
    if (TECHCO_IDS.indexOf(id) < 0) TECHCO_IDS.push(id);

    // Map each product type → a spec archetype (don't clobber tech mappings).
    for (const row of catalog) if (!TECH_PRODUCT_ARCHETYPE[row[0]]) TECH_PRODUCT_ARCHETYPE[row[0]] = archetype;
    const up = ov.unlockProduct || kit.unlockProduct;
    if (up && !TECH_PRODUCT_ARCHETYPE[up[0]]) TECH_PRODUCT_ARCHETYPE[up[0]] = archetype;
  }
})();
