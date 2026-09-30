# Reforma Teritorială

Atlas teritorial pentru România și Republica Moldova.

## Stadiu

**ACTUAL v1** este modulul implementat și release-uit tehnic. `ISTORIC` și `PROPUNERI` rămân faze separate de roadmap; interfața nu le prezintă ca date publicate.

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

Snapshot-ul public ACTUAL RO+MD este descris de `data/current/actual-release-manifest.json`. Release-ul curent este `actual-5383ff3db7cf3f67`, cu fingerprint semantic `5383ff3db7cf3f677006ad3e70c706dccc8c208eea84b1689bb645d056e471dc`.

`data/current/actual-release-gate.json` validează fail-closed gate-urile RO/MD, integritatea manifestului, source bundle-ul, review-evidence bundle-ul, mediul de build, network denial și contractul public.

## Contract public ACTUAL

`scripts/process/build-actual-public-data.mjs` generează:

- `public/data/actual-entities.json` — contract `actual-public-entity-v1`;
- `public/geo/actual/{ro,md}-overview.geojson` — limite regionale;
- `public/geo/actual/{ro,md}-local.geojson` — UAT-uri locale;
- `public/geo/actual/{ro,md}-detail.geojson` — sectoare, localități și reprezentări de detaliu.

Contractul separă `legal` de `representation`. O identitate SIRUTA/CUATM este publicată numai după reconciliere pozitivă. Lipsa identității rămâne `null`; nu se deduce din geometrie sau din taguri OSM.

GeoJSON-urile publice păstrează coordonatele geometriei master **fără simplificare**. Tier-urile există doar pentru încărcare progresivă, iar legătura cu catalogul master este păstrată prin `entity_id`.

## Source bundle și reproducibilitate

`data/current/actual-source-bundle-manifest.json` fixează bytes exacți pentru snapshot-urile OSM RO/MD și sursele oficiale SIRUTA/CUATM. Candidate lifecycle include build offline, network-denial proof, toolchain/runtime pinning și dovadă de reproducibilitate CHANGE byte-for-byte.

## Limitări și trust boundary v1

- limitările revizuite ale snapshot-ului sunt în `docs/actual-v1-known-limitations.md`;
- trust boundary-ul acceptat pentru repository-ul personal GitHub este în `docs/actual-v1-trust-boundary.md`;
- auditul write boundaries este în `docs/actual-write-boundary-audit.md`.

## Licențiere

Codul și documentația originală sunt sub MIT (`LICENSE`). Datele externe și fișierele compozite au obligații de sursă separate; vezi `DATA-LICENSING.md`.
