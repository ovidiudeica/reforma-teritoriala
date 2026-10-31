"""Read-only product coverage from committed catalogs; never builds/imports geometry.

Run with Python 3: scripts/audit/product-launch-coverage.py
Output is confined to outputs/product-launch-coverage. Input bytes come from Git
HEAD, avoiding Windows checkout line-ending substitutions in SHA-256 evidence.
No network requests, legal reconciliation, OSMB inventory, or AUTO-4 investigation.
"""
import csv
import argparse
import hashlib
import io
import json
import subprocess
from collections import Counter
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--repository', type=Path, help='Explicit repository when executing an exported copy')
args = parser.parse_args()
ROOT = (args.repository or Path(__file__).resolve().parents[2]).resolve(strict=True)
assert (ROOT / '.git').exists(), 'Expected a Git repository or worktree'
OUT = ROOT / 'outputs/product-launch-coverage'
INPUTS = [
    'public/data/actual-entities.json',
    'data/sources/ro-siruta-current.json',
    'data/sources/cuatm-current.json',
    'views/nistrenia/administration.json',
    'data/current/ro-official-reconciliation.json',
]

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

sources = {}
values = []
for name in INPUTS:
    raw = subprocess.check_output(['git', '-c', 'safe.directory=' + ROOT.as_posix(),
                                   'show', 'HEAD:' + name], cwd=ROOT)
    sources[name] = {'bytes': len(raw), 'sha256': sha(raw)}
    values.append(json.loads(raw))
index, siruta, cuatm, ni, ro_reconciliation = values
entities = index['entities']
assert len(entities) == len({e['id'] for e in entities}) == index['entity_count']
bound = {j: {str((e.get('legal') or {}).get('id')) for e in entities
             if e['jurisdiction'] == j and (e.get('legal') or {}).get('id') is not None}
         for j in ['RO', 'MD']}
ro = [r for r in siruta['records'] if r['level'] == 3 and r['siruta'] not in bound['RO']]
md = [r for r in cuatm['records'] if r['code'] not in bound['MD']]
ni_missing = [n for n in ni['nodes'] if n['geometry_ref'] is None]
assert all(n['geometry_status'] in ['GEOMETRY_CANDIDATE', 'NO_GEOMETRY_EVIDENCE'] for n in ni_missing)
OUT.mkdir(parents=True, exist_ok=True)

def csv_bytes(columns, rows):
    stream = io.StringIO(newline='')
    writer = csv.DictWriter(stream, fieldnames=columns, lineterminator='\n')
    writer.writeheader()
    writer.writerows(rows)
    return stream.getvalue().encode('utf-8')

files = {
    'ro-component-localities.csv': csv_bytes(
        ['siruta', 'name', 'parent_siruta', 'parent_name', 'level'],
        [{k: r.get(k) for k in ['siruta', 'name', 'parent_siruta', 'parent_name', 'level']} for r in ro]),
    'md-without-direct-binding.csv': csv_bytes(
        ['code', 'name', 'parent_code', 'parent_name', 'status_code', 'row'],
        [{k: r.get(k) for k in ['code', 'name', 'parent_code', 'parent_name', 'status_code', 'row']} for r in md]),
    'ni-without-own-geometry.json': (json.dumps(
        [{k: n.get(k) for k in ['id', 'display_name', 'parent_id', 'kind', 'geometry_status',
                                'geometry_ref', 'geometry_candidates', 'source_refs']} for n in ni_missing],
        ensure_ascii=False, indent=2) + '\n').encode('utf-8'),
}
report = {
    'schema': 'product-launch-coverage-v1',
    'method': 'Exact identifier join against committed catalogs; no spatial inference or legal assignment',
    'inputs': sources,
    'published_entities': len(entities),
    'entities_by_jurisdiction': dict(sorted(Counter(e['jurisdiction'] for e in entities).items())),
    'public_legal_statuses': dict(sorted(Counter(e['validation']['legal_identity_status'] for e in entities).items())),
    'ro_uat_existing_reconciliation': ro_reconciliation['summary'],
    'ro_component_localities_without_direct_binding': len(ro),
    'md_official_records_without_direct_binding': len(md),
    'md_unbound_by_source_status_code': dict(sorted(Counter(r['status_code'] for r in md).items())),
    'ni_documentary_nodes': len(ni['nodes']),
    'ni_geometry_statuses': dict(sorted(Counter(n['geometry_status'] for n in ni['nodes']).items())),
    'ni_nodes_without_own_accepted_geometry': len(ni_missing),
    'limitations': [
        'No direct legal.id binding does not prove geometric absence or absence of a same-name search result.',
        'Parent coverage and candidate/name matches do not establish an independent unit geometry or identity.',
        'NI statuses are copied, not resolved; documentary nodes are not new ACTUAL entities.',
        'These are product coverage limits, not a repeat of the OSMB inventory or the 109 AUTO-4 investigations.',
    ],
    'actual_changes': 0, 'p91_authorized': False,
    'files': {name: {'bytes': len(raw), 'sha256': sha(raw)} for name, raw in files.items()},
}
files['report.json'] = (json.dumps(report, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
for name, raw in files.items():
    (OUT / name).write_bytes(raw)
print(json.dumps({k: v for k, v in report.items() if k not in ['inputs', 'files', 'limitations', 'ro_uat_existing_reconciliation']}, ensure_ascii=True))
