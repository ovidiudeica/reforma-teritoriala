# WEB-R2a.1 — recensământ exhaustiv `admin_level` OSM RO/MD/NI

## Verdict

Recensământul este **exhaustiv pentru corpusul publicat la baza Git exactă `073a1ee2a2098392df5891fb6b15e69b0eef2d9c`** și are verdictul `PASS_WITH_EXCEPTIONS`.

Au fost inventariate separat 5.848 identități ACTUAL, 85 de roluri OSM reutilizate și 8 contururi operaționale Nistrenia source-only, în total 5.941 de înregistrări de audit. Cele 85 de roluri nu sunt adăugate la cardinalitatea ACTUAL, iar cele 8 contururi NI nu sunt identități ACTUAL.

Nu există excepții `fatal` sau `error`. Cele 28 de excepții rămase sunt 8 `warning` și 20 `info` și constituie intrarea explicită pentru WEB-R2a.2; nu autorizează nicio corecție automată.

## Baza și invariantele ACTUAL

- Base SHA: `073a1ee2a2098392df5891fb6b15e69b0eef2d9c`.
- Snapshot ACTUAL: `actual-a9e5a4ddcb5277ef`.
- Fingerprint semantic: `a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446`.
- `actual-release-gate`: `PASS`.
- `actual-release-persisted.validated_release_gate_status`: `PASS`.
- `p91_import_allowed=false`.
- `semantic_acceptance=BLOCKED_INCOMPLETE`.
- `actual_mutation_allowed=false`.
- `data/` și `public/` sunt neschimbate față de base SHA în PR-ul de audit.

## Unitățile de numărare

1. `ACTUAL_RO`: identități ACTUAL cu `jurisdiction=RO`.
2. `ACTUAL_MD`: identități ACTUAL cu `jurisdiction=MD`.
3. `NI_SOURCE_ONLY_OUTLINES`: cele 8 contururi operaționale source-only definite de contractul P9.0.9.5.
4. `OSM_REUSED_ROLES`: cele 85 de roluri cartografice OSM din P9.0.7.2.16, fiecare mapat la o identitate ACTUAL existentă.

Nicio valoare `admin_level` nu este dedusă din denumire, categorie, părinte, NUTS, SIRUTA, CUATM sau poziția în arbore. Validatorul clasifică separat `valid`, `missing`, `null`, `multiple`, `invalid` și `conflict`.

## Distribuții complete

| Corpus | Total | 2 | 4 | 7 | 8 | 9 | missing | null | multiple | invalid | conflict |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| ACTUAL RO | 3.246 | 1 | 42 | 0 | 3.180 | 11 | 0 | 12 | 0 | 0 | 0 |
| ACTUAL MD | 2.602 | 1 | 37 | 5 | 982 | 1.571 | 0 | 6 | 0 | 0 | 0 |
| NI source-only | 8 | 0 | 0 | 0 | 0 | 0 | 8 | 0 | 0 | 0 | 0 |
| Roluri OSM reutilizate | 85 | 0 | 1 | 0 | 84 | 0 | 0 | 0 | 0 | 0 | 0 |

Distribuțiile canonice sunt în `docs/evidence/web-r2a1/distributions.json`.

## Registrul excepțiilor

`docs/evidence/web-r2a1/exceptions.json` conține 28 de excepții:

- 18 × `ADMIN_LEVEL_NULL` (`info`): 12 entități statistice RO și 6 entități statistice MD au `representation.admin_level=null` explicit; valoarea nu este completată prin extrapolare.
- 8 × `ADMIN_LEVEL_MISSING` (`warning`): cele 8 contururi NI source-only au relație OSM, versiune, timestamp și geometrie dovedite, dar contractul publicat `p9095-osm-outlines.json` nu conține un câmp `admin_level` verificat. Aceste valori trebuie reconciliate în WEB-R2a.2 din dovada OSM pin-uită, nu deduse din ierarhie.
- 1 × `TEMPORAL_SNAPSHOT_DIFFERENCE` (`info`): ACTUAL, catalogul celor 85 de roluri și pachetul celor 8 contururi au axe temporale distincte și nu sunt prezentate ca un snapshot atomic unic.
- 1 × `SOURCE_NOT_ATOMIC_SNAPSHOT` (`info`): manifestul celor 8 contururi declară `source_atomic_snapshot=false`; se păstrează versiunea și timestampul fiecărei relații.

Nu există ID-uri ACTUAL duplicate, roluri OSM duplicate, valori multiple, valori invalide, conflicte rol–ACTUAL, roluri negrupate sau contururi fără geometrie/proof manifest.

