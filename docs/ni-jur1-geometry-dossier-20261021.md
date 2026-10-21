# NI-JUR.1 — dosar geometric independent pregătit

Stare: `PREPARED_BLOCKED_DEPENDENCIES`, fără acceptare formală și fără promovarea sursei OSM. PR #398 și PR #394 rămân dependențe de integrare.

Raportul reutilizează originalele și manifestele integrate prin PR #399–#401. Nu creează un corpus paralel. Domeniul este de 85 de roluri și opt contururi; comparația verifică toate cele 4.278 de perechi pentru fiecare captură conservată. Referința istorică rămâne 2026-10-12T20:21:35Z, SHA-256 `4ebd791fb953a22961e40ef7921914251c7b7292c33ed1e90e919488f1a397b8`.

Generatorul și verificarea deterministă păstrează distincte identitatea, versiunile, hashurile originalelor, fidelitatea segmentelor, topologia și diferențele dintre capturi. Fiecare captură are 93 relații, 453 way-uri și 9.732 noduri unice; fiecare dosar geometric include recensământul dependențelor proprii și hashul versiunilor acestora. Închiderea este strictă pe identitatea nodurilor, fără sudare prin coordonate. Cele 93 de versiuni, geometrii și seturi de versiuni ale dependențelor coincid între capturile conservate; diferențele octeților originali sunt raportate individual, fără rescrierea surselor.

Fiecare dintre cele 4.278 de perechi are un rezultat explicit pentru fiecare captură, inclusiv perechile cu anvelope disjuncte. Cele 340 de frontiere comune sunt calculate prin intersecție directă a frontierelor, cu verificarea exactă a acoperirii segmentelor pe ambele geometrii, fără snapping. Se conservă numărul segmentelor, hashul liniilor și lungimea calculată prin politica metrică existentă. Perechile și frontierele coincid între capturi; zero suprapuneri sau duplicate egale. Frontierele comune sunt relații geometrice, fără atribuiri juridice. Capturile originale nu sunt un snapshot atomic nou și nu certifică exhaustivitatea registrului juridic contemporan.

Raport: `docs/evidence/ni-jur1-geometry-20261021/dossier.json`, manifest SHA-256 alături. Regenerare: `node scripts/audit/ni-jur1-geometry.mjs --write`. Verificare byte-identică pe surse curate: `node scripts/audit/ni-jur1-geometry.mjs --check`. Nouă probe negative: `node scripts/audit/ni-jur1-geometry.mjs --self-test`. CI execută această verificare împreună cu replay-urile și validatoarele deja integrate și păstrează verdictul pregătirii pe SHA-ul exact.

ACTUAL, părinții juridici MD, geometriile publicate, politica host-trust și pragurile de prospețime rămân nemodificate. `actual_mutation_allowed=false`, `p91_import_allowed=false`, `semantic_acceptance=BLOCKED_INCOMPLETE`.
