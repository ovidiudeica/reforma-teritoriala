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
Analiza inițială a celor 85 de resurse ACTUAL reutilizate a găsit **80** de corespondențe unice între numele documentar și gruparea OSM. Celelalte **5** necesită verificare distinctă:
- `osm-r1216706` Cremenciug: documentar sub Tiraspol, părinte geometric OSM Slobozia (contradicție cunoscută; nu se reparentă juridic).
- `osm-r19001619` Lunga: fără unitate documentară cu nume identic, statutul OSM de municipalitate diferă de interpretarea microdistrictului.
- `osm-r19015110` Camenca, `osm-r8289751` Slobozia, `osm-r9301464` Grigoriopol: numele raionului și al localității coincid; geometria orașului nu trebuie aplicată raionului.

Scriptul `scripts/audit/ni-tree1-associations.mjs` produce un registru local în `outputs/ni-tree1/associations.json`; valoarea `selected_node_id` este doar propunere de asociere geometrică, nu promovare juridică.

## Execuție curentă
Primul commit funcțional reparentă cele două orașe exclusiv în obiectele de *prezentare*, sub raioanele lor, reducând numărul de copii documentari direcți ai Nistreniei de la 9 la 7. Modelul original rămâne intact.

**PR-ul rămâne Draft și nu trebuie integrat până la rezolvarea restului:**
1. Asocierea celor 85 de geometrii fără subarbore cartografic separat, cu revizuirea celor 5 cazuri speciale.
2. Cardul rădăcinii limitat la datele Nistreniei, nu lista subunităților.
3. Teste automate exhaustive pentru 242 de noduri, 85 de referințe, integritate părinte–copil, selecții, filtre, URL și desktop/mobil.
4. Toate gate-urile CI reușite pe SHA exact și verificarea post-merge.
5. Abia apoi NI-TREE.2 într-un PR separat, fără editarea ACTUAL.

**Status:** implementare parțială, neintegrată; fără autorizarea NI-TREE.2 înainte de NI-TREE.1 acceptat.
