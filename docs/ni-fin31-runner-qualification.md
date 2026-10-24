# NI-FIN.3.1 — calificarea propusă a runnerului GitHub

Status: `WAITING_OWNER_AUTHORIZATION`. Profilul nu este aprobat. Nicio modificare host-trust sau de proveniență ACTUAL nu a fost aplicată.

## Dovezi și rezultat tehnic

Domeniu: profilul exact `github-ubuntu24-20261023.334.3`. Baza este main `447f9bdbca5eb2869d107641a14398f7a273165e`.

Auditurile originale A/B sunt extrase fără modificarea conținutului din run `40138566219`, HEAD `6e322386793b8d9b86a53d37b709198ae1accfff`. Logul complet este conservat comprimat, împreună cu manifestul SHA-256. Validatorul și manifestul aprobate la data observației sunt conservate byte-identic pentru replay istoric; aceste copii nu sunt importate de gate-ul de admitere ACTUAL și nu autorizează runnerul.

Comparația individuală include 27 de câmpuri: imagine, arhitectură, OS, kernel, Docker Engine/client/API, containerd, runc, docker-init, storage și cgroup. 26 coincid cu `github-ubuntu24-20261012.334.1`; diferența unică este `runner.image_version`. Toate cele șase verificări CPU ale validatorului existent trec pentru A și B. Modelul/vendorul și surplusul de flags sunt probe, nu identitate semantică.

Proveniență primară: [release oficial GitHub](https://github.com/actions/runner-images/releases/tag/ubuntu24/20261023.334), publicat la 2026-10-23T15:33:17Z, `draft=false`, **prerelease=true**. README-ul este legat de commitul `bf62c713fd9c48247e2a4d3ce99a9f0554cd745e`; SHA-1 Git blob și SHA-256 au fost verificate. Release-ul indică versiunea exactă observată și actualizarea Bazel 9.3.0 → 9.3.1. Aceasta nu dovedește că toate programele imaginii sunt identice; numai câmpurile contractului au fost comparate individual.

Neconcordanța conservată: secțiunile Set up job A/B trimit încă la release-ul 20261012.334. Aceste URL-uri nu au fost rescrise. Confirmarea independentă a noii versiuni vine din API-ul oficial și README-ul imuabil, nu din presupunerea că acele linkuri sunt actualizate.

Propunerea exactă este în `docs/evidence/ni-fin31-host-qualification-20261025/proposal.json`. Fingerprintul contractual propus, după adăugarea unui singur profil și păstrarea tuturor celor patru existente, este:

`f3a11ed754cbd66758169ec1943653c33ebb5d4e7350e88d5db26b0e1044ebbf`

Acest fingerprint este o propunere, nu un manifest aprobat.

## Probe

17 teste locale verifică reproducerea byte-identică, legarea la manifest, diferența unică și respingerea driftului kernel/Docker/containerd/runc/storage/cgroup, CPU insuficient, altă versiune, publicație lipsă/draft/placeholder și modificarea politicii aprobate. Proba pozitivă înlocuiește numai versiunea imaginii cu cea deja aprobată: este un control sintetic explicit, nu executarea reproductibilității ACTUAL pe noul profil.

Workflow-ul dedicat read-only capturează două medii autentice noi, A/B, aplicând validatorul ACTUAL curent și păstrând rezultatul său real. Numele acestor probe este `qualification-evidence-*`, nu `actual-change-repro-*`. Nu construiește release-ul, nu modifică lista de încredere și nu produce un PASS de reproductibilitate. Un mediu diferit de profilul analizat este păstrat și respins, fără retry de alocare.

## Autorizarea necesară

`docs/actual-v1-trust-boundary.md` stabilește: „trust root-ul administrativ este proprietarul/adminul GitHub al repository-ului”. Mandatul NI-FIN.3.1 cere separat aprobarea explicită a noului profil; nu o considerăm acordată prin cererea de pregătire a calificării.

Decizia solicitată: autorizarea exactă a profilului de mai sus și a rebindului P9.0.5 strict de proveniență, păstrând identitatea semantică, componentele canonice, geometriile, părinții MD, CUATM și toate profilurile existente. Fără wildcard, bypass, continue-on-error sau modificarea required checks.

## Procedura după autorizare

Precedentul este [PR #313](https://github.com/ovidiudeica/reforma-teritoriala/pull/313), merge `6d29c4905a2587cfa164d25a4c2f1ff60c90f713`. Procedura existentă este `.github/workflows/p905-runner-host-trust-refresh.yml`; `prepare-p905-runner-provenance.mjs` verifică explicit componentele canonice, geometria, source bundle, review bundle și identitatea semantică înaintea rebindului markerului.

1. Conservă decizia proprietarului și SHA-ul propunerii. Adaugă numai profilul exact în `EXPECTED_HOST_TRUST.accepted_runtime_profiles`; păstrează cele patru profiluri existente și toate celelalte atribute.
2. Adaptează numai referința explicită la profil din probele/helperul P9.0.5. Nu selecta dinamic un profil nou pe baza mediului alocat.
3. Generează prin runtime-ul/procedura aprobate cele șase fișiere de proveniență: actual-host-trust-manifest.json, actual-build-environment-manifest.json, actual-build-environment-gate.json, actual-release-manifest.json, actual-release-gate.json și actual-release-persisted.json. Verifică fingerprinturile dependente, hashurile și legătura previous_manifest_sha256. Nu genera local cu alt toolchain un înlocuitor prezentat drept rezultat GitHub.
4. Aplică numai artefactele autentice verificate ale procedurii read-only. Compară independent identitatea semantică și toate componentele canonice; nu modifica cele 5.848 de identități sau geometrii.
5. Rulează efectiv `actual-change-repro-A`, B și comparația pe HEAD-ul candidat. Gate-ul folosește host-trust de la TEST_COMMIT, deci o calificare corect legată nu necesită un PASS inventat pe vechiul manifest. Persisted-base și lanțul de proveniență rămân obligatorii.
6. Verifică toate condițiile de admitere pe SHA exact. Auditul WEB-R2a.1 este actualmente read-only și refuză orice diff în data/public; un rebind de proveniență atinge data/current. Această aplicabilitate trebuie adjudecată prin politica administrativă, nu ascunsă prin dezactivarea auditului sau raportarea unui PASS fals. Nu este inventată aici o excepție de merge.
7. Numai după admiterea legitimă continuă integrarea #439 → #440 → #441 și auditul Pages. #396 și #442 rămân deschise.

Până atunci: `NI_FUNCTIONAL_COMPLETE=false`, `NI_LEGAL_CERTIFICATION_PENDING=true`, `OSM_SOURCE_PENDING=true`. PR-ul de calificare rămâne Draft.
