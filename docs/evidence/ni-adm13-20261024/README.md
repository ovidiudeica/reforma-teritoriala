# NI-ADM.1.3 — recuperarea originalelor și certificarea registrelor locale

**Cutoff:** 24 octombrie 2026. **Scope:** EVIDENCE_ONLY / READ_ONLY. PR stacked peste NI-ADM.1.2 #433 → NI-ADM.1.1 #432 → NI-ADM.1 #430 → NI-ADM.0 #428.

## Rezultatul reconcilerii tuturor celor 18 legi (fără reluarea recensămintelor)

Am verificat matricea **18/18** a actelor promulgate deja identificată în [NI-ADM.1.2](../ni-adm12-20261024/law-effects-20.json).

- **4 originale PDF deja existente pe `main`**: publicațiile `2026000086` (nr. 1-ЗИ-VIII), `2026000091` (nr. 6-ЗД-VIII), `2026000438` (nr. 53-ЗИД-VIII), `2026000691` (nr. 91-ЗД-VIII). Fiecare are în dosarul NI-JUR fișier PDF cu Git blob și dimensiune concordante cu acquis-ul anterior, hash SHA-256 publicat, recaptură anterioară byte-identică și dovezi de examinare vizuală a **tuturor** paginilor. **Nu sunt documente descărcate pentru prima dată în NI-ADM.1.3** și nu sunt certificate drept semnături digitale calificate.
- **14 acte încă fără original binar certificat aici**: lista completă per publicare apare în [originals-18.json](originals-18.json), cu câmpuri `primary_evidence_status`, `primary_original` și cauze exacte ale blocajului. Pentru ele, publicarea unui titlu în indexul oficial sau apariția unei transcrieri în baza de date juridică terță nu certifică PDF-ul original ori dispozițiile operative complete.
- Datările din sursele păstrate indică pentru cele 4 legi din 2026 regulile de efect: 1/2026 din 30.01, 6/2026 condiționată de Legea 4/2026, 53/2026 din 26.03 și 91/2026 condiționată de Legea 89/2026. Aceste constatări sunt **sursa probatorie anterioară**, nu un verdict nou privind cele 85 de părinți/contururi.

Pentru o verificare independentă, validatorul `validate.mjs` verifică *la checkout complet al repository-ului* SHA-256 pentru fiecare dintre cele patru PDF-uri existente, plus structura și controalele fail-closed. Nu pretindem că acest validator a rulat în CI dacă GitHub nu raportează un rezultat pe commitul exact.

**Atenție:** în materialul secundar sunt disponibile unele dispoziții ale Legilor 216-ЗИ-VII/2023 și 276-ЗД-VII/2024, dar astfel de transcrieri nu înlocuiesc verificarea originarului semnat și nu permit marcarea celor două acte ca originale certificate.

## Registrele locale — proveniență și lacune

[local-register-coverage.json](local-register-coverage.json) consemnează recapturarea paginilor oficiale Grigoriopol, Rîbnița și Bender, respectiv erorile de conectare la Slobozia, Dubăsari, Tiraspol și Camenca.

**Grigoriopol:** [directorul oficial](https://grig-rsnd.idknet.com/home/sel-sovet) conține legături către **14 dosare publice Google Drive**, asociate secțiunilor consiliilor (13 rurale și Maiac). La inspectarea directă a *tuturor celor 14 dosare de nivel superior*, fiecare afișa subdosare **2025 și 2026**. Această observație nu dovedește inexistența originalelor din 2023–2024 în alte locații și nu certifică vreun inventar de acte semnate. Linkurile exacte sunt salvate fără atribuirea nesusținută a fiecăruia unui consiliu individual.

**Rîbnița:** [secțiunea consiliilor sătești](https://rybnsovet.idknet.com/struktura/selskie-sovety.html) afișează acte/anunțuri contemporane, inclusiv convocări pentru Gărăba (22.10.2026) și Erjovo (20.10.2026); [arhiva lunară](https://rybnsovet.idknet.com/arhiv) conține numărări de articole, nu un registru de hotărâri normative verificate. Conform [regulamentului din 13.02.2026](https://rybnsovet.idknet.com/reglament-rybnickogo-gorodskogo-i-rajonnogo-soveta-narodnyx-deputatov), deciziile normative pot necesita dovada din ziarul „Новости”, website și arhiva originalelor. Nu se extrapolează regulile sale la ceilalți emitenți.

**Bender:** [website-ul consiliului](https://benderygs.gospmr.org/?cat=4) oferă pagini și legături documentare; nu rezultă exhaustivitatea publicațiilor normative și a originalelor 2023–2026.

## Excepțiile și verdictul obligatoriu

[exceptions-followup.json](exceptions-followup.json) păstrează cele 9 clase moștenite din #433: o clasificare închisă strict pentru două acte de proiect, **8 deschise**. EXC-18-OPERATIVE este redusă la **14 originale lipsă** (plus necesitatea controlului normativ final), dar **nu se închide**. EXC-LOCAL-ISSUERS și EXC-LOCAL-PUBLICATION primesc localizări concrete și continuă să rămână deschise.

**NI-ADM.1.3 final:** `BLOCKED_INCOMPLETE`. Condițiile rămase sunt originale complete pentru 14 acte, verificarea efectelor și a intrării în vigoare per act, arhive locale numerotate și complete per emitent/per an, delimitarea competențelor legale și dovezi individuale pentru orice corespondență OSM.

**Nu au fost modificate:** `public/data`, ACTUAL, părinții juridici MD, OSM public, website sau pragurile de CI. `P9.1=BLOCKED`; fără încorporare în arbore înainte de gate separat.
