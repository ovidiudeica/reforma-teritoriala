# ACTUAL candidate release flow

The persisted ACTUAL RO+MD release on `main` is immutable between explicit promotions.

## Build a candidate

Run **Build ACTUAL candidate snapshot** manually. At trigger time the workflow binds an exact 40-hex base commit SHA (the dispatch `github.sha` unless an explicit exact SHA is supplied), validates that value before checkout, and checks out that commit directly. Reusable SIRUTA/CUATM/OSM refresh wrappers pass their trigger-time `github.sha` explicitly. The workflow validates the persisted release read-only at that immutable commit, rebuilds ACTUAL from its committed source snapshots by default, runs all jurisdiction and global release gates, and writes a substantive result to a new isolated branch. Network source refreshes are explicit inputs rather than implicit build prerequisites.

Each candidate contains:

- `data/current/actual-release-candidate.json` — binds the candidate to the exact persisted base release and exact candidate manifest.
- `data/current/actual-candidate-diff.json` — exhaustive comparison against the persisted release.
- the candidate release manifest, release gate, catalog, master geometries, public contract, official-source snapshots and generated audits.

The diff reports entity additions/removals, legal-identity changes, classification changes, master-geometry changes, semantic official-registry changes and component hash drift. Differences are never auto-accepted.

## Promote a candidate

Run **Promote ACTUAL candidate** with:

1. the exact candidate branch;
2. the exact candidate snapshot id;
3. confirmation text `PROMOTE <snapshot_id>`.

Promotion fetches `main` once, resolves it to an exact commit SHA, and fails closed unless that SHA is byte-for-byte equal to the candidate marker's immutable base SHA. All promotion reads then use that exact SHA rather than the symbolic `origin/main` ref. Promotion also fails if any candidate manifest/diff bytes drifted or if the candidate release gate is not PASS.

A successful promotion run does **not** push the candidate directly to `main`. It writes the new persisted-release marker on the candidate branch and opens a promotion PR. The required `verify-persisted-release` branch-protection check must pass before that PR can merge.

## Direct refreshes

Direct source refreshes cannot replace the persisted release. The OSM, SIRUTA and CUATM refresh workflows are source triggers only and all route through the same candidate lifecycle:

`source refresh -> candidate build -> review diff -> explicit promotion -> protected PR -> main`.


## Stable release identity and NO_CHANGE

Release identity is based on canonical administrative content, not regeneration timestamps or informational OSM metadata. Exact SHA256 hashes of every manifest component remain mandatory integrity checks, but they do not by themselves create a new release identity.

The canonical content fingerprint covers the administrative catalog, master geometry, official SIRUTA/CUATM records, reviewed identity decisions, the administrative inventory and settlement policy. Volatile timestamps and informational Wikipedia/Wikidata links are excluded from release identity.

When a regenerated candidate has the same canonical content as the persisted release:

- the candidate reuses the persisted snapshot ID and release fingerprint;
- its disposition is `NO_CHANGE`;
- exact byte drift remains visible in the diff report;
- no candidate branch is created;
- promotion is rejected.

Only a `CHANGE` candidate receives a new semantic release identity and may proceed to explicit promotion.

### Deterministic candidate metadata

Committed candidate bytes are execution-independent. `actual-candidate-diff.json` and `actual-release-candidate.json` contain no wall-clock generation time, GitHub run id, run attempt or triggering SHA. Their candidate identity is derived only from the immutable base release, exact candidate release provenance and exact diff bytes.

Volatile workflow evidence is written separately to `actual-candidate-execution-receipt.json` under `runner.temp` and uploaded only as a review artifact; it is never staged into a candidate or persisted release tree. Candidate and promotion Git commits use the deterministic release-manifest `generated_at` value as both author and committer date. Therefore two independent `CHANGE` builds from the same parent and exact inputs must produce the same candidate tree and the same Git commit object SHA.


## Romania SIRUTA source refresh

The scheduled/manual `Refresh official Romania SIRUTA snapshot` workflow is a source trigger only. It calls the ACTUAL candidate workflow with `refresh_ro_siruta=true`; it does not reconcile, build, commit or push a release directly.

The candidate order is intentional:

`optional SIRUTA refresh -> deterministic OSM build from the committed raw snapshot -> RO reconciliation -> county bridge/application -> release gates -> semantic diff`. The SIRUTA wrapper sets `refresh_osm=false`, so an official-registry refresh does not depend on Overpass.

This ordering prevents a stage-mismatch regression observed in Actions run `36356055091`. The persisted catalog already represents OSM relation `377733` (București) after the RO county bridge as legal SIRUTA county/code `40` and catalog type `county`. The reviewed SIRUTA UAT `179132` resolution correctly describes the earlier raw OSM reconciliation stage, where relation `377733` is `capital_municipality` at admin_level 4. Running the raw reconciliation audit against the already post-bridge persisted catalog therefore produced a false structural failure. The reviewed resolution is not changed; the workflow stage is corrected.

If the official SIRUTA fetch is unavailable and the importer preserves the last valid official CSV snapshot, candidate generation continues against that exact preserved source. If a refreshed SIRUTA snapshot is semantically unchanged, the lifecycle terminates as `NO_CHANGE`. A real official-registry change becomes a `CHANGE` candidate and can reach `main` only through explicit promotion and the protected PR path.


