# NI-FIN 1.0 — specificația de acceptare funcțională

## Domeniu și decizie

Nistrenia este o jurisdicție **virtuală de prezentare**, descriptivă și read-only.
Baza administrativă este organizarea declarată în anexa din 2023. Nu este
organizarea oficială MD, o certificare a controlului efectiv sau o delimitare
juridică. Actualizările 2024–2026 se aplică numai individual, cu conținut și
aplicabilitate probate. În lipsa acestora, sursa 2023 și incertitudinea sunt vizibile.

Mandatul NI-FIN adoptă pentru acest domeniu două proiecții existente din PR-urile
428 și 438, la commituri imuabile și hashuri explicite în `source-bindings.json`.
Nu adoptă în bloc lanțul NI-ADM, nu acceptă formal NI-JUR și nu închide OSM-FIX.2.
PR438 a fost inspectat pe `c900b9c0b9583514df547f5ef7bcb30065a6ba16`:
20 SUCCESS și două omiteri condiționale, dar baza sa `f08372f` este anterioară
main-ului NI-FIN `447f9bd`. Nu transferăm acele rezultate către un HEAD actualizat
și nu îl integrăm automat. Referința sa imuabilă este suficientă pentru adoptarea
scopată și hashuită de aici; toate gate-urile NI-FIN proprii se execută separat.

## Inventar și ierarhie

Rădăcina Nistrenia are nouă unități: raioanele Camenca, Rîbnița, Dubăsari,
Grigoriopol, Slobozia și orașele Tiraspol, Bender, Dubăsari — oraș, Rîbnița — oraș.
Cele 74 de consilii și 162 de mențiuni de localități păstrează exact părinții din
registrul anexei. Nu se introduce un consiliu pentru o localitate subordonată
direct unui oraș. Referințele de centru raional nu generează localități noi.

Cele patru perechi `unit-11/place-11`, `unit-15/place-15`, `unit-16/place-16`,
`unit-17/place-17` au aceeași poziție documentară: un singur nod de prezentare,
cu ambele roluri în registru. Rezultă din sursa actuală 242 de noduri administrative
accesibile (rădăcină + 9 unități + 74 consilii + 158 alte mențiuni), nu 242 de
identități juridice. Validatorul derivă totalul și respinge deduplicarea după nume.
ID-urile de prezentare sunt namespaced; cheile documentare rămân referințe.

Corecția individuală NIF-001 din `parent-corrections.json` repară numai
proiecția părintelui Maiac: punctul numerotat 2 al raionului Grigoriopol este
frate cu punctul 1 (orașul), nu subordonat acestuia. Originalul recensământului
rămâne byte-identic. Subpunctele literale 25–27 rămân sub oraș. Localitățile
subordonate altor localități probate sunt păstrate, inclusiv Solnecinoe sub
Camenca și așezarea stației Livada sub Pervomaisc; nu se inventează consilii.

`sources/census-2023.json` conservă inventarul per-ID și toate legăturile.
`sources/categorical-crosswalk.json` conservă cele 87 de mențiuni cu referințe
OSM-85 și 75 fără referință în acest set. Niciuna nu este eliminată pentru lipsa
poligonului. Denumirile românești probate sunt preferate; numele original și
aliasurile rămân căutabile. O transliterare nu devine echivalență juridică.

## Geometrie, rol și asociere

Geometriile sunt resurse canonice, independente de nodurile administrative:
85 de roluri referă identitățile ACTUAL existente și opt contururi rămân în
pachetul OSM independent actual. Noul model nu conține coordonate/GeoJSON și nu
copiază poligoane. Seturile de selecție și cache-ul folosesc ID-ul geometric
canonic: două roluri care folosesc același poligon nu generează două straturi.

La fiecare nod se separă statutul resursei geometrice de **asocierea** acesteia
cu unitatea documentară. Potrivirea nominală din crosswalk este o candidatură,
nu dovada că poligonul reprezintă întregul consiliu sau întreaga unitate declarată.
Un consiliu nu moștenește poligonul centrului său. Cele 74 de consilii nu primesc
implicit geometrie. Cele 75 de mențiuni fără referință nu sunt declarate inexistente
în OSM; investigațiile ulterioare sunt opționale și limitate la probe disponibile.

Statute geometrice: `GEOMETRY_VERIFIED`, `GEOMETRY_CANDIDATE`,
`NO_GEOMETRY_EVIDENCE`, `TOPOLOGY_CONFLICT`. Statute administrative/temporale:
`SOURCE_SCOPED_CONFIRMED`, `PROVISIONAL`, `CONTRADICTED`, `UNDETERMINED`.
Confirmarea sursei 2023 este limitată la enunțul acesteia, nu la situația 2026.
Controlul efectiv și apartenența juridică a întregului poligon rămân axe separate.

