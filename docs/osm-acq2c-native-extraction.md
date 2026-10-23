# Selected native base-history extraction

This tooling does not qualify the source, reconstruct the target epoch, certify
dependency closure or adjudicate any UNKNOWN relation.

The official full-history base ends at `2026-10-19T00:00:04Z`. The target remains
`2026-10-20T20:23:47Z`, requiring the independently conserved replication chain.
Do not give the base the target timestamp. Publication/provenance qualification
remains separate from byte verification.

After the existing single downloader has completed, run from the repository:

```text
python scripts/audit/osm_acq2c_native_extract.py --storage-slot workspace
```

Use the Python runtime with Pyosmium 4.3.2 installed. The fixed workspace slot
resolves to the existing parent `osm-acq2c-bulk` directory. No arbitrary input or
output paths, URL selection, downloads or promotion are exposed by this CLI.

The command rejects an incomplete receipt, wrong source URL/ETag/length/MD5,
missing SHA-256, a current-only file or a mismatched PBF epoch header. It performs
an independent full SHA-256 and published MD5 pass before parsing. The native C++
ID filter avoids Python callbacks for unrelated planetary objects. A second typed
identity check prevents node/way/relation ID collisions. All versions of the
3,208 requested typed identities are retained in the selected base JSONL.

Derived node coordinates use exact OSM integer coordinates. Ordered way node
references, relation members and tags are preserved. User names, UIDs and
changesets are omitted from derived records. Originals remain unchanged.

Missing identities and redaction/version gaps are reported explicitly. Duplicate
versions or reversed versions/timestamps stop extraction. Output uses a new fixed
directory, exclusive files and a SHA-256 manifest; a previous or interrupted
extraction is never overwritten. A failed scan may leave its partial JSONL as
historical evidence, without a final report/manifest. Do not treat it as complete.

Next operations still required: reconcile base/tail overlaps by exact object
semantics, recover indirect dependencies, verify the correct target versions,
rebuild topology and evaluate the exact spatial predicate. An empty gap list for
selected base objects is not any of those acceptances.

Tests: standard-library negative/core tests plus real locally generated history
PBF fixtures for typed filtering, version preservation, exact coordinates,
metadata exclusion, deterministic replay, missing IDs, epoch metadata and
current-only rejection. The dedicated CI workflow pins Pyosmium and performs
only small synthetic fixture operations; it never downloads the planetary base.
