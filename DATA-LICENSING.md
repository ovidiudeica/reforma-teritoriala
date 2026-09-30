# Licențiere și atribuire date

Licența MIT din `LICENSE` se aplică codului și documentației originale ale repository-ului. Ea nu relicențiază automat datele provenite din surse externe.

## OpenStreetMap

Geometriile ACTUAL sunt derivate din OpenStreetMap și sunt publicate cu atribuirea `© OpenStreetMap contributors`. OpenStreetMap este disponibil sub Open Database License (ODbL) 1.0. Reutilizatorii trebuie să respecte obligațiile ODbL aplicabile bazei de date și derivatelor acesteia.

Sursele OSM exacte folosite de release sunt fixate criptografic în `data/current/actual-source-bundle-manifest.json`; catalogul release-ului declară `OpenStreetMap via Overpass API` și licența `ODbL`.

## INS SIRUTA și BNS CUATM

Snapshot-urile oficiale SIRUTA (România) și CUATM (Republica Moldova) sunt păstrate pentru identitate legală/oficială, reconciliere și reproductibilitate. Repository-ul nu afirmă că aceste date sunt relicențiate sub MIT și nu extinde asupra lor drepturi care nu provin din sursa oficială.

Orice reutilizare separată a snapshot-urilor SIRUTA/CUATM trebuie făcută în conformitate cu termenii furnizorului oficial și cu legislația aplicabilă. Proveniența exactă și hash-urile snapshot-urilor folosite de ACTUAL v1 sunt în manifestul de source bundle și în manifestul release-ului.

## Date compozite ACTUAL

Fișierele generate care combină geometrie OSM cu identificatori sau metadate oficiale pot incorpora drepturi și obligații provenite din mai multe surse. Licența MIT a codului nu trebuie interpretată ca o licență unică pentru întregul conținut al acestor fișiere.

Pentru atribuirea publică, interfața păstrează explicit `© OpenStreetMap contributors · identitate oficială: INS SIRUTA / BNS CUATM`.
