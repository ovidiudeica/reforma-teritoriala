# OSM-FIX.3 — remediere transport și dosar de acceptare blocată

## Stare executată

Baseline main: `d35f89a434260288bd3cde7c61e606d21907d8c7`. #398 rămâne OPEN/Draft pe `027d66f6f08296fd9006938a010f8e18265aca36`, cu conflicte; #396 rămâne OPEN. Acest PR extrage numai o remediere neprotejată și dovezi noi; nu supersedează integral #398 și nu admite un snapshot.

```text
OSM_SOURCE_CANDIDATE_VALIDATED=false
OSM_SOURCE_PROMOTED=false
OSM_FRESHNESS_PASS=false
ISSUE_396_RESOLVED=false
ACTUAL_INTEGRITY_PASS=true
READY_FOR_UA_CV0=false
```

## Remedieri implementate

RM-050: transportul folosea Map.set fără verificarea identității comune; un shard ulterior putea masca o versiune sau coordonate contradictorii. Contraexemplul inițial: 2 FAIL/1 PASS. Indexul comun respinge acum orice conflict de payload/versiune în același răspuns sau între shard-uri, dar acceptă duplicate semantic identice, inclusiv ordine diferită a cheilor.

RM-051: o selecție vidă nu atingea cazul terminal singleton și putea recursiona pe aceeași selecție. Oracle-ul legacy a oprit deliberat după trei apeluri mock, fără rețea. Noul preflight respinge selecțiile vide, duplicate sau ID-urile invalide înainte de primul fetch. Nu este declarată cauza vreunei anulări GitHub istorice.

RM-052: prima versiune nepublicată a generatorului calcula SHA pe reprezentarea JSON a Buffer-ului. Testul de hash a eșuat; generatorul fixează acum octeții reali, iar testul și regenerarea byte-identică trec. Raportul inițial greșit și logul sunt păstrate distinct, nu rescrise drept PASS.

Auditorul dependency/node-incidence este reutilizat din #398, întărit împotriva duplicatelor contradictorii și a geometriilor fără ways. Nu certifică intersecții de poligoane sau întreaga topologie globală: `full_topology_certified=false` rămâne explicit. Workflow-ul existent a fost extins, nu slăbit, și checkout-ul fixează HEAD-ul exact.

Validare locală executată: 77 execuții de test în lotul principal (inclusiv importurile existente), zero FAIL/SKIP; lotul focalizat ulterior: 16 PASS, cu suprapuneri față de lotul principal. Testul manifestului se execută suplimentar în CI. Rezultatele CI viitoare nu sunt înscrise drept rezultate deja obținute.

## Matricea per-ID

37 cereri oficiale read-only: 25 HTTP200 și 12 HTTP410; zero erori de achiziție. Originalele cu atribute de contributori rămân private; observations.json conține câmpurile tehnice sanitizate, datele accesării și SHA-256 al răspunsurilor originale. Nu se pretinde că acestea sunt un snapshot atomic.

`2596 - 12 + 1 = 2585`; deficitul net de11 nu este un set de11ștergeri. Versiunile relațiilor la epoca acceptată sunt derivate separat din istorice oficiale consecutive și confruntate cu tagurile/membrii snapshotului normalizat. Acesta nu stochează versiunile way/node; lipsa lor nu este mascată.

| Relație | Nume | Versiune la epoca acceptată | Ultima versiune | Stare actuală | CUATM |
|---|---|---|---|---|
| 18966859 | Bogăția Lacului | 4 | 5 | OFFICIALLY_RETIRED | 553002 |
| 18966939 | Grădina-Rai | 4 | 5 | OFFICIALLY_RETIRED | 553003 |
| 18967312 | Mesteacănul Alb | 4 | 5 | OFFICIALLY_RETIRED | 552403 |
| 18967475 | Struguraș | 4 | 5 | OFFICIALLY_RETIRED | 553008 |
| 18967641 | Novinca-Eco | 4 | 5 | OFFICIALLY_RETIRED | 553005 |
| 18967824 | Automobilist | 4 | 5 | OFFICIALLY_RETIRED | 553001 |
| 18967907 | Boierul-Com | 4 | 5 | OFFICIALLY_RETIRED | 552402 |
| 18967934 | Pomsuragro | 4 | 5 | OFFICIALLY_RETIRED | 553006 |
| 18968041 | Aluniș-Com | 4 | 5 | OFFICIALLY_RETIRED | 552401 |
| 18968051 | Romănița-Agro | 4 | 5 | OFFICIALLY_RETIRED | 552405 |
| 18968093 | Relief-Prim | 4 | 5 | OFFICIALLY_RETIRED | 553007 |
| 18968144 | Sveazist IL | 4 | 6 | OFFICIALLY_RETIRED | 553009 |
| 21515245 | Î.P. „Boierul-COM” | nouă | 1 | CURRENT_OSM_ADDITION | 552402 |

Toate cele12relații istorice corespund tagurilor și membrilor versiunii oficiale la epoca pinuită. analysis.json include timestampuri, changeseturi, relațiile way, grafurile istorice și hashurile per-ID. Retragerea unei relații OSM nu șterge identitatea ACTUAL. Pentru toate cele13înregistrări verdictul juridic este UNRESOLVED.

### 18967907 → 21515245

