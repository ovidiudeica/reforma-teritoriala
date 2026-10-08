# Atlas RO+MD — ierarhie consolidată

## Contractul datelor

Arborele este derivat exclusiv din `actual-consolidated-hierarchy-v1`, fără ramuri sintetice sau geometrii duplicate. Identitatea este `node.id`, iar relațiile sunt `parent_id` / `child_ids`. Contractul public curent conține 5.848 de entități/noduri în România și Republica Moldova; 63 de roluri statistice (45 atribuite entităților administrative/de context existente și 18 limite statistice separate). Rădăcinile sunt cele două state.

Generatorul datelor păstrează ordonarea oficială a copiilor și consolidează reprezentările care au identitate teritorială comună. Frontendul nu schimbă niciodată nume oficiale, coduri NUTS/CUATM/SIRUTA, geometria, contractul ACTUAL/P2 sau fingerprintul release-ului.

## P3.1 — etichete semantice și omonime

`atlas-tree.mjs` construiește etichetele folosind `display_type`, `roles`, `statistical_level`, `statistical_code` și `jurisdiction`. `atlas-search.mjs` furnizează eticheta de tip comună cu restul Atlasului; `formatEntityName()` normalizează numai afișarea, nu datele.

- Fiecare nod afișează o denumire și, pe rândul secundar, tipul său, nu doar un tooltip.
- Rolurile statistice RO folosesc `NUTS <nivel>`; cele MD folosesc `nivel statistic <nivel>`. Nu atribui clasificarea NUTS datelor MD.
- Un nod statistic + administrativ/de context afișează ambele roluri în aceeași intrare (`județ · NUTS 3`, `stat · nivel statistic 1`). Un nod pur statistic marchează explicit „limită statistică separată”.
- Codul statistic original rămâne vizibil, nemodificat.
- Omografiile de nume **între copii ai aceluiași părinte** sunt dezambiguizate prin ID-ul stabil al entității, afișat pe rândul secundar. Numele din alte ramuri sunt dezambiguizate de părintele inclus în `aria-label` și `title`.
- Grupurile statistice separate și cele administrative/statistice reutilizate au marcaje vizuale distincte. Nu sunt generate copii suplimentare ale nodurilor.
- Selectarea și expandarea rămân controale separate, disponibile la tastatură.

## Navigare și sincronizare

`selectEntity(id, options)` este controllerul unic pentru hartă, căutare, arbore, detalii și breadcrumb. Arborele este materializat lazy și deschide sincron toți strămoșii selecției, independent de evenimentele asincrone `toggle`. Selectarea unei geometrii ascunse păstrează filtrele, identitatea, detaliile și calea breadcrumb. Dezvăluirea selecției schimbă exclusiv `scrollTop` al containerului ierarhiei, nu pagina sau panourile exterioare.

Persistența ramurilor deschise în URL/History aparține `atlas-url-state.mjs`. Extinderile de la P3.2 respectă același contract `openIds` și fac push în History fără modificarea entității selectate. Validarea structurală completă la încărcare și hardening-ul suplimentar al contractului aparțin **P3.3**.

## P3.2 — navigare și ergonomie

- Arborele are un viewport adaptiv (înălțime limitată după înălțimea ecranului, cu scroll exclusiv intern). Numele și rolurile pot ocupa mai multe rânduri; un control de dezvăluire independent nu se suprapune peste acestea sau peste copii.
- „Restrânge tot” închide toate ramurile fără să șteargă selecția. „Arată țările” păstrează doar cele două rădăcini deschise. Selectorul „Deschide până la nivelul” permite adâncimi 1, 2 sau 3 sub rădăcini.
- Expansiunea pe nivel este **prevalidată**: dacă ar necesita peste 550 de noduri, refuză operația fără materializare parțială și recomandă căutarea. Nu există comandă de expansiune integrală a celor 5.848 de noduri.
- Un algoritm iterativ calculează o singură dată pentru fiecare nod numărul total de descendenți din relațiile oficiale. Counterul secundar nu generează noduri suplimentare.
- Starea „geometrie ascunsă” este afișată lângă rol și în eticheta accesibilă, inclusiv pentru jurisdicțiile dezactivate. Ea folosește strict `geometryVisible()` și checkboxurile de jurisdicție existente. Nu schimbă niciun filtru, rol, cod sau selecție.
- La interacțiuni cu filtrele se actualizează **numai nodurile deja materializate** în controllerul lazy; actualizările DOM sunt ignorate dacă starea vizibilității nu s-a schimbat. Copiii materializați mai târziu primesc direct starea curentă.
- Structura de date a ierarhiei, geometriile și release-ul nu sunt schimbate. P3.2 adaugă numai prezentare, navigare, teste și documentație.

## Verificări

`scripts/test/frontend-atlas-tree.test.mjs` testează căile celor 5.848 noduri, cele 63 roluri statistice, cele 45 coalesced, cele 18 pur statistice, accesibilitatea etichetelor, dezambiguizarea omonimelor, lazy rendering și selecția. `scripts/test/frontend-atlas-browser.test.mjs` exercită Chrome real pentru roluri statistice, selecție și sincronizare. P3.2 adaugă regresii pentru contoare/limita de materializare, selecție la restrângere, vizibilitatea filtrelor, accesibilitate, viewport desktop/mobile și integrare URL/History. Workflow-urile frontend existente execută suita Node și browser pe PR.

Toate fișierele de date ACTUAL/P2, sursele și geometriile master rămân în afara modificărilor P3.1. Verificarea diferenței PR trebuie să confirme byte-level absența modificărilor în datele protejate.
