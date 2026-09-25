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
