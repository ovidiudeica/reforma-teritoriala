# P5 — Specificația de navigare și explorare cartografică RO+MD

**Versiune:** P5.0 / design-review candidate · **Data:** 2026-10-09  
**Baseline obligatoriu:** P4.3 `main` `3f83d08ec5784afb98e7c266e557ed0e0e5b5c89`  
**Referință UX:** comportament inspirat de OSM-Boundaries (panou lateral, căutare, arbore, checkboxuri, hartă). Nu se copiază taxonomia OSM-Boundaries și nu se importă geometriile lui.

## 1. Principii și obiective

1. **Harta și ierarhia sunt două vederi ale aceleiași identități.** Nodul provine exclusiv din `actual-consolidated-hierarchy-v1`, geometria din release-ul public ACTUAL.
2. **Selectare ≠ extindere ≠ afișare pe hartă ≠ filtrare.** Acestea au controale și stări diferite.
3. **Statistica și administrația sunt roluri, nu entități duplicate.** Cele 45 coalesced au câte o identitate/un poligon și etichete pentru ambele roluri; cele 18 `statistical_only` rămân noduri distincte.
4. **Panoul este explorator**, nu o colecție de formulare lungi; harta este suprafața principală pentru geometrii.
5. **Nicio schimbare semantică mascată în UX.** P5 nu reface boundary matching, SIRUTA/CUATM, snapshoturi, fingerprinturi, geometrie sau release gate.

## 2. Structura informațională

| Zonă | Desktop | Tabletă | Mobil |
| --- | --- | --- | --- |
| Header | Brand, moduri ACTUAL / ISTORIC / PROPUNERI, indicator preview/release | Brand compact, moduri | Brand și corpus activ |
| Panou lateral | Inițial ~408 px; redimensionabil, min. 300 și max. 650, fără reducerea excesivă a hărții | Inițial ~345 px; redimensionabil | Drawer peste hartă, închis implicit; deschidere explicită |
| Date / dataset | ACTUAL RO+MD; număr entități și release | Identic, compact | Identic în drawer |
| Tab **Ierarhie** | Căutare, controale arbore, arbore full-height | Idem | Arbore cu scroll propriu |
| Tab **Filtre** | Jurisdicții, niveluri statistice, clase, subtipuri, limite separate; legendă și proveniență | Idem | Tab separat fără a pierde selecția |
| Hartă | Disponibilă permanent, controale pan/zoom/straturi | Identic | Full-screen în spatele drawerului |
| Detalii | Card contextual numai dacă există `selectedEntityId` | Card compact | Bottom sheet sau card după selecție |
| Bară de selecție multiplă | Număr suprapuneri individuale și acțiunea Șterge | Idem | Fixată în baza drawerului |
| Footer | Atribuirea OSM și identitatea oficială | Idem | Compact |

Modurile **ISTORIC** și **PROPUNERI** se afișează dezactivate până când există corpusuri publicate și propriile lor manifest/gates. Niciun fallback implicit către ACTUAL.

## 3. Contractul arborelui

- Sursa unică: descriptorul `manifest.public_contract.hierarchy.path`; încărcarea trebuie blocată dacă `validateConsolidatedHierarchy` eșuează.
- Două rădăcini obligatorii: România, Republica Moldova. Subordonare exclusiv pe `parent_id`/`child_ids`; **niciodată** ordonare/parenting după bbox, topologie sau simpla incluziune.
- Ordine de afișare: de la nivelurile statistice mari spre cele mici, apoi administrative până la localități, **în ordinea deja serializată de contractul de ierarhie**. Nu realocăm părinți pentru a obține un aspect anume.
- Eticheta primară este denumirea; eticheta secundară arată tipul administrativ și/sau NUTS/nivel statistic, codul oficial/statistic când există și numărul descendenților. Sibling-urile cu nume identice prezintă un ID disambiguator.
- Afișarea unui nod invizibil din cauza filtrelor nu îl șterge din ierarhie; îl marchează **„geometrie ascunsă”**. O entitate fără poligon conform policy rămâne selectabilă.
- Extinderea este lazy. Deschiderea până la adâncime respectă limita inițială P4 de ~550 de noduri; dacă se depășește, interfața anunță și cere o ramură mai îngustă.
- Breadcrumb-ul rezultatului selectat păstrează toți strămoșii; selectarea din hartă sau căutare deschide calea și dezvăluie rândul, fără scroll arbitrar al întregului panou.

