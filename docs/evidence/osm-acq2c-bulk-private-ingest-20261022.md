# OSM-ACQ.2c — import istoric bulk offline, fără promovare

Acest PR conține **instrumentar preparator**, nu o captură bulk executată sau o adjudecare de relații. Pentru restul de 2.830 de dependențe directe (plus închiderile way→node), cele două fișiere istorice regionale RO/MD **nu sunt disponibile** în această sesiune și nu se improvizează conținutul lor.

## Furnizori, drepturi și proveniență

Geofabrik publică formatul `.osh.pbf` ca istoric regional săptămânal, disponibil pe serverul **intern**, cu autentificare OSM OAuth2. Conține metadate de contribuții care pot avea caracter personal. Nu copiați fișiere `.osh.pbf`, extracțiile originale sau identificatorii contributorilor în repository-ul GitHub public, în artifacte publice CI sau în GitHub Pages. Este necesară o descărcare cu propriul cont OSM autorizat, respectarea licenței ODbL și a condițiilor de acces, stocare privată criptografic verificată și evidența datei/provenienței. Nu solicitați ocolirea autentificării.

Surse:

- https://download.geofabrik.de/technical.html
- https://download.geofabrik.de/europe/romania.html
- https://download.geofabrik.de/europe/moldova.html
- https://blog.geofabrik.de/index.php/2024/02/15/internal-download-server-now-on-oauth2/
- https://operations.osmfoundation.org/policies/api/
- https://docs.osmcode.org/osmium/latest/osmium-getid.html
- https://docs.osmcode.org/osmium/latest/osmium-time-filter.html

Alternativa OSM full-history planet are ~152 GB comprimat și este o sursă autentică, însă costul de transfer/procesare și acoperirea integrală trebuie planificate explicit. Variantele Geofabrik **pot fi tăiate spațial** și nu garantează recuperarea tuturor relațiilor transfrontaliere; absența rămâne UNKNOWN, nu OUT_OF_SCOPE.

## Rulare în spațiu privat

Pe un host autorizat cu `osmium-tool` instalat, montați originalele în afara repository-ului la:

```text
/tmp/reforma-osm-history/RO.osh.pbf
/tmp/reforma-osm-history/MD.osh.pbf
/tmp/reforma-osm-history/manifest.json
```

Manifestul **privat** conține `epoch="2026-10-20T20:23:47Z"`, iar fiecare `sources.RO/MD` conține `sha256` SHA-256 original verificat, `format="osh.pbf"`, `authenticated=true` numai după autentificare OSM autentică. Originalele nu se acceptă din simple hashuri fără dovada provenienței și semnătura furnizorului, dacă există; păstrați și HTTP Date, ETag, Content-Length, digest publicat, contul autorizat (numai în locație privată).

```bash
python scripts/audit/test_osm_acq2c_bulk_osh.py
python scripts/audit/osm_acq2c_bulk_osh.py --plan-only
python scripts/audit/osm_acq2c_bulk_osh.py
```

Scriptul verifică SHA-256 în streaming **înainte de scriere**, creează o listă deterministă a ID-urilor, folosește `osmium getid --with-history --add-referenced`, apoi `osmium time-filter` la epoca exactă; păstrează subextrasele și raportul de închidere în `/tmp/reforma-osm-history-replay` privat, refuză suprascrierea, verifică coliziunile între domenii și inventariază lipsurile relație→way→node. **Nicio cerere către API-ul principal OSM**, nicio modificare a ACTUAL, niciun upload public.

## Limită explicită

`DEPENDENCY_CLOSURE_CANDIDATE` înseamnă numai că referințele declarate au fost găsite în cele două snapshoturi istorice. **Nu este un verdict cartografic, o certificare Overpass, nici dovadă juridică**. Etapele ulterioare obligatorii: integritate original per obiect, epocă/versiuni, replay geometric cu aritmetică exactă, compararea semanticii Overpass pentru toate ID-urile, A/B, sursă completă și validare CI. Niciuna nu este presupusă din succesul testelor sintetice.

ACTUAL (5.848 / 32), părinții MD, host-trust, pragul de 14 zile și P9.1 rămân nemodificate. Issue #396 OPEN.