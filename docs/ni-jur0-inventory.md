# NI-JUR.0 — inventarul individual al rolurilor Nistreniei

Baseline acceptat: `main@1a6107594438d752e793df5dd57aed96272d4474`, WEB-R2c.4 / PR #393 CLOSED_PASS. CI post-merge: 14 workflow-uri / 21 checks PASS, fără omiteri; Pages și audit public exact pe același SHA, 435 resurse cu hash potrivit, 125 GeoJSON, 52 capturi inspectate.

Domeniu: registru descriptiv separat pentru opt contururi operaționale OSM și 85 de roluri care reutilizează identitățile/geometriile ACTUAL existente. Grupările geometrice de verificat sunt Camenca 13, Rîbnița 23, Dubăsari 10, Grigoriopol 16, Tiraspol 3, Slobozia 16 și Bender 4. Nu se deduce apartenența administrativă revendicată sau juridică din geometrie.

Fiecare rând va păstra ID-ul ACTUAL, relația OSM, numele și aliasurile documentate, rolul/nivelul OSM, părintele geometric, părintele juridic MD exact din corpusul protejat, revendicările istorice distincte, versiunile/datele surselor, contradicțiile și starea verificării. Identificatorii omonimi Bender și Hlinaia rămân distincți. Lipsa unei probe contemporane se consemnează explicit; verificarea OSM live aparține NI-JUR.1, iar adjudecarea documentară NI-JUR.2–3.

Livrabile: matrice JSON individuală, manifest SHA-256, generator determinist și validare automată cu probe negative. Nu se modifică ACTUAL, părinții MD, geometriile, politicile de promovare sau website-ul. `actual_mutation_allowed=false`, `p91_import_allowed=false`, `semantic_acceptance=BLOCKED_INCOMPLETE`.

Stare: audit read-only în curs; acceptarea NI-JUR.0 necesită registrul complet, verificările pe head-ul exact și auditul post-merge. Etapele dependente nu au început.
