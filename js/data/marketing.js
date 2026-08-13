/* =========================================================================
 * data/marketing.js — Marketing & Growth: pure data (Step 1 of the build:
 * audiences, channels, objectives, messages). No game-state dependency —
 * js/techco.js wires this to the economy, exactly like data/employees.js.
 * ========================================================================= */

/* ------------------------------ Audiences --------------------------------- */
// A shared vocabulary of audience segments; each of the 16 sectors picks
// which ones are its REAL customer base (MKT_SECTOR_AUDIENCES). Targeting an
// audience outside that list is still allowed (mainly in Advanced mode) but
// is a mismatch — see mktAudienceFit() below.
const MKT_AUDIENCES = {
  students:            'Students',
  families:            'Families',
  professionals:        'Professionals',
  gamers:              'Gamers',
  luxury_customers:     'Luxury Customers',
  small_businesses:     'Small Businesses',
  large_corporations:   'Large Corporations',
  governments:         'Governments',
  schools_institutions: 'Schools & Institutions',
  casual_customers:     'Casual Customers',
  young_adults:        'Young Adults',
  commuters:           'Commuters',
  enthusiasts:         'Enthusiasts',
  luxury_buyers:       'Luxury Buyers',
  patients:            'Patients',
  healthcare_providers: 'Healthcare Providers',
  hnwi:                'High-Net-Worth Individuals',
  aspirational_buyers:  'Aspirational Buyers',
  retail_customers:     'Retail Customers',
  corporates:          'Corporates',
  device_makers:       'Device Makers',
  data_centers:        'Data Centres & Cloud Providers',
  airlines:            'Airlines',
  militaries:          'Militaries',
  individual_consumers: 'Individual Consumers',
  households:          'Households',
  manufacturers:       'Manufacturers',
  construction_firms:   'Construction Firms',
  industrial_buyers:    'Industrial Buyers',
  health_conscious:     'Health-Conscious Buyers',
  media_viewers:       'Viewers & Subscribers',
};

// Sector -> ordered list of audience ids that are its REAL customer base
// (first = best fit). Covers all 16 sectors from data/bizdefs.js.
const MKT_SECTOR_AUDIENCES = {
  tech:       ['students', 'families', 'professionals', 'gamers', 'luxury_customers'],
  semi:       ['device_makers', 'data_centers', 'large_corporations', 'governments'],
  bank:       ['retail_customers', 'small_businesses', 'corporates'],
  fintech:    ['retail_customers', 'small_businesses', 'corporates'],
  pharma:     ['patients', 'healthcare_providers', 'governments'],
  energy:     ['industrial_buyers', 'governments', 'large_corporations', 'households'],
  retail:     ['casual_customers', 'families', 'young_adults'],
  auto:       ['commuters', 'families', 'enthusiasts', 'luxury_buyers'],
  aerospace:  ['governments', 'militaries', 'airlines', 'large_corporations'],
  industrial: ['small_businesses', 'large_corporations', 'governments'],
  telecom:    ['individual_consumers', 'families', 'small_businesses', 'large_corporations'],
  media:      ['families', 'young_adults', 'students', 'media_viewers'],
  utility:    ['households', 'small_businesses', 'large_corporations', 'governments'],
  materials:  ['manufacturers', 'construction_firms', 'industrial_buyers', 'governments'],
  consumer:   ['families', 'young_adults', 'casual_customers', 'health_conscious'],
  luxury:     ['hnwi', 'aspirational_buyers'],
};

/** Effectiveness multiplier for targeting `audienceId` on a company in
 *  `sector`: in the sector's real customer base -> boosted (best fit highest),
 *  otherwise a real mismatch penalty. This is THE hook campaign effectiveness
 *  scales through. */
