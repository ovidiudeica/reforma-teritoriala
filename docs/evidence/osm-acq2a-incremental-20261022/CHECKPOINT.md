# OSM-ACQ.2a — checkpoint incremental, evidence-only

## Rezultat verificat

Registrul inițial conține 393 de poziții RO/MD, dar **391 de ID-uri distincte**. ID-urile 72526 și 72634 sunt UNKNOWN în ambele domenii. Nu se forțează un total de 393 de identități.

```text
UNKNOWN_INITIAL_DOMAIN_ROWS=393
UNKNOWN_INITIAL_DISTINCT_IDS=391
UNKNOWN_RESOLVED=15
UNKNOWN_REMAINING_DISTINCT_IDS=376
IN_SCOPE_PROVEN_NEW=0
OUT_OF_SCOPE_PROVEN_NEW=15
OTHER_RESOLVED_NEW=0
UNKNOWN_REMAINING_DOMAIN_ROWS=378
```

ID-urile adjudecate: 12593949, 18966787, 18966819, 18966826, 18967034, 18967055, 18967106, 18967153, 18967190, 18967254, 18967290, 18967898, 18968037, 19045259, 20181255.

Cele 15 excluderi privesc exclusiv predicatul spațial la epoca **2026-10-20T20:23:47Z**, nu eligibilitatea juridică, inventarul OSM viu sau acceptarea globală a sursei. Distanța minimă observată față de poligonul domeniului este 0.00036277091782084396 grade de coordonate (nu metri, nu prag ales). Nu s-a folosit buffer, snapping sau reparare geometrică.

## Metodă și delimitare

S-au verificat hashurile gzip și ale corpurilor decomprimate ale celor două grafuri derivate; raportul local a fost comparat semantic cu raportul pinuit pe PR #398. Cele două extrase au aceeași epocă. Obiectele comune trebuie să fie identice integral, inclusiv versiune, timestamp, membri/taguri/coordonate. Duplicate interne, obiecte fără versiune/timestamp și conflicte sunt respinse.

Uniunea strictă a indexurilor existente completează geometria directă pentru 131 de poziții (88 RO, 43 MD), fără conflicte. Dintre acestea, numai 15 sunt excluse conservator: geometrie directă completă, fără membru direct node/way în interior, cu separare strict pozitivă de poligonul de țară neschimbat. Alte **116 ating frontiera** și rămân UNKNOWN_INSUFFICIENT_SPATIAL_EVIDENCE. **262 de poziții / 260 de ID-uri distincte** rămân UNKNOWN_MISSING_DEPENDENCIES. Cazurile cu martori parțiali nu sunt numărate ca rezolvate.

Nu s-a demonstrat echivalența dintre poligoanele PBF și cache-ul de arii Overpass. Rezultatele sunt probe independente pentru epoca înghețată. SOURCE_SELECTION_QUALIFICATION rămâne neacordată, SOURCE_PROMOTED=false și OSM-FIX.2 rămâne BLOCKED_SOURCE_TRANSITION. Cele 5.894 de poziții anterior ne-UNKNOWN au fost lăsate nemodificate; nu sunt recertificate de acest audit.

## Reconcilierea numerică

- RO: 3233 ID-uri istorice, 3646 candidați după taguri; 413 candidați absenți din inventarul istoric și 0 ID-uri istorice absente din candidați. Distribuția anterioară: {"EXPLICIT_QUERY_MEMBER":1,"NO_INTERIOR_WITNESS_COMPLETE_DIRECT_GEOMETRY":75,"PROPER_INTERIOR_WITNESS":3233,"UNKNOWN_MISSING_DIRECT_GEOMETRY":337}.
- MD: 2596 ID-uri istorice, 2641 candidați după taguri; 57 candidați absenți din inventarul istoric și 12 ID-uri istorice absente din candidați. Distribuția anterioară: {"EXPLICIT_QUERY_MEMBER":10,"PROPER_INTERIOR_WITNESS":2575,"UNKNOWN_MISSING_DIRECT_GEOMETRY":56}.

MD: 2.596 istorice − 12 retrase + 1 nouă = 2.585 în referința curentă; 2.641 − 2.585 = 56 diferență numerică, distinctă de cei 57 candidați absenți din pinul istoric. Retragerile nu sunt adjudecate din absența în extras. Relația nouă 21515245 nu este o succesiune juridică demonstrată. Cele 393 de poziții UNKNOWN nu reprezintă întregul set al candidaților suplimentari.