### Contractul acțiunilor per rând

| Control | Acțiune | Nu trebuie să producă |
| --- | --- | --- |
| Chevron / summary | Deschide/restrânge doar copiii | Selecție automată, modificare filtre |
| Denumire / buton | `selectedEntityId` unic, detalii, zoom dacă există geometrie vizibilă | Adăugare/ștergere din coșul de contururi |
| Checkbox individual | Activează/dezactivează suprapunerea read-only a geometriei exacte | Modificare ierarhie, identity binding, filtru global |
| Checkbox de grup (P5.1+) | Activează contururile copiilor eligibili cu stare checked/indeterminate | Încărcare necontrolată a tuturor celor 5.848 geometrilor |
| Indicator nivel | Explică rolul și tipul | Crearea unei a doua identități statistice |

În P5.0 checkboxul individual are un **buget de 20 suprapuneri în sesiune**, iar panoul de selecție arată câte sunt active. Acesta este un prototip al controlului de afișare individuală; persistența lui și operațiile de grup sunt decizii P5.1/P5.2.

## 4. Taxonomia filtrelor și semantica

Ordinea tabului Filtre:
1. Jurisdicții: România (RO), Republica Moldova (MD).
2. Tipuri administrative și alte reprezentări, grupate după `createGeometryFilterIndex`; fiecare subtip poate fi activat separat, cu starea parțială a grupului.
3. Niveluri statistice 1/2/3 și `unclassified` dacă apare în contract; numărătoare total/reused/separate pentru RO și MD.
4. Comutatorul explicit **limite statistice separate**.
5. Opțiuni de hartă/legendă și informații de proveniență/release, în grupuri pliate.
6. Acțiuni rapide: Toate, Niciuna și Revenire la configurația implicită (P5.1). Indicator de diferențe active în bara de taburi.

**Regula de vizibilitate:**

`jurisdictionEnabled(entity.jurisdiction) AND geometryVisible(entity, options)`

Pentru entitate administrativă care are și rol statistic: `adminFilterVisible OR statisticalLevelVisible`. Pentru `statistical_only`: `statisticalLevelVisible AND separateStatisticalGeometry`. Comutatorul de limite separate **nu** ascunde geometria coalesced. Checkboxurile individuale creează un strat separat și respectă porțile globale, fără să schimbe această logică.

## 5. Căutare, URL/History și modurile viitoare

- Căutare după nume, SIRUTA, CUATM, OSM relation/entity ID și cod statistic, folosind **indexul ACTUAL P4 validat**, fără un nou index generat. Rezultatele ascunse de filtre sunt găsite și marcate.
- Tastatură: săgeți sus/jos, Enter, Escape și statut `aria-expanded` pentru listboxul de rezultate; Enter selectează entitatea și dezvăluie calea.
- Pentru pagina principală, `atlas-url-state.mjs` v1 rămâne sursa unică a parametrilor `v,e,lat,lon,z,j,s,b,f,t` și a comportamentului History. **P5.0 nu schimbă schema URL v1**, nu persistă selecțiile individuale și nu inventează parametri suplimentari.
- Înainte de P5.1, decideți versiunea schemei pentru `visibleOverlayIds` (liste limitate, validare, canonicalizare, URL length budget) și pentru tabul deschis; testați Back/Forward, deep-link cu geometrie ascunsă și URL malițios/invalid.
- ISTORIC și PROPUNERI au index, ierarhie, contract geometrie și gate proprii. Nu apar ca filtre ACTUAL.

## 6. Cartografie, layering și performanță

