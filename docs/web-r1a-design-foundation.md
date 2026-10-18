# WEB-R1a — fundamentul design system, prima tranșă

**Bază:** `main` `7177cadcc64913b2822fa29b43a10ebbcc1665bb` (WEB-R0 PR #368 integrat).  
**Domeniu:** exclusiv frontend CSS/HTML, test static și documentație; fără schimbări de behavior/semantics, geometrii, filtre, ID-uri DOM, fluxuri de date sau URL/history.

## 1. Obiectiv și limită

Introducerea unui strat comun de **design tokens** înainte de refactorizarea reală a panourilor. Acest PR **nu** pretinde că uniformizarea vizuală finală este gata. Modificările proiectate (panouri extensibile, buton de închidere X, bara Leaflet și rail reordonate, admin_level badge/filtre) rămân în loturile WEB-R1b/WEB-R2.

Au fost centralizate fără schimbarea valorilor calculate inițiale:
- font-stack existent (nu introduce font extern);
- roluri de tipografie: titlu aplicație 16px, titlu panou 17px, titlu card 18px (16px mobil), heading secțiune 11px, corp 13px, metadate 12px, overline 10px, action 12px, mobile-action 13px, icon închidere 24px;
- culorile principale/focus/suprafețe și stările acțiunilor, păstrând paleta existentă;
- geometria țintei tactile 44px și razele butoanelor 5px/6px.

`index.html` încarcă `atlas-design-tokens.css` înainte de `style.css`. `style.css`, `atlas-explorer-shell.css`, `atlas-tree.css` și `atlas-panel-content.css` migrează numai selectori bine identificați către `var(...,fallback)`. Aliasele legacy `--atlas-text` / `--atlas-focus` / restul rămân disponibile. Mărimile, flow-ul și overflow-ul sunt concepute să rămână identice. Nu se șterg controale; nu se schimbă definiția butonului „Închide” până la proba browser R1b.

## 2. Dovezi și controale

Test nou: `node --test scripts/test/frontend-web-design-tokens.test.mjs`. Acesta verifică ordinea foii de stil, valorile tokenurilor, migrările efective și prezența ID-urilor DOM de navigare/Leaflet. Este test **static**; nu demonstrează singur echivalența pixel cu pixel.

Înainte de integrare se cer:
1. Diff limitat la `atlas-design-tokens.css`, `index.html`, `style.css`, `atlas-explorer-shell.css`, `atlas-tree.css`, `atlas-panel-content.css`, acest document și testul nou.
2. Teste locale dacă runnerul disponibil permite, apoi toate checkurile required GitHub, inclusiv Chromium/browser, P8.2, P8.4, CodeQL, ACTUAL.
3. Browser A/B pe 10 viewporturi, desktop/telefon, landscape/portrait, text 200%, focus și contrast. În particular P7.2 (640×360) și P7.6 (360px, 200% text) trebuie să rămână PASS. Dacă nu se pot inspecta capturile personal, nu pretinde închiderea acceptării vizuale manuale.
4. Pentru web, nu modifica datele. Sunt interzise modificările în `data/`, `public/`, `vendor/`, `schemas/`, workflow-uri sau gate-uri P9.1; compare împotriva bazei este dovada.
5. Dacă rulările CI sunt `pending`, nu integra. Nu ocoli branch protection.

## 3. Backlog immediate WEB-R1a/R1b

- Audit per-component pentru toate mărimile/culorile; mapează celelalte stiluri de tipografie și butoane la tokenurile unice fără eliminarea regulilor de accesibilitate/contrast. A/B Chromium.
- Construiește convenție pentru butoane: icon-only pentru close/copy/fit, icon+text pentru operații clare, text+icon sau label explicit pentru destructive; componentele trebuie să **arate și să se comporte ca butoane**.
- `#drawer-close` → simbol X cu aria-label relevant și țintă minimă 44px; `#details-close` rămâne semantic corect (close vs clear selection) după audit callback.
- Mută tiparele de `details/summary` și control expand către o singură implementare vizuală de accordion, fără să ascunzi căutarea/arborele principal sau alertele.
- Abia apoi reordonează rail și bara zoom/fit/basemap cu regresii `aria-pressed`, Escape și touch.

## 4. Protecții permanente

ACTUAL: 5.848 identități, 85 roluri geometrii reutilizate, surse/manifest/release, snapshot `actual-a9e5a4ddcb5277ef` și fingerprint `a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446`, fără schimbări.

Nistrenia: 8 contururi source-only independente, afișare implicită ROOT NI alături de RO/MD, descendenți OFF. `p91_import_allowed=false`, `semantic_acceptance=BLOCKED_INCOMPLETE`, `actual_mutation_allowed=false`. Codul R1a nu scrie în aceste date și nu autorizează P9.1.

Document de referință: [WEB-R0 roadmap](web-modernization-roadmap.md), [audit](web-r0-interface-audit.md), [matricea de acceptare](web-r0-acceptance-matrix.md).
