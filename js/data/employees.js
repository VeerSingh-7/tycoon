/* =========================================================================
 * data/employees.js — Unified Recruitment / Employee system (foundation)
 * -------------------------------------------------------------------------
 * A single taxonomy of NAMED candidates — not generic headcount — usable by
 * every company in the game. This file is pure data + generation logic: it
 * knows nothing about a specific company's cash or state. js/techco.js wires
 * it to the economy (cost scaling, payroll, persistence).
 *
 * Every candidate rolls an Overall plus up to 7 sub-attributes, WEIGHTED per
 * role — a role's zero-weight attributes are not rolled at all ("—"), and
 * attributes above the role's baseline weight (1.0) tend to roll ABOVE the
 * candidate's Overall while below-baseline ones tend to roll under it, so
 * two candidates with the same Overall can look genuinely different.
 *
 * All money is $ (the game's one currency — see js/format.js formatMoney).
 * Salaries here are human-realistic FLAVOUR numbers ($45K walk-in hire up to
 * ~$320K legend); js/techco.js converts them into the game's existing
 * baseIncome-scaled payroll rate so they roll up correctly at any company
 * size — see employeePayrollPerDay() there.
 * ========================================================================= */

const EMP_ATTRS = ['technical', 'creativity', 'efficiency', 'leadership', 'experience', 'reliability', 'teamwork'];
const EMP_ATTR_LABELS = {
  technical: 'Technical Skill', creativity: 'Creativity', efficiency: 'Efficiency',
  leadership: 'Leadership', experience: 'Experience', reliability: 'Reliability', teamwork: 'Teamwork',
};

const EMP_CATEGORIES = [
  { id: 'research_tech', label: 'Research & Technology' },
  { id: 'product_dev',   label: 'Product Development' },
  { id: 'business',      label: 'Business' },
  { id: 'operations',    label: 'Operations' },
  { id: 'sales_marketing', label: 'Sales & Marketing' },
  { id: 'leadership',    label: 'Leadership' },
];

