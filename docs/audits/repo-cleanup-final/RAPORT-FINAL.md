# Reforma Teritorială — certificarea cleanup-ului

Verdict pentru versiunea funcțională și infrastructura verificate: **CLEANUP_ACCEPTED_WITH_DOCUMENTED_EXCEPTIONS**. Commit de bază: `656bf2165d58efcbb3443aa70d56c313990d1b67`. Commitul core final testat: `ce14dd73f223b32ad9a9149314ba75379a6a2018`. Această închidere este documentară; propria integrare trebuie să treacă aceleași verificări obligatorii, controalele post-merge și verificarea publicării, fără a pretinde anticipat rezultatele lor. Recepisa finală identifică SHA-ul efectiv al integrării documentare.

ACTUAL rămâne înghețat. Nu s-au schimbat geometrii, identități, relații părinte–copil, surse protejate, manifestele canonice sau fingerprinturile acceptate. P9.1 nu este autorizat. Inventarele de 6.129 geometrii, 298 excepții și cele 109 cazuri AUTO-4 nu au fost repetate.

## 1. Starea inițială și finală

| Măsurătoare | Baseline `656bf216` | Core final `ce14dd73` |
| --- | ---: | ---: |
| Fișiere urmărite | 3.464 | 3.546 |
| Octeți logici ai arborelui Git | 526.591.283 | 529.340.072 |
| Fișiere existente eliminate | — | 1, gol |
| Fișiere existente modificate | — | 8 |
| Fișiere originale păstrate identic | — | 3455 |
| Fișiere noi, predominant dovezi și registre | — | 83 |
| Relocări în arborele Git | — | 0 |
| Resurse runtime | 440 | 440 |
| Resurse GeoJSON | 125 | 125 |
| Octeți runtime | 278.001.389 | 278.001.389 |
| Lungimea fișierelor din `.git` | 299.311.118 | 380.245.850 |
| Lungimea fișierelor pack, separat | 278.484.243 | 357.174.929 |
| Checkout, fără `.git`, inclusiv rezultate locale | 546.803.888 | 531.131.322 |

Măsurătorile Git/checkout reprezintă lungimi de fișiere, nu blocuri alocate. Istoria completă, referințele de audit și tagurile recuperate explică o parte a creșterii `.git`; nu s-au rulat GC, rescrieri de istorie sau migrare LFS. Registrele noi adaugă intenționat dovezi comprimate lossless. Ștergerea unui fișier gol nu economisește conținut de blob. Copiile identice din Git sunt deja deduplicate; nu se pretinde economie egală cu suma aparițiilor.

Cele 41 de rezultate locale neversionate, 18.446.389 octeți, au fost păstrate în afara clonei și verificate prin SHA-256 înainte/după mutare. Aceasta nu este ștergere de dovezi sau reducere a arborelui Git. Măsurarea finală Windows include explicit căile extinse pentru toate dovezile cu nume lungi. Fișierele acestui PR documentar se adaugă măsurătorii core; recepisa post-merge furnizează măsurarea SHA-ului final, fără referință circulară la propriul commit.

## 2. Modificările executate

