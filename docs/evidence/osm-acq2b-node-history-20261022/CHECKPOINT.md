# OSM-ACQ.2b — dependențe completate prin istorice oficiale de noduri

## Rezultat independent

Au fost recuperate **14 noduri** pentru 14 relații cu o singură dependență lipsă. Toate cele 14 relații au rezultat **OUT_OF_SCOPE_PROVEN pentru predicatul spațial PBF înghețat**. Împreună cu OSM-ACQ.2a și proba exactă de frontieră: **145 adjudecate, 246 ID-uri distincte UNKNOWN rămase**, din 391. Rămân 248 poziții RO/MD, datorită celor două ID-uri comune.

ID-urile noi: 1025098, 1026139, 1456963, 1463578, 5925794, 8133065, 8133067, 9814686, 9864423, 9864742, 12299982, 12643864, 12643902, 12643916.

Nu este o certificare a selecției curente Overpass sau a jurisdicțiilor. OSM-FIX.2 rămâne blocată; source_promoted=false și overpass_equivalence_certified=false. Corpusul ACTUAL nu se modifică.

## Proveniență și coerență temporală

Sursa este API-ul oficial OpenStreetMap, exclusiv citire, pe nodurile individuale. Cele 28 răspunsuri originale însumează 263051 octeți; nu s-au descărcat PBF-uri sau extrase masive. Originalele brute, URL-urile, headerele HTTP, datele serverului și SHA-256 sunt păstrate în capture.json/capture-batch2.json și fișierele .response. Date OSM: contribuțiile OpenStreetMap, ODbL; sursa https://www.openstreetmap.org/copyright.

Pentru fiecare nod se verifică istoricul continuu al versiunilor, fără goluri/duplicări, cronologia timestampurilor, versiunea maximă cu timestamp <= **2026-10-20T20:23:47Z** și următoarea tranziție, dacă există. Ultima versiune din istoric trebuie să coincidă integral cu observația curentă. Data HTTP a observației trebuie să fie ulterioară epocii țintă. Obiectele șterse/redactate, identitățile amestecate, coordonatele în afara grilei și istoricele incomplete sunt refuzate. Simpla existență a unui timestamp vechi nu este considerată suficientă.

Reconstituirea folosește numai versiunea istorică dovedită. Restul grafului rămâne cel autentificat din cele două PBF-uri la aceeași epocă. Replay-ul verifică hashurile originalelor și versiunile relațiilor; după completare nu există dependențe directe lipsă în cele 14 cazuri. Testul spațial exact folosește metoda întreagă/rațională deja conservată, fără snapping, buffer sau ajustarea conturului.

## Teste și reproducere

**7 teste ale istoricelor PASS**, în plus față de cele 15 teste spațiale exacte ale fazei precedente; 22 teste distincte relevante în total, nu un CI nou. Replay-ul lotului de 14 s-a regenerat byte-identic. Logurile sunt păstrate. Nu s-au rerulat workflow-uri și nu se declară CI PASS pentru codul acestei rafinări.

```powershell
node work/run-gis-python.cjs work/test_acq2b_history.py
node work/run-gis-python.cjs work/acq2b-node-replay.py --batch2 --verify
```

Replay delta SHA-256: c1ae350f54e746286c76652548bad9dd818728df0ddf8710e11d5137c5b85f5d.
Registru combinat decomprimat SHA-256: 35370c740668f7c932fcf1ff6bf20ab8d12379a5a99d50883030c310dbaf1be4.
Registru combinat gzip SHA-256: db971c48527bb81bf816b7c631917ee39a1f96b5cf03837db7a1419cc67605e1.

## Limite și continuare

Cele patru ID-uri prioritare 72526, 72634, 11821462 și 11905201 rămân incomplete; completarea nodurilor altor relații nu se contabilizează drept rezolvarea lor. Restul de 246 ID-uri rămâne UNKNOWN. Următoarea etapă trebuie să deduplice dependențele lipsă după aplicarea acestor 14 noduri înainte de alte cereri.

ACTUAL, părinții MD, componentele protejate, host-trust, prospețimea și gate-urile rămân nemodificate. P9.1 blocat; Issue #396 păstrat OPEN; OSM public nemodificat; fără atribuiri juridice. PR #398/#394/#402/#406 nu se modifică și nu se face merge. Originalele și checkpoint-urile precedente sunt păstrate distinct.
