# RT-AUDIT.1.2 — dosar probatoriu final read-only

PR #459, branch `audit/rt-audit1-parent-child-20261029`. Baza inițială a acestei completări este `34ce7cead13296d6420be797ee37f500d4db625d`; main rămâne `913145398bea5861935cd4b3b89a88638d80fd9c`. **PR-ul rămâne Draft și neintegrat.**

## Contract și reproducere

Auditorul verifică 5.848 identități, 5.846 legături părinte–copil, 119 fragmente topologice și 123 GeoJSON master. Cele 32 componente ACTUAL sunt verificate înainte și după execuție. Clasificările inițiale rămân 5.589 OK / 254 GEO / 3 DOC / 0 ADM inițiale. Un rezultat GEO nu este o concluzie juridică; zero ADM inițial nu înseamnă absența discrepanțelor probatorii secundare.

```sh
node --test scripts/audit/rt-audit1-evidence.test.mjs
node scripts/audit/rt-audit1-2-run.mjs --reproduce
node scripts/audit/rt-audit1-2-verify.mjs
```

Comenzile sunt offline și scriu numai în outputs. Parserul XLSX folosește dependența fixată deja în bundle-ul npm offline; workflow-ul o instalează prin procedura existentă. Nu există snapping, clipping, eliminare de vârfuri, rescriere de poligoane, reparentare, deduplicare sau atribuiri noi CUATM/SIRUTA.

`rt-audit1-2-history-acquisition.py` este o operațiune separată de rețea, numai GET oficial, cu cache, rate limiting secvențial, cel mult două încercări pe URL, plafon finit de 600 încercări și 900 secunde per invocare. Nu este executată în CI și nu trebuie relansată pentru a reproduce dosarul. Răspunsurile înghețate disting capturile succesive; nu reprezintă un snapshot atomic nou. Originalele brute sunt locale/private; în Git nu se publică user/uid ale contributorilor. Cache-urile JSONL mici sunt verificate prin manifestele lor; PBF-ul de 164 GB nu este recitit.

## Ce demonstrează geometria

Toate cele 252 perechi administrative comparabile se trasează exact, în ambele direcții, de la muchiile master la segmentele ways din snapshotul OSM acceptat. Două perechi cu părinte statistic au mecanismul distinct documentat prin clasificarea BNS și sursa statistică; nu sunt tratate ca două relații administrative OSM direct comparabile.

Comparația suplimentară folosește aritmetică BigInt pe coordonatele zecimale **exact așa cum sunt stocate** și intervale pe aceeași dreaptă. Nu transformă geometria. Acoperă segmentări diferite, orientări, goluri și găuri. Nu înlocuiește aria geodezică sau matricea DE-9IM existente și nu certifică o frontieră juridică. Cele 42 depășiri de maximum 1 m² și 11 în toleranța numerică rămân vizibile.

Distribuția celor 254 este păstrată: 162 identități CUATM comune, 76 parentaje CUATM directe, 13 auxiliare non-CUATM, două relații statistice și o identitate pozitivă nerezolvată (`osm-r12104636`, DOC). Toate au fișe individuale; găsirea unei explicații administrative nu schimbă clasificarea inițială.

## Dovezi oficiale și egalități

CUATM_25.xlsx este recuperat autentic de la BNS și păstrat ca original mic. Toate cele 1.721 înregistrări sunt confruntate pe cod, ParentCodUnic, statut și cod statistic cu snapshotul înghețat. Concordanța actuală nu este prezentată drept dovadă că originalul din septembrie avea aceiași octeți.

Originalul NUTS.xlsx recuperat din arhiva oficială coincide exact cu SHA-256 deja acceptat `c20ca3360f8f26a2baeed92c354a0fe927860a746d214ba2843f9f9aaaad20c4`; arhiva coincide cu `e1a751f90908793c9a3d82077ac3d309b0a366835cf6fd6090e70cd6ad3c30ba`.

- **Pojăreni:** două reprezentări OSM, niveluri 9/8, același CUATM 5525; registrul indică sat independent. Egalitatea exactă a frontierelor și identitatea de registru sunt demonstrate separat. Nu se deduce existența a două unități juridice și nu se deduplică.
- **Orhei:** ambele reprezentări egale sunt legate de municipiul CUATM 6401, statut 5, sub raionul CUATM 6400, statut 2. Nu sunt raionul și municipiul având aceeași frontieră. Un way versus opt ways poate exprima aceeași frontieră exactă; dovada nu se bazează doar pe aria egală. Motivul istoric al duplicării rolurilor OSM și frontiera juridică nu sunt certificate.
- **MD120 / MD12:** originalul BNS confirmă unicul copil statistic. Coextensivitatea rolurilor statistice este explicată; conflictul de proveniență OSM MD121 / BNS MD120 rămâne separat și necorectat.

