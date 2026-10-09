# P5.0 — Explorator teritorial (prototip separat)

Interfață HTML/CSS/JS funcțională inspirată de explorarea OSM-Boundaries, **fără schimbarea paginii publicate**. Folosește direct modulele și fișierele publice ale atlasului ACTUAL RO+MD (`app.js`, `atlas-tree.mjs`, filtrele și release manifestul), fără copii sau editări ale datelor.

## Vizualizare locală

Din rădăcina repository-ului:

```sh
node scripts/p5-preview.mjs
```

Deschide adresa afișată de proces, de forma `http://127.0.0.1:PORT/prototypes/p5-navigation/`. Este necesar **HTTP**, nu `file://`: modulele ES și GeoJSON sunt încărcate prin `fetch`. Serverul este numai local și nu scrie date.

## Ce este funcțional

- Arbore **Ierarhie** cu două rădăcini reale, extindere lazy, breadcrumb, numărătoare descendenți, căutare și selecție cu zoom prin controller-ul public P4.
- Tab separat **Filtre**, toate grupurile/subtipurile și nivelurile statistice existente, jurisdicții RO/MD, aceleași reguli `OR`/ `AND` din codul public; badge pentru filtrele schimbate.
- Checkbox pe fiecare nod redat: activează/dezactivează o **suprapunere GeoJSON individuală** din tier/chunk/statistical-only public, fără simplificare și fără mutarea nodului în ierarhie. Selecția și checkboxul au stări diferite.
- Hartă Leaflet cu poligoane adevărate, zoom, selecție din hartă, butoane Ierarhie/Filtre și panou de detalii contextual.
- Panou lateral desktop **redimensionabil** (pointer sau taste săgeți/Home/End), taburi accesibile prin tastatură, navigare mobilă tip drawer cu Escape și map full-screen.
- Bară de selecție multiple cu număr și „Șterge”, limită de prototip **20 contururi** simultane.

## Limitări / restricții P5.0

- **Doar prototip:** `index.html` din rădăcină, `app.js`, `style.css`, ACTUAL/P2 și fișierele `public/`/`data/` nu se modifică.
- Suprapunerile individuale sunt **temporare pe durata sesiunii**, nu sunt adăugate la schema `atlas-url-state` și nu reprezintă o funcție finală de multiselect. URL/History existent pentru entitatea activă rămâne funcțional.
- Pentru a avea acces la instanța Leaflet din controller-ul actual, numai această pagină de prototip interceptează local apelul `L.map`; P5.1 trebuie să introducă o integrare explicită, nu să copieze hook-ul în producție.
- Suprapunerile respectă filtrele globale și jurisdicțiile. Dacă stratul administrativ/statistic este ascuns, un checkbox poate rămâne selectat în coș, dar conturul să fie momentan invizibil.
- Funcțiile ISTORIC și PROPUNERI sunt vizibile ca destinații viitoare, dar **dezactivate** până la publicarea corpusurilor lor.
- Nu sunt revendicate paritate pixel-perfect, certificare WCAG 2.2 AA sau redimensionare tactilă complet validată. Nu se simulează localități lipsă și nu se reinterpretează limitele OSM/ANCPI.

## Validare și review

```sh
node --test scripts/test/p5-navigation-browser.test.mjs
```

Suita folosește Chrome/Chromium local, verifică datele RO+MD, taburi, selecție vs checkbox, hartă și drawer, inclusiv capturi PNG în directorul temporar `atlas-p5-prototype-evidence`. Workflow-ul GitHub `P5 navigation prototype` publică imaginile ca artefact separat.

Specificația completă: [docs/p5-navigation-spec.md](../../docs/p5-navigation-spec.md). Auditul UX: [docs/p5-ux-audit.md](../../docs/p5-ux-audit.md).

**Flux de livrare:** P5.0 PR pentru review vizual → P5.1 integrarea shell-ului în `index.html`/producție într-un alt PR, păstrând required checks P4.
