# CLEANUP-2.1 — Certificarea grafului de dependențe (în execuție)

Baseline: `main` după PR #489, Git tree `656bf2165d58efcbb3443aa70d56c313990d1b67`, 3.464 fișiere, 526.591.283 octeți conform CLEANUP-1.

## Metodă reproductibilă
`python scripts/audit/cleanup-2-1-reference-graph.py` citește `git ls-files`, scanează referințe textuale explicite din fișierele de cod, workflow-uri, manifestele și documentația relevantă și emite:
- `outputs/cleanup-2-1/per-file-reference-register.csv`: per-fișier, mărime, hash al fișierelor mici, surse care îl referă, clasificare;
- `outputs/cleanup-2-1/summary.json`: distribuții și limitările scanării.

Workflow existent `Frontend browser QA` execută scanarea și publică artefactul `cleanup-2-1-reference-graph` în GitHub Actions, fără commitarea rezultatelor generate și fără scriere în ACTUAL.

## Distincții esențiale
- `REFERENCED_KEEP`: există referință directă verificată, nu poate fi eliminat.
- `PROTECTED_NO_DELETE`: resurse runtime, date-sursă, corpus, registre și workflow-uri protejate; absența referinței directe nu este motiv de ștergere.
- `UNPROVEN_ORPHAN_REVIEW_ONLY`: nu s-a găsit referință textuală directă; **NU înseamnă fișier neutilizat**. Importurile dinamice, URL-urile construite, fișierele indexate prin manifest, scripturile folosite manual și probele arhivistice pot scăpa scanării.

## Gate de acceptare
1. Confirmă execuția terminală a jobului CI cu output-urile disponibile.
2. Verifică integritatea artefactului și registrul per-fișier, inclusiv fișierele mari și sursele offline.
3. Identifică numai candidați cu dependențe explicit negative demonstrate prin teste și manifestele de runtime, într-un PR ulterior.
4. Nu elimina fișiere, workflow-uri sau branch-uri în această etapă.

**Status:** script și workflow publicate; rezultatele CI și analiza fișierelor fără referințe explicite urmează verificarea. ACTUAL nemodificat; P9.1 neautorizat.
