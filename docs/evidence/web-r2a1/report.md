# WEB-R2a.1 — recensământ exhaustiv admin_level OSM

- Base SHA: `073a1ee2a2098392df5891fb6b15e69b0eef2d9c`
- ACTUAL snapshot: `actual-a9e5a4ddcb5277ef`
- Semantic fingerprint: `a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446`
- Verdict: **PASS_WITH_EXCEPTIONS**; exhaustiv: **true**
- ACTUAL: **5848** (RO 3246; MD 2602)
- Roluri OSM reutilizate: **85**; contururi NI source-only: **8**
- Excepții: **28** (fatal 0, error 0, warning 8, info 20)

## Metodologie

Validatorul citește numai octeții din checkout-ul Git, verifică bindingurile SHA-256 ale ACTUAL și NI, cardinalitățile, unicitatea și referințele dintre contracte. Unitățile de numărare sunt separate: ACTUAL RO, ACTUAL MD, cele 8 contururi NI source-only și cele 85 roluri OSM reutilizate. Valorile admin_level nu sunt deduse din nume, tip, părinte, NUTS, SIRUTA sau CUATM.

## Rezultate și excepții

`distributions.json` este sursa canonică pentru fiecare nivel și stările missing/null/multiple/invalid/conflict. `exceptions.json` este registrul exhaustiv per-ID. Excepțiile non-fatale sunt intrarea pentru WEB-R2a.2 și nu autorizează corecții automate.

## Invariante

`data/` și `public/` rămân neschimbate față de base SHA. Cele 85 roluri nu cresc cardinalitatea ACTUAL; cele 8 contururi NI sunt source-only. P9.1 rămâne blocat: p91_import_allowed=false, semantic_acceptance=BLOCKED_INCOMPLETE, actual_mutation_allowed=false.

## Reproducere

`node scripts/audit/web-r2a1-admin-level-census.mjs --out-dir <director>`
