# Atlas provenance, legend și accesibilitate — web-v1.2.6

## Provenance și separarea surselor

`atlas-presentation.mjs` expune modele pure/testabile și renderere pentru provenance global/per entity și legendă. `geometry-taxonomy.mjs` rămâne unica clasificare semantică; modulul nou gestionează numai prezentarea.

Global: manifest + gate validate, public index, metadata aplicației și binding-ul publicației GitHub. Sunt afișate release, snapshot, contract, gate, număr de entități, jurisdicții și data manifestului. Fingerprint-ul și source watermark sunt în disclosure „Detalii tehnice”.

Manifestul nu conține tag-ul release-ului. `publishedActualRelease` este un binding frontend verificat împotriva release-ului GitHub `actual-v1.2.0` (tag, URL, data publicării), snapshot și fingerprint. Este aplicat numai când ambele identități ale manifestului coincid exact. Pentru un snapshot/fingerprint diferit, UI afișează „Publicare neconfirmată pentru snapshot-ul curent”, fără a atribui vechiul tag. `public/data/app-build-info.json` rămâne byte-identic: metadata sa istorică (`actual-v1.1.0`) este afișată distinct, în partea tehnică, ca metadata a aplicației. Fetch/JSON failure pentru această metadata opțională nu invalidează gate-ul manifestului ACTUAL. Nu există request către GitHub la runtime și nici modificare a release manifest-ului.

Per entity, trei secțiuni h3 sub heading-ul h2 al entității:

- Identitate oficială: registry, ID/name/type juridic, parent legal, status reconciliere, metoda match, confidence, anul registrului și sursa existentă. Fără timestamp de reconciliere inventat.
- Rol statistic: classification/version, cod oficial, nivel, parent/authority/source; geometrie administrativă reutilizată sau limită statistică separată. Fără duplicarea celor 45 coalesced entities.
- Reprezentare cartografică: source, relation, inferred type, nivel OSM ca metadata, fidelity/confidence/audit existente. „Coordonate master, fără simplificare” apare numai pentru `master_coordinate_fidelity`. Pentru MD120, MD121 apare exclusiv în această secțiune, etichetat evidence OSM fără autoritate de identitate.

Linkurile provin numai din source_url sau URL-ul release-ului verificat, cu validare absolută HTTP(S), escaping și rel=noopener. Nu sunt inventate URL-uri oficiale pentru registre. Lipsa metadata rămâne explicită/omisă, fără deducții după admin_level.

## Legendă și style config

`geometryStyleConfig` + `selectedStyle` sunt sursa comună pentru `styleFor()`/Leaflet și swatch-urile SVG. Label-urile provin din taxonomy. Legendă read-only prin details/summary în controls/drawer; fără checkboxes, fără schimbări de filtre/URL.

| Clasă | Stroke | Grosime | Dash |
|---|---|---:|---|
| regional | #203f59 | 1.8 | solid |
| local_uat | #365e55 | 1.1 | solid |
| sector | #806b50 | 1.4 | solid |
| component_locality | #806b50 | 0.8 | 1 3 |
| context | #203f59 | 2 | solid |
| auxiliary | #65716b | 0.8 | 2 3 |
| statistical_only | #66538c | 1.7 | 5 4 |
| selected | #b54a38 | 3 | păstrează pattern-ul clasei |

Fill/opacity sunt în același config. Unclassified este prezent doar dacă există entități în clasă (baseline: zero). Culorile sunt completate de text, grosime și pattern; nota din legendă calculează din index 63 roluri / 45 reused / 18 separate. Cele 63 nu devin layers separate.

## Keyboard / focus / semantică

Landmarks native header/main/nav/aside/footer; h1 pentru aplicație, h2 pentru controls/details, h3 pentru secțiuni și h4 pentru jurisdicțiile subtipurilor. Map are region/name/tabindex=0 și descriere keyboard.

Skip links „Sari la hartă” / „Sari la navigare” sunt vizibile la focus și mută focus-ul către target-ul real, fără modificarea hash/URL. Pe mobil, navigare deschide drawer-ul și focusează search; hartă închide drawer-ul fără clear. Leaflet zoom controls au labels românești; attribution rămâne vizibilă.

