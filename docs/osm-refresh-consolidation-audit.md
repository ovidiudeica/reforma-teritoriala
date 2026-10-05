# OSM refresh and reviewed Malcoci current-network derivation

Base main: ae87ec62cfbf948eb236a6c37852a5578220c953. Implementation consolidates #213/#216; #211 is evidence only.

Failed or incomplete explicit-relation chunks split sequentially; authoritative relation/full is used at singleton leaves. Dependency closure, bounded Retry-After and selected source membership fail closed. Continuity recovery requires authoritative verification. All network access remains in source refresh; deterministic build remains offline.

## Exact current OSM evidence

Relation 18968071 remains version 8, changeset 190022801, with odd endpoints 353223870 and 1379403420. Connector way 123810097 is version 5, changeset 190022801; its complete node chain is [353223870,14251506230,1379403420]. Administrative relations 1691800 v68, 1691801 v102 and 18822134 v7 use it as an outer administrative boundary.

The separately reviewed contract in scripts/lib/md-malcoci-reviewed-current-osm.json pins the relation metadata/tags/membership hash, every live outer way version and node/coordinate hash, connector metadata/node chain/coordinate hash, and all three evidence relations' metadata/tags/membership hashes. A reduced authoritative API fixture is committed for offline regressions. Source refresh fetches the three evidence relations authoritatively, so the selected source snapshot carries all required evidence.

## Derivation and proof

A separate copied list of OSM node chains is stitched into a polygon. No source relation or source membership is changed. No synthetic relation is attributed to OSM. Every coordinate is copied from a current OSM node; no snapping, clipping or simplification is applied. JTS validates the polygon.

Exact undirected segment sets: live outer boundary 498, connector 2, union 500, derived 500, missing 0, extra 0. All 98 live segments absent from the historic 2026-09-27 polygon survive: 98/98. The historical fallback guard remains; active historical substitution is prohibited. History is audit evidence only.

Valid historical and repaired source polygons are no-ops. The exact invalid live contract activates only the current-network derivation. Member/node/connector/evidence drift, changed invalid contracts and missing relations fail closed. Provenance explicitly names reviewed_current_osm_boundary_network, relation/connector/evidence IDs, the reviewed contract hash, coordinate_edit=false, source_relation_membership_edit=false and historical_geometry_fallback=false. Master and public geometries retain this provenance.

## Durable fidelity gate

The mandatory public builder audits exact OSM-to-master boundary segment equality after reconciliation and before writing public artifacts, within the network-denied deterministic phase. It rederives the only Malcoci exception from the pinned current source contract; generic or expired derivation markers, corrupted boundaries and altered provenance fail. Existing Brețcu–Ojdula/ANCPI exceptions are checked against their separately reviewed exact derivations rather than waived. The persisted base audit passes: RO 3234 geometries (3232 pure OSM plus 2 reviewed partition geometries); MD 2596 pure OSM geometries.

## Validation and admission

Targeted derivation, drift, activation, raw immutability, 98/98 coverage and generic-exemption rejection regressions pass. Required Linux CI, including ACTUAL CHANGE reproducibility A/B and compare, must pass on the final exact PR head before ready/merge or source refresh. No real refresh/candidate has been run while this implementation is under validation.
