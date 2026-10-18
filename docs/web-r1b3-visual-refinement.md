# WEB-R1b.3 — rafinare controlată a interfeței atlasului

**Context:** feedback vizual din cele zece fotografii ale website-ului publicat: panouri încărcate de chenare și spațieri neuniforme, butoane disproporționate, tipografie eterogenă și prea puțin spațiu util pentru hartă.

## Modificare propusă

- Stilurile sunt izolate în `atlas-r1b3-polish.css`, încărcat după WEB-R1b și WEB-R1b.2. Nu modifică organizarea DOM, codul GIS, controllerul panourilor sau semantica URL.
- Reduce discret contururile, umbrele, paddingul intern și diferențele nejustificate dintre secțiunile `details/summary`. Titlurile au o scară mai consecventă.
- În panoul Filtre, grupele administrative/statistice rămân independente, iar comenzile colective au o dispunere elastică; corecția WEB-R1b.2 a etichetelor statistice este păstrată.
- În panoul Măsurare, latitudinea și longitudinea folosesc două coloane la lățimi suficiente și o coloană pe telefoane; acțiunile nu sunt transformate în benzi supradimensionate.
- În Partajare, Instrumente, Informații și cardurile de proveniență, butoanele și metadatele folosesc același ritm vizual, fără a ascunde explicațiile ori stările critice.
- Nu sunt introduse fonturi externe, framework-uri, panouri suplimentare sau duplicate de stare.

## Gate de acceptare

1. `scripts/audit/web-r1b-layout-browser.mjs` include capturi pentru Filtre, Măsurare, Partajare și Informații la 1440×900, 390×844, 844×390 și 640×360. Controlează dimensiunea de minimum 44×44 pentru comenzile active, antetele panourilor, lipsa overflowului orizontal și independența stării/URL la accordion.
2. Rămân obligatorii toate suitele Chromium și Node existente: P7.2, P7.3, P7.4, P7.6, P9.0.9.5, WEB-R1b, CodeQL, integritatea ACTUAL, P8.2/3/4 și testele de proveniență.
3. Capturile A/B trebuie inspectate și aprobate înaintea integrării. Textul mărit la 200%, navigarea din tastatură, focusul, Escape și responsive rămân criterii de acceptare.
4. PR-ul este **dependent semantic** de WEB-R1b.2 / PR #371. Pentru a declanșa CI, este orientat temporar spre `main` (workflow-urile rulează numai cu această bază); în consecință, diff-ul conține și schimbările #371 până la integrarea acestuia. PR #372 nu se integrează înaintea acceptării și integrării #371; apoi diff-ul se revalidează separat. Nicio modificare directă în `main`.

## Invariante

- ACTUAL: 5.848 identități, snapshot `actual-a9e5a4ddcb5277ef`, fingerprint `a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446` nemodificate.
- România/Moldova/Nistrenia și cele 85 de roluri OSM rămân independente.
- P9.1: `p91_import_allowed=false`, `semantic_acceptance=BLOCKED_INCOMPLETE`, `actual_mutation_allowed=false`.
