# Filtre Atlas — web-v1.2.2

## Modelul comun

`geometry-taxonomy.mjs` este unica sursă de adevăr. Configurația declarativă `geometryFilterTree` produce clasificatorul de clasă, clasificatorul de subtip, etichetele și ordinea UI. `atlas-filters.mjs` construiește numai controalele DOM; `app.js` folosește un singur `geometryVisible()` pentru tiers, chunks, limite statistice, highlight și încărcări întârziate.

Clasa descrie nivelul geometric mare. Subtipul descrie reprezentarea în jurisdicția respectivă. Identitatea juridică și display_type nu clasifică geometria. Rolul statistic este un facet independent care se intersectează cu vizibilitatea geometrică; 45 entități admin/statistical păstrează o singură geometrie și un singur subtip.

Subtipurile provin exclusiv din `representation.inferred_type` și jurisdicție. Categoria statistical desemnează cele 18 limite separate: clasa statistical_only, subtip null exceptat explicit, control prin nivel statistic și toggle separat. Nu se folosește admin_level izolat sau legal.type.

## Auditul populației

| Clasă | RO | MD | Total |
| --- | ---: | ---: | ---: |
| context | 1 | 1 | 2 |
| regional | 42 | 37 | 79 |
| local_uat | 3180 | 982 | 4162 |
| sector | 6 | 5 | 11 |
| component_locality | 5 | 1449 | 1454 |
| auxiliary | 0 | 122 | 122 |
| statistical_only | 12 | 6 | 18 |
| unclassified | 0 | 0 | 0 |
| Total | 3246 | 2602 | 5848 |

Count-uri calculate din public entities, nu din legal/display types. Orientările juridice 102 municipii RO / 216 orașe RO și 5 municipii MD de nivelul II nu sunt count-uri geometrice. Reprezentările actuale dau 100 municipii RO, 217 orașe RO, 2862 comune și o UAT generică; MD regional are 32 raioane, 3 municipii de nivelul II și 2 unități speciale, adică 37. Clasele mari păstrează exact baseline-ul de 79 regional și 4162 local_uat.

Cele 548 level_1_uat MD nu au un subtip urban/rural precizat în reprezentare. Sunt grupate explicit ca „UAT de nivelul I — tip nespecificat”; nu sunt reclasificate artificial prin registrul juridic. municipality_or_city_uat are 14 reprezentări MD, grupate ca „Municipii / UAT urbane”, fără a deduce un nivel juridic.

## Mapping complet și ordine semantică

Zero în tabel înseamnă mapping explicit cunoscut, fără categorie goală în UI. Grupele de jurisdicție și subtipurile afișate au minimum o entitate.

| Jurisdicție | representation.inferred_type | Clasă | Subtip Atlas | Count |
| --- | --- | --- | --- | ---: |
| RO | county | regional | Județe / Municipiul București (`ro.counties`) | 42 |
| MD | district | regional | Raioane (`md.districts`) | 32 |
| MD | level_2_municipality | regional | Municipii de nivelul II (`md.level2_municipalities`) | 3 |
| MD | special_territorial_unit | regional | Unități teritoriale speciale (`md.special_units`) | 2 |
| MD | level_2_or_special_unit | regional | Unități regionale — tip nespecificat (`md.regional_unspecified`) | 0 |
| RO | municipality | local_uat | Municipii (`ro.municipalities`) | 100 |
| RO | town | local_uat | Orașe (`ro.towns`) | 217 |
| RO | commune | local_uat | Comune (`ro.communes`) | 2862 |
| RO | local_uat | local_uat | UAT locale — tip nespecificat (`ro.local_unspecified`) | 1 |
| MD | level_1_municipality | local_uat | Municipii / UAT urbane (`md.municipalities`) | 0 |
| MD | municipality_or_city_uat | local_uat | Municipii / UAT urbane (`md.municipalities`) | 14 |
| MD | municipality | local_uat | Municipii / UAT urbane (`md.municipalities`) | 0 |
| MD | town_uat | local_uat | Orașe (`md.towns`) | 48 |
| MD | town | local_uat | Orașe (`md.towns`) | 0 |
| MD | commune_or_independent_village_uat | local_uat | Comune / sate independente (`md.rural_uat`) | 372 |
| MD | commune | local_uat | Comune / sate independente (`md.rural_uat`) | 0 |
| MD | level_1_uat | local_uat | UAT de nivelul I — tip nespecificat (`md.level1_unspecified`) | 548 |
| MD | local_uat | local_uat | UAT locale — tip nespecificat (`md.local_unspecified`) | 0 |
| RO | sector | sector | Sectoarele Municipiului București (`ro.bucharest_sectors`) | 6 |
| MD | chisinau_sector | sector | Sectoarele Municipiului Chișinău (`md.chisinau_sectors`) | 5 |
| RO | component_locality | component_locality | Localități componente (`ro.component_localities`) | 0 |
| RO | component_village_boundary_representation | component_locality | Sate componente — limite reprezentate (`ro.component_villages`) | 3 |
| RO | municipality_component_locality_boundary_representation | component_locality | Localități componente de municipii (`ro.municipality_components`) | 2 |
| RO | subdivision_or_component_area | component_locality | Subdiviziuni / zone componente (`ro.component_areas`) | 0 |
| MD | component_locality | component_locality | Localități componente (`md.component_localities`) | 1446 |
| MD | subdivision_or_component_area | component_locality | Subdiviziuni / zone componente (`md.component_areas`) | 3 |
| RO | state | context | Stat / context național (`ro.context`) | 1 |
| MD | state | context | Stat / context național (`md.context`) | 1 |
| RO | non_administrative_or_auxiliary_area | auxiliary | Reprezentări auxiliare (`ro.auxiliary`) | 0 |
| MD | non_administrative_or_auxiliary_area | auxiliary | Reprezentări auxiliare (`md.auxiliary`) | 122 |


