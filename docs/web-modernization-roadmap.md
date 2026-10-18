# WEB-R0 — specificația finală și roadmapul de modernizare a atlasului

**Stare:** SPECIFICAȚIE / audit read-only; NU reprezintă implementare sau acceptare vizuală.  
**Bază examinată:** `main` `e2055e88b228d40780a1a013c80e1f70dd870edb` (2026-10-18); PR #366 și #367 integrate.  
**Aplicabilitate:** numai interfața web, contractele auxiliare source-only, testele browser și documentația.  
**Documente complementare:** [auditul real al interfeței](web-r0-interface-audit.md) și [matricea de acceptare](web-r0-acceptance-matrix.md).

## 0. Limite imuabile și reguli de lucru

1. ACTUAL rămâne immutable: 5.848 identități; geometrii EPSG:4326 și precizia master; ierarhii, SIRUTA/CUATM, snapshot `actual-a9e5a4ddcb5277ef`, fingerprint `a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446`, source bundles, manifests, provenance și release gates neschimbate. Cele 85 de roluri OSM reutilizate nu se clonează. Cele 8 contururi proprii Nistrenia sunt **source-only**, nu sunt promovate în ACTUAL.
2. Blocarea P9.1 continuă independent de orice succes web: `p91_import_allowed=false`, `semantic_acceptance=BLOCKED_INCOMPLETE`, `actual_mutation_allowed=false`. Acceptarea cartografică nu certifică statut juridic sau identitate oficială.
3. Rădăcinile România, Moldova și Nistrenia au geometria proprie activă implicit; toate geometriile descendente rămân OFF. **Deschidere arbore ≠ selectare entitate ≠ bifare contur ≠ aplicare filtru**; niciuna dintre operațiuni nu produce selecție în masă implicită.
4. Nu se mută date între ACTUAL / ISTORIC / PROPUNERI. Ultimele două rămân indisponibile până la release-uri autonome.
5. Nu se schimbă contractele URL/history arbitrar; dacă un feature necesită stare serializată nouă, se propune extensie versionată, canonică și backward compatible, cu regresie pentru linkurile v1/v2.
6. Fiecare schimbare de comportament/layout merge într-un PR independent, închis numai după required checks, CodeQL, Chromium, regresie desktop/mobil și audit Pages; fără bypass sau dezactivarea testelor. Auditul și propunerile sunt separate de implementare.
7. Economisirea cotei Codex: instrumentele GitHub execută documentație, inventare, PR-uri izolate și triere; Codex este rezervat remedierilor ce necesită browser real, capturi A/B, interacțiuni, performanță și testarea importului în My Maps. Desktop Commander nu este o dependență.

## 1. Conceptul produsului

Atlasul este **map-first**: harta deține spațiul predominant; navigarea și cardurile sunt contexte temporare, nu panouri permanente care concurează cu harta. Designul folosește aceeași identitate pentru toate modulele: clar, sobru, cartografic, scalabil, accesibil și pregătit pentru RO/EN.

### 1.1 Sistem vizual unic

- Un set centralizat de design tokens CSS: font stack cross-platform, mărimi, line-height, grosimi, spațiere în multipli de 4/8, culori semantice, contrast, raze, chenar, shadow, înălțimi tactil și state interactive. Se evită CSS contradictoriu între `style.css`, shell, P5/P6 și foile per-modul.
- Rolurile textului, consecvente peste tot: titlu aplicație; titlu de panou; titlu de secțiune; nume entitate; text normal; metadate; ajutor; statut/eroare; număr tehnic. Un rol = un stil; nu se uniformizează toate la aceeași dimensiune.
- Butoanele sunt vizibil interactivizate (fond, border, focus, hover, active, pressed, disabled); mărime tactilă minim 44×44 CSS px; iconuri SVG consecvente, aria-label și tooltip pentru cele icon-only; icon + text pentru acțiuni cu sens contextual/destructiv.
- `X` exclusiv simbolic pentru închiderea panourilor și cardurilor, dar cu nume accesibil distinct (`Închide panoul`, `Închide detaliile`); nu confunda cu `Șterge selecția`. Testează semantica exactă existentă înainte să o modifici.
- Tipografie și iconuri verificate la zoom/text 200%, contrast normal/forced-colors, preferințe reduced-motion; fără clipping, suprapuneri, disimularea atribuirii OSM ori pierderea focusului.

### 1.2 Arhitectura panourilor