function mktAudienceFit(sector, audienceId) {
  const list = MKT_SECTOR_AUDIENCES[sector];
  if (!list) return 0.7;
  const i = list.indexOf(audienceId);
  if (i < 0) return 0.45; // off-base audience — still runs, just weak
  return 1.15 - i * 0.08; // best-fit (first) 1.15, tapering toward ~0.9 for the last listed
}

/* ------------------------------- Channels ---------------------------------- */
// Digital / Traditional / Physical, each with a per-sector "style" fit
// (consumer-leaning sectors favour Social/Influencers/TV; b2b-leaning sectors
// favour Trade Shows/Email/Events; "mixed" sits in between) rather than a
// hand-authored 16x15 matrix — same effect, far easier to keep balanced.
const MKT_SECTOR_STYLE = {
  tech: 'consumer', semi: 'b2b', bank: 'mixed', fintech: 'mixed', pharma: 'mixed',
  energy: 'b2b', retail: 'consumer', auto: 'consumer', aerospace: 'b2b', industrial: 'b2b',
  telecom: 'consumer', media: 'consumer', utility: 'mixed', materials: 'b2b',
  consumer: 'consumer', luxury: 'consumer',
};

const MKT_CHANNELS = {
  // Digital
  social_media: { label: 'Social Media', category: 'digital', styleFit: { consumer: 1.30, mixed: 1.00, b2b: 0.55 } },
  search:       { label: 'Search',       category: 'digital', styleFit: { consumer: 1.10, mixed: 1.10, b2b: 1.00 } },
  video:        { label: 'Video',        category: 'digital', styleFit: { consumer: 1.25, mixed: 1.00, b2b: 0.65 } },
  influencers:  { label: 'Influencers',  category: 'digital', styleFit: { consumer: 1.35, mixed: 0.85, b2b: 0.35 } },
  websites:     { label: 'Websites',     category: 'digital', styleFit: { consumer: 1.00, mixed: 1.05, b2b: 1.10 } },
  email:        { label: 'Email',        category: 'digital', styleFit: { consumer: 0.90, mixed: 1.10, b2b: 1.30 } },
  // Traditional
  tv:           { label: 'TV',           category: 'traditional', styleFit: { consumer: 1.20, mixed: 1.00, b2b: 0.45 } },
  radio:        { label: 'Radio',        category: 'traditional', styleFit: { consumer: 1.00, mixed: 0.90, b2b: 0.55 } },
  newspapers:   { label: 'Newspapers',   category: 'traditional', styleFit: { consumer: 0.80, mixed: 1.00, b2b: 1.00 } },
  billboards:   { label: 'Billboards',   category: 'traditional', styleFit: { consumer: 1.05, mixed: 0.90, b2b: 0.55 } },
  magazines:    { label: 'Magazines',    category: 'traditional', styleFit: { consumer: 1.00, mixed: 0.95, b2b: 0.80 } },
  // Physical
  store_promotions: { label: 'Store Promotions', category: 'physical', styleFit: { consumer: 1.20, mixed: 0.90, b2b: 0.45 } },
  events:           { label: 'Events',           category: 'physical', styleFit: { consumer: 1.00, mixed: 1.10, b2b: 1.20 } },
  product_demos:    { label: 'Product Demos',    category: 'physical', styleFit: { consumer: 1.00, mixed: 1.10, b2b: 1.25 } },
  trade_shows:      { label: 'Trade Shows',      category: 'physical', styleFit: { consumer: 0.45, mixed: 1.10, b2b: 1.40 } },
};
const MKT_CHANNEL_IDS = Object.keys(MKT_CHANNELS);
const MKT_CHANNEL_CATEGORIES = [
  { id: 'digital',     label: 'Digital' },
  { id: 'traditional', label: 'Traditional' },
  { id: 'physical',    label: 'Physical' },
];

/** A channel's effectiveness multiplier for a given sector. */
function mktChannelSectorFit(channelId, sector) {
  const ch = MKT_CHANNELS[channelId];
  if (!ch) return 1;
  const style = MKT_SECTOR_STYLE[sector] || 'mixed';
  return ch.styleFit[style] != null ? ch.styleFit[style] : 1;
}

