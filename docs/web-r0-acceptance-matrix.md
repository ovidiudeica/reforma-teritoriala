# WEB-R0 — criterii de acceptare și matrice de regresii

**Natură:** contract pentru PR-urile viitoare; acest document nu afirmă că testele viitoare au fost rulate.  
**Baseline:** `main` `e2055e88b228d40780a1a013c80e1f70dd870edb`.  
**Normă:** numai dovezile de pe HEAD-ul exact permit schimbarea statutului din `TODO` în `PASS`.

## 1. WEB-R0, docs-only — gate de închidere

| ID | Obligație | Metodă / dovadă | Stare R0 |
|---|---|---|---|
| R0-G01 | Branch nou plecat din `main` SHA consemnat, fără mutation | GitHub refs și compare | De verificat la PR |
| R0-G02 | Numai fișiere `docs/` / `README.md` schimbate; fără `data/`, `public/`, cod, workflow, geometrie | `compare_commits`/PR filenames | De verificat la PR |
| R0-G03 | Invariante: 5.848 entități, ACTUAL snapshot/fingerprint neschimbate | Zero diff pe pathurile protejate | De verificat la PR |
| R0-G04 | P9.1: `false / BLOCKED_INCOMPLETE / false` | Nicio schimbare în politici/manifest/date | De verificat la PR |
| R0-G05 | Documente: specificație, audit cu clasificări, matrice de acceptare, pointer README | GitHub blob read + review | De verificat la PR |
| R0-G06 | Required checks pe același HEAD, CodeQL, protecția branchului și fără security blocker nou | GitHub check runs, review și registry, dacă accesibil | Așteaptă CI |
| R0-G07 | Integrare doar după trecerea tuturor gate-urilor, urmată de audit post-merge | PR status și main checks | Neexecutat |

Nu efectua cleanup și nu închide PR-uri Draft fără audit separat.

## 2. Contracte de interacțiune — aplicabile tuturor etapelor

| ID | Caz de test | Criteriu minim |
|---|---|---|
| CORE-01 | Stare inițială | Bifate doar contururile proprii RO, MD, NI; nicio geometrie copil bifată implicit; fără selecție/overlay sau card necerut |
| CORE-02 | Arbore | Disclosure doar extinde; click nume doar selectează; checkbox doar comută un contur propriu; nicio propagare la copii |
| CORE-03 | Straturi | Listează/controlează aceleași contururi și role-uri ca arborele; independent de filtre; NI root/grupări proprii și cele 85 de roluri reutilizate fără duplicate |
| CORE-04 | URL | Restore, Back/Forward, refresh, share v1/v2, parametri invalizi, canonicalizare; exclus `NI` source-only din namespace-ul identităților ACTUAL |
| CORE-05 | Filtre | Modificarea filtrelor nu schimbă bifele; activarea unui părinte nu activează descendenții; nivel statistic și admin OSM rămân independente |
| CORE-06 | Card | Deschidere în contextul selectat, focus/scroll, close, echivalență desktop/mobil, detalii OSM fără promovare juridică |
| CORE-07 | Accesibilitate | `Tab`, `Shift+Tab`, `Enter`, `Space`, `Escape`, focus return, `inert`, axe ARIA coerente, nume accesibile, hit test `>=44×44` pentru butoane |
| CORE-08 | Map | Singură instanță Leaflet, zoom/pan/fit/basemap independent, atribuirea OSM și scara vizibile, fără overlap în card |
| CORE-09 | Security/data | 5.848 identități, 85 roluri reutilizate, 8 contururi NI source-only, fără modificări la corpusurile protejate; export fără XSS/path injection |
| CORE-10 | Vizual | 200% text, 4 orientări/situații reprezentative, forced-colors și reduced-motion; capturi înainte/după; niciun element focusabil decupat |

## 3. WEB-R1 — Design System și panouri