// weights: 0 = attribute not used for this role (never rolled, shown "—").
// 1.0 = neutral baseline (rolls close to Overall). Higher = tends above
// Overall; lower (but > 0) = still rolled, but tends below Overall.
const EMP_ROLES = {
  // ---------------------------- Research & Technology ----------------------
  scientist: {
    label: 'Scientist', category: 'research_tech',
    weights: { technical: 1.4, creativity: 1.3, efficiency: 0, leadership: 0.5, experience: 1, reliability: 1.1, teamwork: 0 },
    specialities: ['AI', 'Robotics', 'Battery Technology', 'Quantum Computing', 'Materials Science', 'Biotechnology'],
  },
  researcher: {
    label: 'Researcher', category: 'research_tech',
    weights: { technical: 1.2, creativity: 1.1, efficiency: 0.7, leadership: 0, experience: 1.1, reliability: 1, teamwork: 0.7 },
    specialities: ['Market Research', 'Clinical Research', 'Applied Physics', 'Environmental Science', 'Consumer Behaviour'],
  },
  ai_engineer: {
    label: 'AI Engineer', category: 'research_tech',
    weights: { technical: 1.5, creativity: 1.1, efficiency: 1, leadership: 0, experience: 0.9, reliability: 1, teamwork: 0.7 },
    specialities: ['Machine Learning', 'Computer Vision', 'Natural Language Processing', 'Robotics AI', 'Generative Models'],
  },
  software_engineer: {
    label: 'Software Engineer', category: 'research_tech',
    weights: { technical: 1.4, creativity: 0.9, efficiency: 1.2, leadership: 0, experience: 0.9, reliability: 1.1, teamwork: 0.9 },
    specialities: ['Backend Systems', 'Frontend & UX Engineering', 'Cloud Infrastructure', 'Mobile Development', 'Security Engineering'],
  },
  hardware_engineer: {
    label: 'Hardware Engineer', category: 'research_tech',
    weights: { technical: 1.4, creativity: 1, efficiency: 1.1, leadership: 0, experience: 1, reliability: 1.2, teamwork: 0.8 },
    specialities: ['Circuit Design', 'Chip Architecture', 'Mechanical Systems', 'Power Systems', 'Sensors'],
  },
  robotics_engineer: {
    label: 'Robotics Engineer', category: 'research_tech',
    weights: { technical: 1.4, creativity: 1.1, efficiency: 1.1, leadership: 0, experience: 0.9, reliability: 1.1, teamwork: 0.8 },
    specialities: ['Actuators & Motion', 'Autonomy & Navigation', 'Manipulation', 'Industrial Automation'],
  },
  data_scientist: {
    label: 'Data Scientist', category: 'research_tech',
    weights: { technical: 1.3, creativity: 1, efficiency: 1.1, leadership: 0, experience: 0.9, reliability: 1.1, teamwork: 0.7 },
    specialities: ['Predictive Modelling', 'Data Engineering', 'Statistics', 'Applied Machine Learning'],
  },
  cybersecurity_specialist: {
    label: 'Cybersecurity Specialist', category: 'research_tech',
    weights: { technical: 1.4, creativity: 0.8, efficiency: 1, leadership: 0, experience: 1.1, reliability: 1.3, teamwork: 0.7 },
    specialities: ['Network Security', 'Application Security', 'Threat Intelligence', 'Cryptography'],
  },
  lab_technician: {
    label: 'Laboratory Technician', category: 'research_tech',
    weights: { technical: 1.1, creativity: 0.6, efficiency: 1.1, leadership: 0, experience: 0.8, reliability: 1.2, teamwork: 0.8 },
    specialities: ['Sample Analysis', 'Equipment Calibration', 'Quality Control', 'Chemical Handling'],
  },

  // ------------------------------ Product Development -----------------------
  product_manager: {
    label: 'Product Manager', category: 'product_dev',
    weights: { technical: 0, creativity: 1, efficiency: 1.1, leadership: 1.3, experience: 1.1, reliability: 1, teamwork: 1.2 },
    specialities: ['Consumer Hardware', 'Enterprise Software', 'Platform Strategy', 'Growth Products'],
  },
  project_manager: {
    label: 'Project Manager', category: 'product_dev',
    weights: { technical: 0.7, creativity: 0, efficiency: 1.3, leadership: 1.2, experience: 1.1, reliability: 1.2, teamwork: 1.2 },
    specialities: ['Agile Delivery', 'Cross-functional Coordination', 'Vendor Management', 'Risk Management'],
  },
  industrial_designer: {
    label: 'Industrial Designer', category: 'product_dev',
    weights: { technical: 0.9, creativity: 1.5, efficiency: 0.9, leadership: 0, experience: 0.9, reliability: 0.9, teamwork: 0.8 },
    specialities: ['Consumer Electronics', 'Automotive Design', 'Furniture & Interiors', 'Packaging Design'],
  },
  ux_designer: {
    label: 'UX Designer', category: 'product_dev',
    weights: { technical: 0.8, creativity: 1.4, efficiency: 1, leadership: 0, experience: 0.9, reliability: 0.9, teamwork: 1 },
    specialities: ['Mobile UX', 'Enterprise UX', 'Accessibility', 'Interaction Design'],
  },
  graphic_designer: {
    label: 'Graphic Designer', category: 'product_dev',
    weights: { technical: 0.6, creativity: 1.5, efficiency: 1, leadership: 0, experience: 0.8, reliability: 0.8, teamwork: 0.9 },
    specialities: ['Branding', 'Marketing Collateral', 'Motion Graphics', 'Packaging Art'],
  },
  qa_tester: {
    label: 'QA Tester', category: 'product_dev',
    weights: { technical: 1, creativity: 0, efficiency: 1.1, leadership: 0, experience: 0.9, reliability: 1.4, teamwork: 0.9 },
    specialities: ['Manual Testing', 'Automated Testing', 'Performance Testing', 'Hardware QA'],
  },
  prototype_engineer: {
    label: 'Prototype Engineer', category: 'product_dev',
    weights: { technical: 1.3, creativity: 1.1, efficiency: 1.1, leadership: 0, experience: 0.9, reliability: 1, teamwork: 0.8 },
    specialities: ['Rapid Prototyping', '3D Printing & Fabrication', 'Electronics Prototyping', 'Mechanical Prototyping'],
  },

  // ---------------------------------- Business -------------------------------
  accountant: {
    label: 'Accountant', category: 'business',
    weights: { technical: 1, creativity: 0, efficiency: 1.2, leadership: 0, experience: 1.1, reliability: 1.4, teamwork: 0.7 },
    specialities: ['Tax', 'Audit', 'Payroll', 'Financial Reporting'],
  },
  financial_analyst: {
    label: 'Financial Analyst', category: 'business',
    weights: { technical: 1.1, creativity: 0.7, efficiency: 1.1, leadership: 0, experience: 1, reliability: 1.2, teamwork: 0.8 },
    specialities: ['Equity Research', 'Corporate Finance', 'Risk Analysis', 'FP&A'],
  },
  economist: {
    label: 'Economist', category: 'business',
    weights: { technical: 1.2, creativity: 0.8, efficiency: 0.9, leadership: 0, experience: 1.1, reliability: 1.1, teamwork: 0.7 },
    specialities: ['Macroeconomics', 'Market Forecasting', 'Trade Policy', 'Behavioural Economics'],
  },
  business_analyst: {
    label: 'Business Analyst', category: 'business',
    weights: { technical: 1, creativity: 0.9, efficiency: 1.1, leadership: 0, experience: 0.9, reliability: 1, teamwork: 1 },
    specialities: ['Process Improvement', 'Data Analysis', 'Strategy', 'Systems Analysis'],
  },
  investment_manager: {
    label: 'Investment Manager', category: 'business',
    weights: { technical: 1, creativity: 0, efficiency: 1, leadership: 1.1, experience: 1.2, reliability: 1.1, teamwork: 0.8 },
    specialities: ['Equities', 'Private Equity', 'Venture Capital', 'Portfolio Management'],
  },
  lawyer: {
    label: 'Lawyer', category: 'business',
    weights: { technical: 0.9, creativity: 0, efficiency: 0.9, leadership: 0.9, experience: 1.3, reliability: 1.3, teamwork: 0.7 },
    specialities: ['Corporate Law', 'Intellectual Property', 'Contract Law', 'Regulatory Compliance'],
  },

  // --------------------------------- Operations ------------------------------
  factory_manager: {
    label: 'Factory Manager', category: 'operations',
    weights: { technical: 1, creativity: 0, efficiency: 1.3, leadership: 1.2, experience: 1.1, reliability: 1.2, teamwork: 1 },
    specialities: ['Lean Manufacturing', 'Automation', 'Safety Compliance', 'Production Planning'],
  },
  logistics_manager: {
    label: 'Logistics Manager', category: 'operations',
    weights: { technical: 0.8, creativity: 0, efficiency: 1.3, leadership: 1, experience: 1, reliability: 1.2, teamwork: 0.9 },
    specialities: ['Freight & Shipping', 'Fleet Management', 'Route Optimization', 'Customs & Trade'],
  },
  supply_chain_manager: {
    label: 'Supply Chain Manager', category: 'operations',
    weights: { technical: 0.9, creativity: 0, efficiency: 1.3, leadership: 1, experience: 1.1, reliability: 1.2, teamwork: 1 },
    specialities: ['Procurement', 'Inventory Planning', 'Vendor Relations', 'Demand Forecasting'],
  },
  operations_manager: {
    label: 'Operations Manager', category: 'operations',
    weights: { technical: 0.8, creativity: 0, efficiency: 1.3, leadership: 1.2, experience: 1.1, reliability: 1.2, teamwork: 1.1 },
    specialities: ['Process Optimization', 'Facilities', 'Quality Systems', 'Continuous Improvement'],
  },
  warehouse_manager: {
    label: 'Warehouse Manager', category: 'operations',
    weights: { technical: 0.7, creativity: 0, efficiency: 1.3, leadership: 0.9, experience: 0.9, reliability: 1.2, teamwork: 0.9 },
    specialities: ['Inventory Control', 'Order Fulfilment', 'Safety & Compliance', 'Automation Systems'],
  },

  // ------------------------------ Sales & Marketing ---------------------------
  salesperson: {
    label: 'Salesperson', category: 'sales_marketing',
    weights: { technical: 0, creativity: 0.8, efficiency: 1, leadership: 0.7, experience: 0.9, reliability: 0.9, teamwork: 1 },
    specialities: ['Enterprise Sales', 'Retail Sales', 'Inside Sales', 'Channel Sales'],
  },
  sales_manager: {
    label: 'Sales Manager', category: 'sales_marketing',
    weights: { technical: 0, creativity: 0.8, efficiency: 1, leadership: 1.3, experience: 1.1, reliability: 1, teamwork: 1.1 },
    specialities: ['Enterprise Accounts', 'Regional Sales', 'Channel Partnerships', 'Key Accounts'],
  },
  marketing_specialist: {
    label: 'Marketing Specialist', category: 'sales_marketing',
    weights: { technical: 0.7, creativity: 1.2, efficiency: 1, leadership: 0, experience: 0.9, reliability: 0.9, teamwork: 1 },
    specialities: ['Digital Marketing', 'Content Marketing', 'SEO & SEM', 'Campaign Management'],
  },
  advertising_manager: {
    label: 'Advertising Manager', category: 'sales_marketing',
    weights: { technical: 0, creativity: 1.3, efficiency: 1, leadership: 1, experience: 1, reliability: 0.9, teamwork: 1 },
    specialities: ['Media Buying', 'Creative Strategy', 'Brand Advertising', 'Performance Marketing'],
  },
  brand_manager: {
    label: 'Brand Manager', category: 'sales_marketing',
    weights: { technical: 0, creativity: 1.3, efficiency: 0.9, leadership: 1.1, experience: 1, reliability: 1, teamwork: 1.1 },
    specialities: ['Brand Strategy', 'Product Positioning', 'Consumer Insights', 'Global Branding'],
  },
  pr_manager: {
    label: 'Public Relations Manager', category: 'sales_marketing',
    weights: { technical: 0, creativity: 1.1, efficiency: 0.9, leadership: 1.1, experience: 1, reliability: 1, teamwork: 1.1 },
    specialities: ['Media Relations', 'Crisis Communications', 'Corporate Communications', 'Influencer Relations'],
  },
  market_researcher: {
    label: 'Market Researcher', category: 'sales_marketing',
    weights: { technical: 1.2, creativity: 0.6, efficiency: 1, leadership: 0, experience: 1, reliability: 1.2, teamwork: 0.8 },
    specialities: ['Consumer Insights', 'Competitive Analysis', 'Survey Research', 'Data Analytics'],
  },
  marketing_assistant: {
    label: 'Marketing Assistant', category: 'sales_marketing',
    weights: { technical: 0, creativity: 1, efficiency: 1.1, leadership: 0.5, experience: 0.8, reliability: 1, teamwork: 1.2 },
    specialities: ['Campaign Support', 'Social Media Management', 'Content Coordination', 'Event Coordination'],
  },

  // ---------------------------------- Leadership ------------------------------
  ceo: {
    label: 'CEO', category: 'leadership',
    weights: { technical: 0, creativity: 0.9, efficiency: 1, leadership: 1.6, experience: 1.4, reliability: 1.1, teamwork: 1 },
    specialities: ['Turnarounds', 'Scaling Startups', 'Global Expansion', 'M&A Leadership'],
  },
  cfo: {
    label: 'CFO', category: 'leadership',
    weights: { technical: 1, creativity: 0, efficiency: 1.1, leadership: 1.4, experience: 1.4, reliability: 1.3, teamwork: 0.9 },
    specialities: ['Capital Markets', 'Cost Discipline', 'M&A Finance', 'IPO Readiness'],
  },
  coo: {
    label: 'COO', category: 'leadership',
    weights: { technical: 0.8, creativity: 0, efficiency: 1.4, leadership: 1.4, experience: 1.3, reliability: 1.2, teamwork: 1.1 },
    specialities: ['Operational Scaling', 'Process Excellence', 'Supply Chain Leadership'],
  },
  cto: {
    label: 'CTO', category: 'leadership',
    weights: { technical: 1.4, creativity: 1.1, efficiency: 1.1, leadership: 1.4, experience: 1.3, reliability: 1.1, teamwork: 0 },
    specialities: ['Platform Architecture', 'Engineering Leadership', 'R&D Strategy', 'AI Strategy'],
  },
  head_of_rd: {
    label: 'Head of R&D', category: 'leadership',
    weights: { technical: 1.3, creativity: 1.2, efficiency: 0, leadership: 1.3, experience: 1.3, reliability: 1.1, teamwork: 1 },
    specialities: ['Innovation Pipeline', 'Advanced Research', 'Product Science'],
  },
  head_of_marketing: {
    label: 'Head of Marketing', category: 'leadership',
    weights: { technical: 0, creativity: 1.2, efficiency: 1, leadership: 1.3, experience: 1.2, reliability: 1, teamwork: 1.1 },
    specialities: ['Growth Strategy', 'Global Campaigns', 'Brand Leadership'],
  },
  regional_director: {
    label: 'Regional Director', category: 'leadership',
    weights: { technical: 0, creativity: 0.8, efficiency: 1.1, leadership: 1.3, experience: 1.3, reliability: 1.1, teamwork: 1.1 },
    specialities: ['Market Expansion', 'Regional P&L', 'Local Operations'],
  },
};

