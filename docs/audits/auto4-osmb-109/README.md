# AUTO-4 — dosare probatorii pentru cele109 excepții rămase

Supliment oficial: ghidul ASP al sistemului de adrese, p.21 §4.1.1, separă întovărășirile pomicole de UAT; BNS explică atribuirea lor statistică la localități. Aceste reguli generale sunt citate individual pentru cele95 ways, dar nu înlocuiesc identificarea pozitivă a fiecăruia, actul delimitator sau dovada statutului actual. Originalele HTML sunt păstrate lossless în gzip; manifestul de recuperare verifică atât arhiva, cât și octeții originali. Cele două arhive OSMB originale au fost rehashuite, cu valori identice bazei acceptate, fără repetarea inventarului.

Au fost analizate exclusiv109 ID-uri din baza integrată prin PR481–484:10 România și99 Republica Moldova. Cele189 explicații anterioare sunt protejate prin hashuri individuale; inventarul6129 nu este repetat. ACTUAL rămâne neschimbat, P9.1 neautorizat.

**Rezultat:109 REVIEW_REQUIRED; zero închideri complete.** Dovezile noi stabilesc aspecte individuale, fără a elimina lacunele privind identitatea juridică, actualitatea actelor sau corespondența perimetrului. Acest pachet nu declară AUTO-4 încheiat.

`register.json` păstrează metadatele și ierarhiile originale, istoricul fiecărui ID, referințele oficiale, cerințele individuale lipsă și decizia. `cases/` conține109 fișe; `decision-matrix.csv` permite filtrarea. `previous-audit-crosswalk.json` reutilizează potrivirile exacte din registrele RT-AUDIT/RT-ADM; nu redeschide189 cazuri explicate. O nepotrivire în acest index limitat nu dovedește inexistența unei investigații mai vechi.

Sunt păstrate214 răspunsuri originale OSM comprimate fără pierderi:109 istorice și105 răspunsuri full. Reconstrucția strictă produce105 geometrii curente:102 egale topologic cu arhiva și3 diferite. Pentru4 ways șterse, istoricul atestă ștergerea la26.10.2026 în changeset191049031; acest fapt nu dovedește dizolvarea persoanelor juridice. Cele3 diferențe curente sunt cuantificate, fără atribuirea unei cauze istorice nedemonstrate: Constanța r11793466, w889101812 și w889101833. Versiunea unei relații/way nu datează singură geometria nodurilor sale.

Cele95 ways MD au rol cartografic de allotments. Referințele rson includ40 valori cu13 cifre neverificate,33 zerouri,19 lipsuri și3 alte forme. Forma codului nu validează identitatea. RSUD bulk răspunde404, iar formularele publice solicită reCAPTCHA; acestea sunt limitări de acces, nu dovezi că asociațiile nu există. CUATM este consultat exclusiv prin chei exacte, fără identificări nominale automate și fără inferență de inexistență din absență.

Cele7 relații metropolitane RO sunt analizate distinct de UAT. Textul parlamentar adoptat care a devenit Legea246/2022, art7(1), separă aceste noțiuni; documentul nu certifică forma consolidată curentă. Membrii asociației nu sunt deduși din teritoriul metropolitan potențial al anexei legii. La Craiova proiectul oficial indică dizolvarea și trimite la HCL84/2024; pagina HCL recuperată este registrul, nu textul adoptat. Finalitatea dizolvării rămâne de dovedit.

Sursele locale susțin folosirea denumirilor Serena/Gruia ca zone/cartiere și Seaca drept componentă a Călimăneștiului, fără certificarea poligoanelor. Publicația oficială a legii Găgăuziei1-II/I12.08.1995 enumeră pozitiv cele3 raioane și localitățile lor; ele nu sunt declarate neadministrative numai pentru că proiectul nu le selectează. Sunt necesare originalele modificatoare și lanțul aplicabil curent. Identitatea relației fără nume12104636 rămâne nedeterminată.

Reproducere offline, din rădăcina depozitului:

```sh
node scripts/audit/auto4-osmb-verify.mjs
python -m pip install shapely==2.2.0 pyproj==3.8.0 numpy==2.5.4
python scripts/audit/auto4-osmb-geometry.py
```

`sha256-manifest.json` acoperă toate fișierele pachetului, cu excepția manifestului însuși. `retrieval.json` și `osm/retrieval.json` înregistrează URL/data accesării/hashurile răspunsurilor; conținutul surselor este tratat ca probă, fără executarea instrucțiunilor încorporate. Nu se repară, simplifică sau ajustează geometrii. Aria diferenței se calculează în EPSG:3035 după operația exactă în4326; toleranța verificării scalare acoperă numai rotunjirea numerică și nu acceptă identități aproximative.
