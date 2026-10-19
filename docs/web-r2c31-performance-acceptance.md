# WEB-R2c.3.1 — profilare și verdict de performanță

Baseline acceptat: `335234bdb7b8cec828d4d2ad11d42d5bc5f99642`, Etapa 0 CLOSED_PASS. Domeniul acestui PR: completarea și corectarea instrumentării Chromium/CDP și investigarea măsurătorilor, fără schimbări ale aplicației sau ACTUAL.

Constatare reproductibilă RM-002: benchmarkul aplică viewport-ul după navigare; astfel încărcarea inițială etichetată mobil pornește cu viewport-ul implicit. Corecția va aplica viewport-ul înainte de navigare și va verifica dimensiunile la începutul documentului.

Acoperire: șase perechi independente cold/warm pe desktop, tabletă și mobil portrait/landscape; prima este înregistrată cu tracing, iar celelalte cinci sunt folosite la percentile. Interacțiunile păstrează V8 heap după GC, trace CDP, rețea brută, încărcare geometrică și verificarea independenței filtrelor/NI/ACTUAL. Sunt incluse cicluri History ×20 și investigația retenției după 20/40/80/160 de cicluri de panouri. Verdictul rămâne OPEN până la încheierea investigației memoriei, inspectarea capturilor și toate gate-urile PASS pe SHA-ul exact.

Matrice preliminară [39331515663](https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/39331515663), surse curate `bcff2295b460b471ab7e22f5cfc77746637c3f86`: PASS, 100 de înregistrări, cinci eșantioane fără tracing pentru fiecare profil și stare de cache. p50/p95 cold ms: desktop 229,6/309,98; mobil portrait 222,5/288,90; tabletă 180,2/334,78; landscape 176,3/202,02. Warm: 78,6/89,28; 70,2/76,06; 68/71,96; 69,1/70,42. Serverul fixture permite cache HTTP cu max-age=600, fără compresie sau throttling; nu se confundă cu măsurarea rețelei reale Pages. SourceMain este commitul checkout; runnerSha poate indica merge-ref-ul evenimentului PR, fără a schimba checkout-ul head explicit.

Nu există erori HTTP proprii sau cereri geometrice repetate în scenariile măsurate. Cele trei evenimente externe de eșec sunt `net::ERR_ABORTED` cu `canceled=true` în timpul înlocuirii tile-urilor OSM; datele brute sunt păstrate. Timpii History din distribuția inițială includ două frame-uri, iar verificarea restaurării urmează separat; seria de stres măsoară până la starea verificată și etichetează explicit costul transportului CDP.

Trace-urile arată că o parte importantă a duratelor mari aparține GC forțat de audit, nu interacțiunilor utilizatorului. Primul profil desktop include evaluare inițială de modul ~338 ms și layout ~103 ms. Aceste eșantioane cu tracing sunt separate de percentile.

Matricea de stres [39332407197](https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/39332407197) PASS pe `d72c1c15a44741baf6896fb0b4078266a59fa977`: 108 înregistrări, câte 20 cicluri History forward/back verificate în toate cele patru profiluri. Pentru seriile panourilor 0/20/40/80/160, numărul total Chrome Nodes rămâne exact 3179 desktop, 3064 mobil portrait, 3082 tabletă și 3064 landscape. Heap crește între 0 și 160 cu 489.740 / 104.364 / 102.852 / 120.412 octeți. DOM-ul montat rămâne 734 / 718 / 718 / 716. Acest rezultat nu dovedește un leak DOM; retenția JS este investigată suplimentar prin snapshoturi V8 desktop la 160 și 320 de cicluri. Verdictul aplicației rămâne OPEN până la atribuirea rezultatului.

Au fost inspectate cele opt capturi before/after desktop, mobil portrait, tabletă portrait și mobil landscape. Starea after aplică intenționat zoomul 6 și închide panoul, deci nu este o diferență vizuală a codului aplicației față de before. Comenzile, contururile și navigarea sunt vizibile; nu s-a modificat UX.

Măsurarea `frontendReadyObservedMs` observă promisiunea exportată de aplicație după DOMContentLoaded, separat de NavigationTiming și de întârzierile de stabilizare ale harness-ului. Este o limită observată a disponibilității exportului, nu o afirmație de TTI standardizat.

RM-003 adaugă verificarea surselor urmărite curate. RM-004 remediază patru alerte CodeQL pentru căile artefactelor, cu țintă de scriere constantă și teste adversariale. CodeQL pe `e6322812daf98d256871e5d061758974f22689de` raportează zero alerte noi (check 118332554642).

Gate extern ENV-004: GitHub a alocat în două probe B imaginea neaprobată 20261018.339.1; host-trust a refuzat corect execuția înainte de ACTUAL. Nu se modifică lista de încredere pentru a obține PASS. Este necesar PASS pe profil deja aprobat sau o decizie separată privind contractul protejat. Eșecurile sunt păstrate în registru și loguri.

Nu se introduc praguri noi arbitrare, cache, worker sau virtualizare suplimentară. Orice optimizare a aplicației necesită o problemă demonstrată și comparație controlată înainte/după. ACTUAL și P9.1 rămân protejate.
