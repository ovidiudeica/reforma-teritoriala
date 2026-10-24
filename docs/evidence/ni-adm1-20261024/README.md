# NI-ADM.1 — verificarea amendamentelor, cutoff 24.10.2026

**Verdict: PARTIAL_PASS (source-scoped); definitiv contemporan: BLOCKED_EVIDENCE.** Audit separat read-only, stacked peste [NI-ADM.0 #428](https://github.com/ovidiudeica/reforma-teritoriala/pull/428). Nu se modifică ACTUAL, CUATM, OSM public, website-ul sau P9.1.

## Rezultate probate
- Anexa nr.1 reformulată prin legea de facto 48-ЗИ-VII din 24.03.2023, în vigoare din 25.03.2023, se păstrează ca bază documentară: 5 raioane, 4 orașe independente, 74 consilii sătești, 162 mențiuni de localități.
- Indexul tematic derivat din arhiva istorică de **9.254** publicații (2023–15.10.2026) are **9 rezultate**, dintre care două sunt direct modificatoare ale legii 155-З-III: 48/2023 și 114/2026. Pentru 2024–2025 nu apare nicio modificare directă a legii în această selecție; nu reprezintă certificare exhaustivă a tuturor textelor.
- Registrul central lunar observat la 21.10.2026 avea **9.275** publicații pe 46 pagini, cu serii numerice observate complete: 2023=2390, 2024=2659, 2025=2479, 2026=1747. Nu s-au citit independent integral toate textele sau registrele locale.
- Legea de facto 114-ЗИД-VIII, publicată 29.05.2026, are **intrare în vigoare amânată șase luni** (art.3, original de patru pagini examinat vizual). **Nu era aplicabilă la 24.10.2026**, iar efectele sale după intrarea în vigoare necesită verificare separată.
- La 24.10.2026 pagina publică a registrului central arăta identificatorul 2026001766, publicat 23.10.2026. Cele **19 înregistrări noi** peste captura din 21 octombrie nu au fost toate conservate și revizuite individual prin NI-ADM.1.

## Artefacte
- `amendments.json`: cronologie, efectele datate, clasificarea celor 9 titluri, limite și condiții de acceptare.
- `contemporary-register-candidate.json`: cele 9 unități superioare, 74 consilii și 162 mențiuni nominale din 2023, precum și cele 85 relații OSM, cu stare provizorie individuală. Orașele numite ca unități superioare apar și în cele 162 mențiuni: nu le dublați.
- `validate.mjs`: validare fail-closed a structurii, plafonării temporale și stărilor blocate.

**Nu se declară un registru definitiv la 24.10.2026.** Este necesară verificarea exhaustivă a tuturor titlurilor și actelor primare aplicabile, a registrelor locale, a traducerilor, a statutelor de control, și a corespondențelor geometrice. Dovezile noi nu autorizează mutații ACTUAL, cu atât mai puțin atribuire de suveranitate.

`NI-ADM.1=BLOCKED_INCOMPLETE`; `P9.1=BLOCKED`; `actual_mutation_allowed=false`; `osm_public_edit_allowed=false`.

Surse: anexa NI-ADM.0 #428, `docs/evidence/ni-jur-independent-20261020/documentary/historical-census-replay.json`, `docs/evidence/ni-jur-independent-20261020/documentary/law114-visual-review.json`, `docs/evidence/ni-jur-documentary-supplement-20261021/dossier.json`, [registrul de publicații](https://www.minjust.gospmr.org/web.nsf/All/publication2?Count=1000&ExpandView=&OpenDocument=&Start=1), [anexa editată a legislativului de facto](https://www.vspmr.org/legislation/laws/zakonodateljnie-akti-pridnestrovskoy-moldavskoy-respubliki-v-sfere-konstitutsionnogo-stroya-osnov-pravoporyadka-a-takje-deyateljnosti-organov-gosudarstvennoy-vlasti-i-upravleniya/zakon-pridnestrovskoy-moldavskoy-respubliki-ob-administrativno-territorialjnom-ustroystve-pridnestrovskoy-moldavskoy-respubliki.html).
