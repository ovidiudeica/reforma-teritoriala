# Observation-only extension of the historical gap cohort

The original 102-object cohort and its 250 absent observed versions are unchanged. Five additional round-two histories contain 12 more absent observed versions: n249478464, n281664933, n313853846, n476084381 and w28535366. The combined observation ledger therefore contains 107 distinct typed identities and 262 absent versions. This counts gaps in the authenticated observed histories; it does not infer their cause or legal status.

Two small official API batches returned all five current objects. Exact normalized payloads match the replay targets. A single request for node 249478464/version 2 returned HTTP 403 with an empty body. Further missing-version probes were not attempted after that response. The reason for HTTP 403 is not inferred; no authentication, redaction bypass, retry or history-gap closure occurred.

The incremental packet references the old manifest and contains only the five new sparse projections, receipts, hashes and frozen generators. Raw contributor metadata stays in private originals. The sparse capsule is replayed using the existing gap inspector; the separate cohort merger has 9 negative/determinism fixtures and does not grant source or target-state acceptance. Old 102-object evidence is neither duplicated nor rewritten.

All 107 histories remain BLOCKED_VERSION_GAPS. Current-state agreement is not historical continuity, jurisdictional proof or source promotion. The 14-day freshness threshold, ACTUAL 5848/32, protected MD parents, public OSM and P9.1 permissions remain unchanged.
