# RM046 — evidence read-surface hardening

PR423 head c55664aa19db300a684b02aa7261fe6d81a9b79d introduced an unrestricted directory argument into the shared manifest reader. CodeQL reported high py/path-injection alerts107 and108 at the manifest and file-hash reads. The failure and annotations are preserved; no dismiss or query exclusion is used. No data exposure is claimed to have occurred.

The public frozen-proof CLIs now accept only the declared repository dossier paths. Existing documented CLI commands remain valid; internal trusted callers and temporary test packets still use the library API. This narrows artifact read authority rather than weakening a data gate. Manifest names are never joined to a path: the reader first enumerates physical directory entries, rejects root/member symlinks, then resolves each manifest name by exact lookup. Portable traversal, drive, alternate-stream, device and normalization-ambiguous filenames are refused. Duplicate JSON keys and invalid byte/hash metadata also fail closed.

The original six loader tests remain. Nine security tests cover eleven portable malicious-name cases, symlink member/root/manifest rejection and both CLI boundaries. Ubuntu CI creates the actual escaping member symlink; restricted Windows hosts exercise the same guard through a mocked directory entry, without skipping the test. Real102-object and6287-row replays remain unchanged after hardening. New exact-head CI and individual CodeQL closure are required before admission.

This change does not modify ACTUAL, legal parents, source timestamps, runner trust, required checks or semantic acceptance. It does not resolve historical version gaps or promote an OSM source.

Follow-up on6f59b4b: CodeQL identified alerts109/110 at the user-text Path.resolve validation itself. The guard now compares raw CLI text against exact trusted literal spellings before any path construction; it returns only the trusted constant. Two further tests reject traversal and URI/NUL input without invoking resolve and preserve the documented relative spelling. Eleven security tests are required on the next exact HEAD.