## Workflow write boundary

The ACTUAL topology audit is verification-only. It has `contents: read`, validates the exact persisted release in read-only gate mode, audits the committed master topology, uploads the generated audit report, restores that report and fails if any tracked repository file changed.

Only two workflows may contain a direct `git push`:

- `actual-candidate.yml` — pushes a validated `CHANGE` candidate to its isolated candidate branch.
- `actual-promote-candidate.yml` — updates that isolated candidate branch with the explicit promotion marker before opening the protected PR.

No topology, source-refresh or auxiliary audit workflow may commit or push release data.


## Moldova CUATM source refresh

The official Moldova CUATM source refresh is separated from reconciliation.

`scripts/import/import-md-cuatm.mjs` is the only networked CUATM source step. It downloads the official BNS workbook with a bounded request timeout and retry count, validates the required workbook schema and record population, and materializes `data/sources/cuatm-current.json`. If the official workbook is unavailable but the committed snapshot is still structurally valid, the importer preserves that exact last valid snapshot. If the downloaded records are semantically unchanged, it does not rewrite the snapshot.

`scripts/process/reconcile-cuatm.mjs` is deterministic and network-free. It validates and reads only the materialized CUATM snapshot before applying the existing reviewed reconciliation rules.

The scheduled/manual `Refresh official Moldova CUATM snapshot` workflow is a source trigger only. It calls the reusable ACTUAL candidate workflow with `refresh_md_cuatm=true`; it cannot reconcile, build, commit or publish a release directly.

The candidate ordering is:

`optional official-source refreshes -> deterministic OSM build from the committed raw snapshot -> RO reconciliation -> MD CUATM reconciliation -> jurisdiction gates -> ACTUAL semantic diff`. The CUATM wrapper sets `refresh_osm=false`.

An unchanged CUATM registry terminates as `NO_CHANGE`. A real official-registry change becomes a `CHANGE` candidate and can reach `main` only through explicit promotion and the protected PR path.


## OpenStreetMap source refresh

OSM network access is separated from ACTUAL construction, and normal candidate builds are network-free with respect to OSM.

`scripts/import/import-osm.mjs` is the only networked OSM source step. It queries bounded/fail-closed Overpass endpoints, validates the returned element population and required country/administrative relations, canonicalizes the raw element set and computes a semantic SHA256 per jurisdiction. Raw bytes are stored durably under `data/sources/osm-snapshots/` using a content-addressed filename derived from that semantic SHA256. The manifest also records the SHA256 of the exact gzip blob. If a refresh returns the same canonical OSM content, the already committed gzip bytes are preserved exactly instead of being regenerated.

`data/sources/osm-current.json` is schema v2 and points to the exact content-addressed RO and MD snapshots. Both the compressed blob hash and the decompressed semantic hash are verified before build.

`scripts/process/build-osm-actual.mjs` is deterministic and network-free. It reads only the committed content-addressed snapshots, validates both hash layers, converts them to GeoJSON, assigns geometric parents, applies the reviewed OSM semantic classification rules and produces the raw ACTUAL catalog/master geometry. It contains no `fetch`, Overpass endpoint or runtime-clock dependency.

The reusable candidate workflow has an explicit `refresh_osm` boolean input with default `false`. Therefore a normal manual candidate, a SIRUTA refresh and a CUATM refresh all rebuild ACTUAL from the exact committed OSM bytes without contacting Overpass.

The manual `Refresh OSM administrative source snapshot` wrapper is the only workflow that sets `refresh_osm=true`. It routes the network refresh through the same candidate lifecycle; it cannot publish a persisted release directly.

The candidate ordering is:

`optional SIRUTA/CUATM refreshes -> optional OSM network refresh -> deterministic OSM build from durable snapshot -> RO/MD reconciliation -> jurisdiction gates -> ACTUAL semantic diff`.

If an OSM refresh is semantically unchanged, the manifest and gzip bytes remain stable and the candidate should terminate as `NO_CHANGE`. A substantive downstream change becomes a normal `CHANGE` candidate and can reach `main` only through explicit promotion and the protected PR path.


## Byte-for-byte reproducibility

Release-component bytes are stabilized before candidate manifest construction.

The OSM source manifest carries a stable `snapshot_at` clock bound to the content-addressed semantic snapshot. An unchanged Overpass refresh preserves that timestamp; a genuinely new OSM semantic snapshot receives a new source timestamp. Deterministic OSM construction uses `snapshot_at`, never the latest network fetch time, for catalog provenance.

After all reconciliation, gates, public-contract generation and release audits complete, `stabilize:actual-bytes` compares every release-manifest component with the exact persisted base bytes from `ACTUAL_BASE_REF`.

- If the JSON content is identical except for controlled artifact-runtime metadata (`generated_at`, `source_generated_at`, `applied_at`, `imported_at`) or object-key order, the exact persisted bytes are restored.
- Any non-volatile content difference is preserved and serialized deterministically with a timestamp derived only from the materialized source snapshots.
- Stabilization is required to be idempotent for every component.
- When every component matches the persisted base after stabilization and semantic content is unchanged, the exact base release-manifest bytes are reused as well.

The byte-reproducibility audit is written to `data/current/actual-byte-reproducibility-audit.json` and included in the candidate review artifact. For a true no-change offline rebuild, the required target is `component_hash_changed_count = 0`.
