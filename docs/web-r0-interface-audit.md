# WEB-R0 — audit read-only al interfeței și al backlogului

**Data:** 2026-10-18  
**Bază examinată:** `e2055e88b228d40780a1a013c80e1f70dd870edb`, `main`, PR #366/#367 integrate.  
**Metodă:** citire via GitHub a structurii arborelui (`983` intrări), a modulelor, CSS, documentației, fișierelor de UI și a statusurilor de CI. **Nu** s-a pornit un browser nou și nu s-au măsurat pixeli/memorie/timpi pe dispozitiv fizic în WEB-R0. Observațiile de cod nu sunt confundate cu regresii vizuale demonstrate.

## 1. Funcțiile existente, cu dovezi

| Capacitate | Surse existente | Verdict de inventar |
|---|---|---|
| Explorator, panouri, căutare, filtre | `index.html`, `atlas-panels.mjs`, `atlas-search.mjs`, `atlas-filters.mjs` | Implementate; UI eterogen |
| Arbore ierarhic virtualizat, toggle/selectare independente | `atlas-tree.mjs`, `atlas-tree-window.mjs`, `atlas-url-state.mjs` | Implementate, trebuie protejate prin regresii |
| Bara Leaflet + basemap separat | `atlas-map-controls.css`, `atlas-ro-md-fit.mjs`, `app.js` | Implementată; ordinea/stilul sunt de raționalizat |
| Navigator pentru RO/MD/NI | `atlas-nistrenia-jurisdiction.mjs`, `atlas-nistrenia-osm.mjs`, `atlas-nistrenia-outlines.mjs` | PR #366/#367 integrate: 8 contururi NI source-only, 85 roluri existente reutilizate |
| P8.1 identificare punct | `atlas-identify-ui.mjs`, `atlas-point-identification.mjs` | Implementat |
| P8.2 vecinătăți / relații topologice | `atlas-neighbors*.mjs`, `docs/p8.2-topological-neighbors-audit.md` | Implementat; export listă amânat |
| P8.3 măsurare / comparații | `atlas-geometric*.mjs`, `atlas-measure-ui.mjs`, `atlas-geographic-measurement.mjs` | Implementat; nu reimplementa |
| P8.4 exporturi și print | `atlas-export.mjs`, `atlas-export-ui.mjs`, `atlas-export-visual.mjs`, `docs/p8.4-acceptance.md` | GeoJSON/JSON/CSV/SVG/print-PDF; KML/KMZ lipsesc |
| NUTS/statistic | `docs/frontend-statistical-levels-audit.md`, `data/p2/*`, `atlas-filters.mjs` | 63 roluri, 45 geometrii administrative reutilizate + 18 separate; **nu** sunt indicatori numerici populație etc. |
| Traduceri | `index.html lang="ro"`, stringuri românești în fișierele JS | Fără catalog i18n RO/EN în arbore |
| Pages/CI | GitHub Actions pe `e2055e88`, publicare Pages | Anterior auditului WEB-R0, 23/23 checks success, inclusiv Chrome, P8.2/P8.4, security scans și ACTUAL CHANGE |

## 2. Inventar al panourilor și comenzilor

### 2.1 Panel host

`atlas-panels.mjs` definește 12 rute: `entities`, `search`, `filters`, `visible`, `recent`, `compare`, `share`, `info`, `modules`, `identify`, `neighbors`, `measure`. Comportamentul mobil, `inert`, Escape și revenirea focusului sunt deja centralizate și NU trebuie duplicate în fiecare accordion.

`index.html` conține `#atlas-controls` cu heading și `#drawer-close`. **Constatare confirmată în cod:** `#drawer-close` afișează textul „Închide”, în timp ce `#details-close` este icon `×`. Același concept de comandă nu are încă o convenție uniformă. Exemple suplimentare:
- text: `#geometries-reset`, `#filters-reset`, `#measure-undo`, `#measure-clear`, `#identify-copy`, `#identify-center`, `#share-native`;
- deja icon-only: `#search-clear`, `#details-close`, Leaflet zoom/fit/basemap;
- două niveluri de acțiune diferită „reset” (geometrii vs filtre vs vedere hartă), care nu trebuie comasate semantic.

`index.html` are unele `details/summary`: `#nistrenia-osm-panel`, `#osm-roles-panel`, coordonatele/metoda măsurării, `atlas-export-actions` creat dinamic. `atlas-filters.mjs` produce alte secțiuni `section`, `details` pentru subtipuri și butoane „Toate/Niciuna”. **Nu există un model universal** pentru heading, chevron, stare, spațiere și înălțime a controlului. Nu se recomandă wrapper generic impus mecanic peste rezultate virtualizate sau căutare.

### 2.2 Rail navigare

