# P4.2 — Regresie cartografică Chrome/CDP permanentă

## Contract și scop

Regresia automată `scripts/test/frontend-cartography-browser.test.mjs` rulează cu **Chrome real + Chrome DevTools Protocol**, servind aplicația prin HTTP de pe snapshotul checkout-ului testat. Este integrată ca pas distinct în jobul existent `frontend-browser-qa` pentru fiecare PR către `main` și fiecare push pe `main`; nu înlocuiește cele 32 de teste browser existente și nu adaugă dependențe ori descărcări de browser.

Se verifică sistematic:

1. **5.848 identități × 170 stări = 994.160 predicții de vizibilitate** executate *în contextul browserului*, folosind codul aplicației și un oracle boolean separat. Stările acoperă 4 subseturi de jurisdicții, administrative ON/OFF, toate măștile nivelurilor statistice 1–3, limite separate ON/OFF și cele 21 de subtipuri pe ambele jurisdicții. Se verifică vizibilitatea potențială a fiecărui ID, cardinalitățile și lipsa divergențelor.
2. **Șapte viewporturi** (1440×900, 1280×800, 900×768, 360×800, 390×844, 430×932, 390×600) cu arbore și hartă disponibile, SVG materializat și fără overflow. La fiecare viewport se execută selecție reală cu zoom pentru câte o entitate reprezentativă RO și MD și se verifică ID, URL, breadcrumb, un singur nod apăsat și highlight-ul vectorial.
3. **Filtre în interfață și SVG**: geometria statistică/administrativă consolidată rămâne vizibilă prin `OR`; când ambele roluri sunt inactive geometria dispare; la reactivare reapare. Activarea/dezactivarea jurisdicției RO elimină/restituie conturul selectat. Toggle-ul pentru limite separate ascunde/afișează o entitate `statistical_only` din MD.
4. **Z-order**: pane-ul Leaflet `statistical-boundaries` rămâne deasupra overlay-ului administrativ, cu **18 contururi statistice separate** și cu highlight-ul selecției în pane-ul corect.
5. **Încărcare lazy, tier și cache**: la zoom inițial sub 7 nu există chunk-uri încărcate; selectarea entităților RO local și MD detail aduce chunk-uri prin HTTP la pragurile de zoom; fiecare chunk este solicitat o singură dată, iar schimbarea filtrelor nu relansează cereri de geometrie.
6. **Igienă browser**: zero excepții JS, erori de consolă și eșecuri de rețea pentru aplicație (se exclud explicit eventualele erori ale serverelor externe de tile OSM).

## Executare și dovezi

```sh
node --test scripts/test/frontend-cartography-browser.test.mjs
```

Workflow-ul `.github/workflows/frontend-browser-qa.yml` folosește `ubuntu-24.04`, Node `24.21.0`, Chrome preinstalat (`BROWSER_EXECUTABLE=/usr/bin/google-chrome`), checkout și `actions/setup-node` pin-uite la commit SHA. Noul pas rulează separat de suita existentă, după verificarea sintaxei și înainte de `git diff --exit-code`. Nu rulează testele browser în paralel; fiecare browser are profil temporar izolat.

Artefactul existent `atlas-browser-evidence` include în continuare capturile vechi, iar P4.2 adaugă **`p42-cartography-matrix.json`** și capturi `p42-*.png`; este publicat chiar și când testele eșuează (`if: always()`). Raportul conține identitățile selectate, matricea și rezumatele viewporturilor, filtrelor, cache-ului, ordinii pane-urilor și erorilor.

## Limitări deliberate

Matricea de 994.160 de cazuri demonstrează **contractul de vizibilitate per-ID executat în Chrome**, nu 994.160 capturi sau rasterizări pixel-cu-pixel. Testele DOM/SVG/zoom sunt efectuate pe entități reprezentative din ambele jurisdicții și niveluri, iar auditul binar complet al fiecărui chunk și al tuturor legăturilor geometrice rămâne protejat separat prin **P4.1** (testul Node `frontend-geometry-matrix.test.mjs`).

P4.2 nu modifică **ACTUAL/P2**, geometria OSM/ANCPI, `public/`, `data/`, release manifests, fingerprinturi, registre ori schema URL. Orice schimbare a contractului cartografic necesită actualizarea explicită a testelor și a acestei documentații, nu reducerea aserțiunilor pentru a obține verde.
