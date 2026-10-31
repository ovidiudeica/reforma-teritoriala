# Acceptarea lansării funcționale ACTUAL

**READY pentru domeniul ACTUAL declarat, cu amânările explicite.** Versiunea publicată acceptată este `45f497093897a8995c6777ccadd53a1f89e9985d`, PR [#488](https://github.com/ovidiudeica/reforma-teritoriala/pull/488), head testat `1832047d05ea108b5c84a0a2e1aa17ce28ae9e3c`.

24/24 checks și 17/17 workflow-uri PR reușite. După merge: 12 workflow-uri push, CodeQL și Pages reușite; patru rulări Dependabot sunt păstrate separat în registru, fără a substitui controalele produsului. Auditul [Pages 41232324618](https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/41232324618) a verificat exact commitul integrat: **440 resurse, 125 GeoJSON, 278.001.285 octeți**, 69 înregistrări de verificare și zero erori de aplicație. Toate cele 27 de check-runs și 19 rulări observate pe acest SHA sunt reușite, inclusiv auditul publicat și cele patru rulări Dependabot.

`published-ci-report.json.gz` păstrează integral raportul CI original, comprimat determinist; manifestul include și SHA-256 al raportului decomprimat. `acceptance.json` leagă fiecare check/run de head-ul exact, merge și artifactul GitHub, inclusiv digestul publicat de GitHub. Capturile desktop/mobil provin din website-ul integrat. Auditul npm a raportat zero vulnerabilități; aceasta nu garantează absența vulnerabilităților necunoscute.

## Acoperire și domeniu amânat

`report.json` și registrele per-ID provin exclusiv din cataloagele deja acceptate, fără inventarierea geometriilor OSMB sau investigarea AUTO-4:

- 5.848 înregistrări publice: 3.246 RO / 2.602 MD; 18 sunt statistice separate, nu UAT-uri juridice noi.
- 13.755 localități componente SIRUTA nu au fișă cu același ID oficial în ACTUAL (`ro-component-localities.csv`).
- 102 înregistrări CUATM nu au legătură directă `legal.id` în corpusul MD (`md-without-direct-binding.csv`); lipsa legăturii nu dovedește absență geometrică sau lipsa unui rezultat cu același nume.
- 242 noduri documentare NI: 8 au contur propriu, 97 numai candidați și 137 fără dovezi geometrice. Cele 234 fără contur propriu acceptat sunt enumerate în `ni-without-own-geometry.json`; 85 de roluri geometrice ACTUAL nu sunt convertite în identități documentare.
- ISTORIC este amânat integral până la primul corpus propriu de epoci, unități, geometrie și ierarhii. Versiunile istorice ale OSM nu îl înlocuiesc. PROPUNERI, engleză, indicatori temporali și KML/KMZ sunt livrări ulterioare.

Cele 109 AUTO-4 rămân REVIEW_REQUIRED. CAPTCHA RNONG și documentele normative inaccesibile rămân dependențe externe. Nu sunt criterii de blocare a acestei lansări. Nu se modifică ACTUAL și nu se autorizează P9.1.

## Reproducere

`python scripts/audit/product-launch-evidence-guard.py` verifică hashurile, legăturile CI/publicare și regenerează cele patru artefacte de acoperire pentru comparație byte-for-byte. Reproducerul citește octeții comiși prin Git, evitând conversiile CRLF locale. Scrie numai în `outputs/product-launch-coverage`; nu construiește, importă sau atribuie geometrii/identități.

Această admitere nu certifică toate limitele juridice, dispozitive mobile fizice sau conformitate WCAG integrală. CI Chromium acoperă desktop, mobil, tabletă, landscape și text zoom nativ 200%; capturile sunt dovezi vizuale suplimentare. Politicile de publicare și verificările obligatorii rămân neschimbate. Un PR ulterior exclusiv de dovezi/roadmap necesită propriile verificări CI înainte și după merge.
