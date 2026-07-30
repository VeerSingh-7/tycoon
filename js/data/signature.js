/* =========================================================================
 * data/signature.js — Each company's ONE-OF-A-KIND signature operation
 * -------------------------------------------------------------------------
 * Every managed company (all 48 stocks) gets a bespoke "Signature" division so
 * that managing it isn't just "make a product / fight rivals". Two structural
 * kinds keep the interaction varied across the roster:
 *
 *   • ladder   — a 5-step strategic PROGRAM unique to the company. You buy the
 *                next milestone (cost scales off base income); each grants a
 *                permanent, escalating perk.
 *   • doctrine — a 3-way strategic DIAL. Pick the stance that fits your play;
 *                each reshapes the economics with real trade-offs.
 *
 * Every company also has an always-on TRAIT — its structural edge — plus a
 * unique icon, title and tagline. Effects use the shared vocabulary:
 *   inc   income multiplier add        (+revenue)
 *   mg    product margin add
 *   pr    unit-price multiplier add
 *   ct    operating-cost cut add       (lower opex)
 *   share market-strength multiplier add (more market share)
 *   q     product-quality points add
 * The engine (js/techco.js) aggregates these into the live economy.
 * ========================================================================= */

const COMPANY_SIGNATURE = {
  /* ------------------------------ Technology ----------------------------- */
  mango: {
    icon: '🍎', title: 'Ecosystem Flywheel', tagline: 'Every device pulls buyers deeper in.',
    trait: { name: 'Fanatical Loyalty', desc: 'Owners rarely switch away — pricing power on tap.', effect: { pr: 0.04 } },
    kind: 'ladder',
    steps: [
      ['Retail Cathedrals', 'Flagship stores turn shoppers into believers.', { share: 0.05 }],
      ['Services Layer', 'Cloud, media and payments recur every month.', { inc: 0.06, mg: 0.03 }],
      ['Wearables Halo', 'Watches and earbuds deepen the ecosystem.', { pr: 0.05 }],
      ['Spatial Computing', 'A headset opens an entirely new frontier.', { q: 6 }],
      ['Walled Garden', 'Everything locks together — nobody leaves.', { inc: 0.10, mg: 0.05 }],
    ],
  },
  googol: {
    icon: '🌐', title: 'Data Doctrine', tagline: 'How aggressively do you monetise the world’s data?',
    trait: { name: 'Index of the World', desc: 'You see demand before anyone else does.', effect: { inc: 0.03 } },
    kind: 'doctrine',
    stances: [
      { id: 'ads', label: 'Ad-Funded', desc: 'Monetise every query — top revenue, thinner trust.', effect: { inc: 0.11, mg: -0.02 } },
      { id: 'balanced', label: 'Balanced', desc: 'Grow revenue while keeping users on side.', effect: { inc: 0.04, mg: 0.02 } },
      { id: 'privacy', label: 'Privacy-First', desc: 'Premium trust — steadier and higher margin.', effect: { mg: 0.10, ct: 0.03, inc: -0.02 } },
    ],
  },
  macrosoft: {
    icon: '🪟', title: 'Platform Lock-In', tagline: 'Own the desktop, then own the cloud.',
    trait: { name: 'Enterprise Gravity', desc: 'Once IT standardises on you, they never migrate.', effect: { mg: 0.04 } },
    kind: 'ladder',
    steps: [
      ['Suite Bundling', 'Bundle the apps every office already needs.', { inc: 0.05 }],
      ['Cloud Migration', 'Lift customers into your recurring cloud.', { inc: 0.07, mg: 0.03 }],
      ['Subscription Shift', 'Perpetual licences become monthly seats.', { mg: 0.06 }],
      ['AI Copilots', 'Embed an assistant in every workflow.', { q: 6, pr: 0.05 }],
      ['Enterprise Licensing', 'Multi-year contracts lock the whole stack.', { inc: 0.10, ct: 0.03 }],
    ],
  },
  faceblock: {
    icon: '💬', title: 'Feed Doctrine', tagline: 'Tune the algorithm — attention versus well-being.',
    trait: { name: 'Network Effects', desc: 'Everyone is here because everyone is here.', effect: { share: 0.05 } },
    kind: 'doctrine',
    stances: [
      { id: 'engage', label: 'Engagement-Max', desc: 'Maximise time-on-feed and ad loads.', effect: { inc: 0.12, mg: -0.02 } },
      { id: 'balanced', label: 'Balanced', desc: 'Healthy growth without burning trust.', effect: { inc: 0.05, mg: 0.02 } },
      { id: 'wellbeing', label: 'Well-being', desc: 'Slower feed, loyal users, premium brand.', effect: { mg: 0.09, share: 0.04, inc: -0.02 } },
    ],
  },
  auracle: {
    icon: '🧠', title: 'AGI Roadmap', tagline: 'Scale the models toward the frontier.',
    trait: { name: 'Frontier Compute', desc: 'A compute lead compounds into a capability lead.', effect: { q: 4 } },
    kind: 'ladder',
    steps: [
      ['Scaling Laws', 'Bigger models, predictably better outputs.', { q: 5 }],
      ['Multimodal', 'See, hear and speak — not just text.', { pr: 0.06 }],
      ['Autonomous Agents', 'Models that act, not just answer.', { inc: 0.08 }],
      ['World Models', 'Systems that understand cause and effect.', { q: 7, mg: 0.03 }],
      ['Self-Improvement', 'Research that accelerates its own research.', { inc: 0.12, mg: 0.04 }],
    ],
  },
  samsong: {
    icon: '🏭', title: 'Vertical Doctrine', tagline: 'Supply the industry, or beat it at retail.',
    trait: { name: 'Fab-to-Shelf', desc: 'You make the panels and chips inside your rivals’ gear.', effect: { ct: 0.03 } },
    kind: 'doctrine',
    stances: [
      { id: 'supplier', label: 'Component Supplier', desc: 'Sell parts to everyone — huge volume, slim margin.', effect: { inc: 0.10, mg: -0.03 } },
      { id: 'balanced', label: 'Balanced', desc: 'Parts plus own-brand devices.', effect: { inc: 0.04, mg: 0.02 } },
      { id: 'ownbrand', label: 'Own Brand', desc: 'Keep the best parts for your flagships.', effect: { mg: 0.09, pr: 0.05, inc: -0.02 } },
    ],
  },

  /* ---------------------------- Semiconductors --------------------------- */
  envidia: {
    icon: '🎛️', title: 'Accelerator Dynasty', tagline: 'Own the chips that train the world’s AI.',
    trait: { name: 'AI Gold Rush', desc: 'Every AI lab needs your accelerators, at any price.', effect: { pr: 0.05 } },
    kind: 'ladder',
    steps: [
      ['Developer Moat', 'A software toolchain nobody wants to leave.', { mg: 0.04 }],
      ['Data-Centre GPUs', 'Racks of accelerators for every hyperscaler.', { inc: 0.08 }],
      ['High-Speed Interconnect', 'Link thousands of chips into one brain.', { q: 6 }],
      ['Advanced Packaging', 'Cram more compute into every wafer.', { ct: 0.04, mg: 0.03 }],
      ['AI Supercomputers', 'Sell the whole datacentre, not just the chip.', { inc: 0.12, pr: 0.05 }],
    ],
  },
  silicon_isle: {
    icon: '🔬', title: 'Foundry Doctrine', tagline: 'Chase the leading edge, or milk mature nodes.',
    trait: { name: 'Process Leadership', desc: 'Whoever ships the smallest transistor wins the orders.', effect: { q: 3 } },
    kind: 'doctrine',
    stances: [
      { id: 'leading', label: 'Leading-Edge', desc: 'Bet billions on the newest node — top price, high cost.', effect: { pr: 0.09, ct: -0.03 } },
      { id: 'balanced', label: 'Balanced', desc: 'A healthy mix of new and proven nodes.', effect: { inc: 0.05, mg: 0.02 } },
      { id: 'mature', label: 'Mature Cash Cow', desc: 'Run depreciated fabs for pure cash.', effect: { mg: 0.09, ct: 0.05, pr: -0.03 } },
    ],
  },
  broadwave: {
    icon: '📡', title: 'Connectivity Stack', tagline: 'Every wireless signal pays you a toll.',
    trait: { name: 'Patent Fortress', desc: 'Standards-essential patents earn you a royalty on the whole industry.', effect: { mg: 0.05 } },
    kind: 'ladder',
    steps: [
      ['5G Modems', 'The radio inside every flagship phone.', { inc: 0.06 }],
      ['Wi-Fi & Bluetooth', 'Short-range radios in billions of devices.', { share: 0.04 }],
      ['RF Front-End', 'The analog magic phones can’t do without.', { mg: 0.05 }],
      ['Automotive Silicon', 'Cars become computers on wheels.', { inc: 0.07 }],
      ['Satellite Direct', 'Connect phones straight to orbit.', { pr: 0.06, q: 5 }],
    ],
  },
  lithosystems: {
    icon: '💡', title: 'Toolmaker Doctrine', tagline: 'The bottleneck of the entire chip industry.',
    trait: { name: 'EUV Monopoly', desc: 'No one else can build your machines. No one.', effect: { pr: 0.06 } },
    kind: 'doctrine',
    stances: [
      { id: 'sell', label: 'Sell to All', desc: 'Ship tools to every fab — maximum volume.', effect: { inc: 0.10, mg: -0.02 } },
      { id: 'balanced', label: 'Balanced', desc: 'Broad sales with healthy service revenue.', effect: { inc: 0.05, mg: 0.03 } },
      { id: 'exclusive', label: 'Exclusive Partner', desc: 'Favour a few champions — scarcity lifts price.', effect: { pr: 0.09, mg: 0.05, inc: -0.03 } },
    ],
  },
  dmd: {
    icon: '⚡', title: 'Chiplet Comeback', tagline: 'Out-engineer the incumbent, piece by piece.',
    trait: { name: 'Underdog Efficiency', desc: 'You do more with a smaller, leaner design team.', effect: { ct: 0.04 } },
    kind: 'ladder',
    steps: [
      ['Chiplet Architecture', 'Small dies, glued together, cheaper to make.', { ct: 0.05 }],
      ['Server CPUs', 'Steal share in the datacentre.', { inc: 0.08 }],
      ['Discrete GPUs', 'Challenge for the graphics crown.', { share: 0.05 }],
      ['APUs Everywhere', 'One chip for consoles, handhelds, laptops.', { inc: 0.06, mg: 0.03 }],
      ['Custom Silicon', 'Design bespoke chips for the giants.', { pr: 0.05, mg: 0.04 }],
    ],
  },
  microne: {
    icon: '🧮', title: 'Memory Doctrine', tagline: 'Ride the memory cycle — or rise above it.',
    trait: { name: 'DRAM Cycle Rider', desc: 'Boom and bust — timing the cycle is everything.', effect: { inc: 0.03 } },
    kind: 'doctrine',
    stances: [
      { id: 'volume', label: 'Cyclical Volume', desc: 'Flood the market in the upcycle.', effect: { inc: 0.11, mg: -0.03 } },
      { id: 'balanced', label: 'Balanced', desc: 'Steady output across the cycle.', effect: { inc: 0.05, mg: 0.02 } },
      { id: 'hbm', label: 'Premium HBM', desc: 'High-bandwidth memory for AI — scarce, dear.', effect: { pr: 0.08, mg: 0.07, inc: -0.02 } },
    ],
  },

  /* -------------------------------- Retail ------------------------------- */
  amazen: {
    icon: '📦', title: 'Everything Store', tagline: 'Sell everything, then rent out the plumbing.',
    trait: { name: 'Customer Obsession', desc: 'Relentless focus on the buyer compounds share.', effect: { share: 0.05 } },
    kind: 'ladder',
    steps: [
      ['Infinite Marketplace', 'Third-party sellers list everything.', { inc: 0.06 }],
      ['Logistics Network', 'Own warehouses and delivery end-to-end.', { ct: 0.05 }],
      ['Prime Membership', 'Lock in loyalty with an annual fee.', { mg: 0.04, share: 0.04 }],
      ['Cloud Arm', 'Rent your own infrastructure to the world.', { inc: 0.10, mg: 0.05 }],
      ['Advertising Engine', 'Sellers pay to be seen first.', { mg: 0.06, inc: 0.05 }],
    ],
  },
  wallmarket: {
    icon: '🛒', title: 'Price Doctrine', tagline: 'Win on price, on convenience, or on both.',
    trait: { name: 'Supply-Chain Scale', desc: 'Nobody buys cheaper than you do.', effect: { ct: 0.04 } },
    kind: 'doctrine',
    stances: [
      { id: 'edlp', label: 'Everyday Low Price', desc: 'Undercut everyone — volume over margin.', effect: { inc: 0.10, mg: -0.03 } },
      { id: 'balanced', label: 'Balanced', desc: 'Low prices with a healthy basket.', effect: { inc: 0.05, mg: 0.02 } },
      { id: 'omni', label: 'Omnichannel', desc: 'Stores plus e-commerce plus pickup.', effect: { mg: 0.06, share: 0.05, inc: -0.02 } },
    ],
  },
  costko: {
    icon: '🏷️', title: 'Membership Machine', tagline: 'The fee is the profit; the goods are the bait.',
    trait: { name: 'Loyalty Renewal', desc: 'Members renew at rates that print money.', effect: { mg: 0.04 } },
    kind: 'ladder',
    steps: [
      ['Membership Fees', 'Charge for the right to shop.', { mg: 0.05 }],
      ['Bulk Buying Power', 'Pallet quantities crush unit costs.', { ct: 0.05 }],
      ['Private Label', 'Your own brand at unbeatable prices.', { mg: 0.05, inc: 0.04 }],
      ['Fuel & Pharmacy', 'Traffic drivers that pull members in.', { share: 0.05 }],
      ['Global Clubs', 'Export the warehouse model worldwide.', { inc: 0.09 }],
    ],
  },

  /* ------------------------------- Fintech ------------------------------- */
  yorkshire: {
    icon: '🏛️', title: 'Capital Doctrine', tagline: 'Deploy the float — grow, balance, or return it.',
    trait: { name: 'Float Advantage', desc: 'You hold other people’s money and invest the spread.', effect: { inc: 0.03 } },
    kind: 'doctrine',
    stances: [
      { id: 'growth', label: 'Growth Bets', desc: 'Plough capital into expansion.', effect: { inc: 0.11, mg: -0.02 } },
      { id: 'balanced', label: 'Balanced', desc: 'Grow while banking steady returns.', effect: { inc: 0.05, mg: 0.02 } },
      { id: 'buybacks', label: 'Buybacks', desc: 'Return cash, tighten the ship.', effect: { mg: 0.09, ct: 0.04, inc: -0.02 } },
    ],
  },
  vesa: {
    icon: '💳', title: 'Rails Empire', tagline: 'A toll booth on every transaction on Earth.',
    trait: { name: 'Network Toll', desc: 'You take a sliver of trillions in payment volume.', effect: { mg: 0.05 } },
    kind: 'ladder',
    steps: [
      ['Card Rails', 'The default way money moves.', { inc: 0.06 }],
      ['Tap-to-Pay', 'Every phone becomes a terminal.', { share: 0.04 }],
      ['Cross-Border', 'Skim the FX on global spend.', { mg: 0.05 }],
      ['Buy Now, Pay Later', 'Own the checkout financing.', { inc: 0.07 }],
      ['Embedded Finance', 'Payments baked into every app.', { inc: 0.09, mg: 0.04 }],
    ],
  },
  mistercard: {
    icon: '🔁', title: 'Interchange Doctrine', tagline: 'Chase volume, or chase premium spenders.',
    trait: { name: 'Two-Sided Network', desc: 'Banks and merchants both need you at the table.', effect: { share: 0.04 } },
    kind: 'doctrine',
    stances: [
      { id: 'volume', label: 'Volume', desc: 'Every swipe counts — chase raw scale.', effect: { inc: 0.10, mg: -0.02 } },
      { id: 'balanced', label: 'Balanced', desc: 'A broad, healthy mix of spend.', effect: { inc: 0.05, mg: 0.02 } },
      { id: 'premium', label: 'Premium Rewards', desc: 'Court big spenders with rich cards.', effect: { mg: 0.09, pr: 0.04, inc: -0.02 } },
    ],
  },

  /* -------------------------------- Banking ------------------------------ */
  morganpratt: {
    icon: '📊', title: 'Desk Doctrine', tagline: 'Which desk drives the bank — trading or advice?',
    trait: { name: 'Deal Flow', desc: 'Every big deal in the market crosses your desk.', effect: { inc: 0.03 } },
    kind: 'doctrine',
    stances: [
      { id: 'trading', label: 'Trading', desc: 'Lean into markets — big, volatile upside.', effect: { inc: 0.12, mg: -0.03 } },
      { id: 'balanced', label: 'Balanced', desc: 'A diversified universal bank.', effect: { inc: 0.05, mg: 0.02 } },
      { id: 'advisory', label: 'Advisory', desc: 'Fees over risk — steady and rich.', effect: { mg: 0.10, ct: 0.03, inc: -0.02 } },
    ],
  },
  bankameria: {
    icon: '🏦', title: 'Branch to Cloud', tagline: 'A retail bank that becomes a tech company.',
    trait: { name: 'Deposit Base', desc: 'Cheap deposits fund everything you do.', effect: { ct: 0.04 } },
    kind: 'ladder',
    steps: [
      ['Deposit Franchise', 'Millions of sticky checking accounts.', { ct: 0.04 }],
      ['Card Portfolio', 'Lend on plastic at healthy rates.', { mg: 0.05 }],
      ['Mortgage Engine', 'Underwrite the nation’s homes.', { inc: 0.07 }],
      ['Wealth Management', 'Fee income that never sleeps.', { mg: 0.05, inc: 0.04 }],
      ['Digital Bank', 'Close branches, scale the app.', { ct: 0.05, inc: 0.05 }],
    ],
  },
  goldstein: {
    icon: '🥂', title: 'Prestige Doctrine', tagline: 'The bank the elite call first.',
    trait: { name: 'Rolodex', desc: 'Relationships money simply can’t buy.', effect: { pr: 0.04 } },
    kind: 'doctrine',
    stances: [
      { id: 'prop', label: 'Prop Trading', desc: 'Put the firm’s capital to work.', effect: { inc: 0.12, mg: -0.03 } },
      { id: 'balanced', label: 'Balanced', desc: 'Markets and advisory in concert.', effect: { inc: 0.05, mg: 0.03 } },
      { id: 'advisory', label: 'White-Glove Advisory', desc: 'Advise the giants — pure fee margin.', effect: { mg: 0.11, pr: 0.05, inc: -0.03 } },
    ],
  },

  /* -------------------------------- Pharma ------------------------------- */
  elytilly: {
    icon: '💊', title: 'Pipeline Engine', tagline: 'One blockbuster funds the next ten.',
    trait: { name: 'Patent Protection', desc: 'A years-long monopoly on every approved drug.', effect: { pr: 0.05 } },
    kind: 'ladder',
    steps: [
      ['Blockbuster Franchise', 'A drug that defines a category.', { inc: 0.07 }],
      ['Oncology Platform', 'Cancer therapies command premium prices.', { pr: 0.06 }],
      ['Biologics', 'Complex molecules rivals can’t copy.', { mg: 0.06 }],
      ['Gene Therapy', 'One-time cures at extraordinary prices.', { pr: 0.07, q: 5 }],
      ['Discovery Platform', 'A machine that keeps finding new drugs.', { inc: 0.10, mg: 0.04 }],
    ],
  },
  jansen: {
    icon: '🧫', title: 'Portfolio Doctrine', tagline: 'Volume generics, or high-price specialty?',
    trait: { name: 'Regulatory Moat', desc: 'Approvals take years — and you already have them.', effect: { mg: 0.04 } },
    kind: 'doctrine',
    stances: [
      { id: 'generics', label: 'Generics Volume', desc: 'Cheap, ubiquitous, everywhere.', effect: { inc: 0.10, mg: -0.03 } },
      { id: 'balanced', label: 'Balanced', desc: 'A broad therapeutic portfolio.', effect: { inc: 0.05, mg: 0.02 } },
      { id: 'specialty', label: 'Specialty', desc: 'Rare-disease drugs at rare-disease prices.', effect: { pr: 0.08, mg: 0.07, inc: -0.02 } },
    ],
  },
  novanordisk: {
    icon: '🩸', title: 'Metabolic Franchise', tagline: 'Own the biology of chronic disease.',
    trait: { name: 'Chronic Demand', desc: 'Patients take your medicine for life.', effect: { inc: 0.04 } },
    kind: 'ladder',
    steps: [
      ['Insulin Heritage', 'A century of diabetes expertise.', { mg: 0.05 }],
      ['GLP-1 Class', 'A new mechanism, a new era.', { inc: 0.08 }],
      ['Weight-Loss', 'The biggest market in medicine.', { pr: 0.07, inc: 0.05 }],
      ['Oral Formulations', 'A pill replaces the needle.', { share: 0.05 }],
      ['Prevention', 'Treat the disease before it starts.', { inc: 0.09, mg: 0.04 }],
    ],
  },
  phizer: {
    icon: '💉', title: 'R&D Doctrine', tagline: 'Invent it in-house, or acquire the inventors.',
    trait: { name: 'Vaccine Platform', desc: 'Scaled manufacturing others can’t match.', effect: { ct: 0.03 } },
    kind: 'doctrine',
    stances: [
      { id: 'inhouse', label: 'In-House R&D', desc: 'Bet on your own labs — high risk, high reward.', effect: { inc: 0.10, q: 4, ct: -0.03 } },
      { id: 'balanced', label: 'Balanced', desc: 'Invent some, license some.', effect: { inc: 0.05, mg: 0.02 } },
      { id: 'acquire', label: 'Acquire Biotechs', desc: 'Buy proven pipelines outright.', effect: { mg: 0.08, inc: 0.03, ct: 0.03 } },
    ],
  },

  /* ------------------------------ Automotive ----------------------------- */
  tezla: {
    icon: '🔋', title: 'Gigafactory Buildout', tagline: 'Own the battery, own the future of cars.',
    trait: { name: 'Vertical Integration', desc: 'You build what rivals have to buy.', effect: { ct: 0.04 } },
    kind: 'ladder',
    steps: [
      ['Battery Gigafactory', 'Make cells at a scale nobody can match.', { ct: 0.05 }],
      ['Full Self-Driving', 'Software that sells at 90% margin.', { mg: 0.06, inc: 0.05 }],
      ['Energy Storage', 'Grid batteries as a second business.', { inc: 0.07 }],
      ['Robotaxi Network', 'Cars that earn money while you sleep.', { inc: 0.08, mg: 0.04 }],
      ['Humanoid Robots', 'The factory that builds itself.', { q: 6, inc: 0.06 }],
    ],
  },
  toyoda: {
    icon: '🚗', title: 'Powertrain Doctrine', tagline: 'Hedge the transition, or commit to it.',
    trait: { name: 'Kaizen Manufacturing', desc: 'Relentless efficiency on every assembly line.', effect: { ct: 0.04 } },
    kind: 'doctrine',
    stances: [
      { id: 'hybrid', label: 'Hybrid', desc: 'Bridge tech — proven, profitable, everywhere.', effect: { mg: 0.07, ct: 0.03, inc: -0.01 } },
      { id: 'balanced', label: 'Balanced', desc: 'A full range across every powertrain.', effect: { inc: 0.05, mg: 0.02 } },
      { id: 'ev', label: 'Full EV', desc: 'Go all-in on electric — costly but future-proof.', effect: { inc: 0.10, q: 4, mg: -0.03 } },
    ],
  },

  /* -------------------------------- Energy ------------------------------- */
  exonmobton: {
    icon: '🛢️', title: 'Barrel Doctrine', tagline: 'Pump hard, stay disciplined, or return cash.',
    trait: { name: 'Integrated Majors', desc: 'Wellhead to petrol station — you own it all.', effect: { ct: 0.03 } },
    kind: 'doctrine',
    stances: [
      { id: 'max', label: 'Max Production', desc: 'Drill flat-out while prices are high.', effect: { inc: 0.12, mg: -0.03 } },
      { id: 'balanced', label: 'Balanced', desc: 'Steady output across the price cycle.', effect: { inc: 0.05, mg: 0.02 } },
      { id: 'discipline', label: 'Discipline & Buybacks', desc: 'Restrain output, protect margins, return cash.', effect: { mg: 0.10, ct: 0.04, inc: -0.03 } },
    ],
  },
  chevrol: {
    icon: '⛽', title: 'Energy Transition', tagline: 'From barrels to electrons, one step at a time.',
    trait: { name: 'Reserves Replacement', desc: 'A deep bench of proven reserves underpins it all.', effect: { inc: 0.03 } },
    kind: 'ladder',
    steps: [
      ['Upstream Efficiency', 'Squeeze more from every well.', { ct: 0.05 }],
      ['LNG Exports', 'Ship gas to the highest bidder.', { inc: 0.07 }],
      ['Refining Margins', 'Turn crude into premium fuels.', { mg: 0.05 }],
      ['Carbon Capture', 'Sell emissions removal as a service.', { inc: 0.06 }],
      ['Renewables Arm', 'Solar, wind and hydrogen at scale.', { inc: 0.08, mg: 0.04 }],
    ],
  },

  /* --------------------------------- Media ------------------------------- */
  netflex: {
    icon: '🎬', title: 'Streaming Doctrine', tagline: 'Grow subscribers, or squeeze the profit.',
    trait: { name: 'Recommendation Engine', desc: 'You know what people want to watch next.', effect: { share: 0.04 } },
    kind: 'doctrine',
    stances: [
      { id: 'growth', label: 'Growth', desc: 'Spend big on content, chase every subscriber.', effect: { inc: 0.11, mg: -0.03 } },
      { id: 'balanced', label: 'Balanced', desc: 'Grow subscribers and margins together.', effect: { inc: 0.05, mg: 0.02 } },
      { id: 'profit', label: 'Profit + Ads', desc: 'Password crackdown, ad tier, discipline.', effect: { mg: 0.10, inc: 0.03 } },
    ],
  },
  dizzney: {
    icon: '🏰', title: 'Franchise Universe', tagline: 'One story, monetised a hundred ways.',
    trait: { name: 'Timeless IP Vault', desc: 'Characters that print money for generations.', effect: { pr: 0.05 } },
    kind: 'ladder',
    steps: [
      ['Film IP', 'Create the characters everyone loves.', { inc: 0.06 }],
      ['Franchise Sequels', 'Turn hits into decade-long sagas.', { pr: 0.05 }],
      ['Streaming Service', 'Own the pipe to every living room.', { inc: 0.07 }],
      ['Theme Parks', 'Walk inside the stories.', { mg: 0.06, inc: 0.04 }],
      ['Consumer Products', 'The IP on every shelf and lunchbox.', { mg: 0.05, share: 0.04 }],
    ],
  },
  zony: {
    icon: '🎮', title: 'Entertainment Empire', tagline: 'Consoles, studios, music — one flywheel.',
    trait: { name: 'Cross-Media Synergy', desc: 'A hit game becomes a hit show becomes a hit album.', effect: { inc: 0.03 } },
    kind: 'ladder',
    steps: [
      ['Console Platform', 'Own the box in the living room.', { share: 0.05 }],
      ['Exclusive Studios', 'Games you can only get from you.', { pr: 0.05 }],
      ['Live Services', 'Games that earn every single day.', { inc: 0.08, mg: 0.03 }],
      ['Music Catalogue', 'Royalties on a century of songs.', { mg: 0.05 }],
      ['Film & Anime', 'Turn the catalogue into blockbusters.', { inc: 0.07 }],
    ],
  },

  /* ------------------------------- Consumer ------------------------------ */
  proctorgambit: {
    icon: '🧴', title: 'Shelf Doctrine', tagline: 'Own the aisle with volume or with premium.',
    trait: { name: 'Category Captain', desc: 'Retailers let you plan the whole shelf.', effect: { share: 0.04 } },
    kind: 'doctrine',
    stances: [
      { id: 'volume', label: 'Volume Brands', desc: 'Everyday staples in every home.', effect: { inc: 0.10, mg: -0.02 } },
      { id: 'balanced', label: 'Balanced', desc: 'A ladder of brands at every price.', effect: { inc: 0.05, mg: 0.02 } },
      { id: 'premium', label: 'Premium Brands', desc: 'Trade shoppers up to richer margins.', effect: { mg: 0.09, pr: 0.04, inc: -0.02 } },
    ],
  },
  chokacola: {
    icon: '🥤', title: 'Bottled Empire', tagline: 'A secret formula and a global network.',
    trait: { name: 'Brand Recognition', desc: 'The most recognised label on Earth.', effect: { pr: 0.05 } },
    kind: 'ladder',
    steps: [
      ['Secret Formula', 'A taste nobody can legally copy.', { mg: 0.05 }],
      ['Bottling Network', 'Distribution into every corner shop.', { share: 0.05 }],
      ['Drink Portfolio', 'Water, juice, energy, coffee — all yours.', { inc: 0.07 }],
      ['Snacks Expansion', 'Pair every drink with a snack.', { inc: 0.05 }],
      ['Global Vending', 'A machine on every street.', { inc: 0.08, mg: 0.03 }],
    ],
  },
  pipsico: {
    icon: '🍟', title: 'Snack Doctrine', tagline: 'Tilt the mix toward drinks or toward snacks.',
    trait: { name: 'Impulse Aisle', desc: 'Front-of-store placement drives grab-and-go sales.', effect: { inc: 0.03 } },
    kind: 'doctrine',
    stances: [
      { id: 'bev', label: 'Beverage Focus', desc: 'Push the drinks portfolio hard.', effect: { inc: 0.09, mg: -0.02 } },
      { id: 'balanced', label: 'Balanced', desc: 'Drinks and snacks in harmony.', effect: { inc: 0.05, mg: 0.02 } },
      { id: 'snacks', label: 'Snacks Focus', desc: 'Chips and treats — the higher-margin half.', effect: { mg: 0.09, pr: 0.03, inc: -0.01 } },
    ],
  },
  nyke: {
    icon: '👟', title: 'Icon Building', tagline: 'Turn shoes into cultural status symbols.',
    trait: { name: 'Swoosh Effect', desc: 'The logo alone commands a premium.', effect: { pr: 0.05 } },
    kind: 'ladder',
    steps: [
      ['Athlete Endorsements', 'Put the best in the world in your gear.', { share: 0.04 }],
      ['Signature Lines', 'Icons with their own shoe.', { pr: 0.06 }],
      ['Direct-to-Consumer', 'Sell through your own app, keep the margin.', { mg: 0.06 }],
      ['Retro Drops', 'Scarcity turns sneakers into assets.', { pr: 0.05, mg: 0.03 }],
      ['Global Culture', 'A brand woven into sport and street.', { inc: 0.09 }],
    ],
  },

  /* -------------------------------- Luxury ------------------------------- */
  maisonlux: {
    icon: '👜', title: 'House of Heritage', tagline: 'A century of craft, priced accordingly.',
    trait: { name: 'Pricing Power', desc: 'You raise prices and demand only grows.', effect: { pr: 0.06 } },
    kind: 'ladder',
    steps: [
      ['Leather Atelier', 'Craftsmanship that justifies any price.', { mg: 0.05 }],
      ['Flagship Boutiques', 'Temples of the brand on every avenue.', { pr: 0.06 }],
      ['Runway Shows', 'Set the trends the world follows.', { share: 0.04 }],
      ['Celebrity Muses', 'The famous carry your bags for free.', { pr: 0.05 }],
      ['Limited Drops', 'Scarcity manufactured to perfection.', { pr: 0.07, mg: 0.05 }],
    ],
  },
  ferraro: {
    icon: '🏎️', title: 'Scarcity Doctrine', tagline: 'Make fewer, charge more, sell out instantly.',
    trait: { name: 'Waitlist Mystique', desc: 'Years-long waitlists are the ultimate marketing.', effect: { pr: 0.06 } },
    kind: 'doctrine',
    stances: [
      { id: 'volume', label: 'Volume', desc: 'Build more cars, reach more buyers.', effect: { inc: 0.09, mg: -0.03 } },
      { id: 'balanced', label: 'Balanced', desc: 'Grow gently, protect the aura.', effect: { inc: 0.04, mg: 0.03 } },
      { id: 'scarcity', label: 'Deliberate Scarcity', desc: 'Cap production; the waitlist does the rest.', effect: { pr: 0.10, mg: 0.08, inc: -0.03 } },
    ],
  },

  /* -------------------------------- Telecom ------------------------------ */
  horizontel: {
    icon: '🗼', title: 'Spectrum to Fiber', tagline: 'Own the pipes the whole economy runs on.',
    trait: { name: 'Network Coverage', desc: 'Coverage nobody can replicate overnight.', effect: { share: 0.04 } },
    kind: 'ladder',
    steps: [
      ['Spectrum Holdings', 'The airwaves are a finite asset — you own them.', { mg: 0.04 }],
      ['5G Buildout', 'Blanket the country in fast wireless.', { inc: 0.06 }],
      ['Fiber to the Home', 'Own the last mile of broadband.', { mg: 0.05, inc: 0.04 }],
      ['Bundled Media', 'Pair connectivity with content.', { share: 0.05 }],
      ['Enterprise & IoT', 'Connect every business and device.', { inc: 0.08 }],
    ],
  },
  ayteetel: {
    icon: '📶', title: 'Subscriber Doctrine', tagline: 'Win subscribers on price, or on value.',
    trait: { name: 'Retention Engine', desc: 'Low churn compounds quietly into profit.', effect: { ct: 0.03 } },
    kind: 'doctrine',
    stances: [
      { id: 'pricewar', label: 'Price War', desc: 'Undercut rivals to grab market share.', effect: { inc: 0.10, mg: -0.03 } },
      { id: 'balanced', label: 'Balanced', desc: 'Fair prices, steady growth.', effect: { inc: 0.05, mg: 0.02 } },
      { id: 'premium', label: 'Premium Bundles', desc: 'Sell the whole package at a premium.', effect: { mg: 0.09, pr: 0.03, inc: -0.02 } },
    ],
  },

  /* ------------------------------- Materials ----------------------------- */
  lindygas: {
    icon: '🧪', title: 'Molecule Moat', tagline: 'Sell the gases that industry can’t run without.',
    trait: { name: 'Sticky Contracts', desc: 'Decade-long, take-or-pay supply agreements.', effect: { mg: 0.05 } },
    kind: 'ladder',
    steps: [
      ['On-Site Plants', 'Build the gas plant inside the customer’s fence.', { mg: 0.05 }],
      ['Long-Term Contracts', 'Lock in demand for fifteen years.', { ct: 0.04 }],
      ['Specialty Gases', 'Ultra-pure gases for chipmakers.', { pr: 0.06 }],
      ['Hydrogen Economy', 'Fuel the clean-energy transition.', { inc: 0.07 }],
      ['Carbon Capture', 'Turn emissions into a product.', { inc: 0.06, mg: 0.03 }],
    ],
  },
  bravohill: {
    icon: '⛏️', title: 'Extraction Doctrine', tagline: 'Mine flat-out, or high-grade for margin.',
    trait: { name: 'Ore Body Grade', desc: 'A world-class deposit others would kill for.', effect: { ct: 0.03 } },
    kind: 'doctrine',
    stances: [
      { id: 'max', label: 'Max Output', desc: 'Move as much rock as possible.', effect: { inc: 0.11, mg: -0.03 } },
      { id: 'balanced', label: 'Balanced', desc: 'Steady tonnage across the cycle.', effect: { inc: 0.05, mg: 0.02 } },
      { id: 'highgrade', label: 'High-Grade Discipline', desc: 'Mine only the richest ore.', effect: { mg: 0.10, ct: 0.04, inc: -0.03 } },
    ],
  },

  /* ------------------------------ Industrial ----------------------------- */
  siegmens: {
    icon: '⚙️', title: 'Automation Stack', tagline: 'Sell the machine, then the software on top.',
    trait: { name: 'Installed Base', desc: 'Millions of machines in the field, all needing service.', effect: { mg: 0.04 } },
    kind: 'ladder',
    steps: [
      ['Factory Automation', 'Robots and controllers on every line.', { inc: 0.06 }],
      ['Electrification', 'The gear that moves clean power.', { inc: 0.05 }],
      ['Digital Twins', 'Simulate the factory before you build it.', { q: 5, mg: 0.03 }],
      ['Rail & Grid', 'Infrastructure that runs for decades.', { inc: 0.06 }],
      ['Recurring Software', 'Turn hardware sales into subscriptions.', { mg: 0.06, inc: 0.05 }],
    ],
  },
  caterpillow: {
    icon: '🚜', title: 'Iron Doctrine', tagline: 'Sell the machine, or the lifetime that follows.',
    trait: { name: 'Dealer Network', desc: 'A global dealer moat rivals can’t rebuild.', effect: { share: 0.04 } },
    kind: 'doctrine',
    stances: [
      { id: 'sales', label: 'Machine Sales', desc: 'Push iron out the door — cyclical volume.', effect: { inc: 0.11, mg: -0.03 } },
      { id: 'balanced', label: 'Balanced', desc: 'New machines plus healthy service.', effect: { inc: 0.05, mg: 0.02 } },
      { id: 'aftermarket', label: 'Aftermarket & Financing', desc: 'Parts, service and loans — steady margin.', effect: { mg: 0.10, ct: 0.03, inc: -0.02 } },
    ],
  },

  /* ------------------------------ Aerospace ------------------------------ */
  aerobus: {
    icon: '✈️', title: 'Backlog Doctrine', tagline: 'Ramp production, or protect the margin.',
    trait: { name: 'Order Backlog', desc: 'A decade of orders already on the books.', effect: { inc: 0.04 } },
    kind: 'doctrine',
    stances: [
      { id: 'ramp', label: 'Rate Ramp', desc: 'Build jets as fast as you can.', effect: { inc: 0.11, mg: -0.03 } },
      { id: 'balanced', label: 'Balanced', desc: 'Deliver steadily, keep quality high.', effect: { inc: 0.05, mg: 0.02 } },
      { id: 'margin', label: 'Margin Discipline', desc: 'Slower, cleaner, more profitable per jet.', effect: { mg: 0.09, ct: 0.04, inc: -0.03 } },
    ],
  },
  boyoing: {
    icon: '🛩️', title: 'Program Lifecycle', tagline: 'A jet is sold once and serviced forever.',
    trait: { name: 'Duopoly Position', desc: 'One of only two names airlines can call.', effect: { pr: 0.04 } },
    kind: 'ladder',
    steps: [
      ['Narrowbody Workhorse', 'The jet that flies every short route.', { inc: 0.06 }],
      ['Widebody Flagship', 'Long-haul jets at long-haul prices.', { pr: 0.05 }],
      ['Services & MRO', 'Maintenance revenue for 30 years per jet.', { mg: 0.06, inc: 0.04 }],
      ['Defense Division', 'Governments pay cost-plus.', { inc: 0.06 }],
      ['Space Systems', 'Launch vehicles and satellites.', { q: 5, inc: 0.05 }],
    ],
  },
  lockjaw: {
    icon: '🛡️', title: 'Defense Primacy', tagline: 'Arm the nation across every domain.',
    trait: { name: 'Government Contracts', desc: 'Multi-decade programs with guaranteed margins.', effect: { mg: 0.05 } },
    kind: 'ladder',
    steps: [
      ['Fighter Programs', 'The jets that define air superiority.', { inc: 0.07 }],
      ['Missile Systems', 'Precision weapons in constant demand.', { mg: 0.05 }],
      ['Radar & Electronics', 'The sensors behind every platform.', { inc: 0.06 }],
      ['Space & Satellites', 'Own the high ground of orbit.', { pr: 0.05 }],
      ['Hypersonics', 'The frontier of deterrence.', { q: 6, inc: 0.06 }],
    ],
  },

  /* ------------------------------- Utility ------------------------------- */
  nexteon: {
    icon: '🔌', title: 'Rate Base Growth', tagline: 'Every dollar invested earns a guaranteed return.',
    trait: { name: 'Regulated Returns', desc: 'Regulators let you earn on what you build.', effect: { mg: 0.05 } },
    kind: 'ladder',
    steps: [
      ['Regulated Grid', 'The wires everyone must pay to use.', { mg: 0.05 }],
      ['Renewables Buildout', 'Solar and wind added to the rate base.', { inc: 0.06 }],
      ['Grid Storage', 'Batteries that firm up the whole system.', { inc: 0.05 }],
      ['Transmission', 'The high-voltage backbone of the region.', { mg: 0.05, inc: 0.04 }],
      ['EV Charging', 'Power the electric-vehicle era.', { inc: 0.07 }],
    ],
  },
};

// Expose (browser global + Node/CommonJS for the test harness).
if (typeof module !== 'undefined' && module.exports) module.exports = { COMPANY_SIGNATURE };
