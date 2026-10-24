# NI-ADM.1.3.1 — documente primare şi inventarierea arhivelor locale

**Data de referinţă:** 24 octombrie 2026. **Domeniu:** audit EVIDENCE_ONLY, stacked peste #434 → #433 → #432 → #430 → #428. Nicio modificare a ACTUAL, CUATM, OSM public sau a arborelui Nistreniei.

## Lotul de 14 legi — rezultate reale, fără certitudine falsă

Registrul [originals-14-recovery-status.json](originals-14-recovery-status.json) urmărește fiecare dintre cele 14 acte din NI-ADM.1.3 pentru care originalul de facto nu era conservat. Au fost încercate individual endpointurile de publicare aferente tuturor celor 14 ID-uri, prin citire publică externă; toate au returnat **TARGET_UNREACHABLE**. În plus, accesul la pagina de arhivă a Legii 187/2025 și la un endpoint de fișier PDF a eșuat, inclusiv printr-o adresă alternativă a registrului.

**Rezultat:** 0/14 noi originale PDF recuperate, 0/14 SHA-256 original nou calculat, 0/14 texte semnate și date de aplicabilitate certificate în această etapă. **Toate cele 14 sunt încă deschise**. Cele 4 originale din 2026 deja verificate de NI-JUR sunt reutilizate, fără o pretinsă recaptură nouă. Un index oficial, un act menționat în lanțul de amendamente al legii-cadru sau un text reprodus pe un site terț nu reprezintă echivalentul PDF-ului original.

**Nu afirmăm** că aceste 14 legi nu au efect asupra ierarhiei; concluzia per-ID rămâne `UNDETERMINED_NO_PRIMARY`. Nu presupunem din data publicării data de intrare în vigoare. Recunoașterea documentelor instituțiilor de facto drept surse de organizare revendicată nu afirmă statutul lor juridic internațional.

## Inventarul dosarelor locale publice — Grigoriopol

Au fost parcurse efectiv prin Google Drive toate cele **14 dosare** legate din [directorul oficial](https://grig-rsnd.idknet.com/home/sel-sovet). Fiecare are subdosare **2025** și **2026**.

- 28 subdosare anuale inspectate: **151** intrări.
- 61 subdosare imediate recursiv inspectate: **206** intrări.
- Un subdosar suplimentar (în Șipca / 2025): **12** intrări metadata.
- **369 de intrări** în total: **62 directoare** și **307 fișiere distincte**.
- Tipuri de fișiere: **105 PDF, 98 DOCX, 19 DOC, 5 TIFF, 25 PNG, 54 JPEG şi 1 ZIP**.
- Zero erori la enumerarea dosarelor deja identificate; niciun folder listat nu atinge limita de 100 copii a conectorului. Acest lucru certifică numai *inventarul subarborelui public accesibil observat*, nu exhaustivitatea juridică a consiliilor pentru perioada solicitată.

Fișierele complete de metadate sunt `grigoriopol-2025-top.json`, `grigoriopol-2026-top.json`, `grigoriopol-nested-01.json` ... `-05.json`, `grigoriopol-third-level.json` şi [local-inventory-summary.json](local-inventory-summary.json). Păstrează provenienţa: consiliu/folder/an afişat, ID Drive, MIME şi dimensiune dacă e disponibilă.

## Inspectarea conținutului — patru eșantioane

În [local-sample-review.json](local-sample-review.json) se află patru fișiere citite efectiv:

1. Regulamentul Consiliului Maiac, aflat în directorul 2026, provine din hotărârea **nr. 2/2, 16 decembrie 2020**.
2. Regulamentul Consiliului Bîcioc, în directorul 2026, se identifică drept ediția curentă **20 noiembrie 2024**.
3. Regulamentul Consiliului Butor, în directorul 2026, menționează **nr. 2/2, 16 decembrie 2020**.
4. Hotărârea Maiac privind petițiile, aflată în directorul 2025, este **nr. 14/3, 17 noiembrie 2022**.

Aceste patru documente tratează procedura internă și petițiile. Nu au fost certificate originalele cu semnătură electronică calificată; nu s-a demonstrat vreun act individual de schimbare a teritoriului. **Anul folderului nu este anul adoptării sau al aplicabilității actului.**

Pe denumirile celor **307 fișiere** nu a rezultat un candidat explicit de `границ` (limite), `переимен` (redenumire) sau `административно-территориальное` (organizare administrativă). **Aceasta este doar căutare de titluri**, nu o constatare privind conținutul tuturor documentelor. Celelalte **303** nu sunt declarate analizate integral. Nu a fost analizat conținutul imaginilor dintr-un dosar individual care cuprinde JPEG-uri.

## Restricții și starea pentru implementare

Pentru a închide NI-ADM.1.3.1 trebuie încă: recuperate și certificate criptografic 14 originale, verificat textul și intrarea în vigoare pe fiecare, eventualele dispoziții derogatorii, originalele locale semnate și gazetele oficiale, complete pentru 2023–2026, inclusiv pentru celelalte jurisdicții și toate consiliile relevante. Documentele de competență locală sau schemele electorale **nu sunt geometrii administrative**.

**Verdict:** `NI_ADM_1_3_1=BLOCKED_INCOMPLETE`. Nu autorizează promovări per-ID, schimbarea părinților MD sau a geometriei OSM, nici integrarea în arbore. `P9.1=BLOCKED`, ACTUAL neatins și fără relaxarea check-urilor CI. Validatorul `validate.mjs` urmează să confirme numai consistenţa artefactelor la checkout, nu legalitatea tuturor izvoarelor.

## Provenienţă suplimentară

Originalele anterioare din 2026 şi SHA-256: `docs/evidence/ni-jur-independent-20261020/documentary/primary-review/`. Dosarul părinte: `docs/evidence/ni-adm13-20261024/originals-18.json`.

Surse primare disponibile în browser: [directorul Grigoriopol](https://grig-rsnd.idknet.com/home/sel-sovet), [arhiva Rîbnița](https://rybnsovet.idknet.com/arhiv), [site-ul legislativ](https://www.vspmr.org/legislation/laws/zakonodateljnie-akti-pridnestrovskoy-moldavskoy-respubliki-v-sfere-konstitutsionnogo-stroya-osnov-pravoporyadka-a-takje-deyateljnosti-organov-gosudarstvennoy-vlasti-i-upravleniya/zakon-pridnestrovskoy-moldavskoy-respubliki-ob-organah-mestnoy-vlasti-mestnogo-samoupravleniya-i-gosudarstvennoy-administratsii-v-pridnestrovskoy-moldavskoy-respublike.html).