CUATM552402, changeset190081892 și timestamp2026-10-06T10:23:05Z sunt comune. Legătura de succesiune cartografică este susținută, dar nu reprezintă un alias automat sau o succesiune juridică. Ciclurile de coordonate diferă exact: 53 versus68vârfuri, SHA-256 distincte; comparația este invariantă la rotație/orientare și nu folosește toleranță sau snapping. Relația nouă are graf curent complet în acest subdomeniu; nu este promovată în ACTUAL.

## Horești și Buneți — propunere condiționată

| Relație | Way / versiune | Index zero-based | Referință propusă |
|---|---|---|---|
| Horești18967493/v6 | 1376179876/v8 | 457 | 12318728194 → 12318728593 |
| Buneți18968082/v7 | 1376180731/v6 | 227 | 11649857778 → 8265822008 |

Cele două full-uri oficiale au dependențele prezente. Înainte există câte două endpointuri de grad impar, distincte ca ID și coincidente în coordonate; după substituțiile explicite izolate, incidența se închide. Secvențele ordonate de coordonate sunt byte-identice în reprezentarea canonică, deci orientarea și forma nu sunt schimbate de propunere. Celelalte obiecte sunt nemodificate. API-ul invers observat găsește numai relația corespunzătoare pentru fiecare way modificat și zero părinți relation suplimentari; toate utilizările inverse ale celor patru noduri sunt consemnate, fără global node merge.

Simularea comună pe cele trei relații diagnosticate (două defecte + adăugarea) este PASS_FOR_ISOLATED_CONDITIONAL_SUBGRAPH; aceasta nu este un upload, un snapshot atomic, o certificare geometrică globală sau o aprobare a intenției mapperului. Înaintea oricărei publicări sunt obligatorii revizuirea de către mapper a intenției originale, reload-ul tuturor utilizărilor inverse și versiunilor, inspecția într-un editor și autorizarea expresă a editării OSM. Nu există un mecanism de upload în această implementare.

## Achiziție și candidat

Geofabrik20octombrie rămâne achiziție istorică parțial calificată, nu sursă acceptată. 98fișiere din cele trei dosare #398 reutilizate au fost verificate față de manifestele lor; legăturile sunt în archived-proof-bindings.json. Nu s-au redescărcat sau rehashuit originalele PBF/164GB. Snapshotul MD efectiv folosit pentru martorii istorici a trecut SHA gzip și SHA necomprimat; subgraful de544obiecte este în baseline.json.

Patru interogări mici de inventar la epoca2026-10-20T20:23:47Z au folosit predicatul existent și cel mult două endpointuri per țară. Toate au expirat la citire fără răspuns HTTP; nicio captură parțială nu este admisă. transport-probe.json păstrează interogările, epoca și diagnosticul real. Nu atribuim timeoutul unei cauze server nedemonstrate și nu relansăm aceeași captură completă. Ariile generate Overpass și excepțiile de selecție/proveniență nu sunt certificate prin aceste încercări.

Nu s-a construit un manifest pretins complet din cele37cereri per-ID. Source-only staging rămâne blocat de topologia upstream, calificarea selecției și proveniență; cele242UNKNOWN și excepțiile istorice rămân explicite. `data/sources/osm-current.json` este pinul istoric ACTUAL; `data/sources/osm-source-current.json` rămâne contractul propus separat în #398, nu un substitut autorizat automat. Niciunul nu este suprascris prin acest PR. Promovarea protejată se poate solicita numai pentru un candidat complet validat, cu fișiere și hashuri exacte; încă nu există unul eligibil.

## Freshness și integritate

Monitorul real, executat pe copii byte-identice ale metadatelor acceptate într-un director izolat, întoarce STALE/exit1. freshness.json păstrează ora reală, snapshotul5octombrie și pragul fix14zile. SIRUTA/CUATM rămân PASS; nu este falsificată prospețimea OSM.

actual-integrity.json verifică independent toate32componente: RO3246, MD2602, TOTAL5848; SHA semantic a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446. ACTUAL, CUATM, părinții MD, P9.1, host-trust și geometriile publicate rămân nemodificate. NI-FIN242noduri/85referințe/8contururi rămâne integrat; acest PR nu redeschide NI-FIN, REPO-CLEAN sau #442.

## Admitere și pașii rezervați

Modificările neprotejate pot fi integrate numai după CI/CodeQL/A-B și gate-urile aplicabile pe HEAD-ul exact; rezultatele și SHA-ul final se consemnează în checkpointul de admitere al PR-ului. Nu se folosește CI-ul vechi al #398 pentru noul HEAD. #398 nu se închide: acest fix este doar o parte reutilizabilă, nu înlocuitorul integral al sursei sale. #396 rămâne OPEN până la promovare autorizată și freshness PASS real.

Acțiuni rezervate: (1) revizuirea intenției de trasare și autorizarea separată a celor două editări upstream; (2) numai ulterior calificării complete, aprobarea exactă a promovării snapshotului protejat. Prima nu o implică pe a doua și nu rezolvă automat toate excepțiile de selecție/proveniență. Nicio aprobare nu este presupusă. READY_FOR_UA_CV0=false.

© OpenStreetMap contributors, ODbL. Proveniență: API-ul oficial https://api.openstreetmap.org/api/0.6/, snapshotul acceptat și commitul #398 pinuit în legăturile de probă. Datele OSM sunt descriptive, nu o certificare a jurisdicției juridice.
