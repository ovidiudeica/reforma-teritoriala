# ACTUAL candidate release flow

The persisted ACTUAL RO+MD release on `main` is immutable between explicit promotions.

## Build a candidate

Run **Build ACTUAL candidate snapshot** manually. The workflow starts from the current persisted release on `main`, validates it read-only, regenerates the complete ACTUAL pipeline, runs all jurisdiction and global release gates, and writes the result to a new isolated branch.

Each candidate contains:

- `data/current/actual-release-candidate.json` — binds the candidate to the exact persisted base release and exact candidate manifest.
- `data/current/actual-candidate-diff.json` — exhaustive comparison against the persisted release.
- the candidate release manifest, release gate, catalog, master geometries, public contract, official-source snapshots and generated audits.

The diff reports entity additions/removals, legal-identity changes, classification changes, master-geometry changes, semantic official-registry changes and component hash drift. Differences are never auto-accepted.

## Promote a candidate

Run **Promote ACTUAL candidate** with:

1. the exact candidate branch;
2. the exact candidate snapshot id;
3. confirmation text `PROMOTE <snapshot_id>`.

Promotion fails closed if the persisted release on `main` moved since candidate generation, if any candidate manifest/diff bytes drifted, or if the candidate release gate is not PASS.

A successful promotion run does **not** push the candidate directly to `main`. It writes the new persisted-release marker on the candidate branch and opens a promotion PR. The required `verify-persisted-release` branch-protection check must pass before that PR can merge.

## Direct refreshes

`Import OSM administrative data` is intentionally deprecated. It cannot replace the persisted release. The supported release path is:

`candidate build -> review diff -> explicit promotion -> protected PR -> main`.
