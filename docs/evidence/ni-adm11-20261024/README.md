# NI-ADM.1.1 — închiderea ecranării corpusului central, 24.10.2026

**Verdict:** verificarea titlurilor din corpusul central *observat* este PASS; **exhaustivitatea juridică contemporană rămâne BLOCKED_EVIDENCE.**

PR separat, stacked peste NI-ADM.1 #430, care depinde de NI-ADM.0 #428.

## Executat efectiv

- Decomprimare verificată prin format gzip și ISIZE a `contemporary-months/census.json.gz` păstrat în `main`.
- **9.275/9.275** titluri examinate, cu ID-uri unice și serii continue în fiecare an: 2023=2390, 2024=2659, 2025=2479, 2026=1747 (observate până la 21 octombrie).
- **57 titluri** selectate de filtre explicite, documentate și reproductibile. 3 menționează legea administrativ-teritorială de facto: nr.48/2023 (amendament direct, aplicabil), nr.114/2026 (amendament direct, efect amânat șase luni din 29.05.2026) și nr.49/2023 (modifică legea limbilor *ca urmare* a unui amendament ATU).
- **20 titluri** menționează legea organelor locale, printre care 18 legi și două documente privind proiecte; nu se afirmă că schimbă granițe ori lista ATU. Alte titluri cu referiri la localități se păstrează în registrul de candidați.
- Examinarea celor **19 titluri suplimentare din 22–23 octombrie**, identificate în pagina indexului oficial: 0 titluri cu modificarea directă a legii ATU, 1 document (`2026001751`) de **opinie oficială asupra unui proiect** de lege privind autoritățile locale, care nu trebuie prezentat drept lege promulgată. Cele 19 titluri sunt parafrazate în [late-19-title-review.json](late-19-title-review.json); originalele semnate și răspunsurile HTML complete încă nu sunt toate conservate cu hash.
- Descoperirea directorului celor **șapte consilii teritoriale** de nivel superior din sursa oficială a legislativului de facto, inclusiv surse de hotărâri. Pentru Grigoriopol sunt vizibile **13** legături către documentele consiliilor sătești și una suplimentară pentru Maiac; pentru Bender sunt vizibile secțiuni pentru Gîsca și Proteagailovca. Aceste portaluri nu certifică exhaustivitatea tuturor actelor locale.

## Interpretare corectă

Nu există în titlurile verificate un alt **amendament direct identificabil după numele legii 155-З-III** decât actele 48/2023 și 114/2026; această constatare se referă numai la **titlurile observate**, nu la conținutul integral al actelor, competențele altor emitenți, nepublicare sau registre locale. De asemenea, unele acte de organizare a autorităților locale pot afecta atribuții, nu automat unități și limite administrative.

`all-9275-title-screen.json` prezintă reguli de căutare, numărătoare și cele 57 de rezultate. `late-19-title-review.json` conține observațiile despre cele 19 publicații noi. `local-register-sources.json` inventariază cele șapte portaluri, fără o pretinsă examinare completă a documentelor originale.

**Normative completeness at 24.10.2026:** `BLOCKED_EVIDENCE`. Lipsesc auditul integral al textelor primare relevante, consultarea registrelor locale și o certificare de aplicabilitate pe fiecare act. Nu există autorizare pentru reclasificarea celor 85 roluri, relocarea părinților MD sau modificarea arborelui.

`ACTUAL_mutation_allowed=false`, `P9.1=BLOCKED`, `NI-ADM.1.1 formal closure=BLOCKED`. CI trebuie verificat pe SHA exact înaintea oricărei integrări.

Surse: [legislația ATU de facto](https://www.vspmr.org/legislation/laws/zakonodateljnie-akti-pridnestrovskoy-moldavskoy-respubliki-v-sfere-konstitutsionnogo-stroya-osnov-pravoporyadka-a-takje-deyateljnosti-organov-gosudarstvennoy-vlasti-i-upravleniya/zakon-pridnestrovskoy-moldavskoy-respubliki-ob-administrativno-territorialjnom-ustroystve-pridnestrovskoy-moldavskoy-respubliki.html), [index oficial consilii](https://vspmr.org/soveti-narodnih-deputatov/), [publicații centralizate](https://www.minjust.gospmr.org/web.nsf/All/publication2?Count=1000&ExpandView=&OpenDocument=&Start=1&TableRow=1.0).
