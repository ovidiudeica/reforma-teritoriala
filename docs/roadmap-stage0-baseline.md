# Roadmap — etapa 0, baseline după #389

Baseline verificat: `3471f7b1231e435f51e3ad719aa0a4a1786a5e79`. Data accesării: 2026-10-19. Domeniu: integritatea baseline-ului și a instrumentării. Etapele WEB-R2c.3.1–NI-JUR.4 nu sunt declarate acceptate prin acest raport.

## Dovezi

- Main corespunde bazei solicitate; #389 este integrat în acel SHA.
- 12/12 workflow-uri post-merge și 19/19 check-runs sunt success pe baseline, inclusiv cele șase contexte obligatorii. [Rulări pentru SHA](https://github.com/ovidiudeica/reforma-teritoriala/actions?query=branch%3Amain).
- Pages răspunde HTTP 200. Aceasta confirmă disponibilitatea, nu acceptarea E2E WEB-R2c.4.
- Verificare locală directă: 3.246 RO + 2.602 MD = 5.848 identități publice; hashul fișierului `actual-entities.json` corespunde manifestului: `014ce7ad76c20f07de64f5ed3db0debcd676db78c25e25cd3abefe98fcfe5700`.
- Snapshot `actual-a9e5a4ddcb5277ef`; fingerprint `a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446`.
- Grupări: Camenca 13, Rîbnița 23, Dubăsari 10, Grigoriopol 16, Tiraspol 3, Slobozia 16, Bender 4; 85 roluri distincte reutilizate. Benchmarkul Chromium validează 8 contururi încărcate, fără identități ACTUAL noi.
- `actual_mutation_allowed=false`, `p91_import_allowed=false`, `semantic_acceptance=BLOCKED_INCOMPLETE`.
- `node scripts/audit/p907219-acceptance-dossier.mjs --audit` și `--self-test`: PASS, `CARTOGRAPHIC_PASS_LEGAL_DENIED`. Este verificare offline a lanțului istoric; nu recertifică OSM contemporan, topologia sau controlul efectiv.
- `node --test scripts/test/actual-p9-jurisdiction-gate.test.mjs`: 11 PASS, zero SKIP/TODO.

## Chromium și limitele măsurătorilor

[Benchmark baseline Actions 39322322172](https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/39322322172): PASS, Chrome/155.0.8059.39. Cinci încărcări desktop și cinci mobil; o încărcare tabletă și una landscape. Zero erori HTTP proprii și zero cereri geometrice repetate în rezumatele scenariilor. Există cinci evenimente externe eșuate într-un eșantion; clasificarea completă a acestora rămâne de investigat în hardening, nu se confundă cu zero eșecuri de rețea.

| Scenariu | p50 ms | p95 ms | n |
|---|---:|---:|---:|
| Desktop încărcare rece | 323,5 | 1011,9 | 5 |
| Mobil încărcare rece | 322,9 | 330,78 | 5 |
| Desktop filtru 8 | 68,6 | 87,1 | 5 |
| Desktop filtru 9 | 48,1 | 73,94 | 5 |
| Mobil filtru 8 | 67,7 | 69,42 | 5 |
| Mobil filtru 9 | 48,1 | 71,76 | 5 |

Latența include două requestAnimationFrame; History are și așteptări funcționale ulterioare, deci timpul raportat de acțiune nu echivalează cu durata completă a restaurării. Nu există un prag aprobat sau o comparație pre/post care să demonstreze o regresie. Nu se autorizează optimizări doar din aceste numere.

Capturile `desktop-after.png` și `mobile-portrait-after.png` din artifact au fost inspectate vizual: harta, contururile, comenzile și navigarea sunt vizibile. Aceste două stări nu constituie matricea exhaustivă înainte/după. Scale factor 2 din script este pinch zoom și nu substituie browser text zoom 200%. Warm cache, repetări complete tabletă/landscape, scenarii combinate și analiza longitudinală a memoriei rămân gate-uri ale etapelor următoare.

Rularea locală sandbox a eșuat la CDP Page.enable înainte de primul eșantion; retestarea cu acces la conexiunile locale a trecut în Chrome/155.0.8059.80. Nu se compară p95 local și CI ca medii echivalente. Hashurile text au fost inițial afectate de checkout CRLF; restaurarea octeților din Git a permis auditul fără schimbarea hashurilor acceptate.

## Remediere și reproducere

Defectul RM-001: `sourceMain` era hardcodat la SHA-ul pre-#389. Acum citește `git rev-parse HEAD`, validează SHA complet, iar workflow-ul verifică egalitatea rezultatului cu commitul testat. La PR, benchmarkul face checkout explicit al head SHA. Report schema și scenariile existente rămân compatibile. Retestările sunt arhivate ca artifact Actions; raportul inițial rămâne dovadă istorică etichetată cu această limită.

PR-ul nu modifică aplicația, datele, geometriile, relațiile juridice sau autorizațiile. Registrul unic inițial este `docs/roadmap-issue-register.json`. Nicio etapă dependentă nu trebuie marcată completă înainte de acceptarea etapei precedente. P9.1 rămâne blocat.
