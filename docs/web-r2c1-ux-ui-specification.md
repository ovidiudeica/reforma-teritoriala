# WEB-R2c.1 — Specificație UX/UI pentru claritatea filtrelor și acțiunilor OSM

**Statut:** SPECIFICATION ONLY — document normativ propus, fără implementare și fără aprobare de modificare funcțională.
**Bază exactă:** `main@c2579eb593d7109fa7bbd94f55e02dcc441a61de`, după PR #384; data 2026-10-19.
**Predecesor:** [auditul WEB-R2c.0](web-r2c0-ux-audit-roadmap.md), [registrul constatărilor](contracts/web-r2c0-ux-audit-register.json), [închiderea CI #384](https://github.com/ovidiudeica/reforma-teritoriala/pull/384#issuecomment-6264811350).
**Domeniu:** clarificare de interfață și contract de acceptare pentru UX-01, UX-02, UX-04, UX-08, GOV-01, cu contracte de interfață pregătitoare pentru UX-03, UX-05, UX-06 și UX-07. Nu constituie audit browser nou, design vizual aprobat ori implementare.

## 1. Decizii și principii normative

1. Există trei planuri independente: **(F) ce rânduri apar în arbore**, **(G) bifele geometriilor și contururile de pe hartă**, **(S) nivelurile statistice**. O acțiune F nu produce implicit o acțiune G sau S.
2. Filtrul OSM este **multi-select OR** în interiorul nivelurilor 2/3/4/5/7/8/9 plus `unknown`, păstrând strămoșii necesari navigării; restul filtrelor rămân independente. Eticheta numerică OSM provine doar din date verificate, fără inferență.
3. `Toate nivelurile` / `Niciun nivel` în secțiunea OSM modifică **doar filtrul F**. Nu se schimbă bife, nu se modifică geometria, nu se extind automat subarbori. `Niciun nivel` nu șterge date.
4. `Afișează geometriile nivelurilor selectate` / `Ascunde geometriile nivelurilor selectate` sunt **comenzi G explicite** cu preview și confirmare separate. Sunt eligibile numai ACTUAL RO/MD cu nivel numeric verificat și cele 8 contururi proprii NI (în măsura potrivirii nivelului); cele 85 de aliasuri NI reutilizate sunt întotdeauna excluse de la mutația unor bife suplimentare. `unknown` nu declanșează comenzi colective.
5. Confirmarea aplică un plan validat **atomic**, fail-closed dacă selecția de niveluri sau bifele s-au schimbat între preview și confirmare. Nicio mutație parțială. Undo revine doar asupra ultimei tranzacții G încă reversibile, fără a suprascrie editări manuale ulterioare. Reload, resetul geometriilor și restaurarea URL invalidează tranzacția Undo; Back/Forward nu sunt sinonime cu Undo.
6. Starea implicită și independența RO/MD/NI, structura arborelui, cardurile entităților, fundalul OSM, mecanismul URL/History și toate funcțiile WEB-R2b acceptate sunt invariabile. Nu se schimbă statele `a` (niveluri OSM), `x` (ACTUAL), `o` (contururi NI) ori serializarea v1/v2.
7. Valorile existente pentru ACTUAL, semantica statutelor și proveniența sunt imuabile: snapshot `actual-a9e5a4ddcb5277ef`, fingerprint `a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446`, RO 3.246, MD 2.602, NI 8 contururi independente, NI 85 roluri OSM reutilizate, registru 5.941 înregistrări (NU 5.941 geometrii). `actual_mutation_allowed=false`, `p91_import_allowed=false`, `semantic_acceptance=BLOCKED_INCOMPLETE`.

## 2. Baza de cod și delimitarea dintre existent și propus

| Sursă verificată pe `main` | Comportament existent, demonstrat prin inspecția sursei | Extensie de specificație, NEIMPLEMENTATĂ |
|---|---|---|
| `index.html` — `#filters-panel` (linia 128 la bază) | Introducere generică „Filtrele limitează geometriile deja bifate în arbore” | Text de intrare diferențiat F/G/S |
| `atlas-filters.mjs` — secțiunea `Nivel administrativ OSM` | Filtru multi-select, butoane colective, confirmare inline `role=group`, mesaj `role=status` | Vocabular consecvent, clarificări pentru `unknown`, empty-state și cardinalități |
| `atlas-osm-admin-filter.mjs` | `osmTreeVisibleIds` păstrează potrivirile directe și strămoșii cu descendent admis | Definițiile numărătorilor; nu se schimbă algoritmul |
| `atlas-osm-admin-badges.mjs` | Normalizare numerică numai pentru valori confirmate; suport NI fără atribuire juridică | Explicație accesibilă pentru proveniența nivelurilor și `unknown` |
| `atlas-osm-level-geometry-actions.mjs` | Plan cu `eligible` / `counts` / `changed` / `skippedAliases`, validare stale, apply atomic, Undo protectiv | Expunerea responsabilă a numeratorilor existenți în preview |
| `atlas-url-state.mjs` | `a`, `x`, `o`, `s`, Back/Forward și versiuni v1/v2 | Nicio modificare a URL-ului sau a persistării |
| `atlas-tree.mjs` + `atlas-tree-window.mjs` | Arbore `treegrid` și fereastră virtuală existentă, minim 44 px | Empty-state contextual și contabilizare semantică fără dubluri |
| `atlas-panel-content.css` | Zone click/touch de 44 px și bază pentru forced-colors | Doar criterii de regresie, nu CSS nou în această etapă |
| `docs/contracts/web-r2a3-osm-admin-level.json` | Contract istoric `SPECIFICATION_ONLY`; își păstrează valoarea probatorie | Supliment *post-implementare* distinct; contractul istoric nu se rescrie |

**Decizie GOV-01:** prezentul document și `docs/contracts/web-r2c1-ux-specification.json` reprezintă specificația propusă a evoluției, **nu** o declarație că cerințele UX noi sunt implementate. WEB-R2b.1/2/3 rămân adevărul operațional în cod și teste. Orice realizare ulterioară va avea un contract de implementare/dovezi propriu, separat de această specificație.

## 3. Model de stări și tabel de tranziții (contract de nedependență)

| Gest | Arbore F | Bife G / hartă | Statistici S | URL / History |
|---|---|---|---|---|
| Bifează/debifează un nivel OSM | Se restrâng/lărgesc rândurile, cu strămoșii necesari | Neschimbate | Neschimbate | `a` se poate schimba, `x` și `o` nu |
| „Toate / Niciun nivel” OSM | Numai setul de niveluri active | Neschimbate | Neschimbate | Numai filtrul OSM |
| Extinde/restrânge arborele | Numai navigare | Neschimbate | Neschimbate | Starea navigării `t`, unde este cazul |
| Selectează rând/nume entitate | Detalii/context | Nicio activare de descendenți | Neschimbate | Entitatea selectată `e`, dacă este cazul |
| Afișează/Ascunde — preview | Neschimbat | Neschimbate | Neschimbate | Fără înregistrarea unei mutații geometrice |
| Confirmă preview valid | Neschimbat | Doar subsetul eligibil confirmat | Neschimbate | `x`/`o` după bifele efectiv schimbate |
| Preview stale, Cancel ori 0 schimbări | Neschimbat | Neschimbate | Neschimbate | Fără mutație geometrică |
| Undo tranzacție | Neschimbat | Restabilire selectivă, fără suprascrierea editărilor individuale recente | Neschimbate | Doar starea geometrică rezultată |
| Back/Forward/reload | Starea din URL | Restaurare conform contractului URL | Restaurare conform URL | Nu reconstituie tranzacția Undo |
| Resetare filtre / resetare geometrii | Numai resetul aferent | Numai resetul geometriilor poate schimba bife | Conform resetului de filtre existent | Nu se unifică cele două reseturi |

Tabelul este un criteriu de **non-regresie**: nu autorizează modificări de logică.

## 4. Semantica numărătorilor: UX-02

Pentru un set de niveluri OSM selectate `L`, un corpus validat de noduri `N`, mulțimea `V` a nodurilor permise de **filtrul OSM înainte de orice prezentare sau expansiune vizuală** și rădăcinile corespunzătoare:

- **M — rânduri potrivite direct:** mulțimea ID-urilor de nod ale căror niveluri OSM verificate se află în `L`; pentru categoria `unknown`, se potrivesc doar nodurile fără nivel verificat. **Unitate:** rând de arbore. Un ID se numără o singură dată. Aliasurile NI pot constitui rânduri distincte de navigare, dar **nu** geometrii independente.
- **A — strămoși de navigare:** `A = V minus M`; rândurile păstrate exclusiv pentru a ajunge la descendenții potriviți, deduplicate după ID. **Unitate:** rând de arbore, nu geometrie. `|V|=|M|+|A|` numai pentru arborele complet permis (independent de ramurile extinse/virtualizarea DOM).
- **E — geometrii eligibile:** ID-uri ACTUAL RO/MD sau contururi NI cu nivel numeric confirmat în `L`, identitate geometrică de control unică, după excluderea aliasurilor NI și a `unknown`. **Unitate:** checkbox geometric distinct. Separat pe jurisdicții `E_RO`, `E_MD`, `E_NI`.
- **C — geometrii care și-ar schimba efectiv bifa:** subsetul din E unde bifa curentă diferă de `show` / `hide`. Acesta este `plan.changed`; `C_RO+C_MD+C_NI=C_total`. Numărul `plan.skippedAliases` se raportează separat; nu se adună la E sau C.

**Nu se folosesc ca sinonime:** `|M|`, `|V|`, `|E|`, `|C|`, numărul nodurilor expandate, numărul obiectelor vizibile efectiv pe hartă ori numărul de înregistrări din registru. Suprapuneri, filtrul de jurisdicție, limite statistice coalesced și încărcarea asincronă pot face numărul de geometrii desenate să difere de numărul de bife.

**Reguli de calcul/afișare propuse:** numărătorii pentru F sunt derivați din indexul validat și rămân independenți de extinderea/virtualizarea rândurilor; numărătorii E/C provin din planul explicit existent, nu din suma aliasurilor sau a contururilor randate. Nu se afișează un număr până când derivarea lui din aceeași revizie de stare este validată. Dacă se afișează într-o fază ulterioară, textul recomandat este: „În arbore: {M} potriviri și {A} strămoși de navigare”. În preview: „{C} bife de geometrie vor fi schimbate (RO {C_RO}, MD {C_MD}, contururi NI {C_NI})”; E poate fi afișat numai ca „geometrii eligibile” separat.

## 5. Catalog de microcopy propus — UX-01, UX-04, UX-07, UX-08

Toate textele de mai jos sunt **propuneri pentru un PR de implementare ulterior**. Nu se schimbă HTML/JS în WEB-R2c.1.

| Context | Text propus | Comportament/limită |
|---|---|---|
| Introducere generală „Filtre” | „Filtrele pentru jurisdicții, tipuri și niveluri statistice controlează afișarea pe hartă fără să schimbe bifele entităților. Filtrul OSM controlează separat ce rânduri apar în arbore.” | Înlocuiește ambiguitatea UX-08 fără a promite schimbarea bifelor |
| Introducere „Nivel administrativ OSM” | „Alege nivelurile afișate în arbore. Bifele geometriilor și nivelurile statistice nu se schimbă.” | Accent pe F, nu pe G |
| Control de selecție totală | „Toate nivelurile în arbore” | Acțiune F, nu G |
| Control de golire selecție | „Niciun nivel în arbore” | Acțiune F, nu G |
| Categoria necunoscută | „Fără nivel OSM verificat” | Este filtru de rânduri, **nu** operand pentru comenzile G |
| Ajutor pentru comenzile G | „Comenzile schimbă bifele geometriilor pentru nivelurile OSM numerice selectate, numai după confirmare. Sunt excluse rolurile NI reutilizate și categoria fără nivel verificat.” | Nu ascunde scope-ul, păstrează 85 aliasuri independente de mutații |
| Confirmare cu impact | „Se vor {afișa/ascunde} {C_total} geometrii: RO {C_RO}, MD {C_MD}, contururi NI {C_NI}. Niveluri OSM: {lista}. {aliasuri} roluri NI reutilizate excluse. Confirmi?” | Preview înainte de orice G; C este număr de bife de schimbat |
| Nicio schimbare de realizat | „Pentru nivelurile numerice selectate, toate bifele eligibile sunt deja în starea cerută.” | Inclusiv când `L` nu are nivel numeric, se poate adăuga explicația corespunzătoare |
| Doar „unknown” sau zero niveluri numerice | „Selectează cel puțin un nivel OSM numeric pentru o comandă asupra geometriilor. Categoria fără nivel verificat filtrează doar arborele.” | Nu se deduce OSM din titluri sau din poziție |
| Empty state arbore, niciun nivel | „Niciun nivel OSM selectat. Arborele este gol, dar geometriile nu au fost șterse. Selectează un nivel sau apasă «Toate nivelurile în arbore».” | Mesaj contextual doar după încărcarea cu succes, fără reset automat |
| Empty state arbore, filtru activ fără potriviri | „Nu există rânduri potrivite filtrelor curente. Modifică nivelurile OSM sau celelalte filtre.” | Diferit de eroarea la încărcare sau de ramura doar închisă |
| Anulare confirmare | „Operațiunea a fost anulată. Bifele geometriilor nu s-au schimbat.” | Numai după Cancel |
| Preview invalidat | „Selecția sau bifele s-au schimbat. Verifică din nou domeniul operațiunii.” | Fail-closed, fără mutații parțiale |
| Undo / History | „Undo anulează ultima comandă colectivă cât timp pagina păstrează tranzacția. Revenirea prin browser și reîncărcarea paginii folosesc starea URL, nu istoricul Undo.” | UX-07, fără nouă persistență |

**Regulă de redactare:** română unitară, fără jargon UI („coalesced”, „alias”) în mesajele pentru public; „roluri NI reutilizate” este termenul explicativ, iar detaliile tehnice rămân în card/metodologie. Nu se adaugă badge-uri decorative sau contoare redundante. Secțiunea „Nivel administrativ OSM” continuă să arate doar valori OSM atestate, nu inventează clasificări administrative.

## 6. Stări și accesibilitate — contract pentru etapa WEB-R2c.2

- **Focus după acțiunea preview:** dacă apare confirmarea inline, focalizarea trebuie să fie vizibilă și să ajungă predictibil la titlul/sumarul confirmării ori la primul control confirmabil, păstrând accesul la Cancel. Nu se transformă implicit într-un dialog modal. În implementare se va documenta traseul efectiv de focus și semantica grupului.
- **Focus după Confirmă, Renunță, stale și Undo:** se revine la comanda inițiatoare sau la un control stabil echivalent; mesajul `role=status` / `aria-live=polite` este anunțat **o singură dată**, cu număr de bife modificate și/sau conflicte, fără schimbarea selecției utilizatorului.
- **Tab/Shift+Tab/Enter/Space/Escape:** scenarii obligatorii, dar comportamentul Escape nu este considerat „deja implementat” până la testare; orice nouă scurtătură trebuie autorizată separat. Cititor de ecran: label real pentru bulinele numerice, scop explicit pentru acțiunile masive și diferența dintre arbore/contururi.
- **State loading/empty/error:** loading înainte de corpus, empty numai după index validat cu zero potriviri, eroare vizibilă când încărcarea a eșuat; nu se folosește mesajul „nu există entități” pentru date încă neîncărcate.
- **Responsive:** desktop 1440×900, 1280×800; tabletă 900×768, 768×1024; mobil 430×932, 390×844, 360×800; compact landscape 844×390 și 390×600; zoom 200%, forced-colors, focus clipping și targeturi min. 44 CSS px.
- **Nu se suprapun automat planurile UX:** WEB-R2c.1 specifică, WEB-R2c.2 va putea modifica aria/focus/CSS numai după aprobare separată și dovezi pe dispozitivele/randerele aplicabile.

## 7. Performanță și dimensiunea corpusului — contract pentru WEB-R2c.3

Arborele este **deja virtualizat** în `atlas-tree-window.mjs`. Nu se reproiectează sau implementează o a doua virtualizare. Înainte de schimbări se înregistrează baseline reproductibil pe niveluri 8/9 cu aceleași corpus, SHA, browser, cache și viewport. Se măsoară durata până la input interactiv, durata preview/confirmare/Undo, sarcinile lungi, memoria (unde este măsurabilă), numărul de cereri de geometrie și volumele transferate, numărul de checkbox-uri schimbate față de plan, rate de eroare și fetch-uri duplicate.

Nu se stabilesc praguri absolute arbitrare înainte de baseline. O modificare viitoare va fi respinsă dacă produce regresie materială față de baseline verificat, fetch-uri geometrice duplicate, încadrare greșită, blocarea controalelor sau inconsistențe între E/C și planul efectiv. Testele de volum includ nivelurile 8 și 9 plus aliasurile NI excluse.

## 8. Criterii de acceptare și dovezi (specificație testabilă)

| ID | Condiția de test | Rezultat obligatoriu |
|---|---|---|
| AC-01 | Schimbă OSM 2/4/8, „Niciun nivel”, „Toate nivelurile”, fără comandă G | Se schimbă doar F și parametrul `a`; bifele, `x`, `o`, statistica și ACTUAL sunt identice |
| AC-02 | Match direct pe copil, părinte nematch, diverse ramuri virtualizate | Părintele rămâne navigabil; `M∩A=∅`, `V=M∪A`; niciun ID duplicat |
| AC-03 | NI 8 contururi + 85 roluri reutilizate, niveluri mixte | `E` conține doar geometrii independente; `skippedAliases` nu e numărat în E/C; 0 duplicate/ACTUAL nou |
| AC-04 | Numai `unknown`, zero niveluri, toate bifele deja corecte | Niciun checkbox schimbat; feedback contextual corect, fără confirmare înșelătoare |
| AC-05 | Preview show/hide; schimbă filtrul/bifă înainte de confirmare | Fail-closed, 0 mutații parțiale, avertisment și opțiune de repetare |
| AC-06 | Confirmă, apoi schimbă manual un subset, Undo, reload/Back/Forward/reset | Editarea manuală rămâne; Undo afectează numai tranzacția validă; URL v1/v2 rămâne canonic |
| AC-07 | Filtru fără potriviri, loading, eroare de index | Stări distincte; textul empty nu declară fals că datele lipsesc |
| AC-08 | Mobil/desktop + tastatură/200%/forced-colors | Text fără suprapunere, acțiuni accesibile, focus previzibil și live status fără dubluri |
| AC-09 | Nivel 8/9, volum mare, confirmare + Undo | Fără duplicate de fetch, fără UI înghețat, C exact față de diferența de bife; benchmark raportat |
| AC-10 | Compară file diff înainte de orice merge ulterior | Numai suprafața autorizată; `data/`, `public/data/`, `public/geo/`, manifest, fingerprint, ACTUAL și P9.1 nemodificate |
| AC-11 | Workflow-uri PR exacte, merge controlat, Pages | Toate check-urile obligatorii `SUCCESS` pe HEAD exact; audit post-merge și Pages pe SHA integrat |
| AC-12 | Terminologie „Filtre” și OSM | Nicio formulare nu confundă filtrarea rândurilor cu comenzile asupra bifelor |

În prezenta etapă **AC-01–AC-12 sunt teste specificate, nu executate pentru o interfață nouă**. Dovezile WEB-R2b și CI ale PR #384 reprezintă numai baseline istoric, nu validare prospectivă.

## 9. Decupare de implementare și gate-uri

| Etapă | Domeniu ulterior propus | Limite și dependențe |
|---|---|---|
| **WEB-R2c.1 (acum)** | Cele 2 documente de specificație/contract, fără UI, CSS, JS, asseturi ori date | Branch și PR separate, Draft; CI exact SHA; nu se autorizează singur merge-ul sau runtime |
| **WEB-R2c.1.1 (opțional, numai după aprobare)** | Microcopy UX-01/08 și empty-state UX-04; posibilă expunere a contoarelor M/A/E/C numai după validarea derivării | Branch+PR separat; 0 schimbări semantice F/G/S; teste AC-01/02/04/07/12 |
| **WEB-R2c.2** | Focus, confirmare, feedback ARIA, responsive și UX-07/06 | Branch+PR separat; AC-05/06/08; testare manuală unde este necesar |
| **WEB-R2c.3** | Profilare înainte de optimizare; hardening numai dacă benchmark justifică | Fără virtualizare duplicată; AC-03/09; 0 date mutate |
| **WEB-R2c.4** | Audit e2e și acceptarea GitHub Pages pentru întregul flux | AC-01–12, capturi A/B relevante, code SHA exact și proveniență |

**Regulă de autorizare:** integrarea documentelor WEB-R2c.1 nu autorizează WEB-R2c.1.1/2/3/4. Nu se ridică blocajele P9.1. Nicio execuție de browser/plată suplimentară nu este condiție pentru scrierea acestei specificații; dovada browser pentru o implementare viitoare rămâne obligatorie și trebuie să provină din CI/Chromium disponibil fără servicii cu plată.

## 10. Verdict

`WEB-R2c.1 = SPECIFICATION_PROPOSED`: vocabular, model de stări, numeratorii, microcopy, scenarii de eroare/empty-state, accesibilitate, benchmark și criterii de acceptare definite. **Zero defecte runtime noi declarate și zero modificări runtime autorizate.** Implementarea necesită autorizare separată, revalidarea exact-SHA și verificare pe GitHub Pages.
