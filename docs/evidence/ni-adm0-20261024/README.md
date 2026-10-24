# NI-ADM.0 — recensământul organizării administrative de facto

**Data auditului:** 24 octombrie 2026. **Status:** `PASS_SOURCE_SCOPED` pentru secțiunea rusă din anexa nr. 1/2023; `BLOCKED_EVIDENCE` pentru exhaustivitatea organizării contemporane.

## Structura declarată în anexa din 2023

- 5 raioane, 4 orașe enumerate separat ca unități administrative superioare (Бендеры, Дубоссары, Рыбница, Тирасполь).
- 74 consilii sătești; 162 mențiuni de localități: **7 orașe, 142 sate, 12 așezări `поселок`, 1 oraș-satelit**. Cele patru orașe superioare sunt deja incluse în totalul de 162, nu se adună încă o dată.
- Cele cinci raioane sunt Григориопольский, Дубоссарский, Каменский, Рыбницкий și Слободзейский. Dubăsari și Rîbnița sunt enumerate separat ca orașe și ca centre ale raioanelor omonime; o mențiune de centru administrativ nu creează o localitate nouă.

| Raion (nume din act) | Consilii | Mențiuni de localități |
|---|---:|---:|
| Григориопольский район | 13 | 29 |
| Дубоссарский район | 13 | 27 |
| Каменский район | 12 | 23 |
| Рыбницкий район | 23 | 46 |
| Слободзейский район | 13 | 27 |
| **Total în raioane** | **74** | **152** |

Secțiunea orașelor superioare adaugă 10 mențiuni, până la 162. Fiecare înregistrare din [census.json](census.json) are cheia documentară a paragrafului; `unit-XX`, `council-XX`, `place-XX` **nu sunt identități juridice noi**.

## Corespondența cu OSM și ACTUAL MD

85/85 roluri OSM din navigarea Nistreniei au fost reconciliate cu dosarul NI-JUR, **95/95 citări de paragrafe concordă textual** cu anexa. Dintre acestea, 90 indică intrări de localități și 5 desemnări de centre administrative de raion — nu se dublează orașele. Potrivirile istorice: 69 unice, 4 aliasuri posibile, 11 omonimii, 1 fără potrivire exactă (Lunga). Identitățile CUATM sunt numai referințe conservate.

**Nu echivalăm** 85 roluri OSM cu 74 consilii de facto ori cu 162 localități. Corespondența de nume nu dovedește egalitate de poligoane sau control teritorial. Excepții cu dosare distincte: Cremenciug, Lunga, Hlinaia, Bender, Rîbnița și localitățile revendicate în Zona de Securitate.

## Verificări efectuate

S-au executat verificări fail-closed în timpul extragerii: sursa `main@fe77df8f38c1e6195220422a18264f799065a41e`; 9=5+4 unități superioare; 74 consilii; 162 localități (7/142/12/1); nicio coliziune între adresele documentare sau părinte lipsă; 85/85 ID-uri OSM; 95/95 citări textuale, clasificate 90+5. **Nu am rulat un validator CI pe GitHub și nu declar check-uri verzi.**

## Limitele datării

Documentul este anexa de facto nr. 1 la Legea 155-З-III, republicată prin actul 48-ЗИ-VII din 24.03.2023, cu efect din 25.03.2023. Lanțul integral al modificărilor până la **24.10.2026**, registrele locale și corespondențele geometrice pentru fiecare entitate rămân necertificate. Legea 114-ЗИД-VIII din 29.05.2026 are intrare în vigoare amânată șase luni; ea nu este tratată drept operativă astăzi.

### Surse și interdicții

- [Anexa rusă verificată, cu original conservat](../ni-jur-independent-20261020/documentary/PMR-ATD-ANNEX1-133268-text.json)
- [NI-JUR — cele 85 fișe și contradicțiile](../ni-jur-review-20261021/review.json)
- [Navigare OSM Nistrenia](../../../public/data/p909-nistrenia-osm-navigation.json)
- [Supliment juridico-documentar 2026](../../ni-jur-documentary-supplement-20261021.md)
- [Sursa primară de facto: indexul legii](https://www.vspmr.org/legislation/laws/zakonodateljnie-akti-pridnestrovskoy-moldavskoy-respubliki-v-sfere-konstitutsionnogo-stroya-osnov-pravoporyadka-a-takje-deyateljnosti-organov-gosudarstvennoy-vlasti-i-upravleniya/zakon-pridnestrovskoy-moldavskoy-respubliki-ob-administrativno-territorialjnom-ustroystve-pridnestrovskoy-moldavskoy-respubliki.html)

`ACTUAL`, CUATM, OSM public, harta și P9.1 sunt **nemodificate**. `actual_mutation_allowed=false`; `p91_import_allowed=false`; `semantic_acceptance=BLOCKED_INCOMPLETE`.