const EMP_ROLE_IDS = Object.keys(EMP_ROLES);
const EMP_ROLES_BY_CATEGORY = (catId) => EMP_ROLE_IDS.filter((r) => EMP_ROLES[r].category === catId);

/* --------------------------------- Naming --------------------------------- */

const EMP_FIRST = [
  'Maya', 'James', 'Elena', 'Marcus', 'Priya', 'Daniel', 'Sofia', 'Ethan', 'Amara', 'Lucas',
  'Nadia', 'Owen', 'Yuki', 'Gabriel', 'Ines', 'Noah', 'Farah', 'Leo', 'Chidi', 'Anya',
  'Diego', 'Ruth', 'Kenji', 'Freya', 'Tariq', 'Claire', 'Andres', 'Mei', 'Oscar', 'Sana',
];
const EMP_LAST = [
  'Patel', 'Whitfield', 'Novak', 'Reyes', 'Okonkwo', 'Bergstrom', 'Alvarez', 'Nakamura', 'Fairweather', 'Osei',
  'Kowalski', 'Delacroix', 'Singh', 'Marchetti', 'Hassan', 'Larsen', 'Castillo', 'Vance', 'Ibrahim', 'Sato',
  'Beaumont', 'Adeyemi', 'Rossi', 'Kim', 'O’Brien', 'Volkov', 'Mensah', 'Duarte', 'Lindqvist', 'Chowdhury',
];

