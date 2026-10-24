# NI-ADM.1.2 — actele administrației locale și excepțiile juridice

**Cutoff:** 24.10.2026. **Domeniu:** audit probatoriu, fără modificarea arborelui Nistreniei, ACTUAL, CUATM sau OSM. Branch stacked peste PR #432 → #430 → #428.

## Lotul de 20 de publicații

Fișierul [law-effects-20.json](law-effects-20.json) clasifică exhaustiv *titlurile* celor 20 de publicații selectate în NI-ADM.1.1. Rezultatul este **18 legi care modifică Legea de facto din 05.11.1994 privind autoritățile locale și 2 acte pregătitoare privind proiecte legislative** (ID 2024001732 și 2025001798). Numerele sunt numere de publicație distincte de numerele legilor.

Faptul că un titlu este o lege promulgată nu certifică *articolele efectiv modificate*, data intrării în vigoare sau efectul asupra listei de unități administrative. Nu am verificat complet toate cele 18 originale semnate. S-au identificat doar fragmente operative în catalogul secundar pentru:
- publicația **2026000086** (nr. 1-ЗИ-VIII/29.01.2026), cu privire la alegerea conducerii consiliului raional, art. 23;
- publicația **2026000438** (nr. 53-ЗИД-VIII/25.03.2026), referitoare la atribuții privind aprobarea anumitor împrumuturi ale instituțiilor și întreprinderilor municipale, art. 19;
- pentru **2026000091** și **2026000691**, fragmentele accesibile sunt introductive și nu certifică articolele operative.

**Nicio schimbare a unităților, subordonării, CUATM sau granițelor OSM nu se deduce din aceste fragmente.** Candidatul adiacent 2024001548 afectează un alt act, referitor la organele reprezentative și autoadministrarea locală; este păstrat separat.

## Actele locale și dovada primară selectivă

[local-source-gaps.json](local-source-gaps.json) enumeră șapte portaluri de consilii teritoriale investigate. Au fost lizibile pagini oficiale din **Grigoriopol, Rîbnița și Bender**; celelalte patru au avut time-out ori erori de acces. Grigoriopol listează 13 consilii sătești și, distinct, Maiac. Rîbnița publică inclusiv anunțuri/hotărâri ale consiliilor rurale, ceea ce demonstrează că documentația locală nu se reduce la publicațiile centrale.

**Exemplu primar inspectat:** [Regulamentul Consiliului raionului și orașului Rîbnița, hotărârea nr. 3/1 din 13 februarie 2026](https://rybnsovet.idknet.com/reglament-rybnickogo-gorodskogo-i-rajonnogo-soveta-narodnyx-deputatov).
- Art. 74.3–74.4: protocoale și originalele hotărârilor sunt păstrate printr-un circuit arhivistic.
- Art. 75.1–75.2: deciziile normative se publică în ziarul *Новости* și pe website-ul consiliului; intrarea în vigoare este de regulă după 7 zile, dacă nu este prevăzut alt termen.
- Art. 75.3: deciziile nenormative au alt regim de informare și efect.
- Art. 76.1: deciziile consiliului sunt obligatorii numai în sfera competențelor prevăzute de legislația aplicabilă.

Această normă locală **nu se generalizează** automat la toate cele șapte consilii de nivel superior și cele 74 de consilii sătești. Textul online accesibil nu înlocuiește verificarea originalului semnat, a edițiilor ziarului, a arhivei și a tuturor abrogărilor/amendamentelor aplicabile.

## Excepții

[exceptions.json](exceptions.json) păstrează **9 excepții** cu status individual: **1 închisă exclusiv ca problemă de clasificare** (cele două documente de proiect nu sunt legi adoptate) și **8 încă deschise / reportate**: cele 18 texte primare, candidatul legislației reprezentative, arhivele locale, publicarea actelor, competența de schimbare a teritoriului, versiunea consolidată, cele 19 publicații târzii și statutul geometric/control. Nu se marchează artificial închise.

## Reproductibilitate și restricții

Rulați `node docs/evidence/ni-adm12-20261024/validate.mjs` pentru verificarea structurii documentare. Validările auxiliare interne la întocmirea artefactelor au comparat cele 20 de ID-uri cu matricea #432 și distribuția 18/2; testul Node din PR nu este declarat trecut fără execuție/CI.

**Gate:** `NI-ADM.1.2=BLOCKED_INCOMPLETE` pentru certificarea normativă globală; `P9.1=BLOCKED`; fără editări `public/data`, ACTUAL, CUATM sau OSM.

Surse externe:
- [Legislația locală de facto, redacția indexată 07.05.2026](https://vspmr.org/legislation/laws/zakonodateljnie-akti-pridnestrovskoy-moldavskoy-respubliki-v-sfere-konstitutsionnogo-stroya-osnov-pravoporyadka-a-takje-deyateljnosti-organov-gosudarstvennoy-vlasti-i-upravleniya/zakon-pridnestrovskoy-moldavskoy-respubliki-ob-organah-mestnoy-vlasti-mestnogo-samoupravleniya-i-gosudarstvennoy-administratsii-v-pridnestrovskoy-moldavskoy-respublike.html)
- [Consiliile locale Grigoriopol](https://grig-rsnd.idknet.com/home/sel-sovet)
- [Consiliul raionului și orașului Rîbnița](https://rybnsovet.idknet.com/)
- [Consiliul Bender](https://benderygs.gospmr.org/?cat=4)
- [Actul nr. 1-ЗИ-VIII/2026, fragment disponibil](https://pravopmr.ru/views.aspx?id=T7OZwTVVuKp4GN4sG8ot2w%3D%3D)
- [Actul nr. 53-ЗИД-VIII/2026, fragment disponibil](https://pravopmr.ru/views.aspx?id=dtc3PJofhZTrQKre62oOJQ%3D%3D)