- **R1-01 — text:** fiecare categorie de text mapată la token semantic; fără font-size arbitrar suplimentar în module; toate stările aria/erori/traduceri urmează aceleași roluri. Contrast măsurat, inclusiv erori, legende, disabled, focus.
- **R1-02 — button:** primary/secondary/tertiary/danger/icon-only în toate panourile; clase fără coliziuni; icon-only au aria-label, SVG non-verbal ascuns, dimensiune tactilă și tooltip unde se aplică. `X` pentru close panel/detail, cu consecințe și nume accesibil exacte.
- **R1-03 — accordion:** panourile au antet fix; secțiuni expandabile independente, `aria-expanded`/native details și control tastatură; conținutul esențial și erorile critice nu sunt ascunse; navigarea virtualizată rămâne performantă.
- **R1-04 — rail:** comenzi principale Entități/Căutare/Straturi/Filtre, instrumente subordonate, Mai multe accesibil pe mobil; `id`/handlers/status/focus invariabile.
- **R1-05 — map rail:** zoom +/−, fit, raster OSM; nu se confundă fit/geometry-reset. Nu se schimbă implicit ce încadrează `map-home` fără design review și teste.
- **R1-06 — mobile/card:** sheet `peek`, `half`, `expanded`, scroll corect, attribution, scale, controls, keyboard și 200% text, mai ales 640×360, 360px și mobile landscape.

## 4. WEB-R2 — admin_level OSM

- **R2-01 — census înainte de cod UI:** audit read-only per ID RO/MD/NI cu valoare OSM brută, sursă, timp/versiune, cardinalitate, cazuri `null`, lipsă sau conflict. Hash și număr de cazuri, fără modificare ACTUAL.
- **R2-02 — badge:** număr din contractul verificat, nu din ierarhia UI; vizibil lângă nume, înaintea lui; etichetă non-cromatică și pentru screen-reader; caz lipsă explicat, fără valori implicite inventate.
- **R2-03 — filtre separate:** multi-select `Nivel administrativ OSM` și `Nivel statistic` rămân semantic distincte; arborele poate filtra rezultate fără să atingă bifele; filtrul hărții afectează numai geometriile bifate; prezentare explicită.
- **R2-04 — batch explicit:** utilizatorul cere clar `Afișează/Ascunde nivelul` și vede jurisdictia/numărul de contururi; no-op pentru indisponibile; cancel/undo/reset stabil; fără activări la simplu expand/click nume.
- **R2-05 — roluri unice:** statistic administrativ coalesced randat o singură dată, NI source-only separat; nu alterează `geometryVisible()` arbitrar. URL/history versionat dacă sunt necesare câmpuri noi.

## 5. WEB-R3 — legendă, ghid, preseturi

- Legendă reactivă pe contururile efectiv afișate, niveluri/categorii, fără contori inflatați de rolurile reutilizate; accesibilă cu și fără OSM raster.
- Preseturi locale create explicit, nume valide, CRUD, import/export configurații doar după contract, fără stocare GPS; compatibilitate cu URL/share și fallback fără storage.
- Ghidul contextual explică 1) selectare vs bifare; 2) nivel OSM vs statistic; 3) diferența sursă OSM/identitate oficială; 4) limitele măsurării și exportului.

## 6. WEB-R4 — KML/KMZ / Google My Maps

| ID | Test | Criteriu |
|---|---|---|
| R4-01 | KML XML | Document KML valid, UTF-8, escapare XML, fără script/HTML nesigur |
| R4-02 | Coordonate | EPSG:4326 `longitude,latitude`, lat/lon finite, ordonare și precizie sursă fără transformare |
| R4-03 | Poligoane | Inele exterioare/interioare, multipart, puncte/închidere, fără simplificare sau reparare tacită |
| R4-04 | KMZ | ZIP corect cu KML importabil, nume de intrări controlate și verificare decomprimare |
| R4-05 | Preflight My Maps | KML necomprimat `<=5 MB`, max `2.000` elemente de import recomandate, avertisment MultiGeometry și incompatibilități; refuz sau partiționare explicată când depășește limita |
| R4-06 | Proveniență | Pentru RO/MD identitatea ACTUAL certificată după contract; NI source-only fără atribuiri juridice, 85 roluri fără duplicate; licență OSM ODbL și disclaimer |
| R4-07 | Domeniu | Selecție unică, set explicit, geometrii vizibile; contur lipsă/invalid produce eroare clară, nu poligon aproximativ |
| R4-08 | Compatibilitate | Teste parsare GIS independente, dezarhivare ZIP, import manual într-o hartă My Maps de test; nu declara compatibilitate reală pe baza testului de unitate |

