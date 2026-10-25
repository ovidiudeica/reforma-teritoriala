# OSM-FIX.4 — dosar condițional pentru mapper

Bază verificată: `main@6b08bca9630f47730f796af0f925de40496e5256`. Dosar read-only, nu autorizație și nu upload OSM. Captura oficială este datată în fiecare receipt; trebuie reîncărcată înaintea oricărei intervenții viitoare.

## Diferențele exacte propuse

| Relație | Way curent | Index zero-based | Referință veche → propusă |
|---|---|---:|---|
| Horești 18967493 v6 | 1376179876 v8 | 457 | 12318728194 → 12318728593 |
| Buneți 18968082 v7 | 1376180731 v6 | 227 | 11649857778 → 8265822008 |

Se substituie exclusiv referința terminală în copia izolată. Nodurile originale rămân existente. Nu se efectuează unire globală, ștergere de noduri, schimbare de taguri sau schimbare ACTUAL. Coordonatele și ordinea tuturor celorlalte referințe rămân identice.

## Dovezi și domeniu

29 răspunsuri oficiale de obiecte/utilizări inverse, toate HTTP 200; 14 ways inverse și nouă relații geometrice, graf de 3.218 obiecte. Cele zece istorice conservate au hashurile verificate și versiunile finale comparate cu API-ul curent; cinci istorice suplimentare și nouă changeseturi contextualizează istoricul. Originalele cu metadate de contributor rămân private local; acest PR conservă reprezentările sanitizate și receipturile cu hash, nu pretinde că publică originalele brute.

`preflight.json` arată ambele relații țintă deschise prin identitate de nod înainte de simulare, apoi valide în simulările individuale și combinate. Cele șapte relații vecine sunt valide înainte/după și rezultatele lor sunt identice: 1752520, 1782011, 13014028, 18256679, 18256680, 18822471, 18966832. Validatorul folosește închiderea prin ID, verificarea dependențelor și validatorul GIS existent, fără reparare. Aceasta certifică numai domeniul observat, nu întreaga topologie OSM.

## Intenția cartografică: nerezolvată

Coincidența coordonatelor nu dovedește intenția de conectare. Istoricul și continuitatea limitei susțin investigarea propunerii; nu înlocuiesc confirmarea unui mapper competent. Cele trei comentarii existente ale changesetului 164736346 discută CUATM/convenții de taguri, nu aprobă aceste substituții. `discussion-review.json` conservă rezumatul, datele și hashurile textelor, fără republicarea contributorilor. Nu au fost contactați contributorii.

Convențiile generale privind inelele cu noduri terminale comune sunt descrise în [documentația multipolygon OSM](https://wiki.openstreetmap.org/wiki/Relations/Multipolygon) și [algoritmul de asamblare](https://wiki.openstreetmap.org/wiki/Relation%3Amultipolygon/Algorithm), consultate la 25 octombrie 2026. Aceste convenții nu constituie confirmarea intenției pentru obiectele prezente. Cazurile speciale de ramificare neacceptate de instrument sunt trimise la revizuire, nu declarate automat invalide în OSM.

## Pașii rezervați mapperului

1. Confirmați explicit intenția ambelor conexiuni pe baza istoricului și a limitelor vecine; documentați orice separare intenționată sau ambiguitate. Până atunci: `MAPPER_INTENT_UNRESOLVED`.
2. Numai după confirmare, obțineți autorizarea finală a utilizatorului pentru cele două diferențe exacte. Accesul la un cont/editor legitim nu este presupus.
3. Reîncărcați versiunile și utilizările inverse imediat înainte de salvare. Orice versiune/index/conținut schimbat cere reevaluare; nu suprascrieți contribuții recente.
4. Aplicați exclusiv substituțiile aprobate, fără alte referințe/taguri. Comentariu de changeset propus, NEPUBLICAT: «Repair two disconnected administrative boundary endpoints in Horești and Buneți; preserve coordinates and other node references after neighbor review».
5. După o publicare autentică, conservați ID-ul changesetului, noile versiuni și răspunsurile API; comparați exact diferențele autorizate și revalidați toate relațiile afectate. Separați propagarea API de Overpass/Geofabrik.

Nu se solicită încă aprobarea finală de upload: lipsește confirmarea mapperului. Niciun mecanism de upload sau credențiale nu este implementat în acest PR.

## Integritate și verdicte

`actual-integrity.json`: cele 32 componente rehashuite, RO 3246 / MD 2602 / total 5848, SHA semantic `a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446`. NI-FIN rămâne funcțional, fără modificări ale interfeței, CUATM, părinților MD sau geometriilor. P9.1 rămâne blocat.

- HORESTI_MAPPER_INTENT_CONFIRMED=false; BUNETI_MAPPER_INTENT_CONFIRMED=false — confirmarea umană specifică lipsește.
- INVERSE_REFERENCES_VALIDATED=true; CONDITIONAL_SIMULATION_PASS=true — numai domeniul oficial observat.
- PUBLIC_OSM_EDIT_AUTHORIZED=false; PUBLIC_OSM_EDIT_EXECUTED=false; UPSTREAM_TOPOLOGY_FIXED=false — autorizare finală absentă, nicio editare.
- OSM_SOURCE_CANDIDATE_VALIDATED=false; OSM_SOURCE_PROMOTED=false — calificarea integrală/selecția și promovarea separată rămân deschise.
- OSM_FRESHNESS_PASS=false; ISSUE_396_RESOLVED=false — sursa acceptată din 5 octombrie este veche; pragul de 14 zile este neschimbat.
- ACTUAL_INTEGRITY_PASS=true; READY_FOR_UA_CV0=false — integritate confirmată, gate-urile sursei încă deschise.

PR #398 rămâne OPEN/Draft; Issue #396 OPEN. Nu se creează alias ACTUAL pentru succesiunea cartografică 18967907 → 21515245. Acceptarea acestui dosar tooling/evidence nu acceptă sursa OSM.

## Reproducere și rezultate negative

`node --test scripts/test/osm-fix4-*.test.mjs`

`node scripts/process/audit-osm-fix4-preflight.mjs`

Zece teste locale au trecut, inclusiv deschiderea unei limite vecine printr-o corecție aparent validă, lipsuri inverse HTTP200, versiuni contradictorii, geometrie autointersectată și interdicția autoaprobării. Workflow-ul dedicat regenerează raportul offline și impune diff gol. CI pe commitul publicat trebuie verificat separat; niciun rezultat viitor nu este declarat aici.

La colectarea nepublicată, parserul experimental a presupus greșit `elements` în locul obiectului `changeset`, respectiv `discussion` în loc de `comments`. Originalele deja descărcate au fost reinterpretate offline; extragerile inițiale goale sunt păstrate separat în gzip. Testele resping acum extragerea goală/ambiguă și discuția incompletă. Nu a fost un defect al datelor OSM și nu s-au repetat cererile pentru a ascunde eroarea.