- Antet comun cu titlu dinamic, `X` sticky/ancorat și indicatorii utili. Conținut scrollabil independent de antet; fără scroll nest în cardul compact.
- Fiecare panou complex se împarte în **secțiuni drop-down/accordion independente**: sunt permise mai multe secțiuni deschise simultan. Secțiunile de bază ale operației curente pot fi deschise implicit, cele secundare închise. Căutarea/arborele/conținutul esențial nu se ascund la fiecare acces într-un accordion suplimentar.
- Componentă unitară (nativ `details/summary` când este potrivit; altfel buton cu `aria-expanded`, `aria-controls`, focus și tastatură), titlu, pictogramă, număr/opțiuni active, indicator chevron, stări loading/empty/error. Nu introduce nesting inaccesibil ori recapitulări fără context.
- Filtre, Entități, Straturi, Identificare, Măsurare, Vecini, Comparație, Partajare, Informații, Module, Recente și secțiunile cardurilor participă la același design system. Acțiunile critice rămân accesibile când secțiuni sunt restrânse; erorile critice nu sunt ascunse.

### 1.3 Cele două bare de comenzi

**Bara hărții (Leaflet)**: numai comenzi ale hărții, grup compact în ordinea `zoom +` → `zoom −` → `încadrare` → `fundal OSM ON/OFF`. Refolosește iconurile accesibile curente. Nu amesteca resetarea bifelor, măsurarea și exportul cu zoomul. Precizează înainte de implementare diferența dintre încadrarea existentă RO+MD și o posibilă încadrare a contururilor afișate (inclusiv NI): o schimbare de semantică necesită acțiune/eticheta și teste distincte.

**Bara navigării (rail)**:
- grupa principală, prima și mereu accesibilă: **Entități → Căutare → Straturi → Filtre**;
- grupa instrumente: **Identifică → Măsoară → Vecini → Compară**;
- grupa secundară: **Partajare/Export → Recente/Vederi salvate → Informații**. `Module` rămâne acțiunea din antet; exporturile contextuale din card nu sunt duplicate în mod inutil.
- desktop: rail vertical cu separatoare discrete și iconuri uniforme; menține redimensionarea exploratorului;
- telefon/tabletă: numai cele patru comenzi principale persistente; restul într-un meniu `Mai multe` grupat și accesibil, fără overflow orizontal/vertical ori reflow agresiv. La activare, panoul schimbat recuperează focusul corect. Layoutul existent de 899/900px rămâne baseline până la acceptare explicită.
- Etichetele accesibile ale iconurilor sunt traduse; tooltips vizibile pe pointer, numele accesibile pe touch. `aria-pressed` desemnează starea activă reală.

## 2. Nivel administrativ OSM în arbore și filtre

- În fiecare rând cu `representation.admin_level` verificat, afișează înaintea numelui o **bulină numerică rotundă** ca la OSM-Boundaries (de exemplu `2`, `4`, `6`, `8`). Numărul este metadată OSM, **nu nivel NUTS, nu SIRUTA/CUATM și nu adjudecare juridică**. Culoarea nu este singurul indicator; numărul este text și are etichetă accesibilă `Nivel administrativ OSM 4`. Când lipsesc datele, nu deduce din ierarhie/denumire; folosește lipsă/necunoscut cu reguli explicite.
- Se aplică RO, MD, NI; pentru cele 8 contururi source-only folosește **catalogul OSM verificat**, nu instanția valori din rolurile celor 85. Auditul P9.0.9.6 trebuie să determine distribuția efectivă de niveluri și excepțiile pe fiecare jurisdicție înainte de implementarea filtrului.
- Noul filtru **`Nivel administrativ OSM`** este multi-select și distinct de filtrul deja implementat **`Niveluri statistice` (1–3)**. Un mod de filtrare restrânge rezultatele/arborele fără a schimba bifele; filtrul de vizibilitate al hărții se aplică explicit numai contururilor deja bifate. În UI trebuie să fie clar modul activ și totalurile.
- Acțiuni de grup distincte: `Afișează nivelul` / `Ascunde nivelul` pentru contururi eligibile, cu jurisdicție, număr afectat, state post-acțiune și undo/reset. Acțiunea nu se execută prin click pe numele nivelului sau deschiderea secțiunii. Evită încărcarea simultană necontrolată a tuturor chunkurilor.
- Conservează semantica combinată statistic/admin deja verificată: pentru aceeași geometrie administrativ-statistică `administrativeVisible OR statisticalVisible`, fără duplicate; separate-statistical `level AND toggle`. Fiecare control nou primește regresii independente, inclusiv URL/Back/Forward și Nistrenia.

## 3. Funcții suplimentare, după consolidarea UI

### 3.1 Legendă și vederi

