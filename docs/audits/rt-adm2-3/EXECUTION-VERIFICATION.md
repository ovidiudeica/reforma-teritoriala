# RT-ADM.2.3 — certificare tehnică independentă a artifactului

**Run:** https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/40983765023 — `SUCCESS`, head `2dc27c487bef3186ac09d5bcaae76b82f4194225`.

**Artifact:** `12946212281`, digest GitHub `sha256:ba537622bf584e75ab599a156fabf92f96083a3291e3b3a7274e01bbc0b82278`. ZIP descărcat și SHA-256 recalculat independent: **identic**. 181 fișiere, dintre care 179 istorice XML (4 way + 175 node), 2 JSON. Raportul `reconstruction-register.json`: 175 noduri distincte, 0 erori, plafon nedepășit, toate cele 13 reconstrucții snapshot/way COMPLETE_OSM_RING și inele închise.

## Reconstrucții și modificări geometrice

| Relation | Way | Versiuni way | Snapshot-uri examinate | Diferența simetrică a conturului față de primul snapshot |
| --- | --- | ---: | --- | --- |
| 18967570 Bondareuca | 1376179980 | 1 | 2025-04-09, 2025-10-05, 2026-01-31 | 0 m², Hausdorff 0 m |
| 18968043 Etulia | 1376179909 | 1 | 2025-04-09, 2025-10-05, 2026-02-01 | 0 m², Hausdorff 0 m |
| 18968043 Etulia | 1376180675 | 1 | 2025-04-09, 2025-10-05, 2026-02-01 | 0 m², Hausdorff 0 m |
| 12104636 identitate nedovedită | 889101842 | 5 | 2020-12-28 (v2), 2023-09-26 (v3), 2025-10-05 (v3), 2026-08-31 (v5) | 2023: 218.738 m² / 3.236 m; 2025: identic 2023; 2026: 3929.574 m² / 20.612 m față de 2020 |

Metodă suplimentară **independentă de aproximația ariei din script**: geometria coordonatelor din artifact a fost interpretată cu Shapely și transformată din EPSG:4326 în EPSG:32635 (UTM 35N) cu pyproj; s-au calculat `symmetric_difference.area`, distanța Hausdorff, și validitatea topologică. Toate cele 13 geometrii examinate sunt valide, cu 0 noduri lipsă. Diferența simetrică față de 2020 a conturului 12104636 nu este echivalentă cu o schimbare juridică de limită.

Versionare exactă: 1376179980 v1 / 36 referințe de noduri; 1376179909 v1 / 30; 1376180675 v1 / 79. Way 889101842: v1 și v2 în 2020, v3 în 2023, v4 și v5 la 9 aprilie 2026; snapshotul 31 august 2026 selectează v5. Cele 13 reconstrucții reprezintă 3 + 3 + 4 date de referință pentru cele trei relații, respectiv 3 + 6 + 4 inele way, numărând separat cei doi membri Etulia.

## Controlul limitelor probatorii

- CUATM 2025 confirmă pentru Bondareuca cod 8961 / părinte Zgărdești 8960 și pentru Etulia loc.st.c.f. 9639 / părinte Etulia 9629, conform verificărilor anterioare. Aceasta **nu** certifică poligoanele OSM ca limite administrative juridice.
- Nu există în acest artifact o geometrie oficială cadastrală, o versiune oficială de frontieră pentru aceleași date, sau o dovadă pozitivă independentă a identificării întregului poligon.
- Pentru relația 12104636, istoria etichetelor OSM poate explica rolul cartografic de loturi/pomicultură, dar nu justifică atribuirea unui cod CUATM sau a unui statut administrativ.
- Etulia conține două inele way separate; suprafețele lor nu sunt însumate drept contur juridic fără analizarea explicită a structurii relației și a eventualelor roluri interioare/exterioare.
- Este verificată integritatea ZIP prin digest; hashuri per-fișier XML pot fi calculate independent la o etapă arhivistică ulterioară.

**Verdict:** `GEOMETRIC_RECONSTRUCTION_PASS_PRIMARY_LEGAL_BOUNDARY_COMPARISON_OPEN`. `NO_CHANGE_PENDING_PRIMARY_EVIDENCE` pentru toate cele 3 cazuri. ACTUAL, coduri, geometrie, parentaj și P9.1 nemodificate/blocate.
