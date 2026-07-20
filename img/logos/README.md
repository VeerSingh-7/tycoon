# Stock logo overrides (drop-in)

Every stock/asset gets a **generated** SVG logo automatically (js/logos.js).
To hand-swap a specific one, drop a PNG here named after the asset's `id` —
it will cover the generated logo everywhere, no code changes.

- Naming: `<id>.png` (e.g. `mango.png`, `googol.png`, `tezla.png`, `gold.png`)
- IDs live in `js/data/stocks.js` (`STOCK_ROSTER`) and `js/data/markets.js`
  (`COMMODITY_DEFS`)
- Recommended: square, 128–256px, will be shown rounded (24% corner radius)
  at 26–52px — keep the mark bold and simple
- A missing file is detected once per session and silently falls back to the
  generated logo (no repeated requests)
