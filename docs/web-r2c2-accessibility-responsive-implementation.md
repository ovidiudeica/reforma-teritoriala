# WEB-R2c.2 — accesibilitate și adaptare desktop/mobil

**Domeniu:** implementare izolată a UX-03, UX-06 și UX-07 din `docs/web-r2c1-ux-ui-specification.md`. Bază: `main@92695fce1d082a23e1893419ab8763bceef0027e` / PR #386 integrat și post-merge PASS.

## Fluxul de confirmare accesibilă

1. **Previzualizare:** controlul „Afișează/Ascunde” deschide un grup inline cu `role=group`, `aria-describedby` asociat sumarului impactului C/E și `aria-controls`/`aria-expanded` pe declanșator; focusul merge la „Confirmă operațiunea”. Nu este dialog modal, nu capturează Tab.
2. **Renunță / Escape:** închid confirmarea fără mutații. `Escape` este gestionat de grupul inline, iar captura globală din `atlas-panels.mjs` respectă atributul generic `data-atlas-escape-owner` pentru această regiune; panoul de navigare nu se închide. Focusul revine la declanșator. Mesajul `role=status` este actualizat o singură dată, în limbaj clar.
3. **Confirmă:** focusul revine la declanșator indiferent dacă planul este valid, stale sau aplicarea produce eroare. Eligibilitatea, revalidarea atomică și toate mutațiile de bife rămân ale `atlas-osm-level-geometry-actions.mjs` (neschimbat).
4. **Undo:** păstrează comportamentul tranzacțional precedent și statusul deja calculat de `app.js`. Când Undo devine dezactivat după folosire, focusul revine la primul control OSM activ („Afișează”), nu rămâne pe un buton disabled. Reload, reset și URL/History nu primesc comportamente noi.
5. **ARIA:** un singur `role=status` pentru rezultatul unei acțiuni, separate de sumarul nemutat al previzualizării; focusul nu este trimis într-o regiune ascunsă.

## Layout, accesibilitate și compatibilitate

- Acțiunile OSM se adaptează fără overflow prin lățimi intrinseci limitate; cele două butoane din confirmare folosesc flex-wrap, 44 CSS px înălțime minimă și texte care pot trece pe rânduri distincte.
- `:focus-visible` are contur clar de 3 px și culoare de sistem în `forced-colors: active`; nu se suprascriu schemele cromatice pentru restul interfeței.
- Validare obligatorie desktop **1440×900, 900×768**, tabletă **768×1024**, mobil **430×932, 390×844, 360×800**, landscape **844×390, 390×600**, zoom 200%, tastatură (Tab, Escape, Enter) și forced-colors.
- `scripts/test/frontend-web-r2c2-a11y.test.mjs` intră în `frontend-geometry-taxonomy` CI obligatoriu; `scripts/test/frontend-web-r2c2-a11y-browser.test.mjs` rulează în Chromium `frontend-browser-qa` și arhivează capturi desktop/mobil și zoom/contrast.
- Sunt interzise mutațiile `data/`, `public/`, `atlas-url-state.mjs`, `atlas-osm-level-geometry-actions.mjs`, geometria NI, aliasurile NI și filtrarea statistică.
- Intervenția în `atlas-panels.mjs` este limitată la respectarea proprietății inline Escape la nivelul handlerului global capturant, fără schimbarea celorlalte scurtături sau panouri.

## Condiții de închidere

PR separat Draft; CI complet pe HEAD exact; dovezi Chromium cu capturi inspectabile; zero erori JS și zero overflow în grupul de confirmare; validare tab/focus/aria/status pe desktop și mobil; 8 contururi NI independente și 85 de roluri reutilizate fără geometrie nouă; confirmare fail-closed și Undo intacte. Merge numai după gate complet și integrare autorizată; audit post-merge și Pages obligatoriu, fără a pretinde verificări efectuate anticipat.

ACTUAL: snapshot imuabil `actual-a9e5a4ddcb5277ef`, fingerprint `a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446`; `actual_mutation_allowed=false`, `p91_import_allowed=false`, `semantic_acceptance=BLOCKED_INCOMPLETE`.