Cele cinci raioane și Tiraspol/Bender au referințe la șapte contururi existente;
orașele Dubăsari/Rîbnița nu au contururi superioare distincte în setul de opt.
Candidatele lor OSM de localitate se prezintă ca atare, fără inventarea unui
nou perimetru administrativ. Cele 85 de roluri OSM rămân accesibile ca resurse
cartografice distincte, inclusiv prin căutare/card, fără a le număra drept alte
85 de unități documentare. URL-urile vechi rezolvă aliasurile canonice; nu mută
implicit o identitate oficială sub un părinte de facto.

## Excepții obligatorii

- Bender: MD `9581354`, contur NI `944727` și oraș OSM `12463379` sunt roluri
  distincte; nu sunt înlocuite unul cu altul.
- Dubăsari și Rîbnița: orașele și raioanele au ID-uri și părinți distincte.
- Cremenciug: părintele documentar Tiraspol nu rescrie părintele MD Căușeni;
  gruparea geometrică OSM Slobozia rămâne o informație separată.
- Lunga, Hlinaia/omonimii, Chițcani și Zona de Securitate: se păstrează toate
  contradicțiile și referințele per-ID; nu se atribuie control din geometrie.
- Revendicările teritoriale nu sunt convertite în control efectiv sau suveranitate.

## Arbore, carduri și selecții

Arborele principal prezintă ierarhia administrativă documentată, nu cele șapte
grupări geometrice drept nouă administrații. Nodurile fără poligon au nume,
expandare, căutare și card; comanda pentru geometria proprie este dezactivată
accesibil. O candidatură poate fi inspectată explicit în card, fără prezentarea
poligonului ca limită administrativă certificată.

Cardurile arată tipul, părintele documentar, anul și sursa, rolul/ID-ul OSM când
există, statutul geometriei și al asocierii, incertitudinea temporală și controlul
nedemonstrat. Meniul rămâne concis, fără coduri și statistici documentare.

La pornire sunt vizibile doar geometriile celor două rădăcini oficiale și conturul
Nistreniei. Bifarea unui părinte nu bifează descendenții; expandarea nu schimbă
selecția. Selectarea numelui nu activează implicit un poligon. RO și MD păstrează
comportamentul acceptat. Filtrele OSM operează pe roluri geometrice și nu șterg
înregistrările textuale fără nivel OSM. Comenzile colective deduplică referințele
și păstrează previzualizarea/confirmarea/anularea/Undo existente.

## Integritate și aplicabilitatea gate-urilor

ACTUAL rămâne 3.246 RO + 2.602 MD = 5.848 identități și 32 componente,
fingerprint `actual-a9e5a4ddcb5277ef`. Nicio mutație a părinților MD, CUATM,
geometriilor certificate, sursei istorice, host-trust sau pragului de 14 zile.
P9.1 și editarea OSM public rămân neautorizate.

Lipsurile globale OSM nu blochează înregistrarea administrativă textuală; o
dependență individuală demonstrată rămâne blocaj pentru geometria afectată.
NI-FIN nu pretinde rezolvarea celor 242 UNKNOWN/159 istorice/641 versiuni.
Gate-urile obligatorii aplicabile fiecărui HEAD trebuie să treacă; SKIPPED este
documentat separat când domeniul este legitim neaplicabil. Eșecul host global
anterior nu împiedică executarea testelor NI și nu autorizează relaxarea politicii.
Un eșec obligatoriu rămas nu este mascat prin verdict funcțional pozitiv.

## Acceptare NI-FIN.1–3

1. Model determinist: toate ID-urile/părinții/rolurile documentare acoperite,
   exact 9/74/162, deduplicarea celor patru orașe, fără cicluri și fără geometrii
   copiate; hashuri și teste negative pentru referințe/temporalitate/statute.
2. Interfață: nouă unități, toate consiliile/localitățile, carduri fără poligon,
   cazurile nominale, RO/MD independente, rădăcini inițiale independente,
   căutare/filtre multiple/Undo/Reset/URL Back-Forward/refresh/share,
   tastatură și layout desktop/tabletă/mobil/landscape/text zoom 200%.
3. Geometrie: 85 de roluri și opt contururi conservate, nicio cerere/strat dublat
   pentru aceeași resursă; candidatele explicit diferențiate de limite probate.
4. Publicare: CI/CodeQL pe HEAD exact, toate gate-urile aplicabile terminale și
   reușite, capturi inspectate, merge controlat, verificare post-merge și Pages
   pe SHA corespunzător. Numărătoarea resurselor se derivă din noul manifest,
   nu se fixează artificial la vechiul 435/125 dacă se adaugă fișiere de model.

## Definiția închiderii

`NI_FUNCTIONAL_COMPLETE` numai după implementare integrată, publicată și toate
criteriile NI-FIN validate. `NI_LEGAL_CERTIFICATION_PENDING` și
`OSM_SOURCE_PENDING` rămân independente și pot coexista cu închiderea funcțională.
Issue396 și ROADMAP-CLOSURE global nu se închid prin NI-FIN. Dacă un gate
obligatoriu împiedică integrarea, implementarea rămâne conservată în Draft;
raportul `NI-FIN-CLOSURE` indică exact SHA-ul, dovada și operațiunea necesară.