// Spread tiers: reach grows faster than cost as the campaign goes bigger
// (economies of scale), while diminishing returns are enforced elsewhere
// (reputation/audience-fit clamps) so "go global" isn't a strictly dominant move.
// `days` = how many in-game days a campaign at that spread runs before it
// resolves (bigger reach takes longer to land) — real-time ms = days x
// TechCo.CFG.DAY_SECONDS x 1000, the exact same clock builds already use.
const MKT_SPREAD_TIERS = {
  local:    { label: 'Local',    costMult: 1,  reachMult: 1,  days: 2  },
  regional: { label: 'Regional', costMult: 3,  reachMult: 3.5, days: 4  },
  national: { label: 'National', costMult: 8,  reachMult: 10,  days: 7  },
  global:   { label: 'Global',   costMult: 20, reachMult: 28,  days: 12 },
};
const MKT_SPREAD_IDS = ['local', 'regional', 'national', 'global'];

/** Auto-suggested channel mix for Quick Campaign: the top-N channels by
 *  sector fit, weighted proportionally by their fit score. */
function mktSuggestChannels(sector, n) {
  n = n || 3;
  const ranked = MKT_CHANNEL_IDS.slice().sort((a, b) => mktChannelSectorFit(b, sector) - mktChannelSectorFit(a, sector));
  const top = ranked.slice(0, n);
  const total = top.reduce((s, c) => s + mktChannelSectorFit(c, sector), 0);
  const mix = {};
  for (const c of top) mix[c] = mktChannelSectorFit(c, sector) / total; // fractions summing to 1
  return mix;
}

/* ------------------------------- Objectives --------------------------------- */
// Each objective weights how a resolved campaign's budget converts into the
// three outcome axes (reach/sales lift/market-share) and reputation, plus a
// small guaranteed reputation nudge from just running that KIND of campaign
// (repDeltaBase) — "Promote a Sale" trades a little brand for a lot of sales.
const MKT_OBJECTIVES = {
  product_launch:  { label: 'Product Launch',      salesMult: 1.30, shareMult: 1.10, repMult: 1.00, repDeltaBase: 1.0 },
  brand_awareness: { label: 'Brand Awareness',      salesMult: 0.50, shareMult: 0.60, repMult: 1.60, repDeltaBase: 3.0 },
  increase_sales:  { label: 'Increase Sales',       salesMult: 1.50, shareMult: 0.80, repMult: 0.60, repDeltaBase: 0.5 },
  enter_country:   { label: 'Enter New Country',    salesMult: 0.90, shareMult: 1.60, repMult: 0.80, repDeltaBase: 1.0 },
  defend_share:    { label: 'Defend Market Share',  salesMult: 0.70, shareMult: 1.40, repMult: 0.70, repDeltaBase: 0.5 },
  repair_rep:      { label: 'Repair Reputation',    salesMult: 0.30, shareMult: 0.30, repMult: 2.20, repDeltaBase: 5.0 },
  promote_sale:    { label: 'Promote a Sale',       salesMult: 1.70, shareMult: 0.60, repMult: 0.40, repDeltaBase: -0.5 },
};
const MKT_OBJECTIVE_IDS = Object.keys(MKT_OBJECTIVES);

