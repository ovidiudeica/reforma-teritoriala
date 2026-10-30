# RT-ADM.2.1 — verificare probatorie individuală, 14 excepții

**Verdict:** `PROBATIVE_CASE_DOSSIERS_COMPLETE_LEGAL_FOOTPRINT_CERTIFICATION_REMAINS_OPEN`.

Baza: `main@b72d6279b218e220d8ea1f26e38510fec0f51f2e`. Registrul canonic RT-ADM.2 nu este modificat. Dosarele individuale sunt în [individual-evidence-register.json](./individual-evidence-register.json); validatorul fail-closed este `node scripts/audit/rt-adm2-1-verify.mjs`.

## Delimitări și verificări

**14/14 cazuri reexaminate individual:** 3 MD, 11 RO. Dovezile oficiale deja păstrate sau accesibile continuă să susțină 13 roluri nominale/coduri; o identitate MD este nedemonstrată. **0/14 echivalențe între întregul poligon OSM și o frontieră legală oficială certificate. 0 modificări propuse; 14/14 cazuri sub `NO_CHANGE_PENDING_PRIMARY_EVIDENCE`.**

| Categorie | ID-uri | Constatări / ceea ce lipsește |
| --- | --- | --- |
| Conflict CUATM | `osm-r18967570`, `osm-r18968043` | ParentCodUnic oficial diferă de codul părintelui din arbore. Nu se știe dacă problema este bindingul, semantica rolului sau părintele. Originalul `CUATM_25.xlsx` este arhivat, dar nu a fost reanalizat binar aici |
| Identitate MD neatribuită | `osm-r12104636` | Hrușova este părinte identificat, nu dovadă pentru copil. Interogarea directă OSM nu a fost accesibilă, fără istoric/taguri certificate |
| Localități RO | `osm-r11283027`, `osm-r11283576`, `osm-r11366846`, `osm-r11366847`, `osm-r12557978` | Legea nr. 2/1968 și anexele actualizate prin Legea nr. 290/2018 documentează localitățile nominale; lipsește asocierea independentă a fiecărei relații la intrarea oficială și limita legală |
| Sectoare București | `osm-r7960954`, `osm-r7960953`, `osm-r7960937`, `osm-r7960957`, `osm-r7960956`, `osm-r7960955` | Decretul 284/1979 are delimitări **istorice**, NRSIRUTA coduri 179141, 179150, 179169, 179178, 179187, 179196; nu există verificare vectorială a frontierei aplicabile în 2026 |

## Izvoare

- CUATM oficial arhivat: `docs/audits/rt-audit1-2/evidence/CUATM_25.xlsx`.
- Recenzia identității OSM 12104636: `data/sources/md-cuatm-individual-review.json`.
- Legea nr. 2/1968 (anexe): https://legislatie.just.ro/Public/DetaliiDocument/215837.
- Legea nr. 290/2018: https://legislatie.just.ro/Public/DetaliiDocument/208652.
- Decretul nr. 284/1979: https://legislatie.just.ro/Public/DetaliiDocument/28216.
- NRSIRUTA, codurile celor șase sectoare: https://www.recensamantromania.ro/wp-content/uploads/2021/11/SIRUTA.pdf.

Izvoarele nu au același obiect probatoriu: un act de organizare administrativă dovedește categoria și apartenența nominală, în timp ce o geometrie precisă cere date de frontieră aplicabile la data relevantă. **Nu se proclamă că registrul oficial a fost actualizat în timp real sau că un contur OSM a fost certificat juridic.**

## Distincția de închidere

- **Închis:** inventarierea, lectura și clasificarea probatorie per-ID, cu lipsurile individuale explicit cuantificate.
- **Deschis:** confirmarea identităților juridice asociate exact poligoanelor OSM și, după caz, comparația de contur cu sursă oficială contemporană.
- **Blocat:** orice reparentare, atribuire SIRUTA/CUATM, reclasificare a rolului sau editare de geometrie în ACTUAL; P9.1.

Continuare țintită: pentru MD, document primar independent + istoric OSM; pentru cele cinci localități RO, crosswalk oficial pe identificatori și limite; pentru sectoare, poligoane autoritative și modificările legislative aplicabile după delimitarea istorică. Nu se repetă inventarul de 5.846 de relații părinte–copil.
