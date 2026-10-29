# RT-AUDIT.1.2.1 — verificare independentă (2026-10-29)

Referință: PR #459, commit de intrare `4eaafd888b75faf744f98db0c1413d4c7dfdf1c4`, run [40936055254](https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/40936055254), artifact [12924337623](https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/40936055254/artifacts/12924337623).

## Integritate verificată independent

- ZIP descărcat și testat structural: 28 fișiere; SHA-256 recalculat `7f8bc2b278e062cb7f84c6b98624e00fd0cd6c5220b95bf1bb103e8b2d445dcb`, identic cu digestul GitHub.
- Patru manifeste checksum; toate cele 20 de intrări au fost verificate cu SHA-256 recalculat. Zero lipsuri/nepotriviri.
- Registrele geometric, cauzal, forensic și coada de investigație au fiecare 254 de perechi unice, cu exact aceleași chei `(child_id,parent_id)`. CSV forensic are 254 rânduri.
- Toate cele 254 suprafețe child-outside-parent din forensics sunt identice numeric cu registrul geometric; `source-validation-exceptions.json` este vid.
- Toate cele 254 de cazuri au `corrective_action=NONE_AUTOMATIC`, fără echivalență juridico-geometrică certificată ori cauză istorică certificată.

## Reconcilierea CUATM/BNS

| Clasă probatorie | Cazuri | Depășire agregată, m² (sumă pe perechi) | În toleranța numerică |
|---|---:|---:|---:|
| Două reprezentări OSM ale aceluiași cod CUATM | 162 | 1,891,128.203 | 4 |
| Două CUATM distincte, parentaj oficial direct | 76 | 1,003,539.183 | 5 |
| Auxiliare non-CUATM cu părinte verificat | 13 | 7,134.155 | 2 |
| Părinte statistic BNS | 2 | 21,071.242 | 0 |
| Identitate pozitivă nerezolvată | 1 | 2.055 | 0 |

Acele 162 cazuri confirmă identitatea CUATM reconciliată, nu egalitatea frontierelor OSM. Cele 76 confirmă parentajul legal, nu cauza suprapunerii. Cele 13 nu primesc identități CUATM noi. Valorile sunt sume pe perechi, nu reuniuni geografice.

## Membri OSM / precizie / limitări istorice

- 252 perechi au seturi de `way` distincte; la 2 părintele este statistic, necomparabil ca relație OSM.
- 246 fără `way` direct comun; 6 cu unii `way` comuni.
- 212 depășiri >1 m²; 31 <1 m² dar peste toleranță; 11 în toleranță.
- Istoricul arhivat este asociat la numai 2 din 254 de perechi; 252 fără istoric atașat. Pentru niciuna dintre cele 254 de perechi ambele relații nu au metadate complete de versiune și timestamp în snapshot.
- **0 cauze istorice OSM certificate**. Toate cele 254 de cazuri rămân în coada cauzală.

## Egalități

- **Pojăreni** `osm-r18967798/osm-r18821812`: aceiași membri `way` [1367305877,1367305878,1367305883], același CUATM 5525, niveluri 9/8. Interpretarea rolurilor rămâne DOC; fără deduplicare.
- **Orhei** `osm-r18968025/osm-r19082513`: ambele CUATM 6401, niveluri 9/8, dar un `way` copil [1376180648] versus opt `way` părinte [1383623584,1383623585,1383623586,1383623587,1383623588,1383623589,1383623590,1383623621]. Cauza echivalenței geometrice și interpretarea semantică rămân DOC.
- **MD120/MD12**: clasificarea oficială BNS confirmă unicul copil statistic; coextensivitatea rolurilor statistice este explicată. Conflictul OSM MD121/BNS MD120 nu este soluționat prin geometrie.

## Identitatea 12104636

`osm-r12104636` sub `osm-r19090918` Hrușova (părinte CUATM 3136): depășire 2.055 m², toleranță 0.0318 m²; copil `way 889101842`, fără nume/place/CUATM în snapshot. **DOC — identitate juridică nerezolvată**, fără atribuire automată.

## Verdict

**Integritate ZIP, manifeste, acoperire per-ID și corelarea registrelor: PASS.**
**Certificare istorică a cauzelor / frontiere juridice: DESCHIS.**
Această etapă nu a recuperat istorii OSM exhaustive noi, nu a adjudecat frontiere oficiale și nu modifică ACTUAL. PR #459 rămâne Draft, fără autorizare de merge. Verificările CI anterioare au reușit pe SHA-ul de intrare; commitul acestui raport necesită verificări proprii pe noul SHA înainte de orice acceptare.
