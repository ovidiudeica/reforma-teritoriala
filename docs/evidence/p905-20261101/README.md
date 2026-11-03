# P9.0.5 — probe independente A/B pentru runner Ubuntu 24.04 20261101.360.1

Domeniu: calificare probatorie **read-only** pentru profilul exact observat in verificarea ACTUAL A a PR #505 (job 126054363097).
Baza: main `2928118c871d1d02ef7d2f364b6bd2e9d0344adb`, manifestul host trust existent. Nu se modifica ACTUAL, markerul persisted sau profilurile aprobate.

Sursa upstream: https://github.com/actions/runner-images/releases/tag/ubuntu24%2F20261101.360
Image Version: 20261101.360.1; kernel publicat: 7.0.0-1017-azure.
Release publicat 2026-11-02; **prerelease**. Publicarea upstream nu este singura o admitere.

Se captureaza in doua runner-e independente A si B campurile exacte: runner, kernel, docker, engine si CPU.
Validatorul curent trebuie sa esueze **doar** la runtime_host_profile_is_explicitly_approved.
Control pozitiv foloseste un profil deja aprobat; negativele deterioreaza containerd si vendor CPU.
Se compara campurile exacte, fingerprintul propus si SHA-urile dovezilor. Orice imagine diferita
sau divergenta A/B este EVIDENCE_CONFLICT, fara promovare; **nu se selecteaza automat un profil mai permisiv**.

Autorizarea utilizatorului din conversatia 2026-11-03 permite calificarea si admiterea controlata a profilului exact,
urmate de activarea Variantei A **numai dupa gate-uri reusite**.
Aceste dovezi nu constituie automat admitere, CI de reproductibilitate ACTUAL sau permisiune P9.1b.

Conservam integral cele 123 identitati non-CUATM in registrul per-ID si arhiva OSMB;
pregatirea regulei este PR #505, in Draft pana la certificarea infrastructurei.
