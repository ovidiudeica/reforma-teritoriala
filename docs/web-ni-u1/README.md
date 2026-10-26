# WEB-NI-U1.0/U1.1 — audit administrativ și matrice geometrică (READ-ONLY)

**Referință verificată:** `main@e1d72da36ac64d5cd48a1437af858bfca775fa56`, 25 octombrie 2026.  
**Statut:** `U1.0_DOCUMENTARY_BASELINE_VERIFIED_WITH_EXCEPTIONS`; `U1.1_RESOURCE_INVENTORY_RECONCILED_WITH_UNCERTIFIED_ASSOCIATIONS`. Nu reprezintă acceptarea juridică 2026 și nu autorizează integrarea funcționalităților U1.2–U1.4 înaintea testelor.

## Proveniență primară și distincția 7/9

1. Constituția publicată de Sovietul Suprem (ediție menționată ca actualizată la **10.07.2025**), art. 14, enumeră **cinci raioane + patru orașe** (Bender, Dubăsari, Rîbnița, Tiraspol): https://www.vspmr.org/about/constitution/
2. Portalul istorico-instituțional `history.gospmr.org` prezintă **șapte unități de rang superior**, cinci raioane și orașele de importanță republicană Tiraspol și Bender; raioanele au orașe de importanță locală, consilii sătești și localități: https://history.gospmr.org/o-pridnestrove/
3. Actul nr. 155-З-III/17.07.2002 privind organizarea administrativ-teritorială are pagina oficială de index (versiune generală indicată 19.03.2022, anexa 1 indicată 25.03.2023): https://www.vspmr.org/legislation/laws/zakonodateljnie-akti-pridnestrovskoy-moldavskoy-respubliki-v-sfere-konstitutsionnogo-stroya-osnov-pravoporyadka-a-takje-deyateljnosti-organov-gosudarstvennoy-vlasti-i-upravleniya/zakon-pridnestrovskoy-moldavskoy-respubliki-ob-administrativno-territorialjnom-ustroystve-pridnestrovskoy-moldavskoy-respubliki.html
4. Modificarea nr. 48-ЗИ-VII/24.03.2023, publicația oficială `2023000445`, original conservat în `docs/evidence/ni-jur-documentary-supplement-20261021/law48-original.pdf`: https://www.minjust.gospmr.org/oo/Publication.nsf/805c7c76d1c2ddb8c2258213005be80f/4391b9419959e04ac225897c0048c9b2!OpenDocument
5. Corpus local existent: `docs/ni-fin/sources/census-2023.json`, `categorical-crosswalk.json`, `docs/ni-fin/source-bindings.json`, `docs/ni-fin/parent-corrections.json`, `views/nistrenia/administration.json` și manifestul acestuia. Originalele și SHA-urile sunt păstrate fără modificări.

**Distincție confirmată în sursele citate:** nouă entități **enumerate** constituțional vs. șapte unități **clasificate ca superioare** în prezentarea instituțională. Nu este o probă că trebuie eliminate Dubăsari și Rîbnița, nici că statutul lor în fiecare registru 2026 este complet certificat. Originea și efectul juridic al clasificării, clasificarea independentă vs. locală și părintele normativ al orașelor Dubăsari și Rîbnița necesită confruntarea integrală a articolului aplicabil din lege, anexelor și actelor ulterioare. Până la aceasta **nu mutăm automat** `view-nistrenia-unit-15` ori `view-nistrenia-unit-16` sub omonimele raionale: structura NI-FIN.2023 este menținută ca proiecție documentară și marcată excepție.

Nu certificăm exhaustivitatea amendamentelor 2024–2026 sau a registrelor locale doar din paginile publice curente. Dosarul `docs/ni-jur-documentary-supplement-20261021.md` consemnează un index observat 2023–2026, dar menține explicit lacunele certificării contemporane.

## Inventarul per-ID și regula administrativă

Fișier: `ni-u1-0-u1-1-per-id-registry.json`. Derivat exclusiv din modelul NI-FIN de pe main verificat. Conține **toate 242 ID-urile** cu `documentary_parent_id`, `documentary_child_ids`, `source_refs`, tip documentar, an, stare juridică, geometrie proprie și candidați, fără reparentări speculative.

