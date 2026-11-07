# WEB-R3.2 / WEB-R3.3 — contract de interfață și audit

Baza: `main@df2e63f81351f144b6396e65f54a11b6b8d62e7f`.
Domeniu exclusiv frontend; datele ACTUAL, identitățile, geometriile, topologia și dovezile probatorii rămân nemodificate.

## Arhitectură WEB-R3.2

- Hartă: numai Leaflet zoom +, zoom − și reîncadrare România–Republica Moldova.
- Filtre → «Aspectul hărții»: butonul de fundal OSM în `details` nativ, închis inițial; selectarea geometriilor și filtrele nu sunt afectate.
- Entități: un singur buton «Resetează geometriile», la aceeași poziție ca «Resetează filtrele» în Filtre.
- Bara de navigare: cinci acțiuni primare, inclusiv «Mai multe»; pe desktop celelalte iconuri apar la cerere ca pe mobil. Fără panouri persistente pentru module sau detalii fără selecție.
- Opțiunile de măsurare, comparație și evidențiere a vecinilor sunt controale *contextuale* când utilizatorul activează efectiv acele funcții, nu elemente permanente ale barei hărții.
- Testele istorice rămân păstrate în istoricul Git; aserțiunile active P6.4.1/P6.4.2/P7.5/P8.0.2 se actualizează la noul contract, fără rescrierea fișelor istorice.

## Criterii WEB-R3.3

Audit obligatoriu în Chromium: 1440×900, 390×844, 844×390, 768×1024.
Verifică geometria și atingerea comenzilor (minim 44 CSS px), starea inițială, panourile Entități / Căutare / Straturi / Filtre / Module, bara «Mai multe», Escape și revenirea focusului, filtrele RO/MD, OSM independent, selecție și ștergerea selecției, erori JavaScript și cereri HTTP interne.

Artefacte: `web-r33-audit.json` și capturi `web-r33-*.png` din `atlas-browser-evidence`.

**Regulă de acceptare:** WEB-R3.3 este PASS numai când suitele browser și toate verificările obligatorii CI sunt terminal SUCCESS pe SHA-ul exact, capturile desktop/mobil sunt inspectate efectiv și nu există regresii vizuale sau funcționale; până atunci verdictul este NEÎNCHIS. Nu se face integrare automată.
