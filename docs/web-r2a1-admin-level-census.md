# WEB-R2a.1 — recensământ read-only admin_level OSM

**Bază GitHub exactă:** `073a1ee2a2098392df5891fb6b15e69b0eef2d9c` · **sursă:** `public/data/actual-entities.json` · **rezultat:** exhaustiv pentru cele 5.848 identități ACTUAL + catalog NI 85 roluri.

## Integritate și limitări

- `actual-public-entity-v3`: 5848 intrări, 5848 ID-uri unice; totalul declarat este 5848.
- `admin_level` citit textual/numeric din `entity.representation.admin_level`, niciodată dedus din nume, nivel statistic sau ierarhie.
- Distribuția este **pe identități ACTUAL**, nu pe relații cartografice sau geometrii suplimentare. Rolurile NI 85 sunt un **overlay de referință pe aceleași identități** și NU se însumează din nou.
- Snapshot ACTUAL `actual-a9e5a4ddcb5277ef` și fingerprint semantic `a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446` — păstrate, fără mutation.
- Catalog NI: `p907216-osm-role-ui-overlay-v1`, dată sursă OSM `2026-10-12T20:21:35Z`, SHA-256 probator OSM `dd21c3d123382c38a82574ce068f07ab1c3edb923edfa1240342b2d137e21775`; acceptare juridică blocată.

## Distribuție ACTUAL

| admin_level | RO | MD | Total |
|---|---:|---:|---:|
| 2 | 1 | 1 | 2 |
| 4 | 42 | 37 | 79 |
| 7 | 0 | 5 | 5 |
| 8 | 3180 | 982 | 4162 |
| 9 | 11 | 1571 | 1582 |
| null | 12 | 6 | 18 |
| **TOTAL** | **3246** | **2602** | **5848** |

## Excepții

- 18 valori `null` (RO 12, MD 6), toate persistate explicit în registru.
- 0 ID-uri duplicate; 0 valori multiple; 0 valori numerice invalide; toate cele 5.848 identități au jurisdicție RO sau MD.
- Cele 18 valori `null` privesc entități statistice cu geometrie separată; **nu le completa prin extrapolare din NUTS/OSM**.

| ID | Jurisdicție | Nume | Categorie |
|---|---|---|---|
| stat-MD12 | MD | Partea de Est (partea stîngă a Nistrului) | statistical |
| stat-MD11 | MD | Partea de Vest (partea dreapta a Nistrului) | statistical |
| stat-MD112 | MD | Regiunea Centru | statistical |
| stat-MD111 | MD | Regiunea Nord | statistical |
| stat-MD113 | MD | Regiunea Sud | statistical |
| stat-MD120 | MD | Unitățile administrativ-teritoriale din stînga Nistrului | statistical |
| stat-RO32 | RO | Bucureşti-Ilfov | statistical |
| stat-RO12 | RO | Centru | statistical |
| stat-RO2 | RO | Macroregiunea Doi | statistical |
| stat-RO4 | RO | Macroregiunea Patru | statistical |
| stat-RO3 | RO | Macroregiunea Trei | statistical |
| stat-RO1 | RO | Macroregiunea Unu | statistical |
| stat-RO21 | RO | Nord-Est | statistical |
| stat-RO11 | RO | Nord-Vest | statistical |
| stat-RO22 | RO | Sud-Est | statistical |
| stat-RO31 | RO | Sud-Muntenia | statistical |
| stat-RO41 | RO | Sud-Vest Oltenia | statistical |
| stat-RO42 | RO | Vest | statistical |

## Overlay Nistrenia — catalog 85, fără dublarea ACTUAL

- 85 roluri distincte, mapate la 85 identități ACTUAL, 7 grupări, nivel 4 = 1, nivel 8 = 84; fără nivel absent sau asignare lipsă.
- Rădăcina virtuală și grupările NI **nu** sunt identități juridice suplimentare. Inventarul celor 8 contururi operaționale NI necesită un audit separat dacă se dorește `admin_level` la nivel de contur, în loc de rol.

| Grup | Roluri | Nivel 4 | Nivel 8 |
|---|---:|---:|---:|
| Camenca | 13 | 0 | 13 |
| Rîbnița | 23 | 0 | 23 |
| Dubăsari | 10 | 0 | 10 |
| Grigoriopol | 16 | 0 | 16 |
| Tiraspol | 3 | 0 | 3 |
| Slobozia | 16 | 0 | 16 |
| Bender | 4 | 1 | 3 |

## Dovezi reproductibile

| Fișier | SHA-256 (octeți UTF-8, CSV ordonat conform sursei) |
|---|---|
| `docs/evidence/web-r2a1-actual-admin-level-per-id.csv` | `3d7e1ceba5e760e458e251b687caa41a184ce8ee5ef39b7a270057e9c189fe85` |
| `docs/evidence/web-r2a1-nistrenia-osm-roles-per-id.csv` | `44572b693a9013ec80b0a673aa8fa025dece4d456a4594f67dba657e949a2b4d` |

CSV-urile includ per-ID, jurisdicție, nume, nivelul brut, stare, relație și proveniență. Sursa de 5.848 de intrări nu este rescrisă. SHA-256 din tabel poate fi reprodus pe octeții UTF-8 publicați. Auditul **nu** certifică juridic clasificările OSM.

## Gate pentru WEB-R2a.2

Recensământul numeric ACTUAL și rolurile NI 85 sunt complete. Înainte de prezentarea bulinelor NI pe contururi proprii trebuie reconciliate distinct cele 8 contururi source-only. WEB-R2b rămâne blocat până la contractul semantic WEB-R2a.2/R2a.3, cu tests și autorizare separată.
