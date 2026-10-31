# CLEANUP-1 — Inventar complet Git și plan conservator

**Snapshot exact:** tree SHA `656bf2165d58efcbb3443aa70d56c313990d1b67` (main, după PR #489). GitHub Trees API `recursive=1`: `truncated=false`, **3.647 intrări, dintre care 3.464 blob-uri**, suma dimensiunilor `size` = **526.591.283 octeți**. Aceasta este dimensiunea logică a blob-urilor din snapshot, **nu** dimensiunea repository-ului pe disc / pack / istoricul complet.

Registrul exhaustiv: [git-tree-per-file.csv](git-tree-per-file.csv), o linie pentru fiecare fișier, calea, mărimea, SHA-ul Git blob și categoria de conservare/revizuire. Este clasificare preliminară de risc, **nu autorizație de ștergere**.

## Distribuția fișierelor (top-level)
| Zonă | Fișiere | Octeți | Tratament |
|---|---:|---:|---|
| `public/` | 371 | 276.653.459 | runtime critic: păstrare |
| `docs/` | 2.433 | 171.643.006 | dovezi și documentație; păstrare, doar reorganizare probată |
| `data/` | 94 | 65.229.897 | surse/corpus protejate |
| `vendor/` | 4 | 9.100.621 | dependențe offline CI: examinare |
| `scripts/` | 386 | 2.700.759 | analiză de referințe înainte de eliminare |
| `views/` | 2 | 376.819 | analiză de utilizare |
| `.github/` | 82 | 253.601 | workflows/protecții: examinare separată |

## Ținte mari
- `public/geo/current/ro-administrative.geojson` — 44,24 MiB
- `public/geo/actual/ro-local.geojson` — 35,94 MiB
- `public/geo/current/md-administrative.geojson` — 20,06 MiB
- `public/data/actual-entities.json` — 14,68 MiB
- `docs/evidence/ni-jur-documentary-supplement-20261021/law48-original.pdf` — 10,85 MiB
- `public/geo/actual/md-detail.geojson` — 10,48 MiB
- `data/sources/osm-snapshots/*` — mai multe arhive de 7–10 MiB

Fișierele mari nu sunt implicit inutile; unele sunt publicate runtime, altele conțin probe. **Nicio ștergere autorizată.**

## Clone identice la nivel Git
Arborele conține **20 grupuri de blob SHA identic la căi diferite, 58 apariții**, incluzând:
- `docs/evidence/ni-jur-current-preparation-20261021/inputs/base-85.json` și `docs/evidence/ni-jur-independent-20261020/individual-85.json` (978.853 octeți fiecare);
- `docs/audits/auto4-osmb-109/originals/cuatm-25.xlsx` și `docs/audits/rt-audit1-2/evidence/CUATM_25.xlsx` (102.967 octeți);
- `docs/audits/auto3-osmb/md-remaining-boundary-history/way69469001-history.json` și `docs/audits/auto3-osmb/md-shared-boundary-history/way69469001-history.json` (40.288 octeți);
- câteva scripturi și istorii OSM duplicate în dosare de probe diferite.

Git deduplică deja blob-urile cu SHA identic în stocarea obiectelor Git; eliminarea unei căi duplicat poate economisi aproape zero în Git pack și poate rupe un manifest probator. **Nu șterge aceste copii fără trasabilitate și verificarea referințelor.**

## Fișiere temporare
Nu au fost identificate în tree-ul curent căi care să corespundă tiparelor evidente `node_modules/`, `dist/`, `coverage/`, `__pycache__/`, `*.pyc`, `*.log`, `*.bak`, `*.tmp`, `.env` (cu excepția fișierelor normal ignorate; acest inventar privește numai fișierele tracked). Nu rezultă o ștergere sigură imediată.

## Dependențe și limitări
- `package.json` definește numeroase entry-point-uri pentru importuri, audituri și build; `.github/workflows/` rulează o parte; `public/` este publicat pe Pages; `docs/audits/` și `docs/evidence/` conțin manifestele și sursele care păstrează reproductibilitatea. Clasificarea per-fișier etichetează **PRESERVE** / **REFERENCE_REVIEW**, nu afirmă că graful complet de importuri a fost demonstrat.
- PR #398 este deschis, Draft, `mergeable=false`, schimbă 199 fișiere (inclusiv surse OSM și workflow-uri). Nu se închide, integrează sau șterge automat.
- 15 branch-uri enumerate, inclusiv `main`, branch-uri de audit/fix și patru Dependabot. Pentru ștergeri este necesară verificarea individuală a PR-urilor, merge-base, referințelor CI și conservării dovadelor.
- Acest raport **nu a executat** testele local, auditul istoric `git rev-list --objects --all` al obiectelor Git, analiză a Git pack, secret scanning exhaustiv ori analiză statică completă a referințelor scripturilor. Acestea sunt gate-uri pentru curățarea destructivă.

## CLEANUP-2 — Plan de execuție în PR-uri mici
1. **C2.1 — Verificare/reproducere baseline**: CI/Pages pe main și hashurile runtime publicate; generarea grafului complet de referințe din `package.json`, JS imports, workflow YAML, scripts, manifestele/receipt-uri și documentația de audit. Raport read-only.
2. **C2.2 — Igienă fără ștergeri**: corectare linkuri, index de documentație, precizarea rolurilor fișierelor `public/geo/current` vs `actual`; PR separat. Nu modifica build.
3. **C2.3 — Branch lifecycle**: propune ștergerea numai pentru branch-uri individual dovedite fără PR deschis, fără divergențe neintegrate și fără dependențe; ștergerile refs doar după evidență și acord explicite. PR #398 se tratează separat.
4. **C2.4 — Fișiere regenerabile**: pentru fiecare candidat, probează faptul că nu e utilizat, reprodu-l în director temporar, compară hashurile; ștergere prin PR separat numai dacă niciun manifest/CI/runtime nu referă fișierul. Probele canonice nu sunt candidați.
5. **C2.5 — Consolidare workflow/script**: păstrează exact numele verificărilor obligatorii, configurațiile permisiunilor, evenimentele PR/push și gates read-only; fiecare schimbare mică primește CI și audit post-merge.
6. **C2.6 — Acceptare finală**: compară listele și SHA-urile ACTUAL, manifestele şi cele 440 resurse publicate, teste browser/geo, CI, Pages; documentează economiile măsurate și orice riscuri restante.

**Decizie CLEANUP-1:** inventarul complet și clasificarea per-fișier sunt finalizate pentru snapshotul citat. Nicio eliminare nu este încă demonstrată sigură; CLEANUP-2 trebuie executat etapizat și verificabil. ACTUAL/P9.1 rămân nemodificate.