- Legendă dinamică pe geometrii/roluri/niveluri efectiv afișate, cu simboluri SVG, contor, explicații și proveniență. Nu confunda `admin_level` cu clasificarea statistică. Pregătește extindere pentru legendă de hărți tematice.
- Vederi salvate **locale și opționale**: preseturi pentru geometrie, filtre, zoom și centru; editare/ștergere/revenire; fallback sigur când localStorage este indisponibil. Nu stoca GPS, istoric sensibil ori date din pagină. Linkul share folosește schema URL existentă sau una evoluată explicit și canonic, nu starea unui modul privat.

### 3.2 Export interoperabil Google My Maps

- Adaugă **KML și KMZ**, alături de GeoJSON/JSON/CSV și exporturile vizuale existente. KMZ conține KML valid; exportul nu modifică datele sau ordinea coordonatelor în sursele publice.
- Domeniu: un poligon selectat; un set explicit de poligoane; geometriile efectiv vizibile. Nu extrapola la teritorii fără geometrie verificată. Pentru NI se conservă statutul source-only și distincția juridică. Nume, ID, `admin_level`, jurisdicție, snapshot/source, ODbL și disclaimer sunt incluse în metadatele exportabile, fără a introduce date personale.
- Format WGS84 `lon,lat[,alt]`; Polygon/MultiPolygon, găuri, inele și multipart exportate fără reparare ori simplificare tacită. Dacă formatul țintă pierde structură, avertizează sau oferă mod explicit adaptat.
- Google My Maps suportă KML/KMZ, dar are o limită documentată de **5 MB după decomprimare** și recomandă maximum **2.000 de rânduri/elemente de import**; importul poate omite `MultiGeometries` și alte elemente. Documentație: https://support.google.com/mymaps/answer/3024836?hl=en-GB . Preflight obligatoriu: octeți KML necomprimați, număr features, validitate coordonate, compatibilitate multipart, mesaje clare. Compresia KMZ nu elimină limita asupra conținutului decomprimat.
- Un mod special simplificat *ar putea* fi proiectat ulterior numai ca **derivat etichetat clar**, cu eroare și proveniență, fără schimbarea sau rescrierea ACTUAL. **Nu** îl activa implicit. Teste KML/KMZ sintactice + import My Maps real (negarantat doar din CI).

### 3.3 Interfață RO/EN

- Introdu infrastructură i18n cu chei semantice, cataloage versionate `ro`/`en`, fallback `ro`, traducerea întregii interfețe: secțiuni, butoane, tooltips, ARIA, mesaje de validare, erori, stări de loading/empty, explicații, exporturi vizuale, avertismente și ghid.
- Numele proprii oficiale, ID-urile și proveniențele nu se traduc automat. Exonime doar din tabel verificat; nu altera identitatea. Folosește `Intl` pentru numere/date/unități; păstrează codurile și schema export în format stabil.
- Comutator `RO / EN` previzibil, `lang` corect și stare de preferință cu fallback. Nu destabiliza contractul URL la activare.
- Verifică text lung în engleză, text 200%, landscape și etichete icon-only.

### 3.4 Indicatori statistici și hărți tematice

- Sistem de date **separat de ACTUAL**, cu schemă de observație: indicator, cod/definiție, valoare, unitate, an/perioadă, emitent, sursă, versiune, nivel și metodă de asociere cu entitatea; marcaje pentru lipsă/incompatibilitate de limite. Inițial: populație, densitate și indicatori de suprafață numai dacă există măsurători/metodologii validate.
- Audit al surselor oficiale INS/BNS și al licențelor; nu deduce populație/densitate din geometrie, nu transforma `admin_level` OSM în corespondență oficială NUTS/CUATM fără bridge explicit. Arată anul și seria, comparabilitatea și sursa la fiecare valoare.
- UI: tab statistici în card, tabel, grafic, filtrare ani și unități, apoi hartă coropletă cu legendă și culori accesibile; agregări numai cu metodologie documentată. Lipsa datelor se vede, nu este inventată.

### 3.5 Ajutor și exporturi deja amânate

- Ghid contextual pentru bifare vs selectare, niveluri OSM vs niveluri statistice, măsurare, comparație, export. Mesaje uniforme de operație și eroare, fără modal inutil.
- Export listă vecinătăți P8.2 și export GeoJSON pentru geometrii derivate P8.3 sunt **evaluări viitoare**, documentate ca amânate în P8.4, nu funcții declarate gata.
- ISTORIC/PROPUNERI și P9.1 au planificare separată, fără activare în redesign.