Search păstrează combobox/listbox, active descendant, selected option și focus în input în timpul navigării. Statusul count/no-result este polite. Tree folosește details/summary nativ și button de selecție separat, aria-pressed unic; fără ARIA tree paralel. Ordinea Tab este select parent, disclosure parent, apoi children; selecția părintelui nu mai apare după toți descendenții. Drawer reopen revealează nodul selectat deja materializat după restabilirea layout-ului, fără rebuild.

Filtrele folosesc label native asociat checkbox-ului. Parents păstrează checked/unchecked/indeterminate; subtipurile au context de jurisdicție/clasă, iar Toate/Niciuna au context de secțiune în aria-label. Nivelurile statistice au nume explicit. Breadcrumb nav are aria-label și aria-current=location.

## Mobile shell / hidden state

Breakpoint-ul rămâne 720px. Drawer și sheet closed folosesc hidden + inert + aria-hidden; hidden este fallback-ul browserelor fără inert. CSS [hidden] are prioritate. Drawer open → focus search, close → trigger. Search/tree selection închid drawer-ul; disclosure/checkbox nu îl închid. Escape: search open întâi, drawer al doilea; nu face clearSelection global.

Sheet: closed/peek/expanded, label prin details-title; expand aria-expanded/controls, close „Șterge selecția”. Focus-ul unui breadcrumb este normalizat înainte de înlocuirea DOM-ului/collapse, astfel încât să nu rămână într-un body ascuns. Clear/URL clear și breakpoint changes normalizează focus-ul. Sheet este non-modal, fără focus trap. Provenance entity rămâne în expanded; global în drawer/controls.

Selection-visibility și geometry failure sunt status-uri scurte în afara body-ului collapsed, disponibile și în peek. Sheet peek poate scrolla intern pentru aceste mesaje. Panourile și disclosures legend/provenance rămân UI ephemeral: nu sunt serializate și nu scriu History API. Back/Forward, select/clear și filtrarea geometrică păstrează controller-ele anterioare.

## Live regions / failures

Polite: search, copy feedback, hidden geometry, selected geometry failure, selected title și release loading/success. Details panel întreg nu mai este live, evitând recitirea tuturor metadatelor. Release validation failure folosește alert/assertive; hierarchy și initial geometry failure au mesaje distincte. Eșecul ierarhiei/geometriei nu înlocuiește filtrele/indexul deja validat cu un mesaj global. Geometria selectată indisponibilă păstrează entity/details/breadcrumb/tree și URL. Nu a fost introdus networking/retry complex.

## CSS / contrast / touch

Focus-visible comun de 3px pentru button/link/input/summary/tabindex, inclusiv mode buttons, URL copy, OSM link, Toate/Niciuna și disclosures. Map focus outline este intern. Textul secundar folosește #52635a; textul principal #17202a; focus #365b4a, warning #633f14. Testele calculează contrast ≥4.5 pentru perechile de text pe suprafețele declarate și ≥3 pentru focus. Geometria nu este evaluată ca text.

Pe mobil: tree select/disclosure 44px și spațiu separat, filter label min-height 44px, acțiuni/breadcrumbs/disclosures cu hit area ≥44px. Desktop păstrează densitatea existentă. Selected row are și border, nu numai culoare. Reduced-motion elimină UI transitions/animations; forced-colors păstrează outline/selected borders și dash/thickness în legendă.

## Validare / limitări

Suite DOM/controller cu HTML randat și modele reale, lexer CSS pentru contracte, contrast calculat, Leaflet/History mocks și failures simulate, plus toate regresiile web-v1.2.1–1.2.5. Zero framework/dependențe noi; build deterministic/offline păstrat.

Polygon-level keyboard selection nu este implementată în Leaflet; search/tree sunt alternativa completă pentru selecție. Nu există certificare WCAG sau audit screen-reader/browser vizual în acest PR. QA desktop/mobile/visual real rămâne web-v1.2.7. ACTUAL/P2, taxonomy, snapshot/fingerprint, public entities/hierarchy, geometries, sources/registries și release/tag sunt byte-intacte.

Repere pentru contrast și ținte tactile: [W3C — Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) și [W3C — Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). 44px este ținta de usability solicitată; nu este prezentată ca minimum AA obligatoriu pentru orice element.
