# RT-ADM.2.14 — registru juridic preliminar al sectoarelor Bucureștiului

Data investigației: 2026-10-30. Status: **în curs, fără adjudecare juridică pe segmente**.

## Separarea probelor
- **Geometric OSMB (RT-ADM.2.13.1):** șase sectoare alcătuiesc exact poligonul Bucureștiului la snapshotul OSMB 2026-10-05; aceasta NU certifică alinierea cu limitele legale.
- **Normativ:** traseele juridice trebuie interpretate pe baza textelor integrale, cu verificarea modificărilor ulterioare și a reperelor istorice.

## Inventar normativ și statut probatoriu
| ID | Document | Sursă publică | Constatări | Statut |
|---|---|---|---|---|
| L-1968 | Legea nr. 2/1968 | https://legislatie.just.ro/Public/DetaliiDocumentAfis/46045 | Republicare care redă organizarea anterioară în 8 sectoare; nu se folosește ca delimitare curentă | istoric; versiune de verificat |
| D-284-1979 | Decretul nr. 284/31.07.1979 | https://legislatie.just.ro/public/DetaliiDocument/28216 | Art. 1 stabilește 6 sectoare, anexa nr. 1 descrie traseele pentru fiecare sector; publicat în BO nr. 69/01.08.1979 | text integral accesibil online; scan original BO necertificat |
| L-31-1979 | Legea nr. 31/14.12.1979 | https://legislatie.just.ro/public/DetaliiDocument/28169 | Articol unic: aprobă Decretul nr. 284/1979; BO nr. 103/19.12.1979 | identificat, original tipărit necertificat |
| L-1968-R | Legea nr. 2/1968, versiune cu 6 sectoare | https://legislatie.just.ro/Public/DetaliiDocumentAfis/190 | Anexa reproduce descrieri ale celor 6 sectoare | versiune de corelat cronologic |

## Control comparativ per-sector
| Sector | Relație OSM | Text din anexa 1979 | Traseu confruntat reper-cu-reper cu OSMB | Efect juridic decis |
|---|---|---|---|---|
| 1 | 7960954 | disponibil | nu | nu |
| 2 | 7960953 | disponibil | nu | nu |
| 3 | 7960937 | disponibil | nu | nu |
| 4 | 7960957 | disponibil | nu | nu |
| 5 | 7960956 | disponibil | nu | nu |
| 6 | 7960955 | disponibil | nu | nu |

## Excepții deschise
1. Identificare exhaustivă a actelor care au modificat ulterior delimitările din anexa nr. 1 și stabilirea formei aplicabile.
2. Recuperare și verificare documentară a paginilor originale ale Buletinului Oficial pentru D-284-1979 și L-31-1979; textul din Portalul Legislativ este accesibil, dar nu se substituie scanării primare.
3. Normalizarea toponimelor istorice și marcarea sectoarelor cu tronsoane de frontieră convențională, căi ferate, râuri sau incluzivitate/excluzivitate.
4. Comparație segment-cu-segment text normativ versus geometrie OSMB; fără inferență din identitatea geometrică a partiției.
5. Nu modificați geometriile ACTUAL și nu reclasificați juridic fără acte și trasabilitate.

## Post-merge RT-ADM.2.13.1
Merge commit: `f38e6b81c2da03644e5558b9b25c0481c3f17dbd`.
Verificarea prin `fetch_commit_workflow_runs` pentru acest SHA a returnat **0** rezultate; metoda pluginului este filtrată la evenimente PR și nu atestă absența sau reușita workflow-urilor `push` pe `main`. CI post-merge: **necertificat**.