/* ------------------------------ Small utilities ---------------------------- */

function _empHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function _empClamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

/** Deterministic seeded PRNG (mulberry32) — same seed always yields the same
 *  candidate, so pools can be re-derived on demand without persisting them. */
function _mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Skewed skill-tier roll: most candidates are solid-but-unremarkable,
 *  legends are rare. */
function _tierRoll(rng) {
  const r = rng();
  if (r < 0.72) return 35 + rng() * 40;   // common: 35-75
  if (r < 0.95) return 75 + rng() * 17;   // uncommon: 75-92
  return 92 + rng() * 7;                  // rare: 92-99
}

/* ------------------------------- Wage formula ------------------------------ */

const EMP_SALARY_MIN = 45000;
const EMP_SALARY_MAX = 320000;

/** The speciality currently in demand for a role — rotates on `cycle` (an
 *  integer the caller advances over time, e.g. once a game-week). Candidates
 *  matching it command a pay premium ("Demand for that speciality right now"). */
function empHotSpeciality(roleId, cycle) {
  const role = EMP_ROLES[roleId];
  if (!role) return null;
  const specs = role.specialities;
  const h = _empHash(roleId + '#hot#' + (cycle || 0));
  return specs[h % specs.length];
}

/** Salary derives from Skill (overall) + Experience + Specialisation match
 *  (whether their speciality is the role's current hot one) + company
 *  Reputation + Demand (the same hot-speciality signal). Human-realistic
 *  numbers — js/techco.js scales these into the game's payroll economy. */
