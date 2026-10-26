# WEB-NI-U1.5 — dosarul de acceptare Moldova–Nistrenia

Acest dosar separă acceptarea interfeței de certificarea juridică și de calificarea sursei OSM. Nu modifică ACTUAL, modelul documentar NI, părinții MD sau geometriile. Issue #396 rămâne deschis; închiderea administrativă a #442 nu reprezintă certificare juridică.

`WEB-NI-U1-FINAL-ACCEPTANCE.md` explică release-ul funcțional verificat și limitele dovezilor. Registrele per-ID păstrează cele 93 de resurse canonice, 242 de noduri documentare și 85 de referințe auxiliare. Catalogul cartografic nu este o a zecea unitate administrativă.

## Reproducere

Din rădăcina repository-ului:

```sh
node scripts/audit/ni-fin-u1-acceptance-dossier.mjs --check
node --test scripts/test/ni-fin-u1-acceptance-dossier.test.mjs
```

Fără `--check`, generatorul regenerează numai registrele din acest dosar și manifestul său. El verifică din nou cele 32 de componente protejate, originalele locale de geometrie și chitanțele publicării. Nu accesează rețeaua și nu scrie date ACTUAL.

`sources/` conservă rapoartele JSON autentice și referințele la workflow-uri/artifacte, nu copii ale arhivelor binare. ID-ul artifactului, digestul ZIP verificat independent și SHA-ul sursă sunt păstrate separat. Capturile rămân în artifactele Actions, supuse termenului lor de retenție; existența unui hash nu înseamnă conservarea permanentă a unui binar. `sha256-manifest.json` leagă toate fișierele dosarului, exceptându-se pe sine.

## Închiderea după integrare

Chitanțele integrate descriu rezultate deja executate pe release-ul funcțional. Nu pretind că verificările unui viitor commit de documentație au fost executate. Acceptarea finală a PR-ului de dosar necesită separat: SHA-ul de merge, CI post-merge terminal, deployment Pages și audit publicat pe acel SHA. Aceste rezultate se consemnează în comentariul final al PR-ului, împreună cu digestul manifestului integrat. Acesta constituie atestarea post-merge; nu se deduce din CI pre-merge.

Chromium și arborele de accesibilitate au fost folosite pentru probe automate. Inspecția capturilor este consemnată distinct. Viewporturile simulate nu reprezintă testare pe telefoane fizice sau certificare cu cititoare de ecran fizice.
