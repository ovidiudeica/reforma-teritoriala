# OSM-FIX.2 — transport Geofabrik calificat, selecție încă blocată

Această lucrare este source-only și read-only. Nu promovează un manifest, nu modifică ACTUAL și nu acceptă semantic NI-JUR. Captura integrală a unui extras este distinctă de validarea selecției Overpass și de închiderea etapei. PR398 rămâne Draft/BLOCKED_SOURCE_TRANSITION.

## Originale capturate autentic

Pe21octombrie2026,23:32:04–23:33:15UTC au fost capturate secvențial două originale datate, fără Overpass și fără aliasul `latest`. Au fost verificate HTTP206 și Content-Range pentru prefix, ETag identic/If-Match la transferul integral, Content-Length, prefixul identic, MD5 publicat și SHA-256 calculat independent. MD5 este checksumul distribuitorului, nu o semnătură juridică sau o înlocuire a SHA-256.

| Original | Octeți | SHA-256 calculat local |
|---|---:|---|
| romania-261020.osm.pbf |331337543|426fa4124f784d33001395804fbcca526329c18abd2dd39a7204f67bf3c9966a|
| moldova-261020.osm.pbf |101391048|17288ab89aa7f07cfeefb35749a9d562127ffd74f9bae6ffc402af470fb4f18f|

Header-ele binare, decodate cu pyosmium4.3.2, au aceeași epocă reală `2026-10-20T20:23:47Z`, secvență de replicare4943 și URL-uri regionale proprii. Data accesării nu este substituită epocii. Au fost verificate versiunile/timestampurile obiectelor extrase: zero metadate invalide sau ulterioare epocii în domeniul replay-ului. Nicio actualizare incrementală nu a fost aplicată. Originalele PBF complete și raw-urile derivate rămân locale; aici sunt versionate numai recipisele, prefixele binare, rapoartele și hashurile, fără a pretinde că fișierele integrale au fost încărcate în GitHub.

## Completitudinea selecției nu este presupusă

Un recensământ al tuturor relațiilor din fiecare extras, urmat de filtrarea tagurilor proiectului, produce3646candidațiRO și2641candidațiMD. Limita extrasului include obiecte care nu au fost certificate ca aparținând selecției spațiale Overpass. Față de pinul istoric, rezultă413candidați suplimentariRO și57MD; cei57includ noua relație21515245. Cele12retrageriMD cunoscute sunt absente. Nu sunt inventate alte retrageri și nu este dedusă succesiune juridică.

Pentru întregul set de candidați și membrii săi referiți, extrasul RO lasă434relații,3549ways și234noduri lipsă; MD lasă380relații,963ways și68noduri lipsă. Aceste lipsuri de clip, inclusiv dependențe ale candidaților din afara domeniului, nu sunt falsificate drept defecte OSM și nu sunt ignorate. Cele două extrase nu sunt acceptate ca înlocuitor direct al inventarului Overpass.

Separat, verificarea strictă a **domeniului de referință** —3233ID-uri istoriceRO, respectiv2584ID-uri istoriceMD încă prezente plus21515245 — dovedește zero dependențe lipsă și zero coordonate invalide pentru3233/2585relații. RO are zero anomalii topologice; MD păstrează exact două, Horești și Buneți. Acesta este un diagnostic per-ID asupra domeniului cunoscut, nu un recensământ curent exhaustiv. Nu sunt excluși cei470candidați suplimentari pentru a obține PASS.

Următorul gate reparabil este demonstrarea selecției spațiale echivalente și adjudecarea individuală a candidaților suplimentari, folosind originale la aceeași epocă. O strategie hibridă trebuie să dovedească versiunea fiecărui obiect completat la cutoff, nu doar să combine răspunsuri actuale. Nu se promovează nicio sursă până atunci. Noul transport rezolvă disponibilitatea originalelor, nu aceste gate-uri.

## Cod, teste și limite

`scripts/process/capture-geofabrik-extracts.mjs YYYYMMDD` captează numai originale datate în `outputs/geofabrik-extracts/`. Nu scrie `data/sources/`, ACTUAL sau site-ul. `scripts/lib/geofabrik-acquisition.mjs` refuză checksum/fișier greșit, range ignorat, prefix parțial, ETag slab/schimbat, lungime greșită și transfer trunchiat. Păstrează recipisa eșecului și orice fragment; repetarea aceleiași capturi refuză suprascrierea înaintea unei noi cereri. `verifyExtractFile` rehashuiește un original existent fără o nouă descărcare. Acceptarea temporală și spațială rămâne explicit UNVERIFIED în rezultatul achiziției.

Regresiile acoperă HTTP429/502/503/504, timeout, întrerupere, date parțiale, placeholderANTIDDOS, SHA/checksum/header/size drift și conservarea recipiselor. RM035 documentează un defect al prototipului nepublicat: prima scriere a recipisei putea suprascrie încercarea anterioară. Contraexemplul original are19PASS/1FAIL; remedierea20PASS/0SKIP, înaintea publicării. Testul suplimentar verifică toate hashurile dovezilor înghețate și markerul de selecție blocată.

Workflow-ul nou rulează regresiile pe SHA exact. Achiziția de rețea necesită un dispatch explicit cu dată; nu se repetă automat cele433MB deja conservate și nu se lansează o captură Overpass identică. Workflow-urile și gate-urile existente nu sunt relaxate. O rundă veche de CI nu acceptă noul HEAD; proba completă a sursei rămâne nesatisfăcută.

Replay-ul local inițial a expirat după180secunde, fără rezultate. Este conservat distinct. A doua execuție, cu loguri pe faze și citirea headerului din prefixul binar salvat, a încheiat ambele țări. Nu este atribuită primei expirări o cauză nedemonstrată. Prototipul efectiv executat și logul său sunt păstrate pentru reproducere; nu este declarat un generator general acceptat sau un replay byte-identic executat de două ori.

## Topologie și protecții

Patru cereri oficiale batch/read-only au reverificat cele două relații, opt ways și patru noduri terminale: toate versiunile sunt neschimbate. Horești18967493/v6 și Buneți18968082/v7 rămân blocate upstream. Propunerile condiționate pentru mapper din dosarul precedent rămân valabile numai după verificarea intenției originale și autorizarea separată a editării publice. Nu s-a efectuat nicio editare OSM.

ACTUAL, părinții juridiciMD, host-trust și pragul de14zile rămân protejate. `actual_mutation_allowed=false`, `p91_import_allowed=false`, `semantic_acceptance=BLOCKED_INCOMPLETE`. Issue396 rămâneOPEN; NI-JUR0/1 au dependențe formale nesatisfăcute. Nicio observație PBF/OSM nu certifică jurisdicția juridică sau controlul efectiv.

Surse primare: [extras RO și politica metadatelor](https://download.geofabrik.de/europe/romania.html), [original RO datat](https://download.geofabrik.de/europe/romania-261020.osm.pbf), [original MD datat](https://download.geofabrik.de/europe/moldova-261020.osm.pbf), [Pyosmium — procesare și referințe](https://docs.osmcode.org/pyosmium/latest/user_manual/01-First-Steps/). ©OpenStreetMap contributors, ODbL.