function empSalaryFor(overall, experienceAttr, roleId, speciality, reputation, cycle) {
  const base = EMP_SALARY_MIN + Math.pow(_empClamp(overall, 0, 99) / 99, 1.6) * (EMP_SALARY_MAX - EMP_SALARY_MIN);
  const exp = experienceAttr != null ? experienceAttr : overall;
  const expFactor = 0.85 + (exp / 99) * 0.4;                                   // 0.85x .. 1.25x
  const hot = empHotSpeciality(roleId, cycle) === speciality ? 1.22 : 1.0;     // specialisation match + demand
  const rep = reputation != null ? reputation : 60;
  const repFactor = 1 - _empClamp((rep - 50) / 400, -0.1, 0.1);                // prestige: a well-regarded company pays a little less for the same talent
  const raw = base * expFactor * hot * repFactor;
  // Human-realistic range always holds, even for a maxed-out legendary hire
  // with a specialisation-match premium stacked on top.
  return Math.round(_empClamp(raw, EMP_SALARY_MIN, EMP_SALARY_MAX) / 500) * 500;
}

/* ------------------------------ Candidate rolls ----------------------------- */

/** Generate one fully-specified, named candidate — deterministic given the
 *  same (roleId, seed, opts). opts: { reputation, cycle }. */
