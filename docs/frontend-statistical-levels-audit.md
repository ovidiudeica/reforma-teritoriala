# Audit — secțiunea Niveluri statistice

## Verdict

Datele ACTUAL/P2 sunt complete pentru rolurile statistice: 63 de entități au rol statistic, dintre care 45 reutilizează geometria administrativă existentă și 18 au limite statistice separate. Problema observată în Atlas era de semantica filtrului, nu de lipsa entităților din contract.

Distribuția oficială rămâne:

- nivel 1: 5 entități = 1 geometrie reutilizată + 4 limite separate;
- nivel 2: 10 entități = 0 reutilizate + 10 limite separate;
- nivel 3: 48 entități = 44 reutilizate + 4 limite separate;
- total: 63 = 45 reutilizate + 18 separate.

## Cauza

După PR #249, checkbox-urile din „Niveluri statistice” controlau numai cele 18 entități `statistical_only`. Cele 45 de entități coalesced — de exemplu județele/NUTS 3 din România, Moldova/MD1, Găgăuzia/MD114 și Chișinău/MD115 — erau guvernate exclusiv de filtrele administrative.

Consecința era că o vedere „numai statistică” nu putea afișa complet un nivel: dacă tipurile administrative erau dezactivate, geometriile coalesced dispăreau chiar dacă nivelul statistic corespunzător era activ.

## Contract corectat

`geometryVisible()` tratează acum rolurile administrative și statistice ca două căi independente de activare pentru aceeași geometrie:

- entitate coalesced: `administrativeVisible OR statisticalVisible`;
- entitate `statistical_only`: `statisticalLevelActive AND separateStatisticalGeometry`.

Nu se clonează GeoJSON și nu se creează o a doua geometrie pentru cele 45 de entități coalesced. Același poligon este randat o singură dată din tier-ul administrativ.

Prin urmare:

- „Niciuna” la tipuri administrative + nivel statistic activ => entitățile coalesced ale acelui nivel rămân vizibile;
- nivel statistic OFF + tip administrativ activ => geometria coalesced rămâne vizibilă prin rolul administrativ;
- ambele OFF => geometria coalesced este ascunsă;
- „Afișează limite statistice separate” afectează numai cele 18 limite separate și nu dezactivează controalele de nivel.

## Integritatea geometriei

Regresia de taxonomie verifică explicit că fiecare dintre cele 63 de entități statistice are o reprezentare publică:

- fiecare dintre cele 45 coalesced apare exact o dată în tier-urile geometrice administrative;
- fiecare dintre cele 18 `statistical_only` apare în fișierele de geometrie statistică;
- entitățile `statistical_only` nu sunt duplicate în tier-urile administrative.

Snapshot-ul ACTUAL, fingerprint-ul, entitățile, ierarhia, registrele și geometriile master nu sunt modificate de acest patch.

## URL și UI

Schema URL rămâne `v=1`.

- `s=` reprezintă nivelurile statistice active pentru toate entitățile cu rol statistic;
- `b=0` ascunde numai limitele statistice separate;
- filtrele administrative și nivelurile statistice rămân state independente;
- pentru entitățile coalesced, vizibilitatea finală este reuniunea celor două roluri.

Count-urile UI arată pentru fiecare nivel totalul de entități, geometriile reutilizate și limitele separate, inclusiv breakdown RO/MD.


## Z-order cartografic

Auditul post-PR #251 a identificat un al doilea defect, strict de prezentare: cele 18 limite statistice separate erau încărcate corect, dar foloseau pane-ul Leaflet implicit. Deoarece tier-urile administrative sunt materializate ulterior, liniile statistice puteau fi acoperite vizual de poligoanele administrative, deși existau deja în DOM și treceau testele de cardinalitate.

Corecția folosește pane-ul dedicat `statistical-boundaries` cu z-index 450, deasupra `overlayPane` administrativ implicit. Numai geometriile `statistical_only` folosesc acest pane; cele 45 entități coalesced continuă să reutilizeze exact aceeași geometrie administrativă și nu sunt duplicate.

Regresia verifică atât binding-ul pane-ului în testele Node, cât și în Chrome real că o limită statistică separată selectată este efectiv desenată în pane-ul statistic deasupra overlay-ului administrativ.
