# TYCOON — Game Plan & Full Vision

A deep mobile idle / business-tycoon **web game** (plain HTML/CSS/JS, installable PWA).
The design goal: keep the addictive "always a next goal 2–10 minutes away" loop of the genre,
but fix the parts that are usually badly balanced or shallow.

> **Money colour = gold.** Dark, modern, mobile-first. Bottom-nav app shell.

---

## 0. Design Philosophy & Improvements Over Typical Genre Games

These are deliberate changes vs. the usual "AdVenture Capitalist / Idle Tycoon / Bid Wars" formula:

| # | Common genre problem | Our improvement |
|---|----------------------|-----------------|
| 1 | **Runaway exponential costs** make late levels feel identical and forces prestige grind. | Softer, tiered cost curves + meaningful **milestone upgrades** (discrete multipliers) so each purchase *feels* different, not just "buy 100 more". |
| 2 | **Offline earnings uncapped or punishingly low.** | Offline earns at 100% for a generous window (default 8h in later phases, 2h in Phase 1) then tapers, with a clear "While you were away" summary. Encourages return without punishing life. |
| 3 | **Tapping becomes useless in 2 minutes.** | Tap earnings scale with net worth (a % of income) in later phases + tap boosters, so active play always matters a little. Phase 1 lays the upgradeable-tap foundation. |
| 4 | **Businesses are cosmetic reskins** with identical mechanics. | Every business has a **distinct mini-mechanic** (see below). Same core income formula, different *strategy layer*. |
| 5 | **Investing is fake** (a slot machine with a chart skin). | Real market model: trends, cycles, volatility, dividends, correlations. Risk vs reward genuinely differs by asset class. |
| 6 | **Prestige wipes everything and feels bad.** | "Legacy" prestige keeps collectibles & titles; resets only businesses for a permanent multiplier. Optional, not mandatory to progress. |
| 7 | **No sense of identity/status.** | Titles, reputation, luxury collection bonuses, and a Profile that shows *who you've become*, not just a number. |
| 8 | **Employees are a fake cost sink.** | Employees are a productivity system: hire, assign, upgrade management → real income multipliers and unlock business capacity. |
| 9 | **Numbers get incomprehensible.** | Consistent short-scale formatter (K/M/B/T/Qa/Qi…) everywhere, plus "time to afford" hints. |
| 10 | **Difficulty drifts into grind** as content is bolted on. | Standing rule (applies to every phase, incl. 8–12): engaging, never too grindy — each session ends with visible progress; new friction must ship with equal new agency (boosters, choices, shortcuts), never just longer timers. |

**Economy targets:** early game goals ~2 min apart, mid game ~5–10 min, late game reaches **trillions+**.
Every screen should always show *one thing you can almost afford*.

---

## 1. BUSINESSES

Shared per-business schema (data-driven — see `js/data/businesses.js`):
`startup cost, cost growth curve, base income, income formula, employee requirement, milestone upgrades, max profit / cap, distinct mini-mechanic`.

| Business | Startup tier | Distinct mini-mechanic |
|----------|-------------|------------------------|
| **Retail Store** | Starter | Stock/restock cycles; sales events multiply income briefly. |
| **Taxi Company** | Starter | Fleet size & driver shifts; surge-pricing events. |
| **Restaurant** | Starter | Menu/table capacity; reputation stars raise price-per-cover. |
| **Bank** | Mid | Manages player deposits/loans; earns on the spread (ties into Banking). |
| **Transportation / Logistics** | Mid | Routes & fleets; fuel cost sensitivity to oil price. |
| **Oil & Gas** | Mid | Extraction rate; income tied to live commodity price (Invest tab). |
| **IT Company** | Mid–Late | Runs **software projects**: assign developers / designers / QA; projects have deadlines, quality scores, and payouts. |
| **Construction Company** | Mid–Late | **Build timers + materials**: queue projects, consume materials, deliver for lump sums (feeds Real Estate). |
| **Clothing Business** | Mid–Late | Follows **fashion trends**: match the current trend for bonus, miss it and margins drop. |
| **Sports Clubs** (Football, Basketball, Baseball, Hockey) | Late | **Championships, fans, sponsorships**: win seasons → fans → sponsorship & merch income. |
| **Airline** | Late / Endgame | Routes, fleet, seasonal demand; prestige status business. |

Each business unlocks via **business slots** gated by player level / net worth.

---

## 2. INVESTING (Trading 212–style)