Sursa limitelor: https://support.google.com/mymaps/answer/3024836?hl=en-GB . În limita de 5 MB este vizat conținutul **necomprimat**, nu mărimea fizică KMZ.

## 7. WEB-R5 — performanță

Stabilește baseline cold/warm pe Chrome desktop + emulare throttling mobil, raportând transfer efectiv, număr cereri, timp până la hartă interactivă, afișare geometrii, timp de selectare/bifare, scroll tree, JS heap/GC și fetch dedup. Targete de regresie setate **după** baseline, nu inventate. Optimizările păstrează geometriile fără simplificare master, fidelitatea, hashes și contractele de resursă. Compară A/B reproducibil.

## 8. WEB-R6 — RO/EN

Toate stringurile vizibile și accesibile au chei de traducere; catalog complet `ro`/`en`, fallback testat; numele proprii nu sunt traduse automat; formatarea prin `Intl` și `lang` actualizate; utilizatorul poate comuta din oricare panou fără pierderea selecției; nu apare overflow la texte englezești lungi.

## 9. WEB-R7 — statistici

Schema observațiilor, indicator, valoare, unitate, an/perioadă, sursă/licență și bridge oficial sau `unmatched` explicit. Testează valori lipsă, tip numeric, unități, comparabilitate temporală și schimbări de limite. Tabel/grafic/choropleth doar cu valori validate și cu legendă/ani/source. Nicio valoare inventată, nicio agregare fără metodologie.

## 10. WEB-R8 — release final

- Un nou release **web** cu metadata/proveniență coerente fără schimbarea tagului/fingerprintului ACTUAL.
- Suite completă Linux + browser cu **10 viewport-uri**: `360×640`, `390×844`, `430×932`, `600×390`, `640×360`, `844×390`, `768×1024`, `899×768`, `900×768`, `1440×900`; mobile peek/half/expanded, text 200%, forced colors, reduced motion, keyboard/touch, animație map, scroll, URL/history și raster OFF.
- Required checks, CodeQL și registrul alertelor verificate individual; dovada `actual-change-reproducibility` și auditul diferențelor între Git source/Pages bytes; screenshoturi și coordonate comparabile A/B.
- Nu integra PR dacă HEAD s-a schimbat după ultima execuție sau dacă există checks FAIL/PENDING și dovezi lipsă. După merge, verifică Pages pe exact merge SHA, cu auditul de rețea și browser publicat.
- Raport explicit ce a fost verificat automat, ce a fost verificat manual pe dispozitiv fizic și ce NU a fost verificat; nu pretinde certificare WCAG fără evaluare completă.
- P9.1 rămâne `BLOCKED_INCOMPLETE`, independent de succesul release-ului web.

## 11. Template concis pentru următoarea sesiune Codex

> Lucrează în `ovidiudeica/reforma-teritoriala`, pornind de la HEAD-ul actual al `main`. Citește **`docs/web-modernization-roadmap.md`**, **`docs/web-r0-interface-audit.md`**, **`docs/web-r0-acceptance-matrix.md`**. Execută **un singur lot** [WEB-R1b / WEB-R2b / WEB-R4b etc.] într-un branch/PR nou, cu A/B Chromium, dovezi și toate gate-urile. Nu modifica ACTUAL, nu atinge P9.1 și nu folosi TinyFish sau Desktop Commander. Raportează SHA, schimbări, teste și blocaje; nu integra decât după toate verificările.
