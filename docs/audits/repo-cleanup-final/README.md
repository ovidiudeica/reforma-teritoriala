# CLEANUP FINAL — registru probatoriu

Stare: **IN_PROGRESS**. Acesta este baseline-ul și registrul de lucru C0–C9, nu o certificare finală. ACTUAL este înghețat; P9.1 nu este autorizat. Nu au fost eliminate fișiere de produs, surse sau dovezi în această etapă.

## Baseline C0

Commit: `656bf2165d58efcbb3443aa70d56c313990d1b67`. Starea GitHub a fost recitită, fără a presupune că PR-urile istorice au rămas neschimbate.

| Măsură | Baseline observat |
| --- | ---: |
| Fișiere urmărite | 3.464 |
| Octeți logici ai bloburilor Git | 526.591.283 |
| Grupuri de bloburi identice / apariții | 20 / 58 |
| Fișiere protejate în comparația de cleanup | 478 |
| Resurse runtime / GeoJSON | 440 / 125 |
| Octeți ai resurselor runtime | 278.001.389 |
| Lungimea fișierelor checkoutului, fără `.git` | 546.803.888 |
| Lungimea fișierelor `.git`, după fetchul inițial | 299.311.118 |

`c0-tree.json.gz` conține calea, modul, dimensiunea, Git blob SHA și SHA-256 pentru fiecare fișier. Hashurile sunt calculate din **bloburile canonice Git**, inclusiv fișierele mari și binare, fără conversia CRLF a checkoutului Windows. `c0-protected.json` și `c0-runtime.json` fixează seturile comparate. Măsurătorile `.git` și checkout sunt observații ale mediului, nu spațiu alocat pe disc; istoricul complet recuperat ulterior poate mări `.git` fără schimbarea produsului.

`branch-protection.json` este răspunsul administrativ efectiv: șase contexte obligatorii, strict mode și enforce admins active. Configurația Pages observată este `main` / rădăcină, HTTPS activ. Dovezile sunt în `c0-github-state.json`, `pages-config.json` și `pr491-ci.json`.

## C1 — audituri anterioare

PR #491 a fost verificat pe `ecbc324c9828950e056867b3783b327e39a77088`, trecut Ready și integrat ca `8c8cb123c0e8c363268886aba863131e33f3e1a4`. Cele 19 verificări executate au reușit; două ramuri condiționale ale gate-ului CHANGE erau neaplicabile conform workflow-ului existent, nu teste eliminate de cleanup. Artefactul final al grafului a fost recuperat de la run `41239515359`, artifact `13057216032`; digestul este în `c2-provenance.json`.

În verificarea push post-merge, un runner cu profil neaprobat (`20261018.96.1`, KVM) a fost respins de gate-ul host trust. Nu s-a schimbat lista aprobată; verificarea eșuată a fost reluată pe același SHA. Rezultatul terminal după reluare: **25/25 checks și 17/17 runs reușite**, inclusiv probele A/B, compararea lor și deploymentul Pages. Incidentul și răspunsurile integrale sunt păstrate în dovezile `c1-*`.

PR #490 păstrează cele trei documente inițiale ale inventarului, complementare celor din #491. Branchul a fost actualizat prin merge normal cu `main`, fără rebase/force push; SHA-ul nou `e403833eaafbc3c6a318caad4ab90df45674153c` a trecut cele 19 verificări executate și toate cele 15 workflow-uri. A fost trecut Ready și integrat cu verificarea head SHA, ca `0716b1b9bada1a8390511d02f03bbeceb8b17922`; controalele post-merge sunt încă în execuție. `c1-integrity.json` confirmă identitatea tuturor celor **478 de fișiere protejate și 440 de resurse runtime**, atât Git blob SHA, cât și SHA-256, la acest commit.

## C2 — registru per-fișier și matrice

Snapshot analizat: `8c8cb123c0e8c363268886aba863131e33f3e1a4`, **3.468 fișiere**. Registrul și matricea sunt comprimate lossless pentru a evita versionarea a peste 19 MB de CSV/JSON derivat:

- `c2-per-file.csv.gz`: rol, clasificare, referințe directe/istorice, posibilități dinamice, rădăcină operațională, necesitate probatorie, regenerare și decizie pentru fiecare fișier;
- `c2-dependencies.csv.gz`: fiecare muchie, sursa, ținta și tipul; importurile relative sunt distincte de simplele mențiuni;
- `c2-dynamic-readers.json.gz`: cititori/interpolări care necesită păstrare sau analiză umană;
- `c2-258-reconciliation.csv`: decizia pentru fiecare dintre cei 258 de candidați ai artefactului #491;
- `c2-summary.json`, `c2-provenance.json`, `c2-uncompressed-SHA256SUMS`: dimensiuni, limitări, identitatea analizorului și hashurile produselor necomprimate.

