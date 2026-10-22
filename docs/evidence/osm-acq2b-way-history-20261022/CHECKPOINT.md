# OSM-ACQ.2b — patru way-uri și nodurile lor istorice

## Rezultat

Relațiile **1025109, 1026160, 1026178, 1026196** au dependențele directe completate autentic și verdict OUT_OF_SCOPE_PROVEN pentru predicatul spațial înghețat. Total cumulativ: **149 adjudecate și 242 ID-uri distincte UNKNOWN rămase**, din 391. Rămân 244 poziții RO/MD, deoarece cele două ID-uri comune nu sunt rezolvate.

Nu se certifică echivalența cu aria/cache-ul Overpass și nu se promovează sursa. Nu sunt atribuiri administrative sau juridice. PR #406 nu este modificat.

## Achiziție limitată și coerență temporală

Au fost verificate patru istorice de way și observațiile lor curente. Două relații au putut fi reconstituite cu nodurile deja locale; celelalte două necesitau 24 de noduri, recuperate secvențial prin istorice și observații curente, cu pauză de 250 ms înaintea fiecărei cereri. Nu s-au descărcat PBF-uri sau extrase noi. Originalele celor 24 de noduri noi însumează 21804 octeți.

Pentru fiecare obiect se demonstrează versiunea la **2026-10-20T20:23:47Z**: istoric continuu, fără goluri/duplicări, cronologie validă, selectarea ultimei versiuni la sau înaintea epocii și limita următoarei tranziții. Ultima versiune din istoric trebuie să coincidă cu observația curentă, inclusiv ordinea membrilor unui way. Ordinea tagurilor nu este semantică și este normalizată pentru comparație. Datele HTTP trebuie să fie ulterioare epocii, iar originalele sunt verificate prin SHA-256. Simpla vechime a timestampului nu este folosită singură drept probă.

capture.json și fișierele way-*.response conservă cele opt originale ale way-urilor. capture-waynodes.json include toate cele 38 de noduri deja probate: primele 14 originale se află în dosarul anterior osm-acq2b-node-history-20261022, iar cele 24 de originale noi se află aici. Nu se duplică inutil cele 14 originale anterioare. Date OSM: contribuțiile OpenStreetMap, ODbL, https://www.openstreetmap.org/copyright.

replay.json este proba intermediară (două relații complete, două încă incomplete). **replay-complete.json** este rezultatul final al celor patru cazuri; nu se confundă cele două stadii. Replay-ul final verifică toate hashurile originalelor și refolosește numai obiecte coerente temporal cu PBF-ul, fără snapping sau segmente inventate.

## Verificări

**8 teste ale istoricelor de nod și 5 teste ale istoricelor de way PASS**, inclusiv păstrarea ordinii nd, independența ordinii tagurilor, goluri, ștergeri, identități mixte și tranziții după epoca țintă. Metoda geometrică exactă are cele 15 teste PASS din faza precedentă. Replay-ul celor patru cazuri a fost regenerat byte-identic. Nu s-a rulat CI pentru această rafinare și nu se declară CI PASS.

```powershell
node work/run-gis-python.cjs work/acq2b-way-replay.py --verify
```

Delta finală SHA-256: 2a239525c7e99d284125639c3e93e59ecfa198d3af65d40434aaa20ef557379e.
Registru combinat decomprimat SHA-256: 1a7500f36d24bf75193038ffa3cf36443a4ce60de6c859113f8c8ba941d6999b.
Registru combinat gzip SHA-256: f893c3ba01fc870be5dfedb72381d47367ae4cdcacd0093fd56270a547bc36dd.

## Protecții și restanțe

ACTUAL, cele 32 de componente și părinții MD nemodificați; P9.1 blocat; Issue #396 păstrat OPEN; OSM public nemodificat. Nicio schimbare a pragurilor, host-trust sau gate-urilor și niciun merge. Cele patru ID-uri prioritare 72526, 72634, 11821462 și 11905201 rămân UNKNOWN cu lipsuri distincte. Progresul prezent nu se contabilizează drept rezolvarea lor.
