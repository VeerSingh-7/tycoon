# Designed asset logos (drop-in overrides)

Every stock/asset gets a **generated** SVG logo automatically (js/logos.js).
To hand-swap a specific one, drop an SVG here named after the asset's **ticker**
(lowercased) — it covers the generated logo everywhere, no code changes.

- Naming: `<ticker>.svg` (e.g. `mngo.svg`, `ggl.svg`, `tzla.svg`, `amz.svg`)
- Tickers live in `js/data/stocks.js` (`STOCK_ROSTER`) and `js/data/markets.js`
  (`CRYPTO_DEFS`)
- Recommended: a 100×100 viewBox mark. When the override loads, the generated
  tile beneath it is hidden, so the file's own shape shows (these ship circular)
- A missing file is detected once per session and silently falls back to the
  generated logo (no repeated requests)
- New override files must also be added to the precache list in
  `service-worker.js` (and bump `CACHE_NAME`) so they work offline
