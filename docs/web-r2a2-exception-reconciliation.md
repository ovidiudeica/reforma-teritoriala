# WEB-R2a.2 — reconcilierea celor 28 de excepții (read-only)

## Bază și delimitări

- HEAD inițial main: `08a873a2030bebe55034792a93b5e146cf17a210` (verificat identic cu main la început).
- Intrare: `docs/evidence/web-r2a1/exceptions.json`, exact 28 excepții (18 null, 8 missing NI, 2 proveniență temporală).
- Surse NI: `public/data/p9095-osm-outlines-manifest.json`, relațiile, versiunile și timestampurile individuale.
- Rezultatul per-ID: `docs/evidence/web-r2a2/osm-historical-admin-level.json`.
- **Nu se modifică** ACTUAL, `data/`, `public/data/`, poligoane, nici P9.1.

## Observații istorice OSM pentru opt contururi NI

| Identitate source-only | relation ID | versiune | tag `admin_level` | dovadă |
|---|---:|---:|---:|---|
| view-nistrenia | 65335 | 424 | 3 | https://www.openstreetmap.org/relation/65335/history/424 |
| view-nistrenia-group-osm-r1702216 | 1702216 | 42 | 5 | https://www.openstreetmap.org/relation/1702216/history/42 |
| view-nistrenia-group-osm-r1702217 | 1702217 | 50 | 5 | https://www.openstreetmap.org/relation/1702217/history/50 |
| view-nistrenia-group-osm-r1702215 | 1702215 | 132 | 5 | https://www.openstreetmap.org/relation/1702215/history/132 |
| view-nistrenia-group-osm-r1702214 | 1702214 | 48 | 5 | https://www.openstreetmap.org/relation/1702214/history/48 |
| view-nistrenia-group-osm-r1702219 | 1702219 | 55 | 5 | https://www.openstreetmap.org/relation/1702219/history/55 |
| view-nistrenia-group-osm-r1702218 | 1702218 | 95 | 5 | https://www.openstreetmap.org/relation/1702218/history/95 |
| view-nistrenia-group-osm-r944727 | 944727 | 73 | 5 | https://www.openstreetmap.org/relation/944727/history/73 |

Cele opt pagini istorice afișează explicit tagul și versiunea, iar datele publicării corespund manifestului sursă. Distribuția observată: nivelul 3 = 1; nivelul 5 = 7.

**Limitare critică:** observația paginii istorice nu echivalează cu verificarea SHA-256 pe octeții XML istorici. Hashurile `source_xml_sha256` din manifestul P9.0.9.5 sunt existente, dar nu au fost verificate independent în această execuție. Nu se ridică statusul la `CRYPTOGRAPHICALLY_CERTIFIED` fără o extragere raw și verificare exactă a versiunilor.

## Dispoziția completă a celor 28 de excepții

| Categorie | Număr | Dispoziție |
|---|---:|---|
| `ADMIN_LEVEL_MISSING`, NI source-only | 8 | `OSM_TAG_OBSERVED_VERSION_MATCHED`; păstrare ca overlay read-only, promovare amânată până la revalidarea XML brut |
| `ADMIN_LEVEL_NULL`, RO/MD statistice | 18 | `EXPLICIT_NULL_ACCEPTED`; nedeterminate, nu se inventează valoare și nu se introduc buline numerice |
| `TEMPORAL_SNAPSHOT_DIFFERENCE` | 1 | `DOCUMENTED_NOT_ATOMIC`; păstrare timestamp per sursă |
| `SOURCE_NOT_ATOMIC_SNAPSHOT` | 1 | `DOCUMENTED_NOT_ATOMIC`; păstrare version/timestamp per relație |
| **TOTAL** | **28** | 0 corecții în surse |

ACTUAL RO și MD sunt fotografii semantice, rolurile OSM au o altă dată de captură, iar cele opt contururi NI provin dintr-un pachet non-atomic. Rezultatele nu creează o singură fotografie istorică și nici o nouă jurisdicție legală.

## Criterii de închidere

- [x] Toate cele 28 de cazuri au dispoziție metodologică explicită.
- [x] Cele opt ID-uri NI au tag OSM observat la versiunea din manifest.
- [x] Nicio deducție de nivel din nume, poziție în arbore sau NUTS.
- [x] Nicio modificare ACTUAL / geometrii în acest branch (de confirmat prin CI).
- [ ] Dovezile XML brute istorice re-descărcate și SHA-256 comparate cu manifestul original.
- [ ] Toate check-urile obligatorii pe SHA-ul final de PR.
- [ ] Verificarea întregului diff și aprobarea de merge.

**Verdict provizoriu:** `RECONCILED_WITH_EVIDENCE_LIMITATION`. Păstrați PR-ul Draft până la verificări, nu marcați WEB-R2a.2 definitiv închis.

P9.1 rămâne `p91_import_allowed=false`, `semantic_acceptance=BLOCKED_INCOMPLETE`, `actual_mutation_allowed=false`; WEB-R2b nu este autorizat de acest raport.
