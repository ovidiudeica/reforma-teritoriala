# web-v1.2.1 — statistical levels bugfix

## Baseline

Patch functional: `dd7a3dcb1e50095b56861edb3466a911f7d9cfe4` (PR #249).

Patch-ul pornește de la release-ul web `web-v1.2.0` și nu modifică release-ul de date ACTUAL.

## Defect reparat

În web-v1.2.0, `geometryVisible()` aplica filtrul `statisticalLevels` tuturor entităților cu rol statistic, inclusiv celor 45 de entități coalesced care reutilizează geometria administrativă.

Consecința principală: Nivel statistic 3 OFF ascundea 44 geometrii administrative reutilizate — 42 județe/București din România plus Chișinău/MD115 și Găgăuzia/MD114 — deși filtrele administrative corespunzătoare rămâneau checked.

## Contract web-v1.2.1

- class/subtype filters controlează geometriile administrative/cartografice;
- `statisticalLevels` controlează numai entitățile `statistical_only`, adică cele 18 limite statistice separate;
- toggle-ul `separateStatisticalGeometry` este masterul celor 18 limite separate;
- când masterul este OFF, controalele de nivel sunt disabled, dar starea nivelurilor este păstrată;
- `Toate nivelurile` / `Niciun nivel` modifică numai nivelurile, nu masterul;
- parametrul URL `s` păstrează schema v=1 și controlează numai nivelurile limitelor statistice separate;
- geometriile administrative coalesced nu pot fi ascunse de `s` sau de checkbox-urile de nivel.

## Count-uri explicite

Cele 63 roluri statistice rămân neschimbate:

| Nivel | Roluri | Geometrii reutilizate | Limite separate |
| --- | ---: | ---: | ---: |
| 1 | 5 | 1 | 4 |
| 2 | 10 | 0 | 10 |
| 3 | 48 | 44 | 4 |
| Total | 63 | 45 | 18 |

Nivel 3:
- RO: 42 roluri, 42 geometrii administrative reutilizate, 0 limite separate;
- MD: 6 roluri, 2 geometrii administrative reutilizate, 4 limite separate.

UI-ul afișează atât rolurile totale, cât și limitele separate efectiv controlate, plus breakdown RO/MD.

## Validare

PR #249 a trecut:
- 163/163 teste Node;
- 27/27 teste Chrome/CDP reale;
- 190/190 teste frontend în total;
- frontend taxonomy/filter/search/tree/URL/mobile/a11y;
- topology;
- CodeQL;
- persisted release;
- ACTUAL release trust chain;
- P2 statistical foundation;
- reproducibilitate A/B + comparator.

Browser QA verifică explicit că Nivel 3 OFF păstrează geometria unui județ/NUTS3 selectat și starea checked a filtrului administrativ, în timp ce limitele statistice separate de nivel 3 sunt filtrate.

## ACTUAL/P2

Neschimbat:
- release `actual-v1.2.0`;
- snapshot `actual-a9e5a4ddcb5277ef`;
- fingerprint `a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446`;
- contract `actual-public-entity-v3`;
- 5848 entități;
- 5848 noduri de ierarhie;
- 63 roluri statistice;
- 18 statistical-only;
- MD120 oficial; MD121 numai evidence OSM.

Patch-ul nu modifică geometrii, entități, ierarhii, registre sau surse.

## Release

După merge-ul closure PR și checks verzi pe exact commitul de closure, se publică tag/release `web-v1.2.1`. `app_commit` rămâne SHA-ul funcțional al PR #249, evitând o referință circulară către commitul de metadata closure.