## Dovezi per-ID

Registre persistate și validate semantic față de sursele originale:

- `docs/evidence/web-r2a1-actual-admin-level-per-id.csv`: 5.848 rânduri; SHA-256 `3d7e1ceba5e760e458e251b687caa41a184ce8ee5ef39b7a270057e9c189fe85`.
- `docs/evidence/web-r2a1-nistrenia-osm-roles-per-id.csv`: 85 rânduri; SHA-256 `44572b693a9013ec80b0a673aa8fa025dece4d456a4594f67dba657e949a2b4d`.
- `docs/evidence/web-r2a1/registry-actual-ro.jsonl`: 3.246 rânduri.
- `docs/evidence/web-r2a1/registry-actual-md.jsonl`: 2.602 rânduri.
- `docs/evidence/web-r2a1/registry-ni-source-only.jsonl`: 8 rânduri.
- `docs/evidence/web-r2a1/registry-osm-reused-roles.jsonl`: 85 rânduri.

JSONL-urile includ ID stabil, nume, jurisdicție/context operațional, tipul înregistrării, relation ID, valoare brută și normalizată `admin_level`, stare, proveniență, snapshot/version/timestamp, existența geometriei, apartenența ACTUAL/source-only și codurile de excepție.

## SHA-256 pe intrările originale

Validatorul citește octeții direct din checkout-ul Git și calculează SHA-256 înainte de parsare. Manifestul complet este `docs/evidence/web-r2a1/sha256-manifest.json`. Intrările principale sunt:

| Fișier | SHA-256 |
|---|---|
| `public/data/actual-entities.json` | `014ce7ad76c20f07de64f5ed3db0debcd676db78c25e25cd3abefe98fcfe5700` |
| `public/data/actual-consolidated-tree.json` | `b44b7b4eea0abec975ad01d8b7209568df0c83a1e5764c440ed893b960f49b1f` |
| `public/data/p907216-osm-roles.json` | `1bd2f2eac7dd9a987c355cc459c4ce5299eb00ad3ffd74f2eab0149b695eefff` |
| `public/data/p909-nistrenia-osm-navigation.json` | `64d90b0c5b16c71546f741b3a20181ac01ebf5106f70080522d8601d4bd83bae` |
| `public/data/p9095-osm-outlines.json` | `e48a34e31ede520a22b399d4ad07f48cd68303ecb937c78b6016c9993f41a2a6` |
| `public/data/p9095-osm-outlines-manifest.json` | `85783ab5a82dd8a872ffa725f6af35fc86d53a8a5e715a1fb546260a1c50102b` |
| `data/current/actual-release-manifest.json` | `52ae583f284bac2d00bc3b5e4b96b6c429c659b8def297197d7f3f38dc042856` |
| `data/current/actual-release-gate.json` | `dbe3e79ef8c136e56453c5c59a77bc5ee3b58c084bf7078f530915f1d2aa6455` |
| `data/current/actual-release-persisted.json` | `97d348dce7954d5a538d6868bc82a1fef5afd607f73765922af2668663b4b2f8` |
| `docs/p9.0.7.2.15-osm-semantic-reconciliation.json` | `dd21c3d123382c38a82574ce068f07ab1c3edb923edfa1240342b2d137e21775` |

## Reproductibilitate

Validator: `scripts/audit/web-r2a1-admin-level-census.mjs`.

Comandă de regenerare:

```bash
node scripts/audit/web-r2a1-admin-level-census.mjs --out-dir <director>
```

Comandă CI de verificare a manifestului persistat:

```bash
node scripts/audit/web-r2a1-admin-level-census.mjs \
  --out-dir <director-temporar> \
  --verify-manifest docs/evidence/web-r2a1/sha256-manifest.json
```

Workflow dedicat: `.github/workflows/web-r2a1-admin-level-census.yml`. El verifică și regresiile existente pentru catalogul celor 85 de roluri, navigația NI și paritatea celor 8 contururi, apoi confirmă explicit că `data/` și `public/` nu diferă de base SHA.

## Concluzie și gate pentru etapa următoare

WEB-R2a.1 poate fi considerat închis numai după ce SHA-ul final al PR #377 regenerează byte-for-byte același manifest și toate verificările obligatorii sunt verzi. Cele 8 valori NI `missing` și diferențele temporale sunt constatări ale recensământului, nu motive pentru a inventa valori în această etapă; ele devin intrarea controlată pentru WEB-R2a.2.

WEB-R2b rămâne blocat. P9.1 rămâne blocat. ACTUAL rămâne nemodificat.