Cele trei clasificări inițiale DOC sunt păstrate chiar dacă propozițiile semantice precise au acum dovezi suplimentare.

## Două discrepanțe de coduri stocate — nu adjudecări ale teritoriului

| Copil ACTUAL | Cod stocat | Părinte din arbore / cod | ParentCodUnic oficial |
|---|---|---|---|
| osm-r18967570 Bondareuca | 8961 | osm-r19076879 Grigorăuca / 7433 | Zgărdești / 8960 |
| osm-r18968043 Etulia, loc.st.c.f. | 9639 | osm-r19117344 Cișmichioi / 9621 | Etulia / 9629 |

Propoziția certificată este limitată: **codurile oficiale deja atribuite în ACTUAL nu concordă cu parentajul acestor două rânduri ale arborelui**. Nu rezultă automat dacă trebuie corectată identitatea stocată, un tag OSM ori părintele. Identitatea juridică a întregului footprint OSM nu este certificată independent numai prin tag, nume sau poziție. Clasificarea geometrică inițială OK este păstrată; nu se schimbă nimic în ACTUAL.

Mai există 11 reprezentări RO fără identitate oficială atribuită în ACTUAL: cinci reprezentări de localități componente și șase sectoare București. Lipsa unei atribuiri explicite este conservată în registrul lacunelor administrative; nu se completează prin potrivire nominală.

## Istorie, limite și acceptare

Au fost recuperate și verificate la epocă toate cele 479 relații OSM distincte ale suprapunerilor și egalităților, plus șase relații de context: 485 istorice de relații. Împreună cu 30 istorice way, 12 istorice node și opt changeset-uri, sunt 535 răspunsuri distincte, dintre care unul reutilizat din arhivă; cele 534 cereri oficiale consemnate au primit HTTP200. Originalele noi au fost reverificate efectiv de pe disc, iar receipturile sunt conservate separat. Numărul efectiv al răspunsurilor și excepțiile sunt calculate din dovezile înghețate, nu dintr-o țintă declarată artificial atinsă. Fiecare versiune este selectată strict înainte de `2026-10-05T23:50:05.218Z`; versiunile curente nu sunt amestecate cu geometriile acceptate.

Istoricul ways/nodes este selectiv. Diferențele de membri și versiunile recuperate nu demonstrează singure efectul geometric înainte/după și intenția unei editări. **Zero cauze istorice individuale certificate; toate cele 254 cazuri păstrează HISTORY_INCOMPLETE pentru investigația cauzală completă.** Sunt separate OBSERVED_GEOMETRY, VERIFIED_SOURCE_MECHANISM, ipoteza cauzală și certificarea cauzei.

Rezultatele se generează în `outputs/RT-AUDIT.1.2/`: registre JSON/CSV, matricea tuturor 5.846 legături, egalități, istorii, delte de membri/way/node, surse oficiale, discrepanțe de coduri, lacune, intervenții ipotetice și manifestul checksums. Intervențiile nu sunt executate și necesită dovezi individuale și autorizările separate aplicabile.

CI inițial pe 34ce7ce este conservat în `evidence/ci-initial.json`: 20 SUCCESS și două SKIPPED condiționale, fără a număra A/B drept probe executate. Pentru completarea nouă, verdictul tehnic final depinde de CI pe SHA exact și de verificarea independentă a artifactului; se ancorează în comentariul final al PR-ului, fără rezultate viitoare înscrise aici.

Concluzia posibilă este `RT-AUDIT.1.2 — TECHNICALLY COMPLETE WITH DOCUMENTED EXCEPTIONS`, **nu** certificarea exhaustivă a frontierelor juridice sau a cauzelor istorice. PR #459 rămâne Draft și nu se integrează. Website-ul, sursa OSM acceptată, P9.1 și main rămân nemodificate.

© OpenStreetMap contributors, ODbL. Surse oficiale: BNS pentru CUATM/NUTS, INS/SIRUTA și Eurostat/GISCO pentru corpusul RO. Nicio sursă cartografică nu este tratată drept autoritate juridică asupra frontierelor.