## 4. Ordine de livrare și economie de Codex

| Lot | Livrabil și criteriu de intrare | Execuție eficientă |
|---|---|---|
| WEB-R0 | Documente de audit, specificație și matrice de acceptare; niciun runtime schimbat | **GitHub direct**, PR docs-only |
| WEB-R1a | Design tokens, inventar tipografie + componente de buton/accordion; fără refactor semantic | GitHub pentru CSS/documentație + teste statice |
| WEB-R1b | Rearanjare rail/Leaflet, panouri, carduri, responsive, A/B capturi | **Codex/Chrome** într-un singur batch țintit |
| WEB-R2a | Census read-only `admin_level` pe contracte și NI; maparea cazurilor lipsă | GitHub + script audit separat, fără data mutation |
| WEB-R2b | Buline, filtre de nivel, grup actions/undo și URL; QA | **Codex/Chrome** |
| WEB-R3 | Legendă adaptivă + vederi locale / ajutor contextual | GitHub pentru contract; Codex pentru UX |
| WEB-R4a | Serializator pur și preflight KML/KMZ + teste | GitHub direct într-un PR dedicat |
| WEB-R4b | Export UI, test de import My Maps și regresii | Codex/Chrome + test manual real |
| WEB-R5 | Profilare cold/warm, cache/performance/accesibilitate | CI read-only + Codex numai unde există defect |
| WEB-R6a | Catalog traduceri și audit text RO/EN | GitHub direct |
| WEB-R6b | Integrare i18n, persistence și teste browser | Codex/Chrome |
| WEB-R7a | Surse/statistical bridge/schemă/lacune/licențe | GitHub + validatori independent de ACTUAL |
| WEB-R7b | Tabele/grafice/choropleth, regresii temporale | Codex/Chrome |
| WEB-R8 | QA final, conformitate, GitHub Pages și release web nou, separat de ACTUAL | GitHub CI + audit Chromium |

Nu combina într-un singur PR modificările de UI, de serializare export și de i18n. Folosește prompturi Codex scurte cu referință la aceste documente, nu repeta tot contextul proiectului. Nu preda lui Codex o nouă etapă până când verificările precedente și toate artefactele sunt închise.

## 5. Release și acceptare

- Base SHA exact, fișiere schimbate, regresii locale + GitHub, CodeQL și snapshot/fingerprint check. Niciun PR nu depășește regulile branch protection.
- Chromium real: 360×640, 390×844, 430×932, 600×390, 640×360, 844×390, 768×1024, 899×768, 900×768, 1440×900; landscape/portrait; 200% text; keyboard/Tab/Shift+Tab/Escape; touch and pointer; focus/inert; full OSM attribution. Capturi A/B și matrice de hit-testing, inclusiv cardurile.
- Identități, roluri statistice și contururile NI rămân deduplicate; geometriile master sunt byte-identice. Orice schimbare în `data/` sau `public/` pentru alt motiv decât noi fișiere **source-only explicit aprobate** este STOP.
- Măsoară mobil cold/warm, transferuri, numărul de fetch-uri și memoria, fără a inventa bugete din lipsă de baseline. Alocă praguri după profilarea reproductibilă.
- Inspectează release metadata separat: `public/data/app-build-info.json` rămâne etichetat `web-v1.2` chiar dacă funcțiile mai noi sunt integrate. Un viitor release web poate actualiza identitatea **aplicației**, dar niciodată fingerprintul ACTUAL fără fluxul său autorizat.
- Nicio propoziție „gata” pe baza unei descrieri PR: necesită execuții pe HEAD, dovadă Pages/Chrome și verificări post-merge. P9.1 rămâne **BLOCKED**.

## 6. Decizii deja aprobate vs puncte care cer verificare

**Aprobate ca direcție:** fonturi și stiluri uniforme, accordion pe panouri, buton X, reordonare bară hartă/rail, buline `admin_level`, filtrare niveluri, RO/EN, indicatori statistici, export KML/KMZ, legendă dinamică, preseturi locale, reutilizarea geometriei și testarea desktop/mobil.

**Necesită cercetare/prototip înainte de schimbarea semantică:** distribuția exactă `admin_level` și cazurile fără nivel, semantica filtrului arbore vs hartă în UI, alegerea unui nou „fit visible” față de „fit RO+MD”, păstrarea selecțiilor de masă în URL, import My Maps de MultiGeometry, schema indicatorilor și corespondența între ani/limite, pragurile performanței și convenția versiunii web.

Niciunul dintre aceste puncte nu permite implicit modificarea ACTUAL sau autorizarea P9.1.
