# Audit I/O boundaries and historical integrity gate

Eight existing CodeQL findings on main8b052ec3 are preserved with their actual reported levels (fivecritical, threehigh). These are CLI-auditor input boundaries; no exploitation of the published website is inferred. The P903 auditor already checked numeric syntax and the published browser auditor already checked origin/path. Constant-origin URL construction from canonical positive safe integers, exact parsed relation lookup and a fixed literal published baseline eliminate the remaining taint paths without changing valid input URLs.

All eight historical outline URLs,85 reused-role URLs and84 exception URLs are byte-identical for accepted inputs. The five geometry/parser algorithms and ACTUAL are not regenerated. Malformed IDs, traversal, credentials, unexpected origin, initial query/fragment and arbitrary output roots fail before I/O. Only repository/temporary output slots are accepted. Historical workflow now uses --output-slot repository and preserves the report basename/schema. Website UX is unchanged.

The historical integrity command previously tested only empty Git stdout; an unavailable08a873 reference could return an error with empty stdout and therefore pass the shell predicate even with modified public bytes. The new gate resolves the exact approved event base and tested head, requires the commit to exist, compares candidate data/public to that approved base, and rejects runtime data/public mutations. No required check or protection is weakened. Offline Git fixtures prove missing refs, changed data, dirty runtime and incorrect head fail, while approved code-only changes pass.

Validation:35 local tests PASS (9 boundary cases,6 source-integrity cases,20 published-source/runtime/retry cases). Raw native output remains in original-tests.txt.gz, readable output is explicitly normalized only for line endings and trailing whitespace. CodeQL rescan and full exact-head CI remain mandatory. No alert was dismissed and no analysis rule was disabled.

Protected ACTUAL5848/32, legal MD parents, host-trust, source freshness14days and blocked P9.1 remain unchanged. No public OSM edits or source promotion.
