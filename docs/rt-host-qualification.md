# RT-HOST.1 / RT-HOST.2 — calificare independentă și admitere controlată

## Scop

Separăm calificarea unui profil de gazdă de reproductibilitatea construirii ACTUAL și de admiterea profilului. Acest PR modifică numai infrastructura de verificare; nu modifică surse, inventare, geometrii, date publicate, politica semantică, contractul OCI sau lista de profiluri admise.

GitHub runs-on: ubuntu-24.04 nu fixează versiunea exactă a imaginii sau kernelul gazdei. O versiune mai veche precum 20261101.114.1 poate să nu mai fie alocată. Nicio altă versiune nu este acceptată sub acest nume.

## RT-HOST.1 — observații independente

Workflow: .github/workflows/rt-host-qualification.yml. Permisiuni contents:read, fără push sau admitere.

1. Două joburi independente A/B înregistrează repository, SHA de checkout, run ID, run attempt, lane, GitHub event/ref, imaginea runnerului, kernelul, Docker Engine, containerd, runc, engine și CPU.
2. Pentru fiecare observație se păstrează SHA-256 al profilului, hashul exact al manifestului de bază, rezultatul validatorului host-trust și controalele CPU și pozitive/negative.
3. Comparatorul acceptă două dovezi din aceeași execuție sau din execuții distincte, numai dacă au același checkout SHA și același manifest de bază, joburi/lane independente și identitate exactă pe runner/kernel/docker/engine. CPU se validează individual după compatibilitatea aprobată; vendorul/modelul sunt dovezi, nu identitate semantică.
4. Rezultatele sunt NOT_QUALIFIED, ALREADY_APPROVED sau QUALIFIED_PENDING_SEPARATE_ADMISSION. Ultimul este doar calificare tehnică, NU admitere.
5. Workflow-ul de infrastructură rulează comparatorul în mod record-only. Succesul colectării nu transformă NOT_QUALIFIED în PASS pentru admitere. Pentru utilizare obligatorie se apelează opțiunea --require-qualified.

După ce infrastructura a fost integrată, observațiile autentice se pot colecta cu:

    gh workflow run rt-host-qualification.yml --repo ovidiudeica/reforma-teritoriala --ref main
    gh run download RUN_ID --repo ovidiudeica/reforma-teritoriala --name rt-host-observation-A --dir ./proof-A
    gh run download RUN_ID --repo ovidiudeica/reforma-teritoriala --name rt-host-observation-B --dir ./proof-B

Comparația poate folosi A și B din două runuri diferite, păstrând SHA-ul comun:

    node scripts/audit/rt-host-qualification.mjs compare --a proof-A/observation.json --b proof-B/observation.json --target 20261101.114.1 --out /tmp/rt-host-comparison.json --require-qualified

Dacă imaginea exactă nu este observată în ambele probe, rezultatul este NOT_QUALIFIED, nu o nouă aprobare.

## RT-HOST.2 — un PR de admitere distinct

Numai după calificare validă, deschide un PR separat actual/provenance-* și depune artefactele originale A.json, B.json și comparison.json în docs/evidence/rt-host-admission. Adaugă proposal.json:

    {"schema":"rt-host-admission-source-v1","target_image":"YYYYMMDD.N.N","runs":{"A":123,"B":456}}

Identificatorii numerici trebuie înlocuiți cu runurile oficiale GitHub Actions. Acestea trebuie să provină din workflow_dispatch pe main. Gate-ul .github/workflows/rt-host-admission-gate.yml verifică utilizând GitHub API atât proveniența runurilor, cât și conținutul efectiv al artefactelor, comparat byte-for-byte cu fișierele declarate. Nu se acceptă doar fișiere JSON neverificate.

PR-ul poate propune exact UN profil nou, numai ca anexare la lista explicită existentă; celelalte profile, kerneluri, Docker, containerd, runc și contractul CPU rămân byte-identice. Codul EXPECTED_HOST_TRUST, manifestul recalculat, amprenta și gate-ul de admitere trebuie să coincidă. Lanțul de proveniență ACTUAL se reconstruiește separat și controlat, fără schimbarea identității sau a datelor semantice.

Nu există admitere sau modificare automată a manifestelor. Este necesară integrarea protejată cu SHA exact, toate gate-urile obligatorii, reproductibilitatea byte-for-byte, apoi reconstruirea candidatului ACTUAL pe noul main și eventual promovarea separată.

## Restricții

- Niciun profil necunoscut nu este acceptat implicit.
- A/B diferite, surse diferite, artifact modificat, CPU incompatibil, comparație nereușită sau manifest alterat blochează admiterea.
- PR #512 / workflow #41926119983 rămâne probă istorică nereușită: A=20261101.360.1, B=20261026.354.1. Nu demonstrează calificarea 20261101.114.1.
- actual-change-reproducibility-gate.yml, comparațiile A/B și regulile OCI/network-denied rămân neschimbate.
- P9.1a și P9.1b rămân blocate.
