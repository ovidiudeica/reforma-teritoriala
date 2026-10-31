# CLEANUP-2.1.2 — revizuire aprofundată a celor 258 de candidați

Sursa: artefactul autentic GitHub Actions `cleanup-2-1-reference-graph`, run `41239091376`, artifact ID `13055869363`, SHA analizat `116b9412c037c14193f2593847fa2a74f360ac88`.

## Repartizare pe funcții (fără concluzie automată de eliminare)
- Documentație: **189** fișiere; verificarea referințelor literale nu identifică toate legăturile arhivistice.
- `scripts/test/`: **27**; testele pot fi descoperite prin pattern-uri, npm sau comenzi manuale.
- `scripts/audit/`: **19**; reproductibilitate istorică, păstrare implicită.
- `scripts/lib/`: **8**; biblioteci ce pot fi importate relativ, scanarea folosește doar path complet.
- `scripts/process/`: **2**; include un placeholder `.gitkeep`.
- `prototypes/`: **3**; prototip P5, candidat la arhivare, **nu ștergere demonstrată**.
- Alte **10**: `.github/` 2, `data/` 2, `tools/` 2, `schemas/` 1, `.gitattributes` 1, `.gitignore` 1 și `SECURITY.md` 1.

**0 fișiere certificate neutilizate și ștergibile**. 258 reprezintă *neidentificarea unor referințe explicite*, nu lipsa de utilizare.

## Cazuri concrete ce cer analiză de dependențe înainte de cleanup
- `.github/dependabot.yml`: configurare automată GitHub, chiar fără referințe în cod.
- `.github/ISSUE_TEMPLATE/territorial-entity.md`: referit din interfața GitHub, nu ca import JS.
- `.gitattributes` și `.gitignore`: influențează hashurile dovezilor, respectiv fișierele care se înregistrează.
- `schemas/entities.schema.json`: poate valida date fără legătură textuală directă.
- `scripts/test/fixtures/malcoci-reviewed-current-osm.json` (87.080 B): fixture probatoriu.
- `scripts/audit/rt-audit1-2-final.mjs` și celelalte audituri RT: reproducerea certificărilor.
- `prototypes/p5-navigation/app.js`, `style.css`, `test/prototype.test.mjs`: candidați pentru *deprecation/archival review*, numai după căutarea completă în istoric, CI, docs și demonstrarea absentei dependențelor.
- `data/historical/.gitkeep`, `data/proposals/.gitkeep`: directoare rezervate pentru module viitoare.

## Limite ale verificării
CLEANUP-2.1.1 a folosit scanare de subșiruri de căi; nu rezolvă expresii `import '../...'`, `require()`, importuri dinamice, wildcard-uri, `node --test`, globuri, URL-uri calculate, liste de resurse din HTML, atașamente GitHub și dependențe de provenance receipt. Nu se pot elimina fișiere pe această bază.

## Gate pentru integrarea PR #491
1. SHA nou cu prezentul raport: așteaptă toate verificările obligatorii finale de GitHub Actions.
2. Inspectează artefactul `cleanup-2-1-reference-graph` al SHA nou și confirmă terminarea scanării.
3. Trecerea PR din Draft în Ready doar după succesul tuturor controalelor și acceptarea că este **doar un audit read-only**.
4. Merge cu `expected_head_sha`, apoi verificare post-merge pe `main`.
5. CLEANUP-2.2 este PR separat, pentru navigație/documentație, fără ștergeri de dovezi.

ACTUAL nemodificat, P9.1 neautorizat.
