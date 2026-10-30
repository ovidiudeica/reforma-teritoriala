# RT-ADM.2.3 — căutare țintită de hotare oficiale / cadastru (2026-10-30)

**Scop:** exclusiv trei relații MD, fără modificări ACTUAL, fără inferență de identitate de contur. Rezultat: surse administrative oficiale și instrucțiuni cadastrale identificate, **niciun polygon GIS juridic individual recuperat**.

## Evidențe oficiale, separate pe obiect probatoriu

| Caz | Sursă independentă găsită | Ce demonstrează | Ce NU demonstrează | Verdict |
|---|---|---|---|---|
| Bondareuca, OSM r18967570 | Serviciul Fiscal de Stat, anexa cu lista de localități: https://sfs.md/uploads/decisionprocessannouncement/68/document/anexa-la-ordinpdf-61c5682b1cd86.pdf ; Direcția Situații Excepționale, ordin oficial: https://www.dse.md/sites/default/files/pdf/acte-normative/Ordin%20SPCSE%20nr.139%20din%2004.09.2012.pdf | Coexistența denumirilor/codurilor Zgărdești 8960 și Bondareuca 8961, coroborare administrativă independentă a CUATM | Frontiera exactă a poligonului OSM; legarea ID OSM la un contur oficial | `ADMIN_CODE_CORROBORATED_BOUNDARY_OPEN` |
| Etulia, loc. st. c. f., OSM r18968043 | Serviciul Fiscal de Stat, anexa: https://sfs.md/uploads/decisionprocessannouncement/92/document/proiectpdf-6357de5cf1b8c.pdf ; Direcția Situații Excepționale, ordin: https://www.dse.md/sites/default/files/pdf/acte-normative/Ordin%20SPCSE%20nr.139%20din%2004.09.2012.pdf | Etulia 9629, Etulia loc. st. c. f. 9639, Cișmichioi 9621 consemnate ca entități distincte în surse oficiale | Delimitări oficiale vectoriale ale celor două inele OSM, arondare juridică a exact acestor contururi | `ADMIN_CODE_CORROBORATED_BOUNDARY_OPEN` |
| OSM r12104636, lângă Hrușova | Istoricul XML OSM din RT-ADM.2.2/2.3 (nu este document juridic); CUATM arhivat 3136 pentru Hrușova | Etichetare istorică OSM legată de „întovărășire pomilegumicolă”; parentul nominal al obiectului | Existența juridică, proprietatea, statutul cadastral sau un număr cadastral precis al acestei întovărășiri | `NO_POSITIVE_OFFICIAL_IDENTITY` |

## Calea probatorie pentru hotare

Document oficial cu conținut operațional:
- ASP, **Ghid practic**, anexa 15, livrabile pentru stabilirea hotarelor UAT: https://www.asp.gov.md/sites/default/files/documents/pief/acte-normative-proceduri-de-executie/ghid/ghidului_Practic_.pdf . Indică plan cadastral digital (inclusiv straturi HComune/HCSectoare), ortofotoplan, acte de stabilire a segmentelor, documente confirmative, strat HComune nou stabilit și recepție. Aceasta documentează tipul dovezii necesare, **nu pune la dispoziție poligoanele individuale**.
- ARFC, ordinul nr. 109/2016 și modificarea nr. 29/2018 privind stabilirea hotarelor UAT și intravilanelor: https://old.arfc.gov.md/acte_normative/instructiuni .
- ASP confirmă transferul serviciilor cadastrale la IP „Cadastrul Bunurilor Imobile” din 3 ianuarie 2024: https://www.asp.gov.md/ro/intrebari-frecvente/alte-institutii/0001 . Sursa instituțională actuală: https://www.ipcbi.gov.md/ .

**Cererile tehnice necesare, în această ordine:** (1) extras oficial HComune/V_Transfilial_Localit sau delimitare intravilană pentru Zgărdești–Bondareuca și Etulia–loc.st.c.f., cu dată aplicabilă, sistem de referință, număr act de stabilire și recepție; (2) document cadastral/identificator cu coordonate pentru obiectul de lângă Hrușova, separat de dovada existenței unei asociații; (3) overlay geometric cu data identică și raport de diferență simetrică, fără corecție automată.

Sursele fiscale și ordinele pot avea scop de arondare operațională, distinct de apartenența juridică: coroborarea de coduri și denumiri nu este echivalată cu dovada unui parentaj juridic individual sau a unei geometrii.

**Regulă de decizie:** `NO_CHANGE_PENDING_PRIMARY_EVIDENCE` pentru toate cele trei ID-uri. Nicio reparentare, relabelare, binding CUATM, modificare geometrică sau autorizare P9.1.
