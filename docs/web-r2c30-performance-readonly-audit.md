# WEB-R2c.3.0 — read-only performance audit (baseline evidence)

Date: 2026-10-19. Source: `main@55cccd747fa5e3f5d244b4a1044f1addd1535115`. Scope: static code review and available CI/browser evidence. **No production source, geometries, ACTUAL, permissions, functional UI, deployment configuration, or dependencies modified.** Not an authorization for WEB-R2c.3.1.

## Method and evidence classes

- **S — Source fact**: inspected at the immutable GitHub SHA above, independent of runtime.
- **C — CI fact**: prior verified post-merge workflow on the exact SHA; green QA is not a timing benchmark.
- **L — Live observation**: published website loaded in a connected browser tab, functionality and release text inspectable; no CDP performance trace.
- **M — Direct measurement**: only repository blob sizes from the Git tree, and verified CI status counts. Not user-perceived latency.
- **U — Unmeasured**: explicit gap. No invented p50/p95, memory, network transfer or frame-time numbers.

### Quantified static baseline (Git tree blob bytes; not minified/gzipped network transfer)

| Module | Bytes | Evidence |
|---|---:|---|
| `atlas-tree-window.mjs` | 2,371 | Git tree |
| `atlas-tree.mjs` | 16,640 | Git tree |
| `atlas-filters.mjs` | 14,665 | Git tree |
| `atlas-osm-admin-filter.mjs` | 1,490 | Git tree |
| `atlas-osm-level-geometry-actions.mjs` | 3,468 | Git tree |
| `atlas-geometry-resources.mjs` | 1,614 | Git tree |
| `atlas-panels.mjs` | 6,069 | Git tree |
| `atlas-osm-admin-badges.mjs` | 1,385 | Git tree |
| `atlas-url-state.mjs` | 8,560 | Git tree |

Post-merge `Frontend browser QA` on 55cccd747fa5e3f5d244b4a1044f1addd1535115: **completed / success**: https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/39278712261. Overall post-merge verification: 12/12 workflows and 19/19 check-runs success; no speed claim follows from these statuses.

## Component review

| Area | Observations | Risk/measurement gap |
|---|---|---|
| Full hierarchy | **S:** `atlas-tree.mjs` imports `flattenVisibleTree` / `createTreeWindow`; maintains rendered row Map; windowed range calculation, removes rows leaving range; scroll rendering scheduled through `requestAnimationFrame`; `atlas-tree-window.mjs` default minimumHeight 44 and overscan 4. | Rebuilding visible row order and remeasurement under massive expansion/filtering needs a measured p50/p95. **No second virtualization**. |
| OSM level 8/9 filtering | **S:** `osmTreeVisibleIds` traverses validated hierarchy; `osmTreeFilterCounts` produces matches/ancestor counts for the whole tree independently from rendered DOM. | Time/allocations for filter toggle and counter recomputation unmeasured. Profile 8-only, 9-only, 8+9, none, all. |
| Geometry loading/rendering | **S:** `atlas-geometry-resources.mjs` caches resolved requests and shares in-flight promises by path; validates byte length and SHA-256 before JSON parse when descriptor exists. | Prevents simultaneous duplicate fetches through this loader, **not** proof of zero duplicate requests across the entire application. Measure actual Network events, parse, hash and Leaflet layer counts. |
| Panel opening/closing | **S:** `atlas-panels.mjs` present; inspection did not yield end-to-end timing. | Measure interaction-to-paint with Performance marks/RAF on desktop/tablet/mobile. |
| Collective preview/confirm/Undo | **S:** `atlas-osm-level-geometry-actions.mjs` plans actions from IDs and checks stale checkbox state before applying; Undo is scoped to transaction changes. `atlas-filters.mjs` attaches show/hide, accept/cancel, Undo handlers. | Need interaction latency, allocation, long-task and consistency metrics at small/full selections. Never change semantics to accelerate. |
| URL/History | **S:** standalone `atlas-url-state.mjs` exists; regression protection in established browser QA. | Measure rapid Back/Forward and selection persistence; no benchmark available. |
| Mobile portrait/landscape, 200% zoom | **C:** prior Chromium browser QA was successful, but not a performance trace. | Establish separate viewport/zoom performance runs, navigation and gesture smoothness, not just screenshot diffs. |
| Memory | **U:** no V8 heap profiles, allocation or detached-node readings obtained. | Run heap baseline + repeated open/close / toggle cycles to check retained heap after GC, report repeated samples. |
| Network | **U:** no full HAR, transfer-byte totals, response timings or cache breakdown measured on this SHA. | Capture cold/warm loads, resource counts, duplicates by URL and initiator, and geometry requests at zoom 6/7/10. |

