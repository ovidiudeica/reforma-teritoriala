# OSM-ACQ.2c — bounded historical dependency pilot

Evidence-only scope. This branch is stacked on OSM-ACQ.2b and contains only a read-only acquisition/verification pilot; it does **not** resolve 242 UNKNOWN IDs or certify Overpass generated-area equivalence.

The plan is derived from the committed OSM-ACQ.2a registry gzip, pinned by SHA-256 `6ef70dbd2651b73d467e6a6b25650806e7eb7197bfff83f639c2649c29d003e7`. Priority relation IDs: `72526`, `72634`, `11821462`, `11905201`. The first two share RO/MD missing dependencies, so the plan deduplicates OSM IDs and captures **at most 2 objects per priority, 8 objects total**. This is a representative pilot, not full dependency closure.

For each object, fetches the current OSM API XML plus full history read-only, validates complete version sequence, timestamp ordering, object identity, exact member ordering, current-vs-history consistency, and the version effective on 2026-10-20T20:23:47Z. Captures raw XML bytes with SHA-256 and HTTP Date receipts into a time-limited GitHub CI artifact, not into protected source. A failed/missing network response remains `RETRIEVAL_INCOMPLETE`; an invalid history remains `HISTORY_REJECTED`. All object proofs and counters are explicit. Ten negative/positive synthetic validation tests are required.

Run:
```sh
python scripts/audit/test_osm_acq2c_priority.py
python scripts/audit/osm_acq2c_priority.py --plan-only
python scripts/audit/osm_acq2c_priority.py --output <new-empty-directory>
```

No changes to ACTUAL (3,246 RO + 2,602 MD = 5,848, 32 protected components), legal MD parents, public geometry, 14-day freshness limit, host trust or P9.1. No OSM public changes, and no promotion of source. OSM-FIX.2 #398 remains Draft, issue #396 OPEN, NI-JUR #394/#402 gated.

**Acceptance**: CI success of this pilot means only the bounded tests and requests completed; never upgrade OSM-ACQ.2c or 2d to CLOSED_PASS from this report alone. Inspect artifacts, preserve originals and complete remaining 242 independent dependency closures before source qualification.