- Full-screen **trading view** with **candlestick charts** and **live-moving prices**.
- **Market trends & cycles**: bull/bear regimes, sector rotation, volatility spikes, occasional crashes & rallies.
- **Asset classes:**
  - **Stocks** — parody company names (e.g. "Ramble", "Googol", "Vizla", "Amazing", "Mango Inc"), some pay **dividends**.
  - **Cryptocurrencies** — high volatility, no dividends, dramatic cycles.
  - **Commodities** — oil, gold, wheat; tie back into Oil & Gas / businesses.
- **Risk vs reward matters**: crypto swings hard, blue-chips are steady + dividends, commodities are cyclical.
- Buy/sell with spreads & fees; portfolio P/L; watchlists & filters.

---

## 3. REAL ESTATE

- Property types: **apartments, villas, mansions, commercial buildings, country estates**.
- Each has **purchase price, rental income, price appreciation over time, and ROI display**.
- Passive **rent** income + long-term **capital appreciation** (sell high).
- Fed by the Construction business (build to own cheaper).

---

## 4. LUXURY COLLECTION

- **Cars**: cheap → sports → hypercars; separate **classic/retro** line.
- **Jets, helicopters, boats, jewellery.**
- **Collection bonuses**: completing a set (e.g. all hypercars, full jewellery) grants permanent multipliers / reputation.
- Pure flex + strategic buffs; some appreciate like real estate.

---

## 5. BANKING

- **Deposits** — park cash to earn safe interest.
- **Loans** — borrow against net worth, pay **interest**; leverage to grow faster (risk).
- **Taxes** — periodic tax on income/wealth; **tax penalties** for late/dodged payments; tax-optimisation upgrades.

---

## 6. EMPLOYEES

- **Hiring** pools by role (workers, managers, specialists — devs/designers/QA for IT, drivers for taxi, etc.).
- **Salaries** are an ongoing cost; **productivity** multiplies business output.
- **Management upgrades** raise capacity and efficiency; automation reduces active micromanagement.

---

## 7. PROGRESSION

- **Player level** (XP from earnings & actions), **reputation**, **titles** (e.g. "Street Vendor" → "Tycoon" → "Magnate" → "Titan").
- **Achievements & milestones** with rewards.
- **Business slots** unlock as net worth / level grows.
- Optional **Legacy prestige** (keeps collectibles & titles; resets businesses for a permanent multiplier).

---

## 8. INCOME SOURCES

Active clicking · passive business income · dividends · rent · trading profits · random events (surges, crashes, gifts) · temporary **boosters / multipliers** (watch-an-event, timed x2, etc.).

---

## 9. ECONOMY DESIGN — **The Economy Bible** *(canonical; every phase follows these numbers)*

> Set in the Phase 2 rebalance (save v2). Modelled on a real business-tycoon reference
> game: slow, long arc — hundreds → thousands → millions → billions → trillions.

### 9.1 Money representation & display
- All money is a **floating-point number internally**; income adds the **exact**
  per-second rate each tick (never rounded).
- Display: below **$10,000** show the exact value with **two decimals** ("$12.60",
  "$4,900.00"); from $10,000 switch to **K / M / B / T / Qa / Qi…** ("$12.6K").

### 9.2 Tap loop
- Per-tap starts at **$2.50**; value **×1.8** per upgrade level.
- First tap upgrade costs **$1,000**; cost **×3** per level (tapping stays a
  kick-starter, passive income overtakes it — by design).

### 9.3 Businesses — startup ladder (11 businesses)
| # | Business | Startup cost | Income/s @ Lv 1 | Player-level unlock |
|---|----------|-------------|-----------------|---------------------|
| 1 | Retail Store | $4,900 | $8 | 1 |
| 2 | Taxi Company | $10K | $14 | 2 |
| 3 | Restaurant | $20K | $24 | 3 |
| 4 | Clothing Business | $25K | $28 | 4 |
| 5 | Transportation Co. | $35K | $35 | 5 |
| 6 | Construction Co. | $40K | $38 | 6 |
| 7 | Bank | $200K | $130 | 7 |
| 8 | Oil & Gas | $1M | $500 | 8 |
| 9 | IT Company | $5M | $1.9K | 9 |
| 10 | Sports Club | $50M | $14K | 10 |
| 11 | Airline | $1B | $200K | 11 |

