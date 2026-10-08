# Convenție permanentă pentru numele entităților — Atlas RO+MD

## Domeniu și contract

Toate denumirile teritoriale afișate în Atlas folosesc `formatEntityName` din `atlas-name-format.mjs`: arbore ierarhic și controale ARIA, breadcrumb, căutare (rezultate, contextul părinților și textul selectat), tooltip-uri Leaflet, titlul detaliilor, „Denumire oficială”, „Părinte legal” și „Părinte statistic”.

- Primul cuvânt și cuvintele semnificative ale numelui propriu încep cu majusculă; celelalte litere sunt minuscule.
- Particulele intermediare precum `de`, `din`, `la`, `lui`, `cel`, `și` sunt minuscule. Cratimele, diacriticele și punctuația se păstrează.
- Cuvintele cu majuscule/minuscule amestecate deja deliberat rămân neschimbate.
- Codurile/identificatorii, acronimele protejate (`UAT`, `UTA`, `OSM`, `NUTS`, `SIRUTA`, `CUATM`, `BNS`) și numeralele romane nu sunt transformate.
- Regula este idempotentă și exclusiv de prezentare; nu rescrie `display_name`, `official_name`, `legal.name`, `searchable_names`, arborele public ori conținutul din `data/` și `public/`. Nu modifică identități, clasificări, coduri, relații părinte, geometrii, manifesturi/fingerprint ACTUAL sau publicarea existentă.

Exemple: `JUDEȚUL VRANCEA → Județul Vrancea`, `ALBEȘTI → Albești`, `ORAȘUL TÂRGU NEAMȚ → Orașul Târgu Neamț`, `REPUBLICA MOLDOVA → Republica Moldova`, `ȘTEFAN CEL MARE → Ștefan cel Mare`.

## Căutare și fidelitate

Matching-ul rămâne tolerant la majuscule, minuscule și diacritice pe sursele autentice, aliasuri și identificatori, folosind `normalizeSearch`. Transformarea unui nume nu este un nou ID și nu alterează ranking-ul, filtrarea, navigația ori conectarea hărții la entitate. Codurile NUTS/CUATM/SIRUTA rămân exact în forma originală în fișa de detalii.

## Regresii obligatorii

`scripts/test/frontend-atlas-name-format.test.mjs` verifică denumiri RO+MD, denumiri compuse, particule, cratime, coduri/acronime, idempotenta tuturor celor 5.848 de entități și a celor 5.848 de noduri, căutarea și proveniența fără mutarea datelor. Suitele existente de browser, accesibilitate, arbore, search, filtre, mobile și URL verifică afișarea prin `formatEntityName`. Workflow-ul `Frontend geometry taxonomy` rulează automat toate aceste teste și verifică lipsa modificărilor tracked.
