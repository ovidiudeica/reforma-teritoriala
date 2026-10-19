# WEB-R2a.3 — contract semantic pentru nivelurile administrative OSM

**Stare:** specificație read-only; nu este implementare de interfață și nu autorizează WEB-R2b înainte de gates.

**Bază Git:** `6b6f4fe2c974b72ef6e8a5d81c97dad48a7853ae`. Snapshot ACTUAL `actual-a9e5a4ddcb5277ef`; 5.848 identități, fingerprint `a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446`.

**Contract machine-readable:** `docs/contracts/web-r2a3-osm-admin-level.json`.

## Domeniu și proveniență

Cele patru tipuri de înregistrări rămân distincte: ACTUAL RO (3.246), ACTUAL MD (2.602), NI source-only (8) și roluri OSM reutilizate (85). Ultimele două nu adaugă identități ACTUAL. Pentru ACTUAL se folosește exclusiv `representation.admin_level` verificat; pentru cele opt contururi proprii NI, overlay-ul version-pinned WEB-R2a.2 indică nivelul **3 × 1** și **5 × 7**. Pentru cele 85 de roluri se citește `osm_admin_level` numai în contextul rolului (4 × 1, 8 × 84). Rolul reutilizat nu suprascrie atributul ACTUAL al aceleiași identități.

Ordinea surselor nu este un mecanism de ghicire: nu se deduce nivelul din nume, ierarhie, categorie, NUTS, SIRUTA, CUATM sau nivelul unui părinte. O contradicție se marchează `conflict` și nu se rezolvă automat. Valorile valide, `null` explicite, lipsă, multiple, invalide și conflictuale se păstrează distincte. 18 entități statistice ACTUAL au `null` explicit și nu primesc buline numerice. Datele NI provin din versiuni istorice individuale, nu dintr-un snapshot atomic; statutul juridic nu este certificat.

## Bulină numerică în arbore — WEB-R2b.1

Când nivelul este verificat și unic, se afișează o bulină rotundă cu cifra brută normalizată numeric, **înainte de numele entității**. `aria-label="Nivel administrativ OSM 5"`; forma și numărul sunt suficient de lizibile fără codificare exclusiv cromatică. Nu este buton, nu extinde noduri, nu selectează entități, nu bifează contururi. Pentru `null`, lipsă, invalid sau conflict nu se afișează o cifră presupusă; cardul poate explica proveniența/starea. Nu se amestecă cu nivelurile statistice.

## Filtrul „Nivel administrativ OSM” — WEB-R2b.2

Filtru multi-select, cu valori disponibile din corpusul valid, pe jurisdicție/context și cu numere rezultate din registru. Un set gol de constrângeri înseamnă `toate nivelurile` (implicit); alegerea mai multor niveluri are logică OR. Combinarea cu alte filtre are logică AND între dimensiuni. „Necunoscut” este opțiune distinctă, nu nivel numeric fictiv. Filtrarea restrânge exclusiv rezultatele/arborele sau o mască de vizibilitate explicit cerută; **nu rescrie bifele geometriilor** și nu activează descendenții. Rolurile și geometria ACTUAL identice nu se dublează în rezultate.

## Comenzi explicite — WEB-R2b.3

`Afișează nivelul` și `Ascunde nivelul` sunt acțiuni separate, cu domeniu RO/MD/NI și număr de contururi afectate afișat înainte de confirmarea acțiunii. Numai un gest explicit schimbă bifele eligibile; selecția entității, extinderea ramurii și filtrarea nu schimbă bifele. `Undo` restabilește starea anterioară tranzacției, iar `Reset` reface valorile implicite: doar contururile proprii RO, MD, NI ON, descendenții OFF. Nu inițiază fetch simultan necontrolat pentru toate geometriile. Se conservă regula `administrativeVisible OR statisticalVisible` pe geometria comună și logica separată a entităților statistice.

## URL/history, accesibilitate și acceptare

Orice parametru nou pentru filtru sau comenzi trebuie introdus numai prin extensie versionată și backward-compatible, cu URL canonic și teste Back/Forward; această etapă **nu schimbă schema URL**. Sunt obligatorii testele tastatură, cititoare de ecran, contrast, 200% text, desktop/mobil Chromium și verificarea URL/history înainte de acceptarea WEB-R2b.

Contractul interzice schimbări în `data/`, `public/data/`, geometrii, identități, ierarhii și source bundles. `p91_import_allowed=false`, `semantic_acceptance=BLOCKED_INCOMPLETE`, `actual_mutation_allowed=false`. WEB-R2a.3 nu activează P9.1 și nu constituie recunoaștere juridică a NI.

## Criterii pentru implementarea WEB-R2b

Validator read-only al contractului, CI verde pe SHA-ul PR-ului, diff fără surse mutate, review al regulilor de filtrare și selecție, apoi autorizare separată pentru fiecare subetapă WEB-R2b. Nu se pornește implementarea UI în acest PR.
