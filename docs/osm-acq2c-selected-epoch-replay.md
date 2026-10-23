# Selected history reconciliation at the frozen epoch

Tooling/evidence only. The full planetary base has independently verified bytes,
but source qualification and independent human/signed publication validation
remain pending. This does not promote OSM, certify area equivalence, adjudicate
any spatial UNKNOWN, change ACTUAL, edit public OSM or authorize P9.1.

The completed base extraction contains all 3,208 requested identities and 25,272
versions. Applying the 45 authenticated hourly diffs adds two observed versions.
All requested identities have a selected record at the target epoch. Eight
histories contain explicit version gaps; they are retained, not repaired or
declared complete. See the per-ID gap ledger. An observed target record is not
proof of complete historical continuity or dependency closure.

One missing version per gapped identity was requested read-only from the official
API. All eight samples returned HTTP 403 with empty bodies. Status alone does
not establish the reason; redaction is not asserted and no override was attempted.
The original per-request capture names in the API summary are private references;
their identical empty body is mirrored once as `sampled-api-response.bin`.

The local controller and published controller independently regenerated identical
`selected-target.json` and `selected-history.jsonl` payloads. Their SHA-256 and
lengths are recorded in `payload-reproduction.json`. Metadata reports differ in
controller/module identities and code hashes, which is explicitly documented.
Private payloads and the planetary binary are not included in GitHub; the inner
`private-replay-manifest.json` describes those local files, while the outer
manifest covers only the public evidence files actually present in this folder.

RM-044 fixes a literal comparison of equivalent `Z` and `+00:00` UTC notations.
The validator compares timezone-aware instants. Real one-second differences and
naive timestamps remain rejected. The failed original controller and stderr are
preserved. Twenty-eight local core/loader tests pass.

Run from a checkout under `<workspace>/work/<checkout>`:

```text
python scripts/audit/osm_acq2c_selected_epoch_replay.py
```

The fixed local inputs are `<workspace>/work/osm-acq2c-bulk` and the previously
captured replication evidence under `<workspace>/outputs/ROADMAP-RESUME-20261022`.
The controller waits at most two hours for a finished extraction, verifies its
complete manifest, checks the frozen ID plan, replays original diff bytes and
refuses to overwrite prior results. Its output directory is the separate fixed
`selected-epoch-published-20261023` slot. No downloads occur.

Outstanding: adjudicate historical gaps; recover missing indirect geometry;
validate topology and the exact spatial predicate; compare generated Overpass
areas; satisfy publication validation. Source qualification remains false.
