# MD CUATM code-absent allotment semantics

Status: reviewed diagnostic (2026-09-26)

## Scope

This note documents the semantic review of the 79 entities currently classified as `code_absent_from_official_snapshot`. It does not change legal reconciliation.

## Findings

All 79 entities share the same OSM profile: `admin_level=9`, `place=allotments`, and a parent already reconciled to the current official CUATM snapshot.

The current BNS CUATM snapshot contains none of their explicit OSM keys. This is therefore not evidence that 79 current CUATM localities are missing from the official snapshot.

External evidence supports interpreting this population as horticultural/allotment entities associated with a legal locality/UAT rather than current CUATM territorial units:

- Moldova's Public Services Agency describes an `întovărășire pomicolă` as an organization operating under a model statute and requiring a member list with allocated land plots.
- BNS census documentation distinguishes `întovărășire pomicolă` from urban/rural locality categories.
- A public geospatial inventory lists `Întovărășire pomicolă mun. Chișinău` as its own dataset/theme.
- Current registry-derived records identify Tulpina, Acvatic, Antropo-Service and Vadul-Humus as horticultural associations/cooperatives, not administrative-territorial units.

## Code-shape review

- 75/79: explicit key is the verified parent's current CUATM code plus two characters.
- 3/79: Acvatic `315809`, Antropo-Service `315801`, Vadul-Humus `315808`; their verified current parent is Vadul lui Vodă `0141`.
- 1/79: Tulpina uses `5511/03` under verified parent Băcioi `5511`.

The three `3158xx` keys are especially informative. Current registry-derived records for Antropo-Service report its administrative territorial unit as CUATM 0141, while official/local documentation shows cadastral numbers in Vadul lui Vodă beginning with `3158...`. Thus `3158xx` must not be interpreted as current CUATM identifiers merely because they are numeric and stored in an OSM CUATM-like tag. The available evidence is consistent with a legacy/local or cadastral-adjacent coding convention, but does not establish the exact historical code system.

Likewise, `5511/03` behaves as a sub-locality/allotment identifier under Băcioi rather than a current official CUATM code.

## Reconciliation policy implication

Recommended next implementation step: classify these 79 records as a distinct non-CUATM allotment-boundary population for legal-reconciliation purposes, while preserving their OSM geometry, names, raw identifiers and parent links. Do not silently delete or rewrite the raw OSM tags.

This conclusion applies to the reviewed 79-record population defined by the generated diagnostic. It should not be generalized to every OSM `admin_level=9` feature without the same predicates.

## Sources

- ASP, Întovărăşirea pomicolă: https://www.asp.gov.md/ro/servicii-info/persoane-juridice/cerinte-specifice/inregistrarea-intovarashire-pomicola
- BNS, RPL 2014 manual: https://old.statistica.md/public/files/Recensamint/Recensamint_pop_2014/Manual_RPL2014_rom.pdf
- INDS monitoring inventory: https://inds.gov.md/wp-content/uploads/sites/6/2024/10/Monitorizare_INDS_2024_s-I.signed.pdf
- Chișinău-gaz development plan 2026-2028: https://chisinaugaz.md/storage/files/shares/Investitii/PD%202026-2028%20pentru%20site.pdf
- Current CUATM source: https://statistica.gov.md/files/files/Clasificatoare/CUATM_25.xlsx
