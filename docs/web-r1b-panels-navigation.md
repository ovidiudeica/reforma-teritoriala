# WEB-R1b — panouri extensibile și bare de comandă regrupate

**Bază:** `main` `a7cb8f85e4a4361aa8e3be2245f0073bcdaac0aa` (WEB-R1a PR #369).  
**Stare:** implementare în PR de verificat; nu pretinde acceptare finală înainte de CI și audit browser.  
**Arhitectură:** nicio instanță nouă Leaflet, fără framework, fără modificarea ACTUAL sau a stării URL/History.

## Ce s-a implementat

- `atlas-r1b-ui.css` — componentă vizuală unitară pentru tipografie, butoane și secțiuni extensibile, cu chenar, suprafață, hover, focus existent, feedback disabled, ținte minime 44px; menține forced-colors/reduced-motion.
- `index.html` — `#drawer-close` este un buton real cu `×` și `aria-label` explicit; `#details-close` adoptă același aspect, dar își păstrează semantica existentă de ștergere a selecției. ID-urile, acțiunile JS, selectarea și geometria nu se schimbă.
- Rail în ordinea documentului: **Entități → Căutare → Straturi → Filtre → Mai multe (mobil)**, apoi **Identifică → Măsoară → Compară**, respectiv **Recente → Partajare → Informații**. Sunt doar separator vizual între grupuri, cu aria-label individual existente. Meniul „Mai multe” reutilizează proprietarul `atlas-panels.mjs`, Escape/focus/inert, fără o a doua componentă.
- Bara Leaflet rămâne **zoom + / zoom − / fit RO+MD / fundal OSM / reset geometrii**, conform contractului existent; resetul este delimitat vizual, fără schimbarea semanticii sau a bounds/URL. Nu se redenumește fals fit RO+MD drept fit RO+MD+NI.
- Secțiuni `details/summary` native și independente în panourile Entități (numai opțiunile, nu arborele virtualizat), Filtre, Măsoară, Identifică, Module, Partajare și Informații; `#results-panel` și statusurile critice rămân accesibile. Filtrele generate sunt independent expandabile, păstrând aceleași inputuri și callbacks.
- Card: secțiunile de proveniență oficială/statistică/cartografică sunt independente și extensibile. Identitatea oficială este deschisă inițial, informațiile lungi la cerere; acțiunea Zoom și sursa cartografică nu dispar, doar sunt dezvăluite explicit.
- Mobil sub 600px: 4 comenzi frecvente + „Mai multe” (5 ținte >=44px); submeniul folosește grid cu scroll limitat. Landscape compact 600–899px: rail compact și meniu de instrumente pentru a preveni overflow-ul. Pe desktop rămân toate cele 10 controale uzuale (fără „Mai multe”).
- Corecție de focus: deschiderea meniului „Mai multe” trimite focusul la primul instrument nou disponibil, nu la butonul Straturi deja vizibil.

## Garanții / excluderi

- Filtrul `admin_level` OSM și bulinele numerotate urmează WEB-R2, nu sunt introduse „pe ascuns” în acest lot. La fel RO/EN, KML/KMZ și indicatorii statistici.
- `ACTUAL` rămâne immutable: 5.848 identități, geometrii master și fingerprint `a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446` neschimbate. NI are 8 contururi source-only proprii și 85 roluri OSM cu reutilizarea geometriei existente.
- P9.1 rămâne strict `p91_import_allowed=false`, `semantic_acceptance=BLOCKED_INCOMPLETE`, `actual_mutation_allowed=false`. Nicio schimbare la contractele juridice ori API-ul candidate lifecycle.
- Dezvăluirea unei secțiuni nu bifează geometrii, nu schimbă filtre sau selectarea și nu rescrie URL-ul. Ascunderea unei secțiuni nu pierde valorile din formular. Nu introducem state persistente de accordion fără contract propriu.

## Acceptare tehnică

- `node --test scripts/test/frontend-atlas-a11y.test.mjs` și toate suitele cerute de Actions.
- Test Chromium nou: `node --test scripts/audit/web-r1b-layout-browser.mjs` (1440×900, 390×844, 640×360; comenzi reale, close X, target 44px, restore focus, native toggle independent, card).
- Browser QA general: P7.2/P7.6, P9.0.9.5, P8.2/3/4, 10 viewports, forced-colors, text 200%, selecție geometrii și URL/Back/Forward. A/B față de baseline `a7cb8f85`, cu capturi și analiza punctelor de control pe dispozitive.
- Codul CSS și structura sunt verificate după HEAD exact; orice eșec provoacă blocarea PR, cu remedierea cauzei, nu atenuarea testelor. CI `SUCCESS` nu certifică o inspecție fizică Android/iOS.
- Doar merge controlat după toate required checks, CodeQL, review, diferența permisă, A/B acceptat și audit post-merge GitHub Pages.

Referințe: [roadmap](web-modernization-roadmap.md) · [matricea WEB-R0](web-r0-acceptance-matrix.md) · [fundamentul WEB-R1a](web-r1a-design-foundation.md).
