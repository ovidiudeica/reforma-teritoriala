# OSM-FIX.2 — reluare recursivă și sănătatea endpointurilor

RM-027: proba nouă reproduce pierderea unui sub-shard reușit când următoarea ramură este întreruptă. Fiecare subset validat este acum conservat imediat, separat de acoperirea shard-urilor finale. Restaurarea verifică SHA-ul, epoca, hashurile și închiderea reală. Un subset corupt sau o eroare de persistență oprește captura; nu declanșează un fallback care să mascheze eroarea. Acoperirea integrală și închiderea globală rămân obligatorii.

RM-028: endpointurile cu eșecuri consecutive păstrează un backoff exponențial între interogări, limitat la cinci minute și resetat după un răspuns valid. Se păstrează cererile secvențiale, Retry-After, cele două încercări per interogare și bugetul global. Regresiile includ HTTP 429/502/503/504, timeout, corp parțial, reluare, corupere și eșec de scriere. Logurile înainte/după și originalele sunt în `docs/evidence/osm-fix2/recursive-resume-20261021/`.

ENV-005 rămâne cu origine necunoscută: mesajul GitHub nu identifică motivul anulării. Durata observată este sub limitele configurate. Nu este demonstrat un timeout, un conflict de concurență sau o anulare umană. Persistența recursivă ajută la întreruperi controlate; oprirea abruptă a runnerului poate împiedica uploadul artefactului. Nu declarăm incidentul rezolvat prin această remediere.

API-ul oficial reverificat la 21 octombrie, 16:14–16:15 UTC, confirmă Horești v6 și Buneți v7. Way-ul Buneți 1376180731 este v6 din 10 aprilie 2026; v4 din 31 martie marchează configurația istorică citată anterior, nu versiunea live. Versiunile v5/v6 păstrează capetele v4. Răspunsul oficial `full` confirmă aceleași două noduri distincte de grad1, cu coordonate coincidente. Acest istoric nu probează o corecție upstream nouă. Propunerea pentru mapper rămâne cea existentă, fără alegerea arbitrară a unui nod și fără editare publică autorizată.

Captura veche, expirată, rămâne exclusiv dovadă istorică. Aceste remedieri nu acceptă o sursă nouă și nu închid OSM-FIX.2. ACTUAL, geometriile și părinții MD, host-trust, prospețimea și P9.1 rămân protejate. `semantic_acceptance=BLOCKED_INCOMPLETE`.