| Categorie NI-FIN | Număr |
|---|---:|
| Rădăcină | 1 |
| Raioane | 5 |
| Orașe enumerate distinct | 4 |
| Consilii sătești | 74 |
| Noduri distincte de localități | 158 |
| **Total noduri de prezentare** | **242** |

Cele 162 mențiuni locale brute includ patru roluri urbane reconciliate cu noduri existente. Un consiliu și localitatea sa nu sunt identități interschimbabile. Corecția punctuală Maiac `NIF-001` rămâne înregistrată și nu rescrie originalul.

## Reconciliere geometrică U1.1

| Tip / relație | Număr |
|---|---:|
| Geometrii ACTUAL/MD păstrate și reutilizate prin rol NI | 85 |
| Contururi OSM independente NI (inclusiv rădăcina) | 8 |
| **Resurse canonice totale** | **93** |
| Noduri cu contur propriu conservat | 8 |
| Noduri fără contur propriu certificat | 234 |
| Noduri cu `geometry_status=GEOMETRY_CANDIDATE` | 97 |
| Noduri cu ID candidat NI în `geometry_candidates` | 87 |
| Resurse ACTUAL distincte din listele de candidați NI | 84 |
| Noduri cu numai candidați nominali MD exteriori listei NI-85 | 12 |

**Atenție:** `GEOMETRY_CANDIDATE` (97) nu înseamnă că 97 noduri au un ID NI din setul de 85. Două noduri cu contur propriu au și candidați, iar 12 noduri au doar potriviri nominale suplimentare MD. Cele două axe trebuie păstrate separat. Cele 234 noduri fără contur propriu sunt **97** candidat și **137** fără dovezi proprii, potrivit modelului-sursă.

**Excepție de acces:** `osm-r19001619` este în lista celor 85 roluri NI, dar nu figurează în `geometry_candidates` ale niciunui nod. Va necesita acces direct în arbore printr-o legătură explicită cu geometria canonică sau un selector de resurse neasociate; **fără părinte administrativ inventat**.

**Excepții de ambiguitate:** șase ID-uri de geometrie au câte două asociări nominale: `osm-r7427669`, `osm-r8290877`, `osm-r8291058`, `osm-r9301463`, `osm-r9659709`, `osm-r9679382`. Ambele candidaturi rămân în registru, fără deduplicarea nodurilor administrative. Cele 12 potriviri MD doar după nume rămân consultative și nu sunt promovate în cele 85.

## Contracte pentru implementare

- `administrative_node_id → geometry_id | null`: doar contururi proprii deja păstrate în NI-FIN, nu cei 85 de candidați.
- `geometry_id → administrative_roles[]`: identitate geometrică canonică, rolul MD pentru resurse ACTUAL, roluri NI și corespondențe candidate fără statut juridic automat.
- O geometrie canonică are o singură stare de bifare și un singur card geometric. Contextul documentar al unei unități fără contur rămâne card administrativ separat.
- Filtrele de jurisdicție sunt perspective asupra aceluiași ID și nu mută o resursă MD în jurisdicția NI. Debifarea într-un arbore sincronizează toate controalele care referă același ID, fără a selecta automat alte noduri.
- Înaintea U1.3: verifică normativ orașele Dubăsari/Rîbnița; dacă părintele rămâne incert, păstrează excepția explicită, fără relocare. Eliminarea sufixelor vizuale nu modifică identitățile din surse.
- Integrarea U1.2–U1.4 necesită teste de unicitate, URL/History, Undo/Reset, roluri NI-85, filtre, accesibilitate, comparație A/B și CI pe SHA-ul exact.

## Gate-uri și restanțe

Acest PR conține **doar dovezi read-only**, nu este aprobare a structurii 2026, nu modifică ACTUAL ori website-ul. Baseline protejat: RO=3246; MD=2602; total=5848; 32 componente; SHA semantic `a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446` (referință din NI-FIN; nu pretindem un nou calcul A/B aici). `P9.1` rămâne blocat; #396 și #442 rămân OPEN; #398 Draft; fără editări publice OSM. Pentru merge: required checks complete pe head exact, fără bypass sau înlocuirea testelor reale cu rezultate simulate.
