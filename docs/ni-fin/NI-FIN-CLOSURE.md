# NI-FIN-CLOSURE — integrare UI și acceptare publicată în curs

NI_FUNCTIONAL_COMPLETE=false
NI_LEGAL_CERTIFICATION_PENDING=true
OSM_SOURCE_PENDING=true

## Stare verificată la 25 octombrie 2026

| Etapă | Implementare / integrare | Dovezi |
|---|---|---|
| NI-FIN.3.1 | #444 integrat; main b74890be128db84b6c84da1fe3ebbaee9e47b298 | 28/28 SUCCESS pre-merge, 25/25 post-merge, A/B și comparație independentă PASS; Pages built |
| NI-FIN.0 | #439 integrat; main 1b9a347c1b24af8693db11c5730046435bda8e63 | 24/24 SUCCESS pre-merge, 22/22 post-merge, Pages built |
| NI-FIN.1 | #440 integrat; main 9266d478da04c0810797464fdc3521a8645ad62f | 24/24 SUCCESS pre-merge; 59 teste dedicate CI; audit post-merge în curs |
| NI-FIN.2 | #441 reconciliat cu main; implementarea existentă păstrată | Noul HEAD trebuie validat în CI înainte de integrare |
| NI-FIN.3.3–3.4 | În așteptarea integrării UI și a publicării reale | Nu se declară acceptare funcțională anticipat |

#443 a fost marcat automat MERGED de GitHub prin includerea istoricului său în #444. Admiterea controlată a folosit exclusiv HEAD-ul final #444, nu rezultatele eșuate ale commiturilor intermediare.

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

## Criterii rămase înainte de închidere

Noul HEAD #441 trebuie să treacă testele NI, regresiile RO/MD, CodeQL, A/B/comparație, P8.2/P8.4 și Chromium. Capturile desktop/mobil/landscape trebuie inspectate. După integrare se verifică CI post-merge, commitul Pages și manifestul release-ului real, resursele și GeoJSON-urile, arborele 242/9/74/162, cardurile, selecțiile independente, căutarea, Undo/Reset și URL/History. Testele negative pentru model NI corupt/503 păstrează utilizarea RO/MD. Raportul final va consemna exclusiv rezultatele executate.

Issue #442 rămâne deschis pentru certificarea juridică contemporană; #396 pentru sursa OSM învechită. Cele 242 UNKNOWN, istoricile și versiunile absente, originalele normative și geometriile individuale necertificate rămân restanțe distincte. Nu reprezintă condiții noi pentru afișarea textuală a organizării sursate din 2023. ROADMAP-CLOSURE global rămâne BLOCKED_INCOMPLETE.

## Validare locală după reconcilierea UI

Lotul selectat RO/MD/NI, arbore, URL și securitate browser: 118/118 PASS în execuția autorizată. Lotul Chromium real (securitate + NI + două cazuri corupt/503): 9/9 PASS; cele șase teste de securitate se suprapun primului lot și nu sunt numărate ca nouă teste unice suplimentare. Capturi desktop/mobil/landscape inspectate. Prima execuție restricționată a păstrat 117 PASS și un ECONNRESET CDP; cauza exactă a resetului nu este adjudecată, iar în mediul autorizat sursa nemodificată trece integral. Logul inițial este conservat local. Nu s-a aplicat un retry în aplicație sau o slăbire a testului. Noile gate-uri CI trebuie să confirme noul SHA.
