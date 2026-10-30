# RT-ADM.2.4 — acces alternativ IPCBI și procedura oficială (2026-10-30)

## Rezultatul examinării

- GeoServer oficial `https://map.cadastru.md/geoserver/index.html` declară WMS 1.3.0/1.1.1 și WFS 2.0.0/1.1.0/1.0.0, acces anonim la patru spații de lucru și 30 de straturi. Această pagină **nu** garantează disponibilitatea stratului necesar sau accesul la operațiile WFS.
- Testul executat de RT-ADM.2.4 în GitHub Actions pentru `https://map.cadastru.md/geoserver/ows?service=WFS&version=2.0.0&request=GetCapabilities` a primit HTTP 403 (artifact 12946683009, run 40985833260). Alternativele documentate `/geoserver/wfs` și versiunile WFS 1.1.0/1.0.0 sunt intrări documentate de server, dar încă **nu au XML GetCapabilities descărcat și verificat** în cadrul acestui audit. O restricție de acces nu este autorizație de ocolire.
- IPCBI `https://www.ipcbi.gov.md/ro/e-cadastru` publică un canal distinct „Accesarea informațiilor publice din Registrul de stat al unităților administrativ-teritoriale și al adreselor” și exportul planurilor cadastrale; navigarea acestor canale necesită verificarea regulilor, iar datele rezultate trebuie arhivate și datate.
- Serviciul oficial specific `https://www.ipcbi.gov.md/ro/eliberarea-informatiei-grafice-cu-privire-la-hotarele-unitatilor-administrativ-teritoriale` oferă date grafice/textuale în format digital pentru hotare UAT, intravilan și întovărășiri pomicole. Termen afișat: 3 zile lucrătoare; tarif afișat: 80 lei. Solicitarea este descrisă ca depunere la ghișeul centrului multifuncțional competent; persoanele fizice/juridice plătesc. Nu se confundă cu lucrările noi de stabilire a hotarelor (serviciu separat, altă eligibilitate/cost).
- Comunicatul IPCBI din 23 iunie 2026 `https://www.ipcbi.gov.md/ro/comunicate-de-presa/unde-si-cum-pot-fi-solicitate-actele-cadastrale-procedura-de-depunere` indică ghișeele centrelor multifuncționale sau serviciile cadastrale teritoriale dacă serviciul nu poate fi accesat online.
- Contact pentru clarificarea accesului/formats: `info@ipcbi.gov.md`; din străinătate `+373 22 25 70 70`; administratorul GeoServer publicat `andrei.sirbu@ipcbi.gov.md`. **Nicio cerere și niciun mesaj nu au fost transmise, niciun tarif plătit.**

## Obiectele exacte și întrebările cererii

1. **Bondareuca** — CUATM 8961, comuna Zgărdești 8960, OSM relation 18967570. Se solicită geometrie oficială *a localității* și documentul/actul aprobării hotarului, cu identificator și perioadă de aplicabilitate.
2. **Etulia, localitatea stație de cale ferată** — CUATM 9639, Etulia 9629, OSM relation 18968043. Se solicită delimitarea exactă a localității distincte, eventualele componente separate ale conturului, rolurile topologice, actul și data.
3. **Obiectul fără nume OSM relation 12104636** — în zona Hrușova, fără atribuire oficială. Se întreabă dacă în RSUATA există *vreo întovărășire pomicolă* cu hotare în aria indicată, cu identificator, denumire, statut, dată și act. Numai dacă există dovadă pozitivă se solicită geometria acesteia. Identitatea nu se deduce din etichetele istorice OSM.

Pentru fiecare: format vectorial (GeoPackage/GeoJSON/SHP dacă disponibil), CRS/EPSG, precizie, sistem de referință, ID RSUATA/cadastral, metadate de versiune, dată de valabilitate, număr/emitent act de aprobare, condiții de reutilizare și eventuala posibilitate de acces WFS/serviciu web. Solicitarea unei istorii la 2025-10-05 și la datele snapshot OSM trebuie explicit marcată ca separată de versiunea curentă.

## Gate

**NEACCESAT:** nu a fost recuperat un vector oficial datat. **NEEXECUTAT:** overlay OSM–juridic. Până la obținerea unor date și acte verificabile, `NO_CHANGE_PENDING_PRIMARY_EVIDENCE`. Fără reparentare, binding, schimbare de rol, geometrie ACTUAL sau deblocare P9.1.
