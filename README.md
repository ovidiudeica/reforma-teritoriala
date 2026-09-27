# Reforma Teritorială

Atlas teritorial actual și istoric pentru România și Republica Moldova.

## Structura conceptuală

Proiectul este organizat în două blocuri principale:

- **ACTUAL** — unități administrativ-teritoriale și alte delimitări teritoriale existente în prezent.
- **ISTORIC** — unități, regiuni și delimitări care au existat în trecut, legate de o perioadă de valabilitate.

Separat, proiectul va putea conține **PROPUNERI** de reorganizare teritorială. Acestea nu trebuie confundate cu datele actuale sau istorice.

## Structura inițială a repository-ului

```text
data/
  current/       date teritoriale actuale
  historical/    date teritoriale istorice
  proposals/     scenarii și propuneri
  sources/       evidența surselor și metadatelor

scripts/
  import/        import din surse externe, inclusiv OSM-Boundaries
  process/       validare, normalizare și optimizare GIS

src/             codul aplicației web
public/geo/      date GIS optimizate pentru website
```

## Principii de date

Fiecare obiect teritorial va păstra, pe cât posibil:

- identificator intern stabil;
- denumire și denumiri alternative;
- tip și categorie;
- statut temporal: `current`, `historical` sau `proposed`;
- `valid_from` și `valid_to`;
- sursa și data sursei;
- sursa geometriei;
- identificatorul OSM, unde există;
- nivelul administrativ OSM, unde este relevant;
- geometria în WGS84 / EPSG:4326.

## Surse cartografice

Pentru blocul actual, una dintre sursele principale va fi OpenStreetMap, inclusiv geometriile administrative exportate prin OSM-Boundaries.

Datele istorice vor fi documentate separat și nu vor fi deduse automat din snapshot-uri OSM.

## Release ACTUAL

Snapshot-ul public ACTUAL RO+MD este identificat prin `data/current/actual-release-manifest.json`. Manifestul fixează prin SHA-256 catalogul curent, modelul administrativ, GeoJSON-urile publice, gate-urile RO/MD și snapshot-urile oficiale SIRUTA/CUATM și generează un `snapshot_id` derivat din conținut.

`data/current/actual-release-gate.json` validează fail-closed că ambele gate-uri jurisdicționale sunt `PASS`, că manifestul corespunde exact fișierelor curente și că numărătorile, versiunile surselor și fingerprint-ul nu au derivat. Aplicația publică afișează modul ACTUAL numai când acest gate combinat este `PASS`.

## Contract public ACTUAL

Aplicația nu consumă direct GeoJSON-urile master de zeci de MB. `scripts/process/build-actual-public-data.mjs` generează:

- `public/data/actual-entities.json` — indexul public de entități, conform `actual-public-entity-v1`;
- `public/geo/actual/{ro,md}-overview.geojson` — limite regionale;
- `public/geo/actual/{ro,md}-local.geojson` — UAT-uri locale;
- `public/geo/actual/{ro,md}-detail.geojson` — sectoare, localități și reprezentări de detaliu.

Contractul separă explicit `legal` de `representation`. O identitate SIRUTA/CUATM este publicată numai când reconcilierea oficială este pozitivă; lipsa unei identități este păstrată ca `null`, nu dedusă din tagurile OSM. GeoJSON-urile publice sunt împărțite pe niveluri pentru încărcare progresivă, fără simplificarea coordonatelor, și păstrează legătura prin `entity_id` către catalogul master.

Straturile web și indexul public sunt incluse în fingerprint-ul `actual-release-manifest.json`; gate-ul ACTUAL verifică fail-closed cardinalitatea 1:1 între catalog, contract și geometriile publice.
