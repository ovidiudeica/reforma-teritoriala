# WEB-R2c.3.0.1 — Chromium/CDP recovered measurements and gaps

Date 2026-10-19. Immutable target: `main@55cccd747fa5e3f5d244b4a1044f1addd1535115`. **Read-only evidence extraction**: source GitHub Actions job logs, no functional code modification, no deployment.

## Source of directly measured data

Post-merge job `frontend-browser-qa`:
https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/39278712261/job/118148957311

Actual logged browser: **Chrome/155.0.8059.39**. Test `scripts/audit/p64-final-performance-accessibility.mjs` emitted `P6.4 acceptance evidence` with NavigationTiming, paint, resource and DOM values. Single CI run, no p95 or repeated independent runs. Some subsequent viewport rows re-use navigation timings from the same navigation and **must not be interpreted as independent load measurements**.

| Scenario | Navigation ms | DOMContentLoaded ms | FCP ms | Resource count | DOM elements | Geometry SVG paths |
|---|---:|---:|---:|---:|---:|---:|
| Desktop cold 1440×900 | 328 | 258 | 128 | 103 | 880 | 2 |
| Desktop warm 1440×900 | 155 | 129 | 64 | 109 | 880 | 2 |
| Responsive 1024×768 | same navigation as warm | same | same | 115 | 844 | 2 |
| 900×768 | same | same | same | 119 | 841 | 2 |
| 899×768 | same | same | same | 125 | 822 | 2 |
| 768×1024 tablet | same | same | same | 139 | 830 | 2 |
| 844×390 landscape | same | same | same | 141 | 814 | 2 |
| 390×844 portrait | same | same | same | 143 | 816 | 2 |
| 360×640 portrait | same | same | same | 145 | 816 | 2 |

The CI reported `transferBytes=30888557` for these profiles. **Interpret carefully**: this is derived from browser resource timing transfer accounting; it must not be equated with a validated HAR network byte total. Resource counts rise across viewport changes in the *same session*; not independent cold loads.

The existing `scripts/audit/p73-virtual-tree-browser.mjs` ran successfully on the same SHA. Its existing assertions verify bounded virtual tree DOM across scroll fractions, but are not action-latency benchmarks. Historical Node test timing from this CI includes virtual traversal assertion (11.19135 ms) and entire browser acceptance suite (14,397.529438 ms); the latter **is test wall time, not tree-interaction latency**. Source job log above.

## Measurement coverage

| User-requested target | Captured directly in post-merge CI? | Evidence / gap |
|---|---|---|
| Initial page desktop | **YES**, single instrumented cold/warm sample | Navigation, DCL, FCP, resources, DOM; values above |
| Tree virtual DOM and scroll | **PARTIAL** | Existing bounded-DOM Chromium assertions pass; no per-scroll frame time or p50/p95 |
| OSM level 8/9 filter latency and counts | **NO** | No observed action-to-paint timings or allocation traces |
| Geometry fetch/render | **PARTIAL** | Two SVG paths in initial viewport; no parse/render timings, zoom 7/10 loading trace, HAR duplicates |
| Panels open/close | **NO** | No interaction latency samples |
| Bulk preview, confirm, Undo | **NO** | Functional regression suites are not performance distributions |
| URL/History Back/Forward | **NO** | Functional QA only, no timing trace |
| Heap/memory/leaks | **NO** | No V8 heap measurement |
| Network duplicates | **NO** | Resource count is not a duplicate-request classification |
| Tablet/phone portrait/landscape | **PARTIAL** | DOM and resource counts observed at listed sizes; no independent mobile navigations, CPU throttling, heap, interactions or frame traces |
| 200% zoom | **NO quantified CDP profile** | Covered only by other functional/visual verification, not performance |

## Execution restrictions and interpretation

A Chromium binary exists in the analysis environment, but that environment cannot resolve `github.com` to retrieve the full corpus/site. The connected Desktop Commander runner reported its monthly usage quota exhausted and cannot be used; the connected browser offers only page-text access, not CDP performance tracing. Do not substitute fictitious samples. No paid browser service or TinyFish used.

### Next reproducible benchmark matrix (read-only)

Using `scripts/test/helpers/atlas-browser.mjs` and instrumented CDP in the existing GitHub Actions environment: run ≥5 **independent** loads per viewport; record Chrome build, CPU/environment and cache state; measure cold/warm navigation, FCP, transfer/encoded bytes, requests with initiator URLs, V8 heap, mounted nodes and layers, event-to-next-paint duration and long tasks. Repeat level 8/9 OSM filter toggles; tree expansion/scroll; zoom 6→7→10; panel ×20; preview/cancel/confirm/Undo; History Back/Forward ×20; desktop, tablet, phone portrait/landscape and 200% zoom. Preserve pre/post app state and ACTUAL checks. Upload raw JSON, traces and screenshots, and calculate p50/p95 only after distinct samples. No invented acceptance thresholds.

## Verdict

**PARTIAL MEASURED BASELINE / OPEN CDP COVERAGE GATE.** Real initial-load and responsive DOM figures extracted. Interactive latency, heap and network-duplicate investigation incomplete; no regression proven and no performance optimization authorized. PR #389 must remain Draft. Maintain ACTUAL, P9.1, NI, independent geometry selection, URL/History and Undo unchanged.
