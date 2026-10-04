# ACTUAL v1 — limitări revizuite și acceptate

Acest document îngheață limitările cunoscute ale snapshot-ului `actual-5383ff3db7cf3f67`, release fingerprint `5383ff3db7cf3f677006ad3e70c706dccc8c208eea84b1689bb645d056e471dc`.

Aceste cazuri nu sunt erori ascunse și nu autorizează inferențe noi. Orice schimbare viitoare trebuie să intre prin candidate lifecycle și gate-urile ACTUAL.

## Identitate MD nerezolvată

OSM relation `12104636` rămâne singura identitate nerezolvată acceptată în ACTUAL v1.

- relația nu are nume sau `place` în metadatele importate;
- părintele verificat este Hrușova, CUATM `3136`;
- geometria și părintele nu sunt considerate dovadă pozitivă de identitate;
- nu se atribuie CUATM, nume sau clasă juridică prin inferență;
- `md-release-gate` permite exact acest caz și eșuează la apariția unei identități nerezolvate noi.

Chițcani, OSM relation `6879649`, nu face parte din această limitare: identitatea este legată pozitiv de CUATM `7612`, iar geometria OSM rămâne explicit o reprezentare administrativă de-facto, fără afirmație de echivalență cu o geometrie juridică/cadastrală.

## Observații topologice MD

`data/current/actual-topology-audit.json` este `PASS`, cu 0 probleme blocante și 14 observații `child_bbox_exceeds_parent_bbox`. Cazul `osm-r1748490` (Chișinău) a fost eliminat din această listă prin corectarea ierarhiei cartografice la părintele canonic `osm-r1691801`, fără modificarea geometriei. Cele 14 observații rămase sunt semantice/nonblocking; auditul nu repară și nu mută coordonate.

| Entitate | Părinte |
| --- | --- |
| `osm-r18967259` | `osm-r19113736` |
| `osm-r18967626` | `osm-r12207955` |
| `osm-r18966913` | `osm-r19100177` |
| `osm-r18967052` | `osm-r19115707` |
| `osm-r18967249` | `osm-r19114022` |
| `osm-r18967274` | `osm-r10624608` |
| `osm-r18967755` | `osm-r19115707` |
| `osm-r18967196` | `osm-r19055801` |
| `osm-r18967786` | `osm-r19068255` |
| `osm-r18966972` | `osm-r10628594` |
| `osm-r18967825` | `osm-r19072238` |
| `osm-r18968068` | `osm-r12496849` |
| `osm-r18967148` | `osm-r19038433` |
| `osm-r18967694` | `osm-r10624608` |

Acest tip de observație indică doar că bounding box-ul copilului nu este complet inclus în bounding box-ul părintelui. Nu implică automat geometrie invalidă. Pentru snapshot-ul v1, validarea structurală separată confirmă geometrii poligonale, coordonate EPSG:4326 valide, inele valide, topologie JTS validă și absența geometriei master lipsă/duplicate.

## Regula de interpretare v1

ACTUAL v1 publică aceste limitări ca stare cunoscută a release-ului. Nu se ghicește identitatea lui `12104636` și nu se modifică geometria pentru a elimina artificial cele 14 observații rămase. O corecție ulterioară necesită dovezi noi și un nou candidate/release ACTUAL.
