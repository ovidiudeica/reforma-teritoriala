# NI — acoperirea dependențelor și dosarul curent pregătitor

Baseline: main `66a915b27a8ab8168df624749dc6d937295576af`, după integrarea independentă a PR #399. Auditul post-merge este urmărit separat; acest PR începe Draft.

Problema: workflow-ul NI folosește biblioteci de topologie, transport și proveniență fără a declara toate aceste dependențe în filtrele de declanșare. Modificarea izolată a unei biblioteci poate omite replay-ul NI specific. Remedierea extinde selecția fișierelor; nu reduce testele, permisiunile sau contractele de acceptare.

În același domeniu de conservare independentă, pachetul pregătitor păstrează recapturarea din 21 octombrie 2026 și generatorul individual determinist pentru 85 de roluri, cu cinci axe și control efectiv separat. Cele 111 fișiere ale pachetului, plus manifestul lor, includ originalele curente ale celor 85 de roluri și opt contururi, proveniența GHA și intrările generatorului. Nu sunt introduse geometrii derivate în corpus sau website.

Replay-ul istoric și cel curent folosesc aceeași implementare statică, bazată pe funcțiile existente de asamblare. Fiecare epocă reconstruiește toate cele 93 de geometrii și verifică toate cele 4.278 de perechi, plus referințele ACTUAL și versiunile. Regenerarea dosarului este byte-identică. Testele negative resping mutațiile părinților MD, promovarea juridică ori a controlului efectiv, comasarea omonimelor și falsa închidere NI-JUR.4.

Originalele istorice rămân intacte. Diferențele dintre cele două capturi sunt păstrate cu hashuri distincte: 91 de răspunsuri diferă exclusiv prin metadatele generatorului API, nu prin elementele OSM. Aceste observații nu relaxează comparațiile de geometrie sau integritate și nu furnizează un verdict de prospețime globală.

OSM-FIX.2 rămâne blocat de Horești/Buneți. NI-JUR.0–4 nu primesc acceptare prin integrarea acestui PR. Issue #396 rămâne OPEN. `actual_mutation_allowed=false`, `p91_import_allowed=false`, `semantic_acceptance=BLOCKED_INCOMPLETE`.
