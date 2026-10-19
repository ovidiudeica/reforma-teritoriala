# WEB-R2c.0 — audit UX și planificarea evoluției următoare (read-only)

**Statut:** AUDIT/ROADMAP ONLY — fără implementare, fără schimbări de interfață ori date.
**Bază imutabilă:** `main@18bf1440267e0e76e657062e20050d4f60096d59`, după integrarea PR #383 (audit WEB-R2b). Data evaluării: 2026-10-19.
**Obiectiv:** planificarea clarității, accesibilității și scalabilității UI-ului deja acceptat, fără schimbarea comportamentului implicit sau a semnificațiilor datelor.

## 1. Dovezile și delimitarea auditului

- WEB-R2b.1 / #380: buline numerice OSM; WEB-R2b.2 / #381: filtru multi-select; WEB-R2b.3 / #382: afișare/ascundere explicită + confirmare + Undo.
- PR [#383](https://github.com/ovidiudeica/reforma-teritoriala/pull/383) este **MERGED**, merge SHA `18bf1440267e0e76e657062e20050d4f60096d59`. Cele **13/13 CI** pe HEAD-ul exact al auditului `23d1eadb4685a41988abfffb303bf7801ab5d88d` sunt `SUCCESS`.
- Auditul [WEB-R2b live Chromium](https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/39222867772) a raportat **17 verificări PASS**, **14 capturi**, zero erori raportate, pe **1440×900** și **390×844**, împotriva GitHub Pages, nu a unui server local; [artefactul](https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/39222867772/artifacts/12172850445) are digest SHA-256 `0514b8ff585d2bcb9728330db44b78b964be8d6ceefd4533368f19aa53df4f4b`.
- Verificare read-only curentă a GitHub Pages: resursele `app.js`, `atlas-filters.mjs`, `atlas-osm-admin-filter.mjs`, `atlas-osm-level-geometry-actions.mjs`, manifestul și gate-ul ACTUAL sunt disponibile. Nu există dovadă nouă de defect funcțional blocant.
- Sursele inspectate: `app.js`, `atlas-filters.mjs`, `atlas-osm-admin-filter.mjs`, `atlas-osm-admin-badges.mjs`, `atlas-osm-level-geometry-actions.mjs`, `atlas-tree.mjs`, `atlas-tree-window.mjs`, `atlas-url-state.mjs`, `atlas-mobile-ui.mjs`, `atlas-panel-content.css`, `scripts/audit/web-r2b-final-pages-browser.mjs`, contractele `docs/contracts/web-r2a3-osm-admin-level.json` și `docs/web-r2b3-explicit-osm-level-actions.md`.

**Concluzie verificată:** WEB-R2b este acceptat end-to-end pentru scenariile și rezoluțiile testate. Cele de mai jos sunt riscuri, decalaje de explicabilitate sau extinderi de acoperire, **nu erori demonstrate**. Auditul WEB-R2c.0 nu certifică testarea pe dispozitiv fizic ori pe toate combinațiile de accesibilitate.

## 2. Inventar semantic invariant

| Context | Înregistrări | Niveluri OSM | Politică |
|---|---:|---|---|
| ACTUAL RO | 3.246 | 2/4/8/9, 12 null | Folosește numai `representation.admin_level`; fără inferențe |
| ACTUAL MD | 2.602 | 2/4/7/8/9, 6 null | Separare juridic/OSM păstrată |
| NI source-only | 8 | 3×1, 5×7 | Contururi cu bife proprii; provenance version-pinned |
| Roluri NI reutilizate | 85 | 4×1, 8×84 | Aliasuri de prezentare; **0 identități ACTUAL noi și 0 geometrii duplicate** |
| Registru | 5.941 | 5.848 ACTUAL + 8 contururi + 85 roluri | Număr de *înregistrări*, nu număr de poligoane independente |

**Protecții obligatorii:** snapshot ACTUAL `actual-a9e5a4ddcb5277ef`; fingerprint semantic `a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446`; `actual_mutation_allowed=false`, `p91_import_allowed=false`, `semantic_acceptance=BLOCKED_INCOMPLETE`. NICIUN subpas R2c nu ridică aceste blocaje.

## 3. Probleme de proiectare de verificat (clasificare, nu defecte confirmate)

| ID / Prioritate | Observație ancorată în cod | Risc pentru utilizator | Verificare propusă |
|---|---|---|---|
| UX-01 / P1 | În `atlas-filters.mjs`, „Toate nivelurile / Niciun nivel” modifică vizibilitatea *rândurilor din arbore*, în timp ce „Afișează/Ascunde geometriile nivelurilor selectate” modifică explicit *bifele contururilor*. | Confuzie între „filtru” și „acțiune asupra hărții”; clicuri fără efectul așteptat | Interviu/task-based, audit de copy și etichete; fără schimbare semantică |
| UX-02 / P1 | Filtrul OSM arată nivelurile numerice, dar nu oferă în acel loc cardinalități distincte „entități potrivite / strămoși de navigare / geometrii eligibile” (acestea nu sunt interschimbabile). | Scope-ul exact al unui nivel mare este greu de anticipat | Recensământ runtime deduplicat RO/MD/NI; definirea în raport a numeratorului și numitorului |
| UX-03 / P1 | Planul de confirmare din `atlas-osm-level-geometry-actions.mjs` este tranzacțional, protejat contra stării stale; confirmarea este un grup inline, nu un dialog cu focus dedicat. | Ordinea de focalizare, tastatura, cititorul de ecran și mesajele live au nevoie de verificare pe traseu complet | Prototip/specificație focus-before/after, tab-order, Escape, anunțuri `aria-live`, fără a transforma implicit acțiunea |
| UX-04 / P2 | La `Niciun nivel`, arborele poate afișa zero rânduri; din codul `atlas-tree.mjs` nu rezultă un mesaj contextual dedicat de empty state. | Un utilizator poate interpreta panoul gol ca lipsă de date | Test UX și eventual text explicit „Niciun nivel selectat; geometriile nu au fost șterse” |
| UX-05 / P1 | Nivelurile 8/9 acoperă mii de înregistrări ACTUAL (3.180+982 nivel 8; 11+1.571 nivel 9), pe lângă aliasurile NI. | Încărcare/randare lentă, solicitări de date în rafală la acțiuni colective | Profilare Chromium cu număr fetch, TTI/input responsiveness, memorie, operațiuni parțiale/Undo; bugete stabilite după baseline |
| UX-06 / P2 | Auditul live WEB-R2b a acoperit două viewport-uri și scenarii specifice, nu întreaga matrice de zoom 200%, forced-colors, landscape compact sau tastatură exclusivă. | Regresii de accesibilitate și layout pot scăpa testelor existente | Matrice extinsă orientată pe risc, capturi A/B și verificări semantice |
| GOV-01 / P1 | `docs/contracts/web-r2a3-osm-admin-level.json` păstrează `SPECIFICATION_ONLY` (corect istoric), iar unele fragmente ale documentului vechi descriu faza anterioară implementării URL. | Neclaritate între documentul istoric și adevărul normativ curent | Supliment contractual versionat pentru starea *implementată*, păstrând intacte dovezile istorice |
| UX-07 / P2 | Undo în `app.js` este tranzacție în memorie; Back/Forward restaurează starea din URL, iar resetarea geometriei invalidează undo. | Așteptări divergente despre durata Undo și revenirea după reload | Mesaj informativ de persistenta în help; teste reload/back/forward/reset și modificări individuale ulterioare |

### Ce NU se recomandă ca „remediere” în WEB-R2c

Nu se combină filtrele statistice cu nivelurile OSM; nu se bifează descendenții la extindere; nu se creează checkbox-uri sau poligoane pentru aliasurile NI; nu se modifică valorile OSM necunoscute; nu se schimbă selecțiile implicite RO/MD/NI; nu se redesenează geometrii ori importă ACTUAL. Nu se declară „eroare” o observație de utilizabilitate fără un test de reproducere.

## 4. Roadmap propus, în PR-uri independente

| Etapă | Tip | Livrabile | Gate de ieșire |
|---|---|---|---|
| **WEB-R2c.0.1** | Evidence-only | Închiderea CI și integrarea controlată a prezentului raport, fără schimbări UI | Toate checks pe HEAD exact, doar documentație și contract |
| **WEB-R2c.1** | Spec + read-only affordances | Vocabular separat „Filtrează arborele” vs „Vizibilitatea geometriilor”; cardinalități cu denominatori expliciți și proveniență; empty-state recomandat | Snapshot semantic neatins, fără schimbări de checkbox/URL |
| **WEB-R2c.2** | UX/ARIA, branch separat | Ordine de focus și confirmare previzibilă; progresivitate în panoul mobil; feedback după show/hide/Undo; CSS responsive | Tastatură-only, cititor de ecran/ARIA, 200% zoom, forced-colors, contrast; desktop+mobil A/B |
| **WEB-R2c.3** | Profilare și hardening | Instrumentare și praguri bazate pe benchmark pentru niveluri mari 8/9; limitare fan-out și scenarii anulare/Undo | Nu degradează încărcarea, nu apar dubluri NI, fără mutații ACTUAL |
| **WEB-R2c.4** | Audit final de acceptare | Scenarii combinate filtre + comenzi + History + Undo + reset/URL/refresh pe Pages la viewport-uri extinse | Exact-SHA 13/13 sau lista curentă obligatorie; capturi, provenance, Pages, zero drift |

**Nu se autorizează automat WEB-R2c.1–R2c.4** prin integrarea auditului. Fiecare etapă solicită autorizare separată, branch, PR Draft, verificare exact-SHA, capturi browser și integrare condiționată.

## 5. Matrice de acceptare viitoare (criterii nedisponibile în prezent = „not yet audited”)

1. **Identitate:** RO=3.246, MD=2.602, NI=8 contururi, 85 roluri overlay, fără duplicări/atribuiri juridice.
2. **Separația stărilor:** bifarea unui nivel OSM restrânge arborele, nu geometriile; navigarea/expandarea nu activează descendenți; selecția entității nu implică vizibilitate.
3. **Acțiune explicită:** în previzualizare, scope-ul RO/MD/NI este determinist și are confirmare separată, iar un plan stale se anulează atomic.
4. **Undo/History:** Undo păstrează editările individuale ulterioare; Back/Forward restaurează `a`/`o`/`x` fără modificarea geometriilor-sursă; URL-urile vechi rămân acceptate.
5. **Accesibilitate:** etichete numerice anunțate, focus vizibil, ordine Tab, Escape/Cancel, mesaje live, forced-colors și 200%; rezultate automatizate plus examinare manuală, nu doar existența atributelor ARIA.
6. **Responsive:** 1440×900, 1280×800, 900×768, 430×932, 390×844, 360×800 și 390×600 / landscape compact; fără suprapuneri, targeturi sub 44 px sau clipping al confirmării.
7. **Performanță:** nivel 8 și 9 cu numărul de requesturi și durata comparate cu baseline stabilit înainte de schimbarea UI; fără fan-out necontrolat/duplicate downloads.
8. **Securitate și proveniență:** nicio schimbare `data/`, `public/data/`, `public/geo/`, manifest sau fingerprint; gate P9.1 blocat.
9. **Gate integrare:** toate workflow-urile obligatorii `SUCCESS` pe HEAD exact, diff aprobat, Ready → merge pe SHA verificat, apoi audit CI post-merge și Pages pe asseturile publicate.

## 6. Decizie a auditului

**WEB-R2c.0 = READY FOR REVIEW (documentație).** Recomandarea este **WEB-R2c.1** ca următorul pas de specificație/claritate, inițial tot read-only: întâi definirea numărătorilor și a microcopy-ului, abia apoi orice modificare UI autorizată separat.

Nu am implementat funcționalități și nu am identificat un defect confirmat ce ar cere hotfix imediat. Toate intervențiile de mai sus sunt propuneri cu criterii verificabile, nu acorduri pentru modificarea funcțiilor acceptate.


## 7. Inventarul componentelor și al instrumentelor — trasabilitate la sursă

Recensământ făcut prin inspecție statică pe \`main@18bf1440\`; enumerarea componentelor nu este dovadă a funcționării lor interactive. Definițiile canonice ale panourilor se află în [atlas-panels.mjs](https://github.com/ovidiudeica/reforma-teritoriala/blob/18bf1440267e0e76e657062e20050d4f60096d59/atlas-panels.mjs), iar structura HTML în [index.html](https://github.com/ovidiudeica/reforma-teritoriala/blob/18bf1440267e0e76e657062e20050d4f60096d59/index.html).

| Panou / instrument | Element tehnic | Funcție și delimitare de responsabilitate |
|---|---|---|
| Entități | \`entities-panel\`, \`atlas-tree.mjs\` | Arbore cu extindere, checkbox geometric independent, selectare card și badge OSM; \`geometries-reset\` în rândul comun Reset |
| Căutare | \`results-panel\`, \`atlas-search.mjs\` | Căutare contextuală și rezultate navigabile; nu este selector geometric global |
| Filtre | \`filters-panel\`, \`atlas-filters.mjs\` | Jurisdicții, tipuri/subtipuri, niveluri statistice și OSM; \`filters-reset\` în același rând Reset |
| Straturi vizibile | \`visible\`, \`atlas-advanced-dialog\` | Inventarul stării straturilor; distinct de bifa unei entități |
| Entități recente | \`recent\`, \`atlas-advanced-dialog\` | Acces la selecțiile recente |
| Compară entități | \`compare\`, \`atlas-advanced-dialog\` | Comparația vizuală a două entități |
| Partajare | \`share-panel\`, \`atlas-share.mjs\` | URL partajabil și stare serializată |
| Informații despre hartă | \`atlas-info-dialog\` | Metodologie, proveniență, nivel de detaliu și legendă |
| Module atlas | \`modules-panel\` | ACTUAL activ; ISTORIC și PROPUNERI indisponibile, fără deblocare implicită |
| Identifică teritoriul | \`identify-panel\` | Punct/coordonnate, separat de selectarea poligoanelor și de stabilirea identității legale |
| Vecini | \`neighbors-panel\` | Contacte topologice și evidențiere |
| Măsoară | \`measure-panel\` | Măsurare pe hartă și introducere WGS84 |
| Controale hartă | \`atlas-map-controls.css\` și Leaflet | Zoom, încadrare, fundal OSM separat, resetare geometrie pe hartă, scară și atribuire |
| Card entitate / sheet mobil | \`atlas-mobile-ui.mjs\`, \`atlas-identify-ui.mjs\` | Detalii contextualizate; \`peek\`/\`half\`/\`expanded\` pe mobil |
| Arbore virtual | \`atlas-tree-window.mjs\` | Rânduri calculate, \`overscan=4\`, minim 44 CSS px, poziții măsurate; **deja virtualizat** |
| URL / History | \`atlas-url-state.mjs\` | \`parse\`/\`normalize\`/\`serialize\`, \`pushState\`/\`replaceState\`, \`popstate\` și protecție la restaurări asincrone |
| Acțiuni OSM | \`atlas-osm-level-geometry-actions.mjs\` | Preview, verificare stare stale, aplicare atomică la checkbox-uri, Undo cu protejarea editărilor ulterioare |
| Prezentare | \`atlas-design-tokens.css\`, \`atlas-r1b-ui.css\`, \`atlas-panel-content.css\`, \`atlas-tree.css\` | Tipografie, culori, focus, \`forced-colors\`, targeturi de 44 px în zonele declarate; verificarea reală a contrastului rămâne deschisă |

Nu se echivalează existența unui panou sau a unui atribut ARIA cu aprobarea unui scenariu complet. Recensământul de mai sus nu autorizează eliminarea ori reorganizarea funcțiilor.

## 8. Matrice de conformitate cu contractele acceptate

Legendă: **S** = susținut de sursă la SHA fix; **E** = scenariu trecut în auditul browser *precedent* #383 (nu rerulat în acest PR); **D** = verificare dinamică suplimentară încă deschisă.

| Contract | Verificare | Evidență / limită |
|---|---|---|
| RO+MD+NI afișate implicit | E / S | Acoperit în baseline WEB-R2b; browserul curent nu a restaurat starea fresh |
| Checkbox individual independent | S / E | \`atlas-tree.mjs\`; audit E2E #383 |
| Deschidere/restrângere arbore fără bifare implicită | S / E | \`atlas-tree.mjs\`; matrice extinsă pentru tastatură D |
| Buline numerice OSM, fără inferență | S / E | \`atlas-osm-admin-badges.mjs\` și \`docs/contracts/web-r2a3-osm-admin-level.json\` |
| Filtru OSM multi-select separat de nivelul statistic | S / E | \`atlas-filters.mjs\`, \`atlas-osm-admin-filter.mjs\` |
| Filtrarea OSM restrânge doar rândurile arborelui | S / E | \`osmTreeVisibleIds\`; mențiune explicită în UI |
| Afișare / Ascundere numai prin comandă explicită | S / E | \`atlas-osm-level-geometry-actions.mjs\` |
| Preview scope + confirmare + cancel | S / E | \`atlas-filters.mjs\`; focus/announcements D |
| Undo fără suprascrierea editărilor manuale ulterioare | S / E | \`undoOsmLevelGeometryAction\`; cazuri complexe suplimentare D |
| 85 aliasuri NI excluse din schimbările MD implicite | S / E | Guard \`view-nistrenia-role-\`; registrul OSM și #383 |
| Filtru statistic independent | S / E | \`atlas-filters.mjs\`, #383 |
| Reset în poziții consecvente | S / D | \`atlas-panels.mjs\` deține \`atlas-panel-reset-actions\`; capturi A/B noi D |
| Fundal OSM separat de geometrii | S / E | \`atlas-map-controls.css\`, baseline browser anterior |
| Back/Forward, stare serializată și URL vechi | S / E | \`atlas-url-state.mjs\`; reload, share URL și intervenții simultane D |
| Responsive, targeturi, tastatură, screen reader | S / E parțial / D | CSS, focus și teste 1440×900/390×844; tabletă/zoom/contrast manual D |
| ACTUAL imutabil, Nistrenia fără geometrii duplicate, P9.1 blocat | S / E | Gate-urile istorice și diff exclusiv documentar; recertificarea la fiecare PR viitor obligatorie |

## 9. Registru diferențiat — defecte, inconsecvențe și preferințe

**Defecte funcționale confirmate în WEB-R2c.0: 0.** Nu există reproducere nouă pentru o regresie de runtime. Un rezultat PASS istoric se raportează întotdeauna ca istoric.

**Neconcordanță de copy confirmată prin surse — UX-08 / P1 / documentație UX:** în \`index.html\`, panoul Filtre afirmă „Filtrele limitează geometriile deja bifate în arbore”, iar \`atlas-filters.mjs\` descrie în aceeași interfață filtrul OSM: „Restrânge doar rândurile arborelui. Nu modifică bifele sau geometriile”. Aserțiunile nu au același domeniu, astfel pot genera o așteptare greșită, fără a demonstra vreo funcționare incorectă. **Criteriu:** specificația WEB-R2c.1 precizează scope-ul distinct al fiecărui filtru; modificarea textului din aplicație cere aprobare ulterioară.

**Riscuri documentate, neconfirmate ca defecte:** UX-01…UX-07 și GOV-01 din §3; fiecare este condiționat de o reproducere sau măsurătoare clară. **Preferințe/opțiuni fără necesitate demonstrată:** schimbarea formelor bulinelor, culoarea iconurilor, mutarea panourilor, dialog modal în loc de confirmare inline, comasarea butoanelor, schimbarea modelului de virtualizare. Nu devin cerințe fără scenarii de utilizare și aprobare.

## 10. Prioritizare P0/P1/P2 și dependențe

| Nivel | Propunere | Beneficiu așteptat | Risc și dependență | Acceptare înaintea implementării |
|---|---|---|---|---|
| P0 | **Nicio schimbare de UI indicată de dovezile actuale** | Evită hotfixuri speculative | Apare P0 doar dacă reproducem blocaj, pierdere de selecție/date sau inaccesibilitate critică | Reproducere exactă + dovadă browser + acceptare separată |
| P1 | Distincție terminologică Filtre / Geometrii, UX-01 + UX-08 | Mai puține ambiguități | Dependință: specificație semantică pe fiecare control; copy-only, fără schimbare logică | Textul explică „restrânge arborele” vs „limitează straturi” vs „bifează geometrii” |
| P1 | Definire cardinalități și denominator UX-02 | Previzibilitate înainte de operații masive | Distincție între alias NI, nod strămoș și entitate eligibilă; fără număr dublat | Reconciliere pe corpusul complet; sume RO/MD/NI și exemple verificabile |
| P1 | Specificație tastatură/focus pentru confirmare UX-03 | Predictibilitate accesibilitate | Nu transforma confirmarea în modal fără justificare; necesită traseu keyboard + SR | Focus vizibil, Tab, Escape/cancel și mesaje live validate interactiv |
| P1 | Baseline performanță niveluri 8/9 UX-05 | Detectarea fan-out și latenței | Nu schimba worker, sursele ori virtualizarea fără profil măsurat | Metrici \`fetch\`, long tasks, memorie, input latency; buget fixat din baseline |
| P1 | Supliment documentar GOV-01 | Elimină conflictul istoric/spec actuală | Nu rescrie registrul de proveniență istoric | Contractul implementat indică explicit versiunea și sursa |
| P2 | Empty-state contextual UX-04 | Claritate când arborele e gol | Depinde de UX-01/UX-08 și date filtrate | Mesaj de recuperare; fără checkbox toggles suplimentare |
| P2 | Teste tabletă/landscape/zoom/forced-colors UX-06 | Reduce riscul de clipping și focus ascuns | Necesită Chromium la fiecare viewport, evaluator a11y și A/B | Matrice completă §11 |
| P2 | Explicarea duratei Undo vs History UX-07 | Așteptări corecte după reload/reset | Nu persista tranzacția Undo fără contract nou | Documentația și testele descriu explicit durata și invaliderile |

## 11. Matrice regresii și dovada necesară

| Context | Scenariu obligatoriu | Dovadă minimă |
|---|---|---|
| Desktop 1440×900, 1280×800 | Deschide Entități → extinde rădăcina și un județ/raion → bifează independent → Filtre OSM 3/5 → show/hide preview/cancel/confirm → Undo | Capturi A/B, DOM/ARIA, diferențe bife + URL, consolă/network |
| Tabletă 900×768 și 768×1024 | Rail + drawer/sheet, panel switch, scroll arbore virtual, acțiuni de filtrare și map controls | Capturi A/B la ambele orientări, bounding boxes fără suprapuneri |
| Mobil 430×932, 390×844, 360×800 | Deschide/închide panouri, focus-return, nume lung + bulină, căutare, confirma/anulează, sheet | Capturi A/B de stare inițială, panou, confirmare și după Undo |
| Landscape compact 390×600 și 844×390 | Vizibilitatea comenzilor zoom/OSM/reset, panourilor și acțiunilor cu text lung | Capturi A/B + detectare clipping, scroll accesibil |
| Tastatură 100% | Tab / Shift+Tab / Enter / Space / Esc, expandare arbore, selectare checkbox, închidere și focus return | Trace focus & accesibilitate; rezultatul narativ al pașilor |
| Zoom 200% + forced-colors | Contrast text/focus, buline OSM numerice, targeturi 44 px, reflow | Capturi, computed styles și verificare manuală WCAG |
| Istoric/URL | \`a\`/\`o\`/\`x\`, Back → Forward → refresh → share, reset și Undo independent | URL înainte/după, serializare canonică, invarianta checkbox |
| Acțiuni masive 8/9 | Preview > cancel; confirm; Undo; modificare manuală după confirm; aliasuri NI excluse | Reconciliere număr de schimbări RO/MD/NI, trace fetch/long tasks |
| Actualizare date absentă | Compare diff față de main: doar \`docs/\`, fără \`app.js\`, CSS, JS, geometrie/ACTUAL/P9.1 | Listă fișiere schimbate, SHA fișiere, check-uri exact SHA |

**Regula de evaluare:** pentru fiecare caz se marchează PASS/FAIL/SKIP/BLOCKED separat. Capturile nu certifică singure semantica/performanța, iar testele statice nu devin probe interactive. Verificările deja executate în #383 constituie **baseline anterior**; toate cazurile suplimentare de mai sus sunt **planificate, nu executate** în această operațiune read-only.

## 12. Proveniență și limite ale acestei completări

- **Bază de cod fixată:** [\`main@18bf1440267e0e76e657062e20050d4f60096d59\`](https://github.com/ovidiudeica/reforma-teritoriala/commit/18bf1440267e0e76e657062e20050d4f60096d59). PR-ul documentar rămâne [#384](https://github.com/ovidiudeica/reforma-teritoriala/pull/384), fără permisiune de merge necondiționat.
- **Surse inspectate direct prin GitHub:** \`index.html\`, \`atlas-panels.mjs\`, \`atlas-tree.mjs\`, \`atlas-tree-window.mjs\`, \`atlas-filters.mjs\`, \`atlas-osm-admin-filter.mjs\`, \`atlas-osm-admin-badges.mjs\`, \`atlas-osm-level-geometry-actions.mjs\`, \`atlas-url-state.mjs\`, \`atlas-mobile-ui.mjs\`, \`atlas-tree.css\`, \`atlas-panel-content.css\`, \`atlas-r1b-ui.css\`, \`atlas-design-tokens.css\`, \`atlas-map-controls.css\` și \`scripts/audit/web-r2b-final-pages-browser.mjs\`.
- **Verificare live din sesiunea curentă:** extragere HTML/metadata pentru \`https://ovidiudeica.github.io/reforma-teritoriala/\` prin fetch web, cu titlul „Reforma Teritorială”, limba \`ro\` și meta viewport. **Nu** este test interactiv sau captură vizuală curentă.
- **Browser interactiv curent:** Browser connector indisponibil fără contextul extensiei; Desktop Commander a răspuns cu limită de utilizare; automatizarea TinyFish nu a pornit (sold insuficient). Nu s-au obținut capturi Chromium noi. Capturile #383 și digestul artefactului sunt referințe istorice, nu pretindem o inspecție vizuală nouă a fiecărui fișier PNG.
- **CI pentru #384:** se verifică separat check-runs pe HEAD-ul exact al PR-ului după orice commit nou; \`in_progress\` și \`skipped\` nu pot fi transformate în \`SUCCESS\`. Politica de merge impune toate check-urile obligatorii trecute și auditul diff.
- **Conservare:** această completare este exclusiv documentație în PR #384. Niciun fișier de runtime sau date ACTUAL nu a fost atins. Autorizarea WEB-R2c.1+ rămâne explicit absentă.
