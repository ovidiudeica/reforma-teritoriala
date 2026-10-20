# NI-JUR — conservarea independentă a dovezilor

Domeniu: arhivarea surselor și a verificărilor read-only pregătite în timpul blocajului OSM-FIX.2, fără acceptarea etapelor NI-JUR și fără promovarea sursei OSM curente. Baseline: main `54a4ed95c9c80edc7406cbb9c52fdf906a67b9cd`.

PR #398 rămâne Draft; gate-ul sursei este blocat de conectivitatea nodurilor OSM la Horești/Buneți. PR #394 păstrează inventarul distinct al celor 85 de roluri și opt contururi. Acest PR conservă probe independente pentru audit și reluare; nu înlocuiește niciunul dintre cele două PR-uri și nu declară NI-JUR.4 finalizat.

Nu se modifică ACTUAL, părinții MD, geometriile certificate, politicile runnerelor sau pragurile de prospețime. `actual_mutation_allowed=false`, `p91_import_allowed=false`, `semantic_acceptance=BLOCKED_INCOMPLETE`.

Stare inițială Draft: pachetul de dovezi și verificarea deterministă urmează în același PR. Nicio concluzie juridică pozitivă nu este autorizată prin simpla existență a unui poligon ori a unei potriviri nominale.
