# RT-ADM.2 — Închidere tehnică a registrului de decizii, cu excepții documentate

Bază probatorie: RT-AUDIT.1.2, `f1daecf5d2d518c23b617c6aeb0674ae9a09b66b`. PR dependent #459. Branch RT-ADM.2: `audit/rt-adm2-identity-decisions-20261029`.

## Verdict și domeniu

**RT-ADM.2 — DECISION PREPARATION COMPLETE WITH DOCUMENTED IDENTITY/BOUNDARY EXCEPTIONS.**

14/14 fișe individuale de decizie; 14 ID-uri unice; 3 MD + 11 RO. În 13 cazuri există dovezi normative/oficiale pentru identitatea *nominală* sau relația dintre coduri, fără certificarea independentă a întregii geometrii OSM; `osm-r12104636` nu are identitate pozitivă. **0/14 geometrii OSM certificate juridic ca footprint**, **0 corecții autorizate**.

Nicio constatare nu dovedește automat dacă o identitate stocată, un rol OSM sau un părinte al arborelui trebuie schimbat. Nu se impune eliminarea excepțiilor pentru acceptarea dosarului de pregătire. **Certificarea pozitivă exhaustivă a 14 footprinturi rămâne DESCHISĂ**, nefiind rezultatul etapei de pregătire.

## Rezultate

| Categorie | Cazuri | Dovezi certificate | Ce nu este certificat | Verdict |
|---|---:|---|---|---|
| CUATM parentaj diferit de codul stocat | 2 | ParentCodUnic oficial versus codul părintelui ACTUAL | Identitatea legală a întregului footprint; obiectul corecției | HOLD, fără reparentare |
| Identitate MD fără nume/cod pozitiv | 1 | Numai identitatea părintelui Hrușova | Identitatea copilului | DOC |
| Localități RO | 5 | Apartenența juridică nominală conform anexei Legii nr. 2/1968 | Limitele legale și echivalența OSM | DOC, nu se atribuie SIRUTA |
| Sectoare București | 6 | Decretul nr. 284/1979; coduri SIRUTA în acte publice | Echivalența contururilor OSM cu limitele legale | DOC, nu se atribuie SIRUTA |

Cazurile 2 CUATM: Bondareuca `osm-r18967570` cod 8961 (părinte oficial 8960 Zgărdești, arbore 7433 Grigorăuca); Etulia loc.st.c.f. `osm-r18968043` cod 9639 (părinte oficial 9629 Etulia, arbore 9621 Cișmichioi).

Identitate nerezolvată: `osm-r12104636`; niciun cod CUATM, nume, rang sau reparentaj atribuit.

Localități RO: Mureșeni `11283027`, Remetea `11283576`, Vălureni `11366846`, sat Cristești `11366847`, Bărdești `12557978` (toate prefixed `osm-r`). În legislația consolidată, primele două sunt localități componente Târgu Mureș; Vălureni și Cristești sunt sate ale comunei Cristești, Bărdești aparține comunei Sântana de Mureș.

Sectoare RO: `osm-r7960954` / 1, `osm-r7960953` / 2, `osm-r7960937` / 3, `osm-r7960957` / 4, `osm-r7960956` / 5, `osm-r7960955` / 6. Codurile de referință 179141, 179150, 179169, 179178, 179187, 179196 se păstrează ca dovezi externe, **nu sunt bindinguri noi**.

## Dovezi primare

- Snapshot CUATM oficial păstrat `docs/audits/rt-audit1-2/evidence/CUATM_25.xlsx`.
- `data/sources/md-cuatm-individual-review.json` (12104636 rămâne fără identitate pozitivă).
- Legea nr. 2/1968, anexa județului Mureș: https://legislatie.just.ro/Public/DetaliiDocumentAfis/215837
- Legea nr. 2/1968, versiune imprimabilă cu Bărdești: https://legislatie.just.ro/Public/FormaPrintabila/00000G2UPMAWYI2CBYX1M13BJNEGDD0C
- Decretul nr. 284/1979 privind cele șase sectoare și descrierile frontierelor istorice: https://legislatie.just.ro/Public/DetaliiDocument/28216
- Act din 2024 indicând coduri SIRUTA sectoriale: https://legislatie.just.ro/Public/FormaPrintabila/00000G0BY8BGSVQVBM432XVZS9SVJMCN

Nu s-au comparat contururi oficiale vectoriale/cadastrale cu OSM; existența descrierilor normative istorice nu dovedește că OSM reproduce limitele aplicabile în 2026.

## Livrabile și reproductibilitate

- `docs/audits/rt-adm2/identity-decision-register.json` — 14 cazuri, dovezi individuale, statut, acțiune interzisă.
- `docs/audits/rt-adm2/README.md` — raportul contextual.
- `scripts/audit/rt-adm2-verify.mjs` — verificare fail-closed a numărului/identității/dovezilor și interdicției de modificare automată.

Rulare propusă din rădăcina repository-ului: `node scripts/audit/rt-adm2-verify.mjs`. O verificare logică separată a registrului a confirmat 14 ID unice, 3 MD, 11 RO, 13 roluri documentate și 0 intervenții permise. **Nu se declară rulare CI PASS doar pe baza acestei verificări logice**.

## Criteriul de continuare

Documentația pentru eventuale intervenții este completă ca *pregătire decizională*. Pentru aprobarea oricărei intervenții ulterioare sunt necesare probe pozitive individuale pentru poligon, dovada exactă a schimbării propuse și autorizare separată. RT-ADM.2 nu modifică ACTUAL, main, geometrii, arbore, bindinguri ori OSM. PR-ul RT-ADM.2 rămâne Draft și dependent de PR #459; P9.1 rămâne blocat.
