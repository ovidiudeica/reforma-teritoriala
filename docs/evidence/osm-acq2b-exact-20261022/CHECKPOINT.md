# OSM-ACQ.2b — rafinare exactă independentă a contactelor de frontieră

## Rezultat

116 ID-uri anterior UNKNOWN_INSUFFICIENT_SPATIAL_EVIDENCE au fost evaluate cu aritmetică exactă pe grila OSM și au verdict **OUT_OF_SCOPE_PROVEN pentru predicatul spațial înghețat**, fără martori de interior. Împreună cu cele 15 rezultate OSM-ACQ.2a: **131 adjudecate, 260 ID-uri distincte UNKNOWN rămase**, din 391. Există 262 poziții RO/MD rămase, deoarece 72526 și 72634 apar în ambele domenii.

Acesta este un raport independent de rafinare, nu o schimbare a criteriilor de promovare a sursei. **Nu certifică echivalența ariilor Overpass, nu promovează sursa și nu închide OSM-FIX.2.** Registrul și commitul PR #406 rămân neschimbate.

## Metodă și probe

Coordonatele se convertesc exact în întregi la scara 10^7 numai dacă reprezentarea zecimală existentă este exact pe grila OSM. În caz contrar auditul se oprește; nu se rotunjește și nu se aplică snapping. Inelele țării se reasamblează după identitatea nodurilor, fără segmente inventate. Orientările, intersecțiile, suprapunerile coliniare și parametrii de tăiere se calculează prin întregi și fracții raționale. Fiecare interval al unui segment despărțit la intersecțiile cu frontiera este verificat printr-un martor rațional și ray crossing par/impar, inclusiv găuri și poligoane disjuncte.

STRtree/GEOS este folosit numai pentru supraselecția conservatoare de bounding box-uri întregi; nu produce verdictul final de interior. Pentru punctele raționale, cutia razei este lărgită conservator cu floor/ceil pe grila întreagă. Nu există buffer/toleranță de includere. Un nod lipsă întrerupe segmentul; nu este permisă unirea artificială a vecinilor săi.

Probele de intrare sunt aceleași grafuri autentificate RO/MD și epoca **2026-10-20T20:23:47Z**. SHA-urile gzip/corp sunt verificate și legate de registrul părinte. Obiectele comune trebuie să fie identice ca versiune, timestamp și conținut. Hashurile frontierelor, ale obiectelor folosite și rezultatele pe fiecare ID sunt în boundary-registry.json. combined-registry.json.gz conține registrul derivat complet, nu o suprascriere a părintelui.

Registru părinte: 833a25a36d4251c022ed84853207e90a71771498f4bd99c4189e901aacdd539e.
Delta exactă SHA-256: a775f48b446734788a70f15d69de6fda3d0d9dff34065a1c83e58290ae9071f8.
Registru combinat, corp decomprimat SHA-256: 35646858cc449666f99625b01455febf334e0ee867bc1f671b8d74f76efeaa85.
Registru combinat gzip SHA-256: ad2d2742dc0010803c8a44d596be99b8e214d6930b5c44adc2dd7bad92834973.

## Verificare și limite

15 teste locale PASS: intersecții fără vertex interior, colțuri, suprapuneri de frontieră, găuri, poligoane disjuncte, coordonate raționale foarte apropiate de frontieră, refuzul snapping-ului, reversibilitate și geometrie incompletă. Regenerarea byte-identică a deltei este verificată prin comanda --verify; logul se conservă separat. Nu s-au descărcat PBF-uri sau obiecte noi, nu s-au relansat workflow-uri și nu s-a executat CI pentru această rafinare.

Din directorul original al sarcinii:

```powershell
node work/run-gis-python.cjs work/test_acq2b_exact.py
node work/run-gis-python.cjs work/acq2b_exact.py --verify
```

Cele patru ID-uri prioritare 72526, 72634, 11821462 și 11905201 rămân UNKNOWN_MISSING_DEPENDENCIES. Indexurile RO/MD existente au fost deja construite prin scanarea integrală a originalelor PBF; repetarea aceleiași scanări nu justifică o nouă captură și nu demonstrează recuperarea obiectelor lipsă. Lipsurile lor per-ID sunt în checkpoint-ul OSM-ACQ.2a publicat. O completare externă necesită dovada versiunii la epoca țintă.

ACTUAL, cele 32 de componente, părinții MD, host-trust, prospețimea și gate-urile sunt nemodificate. P9.1 blocat, Issue #396 OPEN, OSM public nemodificat. Nicio apartenență administrativă/juridică nu este dedusă din aceste rezultate. Nu se face merge și nu se modifică PR #398/#394/#402/#406.