- C1: #491 și #490 au fost verificate pe SHA exact, trecute Ready, integrate și verificate post-merge; cele trei documente complementare ale inventarului inițial au fost conservate.
- C2/C4: graf per-fișier cu referințe directe, indirecte, relative, globuri, registre, consumatori dinamici și necesitate probatorie; reconcilierea celor 258 de candidați; README cu instalare, structură, publicare și reguli ACTUAL. Fără mutări masive.
- Portabilitate: emitere LF explicită și replay `legacy-crlf`, păstrând sursa și toate cele cinci produse probatorii originale byte-identic; regresii pe Windows și Linux.
- C3: eliminat exclusiv `scripts/process/.gitkeep`, 0 octeți, din directorul cu 71 de module păstrate. Adăugate numai regulile pentru cache Python regenerabil. Placeholder-ele modulelor viitoare și `data/current/.gitkeep` protejat sunt păstrate.
- C5: toate branchurile clasificate pe istorie completă, divergență și bloburi exclusive. Branchurile de cleanup integrate au fost eliminate automat de politica GitHub; cele cu dovezi exclusive și Dependabot sunt păstrate.
- C6: aceeași suită integrală rulează o dată automat; comenzile specifice P8.2/P8.4 rămân în joburi dedicate. Contextul obligatoriu `frontend-browser-qa` respinge eșec, anulare, omisiune, rezultat absent sau invalid în oricare dintre cele patru joburi. Reproducerile manuale păstrează corpurile originale și artefactele.
- C8: ultimele două referințe Actions mutabile sunt fixate la SHA-urile oficiale rezolvate; inventar read-only al semnăturilor credentialelor și regresii de redacție, fără eliminarea recepiselor originale ori închiderea artificială a alertelor.

Nicio etichetă SAFE_TO_DELETE nu a fost dedusă doar din lipsa importurilor, vechime, dimensiune sau duplicare. Prototipurile, sursele, auditurile istorice și dependențele dinamice neelucidate sunt păstrate cu decizie explicită. Nu rămâne un fișier demonstrat dispensabil fără decizie; candidații conservatori nu sunt transformați artificial în fișiere dispensabile.

## 3. PR-uri și SHA-uri integrate

