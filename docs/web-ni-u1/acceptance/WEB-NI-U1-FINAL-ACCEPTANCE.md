# WEB-NI-U1.5 — acceptarea funcțională Moldova–Nistrenia

**Pornire:** `3e34df56fe1fbf9343ae46b566fd28d2972fc320`. **Release funcțional auditat:** `e8373371aa7504a206fa6c8020ed421060fc84e4`, cu remedierea History din #455. Acest raport privește interfața descriptivă și geometria canonică reutilizată; nu certifică juridic Nistrenia și nu promovează o sursă OSM.

## Integrări acceptate

| Etapă | PR | HEAD acceptat | Commit de merge | CI pre-merge |
|---|---|---|---|---|
| U1.0/U1.1 | #449 | `6c24c96157af23e5f20b2a6f44d8f8f134e131ec` | `c8b3ce8d6b3c863aa4f6b9e7203f38c398989728` | Dosar read-only integrat |
| U1.2 | #450 | `f7e655f2b1cd303a8e4dc43608b2fbb731315f6c` | `e067b2c809c8eb8f908a0a30772a7f32da2df9e2` | 24 SUCCESS |
| U1.3 | #451 | `a21a3a9b93d86a14bc0e6f0d98b6b198d515aaca` | `406b050a096bac90f04daad686c8837fab1717c8` | 24 SUCCESS |
| U1.4 | #452 | `645bfc2a810a974ceee6856a0e39a267b0121144` | `3e34df56fe1fbf9343ae46b566fd28d2972fc320` | 24 SUCCESS |
| U1.5, regresie History | #455 | `2f2b6eaaffa5baf2910bdded1b5c8e82764c8f18` | `e8373371aa7504a206fa6c8020ed421060fc84e4` | 24 SUCCESS |

SHA-urile complete, run-urile și rezultatele individuale se află în `pr-integration-register.json` și `ci-final-register.json`. A/B, comparația și CodeQL sunt verificări executate, nu deducții din statutul PR-ului. Pentru main sunt înregistrate check-urile aplicabile efectiv, inclusiv cele trei analize CodeQL și deploymentul; nu se impune mecanic numărul de joburi al unui PR.

## Regresia reparată

Auditul cuplat a reprodus o excepție reală la Back: un rând NI focalizat era eliminat după restrângerea ramurii, iar render-ul încerca să acceseze controalele rândului deja absent. #455 verifică păstrarea rândului înainte de refocalizare; mecanismul existent mută focusul la strămoșul vizibil. Proba unitară reproduce ordonarea DOM reală și verifică fallback-ul. Chromium verifică Back/Forward, starea canonică și lipsa erorilor pe desktop și mobil. Pe mobil, restaurarea URL închide legitim panoul și revine la butonul Entități.

`sources/failure-history.json` păstrează eșecul funcțional și erorile de configurare/afirmație ale probelor intermediare. Niciun run eșuat sau anulat nu este prezentat drept PASS. Nu au fost eliminate teste, schimbate praguri, protecții ori profiluri host-trust.

## Inventarul și probele executate

- **93 resurse canonice:** 85 referințe la geometriile MD/ACTUAL și opt contururi NI distincte. Registrul include calea și SHA-ul sursei GeoJSON, hashul geometriei și separat hashul dovezii istorice NI. Referințele nu copiază poligoane.
- **242 noduri documentare:** o rădăcină, cinci raioane, patru orașe enumerate distinct, 74 consilii și 158 localități distincte. Cele 162 mențiuni includ patru roluri de oraș reutilizate. Cele 234 noduri fără contur propriu certificat rămân consultabile; 97 sunt candidate și 137 nu au dovezi geometrice proprii.
- **85 referințe auxiliare**, în afara celor nouă unități administrative ale rădăcinii. Lunga `osm-r19001619` este accesibilă fără părinte administrativ inventat. Cele șase resurse cu candidaturi multiple rămân candidate: `osm-r7427669`, `osm-r8290877`, `osm-r8291058`, `osm-r9301463`, `osm-r9659709`, `osm-r9679382`.
- Chromium verifică toate cele 85 de carduri comune, opt carduri exclusive, denumirile comune și **340 tranziții de bifare** — cele patru direcții pentru fiecare ID. Cardul comun rămâne unul singur; selectarea numelui nu bifează geometria. Cardurile exclusive nu primesc o secțiune Moldova artificială.
- Proba cuplată verifică pentru Bender matricea MD/NI/ambele/niciuna, persistența bifei, lipsa dublării pe hartă, fundalul OSM oprit, URL/History, Undo, Reset, căutarea Lunga, tastatura, click pe feature, măsurătorile, vecinii și comparația. GeoJSON-ul exportat prin interfață are ID-ul canonic și geometria identică sursei. Exportul vectorial păstrează starea. P8.2/P8.4 și Frontend QA acoperă suplimentar regresiile de topologie, export, print/report și navigare RO/MD.

