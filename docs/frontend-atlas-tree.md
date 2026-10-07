# web-v1.2.1 Atlas tree synchronization

`selectEntity(id, options)` remains the single controller for map, search, tree and breadcrumb. Boolean zoom arguments remain compatible. Geometry visibility still comes exclusively from `geometry-taxonomy.mjs`; selecting hidden geometry keeps filters unchanged and preserves details, breadcrumb and tree selection.

`atlas-tree.mjs` exports pure parent/children/path helpers using only consolidated `parent_id` / `child_ids`. Every path is checked for missing nodes, cycles, reciprocal edges and a declared root. The lazy tree controller keeps an ID-to-rendered-node map. It explicitly materializes each ancestor's children before opening the native `<details>`, independent of deferred browser `toggle` events. Native summary disclosure and entity selection are separate keyboard controls. One button has `aria-pressed=true`; clear removes it and preserves disclosure state.

Selection brings an offscreen row into the tree by changing only the tree container's `scrollTop`; visible rows do not scroll. This avoids outer panel/page movement and repeated scrolling. Breadcrumb is a semantic navigation list derived from the same full consolidated path, shows display names and compact statistical codes, and routes every segment through the central selection function.

Validation: `node --check app.js`, `node --check geometry-taxonomy.mjs`, `node --check atlas-tree.mjs`, and `node --test scripts/test/frontend-smoke.test.mjs scripts/test/actual-statistical-public.test.mjs scripts/test/frontend-geometry-taxonomy.test.mjs scripts/test/frontend-atlas-tree.test.mjs`. The existing frontend workflow runs all four suites and checks `git diff --exit-code`. Atlas tests exercise all 5848 real paths plus event-capable simulated DOM/Leaflet integration for hidden geometry, search, map, tree, breadcrumb, highlight/zoom and clear. Coalesced administrative/statistical nodes remain unique.

No browser E2E framework or dependencies were added. Browser E2E and visual QA remain in web-v1.2.7, as scoped. Mobile redesign, URL state, keyboard search redesign, subtype/filter redesign and the remaining Atlas UX are excluded.

ACTUAL/P2 files, geometry taxonomy, source snapshots, registries, contracts, release identity and the `actual-v1.2.0` tag are outside this change. Byte-level audits compare tracked files against the original Git object bytes (Windows checkout newline conversion is disabled locally).
