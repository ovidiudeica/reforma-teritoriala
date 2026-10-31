# AUTO-4 — istorice individuale și trei mecanisme geometrice exacte

Pachetul continuă exclusiv cohorta109 din PR485. Nu reia inventarul6129 și nu redeschide189 cazuri explicate. **Toate109 rămân REVIEW_REQUIRED; nicio identitate sau geometrie juridică nouă nu este certificată.** ACTUAL este neschimbat, P9.1 neautorizat.

`identity-history-index.json` descompune reproductibil toate109 istorice originale deja recuperate: fiecare versiune,numele,referințele,rolurile și diferențele de etichete au dată și changeset.84 ID-uri au mai multe denumiri istorice. Nicio valoare istorică rson cu13 cifre nu este identificată ca pierdută sau diferită de valoarea curentă în acest lot; aceasta nu validează vreun IDNO și nu înlocuiește RSON. Fișele `cases/` și matricea păstrează statutul de revizuire.

Pentru relația12104636, istoricul arată trecerea de la multipoligon fără nume la allotments,apoi folosirea în2023 a unei denumiri de întovărășire pomilegumicolă și eliminarea denumirilor în2026. Calificativul„neautorizată” aparține etichetei OSM istorice: **nu este o constatare juridică a auditului**. Nicio denumire oficială sau identitate pozitivă nu este dedusă; cauza omiterii din exportul OSMB rămâne nedeterminată.

`reconstruction-proofs.json` și24 răspunsuri originale noi documentează exact cele3 diferențe dintre arhiva fixată și răspunsurile OSM curente din PR485:

| Caz | Mecanism dovedit | Editare |
|---|---|---|
| r11793466 Constanța |6 noduri inserate în ordinea originală păstrată a way1330184586,v2→v6 |17.10.2026|
| w889101812 |nod1379394647 mutat,v3→v4; versiunea way9 rămâne neschimbată |06.10.2026|
| w889101833 |8 noduri inserate în ordinea originală păstrată,v7→v8 |06.10.2026|

Inversarea editărilor produce exact poligonul arhivat în fiecare caz,fără reziduu și fără ajustări. Sunt verificate toate versiunile nodurilor și ways dintr-o stare OSM compatibilă la05.10.2026,23:59:59UTC: versiunile vechi afectate au intervale care acoperă acest moment,iar componentele neafectate sunt atestate de răspunsurile full fixate. **Momentul real al exportului OSMB per obiect rămâne necertificat.** Starea compatibilă nu este prezentată ca dată de export,nici ca perimetru juridic.

Nodurile suplimentare nu sunt presupuse coliniare: diferențele de arie curente rămân măsurate,iar egalitatea reconstrucțiilor este verificată prin predicate topologice exacte. Comentariile changeset nu sunt transformate în motive juridice sau intenții dovedite ale editorilor.

Reproducere offline din depozitul complet:

```sh
python -m pip install shapely==2.2.0 pyproj==3.8.0 numpy==2.5.4
python scripts/audit/auto4-osmb-history-followup.py
```

Scriptul verifică manifestele,răspunsurile originale comprimate lossless,indexul tuturor versiunilor,ordinea nodurilor,intervalele temporale și asamblarea independentă a geometriei vechi și curente. Sursele fixate din PR485 și geometria arhivată din AUTO3 rămân intrări imuabile. Integrarea acestui pachet este condiționată de CI și verificarea post-merge; recipisele etapelor precedente sunt păstrate separat.