function empGenCandidate(roleId, seed, opts) {
  const role = EMP_ROLES[roleId];
  if (!role) return null;
  opts = opts || {};
  const rng = _mulberry32(seed);
  const overall = Math.round(_tierRoll(rng));
  const attrs = {};
  for (const a of EMP_ATTRS) {
    const w = role.weights[a] || 0;
    if (w <= 0) { attrs[a] = null; continue; }
    const spread = (w - 1) * 14;               // above-baseline weights roll above Overall, below-baseline under it
    const noise = (rng() - 0.5) * 12;
    attrs[a] = Math.round(_empClamp(overall + spread + noise, 5, 99));
  }
  const expForAge = attrs.experience != null ? attrs.experience : overall;
  const age = Math.round(_empClamp(22 + (expForAge / 99) * 34 + (rng() - 0.5) * 10, 22, 65));
  const speciality = role.specialities[Math.floor(rng() * role.specialities.length)];
  const satisfaction = Math.round(_empClamp(60 + rng() * 35 - (age > 55 ? 8 : 0), 40, 99));
  const salaryYear = empSalaryFor(overall, attrs.experience, roleId, speciality, opts.reputation, opts.cycle);
  const signingBonus = Math.round((salaryYear * (0.20 + rng() * 0.15)) / 500) * 500;
  const first = EMP_FIRST[Math.floor(rng() * EMP_FIRST.length)];
  const last = EMP_LAST[Math.floor(rng() * EMP_LAST.length)];
  const isDoctor = role.category === 'research_tech' && overall >= 78 && rng() < 0.5;
  const name = (isDoctor ? 'Dr. ' : '') + first + ' ' + last;

  return {
    seed, roleId, category: role.category, name, speciality,
    overall, attrs, age, salaryYear, signingBonus, satisfaction,
  };
}

/** The passive candidate pool for a role: a handful of free-to-browse
 *  candidates that rotate slowly over time (per `cycle`). Nothing is
 *  persisted — the pool is fully re-derived from (companyId, roleId, cycle). */
function empPassivePool(companyId, roleId, poolSize, cycle, opts) {
  const out = [];
  for (let i = 0; i < poolSize; i++) {
    const seed = _empHash(companyId + '#pool#' + roleId + '#' + cycle + '#' + i);
    out.push(empGenCandidate(roleId, seed, opts));
  }
  return out;
}

/** A headhunted pool: smaller, biased upward, and any requested filters are
 *  enforced as floors — you pay for a guarantee, not just better odds.
 *  `searchIndex` should increment each time the player pays to search again
 *  (so repeated searches don't return the same people). */
function empHeadhuntPool(companyId, roleId, filters, searchIndex, cycle, opts) {
  filters = filters || {};
  const poolSize = 3;
  const out = [];
  for (let i = 0; i < poolSize; i++) {
    const seed = _empHash(companyId + '#hunt#' + roleId + '#' + searchIndex + '#' + cycle + '#' + i);
    const rng = _mulberry32(seed ^ 0x9e3779b9);
    // Bias the tier roll upward for a headhunted search, then floor any
    // explicitly requested attribute minimums.
    const boosted = seed + Math.floor(rng() * 1000) + 5000;
    const c = empGenCandidate(roleId, boosted, opts);
    if (filters.minOverall) c.overall = Math.max(c.overall, Math.min(99, filters.minOverall));
    if (filters.minAttrs) {
      for (const k in filters.minAttrs) {
        if (c.attrs[k] != null) c.attrs[k] = Math.max(c.attrs[k], Math.min(99, filters.minAttrs[k]));
      }
    }
    if (filters.speciality && EMP_ROLES[roleId].specialities.indexOf(filters.speciality) >= 0) c.speciality = filters.speciality;
    // Recompute salary against the (possibly boosted) final stats.
    c.salaryYear = empSalaryFor(c.overall, c.attrs.experience, roleId, c.speciality, opts && opts.reputation, cycle);
    c.signingBonus = Math.round((c.salaryYear * 0.28) / 500) * 500;
    out.push(c);
  }
  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    EMP_ATTRS, EMP_ATTR_LABELS, EMP_CATEGORIES, EMP_ROLES, EMP_ROLE_IDS, EMP_ROLES_BY_CATEGORY,
    EMP_SALARY_MIN, EMP_SALARY_MAX,
    empHotSpeciality, empSalaryFor, empGenCandidate, empPassivePool, empHeadhuntPool,
  };
}
