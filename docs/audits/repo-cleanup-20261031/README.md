# Repo cleanup — audit inițial read-only (2026-10-31)

## Scop și regulă de siguranță
Acest audit este **inventar de decizie**, nu ștergere sau modificare a corpusului. ACTUAL, geometriile, registrele de dovezi, manifestele, hashurile, CI și GitHub Pages rămân neatinse. Nu autorizează P9.1.

## Constatări confirmate din GitHub
1. `main` publică versiunea ACTUAL acceptată prin PR #488 și #489. Dosarul `docs/audits/product-launch-20261031/README.md` indică verificări de publicare pentru 440 resurse, 125 GeoJSON; verificarea proprie independentă a tuturor acestora nu a fost repetată în acest audit.
2. `.gitignore` exclude `node_modules/`, `dist/`, `.env`, `.env.*` (cu excepția `.env.example`), `.DS_Store`, `*.log`, `coverage/`, `.tmp/`. Excluderea nu demonstrează că astfel de fișiere nu sunt deja tracked.
3. Există infrastructură de păstrare a octeților dovezilor în `.gitattributes`; nu trebuie eliminată sau schimbată fără verificare hash byte-for-byte pe Windows și Linux.
4. Există `docs/repo-clean/prs.json`, dovadă că un audit anterior al PR-urilor este deja arhivat; nu se șterge fără verificarea dependențelor.
5. `search_branches` a returnat 15 nume: `main`, 10 branch-uri de audit/fix și 4 branch-uri Dependabot. Acesta este un instantaneu de enumerare API, nu dovadă că toate ramurile sunt ștergibile.
6. PR #398 (`OSM-FIX.2: separate current OSM source from protected ACTUAL`) este încă **open + draft + mergeable=false**, cu 199 de fișiere schimbate, inclusiv contractele `data/sources/osm-source-*.json`, workflow-uri și dovezi. **Nu îl integra, șterge sau rebase-ui automat în procesul cleanup**; necesită analiză funcțională separată.
7. În `docs/roadmap/autonomous-completion-register.json`, PRODUCT-LAUNCH și AUTO-1/AUTO-3 sunt marcate `POST_MERGE_VERIFIED`; cele 109 cazuri AUTO-4 rămân obligații documentare distincte, nu fișiere temporare de curățat.
8. `package.json` conține numeroase scripturi istorice de audit/import/build. Numele aparent depășite nu sunt suficiente pentru eliminare: workflow-uri, manifestele și programele reproductibile le pot invoca.

## Candidați de cleanup și condiții de acceptare
| Prioritate | Obiect | Acțiune permisă după probare | Verificare necesară |
|---|---|---|---|
| P0 | Secrete/loguri/date personale eventual tracked | Investigație read-only și izolare; remediere separată după evaluare | scanare tree completă + secret scanning, fără expunere valori |
| P1 | Branch-uri de audit vechi | ștergere numai dacă au fost integrate/închise, nu sunt baza vreunui PR, nu sunt folosite de CI și se păstrează referințe la commiturile probatorii | per-branch ahead/behind, asociere PR, referințe Actions, SHA |
| P1 | PR #398 | triere manuală a scopului/provenienței; alternativă close ca superseded doar dacă demonstrat | comparare cu main, verificare că nu se pierd contracte/surse |
| P1 | Fișiere temporare sau build artifacts tracked | ștergere într-un PR separat dacă sunt regenerabile, nu citite de runtime/CI și nu au rol probator | `git ls-files`, `git grep`, reproducer, hash, Pages |
| P2 | Workflow-uri duplicate/obsolete | consolidare numai dacă păstrează exact gate-urile obligatorii și acoperirea push/PR | inventar workflow și check names, branch protection, PR + push CI |
| P2 | Scripturi fără utilizare evidentă | eliminare după graful complet de referințe, testele de reproducere și auditul manifestelor | grep din workflows/package/docs + test complet |
| P3 | Dovezi și registre istorice | **păstrează** implicit; eventual index și compresie fără pierdere, într-un dosar arhivistic separat | proveniență, SHA-256, reproducere independentă |
| P3 | README și documentație navigațională | corectare de legături duble/învechite fără eliminarea surselor | link checker și comparație vizuală |

## Gate înainte de primul PR destructiv
- Inventar complet al tree-ului Git (mărimi, tipuri, număr de fișiere, obiecte mari, fișiere urmărite care corespund `.gitignore`).
- Hartă de referințe cod–script–workflow–runtime–dovezi; inventar branch și PR, inclusiv protecțiile.
- Baseline reproductibil pentru hashurile ACTUAL și `public/`, incluzând lista de 440 de resurse din auditul de lansare.
- Verificări de securitate, teste unitare, build, CI/PR, push post-merge și GitHub Pages.
- PR-uri mici, reversibile; nu se rescrie istoria Git ca parte a cleanup-ului obișnuit.

## Limitări ale acestui audit
Conexiunea de căutare GitHub nu a furnizat în această execuție un listing complet recursiv al tree-ului, mărimile Git pack și istoricul de referințe al fiecărui branch. Nu pretind că au fost detectate toate fișierele redundante și **nu recomand ștergerea unor căi concrete** înainte de aceste controale.

## Decizie
**SAFE CLEANUP READY FOR PLANNING; DESTRUCTIVE CLEANUP BLOCKED ON FULL TREE/REFERENCE AUDIT.** Website-ul publicat și ACTUAL nu au fost modificate.
