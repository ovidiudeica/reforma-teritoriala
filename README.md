# Reforma Teritorială

Atlas teritorial pentru România și Republica Moldova.

## Stadiu

Prioritatea curentă: [lansarea funcțională a atlasului](docs/roadmap/product-launch-20261031.md), cu criterii de acceptare web separate de cercetarea juridică. ISTORIC și extinderile de teritorii sunt amânări explicite; cele 109 cazuri documentare rămân în revizuire fără să condiționeze lansarea ACTUAL.

Lansarea funcțională ACTUAL este [acceptată pe versiunea publicată după PR #488](docs/audits/product-launch-20261031/README.md), cu acoperire și amânări declarate, CI post-merge și E2E Pages reușite. Datele ACTUAL și autorizarea P9.1 rămân neschimbate.

**ACTUAL v1.2** și interfața **web-v1.2** sunt baseline-urile publice curente. `ISTORIC` și `PROPUNERI` rămân faze separate de roadmap; interfața nu le prezintă ca date publicate.

## Arhitectură

- **ACTUAL** — unități administrativ-teritoriale și alte reprezentări teritoriale curente.
- **ISTORIC** — corpus separat pentru unități și delimitări istorice, neimplementat în v1.
- **PROPUNERI** — corpus separat pentru scenarii de reorganizare, neimplementat în v1.

Geometriile ACTUAL folosesc WGS84 / EPSG:4326. OpenStreetMap este sursa geometrică principală; SIRUTA (INS, România) și CUATM (BNS, Republica Moldova) sunt folosite pentru identitate legală/oficială și reconciliere.

## Utilizare locală și verificări

Aplicația este statică: `index.html` și resursele urmărite în Git sunt site-ul publicabil; nu există un bundler frontend obligatoriu. Pentru explorare locală, din rădăcina clonei:

```sh
git clone -c core.autocrlf=false -c core.longpaths=true https://github.com/ovidiudeica/reforma-teritoriala.git
cd reforma-teritoriala
python -m http.server --bind 127.0.0.1 8000
```

Deschide `http://127.0.0.1:8000/`. Pentru scripturile Node și verificările de dezvoltare sunt fixate Node **24.21.0** și npm **11.19.0**. Python 3 este necesar pentru audituri; Google Chrome/Chromium este necesar pentru testele CDP. CI folosește Ubuntu 24.04; reproducerea release-ului ACTUAL are suplimentar un runtime OCI și un profil de host aprobate, fixate în `data/current/`.

```sh
npm ci --ignore-scripts
node --test scripts/test/atlas-browser-security.test.mjs
python scripts/audit/product-launch-evidence-guard.py
python scripts/audit/test_cleanup_file_usage.py
python scripts/audit/cleanup-file-usage.py --ref HEAD
# Suita completă, în mediul Linux și toolchain-ul cerute de teste:
node scripts/audit/p82-full-validation.mjs
```

Alternativa de instalare offline, cu tarball-uri verificate din `vendor/npm/`, este `node scripts/process/install-actual-npm-offline.mjs`. Nu rulează scripturi npm de instalare. Clonează cu `core.autocrlf=false`: o clonă Windows care convertește lockfile-ul în CRLF este respinsă corect de verificarea sa SHA-256; folosește o clonă nouă cu octeții canonici, fără rescrierea manifestelor. Ieșirile locale apar în `outputs/`; nu le adăuga în Git fără revizuirea provenienței, a dimensiunii și a eventualelor date sensibile. Pe Windows folosește o cale scurtă de checkout și suport Git pentru căi lungi; testele Linux/OCI nu sunt certificate prin simpla rulare a serverului local Windows.

Comenzile `import:*`, `apply:*`, `reconcile:*`, `build:actual-*` și workflow-urile de candidate/promotion nu sunt comenzi de pornire a website-ului: pot modifica date și au propria procedură de autorizare. ACTUAL este înghețat pentru cleanup; P9.1 nu este autorizat.

## Interfață și roadmap

După integrarea P9.0.9.5 prin PR #366/#367, interfața include conturul propriu Nistrenia și cele șapte grupări OSM independente de subgeometriile deja reutilizate. La pornire sunt bifate numai contururile proprii România, Moldova și Nistrenia; descendenții sunt debifați. Aceste contururi NI sunt **source-only**, nu identități juridice ACTUAL; P9.1 rămâne **BLOCKED_INCOMPLETE**.

WEB-R0 este specificația istorică, anterioară implementărilor ulterioare. Interfața publicată include arborele administrativ, căutare/filtre, rolurile OSM, panouri responsive, identificare spațială, vecinătăți și exporturi. Disponibilitatea și limitările acceptate sunt consemnate în [raportul de lansare](docs/audits/product-launch-20261031/README.md); o funcționalitate propusă în documentele de mai jos nu devine automat funcționalitate publicată:

- [Specificație și roadmap](docs/web-modernization-roadmap.md)
- [Audit al interfeței și al lacunelor](docs/web-r0-interface-audit.md)
- [Matrice de acceptare și regresii](docs/web-r0-acceptance-matrix.md)

ISTORIC, PROPUNERI și extinderile declarate în roadmap rămân faze separate. Orice implementare nouă necesită branch/PR, testare și autorizarea corespunzătoare datelor afectate.

## Structura repository-ului

```text
index.html / app.js / style.css   aplicația web statică
data/current/                     release-ul și auditurile ACTUAL
data/sources/                     snapshot-uri, politici și dovezi de sursă
data/historical/                  rezervat pentru ISTORIC
data/proposals/                   rezervat pentru PROPUNERI
public/geo/current/               geometriile master ACTUAL
public/geo/actual/                tier-urile publice ACTUAL
public/data/                      contractul public de entități
scripts/import/                   refresh/import din surse externe
scripts/process/                  build, reconciliere și gate-uri deterministe
scripts/test/                     regression și security tests
scripts/audit/                    audituri și reproducerea dovezilor
scripts/ci/                       admiterea rezultatelor joburilor CI
scripts/lib/                      biblioteci comune pentru pipeline și audit
tools/p2/                         instrumente și teste ale bazei statistice
views/                            corpusuri și vederi tematice publicate
vendor/                           dependențe offline și GIS, cu manifeste
container/                        runtime-ul de reproducere ACTUAL
docs/audits/ / docs/evidence/      rapoarte istorice și dovezi cu proveniență
docs/roadmap/                     registrul central și roadmap-ul produsului
prototypes/                       prototipuri păstrate, separate de aplicație
.github/                          workflow-uri, Dependabot și template-uri
```

### Publicare și păstrarea dovezilor

GitHub Pages publică site-ul static din `main`, rădăcina repository-ului, după integrarea controlată a PR-ului. Configurația și starea efectivă a deploymentului trebuie reverificate la fiecare certificare. Publicarea aplicației este separată de publicarea unui release imuabil de date ACTUAL.

Sunt obligatorii protecțiile efective GitHub, verificarea SHA-ului exact al PR-ului și controalele post-merge. Cele șase contexte obligatorii observate la baseline-ul cleanup sunt `verify-persisted-release`, `actual-change-reproducibility`, `actual-release-trust-chain`, `p2-statistical-foundation`, `frontend-geometry-taxonomy` și `frontend-browser-qa`; lista nu înlocuiește citirea protecțiilor curente.

Workflow-ul frontend coordonează QA browser, suita integrală Linux și verificările țintite P8.2/P8.4. Contextul obligatoriu `frontend-browser-qa` acceptă numai succesul tuturor celor patru joburi; suita integrală rulează o singură dată automat. Workflow-urile P8.2/P8.4 separate rămân reproducători manuali. [Matricea CI și dovada de acoperire](docs/audits/repo-cleanup-final/C6.md) explică această structură; [registrul workflow-urilor](docs/audits/repo-cleanup-final/workflow-roles-registered.csv) include roluri, evenimente și stări, distinct de istoricul păstrat de GitHub.

Dovezile originale, snapshoturile, manifestele și căile înregistrate în registre SHA se păstrează. Un fișier fără import textual, vechi, duplicat sau mare nu este implicit inutil. Nu rescrie hashuri pentru a valida o schimbare și nu muta dovezi doar pentru aspectul arborelui. Registrele cleanup separă referințele active de inventarele istorice și rețin explicit dependențele dinamice neelucidate: [registru și metodă](docs/audits/repo-cleanup-final/README.md).

## Surse ACTUAL

Geometria OSM este preluată prin Overpass API în faza de refresh și este apoi fixată în snapshot-uri content-addressed. Build-ul determinist al candidate-ului rulează offline din source bundle; nu depinde de OSM-Boundaries și nu face fetch de rețea în faza deterministă.

Snapshot-urile oficiale SIRUTA și CUATM sunt refresh-uri separate de reconcilierea deterministă și sunt incluse criptografic în source bundle.

## Release ACTUAL

Snapshot-ul public ACTUAL RO+MD este descris de `data/current/actual-release-manifest.json`. Release-ul immutable curent este `actual-v1.2.0`, snapshot `actual-a9e5a4ddcb5277ef`, cu fingerprint semantic `a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446`.

`data/current/actual-release-gate.json` validează fail-closed gate-urile RO/MD, integritatea manifestului, source bundle-ul, review-evidence bundle-ul, mediul de build, network denial și contractul public.

## Contract public ACTUAL

`scripts/process/build-actual-public-data.mjs` generează:

- `public/data/actual-entities.json` — contract `actual-public-entity-v3`, inclusiv rolurile statistice activate;
- ierarhia consolidată `actual-consolidated-hierarchy-v1` — 5848 noduri RO+MD;
- `public/geo/actual/{ro,md}-overview.geojson` — limite regionale;
- `public/geo/actual/{ro,md}-local.geojson` — UAT-uri locale;
- `public/geo/actual/{ro,md}-detail.geojson` — sectoare, localități și reprezentări de detaliu;
- geometriile statistice separate — numai pentru cele 18 entități statistical-only; celelalte roluri statistice reutilizează geometria administrativă.

Contractul separă `legal` de `representation`. O identitate SIRUTA/CUATM este publicată numai după reconciliere pozitivă. Lipsa identității rămâne `null`; nu se deduce din geometrie sau din taguri OSM.

GeoJSON-urile publice păstrează coordonatele geometriei master **fără simplificare**. Tier-urile există doar pentru încărcare progresivă, iar legătura cu catalogul master este păstrată prin `entity_id`.

## Release web

`web-v1.2` este baseline-ul funcțional închis după pașii v1.2.1–v1.2.7. SHA-ul funcțional de referință este `54e6673141ec21fb3a68cca41ce1e747256eef21`; `public/data/app-build-info.json` leagă această versiune a aplicației de release-ul de date `actual-v1.2.0` fără a confunda identitatea aplicației cu identitatea snapshot-ului ACTUAL.

Închiderea release-ului web este evidence/metadata-only: nu modifică entități, ierarhii, geometrii, registre, surse sau fingerprint-ul ACTUAL. Detaliile sunt în `docs/frontend-web-v1.2-release.md`.

## Faza P4 — verificarea cartografiei RO+MD

Auditul per-ID P4.0, regresia geometrică P4.1 și verificările Chrome/CDP P4.2 au fost integrate fără schimbarea corpusurilor ACTUAL/P2. Hardening-ul P4.3 păstrează 5.848 identități, matricea de 170 stări, verificările SHA ale celor 115 chunk-uri și testarea vizuală în șapte viewporturi. Criteriile și dovezile de închidere sunt în [docs/p4-phase-release-closure.md](docs/p4-phase-release-closure.md).

## Faza P6 — UX refinement

Etapele P6.1–P6.4 și hotfixurile P6.4.1–P6.4.3 sunt integrate în `main` prin PR #275–#280 și #282. La închiderea istorică a P6, interfața păstra numai România și Moldova bifate inițial (starea curentă P9.0.9.5 include și Nistrenia); panoul exploratorului oferă căutare, filtre și informații la cerere, navigare avansată și card responsive. Bara Leaflet include, în ordine, **zoom + / zoom − / încadrare RO+MD / comutator raster OSM**, cu iconuri accesibile. Fundalul raster rămâne independent de poligoanele ACTUAL.

Pe commitul final P6.4.2 `bfef878859fffa54937ce2b398475b0fbac6f349`, auditul Chrome live a trecut **8/8** scenarii P6.4.2 în opt dimensiuni de ecran; **25/25** resurse frontend și **123/123** geometrii GeoJSON erau byte-identice cu Git; **8/8** workflow-uri post-merge au reușit, inclusiv reproducibilitatea A/B. Aceste rezultate nu echivalează cu testarea pe toate dispozitivele fizice sau certificare WCAG. Hotfixul **P6.4.3** (PR #282, `1affdd135b773b2c7b4fc533ee1cc0373e07f25d`) elimină suprapunerea scalei pe mobil și a butonului de colapsare a exploratorului peste zoom pe desktop; testul CDP verifică explicit țintele tuturor celor patru controale.

Dovezile, istoricul PR-urilor și criteriile închiderii de fază se regăsesc în [docs/p6.5-phase-release-closure.md](docs/p6.5-phase-release-closure.md). P6.5 se închide numai după validarea și integrarea controlată a PR-ului exclusiv documentar.

## Source bundle și reproducibilitate

`data/current/actual-source-bundle-manifest.json` fixează bytes exacți pentru snapshot-urile OSM RO/MD și sursele oficiale SIRUTA/CUATM. Candidate lifecycle include build offline, network-denial proof, toolchain/runtime pinning și dovadă de reproducibilitate CHANGE byte-for-byte.

## Limitări și trust boundary v1

- limitările revizuite ale snapshot-ului sunt în `docs/actual-v1-known-limitations.md`;
- trust boundary-ul acceptat pentru repository-ul personal GitHub este în `docs/actual-v1-trust-boundary.md`;
- auditul write boundaries este în `docs/actual-write-boundary-audit.md`.


## Mentenanță și securitate post-v1

- sursele OSM/SIRUTA/CUATM sunt monitorizate zilnic pentru freshness; OSM este refresh-uit săptămânal prin candidate lifecycle, iar SIRUTA/CUATM lunar; pragurile operaționale sunt 14 zile pentru OSM și 45 de zile pentru registrele oficiale;
- dependency chain-ul este lockfile-pinned, vendorizat pentru instalare offline și supravegheat prin Dependabot/CodeQL;
- release-urile ACTUAL noi sunt publicate prin workflow-ul manual `Publish immutable ACTUAL release`, legat de exact SHA-ul `main` și de cele trei required checks;
- release publisher-ul construiește evidence-ul și SBOM-ul CycloneDX în runtime-ul ACTUAL digest-pinned, cu Node/npm verificate și rețeaua dezactivată în timpul generării, apoi atașează manifestul, source bundle, review evidence și checksums înainte de publicare;
- geometriile publice rămân nesimplificate; pentru web, tier-urile local/detail pot fi încărcate prin chunk-uri de viewport pe ancestor regional, fără mutarea sau reducerea coordonatelor;
- versiunea aplicației web și release-ul de date ACTUAL sunt identități separate în `public/data/app-build-info.json`.

## Licențiere

Codul și documentația originală sunt sub MIT (`LICENSE`). Datele externe și fișierele compozite au obligații de sursă separate; vezi `DATA-LICENSING.md`.