| PR | Head testat | Merge efectiv |
| --- | --- | --- |
| [491](https://github.com/ovidiudeica/reforma-teritoriala/pull/491) | `ecbc324c9828950e056867b3783b327e39a77088` | `8c8cb123c0e8c363268886aba863131e33f3e1a4` |
| [490](https://github.com/ovidiudeica/reforma-teritoriala/pull/490) | `e403833eaafbc3c6a318caad4ab90df45674153c` | `0716b1b9bada1a8390511d02f03bbeceb8b17922` |
| [492](https://github.com/ovidiudeica/reforma-teritoriala/pull/492) | `85a2224a1ab96632f94912246395972ed0bb418c` | `65bb8267afe3964971ba402d78d4021b14cc8141` |
| [493](https://github.com/ovidiudeica/reforma-teritoriala/pull/493) | `6c93855e0d5782c2b9ffa5deffc82ebd1ed69cfe` | `7162aee271936d628b2501c7bfeedd3db9f59798` |
| [494](https://github.com/ovidiudeica/reforma-teritoriala/pull/494) | `0041d36a177897d35820f41fafddd957e551ecc0` | `66a34d1d231c1296b44c84e688c62cc74b670ed5` |
| [495](https://github.com/ovidiudeica/reforma-teritoriala/pull/495) | `3651aeda5b900d50f6dda9c1550793c9550ff392` | `eee441d06c871151523f4c851b28545e4a51c2e5` |
| [496](https://github.com/ovidiudeica/reforma-teritoriala/pull/496) | `38bc80c0a38256d97e020b6f946be2340096f8de` | `ce14dd73f223b32ad9a9149314ba75379a6a2018` |

Merge-urile au folosit `expected_head_sha`; nu s-au ocolit protecțiile. Strict mode, enforce admins și cele șase contexte obligatorii sunt identice cu C0. CI exact-head și post-merge sunt inventariate în recepisele individuale; nu sunt deduse numai din statusul general al PR-ului.

## 4. CI, performanță și reproductibilitate

#496: 21 verificări executate și 13 workflow-uri reușite pe head-ul exact; cele două ramuri CHANGE condiționale existente au fost neaplicabile, fără omisiuni în suita integrală. După integrarea `ce14dd73f223b32ad9a9149314ba75379a6a2018`: **28 checks executate și 16 rulări reușite**, cu stările exacte în `c8-post-admission.json`. #495: 28/28 checks și 16/16 rulări post-merge reușite. Recepisele păstrează separat joburile, trigger-ele și eventualele ramuri condiționale, fără a raporta SKIPPED drept succes.

Runnerul Linux și toate cele 132 de fișiere originale au hashuri identice cu baseline-ul. Raportul efectiv confirmă 1.074 teste trecute, 0 eșecuri, 0 anulate și 0 omise. Separat, cele 22 de regresii ale rollup-ului, cele două regresii de redacție și cele patru regresii Python ale analizorului sunt executate în pașii lor; nu sunt adunate peste suite suprapuse pentru un total artificial.

Consolidarea reduce de la două la una invocările automate identice ale runnerului. Baseline-ul observat avea pași integrali de 814 și 894 secunde; #495 a avut 914,209 secunde în PR și 748,304 secunde post-merge. Acestea sunt observații de durată pe runner, influențate de host și coadă, nu estimări CPU/facturare sau promisiuni procentuale.

Clona HTTPS nouă, cu `git clone -c core.autocrlf=false -c core.longpaths=true`, a fost verificată pentru toate bloburile de pe disc. Instalarea offline a 185 de pachete a reușit cu registry/proxy `127.0.0.1:9`, cache gol și scripturi de instalare dezactivate. Verificările locale Chrome au trecut 6/6; Linux/OCI și gate-urile ACTUAL sunt admise separat prin CI, fără a pretinde că Windows reproduce singur mediul OCI aprobat. Aplicația este statică, fără bundler frontend obligatoriu.

## 5. ACTUAL și publicarea

Toate cele 478 de fișiere protejate și cele 440 de resurse runtime au aceeași cale, mod Git, lungime, Git blob SHA și SHA-256 ca la C0. Compararea păstrează și geometriile/ierarhiile originale; nu este un nou audit juridic.

Fingerprint semantic ACTUAL: `a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446`. Snapshot: `actual-a9e5a4ddcb5277ef`. Fingerprintul runtime, din liniile sortate `cale TAB octeți TAB SHA-256 LF`, este `c8952e27c8680aef43f82b7f9691eaab162758ccd079d27fbde9fa7de547d502`.

Pages publică din `main`, rădăcină, HTTPS. Markerul unic C8 și raportul workflow-ului 41268767153 confirmă versiunea exactă `ce14dd73f223b32ad9a9149314ba75379a6a2018`. Toate cele 440 de resurse au fost descărcate și comparate prin SHA-256, inclusiv 125 GeoJSON. `c7-pages-artifact-observations.json` separă dimensiunea ZIP oficială a artefactelor Pages de dimensiunea logică runtime și distinge digestul raportat de GitHub de verificarea independentă HTTPS.

Website-ul publicat a trecut verificările Chromium pentru desktop, tabletă, mobil, landscape și zoom nativ 200%, rețea/consolă, căutare, filtre, selecție, resetări independente, contrast și confirmări. Fiecare raport are 53 de verificări afirmative și 16 înregistrări de diagnostic separate; diagnosticele nu sunt contabilizate drept teste trecute. Sunt păstrate 52 de capturi. Viewporturile mobile în Chromium nu reprezintă testare pe telefoane fizice sau certificare cu cititor de ecran.

## 6. Securitate

Zero vulnerabilități npm și zero alerte Dependabot/CodeQL deschise la observația datată. Cele 80 de definiții workflow conțin 210 declarații `uses` fixate la commit/digest sau locale, fără referințe externe mutabile. Scanarea efectivă post-merge citește 3546 bloburi și identifică 6 apariții cunoscute în recepisele istorice, zero semnături neelucidate și zero limite întâlnite. Cele două regresii de redacție au trecut; protecțiile efective sunt identice cu C0.

Inventarul citește bloburile canonice și payloaduri gzip/tar limitate la 64 MiB. Nu publică valorile detectate. Excepția pentru recepisele de descărcare expirate cere SHA-256 exact și data observației; o altă valoare pe aceeași cale devine REVIEW_REQUIRED și produce exit nenul. Cele cinci alerte GitHub rămân deschise; expirarea URL-urilor la 24 octombrie nu dovedește revocarea credentialelor deținute de terț. Dovezile originale sunt păstrate.

Scanarea nu certifică absența universală a secretelor sau a datelor personale. Arhivele imbricate/OCR nu sunt interpretate exhaustiv. Datele oficiale și istorice nu au fost eliminate pentru a obține artificial un raport gol. Permisiunile write necesare lifecycle-urilor existente, configurația Dependabot și politica de păstrare a recepiselor rămân explicite în registre.

## 7. Branchuri și PR-uri rămase

La snapshotul core sunt 15 branchuri publice, inclusiv main: 10 PRESERVE_EVIDENCE și 4 ACTIVE. Cele 12 PR-uri intenționat rămase sunt #479, #470, #469, #468, #467, #466, #458, #398 și Dependabot #453, #296, #295, #294. Nu a rămas deschis niciun PR cleanup anterior. Au fost eliminate 14 referințe locale demonstrate integral accesibile din main, fără PR/remote/worktree activ; commiturile și stashul sunt păstrate. Registrul separă bloburile absente din arborele main curent de cele absente din întreaga istorie. `rt-adm2-7-rebased` are zero bloburi exclusiv istorice, dar 3 commituri originale neintegrate; se păstrează explicit pentru proveniență, fără a pretinde exclusivitate de conținut.

PR #398 rămâne Draft: 199 de fișiere în diff, 44 de commituri proprii, cod funcțional/politici de achiziție și reconciliere plus dovezi exclusive. Se păstrează pentru procesare separată; nu este integrat, închis administrativ sau reimplementat asupra ACTUAL în cleanup. Cele două branchuri RT fără PR direct sunt documentate ca atare; nu li se atribuie PR-uri inventate. Referințele Dependabot se pot actualiza automat și sunt datate în inventar.

## 8. Excepții și amânări

1. Cinci alerte istorice pentru recepise semnate de un terț rămân deschise, cu valori redactate și expirare documentată; nu se pretinde revocarea cheilor.
2. Monitorul de freshness semnalează corect sursa OSM mai veche de 14 zile; pragul nu a fost mărit. Refreshul OSM din 25 octombrie a fost oprit corect de pierderea a 12 entități MD în candidat (5.818 față de 5.830 în corpusul master relevant), fără înlocuirea datelor acceptate. Acest număr nu este numărul public de 5.848 noduri. Înghețarea ACTUAL exclude un refresh automat în cleanup.
3. Eșecurile HOME ale refreshurilor oficiale din 2 octombrie au deja remedierea din 4 octombrie, `cbf4eeaed6937064b57baced1f3935162a573b28`; nu s-a repetat intervenția sau executat un nou import pentru a obține artificial un run verde.
4. Branchurile RT neintegrate, PR #398, actualizările Dependabot active, prototipurile și consumatorii dinamici neelucidați sunt păstrați prin decizii explicite, nu șterși pentru reducerea numărului de fișiere.
5. ISTORIC, PROPUNERI și teritoriile amânate în acceptarea produsului rămân backlog separat. Cele 109 cazuri AUTO-4 rămân REVIEW_REQUIRED; CAPTCHA RNONG și documentele inaccesibile rămân dependențe externe, fără ocolire sau reinvestigare automată. P9.1 rămâne neautorizat.

Aceste excepții nu înlocuiesc niciun gate obligatoriu al versiunii certificate și nu ascund o regresie ACTUAL sau un eșec al CI curent.

## 9. Matricea criteriilor finale

| # | Criteriu | Stare | Dovadă |
| --- | --- | --- | --- |
| 1 | Clonare conform README | PASS | c9-clean-clone.json |
| 2 | Instalare verificată, fără lifecycle scripts | PASS | c9-clean-clone.json |
| 3 | Build static și reproducibilitate Linux/OCI | PASS | c8-post-admission.json |
| 4 | Teste obligatorii executate | PASS | c8-post-full-admission.json |
| 5 | Manifeste ACTUAL identice | PASS | c8-integrity.json |
| 6 | Identități, ierarhii și geometrii identice | PASS | c8-integrity.json |
| 7 | Fără regresii cartografice | PASS | c8-post-admission.json; c8-published-admission.json |
| 8 | Workflow-uri și protecții funcționale | PASS | c8-workflow-supply-chain.json; c8-post-admission.json |
| 9 | Pages core publică versiunea corectă | PASS | 496-published-marker.json; c9-pages-config.json |
| 10 | Website desktop/mobil funcțional | PASS | c8-published-admission.json |
| 11 | Toate cele 440 de resurse și 125 GeoJSON identice | PASS | c8-published-admission.json |
| 12 | Nicio ștergere nejustificată | PASS | c3-deletion-proof.json; c7-final-core.json |
| 13 | Niciun PR cleanup rămas neintenționat | PASS | c5-final-open-prs.json; acest PR documentar este intenționat și supus aceluiași protocol |
| 14 | Branchuri clasificate și tratate | PASS | c5-final-reconciliation.json; c5-local-branch-treatment.json; c5-local-security-branch-treatment.json |
| 15 | README reflectă structura și utilizarea | PASS | README.md din rădăcină; c9-clean-clone.json |
| 16 | Excepții explicite, fără reclasificări artificiale | PASS | RAPORT-FINAL.md secțiunea 8; scheduled-workflow-decisions.json; c9-security-alerts.json |

## 10. Dovezi și reproducere

`sha256-manifest.json` este un index aditiv al dovezilor cleanup, separat de manifestele canonice ACTUAL. Toate hashurile probatorii indexate anterior rămân valide. Registrele C2, C5, C6, C8 și C9 leagă fiecare observație de commit, sursă, artefact și SHA-256; fișierele gzip sunt lossless, iar sursa v1 a analizorului păstrează replay-ul original CRLF.

Comenzi principale, din clona cu istoria necesară disponibilă:

```sh
npm ci --ignore-scripts
python scripts/audit/test_cleanup_file_usage.py
python scripts/audit/cleanup-evidence-guard.py
python scripts/audit/cleanup-file-usage.py --ref COMMIT
python scripts/audit/test_cleanup_security_signatures.py
python scripts/audit/cleanup-security-signatures.py --ref COMMIT --as-of TIMESTAMP
node --test scripts/ci/check-job-results.test.mjs
node scripts/audit/p82-full-validation.mjs
git ls-tree -rl COMMIT
git count-objects -v
```

Folosește commitul și timestampul fiecărui raport, mediul Linux/Chrome/OCI aprobat pentru verificările care îl cer, și `legacy-crlf` numai pentru snapshotul istoric Windows. Nu regenera manifeste ACTUAL pentru a potrivi o modificare. Publicarea se verifică prin workflow-ul existent `web-r2c4-published.yml` pe `main`, după deployment, cu `PUBLISHED_EXACT_CHECKOUT`; un test PR cu `PR_PUBLISHED_BASELINE_ONLY` nu certifică noua publicare.

Reproducerile C5/C7 arhivate sunt surse Python executabile: `c5-final-reproducer.py.txt` acceptă `--repository`, `--ref-prefix`, `--main`, `--out`; `c5-history-reproducer.py.txt` acceptă `--repository`, `--inputs` (directorul acestui raport), `--out`; `c7-final-reproducer.py.txt` acceptă `--repository`, `--ref`, `--out`. Folosește SHA-urile din inventar pentru reconstruirea referințelor locale ale snapshotului; branchurile Dependabot mobile nu sunt identificatori imuabili. Reproducerile au fost verificate prin comparație byte-identică a registrelor și CSV-urilor, separat de timestampul unei observații noi.

Nu s-au efectuat achiziții, delegări către servicii cu plată, force-push, ștergeri de taguri, relaxări de protecții sau reclasificări juridice automate. Pasul următor este întreținerea curentă prin PR-uri și monitorizarea excepțiilor declarate, fără deschiderea automată a P9.1 ori reluarea nelimitată a auditurilor închise.
