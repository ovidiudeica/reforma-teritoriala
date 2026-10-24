# OSM-ACQ.2c — indexed relation recovery, 24 October 2026

The authenticated historical base and its existing framing index yielded 4,525 additional relation identities (40,743 history versions) without downloading or hashing the 164 GB original again. The 45 authenticated replication originals were indexed once for all relation observations: 50,562 observations / 45,304 distinct identities. These observations retain changes after the target epoch; the existing replay core selects the target epoch and enforces continuity.

For the 6,108 candidate roots, relation-to-relation reachability now contains 11,301 known relations and no missing relation references. This projection also names 38,976 ways and 8,589 direct nodes; their presence in this projection is not evidence that all way/node dependencies exist. Way-to-node expansion remains necessary.

400 control relation histories (8,098 versions) are byte-identical to the prior full native extraction. Per-ID lookup still relies on the publisher's Sort.Type_then_ID declaration: global ordering has not been independently verified. Neither control agreement nor relation-only closure qualifies the source, certifies geometry, establishes generated Overpass-area equivalence, or adjudicates the 242 formal UNKNOWN relations. Human or signed provenance validation remains pending. The 107 previously observed gapped histories remain open.

The public evidence folder preserves summary reports, hash bindings, frozen producer sources, controls, and failed attempts separately. Large source originals and full local graphs are not uploaded by publishing their hashes. A full-tail scan exceeded its 600-second budget; the subsequent per-ID method succeeded. A sandboxed Pyosmium import failed; a separate read-authorized attempt succeeded without changing the runtime. Neither failure was silently treated as success.

The new pure relation projection has 14 local negative/determinism fixtures and is covered by the native offline workflow. It rejects conflicting observations, malformed identities, invisible referenced relations, and malformed members. Relation cycles and shared children are deduplicated. It cannot promote a source or infer administrative/legal parentage.

PR #424 was merged at main 33ec2ced6d6ebbd8a330f40b5da0f4c1b50cb934 after exact-head admission. Its 24 postmerge technical checks passed, including A/B and comparison. Published Chromium audit 40042947045 verified 435 resources / 125 GeoJSON; desktop and mobile captures were visually inspected. Artifact 12540231583 SHA-256 6784202fc539cfe6feab594ed9d542479361dd9561fd93a445c9fff4a5c90feb. RM-047 is closed with original/current test receipts separately replayed.

Freshness of the accepted 5 October source remains blocked under the unchanged 14-day threshold. Issue #396 stays OPEN. ACTUAL, MD legal parents, host-trust, published geometry, and P9.1 permissions are unchanged. This change is tooling/evidence-only, not OSM-FIX.2 acceptance or roadmap closure.
