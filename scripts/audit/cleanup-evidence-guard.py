#!/usr/bin/env python3
"""Read-only admission of the cleanup evidence; does not rebuild ACTUAL."""
import csv
import gzip
import hashlib
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / 'docs/audits/repo-cleanup-final'
manifest = json.loads((EVIDENCE / 'sha256-manifest.json').read_bytes())
seen = set()
for row in manifest['files']:
    name = row['file']
    assert pathlib.Path(name).name == name and name not in {'.', '..'} and name not in seen
    seen.add(name)
    raw = (EVIDENCE / name).read_bytes()
    assert len(raw) == row['bytes'] and hashlib.sha256(raw).hexdigest() == row['sha256'], name
baseline = json.loads((EVIDENCE / 'c0-baseline.json').read_bytes())
tree = json.loads(gzip.decompress((EVIDENCE / 'c0-tree.json.gz').read_bytes()))
assert len(tree) == baseline['tracked_files'] == 3464
by_path = {r['path']: r for r in tree}
assert len(by_path) == len(tree)
assert sum(r['bytes'] for r in tree) == baseline['logical_tree_bytes']
for name, count in [('c0-protected.json', 478), ('c0-runtime.json', 440)]:
    rows = json.loads((EVIDENCE / name).read_bytes())
    assert len(rows) == len({r['path'] for r in rows}) == count
    assert all(by_path[r['path']] == r for r in rows)
runtime = json.loads((EVIDENCE / 'c0-runtime.json').read_bytes())
assert sum(r['path'].endswith('.geojson') for r in runtime) == 125
summary = json.loads((EVIDENCE / 'c2-summary.json').read_bytes())
provenance = json.loads((EVIDENCE / 'c2-provenance.json').read_bytes())
assert summary['commit'] == provenance['snapshot']
# The receipt identifies the original analyzer, not every future implementation.
# Preserve and verify its exact source bytes while allowing a portable successor.
assert hashlib.sha256((EVIDENCE / 'c2-analyzer-v1.py.txt').read_bytes()).hexdigest() == provenance['analyzer_sha256']
portable = json.loads((EVIDENCE / 'c2-portability-proof.json').read_bytes())
assert hashlib.sha256((ROOT / portable['analyzer']).read_bytes()).hexdigest() == portable['analyzer_sha256']
assert portable['legacy_replay_exact'] and portable['analyzer_regression_tests_passed'] == 4
assert not portable['actual_changes'] and not portable['p91_authorized']
with gzip.open(EVIDENCE / 'c2-per-file.csv.gz', 'rt', encoding='utf8', newline='') as handle:
    rows = list(csv.DictReader(handle))
assert len(rows) == len({r['path'] for r in rows}) == summary['tracked_files']
assert all(r['classification'] in summary['allowed_classifications'] for r in rows)
assert all(r['delete_decision'] == 'RETAIN' for r in rows)
for line in (EVIDENCE / 'c2-uncompressed-SHA256SUMS').read_text().splitlines():
    digest, name = line.split('  ', 1)
    raw = (EVIDENCE / 'c2-summary.json').read_bytes() if name == 'summary.json' else gzip.decompress((EVIDENCE / ('c2-' + name + '.gz')).read_bytes())
    assert hashlib.sha256(raw).hexdigest() == digest, name
with (EVIDENCE / 'c2-258-reconciliation.csv').open(encoding='utf8', newline='') as handle:
    candidates = list(csv.DictReader(handle))
assert len(candidates) == len({r['path'] for r in candidates}) == 258
assert not provenance['actual_changes'] and not provenance['p91_authorized']
print(json.dumps(dict(status='PASS', baseline_files=len(tree), protected_files=478,
                      runtime_files=440, geojson=125, snapshot_files=len(rows),
                      reconciled_candidates=len(candidates), actual_changes=0, p91_authorized=False)))
