/* =========================================================================
 * data/techspecs.js — In-depth product design: specs, tiers, budgets, teams
 * -------------------------------------------------------------------------
 * Data for the Product Studio (js/techco.js): when you develop a product you
 * pick its NAME, TYPE, TIER, per-component SPECIFICATIONS, a BUDGET across
 * design/engineering/manufacturing/QA/marketing, and assign a TEAM across
 * seven roles. All of it feeds a quality score that shapes the product's
 * reception, income, price and unit sales.
 *
 * To stay authorable, each product TYPE maps to an ARCHETYPE (mobile, computer,
 * server hardware, software, social, AI, robotics …). Archetypes carry the
 * tailored specification list, the unit label ("units", "licenses", "users"…),
 * a base unit price, and a focus (hardware vs software) that weights the team.
 * ========================================================================= */

// Overall product tier — sets price point, market position and cost ceiling.
const TECH_TIERS = {
  budget:   { label: 'Budget',   priceMult: 0.6, costMult: 4,  incomeMult: 0.85, blurb: 'Affordable, mass-market' },
  standard: { label: 'Standard', priceMult: 1.0, costMult: 8,  incomeMult: 1.0,  blurb: 'Mainstream, balanced' },
  premium:  { label: 'Premium',  priceMult: 1.6, costMult: 16, incomeMult: 1.15, blurb: 'High-end, higher margin' },
  flagship: { label: 'Flagship', priceMult: 2.4, costMult: 28, incomeMult: 1.35, blurb: 'No compromises, halo product' },
};

// Budget areas the player funds. Each area is set Lean / Standard / Heavy.
const TECH_BUDGET_AREAS = [
  { id: 'design',        label: 'Design' },
  { id: 'engineering',   label: 'Engineering' },
  { id: 'manufacturing', label: 'Manufacturing' },
  { id: 'qa',            label: 'Quality Assurance' },
  { id: 'marketing',     label: 'Marketing' },
];
const TECH_BUDGET_LEVELS = {
  lean:     { label: 'Lean',     v: 0.34, cost: 1 },
  standard: { label: 'Standard', v: 0.67, cost: 2 },
  heavy:    { label: 'Heavy',    v: 1.0,  cost: 3.5 },
};

// Team roles you staff for the project (backed by the company's staff groups).
const TECH_ROLES = [
  { id: 'pm',     label: 'Project Manager',    pool: 'ops', desc: 'Coordination & build speed' },
  { id: 'lead',   label: 'Lead Engineer',      pool: 'eng', desc: 'Overall quality' },
  { id: 'design', label: 'Designers',          pool: 'eng', desc: 'Design & appeal' },
  { id: 'swe',    label: 'Software Engineers',  pool: 'eng', desc: 'Software quality' },
  { id: 'hwe',    label: 'Hardware Engineers',  pool: 'eng', desc: 'Hardware quality' },
  { id: 'qa',     label: 'QA Testers',         pool: 'eng', desc: 'Reliability, fewer flops' },
  { id: 'mkt',    label: 'Marketing Team',     pool: 'mkt', desc: 'Launch reception & reach' },
];
const TECH_TEAM_LEVELS = {
  none:     { label: 'None',     v: 0,   cost: 0 },
  small:    { label: 'Small',    v: 0.4, cost: 1 },
  standard: { label: 'Standard', v: 0.7, cost: 2 },
  large:    { label: 'Large',    v: 1.0, cost: 3.5 },
};

