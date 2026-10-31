# Seven additional MD cartographic causes

Original OSM API node/way histories are retained byte for byte with SHA-256 and acquisition provenance in `retrieval.json`. Previously accepted histories are explicitly reused. `fixed-snapshot-facts.json` preserves only the seven targeted relation/way/node subsets and pins the original compressed snapshots; no OSMB feature inventory is repeated.

The verifier matches each changed source coordinate to an original node history. Every affected old edge must have node and way versions whose validity intervals overlap. Every inserted edge must exist in the accepted snapshot's exact way network. Only these attested moves, removals and insertions are applied in memory; all other source coordinates are preserved. The resulting valid geometry must equal ACTUAL exactly. No snap, tolerance, geometry repair or ACTUAL write is used.

The MD administrative snapshot and MD statistical snapshot have distinct epochs. Later live versions are never substituted for their coordinates. Compatible historical edge intervals do not certify the exact OSMB export time or a legal boundary. All legal and administrative verdicts remain separate; all 298 global-resolution flags remain false and P9.1 remains unauthorized.

Offline verification: `python scripts/audit/auto3-osmb-md-remaining-histories.py`. Explicit `--apply-evidence` updates only derived audit files. The original API responses preserve OpenStreetMap attribution and ODbL references.