`index.html` declară trigger-ele:
`#mobile-navigation`, `#mobile-search`, `#filters-toggle`, `#advanced-visible`, `#advanced-recent`, `#advanced-compare`, `#share-toggle`, `#identify-toggle`, `#info-toggle`, `#navigation-more`, `#measure-toggle`. Vecinii sunt rută contextuală (`neighbors` în `atlas-panels.mjs`), nu un buton static primar în lista citită; înainte de rearanjare stabilește dacă primește trigger dedicat sau rămâne contextual.

Poziția actuală a `Recente/Compară/Partajare` înaintea identificării și măsurării nu corespunde grupării propuse pentru folosirea frecventă. Alternativa din specificație mută comenzile în clase logice fără să modifice event-handlerele, ID-urile, aria state și focusul. `#navigation-more` există deja și trebuie reutilizat, nu suprapus cu o a doua bară.

### 2.3 Bara hărții și elementele fixe

`atlas-map-controls.css` este proprietarul declarat al comenzilor/atribuirii Leaflet. Comenzile zoom și comutatorul raster au dimensiuni tactile de 44px. `atlas-layout.mjs` și `atlas-explorer-shell.css` calculează rezervările pentru card, rail, scară și atribuire. Modificările de structură trebuie făcute în proprietarul corect: evită stiluri duplicate în P6/P7 care ar reaprinde defectele P7.2/P7.6.

Nu declara bug de suprapunere pe HEAD actual: regresiile au trecut în Chromium în PR #366/#367; eventuale schimbări necesită comparație A/B reală.

## 3. Stiluri text și butoane — datorie de design verificabilă

`index.html` referă `style.css`, `atlas-explorer-shell.css`, `atlas-p5.3.css`, `atlas-p6.2.css`, `atlas-layout.css`, `atlas-tree.css`, `atlas-osm-roles.css`, `atlas-panel-content.css`, `atlas-map-controls.css`, `atlas-identify.css`, `atlas-geometric.css`, `atlas-neighbors.css`, `atlas-export.css` și Leaflet CSS. Și stilurile vechi din `style.css` afectează semantic controale noi. Exemplu static: `.action-button` folosește font 12px/border/radius 5px; `.mobile-control` are font 13px/radius 6px; `.icon-button` este fără chenar și are font 24px. Sunt clase vizuale distincte fără design tokens centrale; această fragmentare este **datorie de design**, nu dovadă că un anumit viewport este defect.

Nu elimina selectori vechi până nu ai mapat dependențele: `forced-colors`, `reduced-motion`, hit-testing și 200% text sunt deja verificate de browser QA. Nu introduce font găzduit extern fără plan de încărcare/offline.

## 4. Probleme/inconsecvențe documentare confirmate

1. `index.html` descrie în subtitle numai „Atlas teritorial România · Republica Moldova”, deși NI este afișată implicit; corectează explicit la WEB-R1 după decizia exactă asupra titlului și regimului juridic.
2. `README.md` spune încă în secțiunea P6 că implicit sunt selectate numai RO+MD; era istoric adevărat pentru etapa P6, dar **nu** descrie starea curentă P9.0.9.5. Nu șterge dovada istorică: marchează „la momentul P6” și adaugă comportamentul curent.
3. `public/data/app-build-info.json` și `README.md` prezintă baseline-ul `web-v1.2` (`54e667...`), deși au fost integrate numeroase evoluții P7–P9. Schimbă doar metadatele aplicației într-un release web nou verificat; NU reeticheta release-ul ACTUAL.
4. `#layer-ni` în `index.html` este declarat inițial `disabled` cu notă legal/cartografică, în timp ce NI are propriile contururi în navigarea operațională. Este **punct de audit al UX/contractelor**, nu automat un defect; verifică dacă `app.js` îl sincronizează deliberat înainte de a modifica UI.
5. Cele 5 HIGH `js/path-injection` #12–#16 erau `dismissed` false positive în registrul auditat; #17–#26 erau `fixed`; `docs/p9.0.9.5-security-review.json` conține verificări individuale. Reconfirmă registrul și CodeQL pe fiecare PR viitor; nu redeschide/închide automat alertele fără informații noi.
6. Există PR-uri Draft de audit/probatoriu lăsate intenționat deschise și trei update-uri Dependabot (artifact/setup-node); separă inventarul/decizia de orice cleanup. Nu închide probele juridice P9 doar pentru că UI este acceptat.

## 5. `admin_level` — ce știm și ce nu știm

