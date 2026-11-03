# RT-VA1 — excludere semantică permanentă

Bază: `2928118c871d1d02ef7d2f364b6bd2e9d0344adb`.

Varianta A exclude din ACTUAL numai cele **123 de relații OSM non-CUATM pomicole** examinate individual: 122 prin regula `place=allotments`, una prin excepția documentată Î.P. „Mure Dulci” (`osm-r12104738`). Nu se aplică eliminări generale pe `admin_level=9`.

Surse arhivistice imuabile:
- `data/sources/actual-variant-a-exclusions.json`: lista per-ID și verificările semantice.
- `data/sources/actual-variant-a-original-allotments-123.json`: originalul registrului probatoriu, legat SHA-256.
- `data/current/md-cuatm-non-cuatm-allotments.json`: copie marcată `EXCLUDED_FROM_CANONICAL_ACTUAL_VARIANT_A`, cu `canonical_import_count:0`.

Regula `selectCanonicalVariantA` se aplică la importul OSM, înaintea construirii catalogului, geometriilor și arborelui. Orice modificare OSM a celor 123 sau apariția unor întovărășiri neverificate oprește importul.

## Inventar oficial regenerat

| Indicator | Bază | Variantă A |
| --- | ---: | ---: |
| Entități ACTUAL | 5.848 | **5.725** |
| RO | 3.246 | 3.246 |
| MD | 2.602 | **2.479** |
| Administrative și context (înaintea statisticilor separate) | 5.830 | **5.707** |
| UAT regionale și locale | 4.241 | 4.241 |
| Roluri statistice | 63 | 63 |
| Limite statistice separate | 18 | 18 |

Snapshot oficial: `actual-903b934850711dc7`. Fingerprint: `903b934850711dc7418e25087cb151a2c8d68f4746fdf761d0749ae63c52fd2e`.

P8.2 a recalculat din geometrie, fără filtrare artificială: 5.725 entități, 123 fișiere geometrice, 64.804 perechi evaluate, **661 suprapuneri** și zero erori. Indexul, fragmentele și frontierele sunt regenerate.

WEB-CARD.1: 5.725 fișe în 64 de fragmente, din intrarea originală de 5.848 cu SHA-256 verificat, excluzând exact cele 123. Identitățile și geometria celorlalte entități sunt păstrate.

## Protecția P9

Cele 153 de identități sensibile P9 nu intersectează cele 123 de ID-uri excluse. Controlul P9 păstrează verificările semantic-juridice și adaugă numai dovada că cele două GeoJSON-uri modificate sunt submulțimi exacte ale sursei: toate cele 123 de ID-uri eliminate sunt verificate și toate entitățile păstrate sunt identice.

Registrele RT-CANON.13.4 se păstrează ca dovezi: 304 dosare, 215 cereri, 267 ținte și 706 observații. Cele 44 de observații topologice pentru 26 dintre geometriile excluse rămân arhivate. Varianta A nu adaugă certificări juridice și nu schimbă parentajul.

**P9.1a: BLOCKED_INCOMPLETE. P9.1b: BLOCKED.** Nu există autorizare de import a entităților NI.

## Regula de integrare

Merge numai după toate verificările obligatorii PASS pe SHA-ul exact al PR-ului, inspecția regresiilor web/desktop/mobil și controlul publicării. Cardinalitățile din contractele valide sunt actualizate pentru noul inventar, fără suprimarea aserțiunilor de integritate.
