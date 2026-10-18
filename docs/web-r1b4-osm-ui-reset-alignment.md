# WEB-R1b.4 — eliminarea controalelor OSM redundante și alinierea resetărilor

## Schimbare de interfață

- Entități: eliminarea comenzii „Nistrenia · OSM”, a grupării popover și a accordion-ului „Opțiuni arbore” rămas fără alte opțiuni. Butonul „Resetează geometriile” este afișat direct la începutul panoului.
- Filtre: eliminarea catalogului vizibil „Roluri cartografice OSM 85”. Butonul „Resetează filtrele” folosește aceeași poziție, lățime, spațiere, aliniere și înălțime minimă de 44px.
- Butonul „Resetează geometriile” din bara Leaflet cu zoom nu este mutat, eliminat sau modificat și rămâne legat de același handler de reset.

## Contract de conservare

- Catalogul `public/data/p907216-osm-roles.json` (85 de relații) rămâne intact, este verificat la bootstrap și este utilizat pentru proveniența în cardurile entităților.
- Catalogul `public/data/p909-nistrenia-osm-navigation.json` rămâne intact și verificat, alimentând arborele operațional Nistrenia cu șapte subdiviziuni și 85 de roluri. Fără geometrii duplicate.
- `renderOsmRoleDetails`, identitatea ACTUAL și explicațiile juridice din carduri rămân intacte.
- Nicio schimbare la URL, selecție, logică de resetare sau filtrare, controlul OSM basemap, API-ul hărții, snapshotul ACTUAL, fingerprint și autorizarea P9.1.

## Acceptance gates

1. Chromium P9.0.7.2.16 și P9.0.9 trebuie să verifice proveniența pe entități reale, 7 raioane și lipsa celor două interfețe redundante, fără schimbarea datelor.
2. WEB-R1b Chromium verifică resetările în aceeași poziție, aceeași lățime și ținte >=44px la 1440×900, 390×844, 844×390, 640×360. Controlează existența resetării hărții, care nu este relocată.
3. Sunt obligatorii toate testele existente P7.2–P7.6, P9.0.9.5, browser QA, CodeQL, P8.2/3/4, proveniența, ACTUAL, read-only changes și verificările post-merge.
4. Capturile de regresie A/B, incluzând mobile landscape, trebuie inspectate înainte de merge. Fără reducerea criteriilor.

**Gate:** PR Draft până la PASS complet; ACTUAL nemodificat și P9.1 blocat.
