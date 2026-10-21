# NI-JUR.2–4 — pregătire independentă, dependențe blocate

Acest dosar derivat adaugă o decizie explicită pentru fiecare contradicție conservată, un index documentar cu limite probatorii și o vizualizare lizibilă individuală pentru toate cele 85 de roluri. Reutilizează originalele și generatorul integrate prin PR #399–#401, fără corpus paralel și fără reinterpretarea potrivirilor nominale drept certificări contemporane.

Raportul cuprinde 96 de decizii individuale pentru opt tipuri de contradicții, 19 înregistrări documentare și 85 de fișe Markdown, cu șase axe independente. `PASS` la explicarea unei diferențe de rol sau la dezambiguizarea unui nume are exclusiv domeniul precizat; toate cele 85 de verdicte privind controlul efectiv, apartenența juridică a întregului poligon și certificarea contemporană rămân `BLOCKED_EVIDENCE`. Organizarea de facto rămâne `UNRESOLVED`. Cazurile Bender, Hlinaia, Cremenciug, Lunga, Rîbnița și excepțiile Zonei de Securitate sunt păstrate distinct.

Indexul documentar păstrează câmpurile datate disponibile și `null` pentru cele necunoscute, hashul metadatelor, calea originalului verificat și limitele sursei. Cele 19 înregistrări nu reprezintă 19 acte distincte: includ copii și documente-anexă cu proveniențe separate. Nu certifică exhaustivitatea registrelor sau aplicabilitatea tuturor amendamentelor. Recuperarea HTTPS a originalului 48/2023 la 21 octombrie a eșuat; dovada accesului este conservată cu hash binar `null`.

Fișiere: `docs/evidence/ni-jur-review-20261021/review.json`, `individual/osm-r*.md` și `sha256-manifest.json`. Regenerare: `node scripts/audit/ni-independent-review.mjs --write`; verificare byte-identică pe surse curate: `--check`; zece probe negative: `--self-test`. Niciun original nu este reprodus inutil. Generatorul folosește clasificatorul binar existent inclusiv pentru Word/OLE; eșecul inițial și remedierea sunt conservate în registrul RM-026.

`PREPARED_BLOCKED_DEPENDENCIES`: OSM-FIX.2, NI-JUR.0 și NI-JUR.1 nu sunt acceptate formal. NI-JUR.2, NI-JUR.3 și NI-JUR.4 nu sunt declarate închise sau acceptate prin acest PR. Originalele lipsă, exhaustivitatea contemporană și controlul efectiv rămân blocaje independente, consemnate individual.

ACTUAL, părinții MD și geometriile publicate rămân protejate. `actual_mutation_allowed=false`, `p91_import_allowed=false`, `semantic_acceptance=BLOCKED_INCOMPLETE`. Nu se modifică OSM public, host-trust, pragurile de prospețime sau gate-urile.