/* -------------------------------- Messages ---------------------------------- */
// Suggested lines per objective, each tagged for the simple tag-match system
// (no NLP): a message's tags vs the target audience's preferred tags.
const MKT_MESSAGES = {
  product_launch: [
    { text: 'The future, available now.', tags: ['innovation', 'quality'] },
    { text: 'Meet our newest breakthrough.', tags: ['innovation', 'excitement'] },
    { text: 'Built for what comes next.', tags: ['innovation', 'performance'] },
  ],
  brand_awareness: [
    { text: 'This is who we are.', tags: ['trust', 'heritage'] },
    { text: 'Trusted by millions.', tags: ['trust', 'value'] },
    { text: 'More than a name — a promise.', tags: ['trust', 'quality'] },
  ],
  increase_sales: [
    { text: 'The smart choice, every time.', tags: ['value', 'quality'] },
    { text: "Everything you need, nothing you don't.", tags: ['value', 'efficiency'] },
    { text: 'See why everyone switches.', tags: ['value', 'trust'] },
  ],
  enter_country: [
    { text: 'Now here, made for you.', tags: ['trust', 'value'] },
    { text: 'A local favourite, worldwide.', tags: ['trust', 'heritage'] },
    { text: 'Welcome to something better.', tags: ['excitement', 'quality'] },
  ],
  defend_share: [
    { text: 'Still the one to beat.', tags: ['performance', 'trust'] },
    { text: 'The original, still the best.', tags: ['heritage', 'quality'] },
    { text: "Why settle for less?", tags: ['performance', 'value'] },
  ],
  repair_rep: [
    { text: "We heard you. Here's what's changed.", tags: ['trust', 'safety'] },
    { text: 'Rebuilding trust, one promise kept.', tags: ['trust', 'quality'] },
    { text: 'Better, because you deserve it.', tags: ['trust', 'quality'] },
  ],
  promote_sale: [
    { text: 'Limited time. Unlimited value.', tags: ['value', 'excitement'] },
    { text: "Don't miss this.", tags: ['excitement', 'value'] },
    { text: 'Our biggest offer yet.', tags: ['value', 'fun'] },
  ],
};

// Audience -> the tags that resonate with it (2-3 each). Used both for the
// message tag-match bonus/penalty and for Market Research insights later.
const MKT_AUDIENCE_TAGS = {
  students: ['value', 'fun'],
  families: ['trust', 'safety', 'value'],
  professionals: ['performance', 'efficiency', 'quality'],
  gamers: ['performance', 'innovation', 'fun'],
  luxury_customers: ['luxury', 'quality', 'excitement'],
  small_businesses: ['value', 'efficiency'],
  large_corporations: ['performance', 'trust'],
  governments: ['trust', 'safety'],
  schools_institutions: ['trust', 'value'],
  casual_customers: ['value', 'fun'],
  young_adults: ['fun', 'innovation', 'excitement'],
  commuters: ['efficiency', 'value'],
  enthusiasts: ['performance', 'innovation'],
  luxury_buyers: ['luxury', 'performance'],
  patients: ['safety', 'trust'],
  healthcare_providers: ['safety', 'quality', 'trust'],
  hnwi: ['luxury', 'exclusivity'],
  aspirational_buyers: ['luxury', 'excitement'],
  retail_customers: ['trust', 'value'],
  corporates: ['trust', 'efficiency'],
  device_makers: ['performance', 'quality'],
  data_centers: ['performance', 'efficiency'],
  airlines: ['safety', 'performance'],
  militaries: ['safety', 'performance'],
  individual_consumers: ['value', 'trust'],
  households: ['safety', 'value'],
  manufacturers: ['efficiency', 'quality'],
  construction_firms: ['efficiency', 'safety'],
  industrial_buyers: ['performance', 'efficiency'],
  health_conscious: ['safety', 'quality'],
  media_viewers: ['fun', 'excitement'],
};

// The full tag vocabulary used across MKT_MESSAGES/MKT_AUDIENCE_TAGS — used
// by the Advanced message editor to infer tags from a player-typed line via
// simple substring matching (no NLP, matches the tag-match system above).
const MKT_TAG_VOCAB = ['efficiency', 'excitement', 'exclusivity', 'fun', 'heritage', 'innovation', 'luxury', 'performance', 'quality', 'safety', 'trust', 'value'];