### 9.4 Level & upgrade curves (deep, effectively endless)
- **Level cost:** `baseCost × 1.15^level` — each level ≈ +15%, 100+ levels viable.
- **Income:** `baseIncome × level × 2^milestones × namedUpgrades × mechanic ×
  staffBoost − salaries`.
- **Milestones:** output **×2 at levels 25, 50, 100, 200, 300…** (then every 100) —
  the big jumps to chase.
- **Named upgrades:** 3 per business at levels **10 / 40 / 75**, multipliers
  **×2 / ×3 / ×5**, costing **50× / 1,200× / 25,000×** the base cost.

### 9.5 Player level, reputation & slots
- Level N requires lifetime earnings ≥ **$1,000 × 5^(N−2)** (L2 $1K, L3 $5K,
  L4 $25K, L7 $3.1M, L10 $390M, L11 $1.95B…).
- **Business slots:** 2 at level 1, **+1 every 2 levels**, capped at 11 — you can’t
  run everything at once; choosing (or selling at a 25% refund) is the strategy.

### 9.6 Employees & management
- Hire cost: `baseCost × 0.35 × 1.35^staffCount`; capacity `2 + level/5`.
- Each employee: **+6% output**; salary **1.5%** of linear income each (paid from
  the business's gross).
- Global **Management** upgrade: staff **+25% effective per level**; cost
  $50K × 8^level.

### 9.7 Offline
- **100% earnings up to a 2h cap** (Phase 1 value; extends with later upgrades),
  shown in the "While you were away" popup. Mechanic timers use wall-clock, so
  builds/projects progress while closed; bank interest compounds offline.

### 9.8 Progression & Legacy (Phase 3)
- **Global income multiplier** = reputation × achievements × legacy × active events,
  applied to every business's net income (and therefore mechanic payouts + offline).
- **Reputation:** +0.5% income per point; earned from achievements (2–15 each)
  and +10 per Legacy reset.
- **Achievements:** 21 goals; rewards are one-time cash or permanent ×1.05/×1.10
  income (all completed ≈ ×2 total).
- **Random events:** every 3–7 min of active play — Demand Surge (income ×2, 60s),
  Gone Viral (taps ×5, 45s), Market Opportunity / Angel Investor (cash = 90–180s of
  income), Tax Inspection (loss of 45s income, capped at 10% of cash, skipped when broke).
- **Booster:** Hustle Mode — ×2 income for 120s, 30 min cooldown, free.
- **Legacy (prestige):** points = ⌊√(runEarned / $10M)⌋ → first point at $10M,
  10 pts at $1B, 20 pts at $4B run earnings. Each point: **+10% income forever**
  + $2,500 restart cash. KEEPS level/slots/achievements/rep (the genre fix:
  prestige is rewarding, never punishing). Resets businesses, cash, tap, management.
- **Titles:** Street Vendor (1) → Market Trader (3) → Shop Owner (5) → Entrepreneur (7)
  → Business Magnate (9) → Tycoon (11) → Mogul (13) → Titan (15) → Business Legend (18).
- Save **v3** (v2 saves migrate in place, no reset).

### 9.9 Investing (Phase 4 — overhauled to a full trading app)
- **Procedural price model (the scalable core):** every price is a *pure
  deterministic function of absolute wall-clock time*,
  `priceAt = refPrice × exp(clampedTrend) × exp(vol·fbm(seed,t)) × managerFactor`.
  Trend is anchored to a FIXED epoch (2025-01-01), so historical candles stay
  stable as real time passes. Multi-octave fractal noise (periods 730→0.4 days
  + a fast live tick) makes regimes, volatility and crashes *emerge* — no stored
  random walk, nothing stepped per tick.
- **Why:** supports ~170 assets on a phone. The markets list just re-reads
  `priceAt(now)`; candle history is generated on demand back to each company's
  founding date; only the OPEN asset runs the full chart.
- **Roster (~170):** 101 fictional parody stocks (obvious fakes — Mango Inc,
  Googol, Tezla, Toyoda, Envidia, Macrosoft… — no real names/tickers) across 16
  sectors, plus crypto, precious/industrial metals, energy, agriculture, softs,
  livestock, forestry, gemstones, and financial assets (cash, savings, bonds,
  T-bills, REITs, property). All data-driven in `data/markets.js` + `data/stocks.js`.
- **Risk ladder (vol scale):** cash 0 · bonds/T-bills 0.002–0.006 · gold 0.010 ·
  blue-chips 0.013–0.022 · growth/semis 0.030–0.050 · crypto 0.09–0.13.
- **Per-stock stats (all procedural from a seed):** market cap, company value,
  P/E, EPS, dividend yield, avg volume, shares available, cost to buy out.
- **Company buyout:** own ≥50% of a stock's shares → **Manage** panel with four
  plain-English decisions — Invest in growth (permanent upward drift), Pay
  yourself (cash now, 5-min cooldown), Cut costs (+10% price for 5 min), Expand
  (permanent company-value rise). Effects feed back into `priceAt`.
- **Crude Oil** is still `Mechanics.oilPrice()` × $80 — the same cycle Oil & Gas
  and Transport react to. Cash is flat; Savings grows smoothly.
- **UI:** markets list (grouped + filter chips), asset detail (big price, today &
  1-month change, inline chart, stats, buyout/manage, pinned Buy/Sell), fullscreen
  chart with 1D/1W/1M/3M/1Y/Max, and a Buy/Sell **trade ticket** (slider + quick %
  → Review order). Our own dark+gold canvas candlesticks (no chart library).
- **Logos:** every asset gets a procedural SVG identity (js/logos.js) — ~19
  geometric symbols + monogram letterforms, 14 curated gradients, all picked
  deterministically from the name and cached as strings. Hand-swap any logo by
  dropping `img/logos/<id>.png` in (404s are remembered per session).
- **List organisation:** search bar (name/ticker) → filter chips (All, Stocks,
  Crypto, Commodities, Property, Savings & Bonds, ★ Watchlist, Holdings) →
  sort control (Top Movers by |Δ%| / A–Z / Price) → collapsible sections:
  stocks in 9 sectors (Technology … Industrials via SECTOR_TO_SECTION),
  commodities in 8 sub-groups. Stock sectors start collapsed (tidy index).
  Watchlist stars persist in the save (**v7**, migrates in place). Live price
  patching only touches rows on screen (IntersectionObserver).
- **Spread:** buy +0.5% / sell −0.5%. **Dividends/coupons** every 5 min on stocks,
  bonds, REITs & property. **Earnings rule:** dividends + realized profits count
  toward XP/Legacy; losses are real.
- Save **v6** — market state is regenerable so it's rebuilt; **portfolio holdings,
  cash and all progress are kept** (migrates in place).

### 9.10 Real Estate & Luxury (Phase 5)
- **Real estate (own multiples):** Apartment $75K/$30s · Villa $400K/$130s ·
  Mansion $2.5M/$650s · Commercial Tower $15M/$3.2Ks · Country Estate $100M/$17Ks.
  Rent joins passive income and is scaled by the global multiplier.
- **Appreciation:** market value = price × (1+apprPerDay)^days since the save's
  asset epoch — 2%/day (low tier) to 4%/day (top tier). Buy early = cheaper.
- **Selling:** market value minus **3% fee**; only profit over average cost
  counts as earnings (same anti-wash rule as trading).
- **Luxury:** 26 collectibles in 9 sets (starter/sports/classic/super/hyper
  cars, helicopters, boats, jets, jewellery). Completing a set grants a
  permanent income bonus ×1.02–×1.08 (all sets ≈ ×1.55 combined).
- **Images:** every item auto-loads `img/assets/<id>.png` when present;
  coloured placeholder until then.
- **Chart note:** the Invest tab's candlesticks are OUR OWN canvas renderer
  (js/chart.js) — zero external dependencies, fully offline.
- Save **v5** (migrates in place — no progress wiped).

### 9.11 Pacing targets
- First business ≈ 15–30 min in; first hour ends around a few hundred $/s.
- Always a goal 2–10 min away (next level, milestone, named upgrade, hire, unlock).
- Trillions reached only in the late game (Sports/Airline top upgrades are $1.25T/$25T).

---

## 10. INTERFACE

Bottom-nav mobile app layout:

| Tab | Purpose |
|-----|---------|
| **Home / Earnings** | Tap zone, balance, income/sec, boosters, stats. |
| **Business** | Own & upgrade businesses; mini-mechanics. |
| **Invest** | Trading screen (stocks / crypto / commodities). |
| **Assets** | Real estate + luxury collection. |
| **Profile** | Level, titles, achievements, banking, employees, settings. |

Stats, filters, and sorting throughout.

---

## 11. BUILD PHASES (Roadmap)

### ✅ Phase 1 — Core Loop & Shell *(this build)*
1. Core **tap loop**: big tap zone, smooth counting balance, floating **+$** & coin effects, upgradeable per-tap earnings with rising cost + progress bar.
2. **App shell**: bottom nav, all 5 tabs; unbuilt tabs show "coming soon".
3. **First 3 businesses** (Retail Store, Taxi Company, Restaurant): buy → passive income/sec; each ≥3 upgrade levels.
4. **Offline earnings** with "While you were away" popup.
5. **localStorage** save/load (auto + on close).
6. **Money formatter** (K/M/B/T…).
7. **Installable PWA**: manifest + service worker, dark theme, gold money colour.

### ✅ Phase 2 — Business Depth & Employees *(built, incl. full economy rebalance → §9)*
- Remaining businesses (Bank, Transportation, Oil & Gas, IT, Construction, Clothing, Sports, Airline).
- Distinct mini-mechanics per business (bank deposits/interest, transport routes + fuel,
  oil price cycle, IT software projects, construction build timers + materials,
  fashion trends, sports matches/fans/championships, airline routes).
- Employees: hiring, salaries, productivity, global management upgrades.
- Business slots gated by player level; sell (25% refund) to free a slot.

### ✅ Phase 3 — Progression & Meta *(built — numbers in §9.8)*
- Player level/XP bar, reputation, 9 titles (Street Vendor → Business Legend).
- 21 achievements with cash / permanent-multiplier rewards, shown in a Profile grid.
- Random events (surge, viral, windfall, investor, tax inspection) + Hustle Mode booster.
- Legacy prestige: rewarding by design — keeps level/slots/achievements/rep,
  full gain preview before confirming.
- Profile tab: title, level, rep, multiplier breakdown, lifetime stats, Legacy screen.

### ✅ Phase 4 — Investing *(built + overhauled into a full trading app — see §9.9)*
- Trading 212–style Invest tab: candlestick charts (TradingView Lightweight
  Charts via CDN, service-worker cached for offline), 10s/1m timeframes.
- Organic-but-stable market sim: regimes, vol spikes, crashes/rallies.
- 6 parody stocks with dividends, 3 crypto, 3 commodities — Crude Oil shares
  the businesses' oil price. Buy/Sell with 0.5% spread; portfolio P/L in $ and %.

### ✅ Phase 5 — Real Estate & Luxury *(built — numbers in §9.10; incl. custom canvas chart replacing the TradingView CDN)*
- Assets tab: 5 property tiers (rent + appreciation + ROI + 3%-fee sells, own multiples).
- 26-item luxury collection in 9 sets with permanent set bonuses; drop-in images.
- Invest charts now self-drawn on canvas — zero third-party dependencies.

### Phase 6 — Banking & Economy Tuning
- Deposits, loans, interest, taxes & penalties.
- Full economy balance pass to trillions; offline taper tuning.

### Phase 7 — Polish
- Sound, haptics, animations, onboarding, cloud save, settings, accessibility.

---

## 11b. EXPANSION PHASES (Phases 8–12, planned — not built yet)

> Ordered by value-vs-complexity and by dependency: quick core-loop delight first,
> then deepen what exists, then identity, then the two big tech/endgame pieces.
> **Standing rule for all of them (and all tuning passes): difficulty must stay
> engaging and never too grindy** — every session should end with visible progress
> and a clear next goal; if a phase adds friction, it must add an equal amount of
> agency (boosters, choices, shortcuts), never just longer timers.

### Phase 8 — Credit-Card Clicker *(core-loop glow-up; small, ships fast)*
- Replace the round tap zone with a **realistic, customisable credit card** —
  embossed number, holder name (ties into Phase 10's character name), chip, shine.
- **Card tiers that upgrade with wealth**: Basic → Gold → Platinum → Black/Diamond,
  each with premium visuals (materials, glow, animations).
- Tiers carry **perks**, not just looks: e.g. small tap multiplier, +offline cap,
  booster cooldown reduction — modest, so it's status first, power second.
- Customisation: colours/finishes unlocked via achievements & titles.
- *Why first among the new phases:* touches the screen players see most, pure
  CSS/DOM work, zero new systems.

### Phase 9 — Deep Per-Business Management *(deepens the existing core)*
- Each business graduates from one card to its **own management screen** with
  systems of its own — e.g. **Taxi**: fleet customisation (buy/upgrade individual
  cars), base locations on a city map, per-base staff and salaries; Restaurant:
  menus & venues; Retail: individual stores/shops with locations.
- **More business types and stores/shops** added to the roster (the data-driven
  format makes these drop-in).
- Employees become per-location where it matters (prepares Phase 11's per-country
  bases — this phase builds the "base" concept the world map will reuse).

### Phase 10 — Character Creator & Identity
- **Name** (appears on the credit card + Profile), **birthplace** (picked from a
  country list now; links to the Phase 11 world map once it exists — birthplace
  becomes your starting country with a small home-turf bonus).
- **Avatar builder**: face shape, hair, skin tone, accessories — shown on the
  Profile and next to titles.
- *Later option (explicitly deferred):* **selfie-to-avatar**. Privacy-sensitive by
  design — **on-device processing only, fully optional, no image ever uploaded or
  stored beyond the generated avatar**, with a plain-language consent step.
- *Why here:* light, self-contained, and both Phase 8 (card name) and Phase 11
  (birthplace) read from it.

### Phase 11 — World Map & Global Expansion *(the endgame pillar)*
- Interactive **world map of individual countries**; expand by **placing business
  bases per country** — hire, build and manage per location (reuses Phase 9's
  base/per-location systems).
- Country traits: market size, wages, taxes, demand profiles — placement is a
  strategic choice, not a checklist.
- **Late game: buy out entire countries** — acquire their businesses, assets, even
  gold reserves/economy; the trillions-scale money sink the economy has been
  building toward. Country ownership grants global bonuses and Legend-tier status.
- Depends on: Phase 9 (bases), Phase 10 (birthplace); interacts with taxes (Phase 6).

### Phase 12 — 3D Vehicle Viewer *(premium showcase; tech-heavy, cosmetic)*
- **WebGL viewer for hero vehicles** in the luxury collection (Phase 5 content).
- **Start light**: a 360° turntable spin of a handful of flagship models
  (one hypercar, one classic, one jet), lazy-loaded so the PWA stays lean.
- Grow later: more models, colour/trim configurator, garage scene.
- *Why last:* pure spectacle with real asset/tech cost — it rewards a collection
  system that Phase 5 must ship first, and blocks nothing.

---

## 12. Architecture (so later phases drop in without rewrites)

```
tycoon/
├── index.html            # app shell markup
├── manifest.json         # PWA manifest
├── service-worker.js     # offline caching
├── GAME_PLAN.md          # this file
├── css/
│   └── styles.css        # dark + gold mobile-first theme
├── icons/                # PWA icons
└── js/
    ├── format.js         # money/number formatter (K/M/B/T…)
    ├── chart.js          # our own canvas candlestick chart (no libraries)
    ├── logos.js          # procedural SVG stock logos (symbols + monograms)
    ├── data/
    │   ├── businesses.js  # DATA-DRIVEN business definitions (add new = add object)
    │   ├── progression.js # titles, achievements, events, prestige tuning (Phase 3)
    │   ├── markets.js     # market config + commodity/financial roster (Phase 4)
    │   ├── stocks.js      # ~101 parody company roster (Phase 4 overhaul)
    │   └── assets.js      # real estate + luxury collection data (Phase 5)
    ├── state.js          # game state, save/load, offline calc, addEarnings()
    ├── engine.js         # economy formulas + tick loop (constants mirror §9)
    ├── mechanics.js      # per-business mini-mechanic handlers (Phase 2)
    ├── progression.js    # rep/achievements/events/booster/prestige engine (Phase 3)
    ├── market.js         # procedural prices, candles, stats, trading, buyouts (Phase 4)
    ├── assets.js         # rent, appreciation, luxury sets engine (Phase 5)
    ├── tap.js            # tap loop + floating effects + booster
    ├── businesses.js     # business tab rendering + buy/upgrade logic
    ├── invest.js         # Invest tab: list, detail, fullscreen, trade ticket, manage (Phase 4)
    ├── assetstab.js      # Assets tab: real estate + luxury UI (Phase 5)
    ├── ui.js             # nav / tab switching / shell / toasts
    ├── profile.js        # Profile tab: identity, stats, Legacy, achievements
    └── main.js           # bootstrap wiring
(img/assets/           # drop <id>.png here to replace item placeholders)
```

**Key extensibility decisions:**
- Businesses, upgrades (and later investments, properties, luxuries) are **plain data objects** in `js/data/` — adding content never touches engine code.
- `engine.js` computes income generically from whatever businesses exist, so Phase 2 businesses just work.
- `state.js` versions the save (`SAVE_VERSION`) with a migration hook for future fields.
- Tabs are registered in `ui.js`; "coming soon" panels become real screens by swapping the render function.
