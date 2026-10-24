# NI-TAGS.0 — audit al tuturor tagurilor OSM, Moldova și Nistrenia

**Referință:** 2026-10-24 · **Mod:** READ_ONLY / EVIDENCE_ONLY · **Fără modificări** ACTUAL, CUATM, OSM, geometrii, web sau arbore.

## Domeniu și metoda exactă

1. Inventarul MD pleacă din `data/sources/osm-current.json`, snapshotul oficial OSM/Overpass conservat la **2026-10-05T23:50:05Z**, cu **2.596 relații OSM** selectate pentru Republica Moldova. Cele 6 entități statistice ACTUAL MD cu `admin_level=null` nu sunt relații OSM noi, deci nu trebuie incluse în inventarul tagurilor OSM. Distribuția existentă pentru ACTUAL MD: nivel 2=1, 4=37, 7=5, 8=982, 9=1571; null=6. Sursă: `docs/evidence/web-r2a1/distributions.json`.
2. Scriptul `scripts/audit/md-ni-osm-tags-20261024.mjs` verifică SHA-256 comprimat, citește snapshotul fără rețea, verifică exact setul de 2596 ID-uri OSM și păstrează toate perechile `key=value` în registru JSONL. Calculează distribuția fiecărei chei, valori caracteristice, hashurile și diferențele față de recensământul celor 85.
3. **85 de relații NI reutilizate** sunt inventariate integral din `docs/p9.0.7.2.15-osm-tag-census.json`, sursă OSM pin-uită la 16 octombrie; ele **nu adaugă 85 de geometrii noi** în ACTUAL. Eșantionul este complet pe exact acest set, nu pe toate granițele de facto existente în OSM. Valorile OSM sunt datate și pot suferi modificări.
4. Fișierul `docs/evidence/ni-md-tags-20261024/ten-osm-root-and-subdivision-tags.json` conține toate tagurile observate live ale celor 10 relații-cheie: MD 58974, NI 65335, cinci raioane NI nivel5, Tiraspol 1702219, Bender de facto 944727 și municipiul Bender MD 9581354. Sunt înregistrate **versiunile OSM individuale**; observația nu este un snapshot atomic.

## Constatare certă: două scheme de organizare coexistă în OSM

- MD `relation/58974`: `admin_level=2`, `ISO3166-1=MD`, `boundary=administrative`.
- NI `relation/65335`: `admin_level=3`, `boundary=administrative`, `name:ro=Nistrenia`; `note` avertizează să **NU** fie confundată cu MD `relation/2607033` (unitățile de pe malul stâng al Nistrului).
- Cele șapte subzone NI sunt `admin_level=5`: Camenca 1702216, Rîbnița 1702217, Dubăsari 1702215, Grigoriopol 1702214, Slobozia 1702218, consiliul orașului Tiraspol 1702219, consiliul orașului Bender 944727. Au `type=boundary` / `boundary=administrative`, titluri diferite de MD și rol `subarea` în rădăcina NI.
- **Conflict documentat, nu eroare de deduplicare:** `relation/9581354` este `admin_level=4`, `ISO3166-2=MD-BD`, municipiul Bender după sistemul MD. `relation/944727` este `admin_level=5`, `name:ro=Sovetul orășenesc Bender`, limita de facto. Tagurile `note` explică explicit această diferență. Limitele nu trebuie suprascrise.
- Propria documentație a **OSM-Boundaries** (<https://osm-boundaries.com/about/documentation>) confirmă că datele OSM sunt copiate `as-is`, fără corectări și că ierarhia din interfață este determinată geometric prin **containment** și `admin_level` crescător. Aceasta nu certifică nicio apartenență juridică. Descărcarea **tuturor** tagurilor de la OSM-Boundaries presupune plan tarifar, astfel că acest audit folosește sursele originale OSM și snapshotul intern, nu o pretinsă extracție API neautorizată.

## Cele 85 de roluri reutilizate — interpretare corectă

Din registrul OSM pin-uit se confirmă: `type=boundary` 85/85, `boundary=administrative` 85/85, `name:ro` 85/85, `wikidata` 85/85, `wikipedia` 85/85, `admin_level=8` 84/85 și `admin_level=4` 1/85.

- **82/85** au `ref:cuatm:codunic` și `ref:cuatm:statut`, valori specifice sistemului de evidență MD; `ref:cuatm:2:codunic` în 81/85 este în principal `9800` (79) sau `0500` (2). Acestea NU atestă subdiviziunile legale ale Tiraspolului.
- `place=municipality` 72, `place=town` 7, `place=city` 4, `place=village` 1; o relație fără `place`. Nu traduceți `place=municipality` în **72 de municipii** de jure sau de facto; sunt valori descriptive OSM.
- `name:ro` 85; `name:ru` 82; `name:uk` 79; `name:md` 55; `official_name` 82; `name:prefix` 82. Limbile, prefixele, denumirile și identificatorii au proveniență și interpretare diferite.

## Recomandarea arhitecturală

Menținem **două modele de apartenență** și **o singură identitate geometrico-OSM pentru fiecare poligon reutilizat**. Câmpurile administrative trebuie stratificate după autoritate și timp:

`(geometry_id, osm_relation_id, jurisdiction_view, authority, asserted_parent_id, valid_from, valid_to, evidence_id, proof_status)`.

Arborele Republicii Moldova păstrează părinții de jure CUATM. Arborele de facto NI începe cu cele 7 zone de nivel5 din OSM, dar includerea juridică definitivă a tuturor unităților nivel8, a consiliilor și a localităților rămâne condiționată de actele NI-ADM; nicio relație `admin_level` sau `name:prefix` singură nu este probă juridică. În special nu se importă 85 de poligoane duplicate în ACTUAL.

**GATE:** P9.1 BLOCKED; nu se modifică ACTUAL, CUATM, public OSM, artefacte web ori contururi. Scriptul produce numai un artifact local în runner și jurnal CI; PR Draft, fără merge automat.

## Limite deschise

- Snapshotul integral MD este 5 octombrie, nu starea live atomică de azi; cele 10 relații live sunt verificate separat. O eventuală schimbare din 5–24 octombrie necesită refresh cu porți de reproductibilitate, nu înlocuirea tacită a sursei validate.
- Datele de facto nu pot fi certificate legal doar din taguri; NI-ADM.1.3.x încă are excepții.
- Inventarul exhaustiv al cheilor/valorilor pentru cele 2.596 relații MD se stabilește prin *execuția workflow-ului audit* și verificarea artefactelor la SHA-ul PR-ului, nu prin estimare.
