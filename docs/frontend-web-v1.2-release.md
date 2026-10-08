# web-v1.2 — release closure

## Baseline

web-v1.2 is the closed Atlas application baseline after the protected sequence PR #241 through PR #247.

- functional baseline commit: `54e6673141ec21fb3a68cca41ce1e747256eef21`
- final implementation step: PR #247, `web-v1.2.7 — browser + visual QA final`
- application version: `web-v1.2`
- release tag: `web-v1.2.0` (created only after the protected closure PR merges)
- release closure is metadata/documentation/regression evidence only; it does not redefine the functional baseline

The application version and ACTUAL data release remain separate identities. `public/data/app-build-info.json` records the functional application SHA and the ACTUAL release consumed by that baseline.

## ACTUAL binding

The closed web-v1.2 baseline is bound to the already immutable ACTUAL release:

- release: `actual-v1.2.0`
- snapshot: `actual-a9e5a4ddcb5277ef`
- fingerprint: `a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446`
- public contract: `actual-public-entity-v3`
- entities: 5848
- consolidated hierarchy nodes: 5848
- statistical roles: 63
- statistical-only entities / separate statistical boundaries: 18

Official Moldova statistical identity remains `MD120`; `MD121` remains OSM evidence only and is not an official statistical identity.

This closure does not modify ACTUAL semantic bytes, geometries, registries, source snapshots, release manifest identity, snapshot ID or fingerprint.

## Functional scope closed in web-v1.2

The release includes the completed sequence:

1. web-v1.2.1 — consolidated Atlas tree synchronization;
2. web-v1.2.2 — geometry subtypes and Atlas filters;
3. web-v1.2.3 — keyboard search and disambiguation;
4. web-v1.2.4 — shareable URL state and History API;
5. web-v1.2.5 — mobile drawer and details bottom sheet;
6. web-v1.2.6 — provenance, legend and accessibility hardening;
7. web-v1.2.7 — real-browser and visual QA.

The final browser QA used real Chrome/CDP across seven desktop/mobile viewports and closed the residual defects found during final validation. The final web-v1.2 test baseline is 163 Node tests plus 26 browser tests, 189 passing and zero failures.

## Release invariants

A web-v1.2 release closure is acceptable only when all of the following remain true:

- `public/data/app-build-info.json` declares `web-v1.2` and points `app_commit` to the functional baseline SHA above;
- the app metadata points to `actual-v1.2.0`, the current snapshot and exact fingerprint;
- `data/current/actual-release-manifest.json` and every component bound by it retain their existing bytes;
- administrative geometry mutations = 0;
- statistical geometry mutations = 0;
- registry drift = 0;
- required ACTUAL gates and frontend checks stay green;
- GitHub Pages publishes the closure commit successfully;
- branch protection is not relaxed.

`scripts/test/frontend-smoke.test.mjs` pins the public app/data binding so a later accidental rollback to web-v1.1 or ACTUAL v1.1 metadata fails CI.

## Tag and release policy

After the closure PR is merged and the exact merge commit passes the protected `main` checks, create the annotated/public release tag `web-v1.2.0` at that closure commit.

The tag identifies the complete release closure (application surface + final metadata/evidence). The tracked `app_commit` remains the pre-closure functional baseline by design, following the existing web-v1.1 convention and avoiding a self-referential commit hash.

The web release must not republish or mutate `actual-v1.2.0`. The ACTUAL release remains independently immutable.

## Next phase

After `web-v1.2.0` is published and verified, web-v1.2 is frozen as the current Atlas baseline. The next major corpus phase may begin without reopening web-v1.2 except for explicit bugfix/security maintenance.