## Reproducere și teste

14 teste locale PASS; regenerare byte-identică PASS; arhiva derivată se decomprimă byte-identic în registry-final.json. Testele acoperă versiuni, duplicate, epoci/hashuri corupte, lipsa nodurilor/way-urilor, interdicția de a inventa segmente, frontiere, găuri, martori parțiali și serializare deterministă. Nu s-au executat GitHub Actions, A/B, CodeQL sau Chromium în această sesiune; nu există afirmație nouă de CI PASS. Logurile originale Windows rămân local; exemplarele text din branch folosesc LF, cu hashuri proprii în manifest, pentru a trece git diff --check fără a rescrie logurile originale.

Din directorul original al sarcinii, cu runtime-ul GIS deja instalat:

```powershell
node work/run-gis-python.cjs work/test_acq2a_audit.py
node work/run-gis-python.cjs work/acq2a_audit.py --verify
```

Sursele de intrare sunt în directorul indicat de work/current-osm-resume-20261022.txt, sub extract-replay-v2 și spatial-diagnostic. Scripturile exacte sunt conservate alături de raport. Niciun PBF nu a fost redescarcat sau rehashuit; nu s-a recalculat manifestul istoric de 11,84 GB.

## Următorii candidați

Cele șase poziții cu dependențe recuperate parțial, încă incomplete:

- RO / 72526: 108 dependențe directe cunoscute rămân lipsă.
- RO / 72634: 43 dependențe directe cunoscute rămân lipsă.
- MD / 72526: 108 dependențe directe cunoscute rămân lipsă.
- MD / 72634: 43 dependențe directe cunoscute rămân lipsă.
- MD / 11821462: 24 dependențe directe cunoscute rămân lipsă.
- MD / 11905201: 24 dependențe directe cunoscute rămân lipsă.

Lista exactă a nodurilor/way-urilor lipsă este în missing_after, pe fiecare domeniu, în registru. Întâi căutați aceste obiecte în indexuri deja autentificate; o completare externă trebuie să demonstreze versiunea la epoca țintă. Pentru cele 116 contacte de frontieră este necesară reproducerea semanticii exacte Overpass, fără toleranță arbitrară și fără confundarea cache-ului actual cu snapshotul PBF.

## Încercări și limite conservate

Inspecția inițială a scris corect JSON UTF-8, apoi afișarea consolei a eșuat din cauza codării cp1252; fișierul nu a fost corupt. O comandă de afișare Node inline a eșuat la quoting, fără a procesa sau modifica probe. Registrele registry.json și registry-v2.json sunt versiuni exploratorii supersedate, păstrate local: etichetau 131 de rezultate ale predicatului geometric. Controlul suplimentar al separării a oprit ambalarea și a identificat cele 116 contacte de frontieră. Numai registry-final.json / registry.json.gz conțin cele **15 verdicte finale conservatoare**. Acest control este acum test de regresie. Niciun rezultat exploratoriu nu a fost publicat drept acceptare de sursă.

## GitHub și protecții

Audit live scurt: main=85e9cdd547594be53ad8f2070411eb31b8962011; PR #398=027d66f6f08296fd9006938a010f8e18265aca36; PR #394=d1687be8df336635411664c9027ca8cdfa46dc09; PR #402=7376491b2664e060ee647e1474d89c82ef1600a4. Cele trei PR-uri rămân Draft. Issue #396 OPEN.

Branch local separat: audit/osm-acq2a-incremental-selection, bazat pe main de mai sus. Fără push sau PR nou, pentru a nu declanșa CI disproporționat. Numai instrumente de audit și probe derivate; niciun fișier ACTUAL modificat. Nu s-a executat un nou recensământ integral ACTUAL: valorile 3246/2602/5848 și fingerprintul protejat sunt contractul existent, nu rezultate noi ale auditului. P9.1 rămâne blocat, semantic_acceptance=BLOCKED_INCOMPLETE; OSM public, host-trust, pragul de prospețime și gate-urile nu au fost modificate. Nicio sursă promovată, nicio integrare efectuată.
