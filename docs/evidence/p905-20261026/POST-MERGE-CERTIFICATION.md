# P9.0.5 — certificare finală post-merge ACTUAL

**Verdict:** `POST_MERGE_CI_CERTIFIED` pentru commitul exact `9fbc07321c6a76df5463cb4420c4f25a91a14f7a`, integrat din PR #464. Inventarul complet, hashurile și rezultatul separat al verificării binare se găsesc în [POST-MERGE-CERTIFICATION.json](./POST-MERGE-CERTIFICATION.json).

## Gate-urile post-merge

Pe commitul de integrare, [GitHub Actions ACTUAL #40974123534](https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/40974123534) arată explicit SUCCESS pentru detectarea scope-ului, cele două construcții A/B, comparația și gate-ul agregat de reproductibilitate. Din **22/22 check-run-uri, toate sunt SUCCESS**, niciunul SKIPPED, FAILURE sau IN_PROGRESS. S-au încheiat tot cu SUCCESS CodeQL, build/deploy Pages, persisted-release, release trust chain, validările de topologie și geometrie, exportul și verificările browser.

## Verificarea binară independentă

Arhivele GitHub A `12943000090` și B `12942650992` au digesturi ZIP distincte și ambele validate contra GitHub. **Conținutul dezarhivat este identic** pentru toate cele trei fișiere:

| Membru | Octeți | SHA-256 în A și B |
| --- | ---: | --- |
| `candidate-tree.tar` | 498903040 | `8377452f7d740e4c222355c08d319ff942f54d9928bdb1ca79e1f2404c52ed73` |
| `candidate-ls-tree.txt` | 281353 | `8153240a4d822a25d6cff0a11ef50c1f486c5dd3770fa91de8b7bd48933967a1` |
| `proof.json` | 845 | `cab398ee542129d72262f6c69712e8ca40fccd1961a6177b8937a4c708139430` |

Această probă **este post-merge pe SHA-ul efectiv din main**, nu rezultatul anterior pe un SHA intermediar.

## Legături de încredere

- Runner admis: `github-ubuntu24-20261026.354.1`.
- Fingerprint host-trust: `90137aeb9032a2612a9414fe595213ac9daa0f0af8c28bcd4fce3c5341456b8d`.
- Fingerprint semantic ACTUAL nemodificat: `a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446`.
- Persisted release: PASS; legăturile environment/release verificate.

Această certificare închide incidentul de reproductibilitate [#461](https://github.com/ovidiudeica/reforma-teritoriala/issues/461). Nu introduce geometrii, nu reclasifică identități, nu modifică arborele părinte–copil și **nu autorizează P9.1**. Certificarea este valabilă pentru SHA-ul declarat și nu garantează automat viitoare schimbări de imagine runner sau de codebase.
