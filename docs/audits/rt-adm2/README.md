# RT-ADM.2 — Identități administrative și decizii de corecție (read-only)

**Bază probatorie:** RT-AUDIT.1.2, commit `f1daecf5d2d518c23b617c6aeb0674ae9a09b66b`, artifact [12931526779](https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/40951520686/artifacts/12931526779). Ramură separată `audit/rt-adm2-identity-decisions-20261029` creată din SHA-ul auditat, fără intervenții ACTUAL. Registrul tuturor celor 14 cazuri individuale este `identity-decision-register.json`.

## Delimitarea certificării

**Identitatea juridică atribuită unui cod dintr-un registru oficial** nu este identică automat cu **identitatea juridică a unui poligon OSM**. O neconcordanță între `ParentCodUnic` și arbore dovedește discrepanța datelor, nu partea care trebuie corectată. Nicio schimbare de parent, binding, nume, nivel sau geometrie nu este autorizată aici.

## Cele două discrepanțe CUATM prioritare

| Relație copil | Cod stocat | Părinte ACTUAL/cod | Părintele oficial al codului | Certificare și decizie |
|---|---|---|---|---|
| Bondareuca `osm-r18967570` | CUATM 8961 | Grigorăuca `osm-r19076879` / 7433 | Zgărdești / 8960 | Discrepanță între binding și parentajul oficial **demonstrată**; identitatea întregului footprint încă **necertificată**; nicio reparentare |
| Etulia loc.st.c.f. `osm-r18968043` | CUATM 9639 | Cișmichioi `osm-r19117344` / 9621 | Etulia / 9629 | Aceeași distincție; nu se transferă automat poligonul |

Surse: `outputs/RT-AUDIT.1.2/official-parent-discrepancies.json`, `data/sources/cuatm-current.json`, originalul oficial `docs/audits/rt-audit1-2/evidence/CUATM_25.xlsx`.

**Test decizional obligatoriu, separat pentru fiecare caz:** (a) relația OSM identifică pozitiv aceeași unitate oficială, prin dovezi independente de tagul CUATM și de simpla localizare? (b) sursa oficială determină juridic frontiera aplicabilă? (c) arborele utilizează un rol auxiliar ori local care explică parentajul? Numai după (a)-(c) se poate propune corecția precisă: binding, rol sau parentaj; altfel `DOC / NO_CHANGE_PENDING_PRIMARY_EVIDENCE`.

## Hrușova / relația 12104636

`osm-r12104636`, în arbore sub `osm-r19090918` (Hrușova, CUATM 3136): identitatea pozitivă este încă nerezolvată. Numele, categoria juridică și codul CUATM lipsesc din metadatele înghețate; parentajul și conturul nu substituie dovada. Acțiune: numai recuperare țintită a istoricului/tagurilor, comparație cu un identificator primar local și clasificare ulterioară dacă apare probă pozitivă. Verdict: **DOC**; fără atribuire.

## Cele 11 reprezentări RO fără binding pozitiv

Cinci reprezentări de localități: `osm-r11283027` Mureșeni, `osm-r11283576` Remetea, `osm-r11366846` Sat Vălureni, `osm-r11366847` Sat Cristești și `osm-r12557978` Bărdești. O potrivire nominală SIRUTA nu certifică conturul relației OSM; este necesară legarea pozitivă la înregistrarea oficială și rolul localității.

Șase sectoare București: `osm-r7960954` Sector 1, `osm-r7960953` Sector 2, `osm-r7960937` Sector 3, `osm-r7960957` Sector 4, `osm-r7960956` Sector 5 și `osm-r7960955` Sector 6.

Legea nr. 290/2018 și Decretul nr. 284/1979 confirmă existența și organizarea în șase sectoare. Nomenclatorul NRSIRUTA indică 179141/179150/179169/179178/179187/179196 ca referințe pentru sectoarele 1–6; **aceste coduri nu sunt atribuite automat poligoanelor OSM**. Limitele legale trebuie confruntate cu reprezentările cartografice înainte de o certificare de footprint. Surse primare:
- https://legislatie.just.ro/Public/DetaliiDocumentAfis/208652
- https://legislatie.just.ro/Public/FormaPrintabila/00000G2EQS2F040U8L11D6AZZNTD0Y4X
- https://www.recensamantromania.ro/wp-content/uploads/2021/11/SIRUTA.pdf

## Matricea deciziilor

| Tip | Număr | Constatare probatorie | Decizie recomandată |
|---|---:|---|---|
| Conflict cod/parentaj CUATM | 2 | Codul oficial stocat și părintele din arbore diferă | `HOLD` până la identificare independentă a footprintului |
| Identitate MD lipsă | 1 | Fără dovadă pozitivă pentru 12104636 | `DOC`; fără cod ori categorie nouă |
| Localități RO nelegate | 5 | Reprezentări OSM fără binding oficial certificat | `DOC`; căutare probă individuală |
| Sectoare București | 6 | Existență juridică a subdiviziunilor dovedită; poligoane nereconciliate cu frontieră legală | `DOC`; numai propuneri ulterioare validate |

**14/14 fișe de decizie pregătite. Zero reparentări sau atribuiri automate. Zero identități de poligon nou certificate.** Nu confundăm finalizarea inventarului de decizii cu închiderea certificării juridice individuale. Este necesară achiziție primară suplimentară pentru verdict de corecție.

## Reguli de continuare RT-ADM.2

1. Pentru cele două discrepanțe, obține o probă pozitivă independentă a identității OSM (act administrativ local, registru oficial cu poziționare sau relație verificabilă, nu numai numele).
2. Pentru cinci localități RO, confruntă înregistrarea SIRUTA aplicabilă în timp și rolul poligonului cu limite oficiale, păstrând separat identificarea localității și echivalența geometrică.
3. Pentru șase sectoare, distinge existența legală și codurile de frontieră; compară limitele normative/cadastrale dacă sunt accesibile.
4. Păstrează `NO_CHANGE_PENDING_PRIMARY_EVIDENCE` pentru fiecare caz care nu trece aceste probe. Întocmește cererea de autorizare distinctă numai pentru corecții efectiv certificate.

## Stare și protecții

**RT-ADM.2: registrul inițial de decizii complet; certificarea juridică a footprinturilor: deschisă.** Modificările sunt doar documente de audit într-un branch nou; ACTUAL, geometriile, parentajele și P9.1 rămân nemodificate. Branch-ul de bază al PR #459 și `main` nu sunt modificate de RT-ADM.2. Orice CI aferent unui nou commit trebuie verificat separat; nu se declară PASS fără verificare.

### Coroborare normativă suplimentară RO — localitățile Târgu Mureș

Anexa consolidată a Legii nr. 2/1968 și anexa Legii nr. 290/2018 consemnează explicit **Mureșeni** și **Remetea** ca localități componente ale municipiului **Târgu Mureș**. O normă de inscripționare administrativă confirmă și denumirile locale. Este astfel stabilit **rolul juridic al localităților nominale**, dar nu este certificat că poligoanele OSM `osm-r11283027` și `osm-r11283576` au exact limitele legale și nici nu se poate atribui un cod SIRUTA din simpla potrivire nominală.

Surse:
- https://legislatie.just.ro/public/detaliidocument/190
- https://legislatie.just.ro/Public/DetaliiDocument/208652
- https://legislatie.just.ro/Public/DetaliiDocumentAfis/217004
