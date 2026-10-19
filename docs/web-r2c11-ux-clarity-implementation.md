# WEB-R2c.1.1 — clarificări UX pentru filtrul OSM și comenzile geometrice

**Status:** IMPLEMENTED IN SEPARATE PR — pending exact-SHA CI, review, browser captures and controlled merge.
**Baseline:** `main@fd7a2551c691accd669d005f948500d145613a89` (WEB-R2c.1.2 closed); specification `docs/web-r2c1-ux-ui-specification.md`.

## Changes

- UX-08/UX-01: `index.html` explains the separation of map filtering (jurisdiction, administrative type, statistical levels) from the **OSM tree-only** filter. The OSM level controls are explicitly labelled "Toate nivelurile în arbore" / "Niciun nivel în arbore".
- UX-02: `osmTreeFilterSummary` derives **M directly matching tree-node IDs** and **A navigation-only ancestor IDs**, deduplicated in the full validated tree; the filter section displays "În arbore (toate ramurile): M potriviri și A strămoși de navigare". These counts are **not** geometry counts; NI role aliases are navigational nodes, not extra checkbox geometries.
- UX-02/UX-01: the existing explicit geometry preview uses **E eligible independent geometries** and **C actually changed checkboxes** from the existing `planOsmLevelGeometryAction` contract, alongside RO/MD/NI change distribution. The preview says "Vor fi bifate/debifate C dintre E geometrii eligibile", not an unverifiable count of currently rendered polygons.
- UX-04: after validated hierarchy loading, an empty OSM filter shows the specific "Niciun nivel OSM selectat..." message; a nonempty filter with no matching rows displays the distinct no-results message. The loading/error message path remains independent; no automatic reset or checkbox mutation.
- Feedback: the preview with zero numeric levels explains that `unknown` only filters the tree; zero changes with numeric levels says the eligible checkboxes are already in the requested state; Cancel and stale-preview feedback is clearer.

## Invariants

- OSM admin level values `2,3,4,5,7,8,9,unknown` and its source/provenance remain unchanged. No numeric inference or rewrite of geometry roles.
- The 85 NI reused roles are excluded from all independent geometry mutations. Eight NI outlines keep their own checkboxes. Default RO/MD/NI settings remain unchanged.
- No modification to `atlas-osm-level-geometry-actions.mjs`, `atlas-url-state.mjs`, geometry taxonomy, statistical logic, Undo semantics, Back/Forward, query parameters `a/x/o`, or persisted state.
- ACTUAL immutable snapshot `actual-a9e5a4ddcb5277ef`, fingerprint `a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446`; `actual_mutation_allowed=false`, `p91_import_allowed=false`, `semantic_acceptance=BLOCKED_INCOMPLETE`.
- Do not declare UX-03 focus/ARIA or UX-05 performance work completed: these belong in later separately approved stages.

## Test and acceptance plan

New `scripts/test/frontend-web-r2c11-ux-clarity.test.mjs` exercises:
1. M/A disjoint count, ancestors retained, blank selection and `unknown`;
2. NI alias **counts as a navigable row** but **not an eligible polygon**, while E/C come from the existing action planner;
3. 'Toate/Niciun nivel în arbore' cannot change geometry or statistical selections;
4. HTML/copy/empty-state and preserved URL/Undo implementation;
5. RO+MD public corpus count from validated hierarchy, independent of DOM expansion/virtualization.

Regression suite: `node --test scripts/test/frontend-web-r2c11-ux-clarity.test.mjs scripts/test/frontend-web-r2b2-osm-filter.test.mjs scripts/test/frontend-web-r2b3-osm-actions.test.mjs scripts/test/frontend-atlas-filters.test.mjs scripts/test/frontend-atlas-url-state.test.mjs scripts/test/frontend-atlas-tree.test.mjs`, plus exact-SHA full workflows.

Browser acceptance requires the existing free GitHub Actions Chromium desktop/mobile suite and capture inspection before merge. Audit after merge must check actual GitHub Pages workflow and post-merge CI on the resulting SHA. No TinyFish or paid services.

**Gate:** this document records the change intent; it is not an assertion that CI or browser QA passed before their results exist. Merge is blocked until all required checks pass, changed files are explicitly reviewed, and scoped integration is authorized.
