# P5.0 — Audit UX, specificație și prototip de navigare

## Baseline și scop
Baseline imutabil: `main` `3f83d08ec5784afb98e7c266e557ed0e0e5b5c89`, faza P4 închisă, 5.848 identități publice (RO 3.246, MD 2.602), 170 stări testate, 115 chunk-uri. Referința de interacțiune furnizată de beneficiar este OSM-Boundaries: bară laterală cu sursă/căutare/arbore, comutator de vizibilitate pe rând, badge pentru nivel și hartă dominantă. Nu copiem schema OSM și nici nu transmitem date OSM-Boundaries aplicației.

## Auditul UX actual (read-only)
- `index.html`: `#atlas-controls` conține căutare, arbore, jurisdicții, filtre generate, nivel detaliu, legendă și proveniență într-un singur panou vertical; `#details-panel` este coloană permanentă pe desktop, reducând harta; pe mobil drawer-ul include în continuare toate secțiunile.
- `style.css`: desktop cu grid `310px minmax(0,1fr) 340px`; spațiu relativ restrâns pentru hartă și arbore la rezoluții intermediare. Lipsesc un control evident de redimensionare și un panou de filtre separat de arbore.
- `atlas-tree.mjs`: arbore `details/summary` și selectare pe nume, extindere lazy DOM, semantic roles, 5.848 ID-uri, afișare „geometrie ascunsă”; nu există comutator de vizibilitate pe fiecare rând distinct de selectare.
- `atlas-filters.mjs`: clase/subtipuri, niveluri statistice și separat, deja implementate; organizarea actuală este corectă semantic dar cu densitate vizuală mare.
- `atlas-mobile-ui.mjs`: drawer accesibil și sheet de detalii existente, dar experiența mobilă poate fi mult simplificată prin acțiuni primare + detalii on demand.
- `app.js` și `atlas-hierarchy-validate.mjs`: sursa adevărului rămâne `actual-consolidated-hierarchy-v1`, NU relațiile geometrice inferate din conținere. Se mențin rolurile statistice coalesced (45) și limitele separate (18), fără geometrie duplicată.

## Specificația de produs P5 — navigare țintă
1. **Shell:** header compact cu corpus ACTUAL/ISTORIC/PROPUNERI (inactive dacă sunt nepublicate), explorator lateral redimensionabil 280–660px pe desktop, hartă dominantă, drawer pe mobil. Fără panou de detalii permanent, înlocuit cu card contextual.
2. **Explorator:** selector release/corpus read-only, căutare unificată, taburi Ierarhie / Rezultate, comenzi restrânge/extinde și afișaj selecție. Scroll independent al arborelui; scroll-ul hărții nu trebuie blocat.
3. **Rând ierarhic:** săgeată extinde/restrânge; checkbox de **vizibilitate geometrică**; badge semantic tip/nivel; nume ca **acțiune de selecție/zoom**; cod oficial/OSM la nevoie; număr descendenți. Cele trei acțiuni nu se confundă. Ordinea și parentage vin exclusiv din contractul existent.
4. **Filtre:** drawer separat cu jurisdicții, grupuri administrative, subtipuri, niveluri statistice 1–3, limite statistice separate, număr filtre inactive și reset. Modelul semantic existent `geometryVisible` rămâne unica implementare normativă. Admin/stat reutilizat: **OR**; statistica separată: nivel activ **AND** toggle separat; jurisdicția se aplică tuturor.
5. **Vizibilitate vs selecție:** selecția unui ID nu implică automat afișarea unei geometrii ascunse. Trebuie afișat motivul și acțiunea explicită de activare. Pentru prototip sunt doar toggle-uri per rând demonstrative, nu reguli autoritative.
6. **Căutare:** nume, alias, SIRUTA/CUATM, cod statistic, OSM; rezultate care includ entități ascunse. Selectarea deschide calea în arbore și încadrează geometria dacă este vizibilă.
7. **Hartă:** Leaflet și tile-uri existente, integritate OSM, zoom lazy 7/10, z-order separate/statistic, contrast și selecție stabilă; pan, zoom și history/URL păstrate; desenarea schematică din prototip NU este geometrie reală.
8. **Accesibilitate:** focus vizibil, aria-expanded, aria-selected, comutatoare distincte cu etichete, tastatură pentru redimensionare, Escape închide drawer-ul, navigare în taburi, focus recovery, `prefers-reduced-motion`, ținte tactile minim ~44px la implementarea finală.
9. **Responsive:** pe desktop panoul stânga are dimensiune persistentă în UI; sub 900px se folosește drawer temporar și card de selecție jos, pentru a păstra harta dominantă. Starea navigării și filtrelor trebuie să supraviețuiască schimbării viewportului, fără geometrie refetched.
10. **Securitate și compatibilitate:** nu se inserează nume din corpus folosind `innerHTML`, nu se schimbă URL/history, identitatea legală nu este confundată cu geometria; toate regresiile P4 sunt obligatorii în branch protection.

## Prototip funcțional izolat
`prototypes/p5-navigation/index.html`, `style.css`, `app.js`. Deschideți fișierul HTML în browser sau serviți directorul cu un server HTTP static. Nu există dependențe CDN, npm sau fetch de date; prototipul funcționează offline. Datele din `app.js` sunt **un eșantion DEMONSTRATIV**, unele nume sunt reale dar codurile/pozițiile/schița nu sunt surse administrative și nu reproduc coordonate OSM; nu le folosiți în producție.

Testați: extindere/restrângere individuală, extindere până la trei niveluri, search cu tab rezultate, selectarea și evidențierea schematică, checkbox de rând independent, filtre/număr/reset, jurisdicții, zoom/reset, ascundere contururi, drawer mobil, Escape, redimensionare mouse/tastatură, selecții multiple și ștergere. Este un prototip de **interacțiune**, nu o implementare a filtrului autoritativ al ACTUAL și nu o demonstrație de fidelitate geometrica.

## Criterii de acceptare pentru etapele ulterioare
- P5.1: shell/layout fără deriva contractului P4, Chrome 7 viewporturi, fără overflow, focus și accessibility smoke; adăugare taburi și drawer.
- P5.2: integrare arbore real `actual-consolidated-hierarchy-v1`, navigare virtualizată/lazy, checkbox de vizibilitate per-ID ca stare de prezentare coerentă cu filtrele și fără dublare 45 coalesced/18 separate.
- P5.3: filtre reorganizate cu paritate URL/history, search, stare selecție, încărcare lazy, regression matrix 5.848 × 170.
- P5.4: QA end-to-end, perf/mobile, compararea A/B, 123/123 fișiere publice hash, release closure. PR-uri separate și validare după fiecare.
- **P5.0 nu modifică aplicația publicată.** Demo-ul nu este legat în `index.html`, nici în GitHub Pages deploy. Niciun fișier `data/`, `public/`, geometry, snapshot, fingerprint sau release manifest nu se modifică.

## Riscuri și întrebări de decizie la review
Checkbox-urile pe entitate sunt o facilitate nouă, diferită de filtrele globale; implementarea reală trebuie să definească prioritatea acestora, serializarea în URL și limitele de selecție multiplă. Filtrele separate-statistics trebuie să rămână compatibile cu selecția unică existentă și cu rolurile OR. Pentru arbori de 5.848 noduri, evitați render DOM complet la fiecare tastă și testați latența pe mobil. Stările ISTORIC și PROPUNERI nu trebuie să fie navigabile până la existența corpusurilor.