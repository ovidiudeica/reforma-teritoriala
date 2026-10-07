# Frontend geometry taxonomy correction

Base: main `59065b3b3368fbca662639246a702075d1e4f0a9` (unchanged from supplied audit).
Main branch protection: enabled; required checks: verify-persisted-release, actual-change-reproducibility, actual-release-trust-chain, p2-statistical-foundation.

## Cause and contract
The public builder uses legal.type as display_type when available. That remains a legal/display identity, not a geometry role. The previous frontend classified geometry using display_type and separately injected selected statistical geometry without applying filters.

geometry-taxonomy.mjs is the shared pure classifier for the browser and executable regression tests. It uses representation.inferred_type and category, never legal.type/display_type. Unknown representation types remain explicit, visible unclassified rows. No P2 contract extension is needed.

## Audited baseline
| Geometry class | Count |
| --- | ---: |
| context | 2 |
| regional | 79 |
| local_uat | 4162 |
| sector | 11 |
| component_locality | 1454 |
| auxiliary | 122 |
| statistical_only | 18 |
| unclassified | 0 |
| Total | 5848 |

Statistical roles: 63; levels 1/2/3: 5/10/48. Of these, 45 use existing administrative geometry, and 18 use separate statistical geometry.

## Visibility rule
Administrative/other checkboxes control representation classes. Statistical level checkboxes control every entity with that statistical role, intersecting its administrative class when reused. The separate-boundaries checkbox additionally controls the 18 statistical-only boundaries. All loaded collections use the same visibility predicate; no extra geometry is created for coalesced roles.

Selection never changes a geometry filter. A hidden selection keeps details and tree selection, with an explicit notice. Re-enabling its filters restores its highlight. Late statistical fetches apply current visibility, not request-time visibility. Existing jurisdiction selection behavior remains.

## Validation
The PR runs the two requested existing tests and frontend-geometry-taxonomy.test.mjs, covering exact population counts, adversarial legal/display types, sectors, auxiliary/context, statistical levels, no reused duplicates, MD120/MD121 identity, bound component hashes, actual Leaflet rendering/selection through a VM harness, and late fetch visibility.

Local execution unavailable: Windows sandbox helper fails at process setup. CI is the executable verification authority for this change.

All data, master administrative geometries, statistical layers/geometries, source snapshots, registries, release metadata and release fingerprint remain untouched. Snapshot: actual-a9e5a4ddcb5277ef; fingerprint: a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446; contract: actual-public-entity-v3.

## Deferred to web-v1.2
Contextual RO/MD subtype expansion, broader Atlas design, and tree ancestor expansion/scrolling remain future UX work. This correction only marks the current tree selection and preserves the consolidated hierarchy.
