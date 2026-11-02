# Acceptarea publicată după NI-TREE.2

Succesorul `scripts/audit/web-r2c5-ni-tree2-browser.mjs` verifică organizarea deja integrată în `main@35d25d38182bd8453a7bd9ba1819e4ed842eebb5`. Nu schimbă aplicația, geometriile, identitățile, cardurile sau politica de promovare.

Scriptul istoric `web-r2c32-hardening-browser.mjs` și dosarul `docs/evidence/navigation-failure-20261023` rămân neschimbate. SHA-256 istoric: `75677ebbc66e7bf1b0335b4148c0c8e31d9c13f9e0759e0cd8627436413be1f4`. Workflow-ul verifică în continuare manifestul și toate cele cinci surse istorice; nu se înlocuiesc hashuri pentru a admite cod nou.

Contractul succesor este `NI-TREE.2/published-acceptance-v1`, în `scripts/audit/helpers/ni-tree2-acceptance-contract.mjs`.

| Scenariu | Contract curent verificat |
|---|---|
| Pornire | numai RO/MD, două rădăcini ACTUAL, zero contururi NI active |
| Arbore | Nistrenia este primul copil al Moldovei; șapte grupuri, opt contururi disponibile |
| Selecție | nu activează geometrii |
| Bife individuale | fiecare dintre cele opt contururi se comută independent și se restabilește |
| Nivel OSM 5 | activare explicită a șapte grupuri; conturul general nu este implicit adăugat |
| Jurisdicție NI | activată explicit; filtrarea jurisdicției nu schimbă bifele geometriilor |
| Undo și anulare | revin la mulțimea inițială goală; 12 anulări rapide rămân fără efect |
| Back / Forward | zero / șapte contururi; sunt verificate și ID-urile, nu doar numărul |
| URL complet | păstrează cele șapte grupuri, selecția și geometriile ACTUAL |
| Contur general | se bifează separat: șapte plus unu înseamnă opt; debifarea restabilește cele șapte |
| Link doar către entitate | păstrează identitatea selectată, cu vizibilitatea implicită; nu este confundat cu URL-ul întregii vizualizări |
| Resetări | geometria revine la RO/MD și zero NI; selecția și filtrele rămân independente |

Succesorul păstrează verificările istorice de contrast, focus, Escape, ținte de 44 px, lipsă overflow, filtre statistice, comenzi colective, Undo, istoric, căutare, fundal OSM, forced-colors, reduced-motion, erori de rețea și zoom nativ 200%. Rulează pe desktop, tabletă, mobil și landscape. Nu se transformă eșecurile în SKIPPED și nu se activează geometrii pentru a satisface vechiul contract.

Reproducere:

```text
node --test scripts/test/ni-tree2-published-contract.test.mjs scripts/test/ni-tree2.test.mjs scripts/test/frontend-navigation-failure-evidence.test.mjs scripts/test/frontend-performance-navigation.test.mjs
ATLAS_HARDENING_MODE=published node scripts/audit/web-r2c5-ni-tree2-browser.mjs
```

În PR, sursele publicate sunt comparate cu checkout-ul SHA-ului exact al bazei, iar auditorul este identificat separat prin SHA-ul PR-ului. Raportul este în `outputs/web-r2c5-published/report.json`; capturile și diagnosticele sunt artefacte CI. Admiterea finală cere `PASS`, surse urmărite curate, inventar runtime complet și ID-ul exact al contractului succesor.

Integrarea acestui PR necesită autorizare explicită. Succesul său nu recertifică automat SHA-urile PR-urilor #501/#502 și nu autorizează modificări ACTUAL sau P9.1b.
