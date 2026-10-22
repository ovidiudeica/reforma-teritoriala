# OSM-ACQ.2b — independent exact-boundary validation checkpoint

## Scope and history

This supplemental evidence-only suite extends the previously published, immutable 131-file OSM-ACQ.2b dossier. The initial evidence branch head was a392da5bd95b8e0c0acbfaf5bcb74a659dfd40e2. A prior PR #406 retains separate OSM-ACQ.2a evidence; this OSM-ACQ.2b branch is descended from that head and should be reviewed initially against PR #406's branch.

The exact-grid implementation had 15 recorded local test cases. An additional independently reproduced differential check executed locally on 2026-10-22 with 48,000 deterministic segments against the Shapely DE-9IM proper-interior oracle across convex, concave, holed and disconnected polygons: 0 mismatches. **This local mirror exercise is not the same as running the committed implementation.** The new CI suite imports the actual frozen implementation from this branch, and its result must be established separately on the exact CI head.

## Execution commands

- python docs/evidence/osm-acq2b-independent-20261022/test_exact_geometry_independent.py
- python docs/evidence/osm-acq2b-independent-20261022/verify_evidence.py --self-test
- python docs/evidence/osm-acq2b-independent-20261022/verify_evidence.py

The integrity script hashes the complete committed files enumerated by the four cumulative manifests and validates compressed + decompressed SHA-256 lineages and negative cases. It never edits inputs or reconstructs missing PBF originals. Full replay from raw local PBF, Overpass generated-area equivalence and source freshness are separate gates.

## Frozen current checkpoint

- 391 initially distinct IDs in 393 RO/MD positions.
- 15 OSM-ACQ.2a frozen exclusions; 116 OSM-ACQ.2b exact-boundary exclusions; 14 node-history closures; 4 way-history closures.
- 149 OUT_OF_SCOPE_PROVEN only for frozen direct-member PBF spatial predicate; 242 UNKNOWN remaining, in 244 RO/MD positions.
- Priority UNKNOWN IDs: 72526, 72634, 11821462, 11905201.
- Historical PBF epoch: 2026-10-20T20:23:47Z.
- No certified Geofabrik/Overpass spatial equivalence; no OSM-source promotion; Issue #396 remains OPEN.
- PR #398, #394, #402 retain dependency-gated Draft status.
- ACTUAL 3,246 RO + 2,602 MD = 5,848 identities, 32 protected components: not changed.
- Neither the 14-day freshness threshold nor host trust nor legal MD parents nor public geometries were changed. P9.1 remains blocked.

**Review discipline:** Only the exact CI head that actually ran required checks can be marked accepted. A Draft review of these artifacts does not equal CLOSED_PASS for OSM-ACQ.2c/.2d, OSM-FIX.2, NI-JUR.0–4 or ROADMAP-CLOSURE.
