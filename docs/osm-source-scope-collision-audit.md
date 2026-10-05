# Current OSM source scope collision audit

The first real OSM-only candidate after #217 (run 37386400812) refreshed both sources and built Malcoci successfully, then failed topology because Ungheni relation 18967922 was selected in both country inventories. No candidate was published.

Current authoritative OSM relation 18967922 version 5 has boundary=administrative, admin_level=9 and ref:cuatm:codunic=9201. The source refresh now resolves only overlapping country inventories using a unique authoritative registry namespace, verifies that evidence against the owner snapshot and retains Ungheni only in the MD inventory. Unknown, conflicting, retired or drifting evidence fails closed.

Raw OSM snapshots, relation membership and coordinates remain unchanged. The manifest persists the authoritative version, changeset, full response hash, namespace evidence and excluded inventory. The deterministic builder uses that persisted selection without network or containment routing. This assigns source scope only; SIRUTA and CUATM inputs remain unchanged.

Regression coverage includes exact routing, raw preservation, disjoint inventories, missing relation, transport failure, namespace conflicts, namespace drift and retired administrative scope. Malcoci proof remains 498 live segments + 2 connector segments, missing=0, extra=0 and historical drift coverage 98/98.
