# Reforma Teritorială

Atlas teritorial pentru România și Republica Moldova.

## Stadiu

**ACTUAL v1.2** și interfața **web-v1.2** sunt baseline-urile publice curente. `ISTORIC` și `PROPUNERI` rămân faze separate de roadmap; interfața nu le prezintă ca date publicate.

## Arhitectură

- **ACTUAL** — unități administrativ-teritoriale și alte reprezentări teritoriale curente.
- **ISTORIC** — corpus separat pentru unități și delimitări istorice, neimplementat în v1.
- **PROPUNERI** — corpus separat pentru scenarii de reorganizare, neimplementat în v1.

Geometriile ACTUAL folosesc WGS84 / EPSG:4326. OpenStreetMap este sursa geometrică principală; SIRUTA (INS, România) și CUATM (BNS, Republica Moldova) sunt folosite pentru identitate legală/oficială și reconciliere.

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
```

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
