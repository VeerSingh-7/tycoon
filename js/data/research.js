/* =========================================================================
 * data/research.js — Research meta-game: categories, levels, mass projects
 * -------------------------------------------------------------------------
 * Every company gets a Research dashboard: a budget, scientists (junior /
 * senior / lead), research centres, partnerships, and category "tech trees"
 * where each of 5 levels is a real breakthrough with a description and an
 * effect that changes GAMEPLAY — unlocking new products, higher selling
 * prices, better quality, fatter margins, etc.
 *
 * A company's tree is resolved as: COMPANY_RESEARCH[id] || SECTOR_RESEARCH[sector].
 * So a bank, a pharma and a carmaker research entirely different things, and
 * the five flagship tech firms each get a bespoke tree (hardware, cloud,
 * software, social, AI).
 *
 * Level format:  [name, description, effect]
 * Effect keys (any subset):  inc (income ×+), pr (unit price ×+), mg (margin +),
 *   q (quality +0-100), rc (reception +), ct (operating-cost cut +),
 *   u ([productName, physical] — unlocks a brand-new product type)
 * ========================================================================= */

/* ------------------------------ Shared config ----------------------------- */
const RESEARCH_SCI = {
  jr:   { label: 'Junior Researchers', short: 'Juniors', power: 1, hire: 2,  pay: 0.03 },
  sr:   { label: 'Senior Researchers', short: 'Seniors', power: 3, hire: 6,  pay: 0.08 },
  lead: { label: 'Lead Scientists',    short: 'Leads',   power: 8, hire: 18, pay: 0.20 },
};
// Editable research budget: a daily spend (× base income) that also sets speed.
const RESEARCH_BUDGETS = {
  lean:       { label: 'Lean',       daily: 0.2, speed: 0.7 },
  standard:   { label: 'Standard',   daily: 0.6, speed: 1.0 },
  aggressive: { label: 'Aggressive', daily: 1.4, speed: 1.5 },
  blitz:      { label: 'Blitz',      daily: 3.0, speed: 2.2 },
};
// Research centres built around the world — each adds research power + upkeep.
const RESEARCH_CENTERS = [
  { id: 'sv',  name: 'Silicon Valley Lab',    region: 'North America', costMult: 40, power: 12 },
  { id: 'zur', name: 'Zurich Institute',      region: 'Europe',        costMult: 35, power: 10 },
  { id: 'blr', name: 'Bangalore Campus',      region: 'Asia',          costMult: 25, power: 8 },
  { id: 'shz', name: 'Shenzhen Lab',          region: 'Asia',          costMult: 30, power: 9 },
  { id: 'tlv', name: 'Tel Aviv Lab',          region: 'Middle East',   costMult: 32, power: 10 },
  { id: 'sgp', name: 'Singapore Hub',         region: 'Asia',          costMult: 28, power: 9 },
];
// Partnerships — each a one-off with a distinct permanent bonus.
const RESEARCH_PARTNERS = [
  { id: 'uni',  name: 'University Alliance',    desc: 'Faculty & PhD pipeline — faster research.',        costMult: 20, bonus: { speed: 0.25, power: 6 } },
  { id: 'lab',  name: 'National Research Lab',  desc: 'Deep science muscle — big research power.',         costMult: 35, bonus: { power: 16 } },
  { id: 'gov',  name: 'Government Grants',      desc: 'Public funding — cheaper research & operations.',   costMult: 25, bonus: { ct: 0.05, discount: 0.25 } },
  { id: 'corp', name: 'Private R&D Partner',    desc: 'Corporate co-development — better products.',       costMult: 30, bonus: { q: 5 } },
];

