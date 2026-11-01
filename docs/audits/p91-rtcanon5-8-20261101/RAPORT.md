# P9.1 — continuare tehnică și limitele adjudecării

Baseline verificat: `35d25d38182bd8453a7bd9ba1819e4ed842eebb5`. PR #500 rămâne separat, draft, cu trei documente de audit. Nicio modificare canonică, integrare sau publicare nu a fost executată.

## Integritate și reproducere

Pachetul RT-CANON inițial: 52/52 fișiere conforme manifestului, dimensiuni și SHA-256 verificate; CRC ZIP conform. SHA-256 ZIP: `eb260a9b4b15847d4a3335e6449827ca6a068d76dfe44d47138f18b82c6cd33c`.

OSMB România: `cc4fd15940550054d90fcadf907ed98352b68882735680093f77a624e3e04897`; Moldova: `d29b600daa2857bacf8ec7d13369db8fc95353e89f62fe1c762dbc692c216dad`. Arhivele sunt snapshoturi cartografice datate; momentul exact al exportului per obiect nu este certificat de numele fișierului.

`audit.py` citește arhiva verificată, geometriile ACTUAL din obiectele Git ale baseline-ului și arhivele OSMB originale. Reutilizează registrele și probele istorice existente, fără a rescrie recensământul. Dependențe: Shapely 2.1.2, pyproj 3.7.2. Argumente: `--repo`, `--prior`, `--runtime`, `--out`, `--ro`, `--md`. Sursele Git individuale și hashurile lor sunt în `source-provenance.json`. Verificările executate sunt în `verification.json`.

Layout-ul de reproducere este restrâns explicit: din workspace, `work/rt-canon-source`, `work/rt-canon-runtime`, `outputs/RT-CANON-20261101.zip`, `outputs/p91-continuare-20261101`; cele două arhive OSMB sunt în `~/OneDrive/Desktop/`, cu numele fixate. Argumentele CLI trebuie să corespundă acestor căi; nu controlează arbitrar directoarele de scriere sau importul Python. O a doua execuție a scriptului restrâns a reprodus registrele fără diferențe de bytes față de prima execuție.

## RT-CANON.5 — 13 comparații independente

Toate cele 13 perechi au fost recalculate din coordonatele originale, fără snap, rotunjire sau make_valid. Sunt raportate suprafețele înainte/după, intersecția, ambele diferențe, diferența simetrică, perimetrul, componentele, golurile, validitatea, distanța Hausdorff densificată și distanța minimă între frontiere. România: EPSG:3844; Moldova: EPSG:32635. EPSG:6933 este raportat separat pentru comparabilitatea cu auditul anterior. Unități: metri și metri pătrați. Proiecțiile diferite nu produc valori numeric identice.

Verdictul celor 13 este `KEEP_VERIFIED`, exclusiv pentru păstrarea reprezentării cartografice acceptate. Nu reprezintă certificarea juridică a hotarului. Dovezile de istorie OSM sunt reutilizate din baseline, fixate prin hash; comparațiile GIS sunt reproduse independent, nu se pretinde o nouă descărcare și reluare integrală a istoricului OSM.

Ojdula `osm-r14735731`: diferență simetrică 112,886884812914 km² în EPSG:6933, respectiv aproximativ 112,845934833 km² în Stereo 70. OSMB păstrează anvelopa comună Ojdula–Brețcu; ACTUAL separă Brețcu `siruta-u64096`. Intersecția interioară a celor două geometrii ACTUAL este zero în calculul executat. Uniunea lor diferă de anvelopa OSMB prin **0,0012952194810083029 m²** în proiecția locală; reziduul nu este redus la zero. Hausdorff este aproximativ 10.669,971 m. Înlocuirea Ojdula cu anvelopa OSMB ar reintroduce suprapunerea cu Brețcu. Probele ANCPI și adaptările terminale revizuite justifică păstrarea operațională, fără a dovedi echivalența completă cu un hotar juridic certificat.

Celelalte cazuri: Chișinău, Condrița, Ialoveni, două reprezentări Malcoci, două Nimoreni, Centru, Scoreni, Strășeni, Roznov și Săvinești. Registrul per-ID păstrează cauza demonstrată, metadatele, hashurile și referințele istorice. Diferența față de un snapshot mai vechi nu justifică REPLACE. Niciuna dintre simulările contrafactuale nu este autorizată.

## RT-CANON.6 — inventar individual și registru național

`rt-canon6-individual-cases.jsonl`: 304 dosare — 283 obiecte OSMB fără ACTUAL, două ACTUAL fără OSMB, cinci grupuri cu reprezentări multiple și 14 excepții RT-ADM. Distribuție: 167 `KEEP_VERIFIED`, 135 `BLOCKED_INCOMPLETE`, două `BLOCKED_CONFLICT`. KEEP privește rolul cartografic deja documentat, nu identitatea juridică nouă și nu hotarul. Dovezile anterioare individuale sunt păstrate integral unde există.

