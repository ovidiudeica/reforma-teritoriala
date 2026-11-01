# WEB-CARD.1 — carduri extinse, fără promovare ACTUAL

Cardul păstrează secțiunile existente de identitate oficială, rol statistic și reprezentare cartografică și adaugă o secțiune compactă „Geometrie, OSMB și audit”. Aceasta încarcă datele numai la deschidere. Cele 5.848 de înregistrări sunt distribuite în 64 de fișiere; selecția, URL-ul, filtrele, resetările și Undo nu sunt modificate.

Datele descriptive sunt separate în `assets/web-card-audit/`, fără schimbarea contractului ACTUAL v3 sau a componentelor canonice. Loaderul refuză un snapshot/fingerprint sau un binding oficial incompatibil. Câmpurile juridice sunt citite din contractul existent. Părintele geometric este etichetat separat și nu îl înlocuiește pe cel juridic.

Intrarea este `web-card-data.jsonl` din pachetul RT-CANON verificat, SHA-256 al arhivei `eb260a9b4b15847d4a3335e6449827ca6a068d76dfe44d47138f18b82c6cd33c`. Generator: `node scripts/process/build-web-card-audit.mjs /cale/web-card-data.jsonl`. Manifestul extensiei păstrează hashul intrării și fiecare fișier generat. Geometriile nu sunt copiate în extensie.

Suprafețele sunt din proiecția egal-area EPSG:6933; perimetrele sunt geodezice WGS84. Precizia afișării nu modifică valorile sursă. Golurile și componentele geometrice nu sunt declarate enclave sau exclave juridice. Validitatea matematică și lipsa unui conflict detectat nu certifică hotarul.

Tagurile OSMB sunt prezentate ca metadate cartografice. Se publică numai o listă explicită de chei: denumiri, rol cartografic, referințe teritoriale și identificatori Wikidata/Wikipedia. Sunt excluse user/uid, contact, telefon, email, adrese, operator/proprietar, IDNO și câmpuri arbitrare. Valorile sunt randate prin `textContent`; linkul OSM este construit numai dintr-un ID numeric pozitiv. Atribuire: © OpenStreetMap contributors, ODbL.

Teste: `node --test scripts/test/web-card-audit.test.mjs scripts/test/web-card-audit-browser.test.mjs`. Chromium verifică desktop/mobil, selecție, URL și Back/Forward, accesibilitate, overflow, XSS și omiterea datelor personale. Regresiile existente acoperă filtre, resetări, Undo și arbore. Așteptările existente pentru lista secțiunilor cardului și numărul de acordeoane WEB-R1b includ acum exact secțiunea nouă; celelalte aserțiuni se păstrează.

Workflow separat: `.github/workflows/web-card-audit.yml`, permisiuni numai de citire și artefacte pentru capturi. PR-ul UI nu autorizează modificări ACTUAL, NI-TREE.2 sau politica P9.1. Integrarea necesită aprobare separată și verificări terminale pe SHA-ul exact.
