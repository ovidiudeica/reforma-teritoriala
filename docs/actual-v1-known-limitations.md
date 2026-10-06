# ACTUAL v1.1 — limitări revizuite și acceptate

Acest document îngheață limitările și excepțiile revizuite ale snapshot-ului `actual-6a7eac47d66d6701`, release fingerprint `6a7eac47d66d6701a7466ecaa216bd67178a1f78ec57d305f9ec3aa3c6808f09`, publicat prin contractul `actual-public-entity-v2`.

Aceste cazuri nu sunt erori ascunse și nu autorizează inferențe sau corecții geometrice noi. Orice schimbare ulterioară trebuie să intre prin candidate lifecycle și gate-urile ACTUAL.

## Brețcu–Ojdula — excepție geometrică revizuită

Brețcu (SIRUTA `64096`) este singurul fallback UAT ANCPI/RELUAT activ. Ojdula (SIRUTA `64602`, OSM relation `14735731`) folosește partiția hibridă revizuită:

- exteriorul rămâne shell-ul OSM revizuit;
- granița comună păstrează traseul ANCPI, cu adaptările terminale documentate și fail-closed;
- terminalul estic include în mod explicit închiderea non-ANCPI de aproximativ 82,596 m necesară pentru a ajunge la shell-ul OSM;
- geometriile rezultate nu se suprapun;
- identitatea legală rămâne SIRUTA, iar proveniența geometrică este declarată separat;
- nu se afirmă echivalență juridică/cadastrală a geometriei.

Contractele și evidence-urile sunt legate criptografic în settlement policy, source bundle și release gate.

## Malcoci — derivare revizuită din rețeaua OSM curentă

OSM relation `18968071` este reprezentată prin derivarea `reviewed_current_osm_boundary_network` deoarece relația OSM curentă nu formează singură un inel valid. Derivarea folosește exact:

- 498 segmente live ale relației;
- 2 segmente ale way-ului OSM curent `123810097`;
- 500 segmente publicate, cu `missing=0` și `extra=0`;
- toate cele 98/98 segmente live care lipseau din vechiul fallback istoric.

Nu sunt permise editări de coordonate, modificări ale membership-ului relației sursă, snapping, clipping, simplificare sau fallback geometric istoric.

## Identitate MD nerezolvată

OSM relation `12104636` rămâne singura identitate nerezolvată acceptată în ACTUAL v1.1.

- relația nu are dovezi pozitive suficiente de identitate;
- părintele verificat este Hrușova, CUATM `3136`;
- geometria și părintele nu sunt considerate dovadă pozitivă de identitate;
- nu se atribuie CUATM, nume sau clasă juridică prin inferență;
- `md-release-gate` permite exact acest caz și eșuează la apariția unei identități nerezolvate noi.

Chițcani, OSM relation `6879649`, nu face parte din această limitare: identitatea este legată pozitiv de CUATM `7612`, iar geometria OSM rămâne explicit o reprezentare administrativă de-facto, fără afirmație de echivalență cu o geometrie juridică/cadastrală.

## Observații topologice MD

`data/current/actual-topology-audit.json` este `PASS`, cu 0 probleme blocante și 14 observații `child_bbox_exceeds_parent_bbox`. Cazul `osm-r1748490` (Chișinău) nu mai este în această listă: părintele canonic este `osm-r1691801`, fără modificarea geometriei.

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

Aceste observații indică doar că bounding box-ul copilului nu este complet inclus în bounding box-ul părintelui. Nu implică automat o geometrie incorectă și nu autorizează mutarea coordonatelor. Validarea structurală separată confirmă geometrii poligonale valide, coordonate EPSG:4326 valide și absența geometriilor master lipsă sau duplicate.

## Coverage pentru localități

Coverage-ul de poligoane pentru localități/component localities este explicit non-exhaustiv. Auditul structural eșuează la încălcarea policy-ului pentru o reprezentare inclusă, nu la absența unui poligon pentru fiecare identitate oficială. În snapshot-ul curent acest contract este `PASS`, fără policy violations.

## Regula de interpretare v1.1

ACTUAL v1.1 publică aceste limitări și excepții ca stare revizuită a release-ului. Nu se ghicește identitatea lui `12104636`, nu se modifică geometria pentru a elimina artificial cele 14 observații și nu se înlocuiesc excepțiile Brețcu–Ojdula sau Malcoci fără dovezi noi și un nou candidate/release ACTUAL.
