# REPO-CLEAN-CLOSURE

## Domeniu executat

Baseline verificat: `5e1870a1a7fdc5dda2801862b7a53b8fdb6cbc62`. Cleanup-ul nu introduce Cernăuți, nu schimbă runtime-ul și nu promovează surse. SHA-ul final al acestui raport este identificat de PR-ul său și de istoricul Git; CI/post-merge și Pages finale se leagă prin checkpointul de admitere GitHub, fără un SHA autoreferențial inventat.

| Inventar inițial | Procesat | Rezultat |
|---|---|---|
| 41 PR-uri | 41 decizii individuale | 37 CLOSED fără merge, 4 ACTIVE_REQUIRED |
| 2 Issues reale | 2 diagnostice actualizate | 0 închise artificial, #396/#442 OPEN |
| 56 ramuri | 55 HEAD-uri non-main arhivate | 51 șterse, 5 păstrate |

PR-ul documentar de cleanup și branch-ul său sunt noi și se numără separat de cohorta inițială. Niciun PR istoric NO MERGE nu a fost integrat. Toate operațiunile sunt în actions.json; inventarul complet, HEAD/base exacte, fișiere, comparații blob cu main, CI și dependențe sunt în prs.json și initial/pr-N.json.

## Conservare și recuperare

55 taguri adnotate `archive/repo-clean-20261025/<branch>` păstrează fiecare HEAD non-main, întregul arbore și istoricul său. Verificarea remote a targeturilor peeled a precedat închiderile și ștergerile; branches.json include SHA commit/tree/tag și justificarea fiecărei ramuri. Recuperare independentă de ramura eliminată: `git fetch origin refs/tags/<archive_tag>:refs/tags/<archive_tag>` și `git switch --detach <archive_tag>`. Aceste referințe arhivale trebuie păstrate.

526 intrări de fișier ale celor 41 PR-uri au fost comparate per blob cu main. Inventarul API paginat și 189 metadate ale artifactelor asociate sunt conservate. **Nu pretindem că cele 6.874.741.943 de octeți ale artifactelor CI sunt copiate integral în repository**: acestea au ciclul lor de retenție; payloadurile Git istorice sunt păstrate durabil prin taguri, iar dovezile acceptate NI-FIN au deja dosar integrat. Nu au fost șterse artifacte Actions sau originale locale. Nici simpla închidere a PR-ului, nici metadatele artifactului nu sunt prezentate drept arhivare a binarului. Zero URL-uri directe către ramurile eliminate au fost găsite în fișierele urmărite; mappingul către taguri/SHA este explicit.

## Deciziile pentru PR-uri

Toate cele 41 decizii sunt în [INVENTORY.md](INVENTORY.md) și prs.json. Lanțurile P9/NI-ADM/NI-JUR/NI-TAGS sunt EVIDENCE_ARCHIVE: concluziile BLOCKED și NO MERGE sunt păstrate. #394/#402/#438 nu mai au operațiuni independente de acceptare; rezultatele unice rămân accesibile prin tag și #442, fără promovare juridică.

#365 este SUPERSEDED prin #366; #373/#374/#375 prin #376; #387 prin #388. Sunt verificate implementările și commiturile integrate, nu numai titlurile. Cele trei teste punctuale de accesibilitate pe main au trecut, iar regresiile complete se verifică în CI-ul acestui PR.

#398 rămâne DEPENDENCY_BLOCKED și activ pentru #396. #294/#295/#296 rămân SECURITY_OR_COMPATIBILITY_REVIEW, active și documentate individual: setup-node v7 schimbă ESM/autentificarea, upload-artifact v7 afectează pinul contractual exact de build/proveniență, download-artifact v8 cere roundtrip autentic și comparație A/B cu uploaderul acceptat. Nu sunt deja integrate și nu s-a demonstrat o vulnerabilitate exploatabilă a pinurilor curente. Actualizarea mecanică doar pentru zero PR-uri ar fi nejustificată. Sunt necesare testele de compatibilitate și, dacă se schimbă un contract protejat, aprobarea specifică; rezultatele acestor teste neexecutate nu sunt declarate PASS.

## Issues — blocaje reale

#396: `2596 - 12 + 1 = 2585`. Cele 12 relații retrase și noua 21515245 sunt enumerate individual în issue-review.json, cu cauze, istorice și hashuri. Artifactul runului 18 octombrie nu mai este disponibil prin API; proba per-ID conservată 20 octombrie nu este etichetată fals drept originalul din 18 octombrie. Patru răspunsuri oficiale actuale confirmă Horești relation v6/way v8 și Buneți relation v7/way v6 neschimbate. Închiderea topologică, selecția/proveniența și promovarea protejată rămân gate-uri reale. Sursa 5 octombrie este STALE; pragul 14 zile nu se schimbă. Fără refresh acceptabil, fără promovare și fără editare OSM publică.

#442: cele 14 originale încă indisponibile sunt enumerate individual, cu ediții, date, URL-uri și condiții în issue-review.json. Probele oficiale delimitate au returnat HTML cu termeni de abonament, nu PDF; zero originale noi certificate. Trei intrări în vigoare condiționate și efectele individuale nu sunt certificate. Nu se ocolesc drepturi de acces și nu se deduce juridic din OSM. NI-FIN funcțional nu este redeschis.

## Integritate și admitere

Hashurile și lungimile celor 32 componente au fost reverificate independent: RO3246 + MD2602 =5848; fingerprint semantic `a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446`. canonical-integrity.json păstrează fiecare dovadă. Părinții MD, CUATM, geometriile și host-trust sunt neschimbate. P91_IMPORT_ALLOWED=false. NI_FUNCTIONAL_COMPLETE=true; implementarea 242 noduri, 85 referințe și 8 contururi rămâne publicată. Ultima acceptare publicată completă a verificat 438 resurse/125 GeoJSON; runtime-ul acestui PR este byte-identic cu acel release. CI, CodeQL, A/B și Pages de pe noul SHA trebuie confirmate înaintea certificării finale, nu presupuse din baseline.

## Verdicte

- REPO_HYGIENE_COMPLETE: operațiunile administrative sunt complete; verdictul final true se emite în checkpointul de admitere numai după CI exact-HEAD, integrarea raportului și auditul post-merge/Pages. Cele patru PR-uri rămase sunt lucrări active cu decizie, nu Draft-uri abandonate.
- REPO_TECHNICAL_DEBT_RESOLVED=false: #396, #442 și migrările majore de compatibilitate nu sunt rezolvate artificial.
- READY_FOR_UA_CV0=false: recomandare conservatoare până la decizia privind contractele de sursă/proveniență și planul de compatibilitate; nu începe o nouă jurisdicție în acest cleanup. Nu există regresie NI-FIN demonstrată, dar datoria relevantă nu justifică un greenlight necondiționat.

Pași rămași executabili: roundtrip și regresii pentru cele trei actualizări Actions într-un PR compatibil separat; pentru #396, corecție upstream autorizată și calificare completă înainte de orice promovare; pentru #442, originale autentice accesibile și adjudecare individuală. Nu se solicită aprobări administrative generale repetitive și nu se schimbă contracte protejate prin acest raport.
