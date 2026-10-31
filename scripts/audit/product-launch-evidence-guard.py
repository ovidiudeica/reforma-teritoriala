"""Verify accepted product evidence and replay coverage; no ACTUAL writes."""
import gzip
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / 'docs/audits/product-launch-20261031'
manifest = json.loads((EVIDENCE / 'sha256-manifest.json').read_bytes())
seen = set()
for row in manifest['files']:
    name = row['file']
    assert name == Path(name).name and name not in ['.', '..', 'sha256-manifest.json']
    assert name not in seen
    seen.add(name)
    raw = (EVIDENCE / name).read_bytes()
    assert len(raw) == row['bytes'] and hashlib.sha256(raw).hexdigest() == row['sha256'], name
assert seen == {p.name for p in EVIDENCE.iterdir() if p.is_file() and p.name != 'sha256-manifest.json'}

acceptance = json.loads((EVIDENCE / 'acceptance.json').read_bytes())
head = acceptance['tested_head']
merge = acceptance['merge_commit']
assert acceptance['status'] == 'READY_ACTUAL_WITH_DECLARED_DEFERRALS'
assert not acceptance['actual_mutation_allowed'] and not acceptance['p91_authorized']
assert acceptance['actual_changes'] == 0 and not acceptance['legal_exhaustiveness_is_launch_gate']
required = {'verify-persisted-release', 'actual-change-reproducibility',
            'actual-release-trust-chain', 'p2-statistical-foundation',
            'frontend-geometry-taxonomy', 'frontend-browser-qa'}
for rows, sha in [(acceptance['pr_ci']['checks'], head), (acceptance['postmerge_checks'], merge)]:
    assert required <= {r['name'] for r in rows}
    assert all(r['head_sha'] == sha and r['status'] == 'completed' and r['conclusion'] == 'success' for r in rows)
for rows, sha in [(acceptance['pr_ci']['runs'], head), (acceptance['postmerge_runs'], merge)]:
    assert rows and all(r['head_sha'] == sha and r['status'] == 'completed' and r['conclusion'] == 'success' for r in rows)
raw = gzip.decompress((EVIDENCE / 'published-ci-report.json.gz').read_bytes())
assert hashlib.sha256(raw).hexdigest() == manifest['published_report_uncompressed_sha256']
published = json.loads(raw)
assert published['status'] == 'PASS' and published['sourceSha'] == published['expectedPublishedSha'] == merge
assert published['coverage'] == 'PUBLISHED_EXACT_CHECKOUT' and published['trackedSourcesClean']
assert not published['errors']
inventory = published['publishedInventory']
assert inventory['status'] == 'PASS' and inventory['checkedFiles'] == inventory['expectedFiles'] == 440
assert inventory['geojsonFiles'] == 125 and all(r['status'] == 'PASS' for r in inventory['records'])
assert json.loads((EVIDENCE / 'npm-audit.json').read_bytes())['metadata']['vulnerabilities']['total'] == 0

subprocess.check_call([sys.executable, str(ROOT / 'scripts/audit/product-launch-coverage.py')], cwd=ROOT)
for name in ['report.json', 'ro-component-localities.csv', 'md-without-direct-binding.csv', 'ni-without-own-geometry.json']:
    assert (ROOT / 'outputs/product-launch-coverage' / name).read_bytes() == (EVIDENCE / name).read_bytes(), name
print(json.dumps({'status': 'PASS', 'accepted_runtime': merge, 'published_files': 440,
                  'geometry_resources': 125, 'coverage_replay': True, 'actual_changes': 0,
                  'p91_authorized': False}))
