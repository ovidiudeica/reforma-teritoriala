# CLEANUP-2.1.1 — Analiza artefactului CI per-fișier (2026-10-31)

Sursa: workflow run `41239091376`, artefact `cleanup-2-1-reference-graph`, ID `13055869363` (ZIP recuperat și inspectat), generat de commitul PR #491 `116b9412c037c14193f2593847fa2a74f360ac88`.

## Rezultate verificate din `summary.json` și `per-file-reference-register.csv`
- **3.466** fișiere urmărite de Git în branch-ul PR (față de cele **3.464** ale baseline-ului CLEANUP-1; +2 fișiere de audit din branch);
- **1.132** surse text citite, **5.773** referințe explicite identificate, 0 surse ilizibile;
- **1.227** cu referințe detectate — `REFERENCED_KEEP`;
- **1.981** protejate fără legături explicite — `PROTECTED_NO_DELETE`;
- **258** fără referință explicită detectată — `UNPROVEN_ORPHAN_REVIEW_ONLY`, **nu** inutilizabile demonstrate;
- acești 258 însumează **14.957.081 octeți** în working tree; eliminarea lor nu este autorizată.

Distribuția celor 258: `docs/` 189; `scripts/` 56; `prototypes/` 3; `.github/` 2; `data/` 2; `tools/` 2; `schemas/` 1; `.gitattributes` 1; `.gitignore` 1; `SECURITY.md` 1.

## Proba contra falselor pozitive
`.gitattributes`, `.gitignore`, `SECURITY.md`, `.github/dependabot.yml`, două `.gitkeep`, `docs/ni-legal-close/per-id-final-register.json` și mai multe teste `scripts/test/` apar între candidații fără referință textuală. Aceste fișiere au rol structural, juridic, CI sau probator chiar dacă nu sunt menționate literal într-un alt fișier. Prin urmare **ZERO ștergeri demonstrate sigur** de această scanare.

## Restanțe pentru certificarea completă
1. Verificarea terminală a tuturor controalelor obligatorii pe SHA-ul PR #491; la momentul primei examinări, P8.2, P8.4 și Frontend browser QA erau încă în execuție.
2. Recuperarea grafului de dependențe import-relative și invocări dinamice, a globs-urilor din CI și a referințelor manifest/receipt; scriptul existent verifică numai subșiruri de cale și poate produce fals negative.
3. Validarea celor 258 individual contra codului și manifestelor; generarea unui subregistru `PROVEN_UNUSED` numai după demonstrație și testele aferente.
4. Nu se elimină date ACTUAL, runtime, probe juridice, workflows obligatorii sau alte surse arhivistice.

**Decizie:** rezultatul scanării a fost recuperat, numărat și clasificat; CLEANUP-2.1.1 nu autorizează nicio ștergere. PR #491 poate fi promovat numai după închiderea CI; CLEANUP-2.2 va putea reorganiza documentație fără modificarea surselor.
