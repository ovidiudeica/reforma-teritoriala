# NI-TAGS.0 — completare: reconciliere categorică NI-ADM.0 ↔ OSM-85

**Data:** 2026-10-24. **Domeniu:** audit READ_ONLY / EVIDENCE_ONLY. **Statut:** PROVIZORIU pentru apartenențele de facto contemporane. Nu modifică ACTUAL, CUATM, OSM, geometriile, website-ul sau P9.1.

## Trasabilitate

- Inventar 2023: `docs/evidence/ni-adm0-20261024/census.json` din [commitul imuabil 27454b3](https://github.com/ovidiudeica/reforma-teritoriala/blob/27454b3d78671880cb41929f0e3d9c5240c5e018/docs/evidence/ni-adm0-20261024/census.json), PR #428. Originalul anexei are SHA-256 `43b8270b4e04c8922af551a72dc494d7bc02628fe827a8ec28bb2802a9f94b5b`.
- Dovezi OSM-85: `docs/p9.0.7.2.15-osm-tag-census.json`; corespondențele documentare sunt preluate **fără potriviri de nume nou inventate** din `OSM_85_crosswalk.hits` al NI-ADM.0.
- Contururi NI: `ten-osm-root-and-subdivision-tags.json`, 10 observații individuale OSM (MD 58974, NI 65335, 7 limite NI, Bender MD 9581354).
- Registrul complet derivat, per-entitate: [`ni-adm0-categorical-crosswalk.json`](ni-adm0-categorical-crosswalk.json), cu cele 9 unități, toate 74 consilii și toate 162 localități. Păstrează `annex_index`, `parent_2023`, `upper_2023`, candidații OSM, clasa potrivirii și statutul dovezii. **Nicio identitate juridică nouă nu este creată**.

## Matricea diferențelor pentru nivelurile superioare

| Unitate din anexa 2023 | Contur OSM superior | Constatări și statut |
|---|---|---|
| Бендеры / Bender (oraș distinct) | r944727 | Consiliu orășenesc NI nivel5; nu r9581354, limita legală MD nivel4 |
| Дубоссары / Dubăsari (oraș distinct) | **niciunul distinct în setul celor 8** | Candidat local r9288287; nu echivala orașul cu raionul omonim |
| Рыбница / Rîbnița (oraș distinct) | **niciunul distinct în setul celor 8** | Candidat local r9659979; nu echivala orașul cu raionul omonim |
| Тирасполь / Tiraspol (oraș distinct) | r1702219 | Consiliu orășenesc NI nivel5; candidat local r18941890 |
| Григориопольский район | r1702214 | Raion OSM nivel5 |
| Дубоссарский район | r1702215 | Raion OSM nivel5 |
| Каменский район | r1702216 | Raion OSM nivel5 |
| Рыбницкий район | r1702217 | Raion OSM nivel5 |
| Слободзейский район | r1702218 | Raion OSM nivel5 |

**Proba:** 2023 pentru cele 9 categorii; OSM `admin_level` și etichete pentru cele 7 contururi. **Nu este probă** de continuitate juridică până în octombrie 2026 sau de geometrie exactă de facto.

## Reconcilierea celor 162 mențiuni de localități

Din cele 162 de identități documentare distincte `place-XX`, **87** au cel puțin o citare de tip `LOCALITY` în crosswalk-ul preexistent OSM-85; **75** nu au nicio citare în acest *set limitat*. Cele 95 de citări originale NI-ADM.0 conțin 90 citări de localități și 5 referințe la centre raionale, care sunt eliminate din această numărătoare pentru a evita supranumărarea.

| Unitatea superioară din anexa 2023 | Mențiuni fără referință OSM-85 |
|---|---:|
| Bender | 1 |
| Dubăsari — oraș | 0 |
| Rîbnița — oraș | 0 |
| Tiraspol | 0 |
| Grigoriopol — raion | 12 |
| Dubăsari — raion | 19 |
| Camenca — raion | 10 |
| Rîbnița — raion | 21 |
| Slobozia — raion | 12 |
| **Total** | **75** |

**Regulă fail-closed:** `NO_REFERENCE_WITHIN_OSM85` nu înseamnă `OSM_GEOMETRY_DOES_NOT_EXIST`. `REFERENCE_ONLY_NOT_CERTIFIED` nu înseamnă poligon juridic individual verificat. Niciunul dintre cele 74 de consilii nu a fost adjudecat ca geometrie individuală de consiliu prin acest crosswalk; unele relații OSM pot purta în nume „consiliu”, fără ca această denumire să certifice delimitarea legală.

## Separarea probelor și a jurisdicțiilor

1. **OSM taguri (confirmate în corpusul datat):** 2.596 relații MD, 85 roluri NI incluse prin aceleași ID-uri OSM în MD, 8 contururi NI suplimentare. 302 chei distincte MD, 44 NI-85.
2. **Topologie:** numai grupările OSM documentate; o muchie părinte–copil în interfața de cartografiere nu demonstrează calitatea de UAT sau controlul efectiv.
3. **Act juridic din 2023:** 5 raioane + 4 orașe enumerate separat, 74 consilii, 162 localități. Aplicabilitatea completă la data curentă este încă blocată de excepțiile NI-ADM.1.x.
4. **Ipoteză / necesită lucru:** dacă un consiliu are o geometrie individuală deja utilizabilă, dacă subdiviziunile omonime au limite distincte echivalente și dacă revendicările au corespondent în controlul de facto; acestea nu se pot decide prin taguri sau nume.

### Lacune tehnice distincte de recensământul deja certificat

- Cele 10 observații „live” păstrează `version` și toate tagurile, dar **nu au încă în fișele JSON timestampul precis al versiunii**. Nu inventăm timestampuri; trebuie obținute prin sursă OSM cu versiune imuabilă sau XML/API verificabilă.
- Registrul celor 2.596 relații MD este ancorat la snapshotul **2026-10-05**, nu demonstrează exhaustivitatea tuturor modificărilor OSM de la 5 la 24 octombrie; OSM-Boundaries poate aplica un snapshot și un univers de import diferite.
- NU a fost efectuată verificarea geometrică separată a celor 75 mențiuni fără referință în cele 85, nici a tuturor celor 74 limite de consiliu. Acestea rămân cerințe pentru NI-TAGS.1 / NI-ADM crosswalk.
- Calculatorul extern cu arhiva istorică OSM nu a putut fi inventariat complet în această etapă: conexiunea Desktop Commander raportează limita lunară de utilizare. Nu s-a inițiat nicio descărcare și nu s-au atins fișierele locale.
- Nu se deduce certificarea juridică a unei autorități sau a unei modificări administrative din `admin_level`, `name:prefix`, `wikidata`, `CUATM` ori nume similare.

**GATE:** P9.1 rămâne BLOCAT; ACTUAL și părinții CUATM rămân nemodificați. Acest document și fișierul derivat sunt probe de audit, nu o specificație de implementare acceptată.

## Următorul subpas

**NI-TAGS.1:** reconciliere individuală a celor **75** de mențiuni fără referință OSM-85, urmărirea tuturor celor **74** consilii ca entități distincte, separarea orașelor Dubăsari/Rîbnița de raioanele omonime, verificarea celor 10 `version/timestamp` și a deltelor temporale OSM; totul READ_ONLY, cu matrici `OSM_GEOMETRY_CANDIDATE / NO_GEOMETRY_EVIDENCE / TOPOLOGY_CONFLICT / LEGAL_STATUS_UNCERTIFIED` și fără atingerea ACTUAL.
