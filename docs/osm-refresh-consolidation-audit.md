# OSM refresh consolidation audit

Base: ae87ec62cfbf948eb236a6c37852a5578220c953. PRs #213 and #216 remain open; issue #204 remains open.

Transport now splits failed or incomplete explicit-relation chunks sequentially and uses authoritative relation/full at singleton leaves. Dependency closure is checked. Retry-After is honored up to a bounded 60-second wait; larger values fail closed. Selected source scope and authoritative continuity recovery are retained.

Malcoci activation checks a valid closed polygon before the reviewed invalid-live contract. Valid historical and repaired geometries use source geometry without loading fallback. Missing relations and changed invalid contracts fail closed. The old snapshot must also contain every current live boundary segment and any available shared connector segments.

## Blocking source evidence

Read-only OSM API evidence confirms relation 18968071 remains v8 / changeset 190022801 and matches the reviewed defect. Comparing its current open geometry to the cryptographically bound historical polygon rejects the fallback: 98 live segments are absent from the historical polygon. Therefore that stale fallback cannot be accepted as a faithful current boundary. PR #211 is evidence only; its membership completion was not integrated.

- malcoci-live.json: SHA-256 ff52d6d27bdfe59eb1642d44b30d8682201dac440fe22629f8019cb1aa9a65d5
- malcoci-connector.json: SHA-256 d30a49eaa20b1f5dc9ab912d74b0312220f64722011f9a65ea6c97f289ccbf8b

Targeted regression suite: 23 passed. Offline vendored dependency installation passed. Complete lifecycle suite encountered Windows-specific npm.cmd EINVAL and missing bash; protected Linux A/B reproducibility has not been proven. No source refresh, candidate generation, promotion, PR cleanup, or issue closure is authorized by passing these targeted checks alone. All remain pending the source-fidelity blocker and required gates.
