# ACTUAL v1.1 — limitări revizuite și acceptate

Acest document îngheață limitările și excepțiile revizuite ale snapshot-ului `actual-6a7eac47d66d6701`, release fingerprint `6a7eac47d66d6701a7466ecaa216bd67178a1f78ec57d305f9ec3aa3c6808f09`, contract public `actual-public-entity-v2`.

Aceste cazuri nu sunt erori ascunse și nu autorizează inferențe sau corecții geometrice automate. Orice schimbare viitoare trebuie să intre prin candidate lifecycle și gate-urile ACTUAL.

## Identitate MD nerezolvată

OSM relation `12104636` rămâne singura identitate nerezolvată acceptată.

- relația nu are dovadă pozitivă suficientă pentru o identitate CUATM;
- părintele verificat este Hrușova, CUATM `3136`;
- geometria și parentajul nu sunt considerate dovadă pozitivă de identitate;
- nu se atribuie CUATM, nume sau clasă juridică prin inferență;
- `md-release-gate` permite exact acest caz și eșuează la apariția unei identități nerezolvate noi.

Chițcani, OSM relation `6879649`, nu face parte din această limitare: identitatea este legată pozitiv de CUATM `7612`, iar geometria OSM rămâne explicit o reprezentare administrativă de-facto, fără afirmație de echivalență cu o geometrie juridică/cadastrală.

## Excepția geometrică revizuită Brețcu–Ojdula

Brețcu și Ojdula constituie excepția RO explicită față de regula pure-OSM:

- Brețcu, SIRUTA `64096`, este reprezentat prin fallback ANCPI/RELUAT `siruta-u64096`;
- Ojdula, SIRUTA `64602` / OSM relation `14735731`, păstrează exteriorul OSM revizuit;
- limita comună folosește traseul ANCPI revizuit;
- capătul incompatibil cu shell-ul OSM este închis prin adaptarea terminală aprobată și fail-closed;
- adaptarea estică revizuită are `82.59576607343764 m`;
- overlap-ul final Brețcu–Ojdula este 0;
- policy-ul nu afirmă echivalență juridică între geometria ANCPI și identitatea SIRUTA.

Această partiție este protejată de contracte și regresii specifice; nu autorizează snapping, clipping sau normalizare pentru alte geometrii ACTUAL.

## Derivarea OSM curentă Malcoci

OSM relation `18968071` nu formează singură un inel administrativ închis în snapshot-ul curent. Geometria ACTUAL Malcoci este derivată explicit din rețeaua de limite OSM curentă revizuită:

- 498 segmente live ale relației;
- 2 segmente ale connector way `123810097`;
- 500 segmente în geometria derivată;
- `missing=0`, `extra=0`;
- toate cele 98/98 segmente live care lipseau din fallback-ul istoric sunt păstrate;
- `coordinate_edit=false`;
- `source_relation_membership_edit=false`;
- `historical_geometry_fallback=false`;
- fără snapping, clipping sau simplificare.

Contractul este legat de versiunile/hash-urile relației, connectorului și relațiilor de evidență; orice drift neacceptat eșuează fail-closed.

## Observații topologice MD

`data/current/actual-topology-audit.json` este `PASS`, cu 0 probleme blocante și 14 observații `child_bbox_exceeds_parent_bbox`. Aceste observații nu mută și nu repară coordonate.

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

Acest tip de observație indică doar că bounding box-ul copilului nu este complet inclus în bounding box-ul părintelui. Nu implică automat o geometrie invalidă. Validarea structurală separată confirmă geometrii poligonale, coordonate EPSG:4326 valide, topologie validă și absența geometriei master lipsă/duplicate.

## Coverage pentru localități

Coverage-ul poligonal al localităților componente nu este exhaustiv prin contract:

- RO are inventar oficial SIRUTA exhaustiv pentru identitate, dar poligoanele de `component_locality` sunt policy-conformance, nu coverage exhaustiv;
- MD are 705 localități oficiale în inventar, dintre care 603 au identitate acoperită în reprezentările incluse și 102 nu au poligon inclus; această absență este explicit nonblocking prin settlement policy;
- apariția unei reprezentări incluse care încalcă policy-ul rămâne blocking.

## Regula de interpretare v1.1

ACTUAL v1.1 publică aceste limitări și excepții ca stare cunoscută a release-ului. Nu se ghicește identitatea lui `12104636`, nu se modifică geometria pentru a elimina artificial cele 14 observații MD și nu se generalizează excepțiile Brețcu–Ojdula sau Malcoci la alte entități. O corecție ulterioară necesită dovezi noi și un nou candidate/release ACTUAL.
