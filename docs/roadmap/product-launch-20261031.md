# Lansarea funcțională a atlasului — 31 octombrie 2026

Bază: main după PR #485–#487, `9a4d364cff45e3d1431f7c8d5ee9ea8e3f3d4db0`. Prioritatea utilizatorului este produsul funcțional. Acest document înlocuiește ordinea de execuție orientată spre cercetare din roadmap, fără să închidă sau să rescrie constatările auditurilor.

## Domeniul primei lansări

ACTUAL: explorare read-only a corpusului acceptat România / Republica Moldova, hartă, arbore administrativ și statistic, căutare, filtre, selecție, încadrare, detalii, identificare, instrumente geometrice, exporturile existente și partajare URL. Nistrenia rămâne o perspectivă cartografică operațională OSM, separat de identitatea juridică MD. Nu schimbăm ACTUAL, sursele, ierarhiile, snapshotul sau fingerprintul; nu autorizăm P9.1.

ISTORIC este amânat explicit. Repository-ul nu are un corpus publicat de unități istorice cu epoci, ierarhii și geometrie pentru modul. Reconstrucțiile unor versiuni OSM din octombrie 2026 sunt dovezi de audit; nu sunt un atlas al organizărilor teritoriale istorice. Activarea unui buton care ar reutiliza ACTUAL ca ISTORIC ar induce în eroare. Absența corpusului istoric este o limită de funcționalitate, independentă de certificarea juridică exhaustivă.

## Auditul produsului și acoperirea

1. Website public examinat în IAB: harta RO/MD/NI încarcă, arborele răspunde; căutarea `Bucuresti` găsește București și cele șase sectoare, fără diacritice. Selectarea Sectorului 1 păstrează conturul ascuns până la bifarea explicită. Cardul separă identitatea oficială, rolul statistic și reprezentarea cartografică. Starea este partajabilă prin URL.
2. Zoomul unei entități exista într-un accordion cartografic închis. Îl mutăm la începutul cardului, fără să schimbăm semantica: încadrarea nu activează geometria și nu schimbă filtrele. Nu era o funcție absentă.
3. Modulele afișau doar o promisiune generică. Acoperirea și amânarea ISTORIC devin vizibile în produs. Corpus public: **5.848** înregistrări, **3.246 RO / 2.602 MD**, inclusiv 18 înregistrări statistice separate; nu sunt 5.848 de UAT-uri juridice distincte. NI: 8 contururi source-only și 85 de roluri pe geometrie existentă, fără identități ACTUAL noi.
4. Teritorii/straturi amânate: toate epocile și unitățile istorice din ISTORIC; localitățile componente RO fără contur în corpus; alte teritorii în afara corpusului RO/MD. Nu afirmăm inventarierea exhaustivă a tuturor localităților istorice sau actuale. Limitele comune și cazurile de reprezentări multiple păstrează etichetele existente. Brețcu are fallbackul ANCPI acceptat, nu se înlocuiește prin Ojdula. București este reprezentat la nivelul OSM excepțional documentat, nu este absent.
5. Corpusul ACTUAL și controalele sale existente acoperă 123 de resurse geometrice și 5.848 de ID-uri. Validarea de corpus existentă verifică legătura la resurse și identificarea spațială. Nu repetăm inventarul OSMB de 6.129, auditul celor 298 ori investigațiile celor 109.
6. Auditul vizual inițial include desktop și previzualizare telefon; acceptarea responsive folosește suplimentar viewporturi native în Chromium. Capturile nu constituie certificare WCAG sau test pe dispozitive fizice. Nu s-a identificat un defect critic reproductibil al interfeței în aceste fluxuri; absența unei observații nu dovedește absența tuturor defectelor.

## Roadmap minim, în ordinea dependențelor

| Etapă | Criteriu obligatoriu | Dovadă |
|---|---|---|
| L1 — domeniu și audit | acoperire și amânări explicite; cercetarea juridică nu blochează lansarea | prezentul document, registrul central |
| L2 — interfață | încadrare directă; acoperire vizibilă; selecție/filtre/bife independente pe desktop și mobil | `frontend-launch-browser.test.mjs`, capturi |
| L3 — calitate | toate verificările PR obligatorii și relevante reușite, fără relaxare CI; CodeQL, securitate, geometrie, browser | rulări legate de SHA exact al PR |
| L4 — integrare | PR separat integrat numai după L3; toate verificările push post-merge reușite | SHA merge și receipts |
| L5 — publicare | octeții tuturor resurselor runtime publice corespund checkoutului; E2E Pages pe SHA integrat, desktop/mobil și limite cartografice valide | audit publicat și capturi după integrare |
| L6 — acceptare | raport cu SHA, CI, publicare, limitări și amânări; `READY` numai când L1–L5 trec | dosarul de acceptare |

## După lansare

- Primul corpus ISTORIC, cu epoci, surse, geometrie și ierarhii distincte, apoi activarea modulului; nu necesită finalizarea cercetării juridice pentru toate limitele ACTUAL.
- PROPUNERI, interfață engleză, indicatori statistici temporali și KML/KMZ/My Maps se livrează separat; exporturile GeoJSON/SVG/raport existente nu sunt etichetate KML/KMZ.
- Extinderea localităților/teritoriilor și orice nou corpus cer proveniență și acceptare proprie. Promovarea în ACTUAL cere autorizare separată.
- Cele 109 AUTO-4 rămân REVIEW_REQUIRED. Se redeschid doar contradicții demonstrate sau impact critic asupra produsului. CAPTCHA RNONG, originale normative și alte lacune documentare rămân dependențe externe, fără ocolire și fără blocarea primei lansări.
- Cercetarea NI-JUR/OSM-ACQ și P9.1 rămâne separată de acceptarea web. Auditurile deja închise și dovezile lor se păstrează.

Stare la pregătirea modificării: **candidat de lansare, nu acceptare finală**. Rezultatele CI și publicării se consemnează după execuție, niciodată prin anticipare.
