# NI-TREE.1 — arborele Nistreniei, implementare controlată

## Contract aprobat
- Nistrenia are șapte ramuri principale: Camenca, Rîbnița, Dubăsari, Grigoriopol, Slobozia, Tiraspol și Bender.
- Nodurile documentare „Dubăsari — oraș” și „Rîbnița — oraș” devin copii ai raioanelor respective, fără duplicare și fără modificarea modelului sursă 2023.
- Cele 85 de geometrii OSM vor fi asociate unităților în poziția administrativă documentată; nu se creează un al optulea subarbore „Geometrii OSM”.
- Cardul Nistrenia trebuie să prezinte numai Nistrenia; cardurile unităților proprii trebuie să trateze separat referințele OSM.
- Expandarea, selecția, afișarea propriului contur și navigarea URL rămân independente.
- Nu se introduc centre administrative în NI-TREE.1/2: asocierea centrelor este o etapă transversală viitoare pentru România, Moldova, Nistrenia și regiunile statistice.
- NI-TREE.2 va plasa Nistrenia **prima** sub Republica Moldova, înainte de Partea de Vest și Partea de Est; implicit, numai România și Moldova sunt rădăcini.
- ACTUAL este imuabil; P9.1 nu este autorizat; identitatea OSM nu certifică legal apartenența administrativă.

## Rezultate provizorii și excepții de identitate
Analiza inițială a celor 85 de resurse ACTUAL reutilizate a găsit **78** de corespondențe unice aplicate automat între numele documentar și gruparea OSM. Alte **7** sunt explicit parametrizate după examinare: **5** cazuri speciale de identificare și **2** orașe reparentate. Cele **5** necesită verificare distinctă:
- `osm-r1216706` Cremenciug: documentar sub Tiraspol, părinte geometric OSM Slobozia (contradicție cunoscută; nu se reparentă juridic).
- `osm-r19001619` Lunga: fără unitate documentară cu nume identic, statutul OSM de municipalitate diferă de interpretarea microdistrictului.
- `osm-r19015110` Camenca, `osm-r8289751` Slobozia, `osm-r9301464` Grigoriopol: numele raionului și al localității coincid; geometria orașului nu trebuie aplicată raionului.
- `osm-r9288287` Dubăsari și `osm-r9659979` Rîbnița: geometriile orașelor se asociază explicit nodurilor de oraș reparentate sub raioane, niciodată contururilor raionale.

Scriptul `scripts/audit/ni-tree1-associations.mjs` folosește exact asociatorul runtime și produce registrul per-ID în `outputs/ni-tree1/associations.json`. Identificatorii sunt referințe de prezentare către geometrii canonice, nu promovări juridice.

## Execuție curentă
Implementarea candidat reparentă cele două orașe exclusiv în obiectele de *prezentare*, sub raioanele lor, reducând numărul de copii documentari direcți ai Nistreniei de la 9 la 7. Ea distribuie toate cele 85 de referințe OSM în nodurile lor documentare (84 de noduri în total; Bender are două roluri OSM) și păstrează doar Lunga ca frunză de referință, nu ca unitate administrativă. Cardul rădăcinii nu mai listează geometriile copiilor. Modelul original rămâne intact.

**PR-ul rămâne Draft și nu trebuie integrat până la rezolvarea restului:**
1. Verificarea CI a repartizării celor 85 de geometrii, inclusiv a celor 7 reguli explicite; comparație cromatică și topologică fără atribuire juridică nouă.
2. Inspecția vizuală a cardului rădăcinii limitat la datele Nistreniei.
3. Teste automate exhaustive pentru 242 de noduri, 85 de referințe, integritate părinte–copil, selecții, filtre, URL și desktop/mobil.
4. Toate gate-urile CI reușite pe SHA exact și verificarea post-merge.
5. Abia apoi NI-TREE.2 într-un PR separat, fără editarea ACTUAL.

**Status:** implementare parțială, neintegrată; fără autorizarea NI-TREE.2 înainte de NI-TREE.1 acceptat.
