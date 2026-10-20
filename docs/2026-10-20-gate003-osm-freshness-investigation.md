# 2026-10-20 — GATE-003 closure and OSM source-freshness incident (read-only)

## Scope and evidence integrity

This is a documentation-only audit against `main@1a6107594438d752e793df5dd57aed96272d4474`. It does **not** rerun or alter historical test verdicts, change any freshness policy or timestamp, ingest OSM, touch ACTUAL / geometry / MD legal parentage, or authorize P9.1. The scheduled freshness failure remains a real, unresolved operational finding.

### GATE-003 — WEB-R2c.4

`PR #393` is merged at the above `main` SHA. The post-merge runs comprised **14/14 successful workflows** and **21/21 successful check runs** at closure. The independent published-site audit [run 39398274459](https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/39398274459) completed successfully against this exact published SHA, with **435 tracked self-hosted runtime resources (including 125 GeoJSON) verified against checkout**, a four-profile Chromium matrix with native 200% zoom scenarios, and preserved screenshots and diagnostics. [Pages deployment 39397897942](https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/39397897942) succeeded. Artifact [12254000496](https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/39398274459/artifacts/12254000496) bears GitHub-reported digest `sha256:d767cf8eabe093b12b5016be664354122b27997e6ad3af737828bae6c550837e`.

**Decision: `GATE-003=CLOSED_PASS`**, limited to its accepted published website acceptance scope. The subsequent scheduled source-freshness failure is a distinct operational alert; it does not retroactively turn the earlier E2E runtime proof into a failure.

### OSM freshness — verified failure, not closed

Scheduled [run 39405395203](https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/39405395203), event `schedule`, inspected source commit `1a6107594438d752e793df5dd57aed96272d4474` at `2026-10-20T10:05:28.895Z`. `scripts/process/audit-actual-source-freshness.mjs` read the committed manifest `data/sources/osm-current.json`; the status is genuinely **`STALE`**.

| Source | Committed timestamp | Evaluated age (days) | Policy max (days) | Result |
| --- | --- | ---: | ---: | --- |
| OSM | 2026-10-05T23:50:05.218Z | 14.427 | 14 | **STALE** |
| SIRUTA | 2026-09-26T11:58:48.000Z | 23.921 | 45 | PASS |
| CUATM | 2026-09-27T20:37:24.316Z | 22.561 | 45 | PASS |

The audit deliberately returned exit 1 and uploaded its real report as [artifact 12257215234](https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/39405395203/artifacts/12257215234). No threshold, hash, source manifest, or report status was modified.

### Why the weekly OSM source did not advance

The weekly `.github/workflows/import-osm.yml` invokes the isolated ACTUAL candidate lifecycle with `refresh_osm=true`. It does **not** automatically publish a successful candidate into the protected ACTUAL release.

- **2026-10-11**, [scheduled run 38133862606](https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/38133862606), failure in network-enabled source refresh. Overpass endpoints produced HTTP 500/504 and timeouts; the explicit-relation fallback rejected missing dependency `node/140097206` for RO. The importer failed closed.
- **2026-10-18**, [scheduled run 39113587430](https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/39113587430), network-enabled OSM source refresh **passed**, and the candidate proceeded to the deterministic network-denied phase. The `audit:actual-regression` gate **failed closed** with `entity_count_drift`, `master_feature_count_drift` and `total_entity_count_drift`: **MD 2585 actual vs 2596 expected**, intermediate geometric master total **5819 vs 5830 expected** (RO 3234). These are intermediate master/source counts from that candidate, **not** the 5848 published ACTUAL identity count. The job did not publish the candidate.
- The accepted `main` manifest therefore retains the **2026-10-05** OSM snapshot despite later source attempts. This is a provenance/refresh failure and a current policy breach, **not** proof that every published OSM boundary is geometrically incorrect.

The pinned P9 Geofabrik source used to audit the 85 Nistrenia roles is a **different source and acceptance contract**; it cannot be used to silently overwrite `data/sources/osm-current.json` or fabricate a newer `snapshot_at`.

### Required next operations (not executed here)

1. Investigate exactly which **11 MD intermediate geometric identities** drop out of the 18 October refreshed candidate, using the candidate inputs/diagnostics and deterministic ID-level diff. Determine whether an Overpass relation was absent, changed, or dropped in interpretation. Do not infer identities from aggregate counts.
2. Reproduce and address source-fetch issues through existing authoritative relation/way/node recovery and the fail-closed candidate lifecycle. If external OSM changes require adjudication, keep that change in a **separate, reviewed source-refresh candidate**, preserve old/new raw evidence and hashes, and verify per-ID topology and administrative bindings.
3. Re-run refresh and complete every source, topology, provenance, ACTUAL and trust-chain gate; require deliberate publication authorization for any candidate that would change protected data. Keep the rejected candidate and the scheduled `STALE` result as historical evidence.
4. Verify the monitor only **after a genuinely new approved OSM source snapshot is persisted**. Do not alter the 14-day limit, hide the failure, disable the workflow, backdate metadata, or substitute the P9 snapshot.

**Disposition:** `GATE-003=CLOSED_PASS`; `OSM_SOURCE_FRESHNESS=STALE_OPEN`; `ACTUAL_UNCHANGED`; `P9.1_BLOCKED`. The open NI-JUR.0–NI-JUR.4 evidence gate remains open.
