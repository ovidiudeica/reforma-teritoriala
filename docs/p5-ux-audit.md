# P5.0 — Audit UX al navigării ACTUAL RO+MD

**Data:** 9 octombrie 2026  
**Bază audit:** `main` `3f83d08ec5784afb98e7c266e557ed0e0e5b5c89` (faza P4 închisă).  
**Tip:** audit de interfață read-only, surse `index.html`, `style.css`, `app.js`, `atlas-tree.mjs`, `atlas-filters.mjs`, `atlas-search.mjs`, `atlas-mobile-ui.mjs`, `atlas-url-state.mjs`, `geometry-taxonomy.mjs`, teste și ghidul P4. Referință vizuală furnizată de beneficiar: interfața mobilă OSM-Boundaries. Nu este un audit al geometriilor sau al identităților.

## Rezumat executiv

Interfața P4 este funcțională, validată pe RO+MD, dar **navigarea nu este încă axată pe explorarea ierarhiei**, spre deosebire de OSM-Boundaries. În prezent, `index.html` așază laolaltă căutarea, arborele, jurisdicțiile, toate clasele/subtipurile de filtre, legenda, proveniența și o descriere a zoomului într-o singură bară laterală. CSS-ul desktop rezervă aproximativ **310 px navigării + 340 px detaliilor**, iar `.hierarchy-tree` are plafon implicit de **300 px**; harta pierde spațiu, iar arborele nu poate deveni centrul experienței.

Contractul semantic P4 trebuie păstrat; problema este **arhitectura informației și ierarhia vizuală**, nu lipsa datelor. P5.0 livrează în director separat un prototip interactiv care reutilizează codul și datele P4. Nu este o migrare a paginii principale.

## Constatări prioritizate

| ID | Severitate | Constatare verificabilă | Mod de remediere |
| --- | --- | --- | --- |
| UX-01 | Ridicată | Arborele `#hierarchy-tree` este limitat la `max-height:300px`, deși inventarul are 5.848 entități; arborele este o secțiune printre multe altele. | Arboreul devine spațiul principal de scroll din panoul **Ierarhie**, cu deschidere lazy și numărătoare. |
| UX-02 | Ridicată | Filtrele, jurisdicțiile, statutul release-ului și proveniența concurează cu navigarea într-un flux vertical unic. | Taburi **Ierarhie / Filtre**, proveniență în bloc detaliat, legendă contextuală. |
| UX-03 | Ridicată | Click pe nod = selecție/zoom, săgeată = extindere, dar lipsește un control individual de afișare a unui contur independent de selecție. | Checkbox distinct pentru suprapuneri, etichetat explicit; fără duplicarea identității statistice în arbore. |
| UX-04 | Medie | Desktop: trei coloane permanente, `310px + hartă + 340px`, inclusiv detalii când nu există selecție. | Hartă dominantă, panou lateral redimensionabil și fișă de selecție contextuală. |
| UX-05 | Medie | Căutarea este funcțională (nume/cod/OSM), dar rezultatul nu este plasat într-un flux de explorare compact cu arbore mereu vizibil. | Căutare în vârful tabului Ierarhie; selecția deschide automat strămoșii, breadcrumb și încadrarea. |
| UX-06 | Medie | Filtrele avansate au multe subtipuri și explicații statistice dense; starea schimbată nu are sumar persistent. | Filtre grupate, subtipuri pliate, indicator de filtre schimbate, acțiuni Toate/Niciuna/Reset. |
| UX-07 | Medie | Pe mobil harta ocupă ecranul, dar navigarea și controalele sunt într-un drawer care poate deveni foarte lung. | Drawer contextual cu două taburi, butoane hartă pentru deschiderea directă a fiecăruia și bară de selecție fixată. |
| UX-08 | Medie | Nu există un sumar distinct pentru mai multe contururi afișate simultan; detaliile descriu doar identitatea curentă. | Separați `selectedEntityId`, `visibleOverlayIds`, `activeFilters` și `openBranchIds`; nu le contopiți într-un singur checkbox. |
| UX-09 | Scăzută | Lista de release/proveniență este esențială pentru audit, dar domină spațiul de navigare. | Păstrare integrală, disponibilă în tabul Filtre / secțiune extensibilă. |
| UX-10 | Medie | Configurația pentru extindere în masă este protejată de bugetul de noduri (550), dar utilizatorul nu are feedback compact despre toate nivelurile. | Niveluri semantice + feedback de buget, deschidere incrementală și focalizare pe cale, nu randare globală a tuturor rândurilor. |

*Severitatea exprimă efectul asupra experienței de navigare, nu severitatea unei vulnerabilități sau a unui defect geometric.*

## Ce trebuie să rămână nemodificat

- Corpusul ACTUAL: **5.848 identități** (3.246 RO, 2.602 MD); arborele existent `actual-consolidated-hierarchy-v1` are două rădăcini și trebuie validat integral înainte de utilizare.
- Rolurile statistice: **63** în total, din care **45 reutilizează** geometria administrativă și **18 au limite statistice separate**; o identitate unică nu trebuie dublată în arbore pentru două roluri.
- Pentru o geometrie consolidată, vizibilitatea este **administrativ OR statistic**; pentru o limită `statistical_only`, **nivel statistic AND toggle de limite separate**. Jurisdicția este o poartă suplimentară.
- Sistemul de geometrii P4: 115 chunk-uri GeoJSON, overview/local/detail, zoom local de la 7 și detail de la 10, fără simplificare, modificare de coordonate sau noi fetch-uri duplicate.
- Identitatea juridică (SIRUTA/CUATM) și geometria OSM/ANCPI rămân reprezentate separat. ISTORIC și PROPUNERI sunt corpusuri distincte și **nu trebuie populate artificial cu ACTUAL**.
- Căutarea după identitate trebuie să găsească și entități a căror geometrie este ascunsă de filtre. URL/History existente și tratarea inputului invalid rămân valabile.
- Cele 6 required status checks GitHub de pe `main`, inclusiv P4.1/P4.2/P4.3, și release provenance rămân active.

## Ce demonstrează P5.0 și ce nu

**Demonstrează cu date reale:** layout desktop/mobil, separare taburi, navigare după ierarhia validată, căutarea și selecția reale din `app.js`, filtrele existente, suprapunerea read-only a unei geometrii după ID dintr-un tier/chunk/statistică, bară de contururi, acces la release și închiderea drawer-ului; resize desktop, keyboard tab switch.

**Nu pretinde:** lansare publică, conversia tuturor controalelor pe noul UI, persistență multi-select în URL, virtualizarea universală a celor 5.848 de rânduri, performanță certificată sub toate condițiile, accesibilitate WCAG certificată ori paritate pixel-perfect cu OSM-Boundaries. Prototipul limitează suprapunerile simultane la 20 și le păstrează numai în sesiune.

## Decizia auditului

**Redesign justificat.** P5.1 poate adapta shell-ul public după aprobarea prototipului, păstrând `app.js` și contractele P4 în primă instanță; reimplementarea/virtualizarea arborelui și persistența selecției multiple sunt pași separați. Lista de criterii, interacțiuni și riscuri tehnice se află în [P5 navigation specification](p5-navigation-spec.md).