/* ------------------------ Bespoke trees: the 5 tech firms ------------------ */
const COMPANY_RESEARCH = {
  // Halcyon Digital — consumer electronics hardware.
  mango: { categories: [
    { id: 'proc', icon: '⚙️', name: 'Processors', levels: [
      ['Efficient Cores', 'Cooler, cheaper chips lift baseline income.', { inc: 0.04 }],
      ['Performance Cores', 'Snappier devices sell for more.', { pr: 0.05 }],
      ['Custom Silicon', 'In-house chips widen your margins.', { mg: 0.05 }],
      ['Neural Engine', 'On-device AI raises product quality.', { q: 6 }],
      ['Quantum Co-Processor', 'A leap that unlocks a Quantum Phone line.', { u: ['Quantum Phone', true] }],
    ] },
    { id: 'batt', icon: '🔋', name: 'Batteries', levels: [
      ['Lithium-Ion', 'Reliable all-day power.', { inc: 0.03 }],
      ['Fast Charging', 'A feature buyers love at launch.', { rc: 0.3 }],
      ['High-Density Cells', 'Longer life commands a premium price.', { pr: 0.05 }],
      ['Silicon-Anode', 'Best-in-class longevity, higher quality.', { q: 5 }],
      ['Solid-State', 'Unlocks a long-life Solid-State Phone.', { u: ['Solid-State Phone', true] }],
    ] },
    { id: 'disp', icon: '📱', name: 'Displays', levels: [
      ['LCD Panels', 'Solid, affordable screens.', { inc: 0.03 }],
      ['OLED', 'Vivid displays raise quality.', { q: 4 }],
      ['ProMotion', 'Silky 120Hz commands a premium.', { pr: 0.04 }],
      ['Micro-LED', 'Reference-grade brightness and quality.', { q: 6 }],
      ['Foldable Displays', 'Unlocks a Foldable Phone line.', { u: ['Foldable Phones', true] }],
    ] },
    { id: 'cam', icon: '📷', name: 'Cameras', levels: [
      ['Dual Lens', 'Dependable everyday shots.', { inc: 0.03 }],
      ['Night Mode', 'A standout launch feature.', { rc: 0.3 }],
      ['Periscope Zoom', 'Pro optics justify higher prices.', { pr: 0.04 }],
      ['Computational Photography', 'AI imaging lifts quality.', { q: 5 }],
      ['Cinema Sensor', 'Unlocks a Pro Camera Phone.', { u: ['Pro Camera Phone', true] }],
    ] },
  ], mass: [
    { id: 'agiphone', name: 'Ambient Computing Platform', desc: 'Devices that anticipate you — a category-defining bet.', costMult: 260, secs: 900, effect: { inc: 0.15, q: 8 } },
    { id: 'xr', name: 'Spatial XR Headset', desc: 'A whole new hardware category.', costMult: 340, secs: 1100, effect: { u: ['XR Headset', true], pr: 0.06 } },
  ] },

  // Vireo — cloud & enterprise.
  googol: { categories: [
    { id: 'compute', icon: '🖥️', name: 'Cloud Compute', levels: [
      ['Virtualization', 'Denser servers cut costs.', { ct: 0.03 }],
      ['Auto-Scaling', 'Elastic capacity wins customers.', { inc: 0.05 }],
      ['Custom Server Silicon', 'Owned chips widen margins.', { mg: 0.05 }],
      ['Liquid Cooling', 'Higher density, higher quality.', { q: 6 }],
      ['Quantum Cloud', 'Unlocks Quantum Compute service.', { u: ['Quantum Compute', false] }],
    ] },
    { id: 'ai', icon: '🧠', name: 'AI Infrastructure', levels: [
      ['GPU Clusters', 'The backbone of AI demand.', { inc: 0.05 }],
      ['AI Accelerators', 'Purpose-built silicon lifts prices.', { pr: 0.05 }],
      ['Inference Optimisation', 'Cheaper to serve — better margins.', { mg: 0.04 }],
      ['Training Superclusters', 'Frontier scale raises quality.', { q: 6 }],
      ['AI Supercomputer', 'Unlocks an AI Supercomputer product.', { u: ['AI Supercomputer', true] }],
    ] },
    { id: 'sec', icon: '🔒', name: 'Security', levels: [
      ['Encryption', 'Table stakes for enterprise.', { inc: 0.03 }],
      ['Zero-Trust', 'Wins security-conscious buyers.', { rc: 0.3 }],
      ['Threat AI', 'Premium protection, premium price.', { pr: 0.04 }],
      ['Confidential Computing', 'Higher assurance, higher quality.', { q: 5 }],
      ['Post-Quantum Security', 'Unlocks a Quantum-Safe Cloud tier.', { u: ['Quantum-Safe Cloud', false] }],
    ] },
    { id: 'net', icon: '🌐', name: 'Networking', levels: [
      ['Fast Fabric', 'Low latency inside the datacentre.', { inc: 0.03 }],
      ['Global Backbone', 'Worldwide reach lifts revenue.', { inc: 0.05 }],
      ['Edge Nodes', 'Closer to users, worth more.', { pr: 0.04 }],
      ['400G Optics', 'Bandwidth leadership raises quality.', { q: 5 }],
      ['Global Edge Network', 'Unlocks a Global Edge platform.', { u: ['Global Edge Platform', false] }],
    ] },
  ], mass: [
    { id: 'agicloud', name: 'Autonomous Datacentre', desc: 'Self-healing, self-optimising infrastructure.', costMult: 300, secs: 1000, effect: { ct: 0.06, inc: 0.12 } },
    { id: 'fusion', name: 'On-Site Fusion Power', desc: 'Limitless clean power for compute.', costMult: 400, secs: 1300, effect: { mg: 0.08, inc: 0.1 } },
  ] },

  // Kestrel — software.
  macrosoft: { categories: [
    { id: 'platform', icon: '🧩', name: 'Platform', levels: [
      ['Cloud Sync', 'Anywhere access lifts adoption.', { inc: 0.05 }],
      ['Cross-Platform Runtime', 'One codebase, every device.', { mg: 0.05 }],
      ['Real-Time Collaboration', 'A killer feature at launch.', { rc: 0.3 }],
      ['Native Performance', 'Fast software feels premium.', { pr: 0.05 }],
      ['Universal App Platform', 'Unlocks a Universal App Platform.', { u: ['App Platform', false] }],
    ] },
    { id: 'ai', icon: '🤖', name: 'AI Copilots', levels: [
      ['Smart Suggestions', 'Everyday productivity wins.', { inc: 0.05 }],
      ['AI Copilot', 'A headline feature buyers pay for.', { pr: 0.06 }],
      ['Agentic Automation', 'Software that does the work — higher quality.', { q: 7 }],
      ['On-Device Models', 'Private, fast AI widens margins.', { mg: 0.05 }],
      ['Autonomous Agents', 'Unlocks an AI Agent Platform.', { u: ['AI Agent Platform', false] }],
    ] },
    { id: 'sec', icon: '🛡️', name: 'Security', levels: [
      ['Sandboxing', 'Safer software, fewer incidents.', { ct: 0.03 }],
      ['Threat Detection', 'Enterprise trust at launch.', { rc: 0.3 }],
      ['Zero-Day Defence', 'Premium security tier.', { pr: 0.04 }],
      ['Confidential Compute', 'Higher assurance, higher quality.', { q: 5 }],
      ['Autonomous SecOps', 'Unlocks a Security Suite.', { u: ['Security Suite', false] }],
    ] },
    { id: 'kernel', icon: '⚙️', name: 'Core Engine', levels: [
      ['Modern Kernel', 'A faster, leaner base.', { inc: 0.04 }],
      ['Memory Safety', 'Fewer bugs — better margins.', { mg: 0.04 }],
      ['GPU Acceleration', 'Snappy everywhere.', { q: 5 }],
      ['Instant Boot', 'Delight that sells.', { pr: 0.04 }],
      ['Next-Gen OS', 'Unlocks a next-gen Operating System.', { u: ['Next-Gen OS', false] }],
    ] },
  ], mass: [
    { id: 'agi', name: 'General Reasoning Model', desc: 'Software that can reason across any task.', costMult: 320, secs: 1100, effect: { inc: 0.18, q: 8 } },
    { id: 'quantumsw', name: 'Quantum Dev Toolkit', desc: 'Own the quantum software stack early.', costMult: 260, secs: 900, effect: { pr: 0.08, u: ['Quantum Studio', false] } },
  ] },

  // Lumen — social & platforms.
  faceblock: { categories: [
    { id: 'algo', icon: '🧭', name: 'Feed Algorithm', levels: [
      ['Chronological+', 'Better relevance keeps users.', { inc: 0.05 }],
      ['Engagement Model', 'More time on app, more ads.', { inc: 0.06 }],
      ['Interest Graph', 'Sharper targeting lifts ad prices.', { pr: 0.05 }],
      ['Frontier Recommender', 'AI feed raises quality.', { q: 7 }],
      ['Predictive Feed', 'Unlocks an AI Discovery feed.', { u: ['AI Discovery Feed', false] }],
    ] },
    { id: 'ads', icon: '💰', name: 'Ad Platform', levels: [
      ['Targeted Ads', 'The core money machine.', { inc: 0.05 }],
      ['Ad Auction 2.0', 'Higher yield per impression.', { mg: 0.05 }],
      ['Shopping Ads', 'Commerce that pays more.', { pr: 0.05 }],
      ['AI Creative', 'Better ads, better margins.', { mg: 0.05 }],
      ['Full Ad Exchange', 'Unlocks an Ad Exchange product.', { u: ['Ad Exchange', false] }],
    ] },
    { id: 'creator', icon: '🎨', name: 'Creator Tools', levels: [
      ['Creator Fund', 'Attracts the best talent.', { rc: 0.3 }],
      ['Short-Form Studio', 'Fuels viral growth.', { inc: 0.05 }],
      ['Live Monetisation', 'New revenue per creator.', { pr: 0.04 }],
      ['AI Editing', 'Pro tools raise quality.', { q: 5 }],
      ['Creator Marketplace', 'Unlocks a Creator Marketplace.', { u: ['Creator Marketplace', false] }],
    ] },
    { id: 'trust', icon: '🛡️', name: 'Trust & Safety', levels: [
      ['Moderation Team', 'Cleaner platform, safer ads.', { ct: 0.03 }],
      ['Assisted Moderation', 'Scales trust cheaply.', { mg: 0.03 }],
      ['AI Safety', 'Advertiser-safe at launch.', { rc: 0.3 }],
      ['Real-Time Detection', 'Higher quality experience.', { q: 4 }],
      ['Verified Identity', 'Unlocks a Verified Network tier.', { u: ['Verified Network', false] }],
    ] },
  ], mass: [
    { id: 'metaverse', name: 'Social Metaverse', desc: 'The next platform — immersive social.', costMult: 320, secs: 1100, effect: { u: ['AR Social Space', false], inc: 0.12 } },
    { id: 'superapp', name: 'Everything Super App', desc: 'One app for chat, pay, shop, everything.', costMult: 280, secs: 1000, effect: { inc: 0.16 } },
  ] },

  // Cygnus — AI & robotics.
  auracle: { categories: [
    { id: 'model', icon: '🧠', name: 'Foundation Models', levels: [
      ['Compact Model', 'Cheap, fast, everywhere.', { inc: 0.05 }],
      ['Large Model', 'Capability buyers pay for.', { pr: 0.06 }],
      ['Reasoning Model', 'Step-by-step thinking lifts quality.', { q: 7 }],
      ['Multimodal Model', 'Text, image, video, audio.', { q: 6 }],
      ['Frontier Model', 'Unlocks a Frontier AI product.', { u: ['Frontier AI', false] }],
    ] },
    { id: 'robot', icon: '🦾', name: 'Robotics', levels: [
      ['Robotic Arms', 'Automation revenue.', { inc: 0.05 }],
      ['Dexterous Hands', 'Fine manipulation, premium price.', { pr: 0.05 }],
      ['Bipedal Locomotion', 'Robots that walk — higher quality.', { q: 6 }],
      ['Whole-Body Control', 'Coordinated, capable machines.', { q: 6 }],
      ['Humanoid Robotics', 'Unlocks Humanoid Robots.', { u: ['Humanoid Robots', true] }],
    ] },
    { id: 'auto', icon: '🚗', name: 'Autonomy', levels: [
      ['Driver Assist', 'A feature that sells.', { rc: 0.3 }],
      ['Highway Autonomy', 'Higher-value software.', { pr: 0.05 }],
      ['Urban Autonomy', 'Complex driving, higher quality.', { q: 6 }],
      ['Sensor Fusion', 'Safer, better margins.', { mg: 0.05 }],
      ['Full Self-Driving', 'Unlocks a Self-Driving Stack.', { u: ['Self-Driving Stack', false] }],
    ] },
    { id: 'safety', icon: '⚖️', name: 'Alignment', levels: [
      ['Guardrails', 'Fewer incidents, lower costs.', { ct: 0.03 }],
      ['RLHF', 'Aligned models buyers trust.', { rc: 0.3 }],
      ['Interpretability', 'Enterprise-grade assurance.', { pr: 0.04 }],
      ['Scalable Oversight', 'Higher quality outputs.', { q: 5 }],
      ['AGI Alignment', 'Unlocks a Safe AGI platform.', { u: ['Safe AGI', false] }],
    ] },
  ], mass: [
    { id: 'agi', name: 'Artificial General Intelligence', desc: 'The ultimate bet — a civilisation-scale reward.', costMult: 500, secs: 1500, effect: { inc: 0.3, q: 10 } },
    { id: 'fleet', name: 'Robotaxi Fleet', desc: 'Autonomous fleets at global scale.', costMult: 340, secs: 1100, effect: { inc: 0.14, u: ['Robotaxi Service', false] } },
  ] },
};

