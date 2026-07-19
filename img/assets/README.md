# Item images (drop-in)

Put a PNG here named after an item's `id` and its card picks it up
automatically — no code changes. Until a file exists, cards show a coloured
placeholder with the set/tier icon.

- Naming: `<id>.png` (e.g. `chiroon.png`, `apartment.png`, `mega_yacht.png`)
- IDs live in `js/data/assets.js` (`ESTATE_DEFS` and `LUXURY_DEFS`)
- Recommended: square-ish, ≤ 512px wide, transparent or dark background
  (they sit on a dark card and are ~96px tall in the UI)

Examples: `rusty_hatch.png`, `nightfire_gt.png`, `bellair_57.png`,
`valkyra.png`, `exec_heli.png`, `light_jet.png`, `crown_jewel.png`,
`villa.png`, `commercial.png`, `estate.png`
