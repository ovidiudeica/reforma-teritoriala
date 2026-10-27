# OSM-FIX.5 — tranziții actuale, reutilizare verificabilă și sursă blocată

Bază: `main@afb190ab29c0b87526f9065e95159176c1630049`. Domeniu exclusiv tooling/evidence. #398 rămâne Draft, cu conflicte, pe `027d66f6f08296fd9006938a010f8e18265aca36`; nu este integrat sau închis. #396 rămâne OPEN. WEB-NI-U1 și NI-FIN rămân acceptate; nu se redeschid lucrările lor.

## Ce s-a executat

57 GET-uri oficiale limitate: 12 HTTP410 și 45 HTTP200, fără erori. Sunt recitite individual cele 13 tranziții și istoricele lor, cele două grafuri țintă, toate utilizările inverse din domeniul OSM-FIX.4, cele șapte geometrii vecine, discuția changesetului și graful relației noi. Nu este o captură atomică/globală RO/MD. Originalele au fost hash-uite efectiv în spațiul privat de captură; în repository sunt numai reprezentările sanitizate și receipturile. Metadatele contributorilor și textele brute ale discuției nu sunt republicate. Captura inițială de 56 cereri și completarea de o cerere sunt păstrate distinct în `sources/`.

Toate cele **29 de răspunsuri topologice/inverse** sunt semantic identice cu OSM-FIX.4, inclusiv versiunile, coordonatele, membrii și ordinea referințelor. Cele trei comentarii sunt neschimbate după hash/date. Prin urmare, simulările individuale și combinată sunt **reutilizate**, nu relansate: închid cele două relații în copia izolată și păstrează rezultatele celor șapte vecini. Acesta nu este un upload și nu califică sursa globală. `mapper-intent-status.json` păstrează `MAPPER_INTENT_UNRESOLVED` pentru ambele obiecte.

## Remedierea tehnică RM-053

Prima probă negativă a capturii a demonstrat că verificarea plafonului numai înaintea primului apel permitea, la 79 cereri și HTTP429, și cererea 81. Bugetul de cereri și deadline-ul global sunt acum verificate **înaintea fiecărui retry**. Plafonul rămâne 80, cel mult două încercări per URL, maximum 180 secunde, fără redirecturi sau upload. `Retry-After` mai mare de zece secunde nu este urmat. Testul eșuat inițial și lotul corectat sunt conservate separat în gzip; eșecul nu este convertit în PASS. Lotul inițial de cinci teste corectate este conservat în log; suita curentă are șase teste Python, inclusiv expirarea deadline-ului în timpul backoff-ului. Toate folosesc transport simulat, fără rețea.

Noul gate de reutilizare respinge un witness absent, versiuni/coordonate contradictorii și driftul dependențelor chiar dacă versiunile celor două ways nu s-au schimbat. Istoricele trebuie să fie consecutive, să corespundă epocii acceptate și payloadului pinuit. HTTP410 fără istoric terminal invizibil nu demonstrează automat retragerea.

## Remedierea tehnică RM-054

O probă negativă suplimentară a demonstrat că graful `/full` al relației noi putea avea o versiune a rădăcinii diferită de răspunsul curent/istoric. Validatorul compară acum explicit versiunea, timestampul, changesetul, vizibilitatea, tagurile și membrii rădăcinii înainte de evaluarea geometriei. Logurile înainte/după sunt conservate în `sources/full-root-*.log.gz`; sursa reală nu avea această contradicție.

## Deficitul net de 11 și limitele inventarului din 18 octombrie

Registrul per-ID este `source-transition-register.json`: 12 retrageri demonstrate și adăugarea `21515245`, cu versiuni, changeseturi, CUATM, timestampuri și hashuri individuale.

| Relație retrasă | Nume istoric |
|---|---|
| 18966859 | Bogăția Lacului |
| 18966939 | Grădina-Rai |
| 18967312 | Mesteacănul Alb |
| 18967475 | Struguraș |
| 18967641 | Novinca-Eco |
| 18967824 | Automobilist |
| 18967907 | Boierul-Com |
| 18967934 | Pomsuragro |
| 18968041 | Aluniș-Com |
| 18968051 | Romănița-Agro |
| 18968093 | Relief-Prim |
| 18968144 | Sveazist IL |

`2596 - 12 + 1 = 2585`; nu există o listă onestă de „11 obiecte șterse”. Masterul din logurile refresh-ului este 5830→5819; referința Geofabrik selectată este 5818. Manifestul acceptat selectează RO3233/MD2596, iar ACTUAL are 5848 identități. Aceste domenii nu sunt forțate să fie identice.

API-ul run-ului **39113587430 nu oferă artefacte**. Tranzițiile sunt demonstrate prin istorice și observații oficiale, dar nu s-au recuperat octeții originali ai candidatului din 18 octombrie. Dovezile din 20/25/27 octombrie nu sunt prezentate drept replay direct al acelui candidat. Din acest motiv, verdictul strict `OSM_11_MISSING_MD_RECONCILED` rămâne false pentru reconstrucția exactă cerută; reconcilierea aritmetică și cele 13 tranziții au probe individuale. Apariția unui cache autentic poate închide această limită probatorie.