`national-final-correspondence.jsonl`: 18.699 înregistrări oficiale, cu identitate, categorie, părinte și reprezentări existente. Cele 13.858 fără geometrie legată prin cod au `separate_polygon_required: NOT_PROVEN`; nu se propune inventarea unui poligon pentru fiecare localitate componentă sau rol statistic. Registrul este final ca inventar al acestei execuții, nu ca certificare juridică integrală.

Bondareuca `osm-r18967570` și Etulia loc.st.c.f. `osm-r18968043` rămân `BLOCKED_CONFLICT` teritorial. Părinții juridici existenți — Zgărdești, respectiv Etulia — sunt păstrați. Reprezentările geometrice Grigorăuca și Cișmichioi nu schimbă apartenența legală. Pentru decupare, transfer sau înlocuire sunt necesare identificarea pozitivă a rolului teritorial și delimitările competente ale suprafeței și vecinilor.

Cele 85 de roluri Nistrenia și NI-TREE.2 sunt păstrate. Nu sunt create jurisdicții de facto sau identități canonice suplimentare. Cele șase sectoare București rămân în cele 14 excepții RT-ADM; validarea identității SIRUTA nu certifică automat frontierele.

## RT-CANON.7 — constatări topologice și lacune

`rt-canon7-partition-review.jsonl`: 706 constatări din auditul exhaustiv anterior, clasificate suplimentar după identitate și nivel. Intersecțiile între niveluri sau roluri diferite nu sunt declarate automat defecte. Suprapunerile candidate între identități UAT distincte sunt blocate până la dovada exclusivității și delimitarea competentă; nu se aplică DIFFERENCE sau UNION arbitrar.

`chisinau-coverage-review.jsonl`: cinci grupuri de acoperire documentate. Lipsesc documentația competentă a limitelor sectoarelor și dovada că grupul examinat trebuie să formeze o partiție exhaustivă. Golurile matematice nu sunt atribuite automat unei unități. Aceste clasificări extind trierea reproductibilă; nu constituie o nouă certificare teritorială exhaustivă pentru toate UAT-urile.

## WEB-CARD.1 — implementare separată

PR https://github.com/ovidiudeica/reforma-teritoriala/pull/501, branch `feat/web-card1-20261101`, SHA `516d2d528ca1396bdfe0b1253a0f43417280cbca`. 5.848 carduri, 64 fragmente încărcate la cerere; legătura cu snapshotul și identitatea este verificată. Secțiuni extensibile pentru geometrie, părinte geometric, conflicte, proveniență și taguri OSMB filtrate. Valorile externe sunt text, nu HTML. Tagurile personale nu sunt publicate. Atribuirea OSM/ODbL este păstrată.

Validare locală: 6/6 teste noi, 53/53 regresii existente, zero teste sărite. Chromium desktop și mobil; navigare, filtre, resetări, Undo, URL și Back/Forward, cele 85 de roluri și NI-TREE.2. Comparație A/B cu baseline-ul: aceeași stare administrativă, fără overflow sau erori JavaScript. Capturile desktop și mobil au fost examinate. Dovezi în `web-card-qa`, `regression-qa`, `visual-ab` și `regression-tests.log`. CI GitHub se raportează separat pe SHA-ul exact; succesul local nu îl înlocuiește.

## RT-CANON.8–9 — autorizare și lucrări rămase

Două dosare în `rt-canon8-batch-dossiers.json`: `RT5-KEEP-13` fără schimbare canonică și `RT7-MD-PARENT-CONFLICTS`, blocat, fără câmpuri propuse pentru modificare. **Zero loturi canonice pregătite pentru autorizare; zero promovări; P9.1b BLOCKED.**

Nu există încă dovezi suficiente pentru loturi geometrice noi. Documentele necesare sunt indicate per caz. Nu se solicită o aprobare generală pentru schimbarea ACTUAL. Integrarea WEB-CARD.1 este o decizie separată, permisă numai după CI terminal verificat și autorizare explicită pe SHA-ul concret.

P9.1 nu este declarată finalizată: rămân certificările documentare indicate, decizia de integrare a interfeței, CI complet și auditul post-merge/Pages după o eventuală integrare autorizată. Website-ul nu a fost modificat de această execuție.

CI a respins prima amplasare a resurselor UI în public/data. Resursele noi au fost mutate în assets/web-card-audit, în afara datelor canonice; validatorul și politica nu au fost modificate. Testul website-ului publicat a detectat separat lipsa conturului operațional Nistrenia în starea inițială a website-ului existent. Acest test vizează baseline-ul publicat, nu candidatul UI neintegrat; integrarea rămâne blocată până la adjudecarea și verificarea separată a problemei.
