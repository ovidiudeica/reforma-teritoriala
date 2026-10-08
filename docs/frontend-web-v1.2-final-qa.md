# web-v1.2 — QA browser și vizual final

Baseline: `170d30d290e4a7938debf917665741bf67db840b` (PR #246), verificat înainte de lucru. Branch: `web/v1.2.7-final-browser-qa`.

## Mecanism

Suita `scripts/test/frontend-atlas-browser.test.mjs` folosește Chrome headless real prin Chrome DevTools Protocol, cu WebSocket nativ Node. Serverul static HTTP este implementat numai cu module Node; nu se folosește file://, DOM simulat, Playwright sau dependency nouă. App/Leaflet/GeoJSON sunt cele reale, fără test hooks în codul de producție. Runtime.evaluate inspectează DOM/starea controllerelor existente; click și keyboard folosesc Input.dispatchMouseEvent/Input.dispatchKeyEvent. CDP emulează dimensiuni, nu hardware iPhone/Android.

Local: Chrome `154.0.8037.98`, protocol CDP 1.3, Node `24.21.0`. CI: job izolat `frontend-browser-qa`, ubuntu-24.04, Node 24.21.0 și actions pin-uite prin SHA; Chrome preinstalat pe runner, versiunea efectivă în evidence/artifact. Nu se instalează/download-ează browserul și nu se modifică lockfile, bundle-ul offline sau pipeline-ul candidate/release. Browserul runnerului poate evolua; nu se pretinde rendering pixel-identic cross-platform. Leaflet 1.9.4 este încărcat din URL-ul existent, cu SRI; tiles OSM externe sunt auditate, nu înlocuite cu fixtures. Networking-ul browser QA este separat de fazele deterministe ACTUAL.

Rulare locală: `node --test scripts/test/frontend-atlas-browser.test.mjs`. BROWSER_EXECUTABLE poate indica un Chromium deja instalat. ATLAS_QA_OUTPUT alege directorul screenshots/evidence, default temp; ATLAS_QA_URL permite aceeași suită pe Pages. Browserul folosește un profil temporar separat, verificat înainte de cleanup. Nu se folosesc profilul/cookies/tab-urile utilizatorului.

## Viewports și scenarii

Desktop 1440×900 și 1280×800; intermediate 900×768; mobile 360×800, 390×844, 430×932; short 390×600. Bounding boxes reale: fără overflow orizontal, map/panels/drawer/sheet în viewport, attribution vizibilă, controls/sheet hidden fără selecție, selected row în viewport-ul arborelui.

- Search: Iasi, Victoria, Balti/Bălți, SIRUTA/CUATM reale, relation number, MD120; normalization, RO/MD headings, descriptors, option identity, ArrowDown/Up, Enter/Escape, no result.
- Selection: map polygon click, search, tree RO/MD până la depth 5, breadcrumb, clear; unique selected state, details, URL și highlight. Coalesced county/MD114/MD115 rămân un singur rezultat/nod; MD120 oficial și MD121 numai evidence OSM.
- Filters: parent/child/mixed, Toate/Niciuna, RO/MD off/on, statistical level/separate toggle, hidden selected entity și highlight restored. Un chunk real este oprit prin Fetch interception, subtipul dezactivat, apoi răspunsul continuat; render folosește starea curentă.
- URL: complex share restaurat într-un target nou, viewport la precizia contractuală de 5 zecimale, filtre și open branches; Back/Forward fără history loop; invalid/duplicate params canonicalizate.
- Mobile: drawer keyboard/open/close/backdrop, Escape search apoi drawer, disclosure/state persistence, peek/expanded/collapse/close, short viewport, focus restore; provenance/legend disponibile și close accesibil după scroll.
- A11y smoke: skip links reale/focus-visible, combobox/listbox, Tab exclusion pentru hidden controls, AX names pentru map/navigation și skip links, breadcrumb/current, native disclosures și controls. Nu este certificare WCAG sau audit screen-reader complet.
- Console/network: captură Runtime exceptions, console/Log, responses/failed requests; assets fără 404 și core index/hierarchy/manifest/gate fără refetch; fiecare chunk încărcat o singură dată. Pan/zoom/scale și tiles reale verificate.

## Defecte reproduse și corecții

1. Fetch concurent: selecția și sync de viewport puteau încărca același chunk de mai multe ori. Request-urile în curs sunt partajate pentru tiers/chunks/statistical geometry; failure elimină pending-ul pentru retry. Revision check oprește sync-urile stale după await. Geometria încărcată este randată cu filtrele curente. Regresie browser: request count și delayed response.
2. Favicon implicit: browserul cerea favicon.ico inexistent (404). Link explicit data:, elimină request-ul inutil. Regresie: zero asset 404/console errors.
3. Provenance desktop: padding-ul unui anchor inline suprapunea linkul release peste ultima metadata. Inline-flex și margină locală în status corectează layout-ul. Regresie: link.top ≥ metadata.bottom.
4. Drawer mobile: după scroll/focus, close action putea ieși din viewport. Close sticky și scroll-padding păstrează controlul accesibil. Regresie: bounds și elementFromPoint după scroll la capăt.

Corecțiile de fixture QA (matching Iași, key Enter CDP, target bring-to-front/close și viewport rounding) nu sunt contabilizate drept defecte ale aplicației. Nu există redesign/feature nou, refactor semantic, query cache-busting random sau artefacte binare în Git. Cleanup: profile/browser/server temporare închise, fără debug hooks în app și fără modificări ale datelor.

## Evidence și validare

Screenshot-uri: desktop default/selected/filters/search/legend-provenance, toate initial viewports, mobile drawer/peek/expanded/hidden/focus/provenance și short viewport. Inspecția vizuală se combină cu bounds/focus/overflow assertions; nu se folosește screenshot diff fragil. Local evidence este în `outputs/browser-qa` și după merge în directoarele postmerge/Pages indicate de raportul final; CI în artifact `atlas-browser-evidence`, retenție 14 zile. JSON include versiunea browserului, scenariile, screenshots, request/response/console și delayed chunk proof. Imaginile nu sunt commise.

Cele 9 suite Node existente rămân obligatorii. Browser suite este rulată separat pentru count clar; raportul final consemnează Node count, browser count, total și failures. După merge se repetă Node/browser pe main, aceeași suită pe Pages și comparația SHA256 a frontend assets/public index/hierarchy.

ACTUAL/P2: audit SHA256 baseline complet, exceptând fișierele frontend modificate intenționat; geometries, registries, sources, entities, hierarchy și manifest nu sunt modificate. 5848 entities/nodes, 63 roluri, 18 statistical-only, snapshot actual-a9e5a4ddcb5277ef, fingerprint a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446, release/tag actual-v1.2.0 și branch protection trebuie reconfirmate înainte/după merge. Verdictul final și toate checks/deployment proofs se găsesc în raportul aferent PR-ului.

Limitări: Leaflet polygon selection rămâne indirectă pentru keyboard prin search/tree; hardware touch/screen-reader și variații minore cross-platform nu sunt simulate integral. Disponibilitatea tiles OSM externe nu este controlată de repository. Nicio limitare nu justifică ignorarea erorilor JavaScript sau a asset-urilor proprii lipsă.
