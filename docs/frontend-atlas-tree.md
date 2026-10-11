# Arborele Entități

Navigarea folosește exclusiv contractul public `actual-consolidated-hierarchy-v1`, validat înaintea construirii controllerului. Cele 5.848 identități, relațiile parent_id/child_ids, rolurile statistice și administrative și ordinea fraților sunt păstrate. Nu se deduc relații din geometrie, coduri sau similitudinea numelor.

P7.3 înlocuiește materializarea lazy permanentă cu o listă virtuală. `atlas-tree-window.mjs` calculează rândurile vizibile și offseturile înălțimilor măsurate; `atlas-tree.mjs` montează fereastra vizibilă, overscanul și maximum două excepții pentru rândul focalizat/selectat. `atlas-tree.css` deține layoutul. Numărul total de entități nu determină numărul de noduri DOM.

Expandarea ramurilor, checkboxurile geometriei și selecția sunt independente. Inițial sunt bifate numai România și Moldova. Filtrele globale pot ascunde geometria bifată fără a modifica intenția checkboxului. Un părinte închis nu șterge starea de expandare a descendenților. Selecția validează și deschide calea necesară, fără a bifa geometriile acesteia. Starea rămâne integrată în contractul URL și History; restaurarea programatică nu generează callbacks de navigare manuală.

Numele complete se încadrează pe mai multe linii; rândurile au minimum 44 px, iar fiecare control are minimum 44×44 px. Indentarea și iconurile decorative disting nivelurile și rolurile fără metadate tehnice. Codurile SIRUTA/CUATM/NUTS și identificatorii rămân în cardurile entităților. Compactarea numelor este exclusiv de prezentare, prin `compactTreeName`; corpusul nu este modificat.

Widgetul treegrid are trei coloane: expandare, geometrie, nume/selecție. Tab parcurge controalele rândului activ; Sus/Jos schimbă rândul păstrând coloana, Stânga/Dreapta schimbă coloana, Home/End merg la prima/ultima coloană, Ctrl+Home/End la primul/ultimul rând vizibil logic, iar PageUp/Down avansează un viewport. Enter și Space folosesc comportamentul nativ al controlului focalizat. Focusul nu schimbă selecția sau geometria. `aria-rowcount` și `aria-rowindex` descriu rândurile virtualizate.

API-ul `getNode` returnează numai rânduri montate; absența unui rând DOM nu înseamnă absența identității. Pentru stare se folosesc `isOpen`, `getOpenIds`, `getVisibleIds`, `getVisibleCount` și `selectedId`. `reveal`/`revealSelected` deplasează numai viewportul arborelui. Un ResizeObserver comun măsoară rândurile și redimensionarea viewportului, păstrând ancora de scroll. `destroy` eliberează observerul și callbackul de scroll.

Regresiile acoperă toate identitățile și relațiile din corpus, fereastra DOM limitată, înălțimile variabile, expansiunile independente, filtrele, selecția, URL/History, opt viewporturi Chrome și focusul la scroll. [Deciziile și auditul P7.3](p7.3-virtual-entity-tree.md) documentează înlocuirea vechii arhitecturi. Acceptarea completă cere verificările și auditul Pages post-merge; testele Chrome nu reprezintă testare fizică Android/iOS sau certificare WCAG.
