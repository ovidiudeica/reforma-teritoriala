# NI-ADM.1.3.2 — surse oficiale alternative și trierea documentelor normative locale

**Referință:** 24.10.2026. **PR probatoriu stacked** peste #435 → #434 → #433 → #432 → #430 → #428. `P9.1=BLOCKED`; fără mutații ACTUAL/MD/OSM/UI.

## 14 legi centrale: ce este verificat acum

Am identificat **14/14 fișe și ediții inițiale** individuale ale legilor rămase din NI-ADM.1.3.1 în noua bază oficială publică [Юридическая литература](https://ul-test.gospmr.org/documents/search/). Fiecare are ID de document, URL de ediție, număr, dată și sursă oficială SÁZ în `official-editions-01.json` și `official-editions-02.json`.

**Important:** portalul arată versiuni HTML publice, dar **descărcarea PDF este restricționată de tarif**, iar previzualizarea unor articole operative este incompletă. Nu am obținut sau certificat 14/14 PDF-uri originale. **Zero noi originale PDF, zero SHA-256 de original legislativ, zero semnături calificate certificate.** Nu se poate înlocui originalul cu PDF creat din text HTML.

Regulile de intrare în vigoare vizibile din articolul final, verificate individual și păstrate în `law-effective-dates.json`:
- **7 legi**: ziua următoare publicării oficiale;
- **4 legi**: dată calendaristică explicită (01.01.2024, 01.01.2025 sau 01.01.2026);
- **3 legi**: efect condiționat de un alt act de modificare a Constituției, statutului deputaților locali, respectiv Codului civil. Aceste condiții **nu sunt încă adjudecate**, deci nu se presupune aplicabilitatea.
- **223-ЗИ-VII / 18.11.2025**: articolul 2 indică intrare în vigoare în ziua următoare publicării și aplicare raporturilor juridice apărute din 09.07.2025. Efectul retroactiv nu certifică întregul conținut al articolului 1.
- **216-ЗИ-VII / 2023**: lege emisă la 13.07.2023, publicată la 14.07.2023, regulă de intrare în vigoare în ziua următoare.
- **48-ЗИ-VII / 05.03.2024**: fișa oficială afișează titlul legii-cadru a autorităților locale, spre deosebire de titlul de amendament din indexul anterior; diferența se conservă ca excepție, nu se cosmetizează.

Pentru 11 legi regula temporală poate fi derivată aritmetic din data oficială centrală; **nu este o certificare a articolului 1 integral sau a efectelor asupra ierarhiei**, care rămân `UNDETERMINED`.

## Arhive locale: 307 ID-uri deja inventariate, fără reluarea enumerării

Am folosit exclusiv identificatorii fișierelor conservați în NI-ADM.1.3.1. În `local-regulations-14.json` am verificat conținutul a 14 regulamente/fișiere cu rol de regulament: **11** au text lizibil, **3** nu au produs text extras (Vinogradnoe, Teia, Tașlîc).

În `selected-decisions-18.json` au fost citite și clasificate 18 hotărâri/documente din dosarele locale: **15** cu text lizibil, **3** fără text extras (Vinogradnoe, Crasnogorca, Carmanova). Categoriile identificate includ comisii permanente, petiții, deputați și bugete. **Fără certificat de original semnat** sau dovadă de schimbare a subordonării ori limitelor administrative. Nu afirmăm că celelalte fișiere din lista de 307 au fost revizuite integral.

`local-binary-hashes.json` conservă SHA-256 calculat pentru **două fișiere PDF locale reale** furnizate de sursa publică Google Drive a consiliului:
- Bîcioc: 808.115 bytes, 25 pagini, SHA-256 `16af5bc5e193813ccf2770d07be8e631ed4fb7232ed419ca346287042982250e` (verificat prin două descărcări);
- Hlinaia: 494.587 bytes, 25 pagini, SHA-256 `f01e88902e6c83d38d1d7fa7285081763520838650ac5430174050b6136db1f7`.
Digestul verifică **integritatea binară a exemplarului accesat**, nu autentificarea semnăturii, calificarea sursei drept registru complet sau aplicabilitatea la 24 octombrie.

## GATE: blocaje specifice, nu generalizări

Nu există în acest audit certitudinea asupra conținutului complet al articolului 1 pentru cele 14 legi, a validării condițiilor de intrare în vigoare pentru trei dintre ele ori a exhaustivității originalelor locale semnate (2023–2026). În special un regulament local nu substituie legea administrativ-teritorială sau geometria OSM.

**Verdict:** `SOURCE_DISCOVERY_14=PASS`, `UNCONDITIONAL_DATE_RULES_11=PASS_SOURCE_SCOPED`, `LOCAL_TEXT_26=PASS_SCOPED`; `PDF_ORIGINALS_14=BLOCKED`, `CONDITIONS_3=BLOCKED`, `ART1_EFFECTS_14=BLOCKED`, `LOCAL_REGISTER_EXHAUSTIVENESS=BLOCKED`.

Protecții explicite: `ACTUAL_mutation_allowed=false`, `P9.1=BLOCKED`, `website_tree_change_allowed=false`, `local_parent_promotions=0`, fără relaxare CI. Niciun PR nu se integrează automat.

### Referințe principale
- [Noua bază oficială de facto](https://ul-test.gospmr.org/).
- [Directorul oficial Grigoriopol](https://grig-rsnd.idknet.com/home/sel-sovet).
- Evidența exactă per-ID din dosarul părinte `docs/evidence/ni-adm131-20261024/`.