// Spec archetypes. specs: [id, label, [ [optLabel, quality(1-3), cost(1-3.5)], … ]].
const TECH_ARCHETYPES = {
  mobile: {
    category: 'Mobile Devices', unit: 'units', basePrice: 750, focus: 'hardware',
    specs: [
      ['display',   'Display',   [['HD LCD', 1, 1], ['OLED', 2, 2], ['ProMotion OLED', 3, 3.5]]],
      ['chip',      'Processor', [['Efficient chip', 1, 1], ['Performance chip', 2, 2], ['Custom flagship silicon', 3, 3.5]]],
      ['camera',    'Camera',    [['Dual camera', 1, 1], ['Triple camera', 2, 2], ['Pro camera system', 3, 3.5]]],
      ['battery',   'Battery',   [['All-day', 1, 1], ['Fast-charge', 2, 2], ['Multi-day + wireless', 3, 3]]],
      ['storage',   'Storage',   [['128 GB', 1, 1], ['256 GB', 2, 1.5], ['1 TB', 3, 2.5]]],
      ['materials', 'Materials', [['Polycarbonate', 1, 1], ['Aluminium', 2, 2], ['Titanium & glass', 3, 3]]],
    ],
  },
  computer: {
    category: 'Computers', unit: 'units', basePrice: 1200, focus: 'hardware',
    specs: [
      ['display', 'Display',  [['FHD panel', 1, 1], ['QHD panel', 2, 2], ['4K OLED', 3, 3.5]]],
      ['chip',    'Processor',[['4-core', 1, 1], ['8-core', 2, 2], ['16-core workstation', 3, 3.5]]],
      ['ram',     'Memory',   [['8 GB', 1, 1], ['16 GB', 2, 1.5], ['64 GB', 3, 2.5]]],
      ['storage', 'Storage',  [['512 GB SSD', 1, 1], ['1 TB SSD', 2, 1.5], ['4 TB NVMe', 3, 2.5]]],
      ['gpu',     'Graphics', [['Integrated', 1, 1], ['Discrete GPU', 2, 2.5], ['Pro GPU', 3, 3.5]]],
      ['build',   'Build',    [['Plastic', 1, 1], ['Aluminium', 2, 2], ['Machined unibody', 3, 3]]],
    ],
  },
  audio: {
    category: 'Audio & Accessories', unit: 'units', basePrice: 180, focus: 'hardware',
    specs: [
      ['sound',   'Sound',        [['Standard drivers', 1, 1], ['Hi-Fi drivers', 2, 2], ['Studio-grade', 3, 3]]],
      ['anc',     'Noise Control', [['None', 1, 1], ['Active NC', 2, 2], ['Adaptive ANC', 3, 3]]],
      ['battery', 'Battery',      [['6 hours', 1, 1], ['12 hours', 2, 1.5], ['30+ hours', 3, 2.5]]],
      ['connect', 'Connectivity',  [['Bluetooth', 1, 1], ['Multipoint', 2, 1.5], ['Lossless wireless', 3, 3]]],
      ['build',   'Comfort & Build', [['Basic', 1, 1], ['Ergonomic', 2, 2], ['Premium materials', 3, 3]]],
    ],
  },
  home: {
    category: 'Smart Home', unit: 'units', basePrice: 500, focus: 'hardware',
    specs: [
      ['panel',   'Display / Sensors', [['Basic', 1, 1], ['HDR / rich sensors', 2, 2], ['Mini-LED / lidar', 3, 3.5]]],
      ['chip',    'Processor',   [['Entry SoC', 1, 1], ['Smart SoC', 2, 2], ['AI SoC', 3, 3]]],
      ['connect', 'Connectivity',[['Wi-Fi', 1, 1], ['Wi-Fi + Thread', 2, 1.5], ['Full smart-home hub', 3, 2.5]]],
      ['voice',   'Assistant',   [['Basic', 1, 1], ['Voice control', 2, 2], ['On-device AI', 3, 3]]],
      ['design',  'Design',      [['Functional', 1, 1], ['Refined', 2, 2], ['Designer', 3, 3]]],
    ],
  },
  serverhw: {
    category: 'Data-Centre Hardware', unit: 'deployments', basePrice: 9000, focus: 'hardware',
    specs: [
      ['compute', 'Compute',    [['Standard CPUs', 1, 1], ['High-core CPUs', 2, 2], ['CPU + accelerators', 3, 3.5]]],
      ['memory',  'Memory',     [['256 GB', 1, 1], ['1 TB', 2, 2], ['4 TB ECC', 3, 3]]],
      ['storage', 'Storage',    [['SATA SSD', 1, 1], ['NVMe', 2, 2], ['NVMe + tiered', 3, 3]]],
      ['network', 'Networking', [['10 GbE', 1, 1], ['100 GbE', 2, 2], ['400 GbE fabric', 3, 3.5]]],
      ['cooling', 'Cooling',    [['Air', 1, 1], ['Liquid-assist', 2, 2], ['Full liquid', 3, 3]]],
      ['reliab',  'Reliability',[['Standard', 1, 1], ['Redundant', 2, 2], ['Fault-tolerant', 3, 3]]],
    ],
  },
  platform: {
    category: 'Enterprise Platforms', unit: 'subscriptions', basePrice: 600, focus: 'software',
    specs: [
      ['perf',    'Performance',  [['Standard', 1, 1], ['High-throughput', 2, 2], ['Real-time', 3, 3]]],
      ['scale',   'Scalability',  [['Regional', 1, 1], ['Multi-region', 2, 2], ['Global auto-scale', 3, 3.5]]],
      ['security','Security',     [['Standard', 1, 1], ['SOC2 / encrypted', 2, 2], ['Zero-trust', 3, 3]]],
      ['integ',   'Integrations', [['Core APIs', 1, 1], ['Rich connectors', 2, 1.5], ['Full ecosystem', 3, 2.5]]],
      ['devx',    'Developer UX', [['CLI', 1, 1], ['Dashboards + SDKs', 2, 2], ['Full platform', 3, 3]]],
    ],
  },
  software: {
    category: 'Software', unit: 'licenses', basePrice: 150, focus: 'software',
    specs: [
      ['features','Feature Set',  [['Essentials', 1, 1], ['Full suite', 2, 2], ['Pro + power tools', 3, 3]]],
      ['perf',    'Performance',  [['Standard', 1, 1], ['Optimised', 2, 2], ['Native-fast', 3, 3]]],
      ['ui',      'Interface',    [['Functional', 1, 1], ['Polished', 2, 2], ['Best-in-class', 3, 3]]],
      ['integ',   'Integration',  [['Standalone', 1, 1], ['Cloud sync', 2, 1.5], ['Full ecosystem', 3, 2.5]]],
      ['ai',      'AI Assist',    [['None', 1, 1], ['Smart features', 2, 2], ['AI copilot', 3, 3]]],
    ],
  },
  social: {
    category: 'Social & Platforms', unit: 'users', basePrice: 20, focus: 'social',
    specs: [
      ['algo',    'Recommendation', [['Chronological', 1, 1], ['Engagement model', 2, 2], ['Frontier AI feed', 3, 3.5]]],
      ['content', 'Content Tools',  [['Basic posting', 1, 1], ['Rich media', 2, 2], ['Pro creator suite', 3, 3]]],
      ['monet',   'Monetization',   [['Ads', 1, 1], ['Ads + subs', 2, 2], ['Full creator economy', 3, 3]]],
      ['mod',     'Moderation',     [['Manual', 1, 1], ['Assisted', 2, 2], ['AI trust & safety', 3, 3]]],
      ['scale',   'Scalability',    [['Regional', 1, 1], ['Global', 2, 2], ['Real-time global', 3, 3]]],
    ],
  },
  ai: {
    category: 'AI Products', unit: 'query packs', basePrice: 30, focus: 'ai',
    specs: [
      ['scale',   'Model Scale',   [['Compact', 1, 1], ['Large', 2, 2], ['Frontier', 3, 3.5]]],
      ['data',    'Training Data', [['Curated', 1, 1], ['Broad web', 2, 2], ['Proprietary + web', 3, 3]]],
      ['reason',  'Reasoning',     [['Fast answers', 1, 1], ['Step-by-step', 2, 2], ['Deep reasoning', 3, 3.5]]],
      ['multi',   'Multimodality', [['Text', 1, 1], ['Text + image', 2, 2], ['Text/image/video/audio', 3, 3]]],
      ['safety',  'Safety',        [['Basic filters', 1, 1], ['Aligned', 2, 2], ['Rigorous alignment', 3, 3]]],
      ['latency', 'Latency',       [['Standard', 1, 1], ['Fast', 2, 1.5], ['Instant', 3, 2.5]]],
    ],
  },
  robotics: {
    category: 'Robotics', unit: 'units', basePrice: 25000, focus: 'hardware',
    specs: [
      ['actuator','Actuators',  [['Standard motors', 1, 1], ['Precision servos', 2, 2], ['High-torque custom', 3, 3.5]]],
      ['sensors', 'Sensors',    [['Cameras', 1, 1], ['Camera + lidar', 2, 2], ['Full sensor fusion', 3, 3.5]]],
      ['autonomy','Autonomy AI',[['Scripted', 1, 1], ['Adaptive', 2, 2], ['Fully autonomous', 3, 3.5]]],
      ['power',   'Power',      [['4-hour', 1, 1], ['8-hour', 2, 1.5], ['All-day swap', 3, 2.5]]],
      ['durab',   'Durability', [['Indoor', 1, 1], ['Industrial', 2, 2], ['All-terrain', 3, 3]]],
    ],
  },
  generic: {
    category: 'Product', unit: 'units', basePrice: 300, focus: 'software',
    specs: [
      ['perf',    'Performance', [['Standard', 1, 1], ['Advanced', 2, 2], ['Cutting-edge', 3, 3]]],
      ['design',  'Design',      [['Functional', 1, 1], ['Refined', 2, 2], ['Premium', 3, 3]]],
      ['reliab',  'Reliability', [['Standard', 1, 1], ['Robust', 2, 2], ['Rock-solid', 3, 3]]],
    ],
  },
};

