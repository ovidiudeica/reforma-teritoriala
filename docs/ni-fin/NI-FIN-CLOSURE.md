# NI-FIN-CLOSURE — acceptare funcțională publicată

NI_FUNCTIONAL_COMPLETE=true
NI_LEGAL_CERTIFICATION_PENDING=true
OSM_SOURCE_PENDING=true

## Acceptare verificată la 25 octombrie 2026

Commitul implementării integrate și publicate este `6e6e3b1cc56168e52a0c1dd99af011d7ac87232e`. Acest raport documentează rezultate executate, nu o promovare juridică sau a sursei OSM. Commitul documentar final este identificat de istoricul Git și de PR-ul de închidere; nu se inserează un SHA autoreferențial inventat.

| PR | Commit integrat | CI înainte / după integrare |
|---|---|---|
| #444 | b74890be128db84b6c84da1fe3ebbaee9e47b298 | 28/28 / 25/25 SUCCESS |
| #439 | 1b9a347c1b24af8693db11c5730046435bda8e63 | 24/24 / 22/22 SUCCESS |
| #440 | 9266d478da04c0810797464fdc3521a8645ad62f | 24/24 / 22/22 SUCCESS |
| #441 | 6e6e3b1cc56168e52a0c1dd99af011d7ac87232e | 25/25 / 25/25 SUCCESS |

HEAD-ul acceptat #441: `77187a976e08659873342adf12deedff524e088e`. Required checks, CodeQL, A, B, comparația byte-identică și gate-ul agregat au trecut efectiv. Nu s-a folosit bypass administrativ. [Reproductibilitate pre-merge](https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/40180329831).

## Website publicat și validat

Pages a publicat commitul implementării. [Auditul NI publicat](https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/40196584156) este SUCCESS: 69 teste dedicate în workflow, surse curate și exact 9 fișiere sursă plus cele două JSON critice views/nistrenia verificate față de checkout. Raportul Chromium verifică toate cardurile și opt măsurători de layout fără overflow.

[Auditul complet publicat](https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/40196586784) este SUCCESS: 438/438 resurse, 125 GeoJSON, 277.990.325 octeți verificați față de release; 52 capturi păstrate. Cele 69 înregistrări ale raportului nu sunt prezentate drept 69 teste unitare distincte. Capturi reprezentative desktop, mobil și layouturile dedicate au fost inspectate efectiv.

Au fost verificate desktop, telefon portret/landscape, tabletă, tastatură, AX, forced-colors și zoom 200%, selecții independente, căutare, filtre, Undo/Reset, URL/History și Back/Forward, zoom/centrare și fundal OSM. Implicit sunt active numai rădăcinile RO/MD/NI. Nu există certificare prin cititor de ecran fizic; emularea viewporturilor nu este test pe dispozitive fizice.

Auditul suplimentar pe website a accesat prin controalele arborelui toate cele 242 noduri distincte, inclusiv cele 74 consilii și nouă unități superioare; 234 checkboxuri fără poligon sunt dezactivate. Selecțiile geometrice au rămas identice înainte/după traversare. Injectările browser-only 404, JSON corupt și 503 pentru modelul NI au păstrat funcționale cele 5.848 identități oficiale RO/MD, cu NI indisponibil în mod controlat și fără erori JavaScript. Nu s-a modificat serverul public.

Primul harness al traversării a presupus greșit că reveal() deschide părinții. FAIL-ul original este conservat; varianta v2 folosește explicit expandarea și trece. Nu a fost necesară schimbarea contractului aplicației.

## Integritate și securitate după merge

Cele 32 componente au fost rehashuite independent: 172.273.728 octeți, RO=3246, MD=2602, TOTAL=5848. SHA semantic: `a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446`. Diff-ul data/public între modelul acceptat și implementarea publicată este gol. Părinții MD, CUATM și geometriile sunt neschimbate. P9.1 rămâne neautorizat; nicio editare OSM publică și nicio promovare a sursei.

CodeQL pe main: analize terminale fără eroare și zero alerte OPEN; rezultatele brute includ clasificări istorice existente, nu zero constatări brute. Alertele 63–66 și 93–96 sunt FIXED. Nu s-au efectuat dismiss-uri pentru admiterea NI-FIN.

## Dovezi și închiderea taskului