Acoperirea exhaustivă de 85 ID-uri privește cardurile, referințele, etichetele și sincronizarea; nu pretindem că au fost efectuate 85 exporturi complete sau inspecții vizuale manuale individuale. Click-ul de identificare din proba cuplată este un eveniment real trimis elementului SVG, nu o certificare de interacțiune tactilă fizică.

## Publicare și inspecție vizuală

Auditul Pages [40417086901](https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/40417086901) verifică release-ul exact `e837337`: **440/440 resurse, 125 GeoJSON, 277.999.194 octeți**. Sunt validate hashurile, sursele publicate și încărcarea în Chromium, nu doar codurile HTTP. Inventarul integral este în `pages-acceptance.json`.

Auditul NI publicat [40417082708](https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/40417082708) folosește auditorul `f4cb0ce97887ec395204380f8bf435fdaca92c22`. Acest SHA de instrumentare nu este confundat cu commitul aplicației publicate: sunt verificate separat octeții surselor publicate și cele două active virtuale NI.

Au fost inspectate capturile cu secțiunea NI efectiv vizibilă la **1440×900, 900×768, 390×844 și 844×390**. Textul este lizibil, avertismentele sunt vizibile, iar cardurile folosesc scroll vertical fără overflow orizontal. În landscape, înălțimea redusă impune derulare pentru restul cardului. Desktop/mobil, controalele panourilor, căutarea, filtrele, zoom-ul, fundalul și stările responsive sunt testate și în matricea generală Pages. Sunt folosite viewporturi Chromium și arborele de accesibilitate; nu pretindem testare pe telefoane sau cu cititoare de ecran fizice. Capturile, hashurile și observațiile sunt în `chromium-acceptance.json`.

## Integritate și limite

Generatorul verifică cele **32/32 componente** împotriva chitanței protejate: RO=3246, MD=2602, TOTAL=5848. Fingerprintul semantic rămâne `a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446`. Părinții MD, CUATM, identitățile, geometriile, modelul documentar și sursele OSM rămân nemodificate. Nu s-au efectuat editări OSM sau promovări P9.1.

Clasificarea 7/9, certificarea juridică, controlul efectiv, candidaturile geometrice și problemele istorice OSM rămân în `remaining-exceptions.json`. #396 este OPEN; #398 rămâne Draft. #442 este închis administrativ/not_planned și certificarea juridică integrală rămâne neobținută. Aceste limite nu sunt transformate în identități juridice prin acceptarea interfeței.

## Decizia și atestarea post-merge

Release-ul funcțional este susținut de probele integrate: carduri unificate, geometrii unice, bife sincronizate, arbori separați și ACTUAL intact. Toate verdicturile funcționale detaliate se verifică din registre și rapoartele autentice, prin generatorul determinist și testele negative.

**Închiderea administrativă a WEB-NI-U1 necesită încă atestarea post-merge a propriului PR de dosar.** Acest fișier nu afirmă rezultate viitoare. Comentariul final al PR-ului trebuie să publice SHA-ul de merge, CI terminal, A/B, deploymentul, auditul Pages pe acel SHA și hashul manifestului integrat. Doar atunci poate fi stabilit `WEB_NI_U1_ROADMAP_CLOSED=true`. Chitanțele acestui dosar rămân identificabile ca probe ale release-ului funcțional, fără un ciclu de commituri care ar pretinde să-și certifice propriul SHA.

Verdicte independente păstrate: `NI_LEGAL_CERTIFICATION_COMPLETE=false`, `OSM_FRESHNESS_PASS=false`, `P91_IMPORT_ALLOWED=false`, `READY_FOR_UA_CV0=false`. Acceptarea WEB-NI-U1 nu închide roadmap-ul global OSM/NI-JUR.