/* --------------------------- Per-sector trees ----------------------------- */
const SECTOR_RESEARCH = {
  tech: COMPANY_RESEARCH.mango, // non-crafted electronics reuse the hardware tree

  semi: { categories: [
    { id: 'node', icon: '🔬', name: 'Process Node', levels: [
      ['7nm', 'Modern, efficient silicon.', { inc: 0.05 }],
      ['5nm', 'Denser, faster chips.', { pr: 0.05 }],
      ['3nm', 'Leading edge commands a premium.', { pr: 0.05 }],
      ['2nm', 'Frontier node, top quality.', { q: 7 }],
      ['Sub-1nm', 'Unlocks Neuromorphic Chips.', { u: ['Neuromorphic Chips', true] }],
    ] },
    { id: 'pack', icon: '📦', name: 'Packaging', levels: [
      ['Flip-Chip', 'Reliable, cheap packaging.', { ct: 0.03 }],
      ['2.5D Interposer', 'Higher bandwidth parts.', { pr: 0.04 }],
      ['3D Stacking', 'Denser, higher quality.', { q: 6 }],
      ['Chiplets', 'Modular design widens margins.', { mg: 0.05 }],
      ['Photonic I/O', 'Unlocks Optical Interconnect chips.', { u: ['Optical Interconnect', true] }],
    ] },
    { id: 'yield', icon: '📈', name: 'Yield & Fab', levels: [
      ['Process Control', 'Fewer defects, lower cost.', { ct: 0.04 }],
      ['EUV Lithography', 'Sharper patterning.', { q: 5 }],
      ['Defect AI', 'Higher yields widen margins.', { mg: 0.05 }],
      ['High-NA EUV', 'Next-gen precision.', { q: 5 }],
      ['Gigafab', 'Massive scale lifts income.', { inc: 0.08 }],
    ] },
    { id: 'design', icon: '⚙️', name: 'Architecture', levels: [
      ['RISC Cores', 'Efficient designs.', { inc: 0.04 }],
      ['Big.Little', 'Power/perf balance sells.', { pr: 0.04 }],
      ['AI Accelerators', 'Ride the AI wave.', { pr: 0.06 }],
      ['In-Memory Compute', 'Radical efficiency, high quality.', { q: 6 }],
      ['Wafer-Scale Engine', 'Unlocks a Wafer-Scale AI chip.', { u: ['Wafer-Scale AI', true] }],
    ] },
  ], mass: [
    { id: 'quantumchip', name: 'Quantum Processor', desc: 'A working quantum chip — a generational reward.', costMult: 420, secs: 1300, effect: { pr: 0.1, u: ['Quantum Processor', true] } },
    { id: 'megafab', name: 'Continental Megafab', desc: 'Own the world’s largest fab.', costMult: 360, secs: 1100, effect: { ct: 0.08, inc: 0.12 } },
  ] },

  auto: { categories: [
    { id: 'batt', icon: '🔋', name: 'Batteries', levels: [
      ['Lithium Pack', 'Solid range and cost.', { inc: 0.05 }],
      ['Fast Charging', 'A must-have feature.', { rc: 0.3 }],
      ['High-Density Cells', 'More range, higher price.', { pr: 0.05 }],
      ['In-House Cells', 'Owning cells widens margins.', { mg: 0.06 }],
      ['Solid-State', 'Unlocks a Long-Range EV.', { u: ['Long-Range EV', true] }],
    ] },
    { id: 'auto', icon: '🧭', name: 'Autonomy', levels: [
      ['Driver Assist', 'A selling point.', { rc: 0.3 }],
      ['Highway Pilot', 'Software revenue.', { pr: 0.05 }],
      ['Urban Autonomy', 'Complex driving, high quality.', { q: 6 }],
      ['Sensor Fusion', 'Safer, better margins.', { mg: 0.05 }],
      ['Full Self-Driving', 'Unlocks a Robotaxi.', { u: ['Robotaxi', false] }],
    ] },
    { id: 'plat', icon: '🏎️', name: 'Platform', levels: [
      ['Skateboard Chassis', 'Efficient shared platform.', { ct: 0.04 }],
      ['800V Architecture', 'Faster charging, premium.', { pr: 0.04 }],
      ['Megacasting', 'Cheaper to build.', { mg: 0.05 }],
      ['Active Suspension', 'A quality leap.', { q: 6 }],
      ['Performance EV', 'Unlocks a Hypercar.', { u: ['Electric Hypercar', true] }],
    ] },
    { id: 'soft', icon: '💻', name: 'Software', levels: [
      ['Infotainment', 'A modern cabin sells.', { inc: 0.04 }],
      ['OTA Updates', 'Cars that improve over time.', { rc: 0.3 }],
      ['Connected Services', 'Recurring revenue.', { inc: 0.06 }],
      ['In-Car AI', 'Higher quality experience.', { q: 5 }],
      ['Software Subscriptions', 'Unlocks a Software Suite.', { u: ['Car Software Suite', false] }],
    ] },
  ], mass: [
    { id: 'gigafactory', name: 'Gigafactory Network', desc: 'Vertical battery + vehicle scale.', costMult: 340, secs: 1100, effect: { mg: 0.08, inc: 0.12 } },
    { id: 'robotaxi', name: 'Autonomous Fleet', desc: 'A driverless ride-hail network.', costMult: 380, secs: 1200, effect: { inc: 0.16, u: ['Robotaxi Fleet', false] } },
  ] },

  fintech: { categories: [
    { id: 'rails', icon: '⚡', name: 'Payment Rails', levels: [
      ['Card Rails', 'The basics, done well.', { inc: 0.05 }],
      ['Real-Time Rails', 'Instant money moves users.', { rc: 0.3 }],
      ['Cross-Border', 'Global transfers, higher fees.', { pr: 0.05 }],
      ['Stablecoin Rails', 'Cheap settlement widens margins.', { mg: 0.05 }],
      ['Programmable Money', 'Unlocks an Embedded Finance API.', { u: ['Embedded Finance API', false] }],
    ] },
    { id: 'fraud', icon: '🛡️', name: 'Risk & Fraud', levels: [
      ['Rules Engine', 'Fewer losses.', { ct: 0.03 }],
      ['Fraud AI', 'Trust that scales.', { rc: 0.3 }],
      ['Behavioural Biometrics', 'Premium security.', { pr: 0.04 }],
      ['Real-Time Scoring', 'Better margins.', { mg: 0.05 }],
      ['Autonomous Risk', 'Unlocks a Fraud Shield product.', { u: ['Fraud Shield', false] }],
    ] },
    { id: 'bank', icon: '🏦', name: 'Banking', levels: [
      ['Digital Wallet', 'Everyday money app.', { inc: 0.05 }],
      ['Neobank Accounts', 'Full banking, low cost.', { mg: 0.05 }],
      ['Lending', 'Credit revenue.', { pr: 0.05 }],
      ['Wealth Tools', 'Higher-value customers.', { q: 5 }],
      ['Super App', 'Unlocks a financial Super App.', { u: ['Super App', false] }],
    ] },
    { id: 'merch', icon: '🛒', name: 'Merchant Tools', levels: [
      ['Checkout', 'Convert more sales.', { inc: 0.05 }],
      ['POS Systems', 'In-person revenue.', { pr: 0.04 }],
      ['BNPL', 'Bigger baskets.', { inc: 0.05 }],
      ['Analytics', 'Sticky, high quality.', { q: 5 }],
      ['Commerce Platform', 'Unlocks a Commerce Platform.', { u: ['Commerce Platform', false] }],
    ] },
  ], mass: [
    { id: 'globalrail', name: 'Global Settlement Network', desc: 'Own the rails the world pays on.', costMult: 320, secs: 1100, effect: { inc: 0.18 } },
    { id: 'cbdc', name: 'Digital Currency Platform', desc: 'Power national digital currencies.', costMult: 300, secs: 1000, effect: { mg: 0.08, u: ['Digital Currency', false] } },
  ] },

  bank: { categories: [
    { id: 'digital', icon: '📲', name: 'Digital Banking', levels: [
      ['Online Banking', 'Meet customers online.', { inc: 0.05 }],
      ['Mobile-First', 'Younger customers flock in.', { rc: 0.3 }],
      ['AI Assistant', 'Service that scales.', { mg: 0.04 }],
      ['Instant Onboarding', 'Higher quality experience.', { q: 5 }],
      ['App-Only Bank', 'Unlocks a Digital Bank brand.', { u: ['Digital Bank', false] }],
    ] },
    { id: 'risk', icon: '📊', name: 'Underwriting', levels: [
      ['Credit Scoring', 'Lend more safely.', { ct: 0.03 }],
      ['AI Underwriting', 'Approve faster, lose less.', { mg: 0.05 }],
      ['Alt-Data Models', 'New markets open up.', { inc: 0.05 }],
      ['Real-Time Risk', 'Premium products.', { pr: 0.04 }],
      ['Autonomous Lending', 'Unlocks Instant Loans.', { u: ['Instant Loans', false] }],
    ] },
    { id: 'wealth', icon: '💼', name: 'Wealth', levels: [
      ['Advisory', 'High-value relationships.', { pr: 0.05 }],
      ['Robo-Advisor', 'Scaled investing.', { inc: 0.05 }],
      ['Alternatives', 'Exclusive high-margin products.', { mg: 0.05 }],
      ['Family Office', 'Top-tier quality service.', { q: 6 }],
      ['Private Banking', 'Unlocks Private Banking.', { u: ['Private Banking', false] }],
    ] },
    { id: 'sec', icon: '🔒', name: 'Security', levels: [
      ['Fraud Rules', 'Fewer losses.', { ct: 0.03 }],
      ['Fraud AI', 'Customer trust.', { rc: 0.3 }],
      ['Biometric Auth', 'Premium safety.', { pr: 0.04 }],
      ['Zero-Trust', 'Higher assurance quality.', { q: 5 }],
      ['Quantum-Safe', 'Unlocks a Secure Vault product.', { u: ['Secure Vault', false] }],
    ] },
  ], mass: [
    { id: 'ib', name: 'Global Investment Bank', desc: 'Compete at the top of finance.', costMult: 360, secs: 1100, effect: { inc: 0.16, mg: 0.05 } },
    { id: 'cbdc', name: 'Digital Currency Rails', desc: 'Bank the digital-money era.', costMult: 300, secs: 1000, effect: { mg: 0.08 } },
  ] },

  pharma: { categories: [
    { id: 'discovery', icon: '🧬', name: 'Drug Discovery', levels: [
      ['HTS Screening', 'Find candidates faster.', { inc: 0.05 }],
      ['AI Discovery', 'Cheaper pipelines.', { mg: 0.05 }],
      ['Biologics', 'High-value medicines.', { pr: 0.06 }],
      ['mRNA Platform', 'A quality platform leap.', { q: 7 }],
      ['Gene Therapy', 'Unlocks a Gene Therapy line.', { u: ['Gene Therapy', false] }],
    ] },
    { id: 'trials', icon: '🧪', name: 'Clinical Trials', levels: [
      ['Phase I', 'Prove it’s safe.', { inc: 0.04 }],
      ['Adaptive Trials', 'Faster to market.', { rc: 0.3 }],
      ['Global Phase III', 'Approval at scale.', { pr: 0.05 }],
      ['Real-World Evidence', 'Stronger label, higher quality.', { q: 6 }],
      ['Digital Trials', 'Unlocks a Precision Medicine.', { u: ['Precision Medicine', false] }],
    ] },
    { id: 'manu', icon: '🏭', name: 'Manufacturing', levels: [
      ['GMP Facilities', 'Reliable supply.', { ct: 0.03 }],
      ['Continuous Manufacturing', 'Cheaper production.', { mg: 0.05 }],
      ['Cold Chain', 'Enables biologics reach.', { inc: 0.05 }],
      ['Cell Therapy Suites', 'High quality, high value.', { q: 6 }],
      ['Personalised Production', 'Unlocks Cell Therapies.', { u: ['Cell Therapy', false] }],
    ] },
    { id: 'diag', icon: '🔬', name: 'Diagnostics', levels: [
      ['Lab Tests', 'Steady revenue.', { inc: 0.04 }],
      ['Companion Diagnostics', 'Pairs with drugs.', { pr: 0.04 }],
      ['Liquid Biopsy', 'Early detection premium.', { pr: 0.05 }],
      ['AI Pathology', 'Higher quality results.', { q: 5 }],
      ['At-Home Diagnostics', 'Unlocks a Home Test line.', { u: ['Home Diagnostics', false] }],
    ] },
  ], mass: [
    { id: 'cure', name: 'Cancer Cure Program', desc: 'A breakthrough that reshapes medicine.', costMult: 480, secs: 1400, effect: { inc: 0.25, u: ['Oncology Cure', false] } },
    { id: 'longevity', name: 'Longevity Therapeutics', desc: 'Slow ageing itself.', costMult: 420, secs: 1300, effect: { pr: 0.12, q: 8 } },
  ] },

  energy: { categories: [
    { id: 'extract', icon: '🛢️', name: 'Extraction', levels: [
      ['Onshore Drilling', 'Bread-and-butter output.', { inc: 0.05 }],
      ['Shale Fracking', 'Unlock more reserves.', { inc: 0.06 }],
      ['Deepwater', 'High-value fields.', { pr: 0.05 }],
      ['Enhanced Recovery', 'More from each well.', { mg: 0.05 }],
      ['Arctic Reserves', 'Unlocks new Reserves.', { u: ['Arctic Reserves', true] }],
    ] },
    { id: 'refine', icon: '⚗️', name: 'Refining', levels: [
      ['Basic Refining', 'Turn crude to product.', { inc: 0.04 }],
      ['Catalytic Cracking', 'Higher yields.', { mg: 0.05 }],
      ['Petrochemicals', 'Premium products.', { pr: 0.05 }],
      ['Cleaner Fuels', 'Better quality mix.', { q: 5 }],
      ['Advanced Petrochem', 'Unlocks a Petrochemical line.', { u: ['Advanced Petrochemicals', true] }],
    ] },
    { id: 'clean', icon: '🌱', name: 'Clean Energy', levels: [
      ['Solar', 'Diversify the mix.', { inc: 0.05 }],
      ['Wind', 'Scale renewables.', { inc: 0.05 }],
      ['Carbon Capture', 'Cleaner ops cut costs.', { ct: 0.05 }],
      ['Green Hydrogen', 'A high-quality new fuel.', { q: 6 }],
      ['Hydrogen Plants', 'Unlocks Hydrogen Fuel.', { u: ['Hydrogen Fuel', true] }],
    ] },
    { id: 'logi', icon: '🚢', name: 'Logistics', levels: [
      ['Pipelines', 'Move product cheaply.', { ct: 0.04 }],
      ['LNG Terminals', 'Export revenue.', { inc: 0.06 }],
      ['Global Shipping', 'Reach world markets.', { pr: 0.04 }],
      ['Smart Grid Tie-In', 'Higher quality delivery.', { q: 5 }],
      ['Global Trading Desk', 'Unlocks Energy Trading.', { u: ['Energy Trading', false] }],
    ] },
  ], mass: [
    { id: 'fusion', name: 'Fusion Power Plant', desc: 'Limitless clean energy.', costMult: 500, secs: 1500, effect: { inc: 0.25, u: ['Fusion Power', true] } },
    { id: 'ccs', name: 'Continental Carbon Capture', desc: 'Turn emissions into revenue.', costMult: 360, secs: 1100, effect: { ct: 0.1, mg: 0.06 } },
  ] },

  telecom: { categories: [
    { id: 'net', icon: '📡', name: 'Network', levels: [
      ['4G Upgrade', 'Solid coverage.', { inc: 0.05 }],
      ['5G Rollout', 'Faster, more valuable plans.', { pr: 0.05 }],
      ['5G Standalone', 'New enterprise revenue.', { inc: 0.06 }],
      ['Network Slicing', 'Premium quality service.', { q: 6 }],
      ['6G Research', 'Unlocks a 6G tier.', { u: ['6G Network', false] }],
    ] },
    { id: 'fiber', icon: '🕸️', name: 'Fibre & Broadband', levels: [
      ['DSL', 'Baseline broadband.', { inc: 0.03 }],
      ['Cable', 'Faster home internet.', { inc: 0.05 }],
      ['Fibre to the Home', 'Premium speeds.', { pr: 0.05 }],
      ['Multi-Gig', 'Top-tier quality.', { q: 5 }],
      ['Fixed Wireless', 'Unlocks a Fixed-Wireless product.', { u: ['Fixed Wireless', false] }],
    ] },
    { id: 'sat', icon: '🛰️', name: 'Satellite', levels: [
      ['Ground Stations', 'Backhaul reach.', { ct: 0.03 }],
      ['LEO Partnership', 'Rural coverage.', { inc: 0.05 }],
      ['Direct-to-Cell', 'A killer feature.', { rc: 0.3 }],
      ['Own Constellation', 'High quality coverage.', { q: 6 }],
      ['Satellite Internet', 'Unlocks Satellite Internet.', { u: ['Satellite Internet', false] }],
    ] },
    { id: 'ent', icon: '🏢', name: 'Enterprise', levels: [
      ['Business Plans', 'Higher-value accounts.', { pr: 0.04 }],
      ['Private Networks', 'Industrial revenue.', { inc: 0.05 }],
      ['Edge Compute', 'New premium service.', { pr: 0.05 }],
      ['IoT Platform', 'Sticky, high quality.', { q: 5 }],
      ['Enterprise Cloud', 'Unlocks an Enterprise Suite.', { u: ['Enterprise Connectivity', false] }],
    ] },
  ], mass: [
    { id: 'nationwide', name: 'Nationwide 5G+', desc: 'Blanket the country in next-gen coverage.', costMult: 340, secs: 1100, effect: { inc: 0.16 } },
    { id: 'constellation', name: 'Own Satellite Constellation', desc: 'Global coverage from orbit.', costMult: 420, secs: 1300, effect: { pr: 0.1, u: ['Global Satellite', false] } },
  ] },

  industrial: { categories: [
    { id: 'auto', icon: '🤖', name: 'Automation', levels: [
      ['PLC Control', 'Reliable automation.', { inc: 0.05 }],
      ['Industrial Robots', 'Faster lines.', { pr: 0.05 }],
      ['Cobots', 'Flexible factories.', { mg: 0.05 }],
      ['Digital Twin', 'Higher quality output.', { q: 6 }],
      ['Lights-Out Factory', 'Unlocks Autonomous Factories.', { u: ['Autonomous Factory', true] }],
    ] },
    { id: 'power', icon: '⚡', name: 'Power Systems', levels: [
      ['Efficient Motors', 'Lower running costs.', { ct: 0.04 }],
      ['High-Output Turbines', 'Premium machinery.', { pr: 0.05 }],
      ['Grid Turbines', 'Utility-scale revenue.', { inc: 0.05 }],
      ['Hydrogen Turbines', 'Clean, high quality.', { q: 6 }],
      ['Fusion-Ready Systems', 'Unlocks a Power Plant line.', { u: ['Power Plants', true] }],
    ] },
    { id: 'iot', icon: '📶', name: 'Industrial IoT', levels: [
      ['Sensors', 'Data from the floor.', { inc: 0.04 }],
      ['Predictive Maintenance', 'Less downtime.', { mg: 0.05 }],
      ['Fleet Telematics', 'Service revenue.', { pr: 0.04 }],
      ['Edge AI', 'Higher quality control.', { q: 5 }],
      ['Autonomous Ops', 'Unlocks a Smart-Factory suite.', { u: ['Smart Factory Suite', false] }],
    ] },
    { id: 'mat', icon: '🧱', name: 'Advanced Materials', levels: [
      ['Alloys', 'Stronger, cheaper.', { ct: 0.03 }],
      ['Composites', 'Lighter, premium.', { pr: 0.04 }],
      ['Additive Manufacturing', '3D-printed parts.', { mg: 0.05 }],
      ['Nanomaterials', 'A quality leap.', { q: 6 }],
      ['Metamaterials', 'Unlocks Advanced Components.', { u: ['Advanced Components', true] }],
    ] },
  ], mass: [
    { id: 'megafactory', name: 'Autonomous Megafactory', desc: 'A fully self-running plant.', costMult: 360, secs: 1100, effect: { ct: 0.08, inc: 0.12 } },
    { id: 'robotics', name: 'Industrial Robotics Line', desc: 'Sell robots to every factory.', costMult: 320, secs: 1000, effect: { inc: 0.14, u: ['Industrial Robots', true] } },
  ] },

  utility: { categories: [
    { id: 'grid', icon: '🔌', name: 'Grid Tech', levels: [
      ['Grid Upgrades', 'Fewer outages.', { ct: 0.04 }],
      ['Smart Meters', 'Efficient billing.', { mg: 0.04 }],
      ['Smart Grid', 'Dynamic, high quality.', { q: 6 }],
      ['Demand Response', 'Sell flexibility.', { inc: 0.05 }],
      ['Self-Healing Grid', 'Unlocks a Grid Services product.', { u: ['Grid Services', true] }],
    ] },
    { id: 'renew', icon: '🌞', name: 'Renewables', levels: [
      ['Solar Farms', 'Clean generation.', { inc: 0.05 }],
      ['Wind Farms', 'Scale renewables.', { inc: 0.05 }],
      ['Hydro', 'Reliable baseload.', { mg: 0.04 }],
      ['Offshore Wind', 'High quality capacity.', { q: 6 }],
      ['Geothermal', 'Unlocks a Clean Power tier.', { u: ['Clean Power', true] }],
    ] },
    { id: 'store', icon: '🔋', name: 'Storage', levels: [
      ['Pumped Hydro', 'Store the surplus.', { ct: 0.03 }],
      ['Grid Batteries', 'Sell peak power.', { pr: 0.05 }],
      ['Long-Duration Storage', 'Days of backup.', { inc: 0.05 }],
      ['Flow Batteries', 'High quality storage.', { q: 5 }],
      ['Green Hydrogen Storage', 'Unlocks Storage-as-a-Service.', { u: ['Storage Services', true] }],
    ] },
    { id: 'nuke', icon: '☢️', name: 'Advanced Power', levels: [
      ['Reactor Upgrades', 'More from existing plants.', { mg: 0.05 }],
      ['SMRs', 'Modular nuclear.', { pr: 0.05 }],
      ['Advanced Reactors', 'Clean baseload.', { inc: 0.06 }],
      ['Fusion Research', 'A quality moonshot.', { q: 7 }],
      ['Fusion Pilot', 'Unlocks a Fusion Plant.', { u: ['Fusion Plant', true] }],
    ] },
  ], mass: [
    { id: 'fusion', name: 'Grid-Scale Fusion', desc: 'Power a nation, cleanly.', costMult: 500, secs: 1500, effect: { inc: 0.25, u: ['Fusion Power', true] } },
    { id: 'supergrid', name: 'Continental Supergrid', desc: 'One grid, one continent.', costMult: 360, secs: 1100, effect: { ct: 0.1, inc: 0.1 } },
  ] },

  retail: { categories: [
    { id: 'chain', icon: '🚚', name: 'Supply Chain', levels: [
      ['Regional DCs', 'Faster restocking.', { ct: 0.04 }],
      ['Supply-Chain AI', 'Less waste, more margin.', { mg: 0.05 }],
      ['Same-Day Delivery', 'A feature customers love.', { rc: 0.3 }],
      ['Automated Warehouses', 'High quality fulfilment.', { q: 6 }],
      ['Drone Delivery', 'Unlocks a Rapid Delivery service.', { u: ['Rapid Delivery', false] }],
    ] },
    { id: 'online', icon: '🛒', name: 'E-Commerce', levels: [
      ['Web Store', 'Sell online.', { inc: 0.05 }],
      ['Mobile App', 'More conversions.', { inc: 0.05 }],
      ['Personalisation', 'Bigger baskets.', { pr: 0.04 }],
      ['Live Shopping', 'A quality experience.', { q: 5 }],
      ['Marketplace', 'Unlocks a Marketplace platform.', { u: ['Online Marketplace', false] }],
    ] },
    { id: 'loyal', icon: '⭐', name: 'Loyalty', levels: [
      ['Points Program', 'Repeat customers.', { inc: 0.04 }],
      ['Membership Club', 'Recurring revenue.', { mg: 0.05 }],
      ['Personalised Offers', 'Higher spend.', { pr: 0.04 }],
      ['Premium Tier', 'High quality perks.', { q: 5 }],
      ['Retail Media', 'Unlocks a Retail Ads product.', { u: ['Retail Media Network', false] }],
    ] },
    { id: 'store', icon: '🏬', name: 'Stores', levels: [
      ['Store Refresh', 'A better experience.', { rc: 0.3 }],
      ['Self-Checkout', 'Lower costs.', { ct: 0.04 }],
      ['Checkout-Free', 'A wow feature.', { pr: 0.04 }],
      ['Smart Shelves', 'High quality ops.', { q: 5 }],
      ['Autonomous Stores', 'Unlocks Autonomous Stores.', { u: ['Autonomous Stores', false] }],
    ] },
  ], mass: [
    { id: 'globallog', name: 'Global Logistics Network', desc: 'Own the fastest supply chain on earth.', costMult: 340, secs: 1100, effect: { ct: 0.08, inc: 0.12 } },
    { id: 'retailmedia', name: 'Retail Media Empire', desc: 'Turn your stores into an ad network.', costMult: 300, secs: 1000, effect: { mg: 0.08 } },
  ] },

  consumer: { categories: [
    { id: 'product', icon: '🧪', name: 'Product Innovation', levels: [
      ['Reformulation', 'A better product.', { inc: 0.05 }],
      ['New Flavours/Lines', 'Fresh demand.', { rc: 0.3 }],
      ['Premium Range', 'Higher price points.', { pr: 0.05 }],
      ['Functional Benefits', 'A quality edge.', { q: 6 }],
      ['Super-Premium Line', 'Unlocks a Super-Premium line.', { u: ['Super-Premium Line', true] }],
    ] },
    { id: 'brand', icon: '✨', name: 'Brand', levels: [
      ['Rebrand', 'Modern appeal.', { rc: 0.3 }],
      ['Global Campaign', 'Wider reach.', { inc: 0.05 }],
      ['Celebrity Line', 'Buzz and price power.', { pr: 0.05 }],
      ['Brand Equity', 'A quality halo.', { q: 5 }],
      ['Iconic Status', 'Unlocks a Signature Collection.', { u: ['Signature Collection', true] }],
    ] },
    { id: 'chain', icon: '🚚', name: 'Distribution', levels: [
      ['Regional DCs', 'Faster shelves.', { ct: 0.03 }],
      ['National Rollout', 'More reach.', { inc: 0.05 }],
      ['DTC Channel', 'Higher margins direct.', { mg: 0.05 }],
      ['Global Expansion', 'A quality footprint.', { q: 5 }],
      ['Own Retail', 'Unlocks a Flagship Store line.', { u: ['Flagship Stores', false] }],
    ] },
    { id: 'green', icon: '♻️', name: 'Sustainability', levels: [
      ['Recyclable Packaging', 'Cost and image win.', { ct: 0.03 }],
      ['Sustainable Sourcing', 'Consumer trust.', { rc: 0.3 }],
      ['Carbon-Neutral', 'A premium story.', { pr: 0.04 }],
      ['Circular Products', 'High quality ethos.', { q: 5 }],
      ['Regenerative Line', 'Unlocks an Eco line.', { u: ['Eco Line', true] }],
    ] },
  ], mass: [
    { id: 'globalbrand', name: 'Global Megabrand', desc: 'Build a brand everyone knows.', costMult: 300, secs: 1000, effect: { inc: 0.16 } },
    { id: 'dtc', name: 'Direct-to-Consumer Empire', desc: 'Own the customer relationship.', costMult: 280, secs: 900, effect: { mg: 0.08 } },
  ] },

  media: { categories: [
    { id: 'content', icon: '🎬', name: 'Content', levels: [
      ['Licensed Library', 'Something to watch.', { inc: 0.05 }],
      ['Originals', 'Reasons to subscribe.', { rc: 0.3 }],
      ['Blockbuster Franchise', 'Premium pricing power.', { pr: 0.05 }],
      ['Award-Winning', 'A quality reputation.', { q: 6 }],
      ['Cinematic Universe', 'Unlocks a Franchise line.', { u: ['Blockbuster Franchise', false] }],
    ] },
    { id: 'tech', icon: '📺', name: 'Streaming Tech', levels: [
      ['Adaptive Streaming', 'Smooth playback.', { inc: 0.04 }],
      ['Recommendation AI', 'More watch time.', { inc: 0.05 }],
      ['4K/HDR', 'Premium quality.', { pr: 0.04 }],
      ['Interactive Content', 'A quality leap.', { q: 5 }],
      ['Immersive Formats', 'Unlocks an Immersive product.', { u: ['Immersive Experiences', false] }],
    ] },
    { id: 'ads', icon: '💰', name: 'Monetisation', levels: [
      ['Subscriptions', 'Recurring revenue.', { inc: 0.05 }],
      ['Ad Tier', 'Reach price-sensitive viewers.', { inc: 0.05 }],
      ['Live Sports', 'Premium ad revenue.', { pr: 0.05 }],
      ['Shoppable Content', 'A quality new stream.', { q: 5 }],
      ['Global Ad Platform', 'Unlocks a Media Ad Network.', { u: ['Ad Network', false] }],
    ] },
    { id: 'games', icon: '🎮', name: 'Interactive', levels: [
      ['Mobile Games', 'A new audience.', { inc: 0.05 }],
      ['Live Service Games', 'Recurring revenue.', { mg: 0.05 }],
      ['Cloud Gaming', 'Play anywhere.', { pr: 0.04 }],
      ['AAA Studio', 'High quality titles.', { q: 6 }],
      ['Metaverse', 'Unlocks a Virtual World.', { u: ['Virtual World', false] }],
    ] },
  ], mass: [
    { id: 'studio', name: 'Global Studio Empire', desc: 'Make the biggest hits in the world.', costMult: 340, secs: 1100, effect: { inc: 0.16, q: 6 } },
    { id: 'sports', name: 'Global Sports Rights', desc: 'Own the games everyone watches.', costMult: 360, secs: 1100, effect: { pr: 0.1 } },
  ] },

  luxury: { categories: [
    { id: 'craft', icon: '✂️', name: 'Craftsmanship', levels: [
      ['Skilled Artisans', 'Quality customers feel.', { q: 5 }],
      ['Master Ateliers', 'A price premium.', { pr: 0.06 }],
      ['Heritage Techniques', 'Timeless appeal.', { rc: 0.3 }],
      ['Hand-Finishing', 'Best-in-class quality.', { q: 6 }],
      ['Bespoke Program', 'Unlocks a Made-to-Order line.', { u: ['Bespoke Atelier', true] }],
    ] },
    { id: 'mat', icon: '💎', name: 'Materials', levels: [
      ['Fine Leather', 'A premium base.', { pr: 0.05 }],
      ['Rare Materials', 'Scarcity sells.', { pr: 0.05 }],
      ['Ethical Sourcing', 'A modern luxury story.', { rc: 0.3 }],
      ['Precious Metals', 'A quality leap.', { q: 6 }],
      ['One-of-One Gems', 'Unlocks a High Jewellery line.', { u: ['High Jewellery', true] }],
    ] },
    { id: 'brand', icon: '👑', name: 'Brand & Retail', levels: [
      ['Flagship Boutiques', 'The full experience.', { rc: 0.3 }],
      ['Global Expansion', 'New markets.', { inc: 0.05 }],
      ['Celebrity Muse', 'Cultural cachet.', { pr: 0.05 }],
      ['Iconic Campaigns', 'A quality halo.', { q: 5 }],
      ['Private Salons', 'Unlocks a VIP Collection.', { u: ['VIP Collection', true] }],
    ] },
    { id: 'exp', icon: '🥂', name: 'Experience', levels: [
      ['Personal Shopping', 'Loyal clients.', { mg: 0.04 }],
      ['Members Club', 'Recurring luxury.', { inc: 0.05 }],
      ['Hospitality', 'Extend the brand.', { pr: 0.04 }],
      ['Art & Culture', 'A quality aura.', { q: 5 }],
      ['Luxury Hotels', 'Unlocks a Hospitality line.', { u: ['Luxury Hospitality', false] }],
    ] },
  ], mass: [
    { id: 'maison', name: 'Global Maison', desc: 'Build a house that defines luxury.', costMult: 340, secs: 1100, effect: { pr: 0.12, q: 6 } },
    { id: 'auction', name: 'One-of-One Masterpieces', desc: 'The rarest objects on earth.', costMult: 300, secs: 1000, effect: { pr: 0.1 } },
  ] },

  aerospace: { categories: [
    { id: 'engine', icon: '🔥', name: 'Propulsion', levels: [
      ['Turbofans', 'Reliable thrust.', { inc: 0.05 }],
      ['Geared Turbofan', 'Fuel efficiency sells.', { mg: 0.05 }],
      ['Open Rotor', 'Next-gen efficiency.', { pr: 0.05 }],
      ['Hydrogen Engine', 'A quality leap.', { q: 6 }],
      ['Hypersonic Propulsion', 'Unlocks a Hypersonic Jet.', { u: ['Hypersonic Jet', true] }],
    ] },
    { id: 'frame', icon: '🛩️', name: 'Airframe', levels: [
      ['Aluminium Airframe', 'Proven and cheap.', { ct: 0.03 }],
      ['Composite Airframe', 'Lighter, premium.', { pr: 0.04 }],
      ['Blended Wing', 'Radical efficiency.', { mg: 0.05 }],
      ['Morphing Wings', 'A quality leap.', { q: 6 }],
      ['Spaceplane Frame', 'Unlocks a Spaceplane.', { u: ['Spaceplane', true] }],
    ] },
    { id: 'avionics', icon: '📟', name: 'Avionics', levels: [
      ['Glass Cockpit', 'Modern flight deck.', { inc: 0.04 }],
      ['Fly-by-Wire', 'Safer, sells better.', { rc: 0.3 }],
      ['Autoland', 'Premium capability.', { pr: 0.04 }],
      ['AI Copilot', 'A quality edge.', { q: 5 }],
      ['Autonomous Flight', 'Unlocks Autonomous Aircraft.', { u: ['Autonomous Aircraft', true] }],
    ] },
    { id: 'space', icon: '🚀', name: 'Space & Defence', levels: [
      ['Satellites', 'Orbit revenue.', { inc: 0.05 }],
      ['Reusable Rockets', 'Cheaper launch.', { mg: 0.05 }],
      ['Missile Defence', 'High-value contracts.', { pr: 0.05 }],
      ['Space Station', 'A quality program.', { q: 6 }],
      ['Deep-Space Craft', 'Unlocks a Space Program.', { u: ['Space Program', true] }],
    ] },
  ], mass: [
    { id: 'ssto', name: 'Reusable Spaceplane', desc: 'Routine, cheap access to orbit.', costMult: 480, secs: 1400, effect: { pr: 0.12, u: ['Orbital Spaceplane', true] } },
    { id: 'fleet', name: 'Next-Gen Fleet Program', desc: 'Re-equip the world’s airlines.', costMult: 360, secs: 1100, effect: { inc: 0.16 } },
  ] },

  materials: { categories: [
    { id: 'extract', icon: '⛏️', name: 'Extraction', levels: [
      ['Open-Pit', 'Efficient bulk mining.', { inc: 0.05 }],
      ['Automated Mining', 'Lower cost per tonne.', { ct: 0.05 }],
      ['Deep Extraction', 'Reach richer seams.', { inc: 0.05 }],
      ['Precision Recovery', 'Higher grade, quality.', { q: 5 }],
      ['Deep-Sea Mining', 'Unlocks new Reserves.', { u: ['Deep-Sea Minerals', true] }],
    ] },
    { id: 'process', icon: '⚗️', name: 'Processing', levels: [
      ['Smelting', 'Turn ore to metal.', { inc: 0.04 }],
      ['Purity Refinement', 'Premium grades.', { pr: 0.05 }],
      ['Automated Processing', 'Better margins.', { mg: 0.05 }],
      ['Alloying', 'High quality output.', { q: 6 }],
      ['Advanced Composites', 'Unlocks Composite Materials.', { u: ['Advanced Composites', true] }],
    ] },
    { id: 'green', icon: '♻️', name: 'Sustainability', levels: [
      ['Water Recycling', 'Lower costs.', { ct: 0.04 }],
      ['Electrified Fleet', 'Cleaner ops.', { rc: 0.3 }],
      ['Carbon-Neutral Ops', 'A premium story.', { pr: 0.04 }],
      ['Tailings Reuse', 'Quality + savings.', { q: 5 }],
      ['Green Steel/Metal', 'Unlocks a Green Metals line.', { u: ['Green Metals', true] }],
    ] },
    { id: 'battmat', icon: '🔋', name: 'Battery Materials', levels: [
      ['Lithium', 'Ride the EV boom.', { inc: 0.06 }],
      ['Nickel & Cobalt', 'Battery-grade demand.', { pr: 0.05 }],
      ['Rare Earths', 'Strategic, high margin.', { mg: 0.06 }],
      ['Recycled Materials', 'A quality circular edge.', { q: 5 }],
      ['Solid-State Materials', 'Unlocks Battery Materials.', { u: ['Battery Materials', true] }],
    ] },
  ], mass: [
    { id: 'megamine', name: 'Autonomous Megamine', desc: 'The most efficient mine on earth.', costMult: 360, secs: 1100, effect: { ct: 0.1, inc: 0.12 } },
    { id: 'strategic', name: 'Strategic Minerals Reserve', desc: 'Corner critical materials.', costMult: 320, secs: 1000, effect: { mg: 0.08, pr: 0.06 } },
  ] },
};

/** Resolve a company's research tree (bespoke → sector → generic). */
function researchTreeFor(id, sector) {
  return COMPANY_RESEARCH[id] || SECTOR_RESEARCH[sector] || SECTOR_RESEARCH.consumer;
}