[Dosarul verificabil](../evidence/ni-fin-closure-20261025/README.md) include rapoartele publicate, inventarul resurselor și hashurile, dovezile CI/Pages/CodeQL, integritatea celor 32 componente, traversarea completă, cazurile negative și manifestul SHA-256. Originalele locale care nu sunt incluse nu sunt pretinse stocate în GitHub.

Acceptarea funcțională este justificată de integrarea, publicarea și validarea implementării. Admiterea acestui raport se face separat prin PR documentar și verificările sale aplicabile. Nu a fost identificat un issue funcțional NI-FIN separat de issue-urile de restanțe; închiderea taskului este consemnată prin acest raport și PR-ul său.

Issue #396 (OSM/freshness) și #442 (juridic contemporan) rămân OPEN. Cele 242 UNKNOWN, 159 istorice lacunare și 641 versiuni absente nu sunt declarate rezolvate. Organizarea documentară din 2023 rămâne descriptivă; controlul efectiv și apartenența juridică nu se deduc din geometrii. ROADMAP-CLOSURE global rămâne BLOCKED_INCOMPLETE.

## Calificarea mediului

Proprietarul a autorizat expres profilul exact github-ubuntu24-20261023.334.3 și rebindul P9.0.5, apoi adaptarea strictă WEB-R2a.1. Aprobările originale sunt în docs/evidence/ni-fin31-host-qualification-20261025/. Fingerprint contractual: f3a11ed754cbd66758169ec1943653c33ebb5d4e7350e88d5db26b0e1044ebbf. Cele patru profiluri anterioare sunt păstrate. Diferența observată față de ultimul profil aprobat este numai image_version; release-ul GitHub oficial prerelease a fost declarat explicit la aprobare.

Cele șase manifeste provin din run P9.0.5 40142346381. Nu s-au schimbat required checks, branch protection, CPU/OCI sau criteriile exacte host. WEB-R2a.1 acceptă numai hashurile exacte autorizate și verifică invariantele semantice; orice alt diff data/public rămâne fatal. Manifestul istoric este păstrat separat. NIF-010–012 sunt documentate cu cauze, remedieri, regresii și SHA-uri în issues.json.

## Inventarul implementat

Modelul documentar 2023 are 242 noduri: rădăcina, 5 raioane, 4 orașe superioare distincte, 74 consilii și 158 noduri locale. Cele 162 mențiuni de localități sunt reconciliate prin cele 4 roluri urbane comune, pe indici documentari, nu prin asemănarea numelor. 245 referințe documentare sunt păstrate ca aliasuri de sursă. Maiac este sub raionul Grigoriopol prin corecția NIF-001 legată de textul original.

Model SHA-256: 3b92136c285a242131d52b86a0645ef85dbb091722d2d7574501f5fc7ed992f3. Regenerarea este byte-identică. 85 resurse ACTUAL și 8 contururi OSM NI sunt referințe canonice, fără coordonate copiate în model. 8 noduri au contur propriu conservat; 234 nu au contur administrativ individual certificat: 97 au candidați și 137 nu au dovezi. Toate cele 74 consilii rămân reprezentate textual fără poligon propriu inventat. Candidează pentru geometrii numai prin acțiuni explicite; potrivirile nominale nu sunt certificări de identitate.

Bender MD/NI, Dubăsari și Rîbnița oraș/raion, Cremenciug, Lunga, Hlinaia și Zona de Securitate păstrează axele documentare/geometrice/juridice distincte. Situația sursată din 2023 nu este prezentată ca certificare contemporană sau dovadă a controlului întregului poligon.

## Integritatea ACTUAL

RO=3246, MD=2602, TOTAL=5848, COMPONENTS=32. Snapshot actual-a9e5a4ddcb5277ef; semantic SHA-256 a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446. Hashurile și lungimile celor 32 de componente au fost verificate independent: 172273728 octeți, PASS. Dovezile sunt în docs/evidence/ni-fin-acceptance-20261025/ cu manifest SHA-256. Referințele semantice, geometriile, CUATM și părinții MD sunt neschimbați. Singurele schimbări ACTUAL-adjacent sunt cele șase metadate de proveniență autorizate separat, fără schimbare semantică.

ACTUAL_MUTATION_ALLOWED=false; P91_IMPORT_ALLOWED=false; SEMANTIC_ACCEPTANCE=BLOCKED_INCOMPLETE. Nu s-a editat OSM public și nu s-a promovat un candidat sursă. Proba CHANGE A/B este sintetică, izolată și nepromovată.

