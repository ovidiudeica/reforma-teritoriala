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
