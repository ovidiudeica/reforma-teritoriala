# OSM-FIX.2 — propunere de remediere la sursă, 21 octombrie 2026

Verdict: `BLOCKED_SOURCE_TRANSITION`. Acesta este un dosar read-only pentru analiză de către un mapper OSM, nu un changeset, o autorizare de upload sau o promovare a sursei.

Recapturarea oficială `full` și `history` confirmă Horești18967493/v6 și Buneți18968082/v7. Ambele relații sunt `type=boundary`, `boundary=administrative`, `admin_level=9`. Regulile de alcătuire a inelelor se aplică și relațiilor boundary; verificarea nu le confundă cu un contur închis doar în planul coordonatelor. Toți membrii sunt prezenți, toate coordonatele sunt valide și nu există un membru suplimentar care să închidă lanțul prin identități de nod.

| Relație | Way-uri în full | Noduri terminale distincte | Coordonate comune | Verdict |
|---|---:|---|---|---|
| Horești18967493/v6 | 2 |12318728194 /12318728593 |28.858393,46.8331996 | câte un endpoint de grad1 |
| Buneți18968082/v7 | 6 |11649857778 /8265822008 |28.9073227,47.0786791 | câte un endpoint de grad1 |

La Horești, cele două noduri/v1 provin din changeset158819789, la o secundă diferență, în6noiembrie2024. Configurația terminală curentă apare în istoricul way1376179876/v3 și way1430569793/v1 la17septembrie2025, changeset172067097. Nodurile sunt folosite în prezent de cinci, respectiv patru way-uri distincte. Aceste utilizări comune împiedică alegerea automată a unui nod de păstrat.

La Buneți, node11649857778/v1 provine din21februarie2024, changeset147745485, iar node8265822008/v1 din28decembrie2020, changeset96510586. Configurația terminală curentă este documentată în way1376180731/v4 și way1494605624/v1, la31martie2026, changeset180673111. Nodurile sunt folosite de două, respectiv trei way-uri. Vechimea unui nod nu decide singură corectitudinea lui.

Compararea cu snapshotul protejat5octombrie2026 confirmă aceiași membri ordonați type/ref/role, aceleași secvențe de noduri ale way-urilor și aceleași coordonate terminale. Snapshotul istoric Overpass nu include versiunea relației; acest câmp rămâne explicit necertificat pentru snapshot. Geometria încorporată de Overpass și ordinea cheilor JSON nu sunt tratate ca modificări ale apartenenței. Raportul inițial al comparației brute este păstrat separat, cu corecția explicată; nu se rescriu sursele.

Propunerea pentru un mapper autorizat: analizați istoricul complet, tagurile, utilizările inverse și sursele originale ale graniței. Stabiliți dacă nodurile reprezintă același vertex sau dacă este necesară o altă corecție documentată a membrilor. Numai după această verificare și autorizarea separată a unei intervenții publice poate fi pregătită o modificare minimă într-un editor OSM. Nu se propune un nod câștigător pe baza coordonatelor, nu se inventează segmente și nu se mută frontiera pentru a satisface importatorul. Verificați toate relațiile care folosesc way-urile afectate și versiunile live înainte de orice upload.

După o eventuală corecție upstream: capturați din nou full/history, verificați toate dependențele și inelele, reluați importul autentic și toate gate-urile pe SHA-ul exact. Issue396 rămâne OPEN până la promovare și prospețime PASS. ACTUAL, părinții MD, politica host-trust și pragurile de prospețime rămân nemodificate; P9.1 este blocat.

Probe originale, istorice way/node, utilizări inverse și hashuri: `docs/evidence/osm-fix2/source-repair-review-20261021/`. Regresiile folosesc explicit cele două răspunsuri full și resping fiecare graf deschis. Nu transformă simulări de corecție în dovezi ale sursei reale.

Referințe tehnice: [OSM multipolygon](https://wiki.openstreetmap.org/wiki/Multipolygon), [algoritmul inelelor pentru multipolygon/boundary](https://wiki.openstreetmap.org/wiki/Relation:multipolygon/Algorithm), [procedura comunității pentru modificări automate](https://wiki.openstreetmap.org/wiki/Automated_Edits/Code_of_Conduct). Atribuire: © OpenStreetMap contributors, ODbL.
