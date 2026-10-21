# NI — acoperirea dependențelor și dosarul curent pregătitor

Baseline: main `66a915b27a8ab8168df624749dc6d937295576af`, după integrarea independentă a PR #399. Auditul post-merge este urmărit separat; acest PR începe Draft.

Problema: workflow-ul NI folosește biblioteci de topologie, transport și proveniență fără a declara toate aceste dependențe în filtrele de declanșare. Modificarea izolată a unei biblioteci poate omite replay-ul NI specific. Remedierea extinde selecția fișierelor; nu reduce testele, permisiunile sau contractele de acceptare.

În același domeniu de conservare independentă, pachetul pregătitor curent va păstra recapturarea din21octombrie2026 și generatorul individual determinist pentru85de roluri, cu cinci axe și control efectiv separat. Originalele istorice rămân intacte; nu se modifică poligoane ori identități ACTUAL. Dovezile curente sunt distincte de promovarea globală a sursei OSM.

OSM-FIX.2 rămâne blocat de Horești/Buneți. NI-JUR.0–4 nu primesște acceptare prin integrarea acestui PR. Issue #396 rămâne OPEN. `actual_mutation_allowed=false`, `p91_import_allowed=false`, `semantic_acceptance=BLOCKED_INCOMPLETE`.
