# Model de date teritorial

Fiecare entitate teritorială trebuie să aibă un identificator intern stabil și metadate suficiente pentru proveniență și timp.

## Câmpuri de bază

- `id`
- `name`
- `category`
- `type`
- `subtype`
- `status`: `current`, `historical`, `proposed`
- `valid_from`
- `valid_to`
- `jurisdiction`
- `parent_id`
- `source`
- `source_date`
- `geometry_source`
- `boundary_quality`
- `osm_relation_id` (unde este relevant)
- `admin_level` (unde este relevant)

Geometriile master vor folosi WGS84 / EPSG:4326. Delimitările aproximative sau reconstruite trebuie marcate explicit și nu trebuie prezentate ca limite juridice exacte.

## Contractul public ACTUAL

Modelul master și modelul de afișare sunt separate. Pentru ACTUAL, fiecare entitate publică expune patru blocuri distincte:

- `legal` — identitate oficială reconciliată (SIRUTA/CUATM) sau `null`;
- `hierarchy` — părinte cartografic și, separat, părinte legal când există;
- `representation` — relația OSM, `admin_level`, sursa și rolul geometriei;
- `validation` — starea reconcilierii și nivelul de încredere al reprezentării.

`display_type` este un câmp de prezentare și nu trebuie confundat cu `legal.type`. În special pentru Republica Moldova, acolo unde registrul CUATM nu este decodat într-un tip juridic explicit, `legal.type` rămâne `null` chiar dacă reprezentarea OSM are o clasificare utilă pentru hartă.

GeoJSON-urile din `public/geo/actual/` sunt derivate simplificate pentru web. Geometriile master rămân în `public/geo/current/` și continuă să fie sursa auditabilă a snapshot-ului.
