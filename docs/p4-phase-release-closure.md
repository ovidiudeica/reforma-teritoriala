# Faza P4 — audit de hardening și criterii finale de închidere

## Scop și invariabile

**P4 (P4.0–P4.3)** consolidează corespondența `identitate ACTUAL → geometrie publică → chunk/tier → filtru → hartă` pentru RO+MD, fără a schimba datele ACTUAL/P2. Baseline-ul de comparație pentru P4.3 este commitul `bddda5eecba9ce0f038d32b41a346f251b5a3a16` de pe `main` după P4.2.

Corpusurile ACTUAL, ISTORIC și PROPUNERI sunt separate. Faza P4 nu modifică `public/`, `data/`, geometrii OSM/ANCPI, registre oficiale SIRUTA/CUATM, manifestele de release, snapshoturi, fingerprints ori schema URL. Toate cele 5.848 de identități și geometriile publice sunt tratate read-only.

## Dovezi pe subetape

| Etapă | Dovezi și contract | Închidere |
| --- | --- | --- |
| P4.0 | [Issue #258](https://github.com/ovidiudeica/reforma-teritoriala/issues/258): audit per-ID, 115 chunk-uri, 8 layere, matrice logică în Chrome și verificare GitHub Pages | 5.848 ID-uri; 170 stări; 994.160 evaluări fără diferențe |
| P4.1 | [PR #259](https://github.com/ovidiudeica/reforma-teritoriala/pull/259): test Node `frontend-geometry-matrix.test.mjs`, SHA/bytes/feature count + coordonate identice între chunks și tier-uri, docs taxonomie | Gate permanent `frontend-geometry-taxonomy`; 115/115 chunks și 8/8 tier-uri |
| P4.2 | [PR #260](https://github.com/ovidiudeica/reforma-teritoriala/pull/260): test Chrome/CDP `frontend-cartography-browser.test.mjs`, 7 viewporturi, 14 selecții/zoom RO/MD, filtre statistice/administrative, z-order, cache/lazy, artefacte | Gate permanent `frontend-browser-qa`, 32 scenarii browser existente + 6 teste suplimentare |
| P4.3 | [Issue #261](https://github.com/ovidiudeica/reforma-teritoriala/issues/261): hardening selecție SVG per `entity_id` exact, excepții din contextul Chrome secundar, legare raport de commit și required status checks pe `main` | Closure contingent pe validare PR, enforcement în GitHub branch protection și dovada post-merge |

## Hardening P4.3 — bariere verificabile

1. **Selecția reală** trebuie să identifice un poligon conectat la DOM cu `feature.properties.entity_id` egal cu ID-ul selectat, să confirme `stroke=#b54a38` pe acel poligon și să valideze ID-ul/URL-ul/arborele. Un alt poligon selectat sau un contur întârziat nu poate substitui geometria țintă.
2. **Contextul lazy separat** verifică selecția geometriei încărcate la zoom și colectează independent erorile JS, de consolă și de rețea; excepțiile de tile sunt excluse strict pentru `tile.openstreetmap.org`. Cache-ul nu trebuie să dubleze cererile de chunk și schimbarea filtrului nu trebuie să relanseze fetch-uri geometrice.
3. **Provenance-ul raportului**: `p42-cartography-matrix.json` include `GITHUB_SHA` în CI, iar artefactul GitHub Actions este asociat exact workflow run-ului testat; capturile sunt fișiere temporare și nu modifică tree-ul Git.
4. **Enforcement, nu doar observabilitate**: `main` trebuie să aibă required checks `frontend-geometry-taxonomy` și `frontend-browser-qa`, păstrând required checks ACTUAL/P2 `verify-persisted-release`, `actual-change-reproducibility`, `actual-release-trust-chain` și `p2-statistical-foundation`. `strict=true` și originea aplicației GitHub Actions trebuie păstrate.
5. **Criteriul final de release**: PR de hardening cu CodeQL, Chrome/CDP, matrice, release trust și A/B PASS; merge în `main` cu required checks, toate controalele post-merge SUCCESS, GitHub Pages build/deploy SUCCESS și zero drift `data/` sau `public/`.

## Limitări explicite și reziduuri operaționale

- Matricea este exhaustivă pe **cele 170 stări definite contractual** și toate cele 5.848 identități; nu reprezintă toate submulțimile teoretice ale filtrelor și nu oferă capturi pixel-cu-pixel pentru fiecare combinație. Chrome testează desenarea SVG și selecția reprezentativă pe ambele jurisdicții.
- Limitările oficiale privind acoperirea poligonală a localităților RO/MD și observațiile topologice report-only rămân conform `docs/actual-v1-known-limitations.md`, fără reclasificări ad hoc.
- Avertismentele de compatibilitate Node 20 ale unor actions pin-uite, forțate de GitHub la Node 24, și eventuale HTTP 503 tranzitorii la sursa externă GitHub Pages trebuie urmărite separat; un retry reușit nu este dovadă că întreruperile externe sunt imposibile.
- Protecția de required checks este o setare GitHub a repository-ului, nu parte a diff-ului. Verificarea ei trebuie documentată prin valoarea citită din API. Nu trebuie niciodată înlocuite sau șterse controalele existente.

**Închiderea P4.3** se documentează după integrare în [PR-ul aferent Issue #261](https://github.com/ovidiudeica/reforma-teritoriala/issues/261) cu SHA de `main`, run ID-urile și verdictul A/B. Niciun rezultat viitor nu este presupus PASS înainte de executare.