### Subtipuri afișate

| Jurisdicție | Subtip | Count |
| --- | --- | ---: |
| RO | Județe / Municipiul București (`ro.counties`) | 42 |
| MD | Raioane (`md.districts`) | 32 |
| MD | Municipii de nivelul II (`md.level2_municipalities`) | 3 |
| MD | Unități teritoriale speciale (`md.special_units`) | 2 |
| RO | Municipii (`ro.municipalities`) | 100 |
| RO | Orașe (`ro.towns`) | 217 |
| RO | Comune (`ro.communes`) | 2862 |
| RO | UAT locale — tip nespecificat (`ro.local_unspecified`) | 1 |
| MD | Municipii / UAT urbane (`md.municipalities`) | 14 |
| MD | Orașe (`md.towns`) | 48 |
| MD | Comune / sate independente (`md.rural_uat`) | 372 |
| MD | UAT de nivelul I — tip nespecificat (`md.level1_unspecified`) | 548 |
| RO | Sectoarele Municipiului București (`ro.bucharest_sectors`) | 6 |
| MD | Sectoarele Municipiului Chișinău (`md.chisinau_sectors`) | 5 |
| RO | Sate componente — limite reprezentate (`ro.component_villages`) | 3 |
| RO | Localități componente de municipii (`ro.municipality_components`) | 2 |
| MD | Localități componente (`md.component_localities`) | 1446 |
| MD | Subdiviziuni / zone componente (`md.component_areas`) | 3 |
| RO | Stat / context național (`ro.context`) | 1 |
| MD | Stat / context național (`md.context`) | 1 |
| MD | Reprezentări auxiliare (`md.auxiliary`) | 122 |


## State și interacțiuni

`activeGeometryClasses` este același Set ca aliasul compatibil `activeFilterGroups`, nu o copie. `activeGeometrySubtypes` păstrează subtipurile active. geometryVisible intersectează class gate, subtype gate, nivelul statistic și toggle-ul limitelor separate. Jurisdicțiile sunt controlate separat prin layer groups; off/on nu modifică niciun Set de subtipuri. API-ul vechi fără geometrySubtypes rămâne compatibil.

Părinte checked = toate subtipurile active; unchecked = niciunul; indeterminate = subset activ. Click pe checked dezactivează clasa și toate subtipurile; click pe unchecked/mixed activează toate. Un copil activează class gate; dezactivarea ultimului copil dezactivează class gate. Sincronizarea actualizează proprietățile input-urilor, fără reconstruirea DOM-ului sau pierderea expansion state. Checkbox-ul părinte este în afara conținutului ascuns de details; summary controlează separat disclosure-ul.

Toate/Niciuna operează numai pe secțiunea proprie. Tipurile administrative și alte reprezentări nu schimbă nivelurile/toggle-ul statistic. Nivelurile statistice nu schimbă clasele/subtipurile administrative. Count-urile și membership sets sunt calculate o singură dată la încărcarea indexului; fiecare click sincronizează numai lista mică de controale și rerandează colecțiile geometrice deja în cache. Nu reconstruiește arborele și nu refetch-uiește date pentru filtre.

Selecția și navigarea web-v1.2.1 sunt păstrate. Un subtip off ascunde geometria selectată și păstrează ID-ul, detaliile, breadcrumb-ul, nodul și ramurile deschise. Re-enable restaurează highlight-ul prin același render-time predicate. Un chunk/tier primit după modificarea filtrelor folosește state-ul curent, nu state-ul request-ului.

## Fallback și validare

Un inferred_type necunoscut produce class unclassified și subtype `unclassified:<jurisdiction>:<type>`. Un tip cunoscut fără mapping de jurisdicție produce un subtype explicit unclassified, fără grupare arbitrară. UI afișează categoria neclasificată cu count; valorile tehnice rămân în debug/test. Contractul actual are zero class/subtype unclassified. level_2_or_special_unit are mapping explicit md.regional_unspecified, count 0 în baseline, deci nu apare inutil în UI.

Suite: frontend-smoke, actual-statistical-public, frontend-geometry-taxonomy, frontend-atlas-tree și frontend-atlas-filters; același workflow frontend le execută și verifică git diff --exit-code. Noua suită acoperă clasificarea tuturor entităților, mapping adversarial legal/display/admin_level, count-uri, checkbox nativ mixed, state/expansion persistence, încărcare lazy și fluxul real selectare ↔ filtre ↔ arbore/detalii.

ACTUAL/P2, geometriile, registrele, sursele, public entities, hierarchy JSON, snapshot/fingerprint și release/tag actual-v1.2.0 rămân neschimbate. Browser/visual QA complet rămâne pentru web-v1.2.7; nu sunt introduse dependențe noi sau pașii web-v1.2.3–web-v1.2.7.
