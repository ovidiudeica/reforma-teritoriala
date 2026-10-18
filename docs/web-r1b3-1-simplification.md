# WEB-R1b.3.1 — simplificarea navigării și alinierea resetărilor

## Cerința utilizatorului
Nistrenia are acum o rădăcină proprie, șapte subdiviziuni și cele 85 de referințe OSM existente accesibile în arborele unic. Interfața auxiliară „Nistrenia · OSM” din Entități și catalogul „Roluri cartografice OSM · 85” din Filtre sunt redundante. Resetările Entități/Filtre trebuie să apară în aceeași poziție.

## Modificări controlate
- Au fost eliminate din markup butonul/catalogul `nistrenia-osm-*` și catalogul `osm-roles-*`; nu s-au eliminat datele publice, codul de validare a relațiilor OSM sau cardurile de proveniență pentru fiecare identitate existentă.
- `loadOsmRoleCatalog` verifică în continuare toate cele 85 de relații, snapshotul și fingerprintul ACTUAL înainte de generarea arborelui; `loadNistreniaOsmNavigation` validează integral cele șapte grupări și rolurile, iar contururile Nistreniei sunt verificate criptografic separat.
- Dacă datele OSM nu trec validarea, eroarea apare într-un `role=alert` ascuns implicit, fără afișarea unei structuri neverificate sau crearea unei jurisdicții juridice noi.
- O singură bară `#atlas-reset-toolbar` este imediat sub headingul contextual, înaintea căutării din Entități, și arată numai butonul aferent panoului activ. Se reutilizează handler-ele originale, state-urile și semantica `aria-disabled`/ `disabled`.
- Testele de navigare OSM au fost actualizate pentru arbore și cardurile proprii; nu au fost dezactivate controalele de proveniență sau testele de independență a selecției.
- 8 capturi Chromium (Entități/Filtre × 1440×900, 390×844, 844×390 și 640×360) și testează poziționarea identică, hit targets ≥44×44, absența UI redundante și efectele resetărilor.

## Gate
PR Draft, fără integrare înainte de toate required checks SUCCESS, CodeQL, Chromium desktop/mobil/landscape, examinarea capturilor și auditul de invariabile ACTUAL. Schema `public/data/p907216-osm-roles.json` rămâne neschimbată și păstrează documentarea istorică; nu se rescriu dosarele istorice P9.

**Invariante:** 5.848 identități ACTUAL, 85 roluri OSM validate, 7 subdiviziuni Nistrenia, nicio geometrie nouă sau duplicată, `p91_import_allowed=false`, `semantic_acceptance=BLOCKED_INCOMPLETE`, `actual_mutation_allowed=false`.
