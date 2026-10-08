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

Persistența ramurilor deschise în URL/History aparține `atlas-url-state.mjs`. UX-ul de bulk expansion, spațiul adaptiv al arborelui și indicarea filtrelor ascunse sunt planificate pentru **P3.2**, nu sunt introduse de P3.1. Validarea structurală completă la încărcare și hardening-ul suplimentar al contractului aparțin **P3.3**.

## Verificări

`scripts/test/frontend-atlas-tree.test.mjs` testează căile celor 5.848 noduri, cele 63 roluri statistice, cele 45 coalesced, cele 18 pur statistice, accesibilitatea etichetelor, dezambiguizarea omonimelor, lazy rendering și selecția. `scripts/test/frontend-atlas-browser.test.mjs` exercită Chrome real pentru roluri statistice, selecție și sincronizare. Workflow-urile frontend existente execută suita Node și browser pe PR.

Toate fișierele de date ACTUAL/P2, sursele și geometriile master rămân în afara modificărilor P3.1. Verificarea diferenței PR trebuie să confirme byte-level absența modificărilor în datele protejate.