/** Message tag-match effectiveness vs an audience: 1.0 baseline, boosted for
 *  each overlapping tag, penalised slightly if there's no overlap at all. */
function mktMessageFit(message, audienceId) {
  const prefs = MKT_AUDIENCE_TAGS[audienceId] || [];
  if (!message || !message.tags) return 1;
  const hits = message.tags.filter((t) => prefs.indexOf(t) >= 0).length;
  if (hits === 0) return 0.85;
  return 1 + hits * 0.12; // +12% per matching tag
}

/* ---------------------------- Influencer Deals ------------------------------ */
// A fictional roster of original, non-trademarked personalities — reuses the
// SAME deterministic-seed generation approach as data/employees.js (so a
// pool re-derives on demand rather than being persisted) and the SAME
// human-realistic-range-then-baseIncome-scaled approach the salary formula
// uses. _mulberry32/_empHash come from data/employees.js, loaded first.
const INFLUENCER_HANDLES = [
  'Nova Ray', 'Jax Wilder', 'Mira Sol', 'Kai Ashford', 'Luna Vex', 'Remy Storm',
  'Sage Anders', 'Zara Quinn', 'Milo Frost', 'Ivy Chen', 'Dax Rivera', 'Wren Sato',
  'Blaze Monroe', 'Coco Vale', 'Theo Marsh', 'Nyx Delacroix', 'Finn Okoro', 'Skye Larsen',
  'Rio Castillo', 'Ash Whitfield', 'Juno Park', 'Kian Reyes', 'Vera Lindqvist', 'Ozzy Novak',
  'Piper Voss', 'Leo Marchetti', 'Indie Rowe', 'Cyrus Blake', 'Lux Ferreira', 'Wynn Cole',
];
// Skewed like the candidate tier roll: most deals are nano/micro, mega is rare.
const INFLUENCER_FOLLOWER_TIERS = [
  { id: 'nano',  label: 'Nano',      min: 10000,    max: 50000    },
  { id: 'micro', label: 'Micro',     min: 50000,    max: 500000   },
  { id: 'mid',   label: 'Mid-Tier',  min: 500000,   max: 2000000  },
  { id: 'macro', label: 'Macro',     min: 2000000,  max: 10000000 },
  { id: 'mega',  label: 'Mega',      min: 10000000, max: 50000000 },
];
const INFLUENCER_FEE_MIN = 5000, INFLUENCER_FEE_MAX = 2000000, INFLUENCER_FEE_REFERENCE = 250000;

function _mktInfTierRoll(rng) {
  const r = rng();
  if (r < 0.45) return 0; // nano
  if (r < 0.75) return 1; // micro
  if (r < 0.92) return 2; // mid
  if (r < 0.99) return 3; // macro
  return 4;                // mega
}

/** One deterministic, named influencer given a seed. */
function mktGenInfluencer(seed) {
  const rng = _mulberry32(seed);
  const tier = INFLUENCER_FOLLOWER_TIERS[_mktInfTierRoll(rng)];
  const followers = Math.round(tier.min + rng() * (tier.max - tier.min));
  const audienceIds = Object.keys(MKT_AUDIENCES);
  const audienceTag = audienceIds[Math.floor(rng() * audienceIds.length)];
  const name = INFLUENCER_HANDLES[Math.floor(rng() * INFLUENCER_HANDLES.length)];
  const logMin = Math.log10(INFLUENCER_FOLLOWER_TIERS[0].min), logMax = Math.log10(INFLUENCER_FOLLOWER_TIERS[4].max);
  const frac = (Math.log10(followers) - logMin) / (logMax - logMin);
  const fee = Math.round((INFLUENCER_FEE_MIN + frac * (INFLUENCER_FEE_MAX - INFLUENCER_FEE_MIN)) / 500) * 500;
  const estReach = Math.round(followers * (0.10 + rng() * 0.10)); // 10-20% typical engagement/reach
  return { seed, name, tierLabel: tier.label, audienceTag, followers, fee, estReach };
}

