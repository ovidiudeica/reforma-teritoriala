# WEB-R2c.3.2 — domeniu și gate-uri

Predecesor acceptat: WEB-R2c.3.1, PR #391, `main@ad5073041d582cae9caa6f031684ffd0a427d938`; 13 workflow-uri și 20 verificări post-merge PASS, Pages și cele 32 componente ACTUAL verificate.

Această etapă verifică regresiile Chromium pentru desktop, tabletă, mobil portrait/landscape, text mărit 200%, zoom nativ al browserului, forced-colors, focus/nume accesibile, ținte tactile, filtre OSM/statistice, confirmare/anulare/Undo, History/URL, căutare/carduri, panouri, fundal OSM și resurse/erori. Capturile stărilor critice se inspectează efectiv. Arborele și geometriile păstrează independența aprobată.

Orice defect reproductibil intră în `docs/roadmap-issue-register.json`, primește remediere și regresie și rămâne deschis până la retestare. Nu se declară PASS pentru cititoare de ecran fizic indisponibile; arborele de accesibilitate Chromium este o probă distinctă.

Integrarea necesită toate gate-urile obligatorii pe head-ul exact, capturi inspectate, audit de securitate/diff, apoi CI și Pages post-merge. ACTUAL, părinții juridici MD și geometriile rămân nemodificate, P9.1 blocat, `semantic_acceptance=BLOCKED_INCOMPLETE`.

Stare: audit în curs, fără acceptare anticipată.
