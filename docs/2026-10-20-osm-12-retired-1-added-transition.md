# OSM ACTUAL source refresh — 12 explicit retirements / 1 addition, 20 October 2026

**Verdict: SOURCE_DRIFT_CONFIRMED, NOT ACCEPTED FOR ACTUAL.** This evidence is a factual, per-ID investigation, not a source-promotion authorization or a PASS for freshness.

## Independently reproduced evidence

- Baseline: `main@1a6107594438d752e793df5dd57aed96272d4474`; `data/sources/osm-current.json` pinned at `2026-10-05T23:50:05.218Z`.
- Real live source-only run: [GitHub Actions 39417657717](https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/39417657717), `2026-10-20T11:58:34.747Z`, artifact [12263486239](https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/39417657717/artifacts/12263486239), ZIP digest `sha256:4944bc96fcb4db9e1c58c1270a302f709d41b7b77e3500cce65129443d21d17e`. The artifact includes `outputs/osm-source-continuity.json` and the candidate `data/sources/osm-current.json`; both are provenance-bound to that failed source-only run.
- Baseline RO: **3233** selected relations; live RO: **3233**, missing 0 / added 0.
- Baseline MD: **2596** selected relations; live MD: **2585**, **12 removed and 1 added**, net -11. The same -11 explains the earlier deterministic master geometry gate failure [39113587430](https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/39113587430).
- For each missing relation the accepted snapshot had `boundary=administrative`, `admin_level=9` and `place=allotments`. In the live run, the importer queried OSM official `relation/<ID>/full.json` individually and recorded `continuity_retired_relation_ids` with **HTTP 410** for all 12. An independent official API read also confirmed status **410 Gone** for each relation's `relation/<ID>.json` URL.
- Consequently these are **genuine current-OSM deletions**, not 12 accidental Overpass omissions or transient resolver errors. An OSM 410 does **not** establish the legal extinction of any juridical entity, nor does it authorize deletion of any ACTUAL administrative identity.

## Per-relation retirement register

| OSM relation | Baseline OSM name | Prior tag `admin_level/place` | Current official API | Disposition |
| --- | --- | --- | --- | --- |
| [18966859](https://www.openstreetmap.org/relation/18966859) | Bogăția Lacului | 9 / allotments | **HTTP 410 Gone** | Needs source/semantic disposition; no historic polygon substituted |
| [18966939](https://www.openstreetmap.org/relation/18966939) | Grădina-Rai | 9 / allotments | **HTTP 410 Gone** | Needs source/semantic disposition; no historic polygon substituted |
| [18967312](https://www.openstreetmap.org/relation/18967312) | Mesteacănul Alb | 9 / allotments | **HTTP 410 Gone** | Needs source/semantic disposition; no historic polygon substituted |
| [18967475](https://www.openstreetmap.org/relation/18967475) | Struguraș | 9 / allotments | **HTTP 410 Gone** | Needs source/semantic disposition; no historic polygon substituted |
| [18967641](https://www.openstreetmap.org/relation/18967641) | Novinca-Eco | 9 / allotments | **HTTP 410 Gone** | Needs source/semantic disposition; no historic polygon substituted |
| [18967824](https://www.openstreetmap.org/relation/18967824) | Automobilist | 9 / allotments | **HTTP 410 Gone** | Needs source/semantic disposition; no historic polygon substituted |
| [18967907](https://www.openstreetmap.org/relation/18967907) | Boierul-Com | 9 / allotments | **HTTP 410 Gone** | Needs source/semantic disposition; no historic polygon substituted |
| [18967934](https://www.openstreetmap.org/relation/18967934) | Pomsuragro | 9 / allotments | **HTTP 410 Gone** | Needs source/semantic disposition; no historic polygon substituted |
| [18968041](https://www.openstreetmap.org/relation/18968041) | Aluniș-Com | 9 / allotments | **HTTP 410 Gone** | Needs source/semantic disposition; no historic polygon substituted |
| [18968051](https://www.openstreetmap.org/relation/18968051) | Romănița-Agro | 9 / allotments | **HTTP 410 Gone** | Needs source/semantic disposition; no historic polygon substituted |
| [18968093](https://www.openstreetmap.org/relation/18968093) | Relief-Prim | 9 / allotments | **HTTP 410 Gone** | Needs source/semantic disposition; no historic polygon substituted |
| [18968144](https://www.openstreetmap.org/relation/18968144) | Sveazist IL | 9 / allotments | **HTTP 410 Gone** | Needs source/semantic disposition; no historic polygon substituted |

## New OSM role, not automatically an alias

- [OSM relation 21515245](https://www.openstreetmap.org/relation/21515245) is **Î.P. „Boierul-COM”**, `boundary=administrative`, `admin_level=9`, `place=allotments`, version **1**, changeset **190081892**, timestamp `2026-10-06T10:23:05Z`, `ref:cuatm:codunic=552402`.
- It resembles the former name of removed relation `18967907` (**Boierul-Com**), but name similarity is not proof of matching identity, geometry, legal status or parent. Replacement/alias mapping remains **UNVERIFIED** pending exact spatial and official identity evidence.

## Integrity decision and remaining work

1. **No historic fallback / no invented polygon**: retired relations stay retired in current OSM. Do not re-add the 12 obsolete OSM relation geometries simply to recover count 2596.
2. ACTUAL remains immutable: **3,246 RO + 2,602 MD = 5,848**, including existing accepted geometry bindings. These counts are distinct from the older **3234 RO / 2596 MD** deterministic master geometry count in the OSM source candidate gate.
3. Preserve a **reviewable source-only candidate**, including SHA-pinned old/new raw OSM bytes, per-ID rows, legal registry checks, old vs new polygons, and possible replacement linkages; classify gardening/allotment boundaries separately from legally recognised UATs. A 410 proves deletion of a relation, not deletion of a CUATM identity.
4. If changing published ACTUAL identity/geometry contracts would be required, **STOP before promotion** and seek explicit separate authorisation. Retain `actual_mutation_allowed=false`, `p91_import_allowed=false`, `semantic_acceptance=BLOCKED_INCOMPLETE`.
5. Existing [freshness run 39405395203](https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/39405395203) remains **STALE/FAIL**; a newer *rejected* source-only observation cannot be silently promoted or used to backdate the official pinned source.
6. CI trust-gate issues on #397 are independent of these 12 deletions: `host_runner_identity_is_explicitly_approved_provenance` and pinned execution-environment verification reported failures, requiring authentic CI runner/provenance refresh, **not relaxing** trust policy.
7. **Issue #396 remains OPEN** until an approved refreshed snapshot is actually committed and the unmodified 14-day monitor reports an authentic PASS. PR #397 is a tooling and evidence PR, not a source release.

No source data, ACTUAL geometry, MD legal parentage, public website or P9.1 was modified in this evidence stage.
