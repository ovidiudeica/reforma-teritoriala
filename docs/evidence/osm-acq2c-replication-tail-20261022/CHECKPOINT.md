# OSM-ACQ.2c — official replication tail, evidence only

The official full-history base `history-261019.osm.pbf` declares 2026-10-19T00:00:04Z, before the target 2026-10-20T20:23:47Z. Its declared length is 163,893,678,040 bytes. Only bounded header/transport fragments were captured: **the complete base original is absent and has no independently computed full-file SHA-256 here**. The observed 8 MiB sample took 2.062 seconds; a linear extrapolation is about 11.19 hours, not a guaranteed completion estimate.

The 46 original official hourly state files 123593–123638 bracket the interval from 2026-10-19T00:00:00Z to 2026-10-20T21:00:00Z. All 45 corresponding diff originals 123594–123638 were downloaded completely: 227,897,803 compressed bytes, with per-file SHA-256, complete GZIP/XML capture and independent byte-integrity verification. They remain local because raw contributor metadata is not published in this repository. Public receipts, state files and redacted derived objects are in manifest-sha256.json. This repository does **not** contain those raw diff originals.

The tail contains two requested way versions: way129567747 v8 and way911551627 v2, both timestamped 2026-10-20T20:06:23Z. They do not by themselves prove version continuity, complete dependency closure or any relation's spatial verdict. **242 relations remain UNKNOWN; zero new relation adjudications.** The previous 136 authenticated direct objects and 2,830 remaining direct dependencies are not changed by this preparatory tail evidence.

## Reproduction

Run `python scripts/audit/test_osm_acq2c_replication_chain.py` (17 offline tests). With the authentic local diff originals retained as SEQUENCE.osc.gz, run:

```text
python scripts/audit/osm_acq2c_replication_chain.py --evidence-directory docs/evidence/osm-acq2c-replication-tail-20261022 --original-directory PATH_TO_PRIVATE_ORIGINALS --output PATH_TO_NEW_REPLAY.json
```

The replay verifies hashes, lengths, original state sequence/timestamps, continuity and coverage; it parses all change versions without simplification, distinguishes deletions and strips contributor fields from derived output. It refuses to overwrite output. CI runs synthetic negative/parser tests and public manifest verification only. CI does not pretend to possess the private originals or the absent full-history base.

## Remaining gates

The base original must be acquired, independently authenticated and processed on a sufficiently provisioned host. Combine full-history base and tail without simplifying versions; resolve the four-second overlap by matching exact object versions and reject conflicts. Verify all requested identities, indirect dependencies, per-object temporal continuity, topology, exact spatial predicates and Overpass generated areas independently. Source qualification, source promotion, freshness and legal conclusions remain blocked.

Primary references: [official full history](https://planet.openstreetmap.org/pbf/full-history/), [official hourly replication](https://planet.openstreetmap.org/replication/hour/), [Osmium apply-changes](https://docs.osmcode.org/osmium/latest/osmium-apply-changes.html), [OSM replication documentation](https://wiki.openstreetmap.org/wiki/Planet.osm/diffs).

ACTUAL 3,246 RO + 2,602 MD = 5,848 / 32 protected components remains unchanged. MD legal parents, host-trust and the 14-day threshold remain unchanged. No public OSM edits, no source promotion, no P9.1, no closure of Issue #396. NI-JUR dependencies remain blocked.
