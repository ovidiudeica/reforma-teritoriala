# Stare Atlas prin URL — web-v1.2.4

## Schema v=1

Modulul `atlas-url-state.mjs` conține parse, validare, normalizare, serializare, canonicalizare, comparație și controller History API. `app.js` citește numai state-ul existent și orchestrează aplicarea lui. URLSearchParams face tot encoding-ul; ruta GitHub Pages și hash-ul existent sunt păstrate. Fără hash routing sau server-side routing.

| Parametru | Sens | Default / omitere |
| --- | --- | --- |
| v | versiune, numai 1 acceptată | URL default complet rămâne fără query |
| e | entity.id selectat | fără selecție |
| lat, lon, z | tuple viewport | 46.8, 26.6, 6 |
| j | jurisdicții active CSV: RO, MD; j= înseamnă niciuna | ambele ON |
| f (repetabil) | ID de subtip dezactivat | toate subtipurile ON |
| s | niveluri statistice active CSV: 1,2,3,unclassified; s= înseamnă niciunul | toate ON |
| b | 0 dezactivează limitele statistice separate | ON |
| t (repetabil) | ID al unui disclosure node deschis; t= înseamnă niciunul | cele două roots deschise |

Ordine canonical: v, e, lat, lon, z, j, f, s, b, t. ID lists sunt sortate lexicografic, fără duplicate; nivelurile au ordinea 1,2,3,unclassified. f și t sunt parametri repetați, nu liste concatenate cu un separator care ar putea apărea în IDs. URLSearchParams asigură round-trip și pentru caractere speciale.

Nu se serializază query-ul/active option/listbox search, details state separat, chunks/tiers încărcate, fetch status, obiecte Leaflet, release/fingerprint/candidate SHA sau count-uri. Details și breadcrumb sunt generate exclusiv din e.

## Defaults și normalizare

Pagina fără query păstrează default-ul anterior: RO+MD, toate subtipurile, toate nivelurile statistice și limitele separate ON; fără selecție; viewport 46.8/26.6/6; două roots deschise. Default serializează șir gol, nu o listă mare cu toate opțiunile. v=1 singur este eliminat prin canonicalizare.

Clasele și subtipurile provin din geometry-taxonomy.mjs și geometry filter index, nu dintr-o taxonomie URL paralelă. f reprezintă abaterile față de default. Normalizarea folosește geometryParentState și setGeometryGroup din modulul comun: parent OFF dezactivează copiii relevanți; zero copii activi elimină class gate; mixed/all determină checkbox state corect. Starea internă a subtipurilor este independentă de j, s și b. UI-ul este sincronizat prin controller-ul Atlas filters existent.

Viewport: lat în [-90,90], lon în [-180,180], z întreg în [0,19], toate finite și tuple completă. Precizie lat/lon: 5 zecimale. O tuple invalidă/incompletă este ignorată integral și se folosește viewport-ul default; dacă există o selecție semantică fără tuple validă, se poate face zoom normal la entitate.

Un viewport explicit valid are prioritate față de fitBounds, inclusiv când coordonatele coincid cu default-ul. Pentru o selecție capturată din UI se păstrează tuple explicită și în acest caz: omiterea ei ar transforma link-ul exact într-un link semantic care face auto-zoom. Fără selecție se omit coordonatele default inutile.

## Restore lifecycle și precedență

1. Release și public entities validate; geometry filter index și UI construite.
2. Hierarchy încărcat, tree lazy și search index disponibile.
3. Geometry chunk index disponibil pentru selecția centrală.
4. URL parsed/normalized; sets geometrice/statistice și jurisdicții aplicate.
5. Open IDs manuale aplicate lazy; viewport aplicat fără animație.
6. selectEntity(source:'url', zoom:!viewportExplicit) sau clearSelection.
7. Path-ul selecției este auto-expandat, details/breadcrumb/selected state actualizate; geometriile necesare și syncTiers aplicate.
8. Canonical replace după hydration; inițializarea normală finalizează geometriile de overview/statistical și highlight-ul, folosind filtrele deja restaurate.

Viewport-ul explicit nu este suprascris de fitBounds. Un e fără tuple poate face zoom normal. source:url păstrează jurisdicțiile restaurate OFF, fără reactivare implicită. Selecția ascunsă păstrează e, details, breadcrumb, tree și mesajul de hidden geometry; filtrele nu sunt activate. Pentru o selecție ulterioară a utilizatorului se păstrează comportamentul anterior de reactivare a jurisdicției când geometria este vizibilă, cu subtipurile intacte.

