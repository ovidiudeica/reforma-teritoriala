# RT-ADM.2.4 — examinarea terminală a artifactului cadastral (2026-10-30)

## Proveniență și integritate

- Run: https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/40985833260
- Head verificat: `2847435b9da9b60524f5b756513e38a544d1bf4c`.
- Workflow/job: `RT-ADM.2.4 official cadastral WFS acquisition` / `official-wfs-acquisition`: `completed/success`.
- Artifact: `12946683009`, `rt-adm2-4-official-cadastral-evidence`, 404 octeți.
- SHA-256 ZIP recalculat: `939a5d707d33f8498681f08d5ee2528e0a4de30976a945bb703d2763ffc12c18`, identic cu digestul GitHub.
- Integritate ZIP: test structural reușit; un singur fișier `evidence-register.json`.

## Conținut examinat

```json
{
  "timestamp_utc": "2026-10-30T01:27:25.786338+00:00",
  "status": "ACCESS_FAILED",
  "candidate_layers": [],
  "downloads": [],
  "errors": [{
    "phase": "capabilities",
    "error": "HTTP Error 403: Forbidden"
  }],
  "official_boundary_comparison": "NOT_AUTHORIZED_UNLESS_DATED_VECTOR_AND_OBJECT_MATCH"
}
```

**Interpretare:** serviciul a refuzat apelul WFS GetCapabilities. Nu s-a primit un catalog de straturi, nici schema atributelor, nici `GetFeature`; nu există geometrii, identificatori cadastrali sau date de validitate descărcate. Statusul `SUCCESS` al jobului înseamnă numai că scriptul a gestionat eroarea și a arhivat registrul. Nu se interpretează eroarea 403 drept dovadă că datele cadastrale nu există.

## Verificare per ID și gate de suprapunere

| Relație OSM | Geometrie istorică OSM RT-ADM.2.3 | Geometrie cadastrală identificată pozitiv | Atribute/date de valabilitate | Overlay legal |
|---|---|---|---|---|
| 18967570 — Bondareuca | disponibilă în artifactul RT-ADM.2.3 | NU | NU | NEEXECUTAT |
| 18968043 — Etulia, loc. st. c. f. | disponibilă (două way) | NU | NU | NEEXECUTAT |
| 12104636 — anonimă lângă Hrușova | disponibilă (way cu cinci versiuni) | NU | NU | NEEXECUTAT |

Nu există o pereche verificată cu (a) identificator cadastral pozitiv și (b) geometrii datate în același interval; de aceea `symmetric_difference`, Hausdorff, suprafața comună sau cuantificarea dezacordului juridico-geometric **nu au fost calculate**. Diferențele OSM–OSM din RT-ADM.2.3 sunt independente și nu pot înlocui comparația OSM–cadastru.

## Continuare admisibilă

Se poate încerca verificarea WFS prin alt endpoint sau canal aprobat de furnizor, dar numai după inspectarea condițiilor de acces, numelor straturilor, identificatorilor oficiali, sistemului de coordonate și datelor de valabilitate. Dacă serviciul nu permite acces anonim la straturile relevante, este necesară obținerea lor prin procedura oficială a IP Cadastrul Bunurilor Imobile, împreună cu actele de delimitare și metadatele temporale.

**Verdict:** `CADASTRAL_WFS_403_NO_FEATURES_NO_DATED_OVERLAY`, `NO_CHANGE_PENDING_PRIMARY_EVIDENCE` pentru toate cele trei relații. ACTUAL, parentaje, coduri, geometrii și P9.1 nemodificate; PR rămâne Draft.