// Every product TYPE (base catalogs + research-unlocked flagships) → archetype.
const TECH_PRODUCT_ARCHETYPE = {
  // Halcyon — Consumer Electronics
  'Smartphones': 'mobile', 'Tablets': 'mobile', 'Smartwatches': 'mobile', 'Foldable Phones': 'mobile',
  'Laptops': 'computer', 'Desktops': 'computer', 'Monitors': 'computer',
  'Wireless Earbuds': 'audio', 'Gaming Accessories': 'audio',
  'Smart TVs': 'home', 'Smart Home Devices': 'home',
  // Vireo — Cloud & Enterprise
  'Cloud Servers': 'serverhw', 'Data Centres': 'serverhw', 'AI Computing Hardware': 'serverhw',
  'Enterprise Storage': 'serverhw', 'Network Equipment': 'serverhw', 'Cybersecurity Appliances': 'serverhw',
  'Server Racks': 'serverhw', 'Quantum Servers': 'serverhw',
  'Business Cloud Platforms': 'platform', 'Database Platforms': 'platform', 'Developer Platforms': 'platform',
  // Kestrel — Software
  'Office Suite': 'software', 'Accounting': 'software', 'Project Management': 'software',
  'Business Management': 'software', 'Graphic Design': 'software', 'Video Editing': 'software',
  'Antivirus': 'software', 'Operating System': 'software', 'Web Browser': 'software',
  'Developer Tools': 'software', 'AI Agent Platform': 'software',
  // Lumen — Social & Platforms
  'Social Platform': 'social', 'Messaging App': 'social', 'Short-Form Video': 'social',
  'Live Streaming': 'social', 'Photo Sharing': 'social', 'Community Forums': 'social',
  'Creator Platform': 'social', 'Music Streaming': 'social', 'Podcast Platform': 'social',
  'Online Marketplace': 'social', 'AR Social Space': 'social',
  // Cygnus — AI & Robotics
  'AI Assistants': 'ai', 'AI Chatbots': 'ai', 'AI Coding Tools': 'ai', 'AI Image Generation': 'ai',
  'AI Video Generation': 'ai', 'Medical AI': 'ai', 'Self-Driving Software': 'ai', 'ML Platforms': 'ai',
  'Robotics': 'robotics', 'Industrial Automation': 'robotics', 'Humanoid Robots': 'robotics',
};
