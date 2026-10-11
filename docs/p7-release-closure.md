# P7 — arhitectură și registrul acceptării finale

Obiectiv: atlas RO+MD modern, coerent, accesibil, performant și modular, fără schimbarea identităților, corpusurilor, geometriilor EPSG:4326 sau provenienței. Închiderea finală depinde de auditul post-merge P7.6; acest registru nu înlocuiește dovezile pe SHA exact.

| Etapă | PR | Commit integrat / situație |
| --- | --- | --- |
| P7.0 audit și arhitectură | #283 | 6f36df65e2ffa183711ad5383944c87f713dd038 |
| P7.1 preview responsive | #284 | 031386aae920949f6e7ba35e18e24b1a60293c40 |
| P7.2 navigare și panouri | #285,#286,#287 | c64c20e24200cc46b35349c141bdd7d41f133ae2, închis după hotfixuri |
| P7.3 arbore virtualizat | #288 | 19e03f3579b89d6c804a54b43fe26481ee9792e1 |
| P7.4 conținut și distribuire | #289 | 9d53cf89fa47582c65125276e841c35876811a2c |
| P7.5 module și comenzi | #290 | aa723c21bc4c4292ba4b44b5e273c3944adac96c |
| P7.6 audit și remedieri finale | PR al branchului web/p7.6-final-acceptance | dovezile finale și SHA-ul integrat sunt publicate în descrierea PR după auditul post-merge |

## Decizii și refactorizări

Aplicație statică ES modules, o singură instanță Leaflet, fără framework sau backend nou. app.js rămâne composition root. atlas-layout este sursa dimensiunilor logice comune CSS/JavaScript; previewul supradimensionat se deplasează la1:1, fără afectarea URL-ului semantic. Explorer-shell rezervă navigare/panou/card; atlas-panels centralizează rutele, Escape, origine și revenire focus, overlay/inert. atlas-panel-content consolidează căutare, rezultate, filtre, avansat, informații și Share.

Arborele folosește ierarhia validată, un model pur de ferestre/prefixuri, overscan și măsurare a rândurilor variabile; maximum două rânduri de focus/selecție pot rămâne montate suplimentar. Extinderea, selecția și checkboxul sunt independente. Metadatele rămân în carduri; fallbackul pentru numele gol nu schimbă corpusul. Randarea nu mai materializează5848rânduri și26248noduri după extindere completă. Benchmarkurile istorice locale sunt observații cu condiții documentate, nu scoruri universale.

Legenda și metodologia sunt disponibile la cerere în Informații, evitând un proprietar redundant de panou. Share folosește contractul URL existent, clipboard/manual, Web Share după capabilitate și mailto RFC6068, fără backend și fără a trimite mesaje în audit. Module: ACTUAL singur activ, ISTORIC/PROPUNERI explicit nepublicate. atlas-map-controls este singurul proprietar al celor patru comenzi și adnotări; vechile foi CSS P6 au fost eliminate. Dreapta-jos desktop, stânga-sus sub900px logici, după comparație vizuală care a demonstrat coliziuni pentru alternativa mobilă.

P7.6 corectează defecte demonstrate la text200%: antet intrinsec, actualizarea dimensiunii hărții, spațiul măsurat al railului/adnotărilor și accesul prin scroll la arbore/card. Shellul limitează adaptiv panoul prea larg la900px și păstrează preferința pentru ecrane mari. Nicio schimbare a semanticii selecției, filtrării, geometriilor, URL sau rasterului.

## Securitate și integritate

Alerta43: valori CDP transmise ca date către funcții statice și allowlist pentru rutele panourilor. Alerta44: executabilul browserului este ales numai dintre literali revizuiți. Alertele45/46: namespace temporar fix pentru dovezi, fără căi arbitrare din mediu. Fără suprimare, dismissal sau relaxare CodeQL.

Fiecare etapă folosește branch/PR, suite exacte, required checks, CodeQL și alerte efective, raport A/B PASS fără mismatches, expected HEAD merge fără bypass, Pages real Chrome/CDP și comparație literală frontend/contracte/123GeoJSON. Protecțiile main, candidate lifecycle, snapshoturile, manifestele, fingerprinturile și provenance rămân intacte. Intenția geometrică implicită este doar România și Moldova.

## Acceptare și limite

P7.5 închis:408teste locale și101publice PASS,14checks PR/16main SUCCESS,CodeQL efectiv fără alerte deschise,A/B PASS,157resurse byte-identice inclusiv123GeoJSON/123998485octeți. Nouăviewporturi native și preview/rotire, capturi inspectate,150pașiTab,116previewuri,56treepreviewuri,max34rânduri.

P7.6 extinde auditul cu profiluri cold independente mobilportret/mobillandscape/desktop și warm în aceleași profiluri, FCP/LCP/longtasks/heap/DOM/rețea și condiții explicite. Momentul utilizabil este o limită superioară observată după frontendReady, nu TTI standardizat. Bytes ResourceTiming pot exclude resurse externe fără TAO. Serverul local no-store nu reprezintă cache-ul public Pages. Resize-ul warm nu este cold mobil.

Forced colors, reduced motion, semantica ARIA, focus, tastatură, contrast și simularea explicită a textului200% sunt verificate prin probe automate și capturi. Acestea nu certifică WCAG și nu înlocuiesc dispozitivele fizice Android/iOS, tehnologii asistive sau o evaluare manuală completă. Compatibilitatea nativă Web Share depinde de browser/dispozitiv; rasterul extern depinde de rețeaua OSM.

Verdictul final, rezultate exactHEAD/main, SHA-uri, capturi, performanță publică și eventuale riscuri reziduale sunt consemnate în raportul de închidere P7.6 și descrierea PR-ului asociat numai după acceptarea post-merge. Nu se declară P7 închisă înaintea acestora.
