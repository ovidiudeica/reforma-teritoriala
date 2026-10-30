# RT-ADM.2.3 — istoric way/node și confruntare cu izvoare oficiale

Bază: RT-ADM.2.2, artifact GitHub Actions `12944992975`; cele trei relații OSM au 16 versiuni istorice cumulate. Această etapă este **read-only** și nu modifică ACTUAL.

## Patru membri way

| Relație | Way | Obiect |
| --- | --- | --- |
| 18967570 | 1376179980 | Bondareuca |
| 18968043 | 1376179909, 1376180675 | Etulia, loc. st. c.f. |
| 12104636 | 889101842 | Relație anonimă sub Hrușova; fost tag despre întovărășire pomilegumicolă |

`scripts/audit/rt-adm2-3-reconstruct.py` descarcă XML original `/way/{id}/history`, extrage referințele la noduri pentru **toate** versiunile și încearcă descărcarea `/node/{id}/history` pentru fiecare nod distinct. Alege versiunea aplicabilă pentru fiecare dată de referință prin timestamp, fără a substitui automat geometria modernă istoriei. Contururile închise și complete sunt serializate în registru cu arii plane aproximative; geometria și aria sunt informative, nu frontiere cadastrale. Erorile și lipsurile sunt păstrate explicit. Artifactul trebuie inspectat și certificat după terminarea CI.

## Surse independente, limită probatorie

- Originalul statistic BNS CUATM 2025 `docs/audits/rt-audit1-2/evidence/CUATM_25.xlsx` și comparația binară cu descărcarea oficială din RT-ADM.2.2: codul 8961 (Bondareuca) are părintele 8960 (Zgărdești); codul 9639 (Etulia, loc. st. c.f.) are părintele 9629 (Etulia). Acestea sunt **identități și parentaje de registru**, nu contururi oficiale.
- Pagina BNS: https://statistica.gov.md/ro/clasificatorul-unitatilor-administrativ-teritoriale-al-republicii-moldova-cuatm--12_62048.html
- Fișele per-ID RT-ADM.2.1 și RT-ADM.2.2: rolul relațiilor și echivalența juridică a footprinturilor **nu sunt** certificate.

Pentru 12104636, istoria etichetei privind o întovărășire pomilegumicolă reprezintă doar o afirmație istorică a contributorilor OSM. Nu dovedește existența juridică, statutul sau un cod CUATM. O atribuire de nume/rol este blocată până la sursă primară independentă.

**Gate:** `NO_CHANGE_PENDING_PRIMARY_EVIDENCE` pentru toate cele trei cazuri, inclusiv după eventuale reconstrucții geometrice reușite. Nicio modificare ACTUAL, cod, geometrie, reparentare sau deblocare P9.1.

## Dovezi așteptate după CI

Artifactul `rt-adm2-3-way-node-historical-reconstruction` conține `reconstruction-register.json`, `primary-source-assessment.json` și XML-urile originale recuperate. Dacă numărul de noduri depășește plafonul de siguranță (1.200), reconstrucția este marcată incompletă, nu declarată validată. Este necesară analiza artifactului înainte de certificarea fiecărui contur.