Toate cele zece etichete cerute sunt acceptate de analizor. Nicio etichetă `SAFE_TO_DELETE` nu este dedusă din lipsa referințelor. Clasificările `KEEP_*` stabilesc păstrarea conservatoare; nu pretind că fiecare expresie dinamică a fost rezolvată. Prototipul P5 are importuri relative reale și rămâne `ARCHIVE_CANDIDATE`, păstrat pe calea originală. Placeholder-ele ISTORIC/PROPUNERI rămân `KEEP_FUTURE_MODULE`. Schemele, configurațiile implicite GitHub, testele descoperite prin glob și uneltele de reproducere sunt păstrate.

Reproducere, într-o clonă cu commitul snapshotului disponibil:

```sh
python scripts/audit/test_cleanup_file_usage.py
python scripts/audit/cleanup-file-usage.py \
  --ref 8c8cb123c0e8c363268886aba863131e33f3e1a4 \
  --baseline docs/audits/repo-cleanup-final/c0-protected.json \
  --out outputs/cleanup-final/replay
```

Compară `SHA256SUMS` rezultat cu `c2-uncompressed-SHA256SUMS`. Pentru o versiune nouă folosește `--ref HEAD`; diferențele față de snapshotul istoric sunt normale și trebuie examinate. Graful acoperă importuri JS literale/dinamice literale, module Python locale, căi shell/npm/YAML/HTML/CSS, manifeste, directoare/globuri și rădăcini operaționale. Expresiile calculate arbitrar, răspunsurile de rețea și consumatorii externi nu pot fi dovediți exhaustiv prin analiză statică. Aceste limite impun păstrarea, nu ștergerea.

## C5 — branchuri și PR #398

`branches.json` folosește istoria completă, nu o clonă shallow. `branch-per-file.csv.gz` inventariază modificările fiecărui branch față de strămoșul comun și verifică dacă blobul există undeva în `main`. Branchurile Dependabot sunt active și se actualizează automat; nu se șterg. Branchurile RT neintegrate păstrează dovezi exclusive și sunt `PRESERVE_EVIDENCE`. Eliminarea unui branch cere o nouă verificare a referinței, PR-urilor și consumatorilor, imediat înainte de operațiune.

PR #398, head `027d66f6f08296fd9006938a010f8e18265aca36`, are **199 de fișiere modificate față de merge-base**, 44 de commituri proprii și modificări funcționale ale achiziției/reconcilierii OSM, politicilor de tranziție, workflow-urilor și testelor. Nu este un duplicat administrativ. Registrul per-fișier păstrează identificatorii și diferențele de blob pentru toate fișierele. Decizie: **păstrat Draft pentru procesare separată**, fără integrarea automată a surselor/politicilor ACTUAL și fără închidere în cleanup. Numărul de bloburi exclusive din întregul său arbore poate depăși cele 199 de fișiere ale diff-ului: include versiuni vechi ale fișierelor comune, nu numai adăugiri ale PR-ului.

## C8 — observații inițiale de securitate

Snapshotul alertelor GitHub: zero alerte Dependabot deschise, zero alerte CodeQL deschise. Cele cinci alerte secret-scanning deschise indică recepise istorice de descărcare Anaconda, cu URL-uri semnate S3 temporare. `download-receipts-security.json` arată expirarea URL-urilor la 24 octombrie, fără publicarea valorilor credentialelor și fără reutilizarea acestora. Starea alertelor rămâne explicit deschisă; expirarea URL-ului nu este o pretinsă dovadă că o credențială deținută de un terț a fost revocată. Dovezile originale nu au fost șterse sau rescrise. Certificarea finală cere și verificările C8/C9 ulterioare.

## Registru și verdict

Vezi `progress.json` și registrul central `docs/roadmap/autonomous-completion-register.json`. C3–C9 nu sunt certificate prin acest raport intermediar. Verdictul final rămâne **PENDING**, până la verificarea tuturor criteriilor obligatorii. `sha256-manifest.json` fixează dovezile acestui snapshot; nu este un manifest ACTUAL și nu modifică manifestele canonice ale produsului.
