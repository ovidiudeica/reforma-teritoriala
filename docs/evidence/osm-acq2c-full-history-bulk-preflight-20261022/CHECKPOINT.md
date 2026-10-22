# OSM-ACQ.2c — offline full-history bulk preflight

State: PREPARED_ONLY — NOT_CLOSED_PASS. Reference PBF epoch: 2026-10-20T20:23:47Z. Independently proven direct objects: 8 (#408) + 64 (#409) + 64 (#411) = 136. Frozen registry: 391 initial distinct IDs, 149 OUT_OF_SCOPE_PROVEN for the frozen PBF spatial predicate alone, and 242 UNKNOWN (244 RO/MD domain rows). There are 2,966 distinct missing direct way/node objects; 2,830 are not yet authenticated. Subsequent way-to-node closure may add dependencies.

## Authoritative bulk sources

Official OpenStreetMap full-history PBF: https://planet.openstreetmap.org/pbf/full-history/ . A selected full-history snapshot must cover the exact target epoch, not precede it. The October 2026 planet history archive is approximately 150+ GB compressed; SHA-256 of the entire original, independently authenticated publisher checksum, length, URL, date, and original provenance receipts must be retained.

Geofabrik public osm.pbf is current-only, not full history. Its historical regional osh.pbf downloads are marked internal and subject to proper authorized access because of contributor metadata. See https://download.geofabrik.de/technical.html and https://download.geofabrik.de/europe.html . Do not bypass access restrictions. The core OSM editing API is not for the remaining thousands of bulk reads: https://operations.osmfoundation.org/policies/api/ .

Osmium documentation: https://docs.osmcode.org/osmium/latest/osmium-getid.html and https://docs.osmcode.org/osmium/latest/osmium-time-filter.html . Extract all historical versions and referenced objects, then filter to 2026-10-20T20:23:47Z; never treat simple time-filter output as sufficient provenance.

## Executable offline preparation

On an authorized, sufficiently provisioned machine, install osmium-tool and provide two local files:
- work/osm-acq2c-bulk/original.osh.pbf — full original, unmodified, covering the exact epoch.
- work/osm-acq2c-bulk/provenance.json — publication_url, source_sha256, source_bytes, history_through, independent_publication_receipt_sha256. Metadata alone is not independently trusted.

Run python scripts/audit/test_osm_acq2c_bulk_preflight.py and python scripts/audit/osm_acq2c_bulk_preflight.py . The plan enumerates 3,208 unique OSM identities: 242 relation IDs plus 2,966 missing way/node IDs, including previously captured objects for source consistency. It does not perform network requests, import any original source, or certify spatial predicates.

Only when the original and receipts are actually present, run python scripts/audit/osm_acq2c_bulk_preflight.py --process-authenticated-full-history . The tool checks local byte length and SHA-256, checks declared epoch coverage, generates the requested-ID list, invokes osmium getid with --with-history and --add-referenced, then osmium time-filter for the exact epoch. The derived output stays in ignored outputs/, with SHA-256. It does not promote or mutate ACTUAL.

## Non-negotiable subsequent gates

The resulting preflight does NOT verify the publisher receipt independently; a self-declared checksum alone is not source provenance. It does NOT verify every requested object exists (osmium getid history mode can return success despite missing IDs), continuity of all individual versions, full membership closure, topology/ring/hole reconstruction, the exact geometric spatial predicate, or Overpass generated-area equivalence. Those need independent per-ID verification and exhaustive byte-pinned replay with negative tests. Missing evidence preserves UNKNOWN. Neither PREPARED nor LOCAL_EXTRACTION_FINISHED_BUT_UNQUALIFIED is a PASS for OSM-ACQ.2c, OSM-ACQ.2d, OSM-FIX.2 or NI-JUR.

Protected: ACTUAL 3,246 RO + 2,602 MD = 5,848 / 32 components; legal MD parents, public geometry, host trust and 14-day freshness unchanged. No live OSM edit. P9.1 blocked. Issue #396 open.
