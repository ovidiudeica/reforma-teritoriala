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