/** The rotating pool of influencers available to a company this cycle
 *  (same weekly-ish cycle empCycle() already uses) — nothing persisted. */
function mktInfluencerPool(companyId, cycle, n) {
  n = n || 4;
  const out = [];
  for (let i = 0; i < n; i++) out.push(mktGenInfluencer(_empHash(companyId + '#influencer#' + cycle + '#' + i)));
  return out;
}

/* ----------------------------- Sponsorships ---------------------------------- */
// Original fictional properties only — same non-infringing-names approach as
// the stock/crypto rebrand. Cost/benefit scale off company size in the engine.
const SPONSORSHIP_PROPERTIES = [
  { id: 'ironpeak_fc',     name: 'Ironpeak FC',                 kind: 'Football Club',      styleFit: 'consumer' },
  { id: 'crestline_hoops', name: 'Crestline Hoops',              kind: 'Basketball Team',    styleFit: 'consumer' },
  { id: 'vantage_racing',  name: 'Vantage Racing League',        kind: 'Motorsport Series',  styleFit: 'consumer' },
  { id: 'apex_invitational', name: 'Apex Esports Invitational',  kind: 'Esports Tournament', styleFit: 'consumer' },
  { id: 'solstice_fest',   name: 'Solstice Music Festival',      kind: 'Festival',           styleFit: 'consumer' },
  { id: 'meridian_summit', name: 'Meridian Industry Summit',     kind: 'Conference',         styleFit: 'b2b' },
  { id: 'harborview_u',    name: 'Harborview University',        kind: 'University',         styleFit: 'mixed' },
  { id: 'northbridge_open', name: 'Northbridge Open',            kind: 'Golf Tournament',     styleFit: 'mixed' },
  { id: 'lumen_forum',     name: 'Lumen Global Forum',           kind: 'Conference',         styleFit: 'b2b' },
  { id: 'evercross_marathon', name: 'Evercross Marathon',        kind: 'Marathon',           styleFit: 'mixed' },
];
const SPONSORSHIP_TIERS = {
  local:  { label: 'Local',  costMult: 2,  repMax: 6,  reachMult: 1   },
  major:  { label: 'Major',  costMult: 6,  repMax: 12, reachMult: 3.5 },
  global: { label: 'Global', costMult: 16, repMax: 22, reachMult: 9   },
};
const SPONSORSHIP_TIER_IDS = ['local', 'major', 'global'];

/** Sponsorship fit for a sector, mirroring the channel style-fit approach. */
function mktSponsorshipFit(property, sector) {
  const style = MKT_SECTOR_STYLE[sector] || 'mixed';
  if (property.styleFit === style) return 1.2;
  if (property.styleFit === 'mixed' || style === 'mixed') return 1.0;
  return 0.7;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MKT_AUDIENCES, MKT_SECTOR_AUDIENCES, mktAudienceFit,
    MKT_SECTOR_STYLE, MKT_CHANNELS, MKT_CHANNEL_IDS, MKT_CHANNEL_CATEGORIES,
    mktChannelSectorFit, MKT_SPREAD_TIERS, MKT_SPREAD_IDS, mktSuggestChannels,
    MKT_OBJECTIVES, MKT_OBJECTIVE_IDS, MKT_MESSAGES, MKT_AUDIENCE_TAGS, MKT_TAG_VOCAB, mktMessageFit,
    INFLUENCER_HANDLES, INFLUENCER_FOLLOWER_TIERS, INFLUENCER_FEE_MIN, INFLUENCER_FEE_MAX,
    INFLUENCER_FEE_REFERENCE, mktGenInfluencer, mktInfluencerPool,
    SPONSORSHIP_PROPERTIES, SPONSORSHIP_TIERS, SPONSORSHIP_TIER_IDS, mktSponsorshipFit,
  };
}