- Modelul oficial al aplicației deja definește `representation.admin_level` în `docs/data-model.md`. `atlas-presentation.mjs` îl arată în secțiunea „Reprezentare cartografică”, iar `atlas-export.mjs` îl exportă ca metadată; `atlas-tree.mjs` nu îl afișează în bulină.
- `atlas-url-state.mjs` include `levels:[1,2,3,'unclassified']` pentru **statisticalLevels**, NU o selecție de `admin_level` OSM. `atlas-filters.mjs` gestionează „Niveluri statistice”, nu filtru OSM admin_level. Nu reutiliza aceleași chei/proprietăți.
- Pentru NI, există `public/data/p909-nistrenia-osm-navigation.json` și manifestul verificat al celor 8 contururi source-only. Modulul `atlas-nistrenia-outlines.mjs` validează proveniența înainte de folosire; nivelurile din aceste contracte trebuie inventariate înainte de afișare.
- **Necertitudine:** WEB-R0 nu a executat un census per-ID exhaustiv al valorilor `admin_level` din contractul public de ~15 MB, nici o reconciliere per-rol pentru NI. Nu publica procente, niveluri sau apartenențe fără validator dedicat WEB-R2a. Decide expres ce faci cu `null`, nivel multiplu/incompatibil sau `admin_level` lipsă. Fără valori deduse din „județ”/„raion”/„comună”.

## 6. Funcții pentru etapele următoare

**KML/KMZ:** lipsesc din `atlas-export.mjs` și `atlas-export-ui.mjs`; exportul actual are GeoJSON, JSON, CSV și SVG/print. Exportul de bază validează jurisdicții `RO/MD` în unele rutine de numire, prin urmare NI source-only cere contract de export separat, cu proveniență și fără a trata NI drept identitate legală ACTUAL. Limitele My Maps trebuie verificate la sursa Google, în preflight. Document: https://support.google.com/mymaps/answer/3024836?hl=en-GB .

**i18n:** nu există directoare/cataloage de localizare; textele sunt încă hardcodate în HTML/JS, inclusiv aria-label, stări, exporturi. Este nevoie de inventar automatizat și localizare completă, nu numai schimbarea `<html lang>`.

**Indicatori:** datele statistice actuale sunt **geometrii/roluri și clasificări**, nu o bază de observații oficiale în timp. Trebuie definite sursele INS/BNS, temporalitatea, licențele și bridge-ul de identitate înaintea unei hărți de populație. Separă setul nou de ACTUAL.

**Legendă/vizualizări salvate:** există legendă și URL/share/recent; nu există încă o interfață oficială de preseturi cu CRUD. Extindere controlată, fără colectarea GPS și fără salvarea masivă a coordonatelor.

**Exporturi amânate:** P8.4 a evaluat și amânat exportul relațiilor P8.2 și al geometriei derivate P8.3; nu le descrie în UI ca disponibile până la contract nou.

## 7. Profilare și limite ale auditului

Lipsa unui browser live în această rundă înseamnă: **niciun verdict nou** privind fonturile la 200%, aspectul în landscape, performanța pe telefon, interoperabilitatea KML/KMZ, importul în Google My Maps sau afișarea efectivă la zoom mare. Testele P9.0.9.5 existente și cele 23 check runs de pe `main` sunt dovadă retrospectivă, nu aprobare a unui design viitor.

Resurse de evaluat la WEB-R5: `public/data/actual-entities.json` (~15 MB blob în repository), `public/geo/current/ro-administrative.geojson` (~45 MB), `public/geo/actual/ro-local.geojson` (~37 MB), altele progresive. Dimensiunea brută nu demonstrează latență utilizator; trebuie măsurate efectiv transferurile cold/warm, cache, parse, CPU și heap înainte de optimizare. Nu reduce coordonate master.

## 8. Priorități, proprietari, dovezi

| ID | Constatări/cerință | Clasă | Severitate pentru plan | Etapă |
|---|---|---|---|---|
| R0-01 | Subtitle/README depășite | Document/UI confirmat | P2 | R1a / docs |
| R0-02 | Inconsistență X vs Închide, clase butoane | Design observat | P1 | R1a/R1b |
| R0-03 | Accordion neuniform și structură lungă | Design observat | P1 | R1b |
| R0-04 | Rail fără grupare primar/instrument/secondary | Design observat | P1 | R1b |
| R0-05 | Fără buline și filtru `admin_level` OSM | Funcție lipsă | P1 | R2a/R2b |
| R0-06 | Ambiguitate OSM admin vs nivel statistic | Risc semantic | P0 | R2a/R2b |
| R0-07 | Fără KML/KMZ și preflight My Maps | Funcție lipsă | P1 | R4a/R4b |
| R0-08 | Fără i18n RO/EN | Funcție lipsă | P2 | R6a/R6b |
| R0-09 | Fără indicatori statistici observaționali | Funcție lipsă | P2 | R7a/R7b |
| R0-10 | Performanță pe mobil neprofilată acum | Dovadă de completat | P2 | R5 |
| R0-11 | Versiune web metadata în urma funcțiilor | Release bookkeeping | P2 | R8 |
| R0-12 | PR-uri Draft vechi/security governance | Întreținere | P2 | Audit separat |

P0 = invariantă blocantă, P1 = prioritate produs, P2 = optimizare/întreținere; aceste valori nu pretind că există incidente runtime active.
