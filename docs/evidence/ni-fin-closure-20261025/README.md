# Dovezi de închidere funcțională NI-FIN

Implementare acceptată: 6e6e3b1cc56168e52a0c1dd99af011d7ac87232e; PR #441, HEAD 77187a976e08659873342adf12deedff524e088e.

Originalele JSON sunt copiate byte-identic din verificările efectuate. Auditurile publicate: run 40196584156 (NI) și 40196586784 (matrice completă). Metadatele artifactelor păstrează identificatorii și digesturile GitHub. Cele două PNG sunt capturi reale reprezentative; restul capturilor rămân în artifactele referite, nu sunt pretinse încărcate aici.

Primul NI-FIN-published-tree-242.json este un FAIL autentic al harnessului: reveal() aliniază numai noduri deja vizibile, nu deschide părinții. Auditul v2 deschide explicit fiecare lanț de părinți prin controalele existente, apoi selectează toate cele 242 rânduri; PASS, fără modificări ale aplicației. Eșecul inițial este păstrat, nu reclasificat ca PASS.

CodeQL: zero alerte OPEN pe main; analizele pot include rezultate istorice deja clasificate. Nu s-au efectuat dismiss-uri în această intervenție. AX Chromium și viewporturile emulate nu certifică un cititor de ecran fizic sau dispozitive fizice.

Manifestul SHA-256 acoperă fiecare fișier al acestui director, exceptând manifestul însuși. Arhiva istorică OSM nu a fost recitită sau copiată.