- Leaflet și GeoJSON reale, folosind **doar** `release.manifest.public_contract` și `actual-geometry-chunks-v1`; zero redesenare/simplificare sau conversie de coordonate. CRS master rămâne EPSG:4326.
- Statisticele separate rămân în pane dedicat (baseline z-index 450) peste limitele administrative (400). Pentru suprapunerile individuale și highlight-ul selectat, P5.1 definește o matrice de z-order și reguli clare la suprapunerea geometriilor.
- Folosiți doar geometria tier/chunk corespunzătoare identității; chunk-urile se încarcă la nevoie și se cache-uiesc per path. Praguri P4: local de la zoom 7, detail de la 10, dar selecția unui ID poate cere încărcarea geometry on-demand.
- Nevoi minime de CI: niciun fetch dublat după schimbarea filtrelor; DOM nu materializează 5.848 rânduri pe expand-all; eticheta de stare nu blochează harta; zero erori JS și zero diferențe geometrice.
- Prototipul reutilizează **`app.js` fără modificări** și capturează obiectul Leaflet map numai printr-o integrare temporară izolată. Acest hook **nu este designul final**; P5.1 trebuie să folosească o interfață explicită de map controller.

## 7. Accesibilitate și comportament responsive

- **WCAG 2.2 AA ca țintă de acceptanță** pentru integrarea în producție: semantică tablist/tabpanel, focus vizibil, minimum 44×44 px pentru controalele tactile din mobil, etichete pentru checkbox/chevron, status live, contrast verificat și respectarea `prefers-reduced-motion`.
- Taburi: Left/Right/Home/End schimbă tabul și mută focusul; când panoul Filtre este ascuns, nu poate fi focusat prin tastatură.
- Drawer mobil: deschis la cererea utilizatorului, Escape închide, focus la căutare, revine la declanșator, nu mută sau ascunde entitatea selectată.
- Redimensionare desktop: pointer + săgeți/HOME/END pe separator; aria-valuenow, limită 300–650 px și minim 260 px păstrat pentru hartă; resize al obiectului Leaflet.
- Detalii: afișate numai după selecție, fără a acoperi permanent harta; nu sunt ascunse complet când indicatorul de geometrie e absent (utilizatorul poate vedea identitatea).
- Viewporturi de verificat: 360×800, 390×844, 430×932, 720×900, 900×768, 1280×800, 1440×900; fără overflow orizontal.

## 8. Fluxuri de acceptanță și criterii P5.1

1. Deschid pagina fără selecție; văd RO+MD și arborele cu cele două rădăcini, pot căuta imediat.
2. Extind România până la județ și localitate fără a selecta accidental o limită.
3. Selectez o entitate cu rol NUTS 3 și administrativ; un singur ID, roluri în același rând, URL și highlight corecte.
4. Dezactivez filtrul administrativ, păstrez statisticul: conturul coalesced rămâne; dezactivez și statisticul: devine ascuns, dar rămâne în arbore.
5. Adaug două geometrii în coșul de contururi, le pot scoate individual; checkboxul nu schimbă selecția curentă.
6. Trec din Ierarhie în Filtre și înapoi fără a pierde selecția și calea deschisă.
7. Pe mobil: deschid tabul Filtre din hartă, schimb jurisdicția, revin la Ierarhie și închid drawer-ul cu Escape.
8. Pe desktop: redimensionez navigarea atât cu pointerul, cât și cu tastatura, păstrând mapa vizibilă.
9. URL deeplink/History reproduce aceeași identitate și aceleași filtre, fără drift de nivel statistic (pentru implementarea P5.1).
10. Toate verificările P4 existente (6 required checks), plus suita P5 nouă, rulează pe PR fără modificări în `public/` sau `data/`.

## 9. Plan propus de integrare după review

- **P5.0 (acest PR):** audit, specificație, prototip izolat și QA propriu. Nu modificați producția.
- **P5.1:** shell navigare public, taburi, responsive, resize și detalii; mențineți controller-ul și filtrele P4, cu teste A/B și browser.
- **P5.2:** selecții geometrice individuale persistente, operații bulk limitate, strat de suprapuneri cu controller explicit și URL/versioning.
- **P5.3:** rafinare a11y, performanță și regresii Chrome/CDP pe viewporturi și istoricul browserului.
- **P5.4:** hardening, QA pe Pages și closure.

**Definiția acceptării P5.0:** un PR separat cu surse HTML/CSS/JS deschise direct prin HTTP, audit UX, această specificație, smoke Chrome pe datele reale, imagini de dovezi și diff strict negeometric. Acceptarea aspectului vizual aparține beneficiarului înaintea migrării către aplicația publică.