## Tree state

createAtlasTree expune getOpenIds(), setOpenIds(ids) și onDisclosureChange. Set-ul intern urmărește disclosure nodes, nu toate cele 5848 noduri; nu scanează întreaga ierarhie la moveend. Restore materializează determinist căile necesare fără să deschidă implicit strămoși neceruți. Apoi selecția are prioritate și deschide path-ul său.

Manual collapse al unui strămoș selectat este reflectat în URL. La restore acel path poate fi deschis din nou pentru a face selecția vizibilă. Evenimentele native toggle amânate ale schimbărilor programatice nu notifică history: controller-ul compară starea reală cu Set-ul actualizat sincron. Randarea rămâne lazy, aria-pressed unic și clear păstrează ramurile.

## History contract

- pushState: selectarea entității (map/search/tree/breadcrumb), clear selection, filtre explicite și jurisdicții.
- replaceState: viewport la zoomend/moveend, disclosure manual, initial hydration și canonicalizare.
- URL identic: niciun write/entry nou.

Controller-ul guard-ează restore și tranzacțiile de selecție. Un fitBounds și evenimentele map produse de selecție nu pot înlocui prematur entry-ul precedent înainte de push. popstate aplică URL-ul într-o coadă de restore, fără push; canonicalizarea este replace. O selecție asincronă depășită de popstate nu poate adăuga ulterior un entry accidental. Nu există popstate → restore → push feedback loop.

Map events continuă syncTiers; în timpul restore sincronizarea este orchestrată explicit pentru a evita încărcări concurente inutile. Erorile History API sunt capturate/logate și nu blochează geometria. Serialize citește state-ul existent, fără rebuild/fetch al indexului search, ierarhiei sau filter index.

## Parametri invalizi și canonicalizare

- v absent sau necunoscut: fail-safe la default; nu se interpretează scheme viitoare.
- e necunoscut: ignorat și eliminat.
- f necunoscut: ignorat; doar subtipurile din taxonomia/indexul comun sunt acceptate.
- t necunoscut sau leaf: eliminat din lista explicită; dacă lista rămâne goală, canonical este t=.
- j/s: elementele necunoscute sunt ignorate. O listă complet invalidă revine la default; valoarea explicit goală înseamnă zero active.
- b: numai 0 reprezintă abaterea OFF, restul revine la default.
- viewport invalid/incomplet: tuple ignorată.
- singleton params duplicate: prima valoare câștigă; f/t repetabile sunt deduplicate și sortate.
- parametrii necunoscuți și valorile default inutile sunt eliminate prin canonical replace după hydration.

Parametrii nu sunt inserați în HTML; sunt folosiți pentru lookup IDs, numbers validate și controller state. URL-ul rămâne independent de release intern; IDs dispărute într-un release viitor au fallback sigur.

## Exemple

- Default: `/reforma-teritoriala/`.
- Selecție semantică: `?v=1&e=stat-MD120`.
- Viewport exact cu geometria unui oraș ascunsă: `?v=1&e=osm-r9846233&lat=46.8&lon=26.6&z=6&f=ro.towns`.
- Numai MD, raioane OFF, nivel 3 OFF, limite separate OFF: `?v=1&j=MD&f=md.districts&s=1%2C2%2Cunclassified&b=0`.
- Două disclosure nodes explicite: `?v=1&t=osm-r58974&t=stat-MD12`.

Butonul compact „Copiază link” folosește live canonical state și navigator.clipboard.writeText, cu feedback de succes/eșec. Dacă API-ul lipsește/eșuează, mesajul recomandă copierea URL-ului din bara de adrese. Este un button nativ keyboard-accessible, fără dependențe externe.

## Validare și scope

Suite Node: frontend-smoke, actual-statistical-public, frontend-geometry-taxonomy, frontend-atlas-tree, frontend-atlas-filters, frontend-atlas-search și frontend-atlas-url-state. Suita URL include funcții pure, DOM/history mocks, toggle amânat, guards/race, erori History API și integrarea frontend reală cu Leaflet simulat înainte de frontendReady. Starea realistă cu entity/viewport/filtre/ramuri este sub 650 caractere.

Workflow-ul frontend agregat include syntax check pentru noul modul și toate suitele, apoi git diff --exit-code. Zero dependențe noi. ACTUAL/P2 rămân byte-for-byte neschimbate. Browser/visual QA complet rămâne web-v1.2.7. Nu sunt implementate mobile drawer/bottom sheet sau provenance/accessibility complet.
