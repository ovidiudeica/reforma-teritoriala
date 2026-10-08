# Search Atlas — web-v1.2.3

`atlas-search.mjs` separă funcțiile pure de index/ranking/disambiguare de controller-ul DOM `createAtlasSearch`. Etichetele `typeLabels` sunt mutate din app.js și reutilizate de search, arbore și detalii, fără un al doilea mapping. Ele descriu tipul afișat; clasificarea geometrică rămâne exclusiv în geometry-taxonomy.mjs.

## Index și ranking

Indexul precomputează numele și identificatorii normalizați, descriptorii și contextul părinților. Este construit la încărcarea public entities, apoi actualizat când arborele consolidat devine disponibil; nu reconstruiește ierarhia per query. Identitatea rezultatului este entity.id; duplicatele acelui ID sunt eliminate. Numele oficiale rămân nemodificate în date; etichetele afișate sunt formate unitar prin `formatEntityName` (vezi `frontend-entity-name-casing.md`).

Normalizare: NFD, eliminarea diacriticelor, lowercase și trim. `Iasi`, `IAȘI` și ` Iași ` sunt echivalente. Codurile cu zero inițial rămân șiruri de caractere.

Ordine de matching: exact → prefix → contains. În fiecare categorie: display_name → official_name/legal.name → coduri/identificatori → searchable_names → contextul părinților. Scorul este `match * 10 + field priority` (match 0/1/2, prioritate 0–4). Un exact match în alias/ID precedă un prefix display name. Identificatorii includ SIRUTA/CUATM, codul statistic oficial, entity.id, OSM numeric și r<număr>. MD120 rămâne identitatea oficială; MD121 nu este inventat drept cod statistic.

Tie-break: score, jurisdicție RO înainte de MD, display_name prin Intl.Collator('ro'), apoi entity.id lexicografic. Nu depinde de ordinea JSON. Limita este globală: primele 20 după ranking. Gruparea vizuală operează după această limită: România, apoi Republica Moldova, păstrând ranking-ul în fiecare grup. Navigarea keyboard urmează exact ordinea vizuală, într-o singură listă. Cu o singură jurisdicție se omite heading-ul duplicativ.

## Disambiguare

Linia principală este display_name. Linia secundară include jurisdicția, tipul românesc, părintele relevant și codul oficial (sau cod statistic / OSM când lipsește identitatea juridică).

Părinții provin din parent_id din consolidated hierarchy, apoi consolidated_parent_id/name din public entities. Fallback explicit: legal_parent_name/legal.parent_name și, pentru rol statistic, statistical_parent_name. Nu există inferențe admin_level/OSM pentru ierarhie. Pentru peers cu același nume, tip și jurisdicție se adaugă grandparent numai dacă parent-ul nu diferențiază. Dacă și codul oficial este comun, se afișează entity.id, fiind reprezentări distincte. Exemple reale: Victoria (oraș/comune RO, localitate MD) și cele trei reprezentări Bălți cu CUATM 0300.

Numele/query-ul nu sunt interpolate în HTML: opțiunile folosesc createElement/textContent. ID-urile DOM derivă injectiv din code point-urile entity.id, fiind stabile și unice.

## Tastatură, mouse și focus

- ArrowDown fără active → primul; următoarele avansează și se opresc la ultimul.
- ArrowUp fără active → ultimul; următoarele urcă și se opresc la primul. Fără wrap.
- Enter selectează numai un active result, prin selectEntity(id, {zoom:true, source:'search'}). Închide lista, resetează active state și pune versiunea de prezentare a display_name în input.
- Enter fără active nu selectează implicit primul rezultat.
- Escape închide lista și active state, păstrând query-ul și entitatea deja selectată. Înlocuiește vechiul clear-input pentru a permite reluarea căutării fără re-tastare și fără pierderea contextului. Săgețile redeschid query-ul păstrat.
- Hover/pointermove schimbă doar active result; click selectează. Săgețile continuă de la active result-ul mouse-ului.
- Focus-ul fizic rămâne în input; mousedown pe opțiune previne mutarea lui, iar selecția îl readuce în input. Tab și blur închid lista fără manager global de click. Evenimentele în timpul IME composition nu declanșează navigare/selecție.

Scroll-ul modifică numai scrollTop al containerului search dacă opțiunea este în afara viewport-ului. Nu mută pagina sau arborele, nu scroll-uiește opțiuni deja vizibile și nu repetă scroll la capătul listei.

## ARIA și stări

Input: label accesibil, role=combobox, aria-autocomplete=list, aria-controls=search-results, aria-expanded și aria-activedescendant numai când există o opțiune activă. Focusul nu este transferat în options.

Rezultate: role=listbox; grupurile de jurisdicție au role=group și aria-label. Heading-urile nu sunt options. Fiecare opțiune are role=option, aria-selected și tabindex=-1. Există maximum un active option. Închiderea elimină aria-activedescendant și setează aria-expanded=false; lista este hidden.

Un query gol produce zero opțiuni și închide lista. Un query fără rezultate păstrează starea open și afișează distinct `Nicio entitate găsită.` în status-ul live separat. Datele sunt locale; nu există request/loading per keystroke.

## Selecție și filtre

Search nu filtrează semantic entitățile după vizibilitatea geometriei. Subtype/jurisdiction/statistical off nu elimină rezultate. Selecția folosește controller-ul existent pentru map/tree/details/breadcrumb și scroll-to-selected; filtrele de subtip/nivel statistic nu sunt activate implicit. Selectarea unei geometrii ascunse păstrează detaliile și mesajul existent. Comportamentul selectEntity pentru jurisdicția off este păstrat (layer reactivat când geometria este vizibilă); subtipurile rămân intacte.

Cele 18 statistical-only sunt în aceeași căutare, etichetate prin nivel statistic, cu cod oficial. Cele 45 admin+statistical au un singur entity.id și un singur rezultat.

## Validare și scope

Suitele Node: frontend-smoke, actual-statistical-public, frontend-geometry-taxonomy, frontend-atlas-tree, frontend-atlas-filters, frontend-atlas-search. Noua suită testează ranking și identificatori reali, Victoria/Bălți, DOM keyboard/ARIA/hover/focus/scroll și integrare cu app.js + Leaflet simulat (inclusiv depth 5, filtre ascunse, statistical-only și coalesced).

Workflow-ul frontend agregat execută toate suitele și syntax checks, apoi git diff --exit-code. Nu există dependențe noi. ACTUAL/P2 nu sunt modificate. Browser/visual QA complet rămâne web-v1.2.7; URL/share state, mobile redesign și accessibility/provenance complet nu sunt implementate aici.
