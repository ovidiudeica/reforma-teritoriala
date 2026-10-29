# P9.0.5 — calificare controlată runner Ubuntu 20261026.354.1

## Domeniu și stare

Acest dosar produce **dovezi tehnice** pentru profilul de execuție GitHub-hosted observat în eșecul post-merge ACTUAL pe `main@af9ea48fa5a123fc40f63995a4358ff75a6cfb44`, [run #40959256326](https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/40959256326), issue [#461](https://github.com/ovidiudeica/reforma-teritoriala/issues/461).

**Nu autorizează profilul, nu modifică manifestele ACTUAL și nu validează reproducibilitatea A/B a construirii ACTUAL.** Criteriul de trecere a acestui PR este închiderea unei calificări *probatorii* separate; acceptarea trust chain necesită revizuire distinctă.

## Sursă oficială independentă

Publicarea upstream `actions/runner-images` din 26 octombrie 2026:
https://github.com/actions/runner-images/releases/tag/ubuntu24%2F20261026.354

Conform descrierii oficiale, `Image Version: 20261026.354.1` și kernel `7.0.0-1017-azure`. Release-ul nu implică automat compatibilitate cu profilul determinist ACTUAL. Păstrează diferențele dintre kernel `6.17.0-1022-azure` anterior, containerd `v2.4.1` anterior și `v2.4.2` observat, precum și orice diferență de Docker/runc/engine.

## Protocol

1. Workflow-ul `p905-20261026-qualification.yml` rulează doi observatori independenți A/B pe `ubuntu-24.04`, prin `captureObservedHost` existent.
2. Verifică integritatea manifestului aprobat, toate cerințele CPU, statică și compatibilitatea cu profilurile acceptate.
3. Așteaptă `FAIL` exact pe `runtime_host_profile_is_explicitly_approved`. Orice altă eroare de contract blochează calificarea.
4. Construiește un candidat **numai în memorie** și calculează fingerprintul său; nu scrie `data/current/**`.
5. Execută un control pozitiv sintetic cu un profil deja aprobat și două controale negative (containerd alterat, vendor CPU neacceptat).
6. Compară A/B cu o execuție separată, inclusiv hashurile și toate componentele runner/kernel/docker/engine. Diferența de mediu duce la `EVIDENCE_CONFLICT`, nu la PASS.
7. Publică artefactele A, B și comparația. `git diff --exit-code` verifică absența modificărilor tracked.

A/B din acest dosar înseamnă numai **două capturi independente ale profilului gazdă**, nu reproductibilitatea buildurilor ACTUAL. Marcajele `host_profile_approved:false`, `actual_reproducibility_executed:false` trebuie păstrate.

## Criterii pentru admiterea ulterioară

Înaintea oricărei modificări a `data/current/actual-host-trust-manifest.json`, sunt necesare:
- verificarea provenienței oficiale și concordanța exactă A/B;
- acceptarea explicită a schimbărilor kernel/containerd/runc, nu doar a versiunii imaginii;
- o autorizare separată pentru actualizarea manifestului și rebindingul provenienței, inclusiv `actual-build-environment-manifest.json`, `actual-release-manifest.json` și `actual-release-persisted.json`, fără schimbarea fingerprintului semantic;
- executarea reală a repro A/B pe noul profil calificat, comparația hashurilor și a checkurilor post-merge;
- păstrarea excepțiilor și a oricărui FAIL.

P9.1 rămâne blocat; nicio geometrie, relație, cod administrativ sau politică fail-closed nu se modifică.
