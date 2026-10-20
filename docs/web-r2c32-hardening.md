# WEB-R2c.3.2 — domeniu și gate-uri

Predecesor acceptat: WEB-R2c.3.1, PR #391, `main@ad5073041d582cae9caa6f031684ffd0a427d938`; 13 workflow-uri și 20 verificări post-merge PASS, Pages și cele 32 componente ACTUAL verificate.

Această etapă verifică regresiile Chromium pentru desktop, tabletă, mobil portrait/landscape, text mărit 200%, zoom nativ al browserului, forced-colors, focus/nume accesibile, ținte tactile, filtre OSM/statistice, confirmare/anulare/Undo, History/URL, căutare/carduri, panouri, fundal OSM și resurse/erori. Capturile stărilor critice se inspectează efectiv. Arborele și geometriile păstrează independența aprobată.

Orice defect reproductibil intră în `docs/roadmap-issue-register.json`, primește remediere și regresie și rămâne deschis până la retestare. Nu se declară PASS pentru cititoare de ecran fizic indisponibile; arborele de accesibilitate Chromium este o probă distinctă.

Integrarea necesită toate gate-urile obligatorii pe head-ul exact, capturi inspectate, audit de securitate/diff, apoi CI și Pages post-merge. ACTUAL, părinții juridici MD și geometriile rămân nemodificate, P9.1 blocat, `semantic_acceptance=BLOCKED_INCOMPLETE`.

Stare: remedierea și măsurătorile Chromium sunt probate; integrarea și acceptarea etapei cer separat PASS pe head-ul final și verificările post-merge.

## RM-006 — contractul Escape al confirmării OSM

Reproducere Chromium: Filtre → nivel OSM 5 → Afișează → Tab de la domeniu la Confirmă → Escape. În baseline, panoul se închide și focusul nu revine la inițiator. Handlerul documentului în capture rulează înaintea handlerului inline în bubble.

Comportament așteptat, deja specificat în WEB-R2c.2: prima apăsare Escape anulează doar confirmarea, nu modifică bifele, menține Filtre deschis și readuce focusul la comanda inițiatoare. O apăsare ulterioară poate închide panoul conform contractului existent. Remedierea marchează explicit componenta care gestionează Escape; panoul îi lasă prima tratare. Nu se schimbă modelul de selecție, URL sau datele.

Regresie: matricea `web-r2c32-hardening-browser.mjs` verifică ordinea reală document-capture/target-bubble, focusul și bifele pe desktop/tabletă/mobil/landscape. Se păstrează raportul și captura baseline FAIL, apoi se compară capturile retestării pe SHA exact.

## Dovezi și acoperire

Reproducerea RM-006 pe checkout curat `ad5073041d582cae9caa6f031684ffd0a427d938` confirmă defectul în toate cele patru profiluri. În [39376090948](https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/39376090948), pe head curat `6a9502ab0d4fd9bdfcf0f5c2815148dee5e282cb`, matricea trece: 52 înregistrări de verificare, 40 capturi inspectate individual, 102 eșantioane de contrast ale textului vizibil, zero erori proprii HTTP/JS/rețea. Toate cele patru retestări Escape mențin Filtre activ, închid confirmarea și readuc focusul la inițiator. Cele patru capturi baseline după Escape arată panoul închis incorect; capturile retestării arată panoul deschis și conturul focusului.

| Domeniu | Verificare |
|---|---|
| Profiluri | Chromium desktop 1440×900, tabletă 768×1024, mobil 390×844 și landscape 844×390 |
| Scenarii combinate | RO → MD → NI, OSM 8/9 independent de statistici/geometrii, previzualizare/anulare/confirmare/Undo, 12 anulări rapide/profil, Back/Forward, refresh și Share URL, căutare Cremenciug și card |
| Accesibilitate | Nume interactive în arborele AX, contrast calculat pe text vizibil și fundalurile compuse, focus tastatură, ținte ale comenzilor de hartă și confirmării, forced-colors și reduced-motion |
| Zoom nativ | Profil Chrome temporar separat, selectorul Page zoom 200%, ferestre 1440×900 și 1280×1024, DPR=2 și visualViewport.scale=1, layout, arbore și focus de întoarcere |
| Text mărit | Suita P7.6 existentă rămâne obligatorie: fonturile calculate mărite 200%, inclusiv portrait/landscape și stările cardului; aceasta este distinctă de zoomul nativ |
| Corpus / selecții | Suitele obligatorii existente verifică arborele virtualizat, cele 85 roluri, cele opt contururi independente, niveluri statistice, resetări și History |
| Resurse | Fundal OSM on/off prin comanda publică, geometrii păstrate, cereri/răspunsuri/eșecuri brute, consolă și excepții |
| Securitate | CodeQL PASS pe 6a9502a; audit npm contemporan: zero vulnerabilități; directoare de dovezi fixe, URL public allowlisted și acțiuni GitHub fixate prin SHA |

RM-005 corectează proveniența auditului Pages: SHA al auditorului separat de SHA publicat, nouă resurse comparate SHA-256 cu checkout-ul corespunzător, refuz pentru resurse vechi/lipsă și erori de rețea proprii. Rularea [39376090765](https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/39376090765) a refuzat corect diferența `atlas-panels.mjs`, dar a evidențiat asocierea greșită candidat-publicare în PR. Remedierea separă explicit `PR_PUBLISHED_BASELINE_ONLY` de `PUBLISHED_EXACT_CHECKOUT`; [39376540919](https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/39376540919) trece cu sursele baseline-ului publicat. Aceasta nu certifică publicarea candidatului: după merge este obligatoriu auditul cu noul main și toate hashurile publicate potrivite.

Nu există mijloace pentru testarea unui cititor de ecran fizic; verificarea AX nu se prezintă drept certificare cu cititor de ecran. Contrastul este eșantionat în stările testate, fără declarație de certificare WCAG integrală. Profilurile sunt viewport-uri Chromium pe runner, nu dispozitive fizice. Logurile, capturile, artefactele ZIP originale și digesturile lor sunt păstrate în dosarul extern al etapei; datele ACTUAL nu se includ într-un nou import sau într-o promovare.

Verdictul tehnic de integrare rămâne condiționat de toate gate-urile pe head-ul exact, inspecția capturilor finale, auditul diff-ului și dovada post-merge CI/Pages/ACTUAL. Etapa următoare nu începe înaintea acestui verdict.

## RM-007 — constatare adjudecată prin contractul P7.6

Capturile text200 după ArrowDown arată partea superioară a antetului în afara viewport-ului. Investigația a separat derularea controlată a `.atlas-stage` de decuparea intrinsecă a textului: `scrollX/scrollY` rămân zero, titlul rămâne conținut în propriul antet, iar cadrul este intenționat scrollabil pentru accesul la rânduri mărite. Acest comportament este documentat deja în `docs/p7.6-final-acceptance.md`, secțiunea „Măsurare reproductibilă”, și în `atlas-tree.mjs`/`atlas-layout.mjs`.

Pe surse nemodificate ale aplicației, proba Chromium la 360×640, 640×360 și 1440×900 confirmă că focusul pe comanda accesibilă din antet și tasta nativă Home readuc întregul titlu în viewport. Clasificarea inițială ca defect a fost prematură; verdictul este `CLOSED_EXPECTED_BEHAVIOR_RETEST_PASS`. Nu se fixează antetul și nu se elimină derularea aprobată. Regresia P7.6 adaugă verificarea revenirii prin tastatură și trei capturi, păstrând toate aserțiunile anterioare pentru ținte, hit testing și text. Probele inițiale și adjudecarea sunt arhivate împreună.