`18967907 → 21515245`: CUATM, changesetul și timestampul comun susțin legătura cartografică, nu succesiunea juridică. Graful curent al noii relații are dependențele prezente și geometrie validă în domeniul său. Comparația geometrică istorică din OSM-FIX.3 rămâne separată. Nu se creează alias ACTUAL.

## Alternative evaluate

| Cale | Rezultat și impediment |
|---|---|
| API oficial actual | Originale actuale și grafuri locale verificate; cele două discontinuități rămân. Observațiile per-ID nu sunt un snapshot global atomic. |
| Snapshot istoric în ultimele 14 zile | Conectivitatea prin ID a relației Horești și a tuturor ways membre este neschimbată din **8 ianuarie 2026**; pentru Buneți, din **10 aprilie 2026**. Ambele preced fereastra de prospețime a capturii. Un timestamp din ultimele 14 zile nu evită aceste configurații defecte. Witnessurile per-obiect sunt în raportul topologic; nu este dedus control juridic din geometrie. |
| Geofabrik 20 octombrie | Ambele PBF originale există local și au lungimile cunoscute, cu receipturi SHA istorice. Nu au fost redescărcate sau rehashuite gratuit. Selecția exhaustivă/echivalența ariilor și topologia nu sunt acceptate. |
| Full-history + 45 diff-uri | Originalul de 163.893.678.040 octeți există; se reutilizează receipturile anterioare, fără recitire concurentă. Lacunele și calificarea temporală/globală rămân deschise. Raportul unui lot cu 63 istorice/393 versiuni lipsă este **un subset**, nu înlocuiește registrul global cunoscut de 159/641. |
| Overpass / transport fragmentat din #398 | Remedierile RM-050/RM-051 sunt deja integrate prin #447; nu sunt duplicate. Timeouturile conservate și selecția necertificată nu sunt reparate printr-o nouă captură identică. Transportul nu poate transforma conectivitatea autentică defectă în sursă validă. |
| Substituții locale de noduri | Simulare condițională, nu original OSM și nu sursă eligibilă. Ar ascunde defectul dacă ar fi prezentată drept captură oficială. Respinsă ca rută de promovare. |

Arhitectura propusă în #398 păstrează distincte `data/sources/osm-current.json` și `data/sources/osm-source-current.json`. Nu activăm un manifest „current” pretins complet din cele 57 răspunsuri. Pinul ACTUAL nu este schimbat. Infrastructura încă unică din #398 — politica de tranziții, staging-ul complet și gate-urile source-only — necesită reconciliere separată cu main și candidat acceptabil. Acest PR nu supersedează întregul #398.

## Regenerare și acceptare

```sh
node scripts/audit/osm-fix5.mjs --check
node --test scripts/test/osm-fix5-*.test.mjs
python3 scripts/test/osm_fix5_capture_test.py
```

Fără `--check`, generatorul scrie numai registrele acestui dosar și manifestul propriu. Nu citește PBF-ul masiv, nu promovează sursa și nu contactează OSM. Captura separată `scripts/audit/osm-fix5-capture.py` este o operațiune GET limitată care creează un director privat nou în outputs; nu suprascrie dovezile înghețate. Schimbarea vreunui witness cere analiză, nu simpla schimbare a verdictului.

Manifestele OSM-FIX.3/4 sunt verificate integral înainte de reutilizare. Cele 32 de componente ACTUAL sunt rehashuite de generator: RO3246/MD2602/5848, SHA semantic `a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446`. NI-FIN și WEB-NI-U1 rămân funcționale și închise; CUATM, părinții MD și geometriile sunt nemodificate.

CI pe noul HEAD și auditul post-merge trebuie înregistrate în atestarea PR-ului; nu sunt declarate anticipat. Monitorul real **40489594798** rămâne FAILURE/STALE pe sursa din 5 octombrie, prag 14 zile. `ALL_CI_PASS=false` la nivelul proiectului; succesul unui job documentar nu schimbă starea sursei.

## Decizie de promovare

**Nu există încă un candidat complet eligibil.** Gate-urile de selecție, topologie, temporalitate/proveniență și atomicitate rămân neîndeplinite. Nu se solicită acum o aprobare prematură de promovare și nu se fabrică SHA-uri ale unui candidat inexistent. Blocajele individuale, dovezile și operațiunile permise sunt în `remaining-blockers.json` și `promotion-readiness.json`.

Sunt distincte: (1) confirmarea mapperului și autorizarea exactă a unei eventuale intervenții OSM, **neacordate și neexecutate aici**; (2) calificarea completă a unei surse reale; (3) autorizarea separată a promovării protejate. Prima nu le implică pe celelalte. #396 se poate închide numai după promovare autentică și freshness PASS real. P9.1 și READY_FOR_UA_CV0 rămân false.

© OpenStreetMap contributors, ODbL. API oficial: https://api.openstreetmap.org/api/0.6/. Datele cartografice nu constituie atribuire juridică.