## Existing reproducible instrumentation

- `scripts/audit/p54-performance-profile.mjs` already reads NavigationTiming, PerformanceResourceTiming, viewport, DOM count, geometry layers and transfer sizes on Pages. Reuse/extend evidence, not application behavior.
- `scripts/audit/p73-virtual-tree-browser.mjs` checks virtualized DOM bounds across scroll fractions and desktop/mobile viewport states; its historical assertions are not current wall-clock latency measurements.
- `scripts/test/helpers/atlas-browser.mjs` provides a local Chromium/CDP QA harness (no automatic browser downloads).
- Relevant existing source: [tree window](https://github.com/ovidiudeica/reforma-teritoriala/blob/55cccd747fa5e3f5d244b4a1044f1addd1535115/atlas-tree-window.mjs), [hierarchy](https://github.com/ovidiudeica/reforma-teritoriala/blob/55cccd747fa5e3f5d244b4a1044f1addd1535115/atlas-tree.mjs), [OSM filter](https://github.com/ovidiudeica/reforma-teritoriala/blob/55cccd747fa5e3f5d244b4a1044f1addd1535115/atlas-osm-admin-filter.mjs), [geometry cache](https://github.com/ovidiudeica/reforma-teritoriala/blob/55cccd747fa5e3f5d244b4a1044f1addd1535115/atlas-geometry-resources.mjs).

## Reproducible measurement protocol (not yet executed)

Target is exact deployment of 55cccd747fa5e3f5d244b4a1044f1addd1535115; identify browser build/OS/CPU/RAM, viewport/device emulation and cold/warm cache; execute at least 5 independent repetitions per scenario and retain raw trace plus median and p95 (without setting arbitrary acceptance limits). Capture Navigation/Resource timings, `performance.measure`, Long Tasks where available, Network/HAR, frame durations, DOM-mounted row count, Leaflet layer count, heap samples after collection where supported, console errors and screenshots.

Scenarios: (1) initial full tree and expand/collapse all practical branches; (2) OSM filter levels 8, 9, 8+9, none and all, count matches+ancestors; (3) collective preview/cancel/confirm/Undo, with intervening manual toggles; (4) Back/Forward 20 actions; (5) panel open/close ×20; (6) zoom 6/7/10 and OSM basemap on/off, network cold/warm and duplicates; (7) desktop 1440×900, tablet 768×1024, phone 390×844 portrait and 844×390 landscape, plus 200% zoom. Include RO/MD/NI and reuse of 85 NI roles without geometry copies.

## Findings, prioritization and gate

- **Confirmed protective mechanisms, not regressions**: existing tree virtualization, frame-scheduled rendering, in-flight/shared geometry resource caching.
- **No reproducible performance regression is established** by available S/C/L evidence alone.
- **OPEN MEASUREMENT GATE**: without time-series/trace benchmarks for latency, memory and actual network activity, this document is a **partial baseline**, not a fully measured performance acceptance. Do not infer thresholds or approve WEB-R2c.3.1 optimizations.
- Next allowed action: run read-only instrumentation on the exact SHA in a Chromium/CDP-capable environment, append reproducible measurements and CI evidence, then re-evaluate. No second virtualization, source/data changes or performance patches justified at this stage.

## Invariants

ACTUAL snapshot `actual-a9e5a4ddcb5277ef`, semantic SHA-256 `a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446`, 3,246 RO + 2,602 MD = 5,848; `actual_mutation_allowed=false`, `p91_import_allowed=false`, `semantic_acceptance=BLOCKED_INCOMPLETE`. NI: 8 independent outlines, 85 reused OSM roles, zero new legal identities/duplicates. All preserved by report-only scope.

**Status:** `WEB-R2c.3.0 — AUDIT DOCUMENTED / MEASUREMENT INCOMPLETE`; `WEB-R2c.3.1 = NOT AUTHORIZED`.
