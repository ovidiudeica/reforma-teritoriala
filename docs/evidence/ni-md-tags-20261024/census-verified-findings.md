# NI-TAGS.0 — rezultat verificat al recensământului exhaustiv de taguri OSM

**Execuție:** [GitHub Actions 40100730215](https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/40100730215), job `ni-md-tag-census` **SUCCESS**, commit exact `4a5533386420167c918b60163f93b94e86620abc`. Artefactul [ni-md-osm-tags-audit](https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/40100730215/artifacts/12562407488) include cinci fișiere: `summary.json`, `all-tag-keys-md-ni.json`, `md-all-2596-tags.jsonl`, `ni-reused-85-tags.jsonl` și `ni85-md-crosswalk.json`. **Acest audit nu modifică niciun fișier de geometrie sau de sursă ACTUAL.**

## Corpusuri și exhaustivitate

| Corpus | Relații examinate | Chei distincte | Domeniu probat |
|---|---:|---:|---|
| MD, OSM selectat de ACTUAL | **2596/2596** | **302** | Snapshot Overpass 2026-10-05, gzip verificat SHA-256 `d4fb245c714038d4e9bbb5273074c6ee1ad23555441289244c1d97c0afdf72b0` |
| NI, 85 roluri reutilizate | **85/85** | **44** | Census OSM pin-uit 2026-10-16 și trasabil la snapshot 2026-10-12 |
| NI de facto, 8 contururi OSM | **8/8** | Vezi tags per-ID | Pagini OSM live 2026-10-24; 1 rădăcină + 7 subzone |
| MD, comparație specifică Bender | **1** | 22 | Relația MD 9581354, distinctă de NI 944727 |
| Alte tipuri statistice ACTUAL MD | **6** | Nu au tags OSM | 2602 identități ACTUAL MD = 2596 relații OSM + 6 statistice non-OSM |

Exhaustivitatea se referă la **toate tagurile relațiilor OSM selectate de proiect în snapshotul fixat**, nu la absolut orice poligon cu `boundary=*` dintr-o întreagă arie geografică a lumii ori la toate edițiile curente post-snapshot. OSM-Boundaries poate avea o datare și o selecție diferite.

## Numărătoare exactă MD din registrul tuturor cheilor

- `admin_level` **2596/2596**, distribuție **2:1; 4:37; 7:5; 8:982; 9:1571**.
- `boundary=administrative` **2596/2596**.
- `type=boundary` **2542**; `type=multipolygon` **54**. Cele 54 multipoligoane sunt de nivel9 și reprezintă în principal asociații de grădini/allotments, nu noi raioane.
- `name` **2595**; `name:ro` **2347**; `full_name` **2220**; `name:prefix` **2474**; `official_name` **1698**; `name:suffix:en` **1550**. Se rețin originalele, nu se completează artificial numele prin `name:ro`.
- `ref:cuatm:codunic` **2350**; absență **246**, care trebuie clasificată pe rol înaintea concluziilor.
- `place=village` **1763**, `place=municipality` **410**, `place=town` **93**, `place=city` **24**, `place=district` **32**, `place=region` **2**, `place=allotments` **122**; **150** fără `place`. Niciun `place=municipality` nu trebuie transformat fără dovezi în «municipiu de nivelul II».
- Cele **122 allotments** sunt relații de nivel9; `landuse=allotments` apare la **55** de obiecte din total. Nu trebuie echivalate automat cu unități administrative CUATM.
- `ref:nuts:1/2/3` este prezent fiecare pe **151** de relații ale snapshotului MD. `ISO3166-2` este pe **37**, `wikidata` pe **1023**, `wikipedia` pe **1014**.

### Excepții per-ID depistate

1. O relație MD `12104636`, nivel9, `boundary=administrative`, **fără `name`**. Documentația OSM-Boundaries spune că importă numai poligoanele cu ambele `boundary` și `name`: acest obiect poate lipsi din serviciul derivat, deși există în snapshotul OSM intern.
2. Relația MD `1813297`, **sectorul Buiucani**, nivel7: `ref:cuatm:statut=0120000`, anomalie față de celelalte valori scurte 2,3,4,5,8 din aceeași cheie. Pare o valoare de cod statistic în locul statutului, dar aceasta este o **ipoteză de calitate a tagului**, nu permisiune de corectare.
3. 54 `type=multipolygon` sunt nivel9; să fie acceptate geometric doar după validare, nu respinse global ca administrativ greșite.
4. Absențele `ref:cuatm:codunic` 246 se distribuie: nivel8 **180**, nivel9 **64**, nivel7 **1**, nivel2 **1**. Nu sunt 246 erori CUATM validate, fiindcă unele obiecte sunt non-CUATM (allotments, intravilane etc.).

## Cele 85 roluri NI reutilizate

- Toate **85/85** sunt **același ID OSM** cu câte o relație din corpusul MD, confirmat de `ni85-md-crosswalk.json`: **0** roluri NI absente din corpusul MD.
- **84** sunt `admin_level=8`, unul `admin_level=4`; **82** au referințe `ref:cuatm:codunic`, **81** `ref:cuatm:2:codunic`; acestea descriu familia de coduri MD, nu de facto NI.
- **3 fără `ref:cuatm:codunic`**: Cremenciug `1216706`, Gîsca `12215667`, consiliul sătesc Chițcani `6879649`.
- `place=municipality` 72, `town` 7, `city` 4, `village` 1; o relație fără place.
- **85/85** au altă versiune OSM în fișele pin-uite NI față de snapshotul MD din 5 octombrie. La **82/85** există diferențe de *taguri*, toate numai pe cheile `ref:nuts:1` (82), `ref:nuts:2` (82) și `ref:nuts:3` (81), **prezente în snapshotul MD și absente în fișele NI ulterioare**. Cele 3 care nu prezintă diferență a tagurilor sunt Cremenciug, Gîsca și Chițcani. Diferența de versiune nu dovedește de una singură schimbare geometrică, de statut sau de părinți.
- Tot OSM păstrează explicit **două modele Bender**: `MD/9581354` cu `ISO3166-2=MD-BD` vs `NI/944727` cu consiliu municipal; `NI/65335` are notă de neconfundare cu `MD/2607033`.

## Implicații tehnice, juridice și de UX

**Principiu de implementare:** «un poligon reutilizat, mai multe atribuiri administrative independente». Inventarul MD `ref:cuatm` și `name:prefix` rămâne de jure MD. Contururile NI de facto ale raioanelor și consiliilor rămân surse cartografice separate; dreptul de a reprezenta o apartenență *contemporană* între nivel5 și unitate locală cere dovezi nominale/probat-e juridice NI-ADM, nu un simplu nested tree OSM.

OSM-Boundaries declară că reproducerile sunt as-is și că arborele derivă din containment și `admin_level` crescător; ierarhia aplicației externe **nu** este un act normativ. Evitați deduplicarea după `name`, după `wikidata` ori după suprapunere spațială fără rol. Păstrați ID-ul OSM, versiunea, timestampul, tagurile brute, proveniența, rolul, jurisdicția și statusul de certificare.

Nu se schimbă arborele, ACTUAL, CUATM, contururile OSM sau baza sursă; `P9.1=BLOCKED`. Următorul pas de implementare separat va fi un crosswalk nominal read-only per unitate de facto, ulterior finalizării NI-ADM.

**Licență:** © OpenStreetMap contributors, ODbL. Snapshotul MD nu este live 24 octombrie; cele 10 relații live OSM nu constituie un snapshot atomic.
