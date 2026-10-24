"""Reproduce an observational PBF proposal ledger, never source adjudication.

The frozen numeric observations are inputs. This replay does not re-execute the
geometric algorithm or authenticate private histories by mere hash publication.
"""
import collections
import hashlib
import json
import pathlib
from osm_acq2c_full_batch import EPOCH, source_registry
from osm_acq2c_selected_epoch_core import moment
from osm_acq2c_selected_epoch_replay import verify_manifest

ROOT = pathlib.Path(__file__).resolve().parents[2]
PACKET = ROOT / 'docs/evidence/osm-acq2c-exact242-proposals-20261024'

def build(reports, expected, bindings):
    rows = []
    boundaries = None
    for report in reports:
        if report['epoch'] != EPOCH or report['source_qualified'] is not False or report['topology_certified'] is not False or report['unknown_adjudicated'] != 0:
            raise ValueError('Report epoch or acceptance guard differs')
        if boundaries is None:
            boundaries = report['country_boundaries']
        elif boundaries != report['country_boundaries']:
            raise ValueError('Country boundaries differ')
        rows.extend(report['rows'])
    ids = [r['id'] for r in rows]
    if any(type(i) is not int or i <= 0 for i in ids) or len(set(ids)) != len(ids) or set(ids) != set(expected):
        raise ValueError('Duplicate, missing or unexpected identity')
    for row in rows:
        domains = row['domains']
        if len(set(domains)) != len(domains) or set(domains) != set(expected[row['id']]) or set(row['exact_predicate']) != set(domains):
            raise ValueError('Domain observations differ')
        if type(row['version']) is not int or row['version'] < 1 or moment(row['timestamp']) > moment(EPOCH):
            raise ValueError('Invalid target version or timestamp')
        if row['source_qualified'] is not False or row['formal_adjudication'] is not False or row['status'] != 'PROVISIONAL_EXACT_PBF_NOT_SOURCE_ACCEPTANCE' or row['missing_direct_geometry']:
            raise ValueError('Unsupported acceptance or missing geometry')
        if len(set(row['history_gap_dependencies'])) != len(row['history_gap_dependencies']):
            raise ValueError('Duplicate gap identity')
        for result in row['exact_predicate'].values():
            if result['verdict'] != 'OUT_OF_SCOPE_PROVEN' or result['missing'] or result['inside_witness'] is not None:
                raise ValueError('Unproved exclusion observation')
            for key in ('node_occurrence_states', 'segment_interval_states'):
                states = result[key]
                if set(states) - {'inside','outside','boundary'} or any(type(v) is not int or v < 0 for v in states.values()) or states.get('inside',0):
                    raise ValueError('Contradictory exact predicate observation')
    counts = collections.Counter(v['verdict'] for r in rows for v in r['exact_predicate'].values())
    return dict(epoch=EPOCH, rows=sorted(rows,key=lambda r:r['id']), inputs=bindings,
        country_boundaries=boundaries, summary=dict(distinct_relations=len(rows),
        domain_observations=sum(len(r['domains']) for r in rows), exact_predicate_counts=dict(counts),
        direct_geometry_missing=0, relations_with_observed_history_gaps=sum(bool(r['history_gap_dependencies']) for r in rows),
        mathematical_out_of_scope_proposals=len(rows), formally_adjudicated_new=0, formal_unknown_remaining=len(rows)),
        source_qualified=False, overpass_equivalence_certified=False, topology_certified=False,
        scope='Exact direct-member PBF predicate proposals only, not generated Overpass area, historical continuity, source or legal acceptance.')

def encoded(value):
    return (json.dumps(value,sort_keys=True,indent=2)+'\n').encode()

def verify_gap_observations(gaps, rows):
    if gaps['source_qualified'] is not False or gaps['history_gaps_resolved'] != 0 or gaps['overlap_conflicts']:
        raise ValueError('Gap acceptance or overlap guard differs')
    by_code={r['code']:r for r in gaps['rows']}
    if len(by_code)!=len(gaps['rows']) or len(by_code)!=gaps['objects']:
        raise ValueError('Duplicate gap identity or count differs')
    for row in by_code.values():
        versions=row['missing_versions']
        if not versions or len(set(versions))!=len(versions) or any(type(v) is not int or v<1 for v in versions) or row['source_qualified'] is not False or row['historical_continuity']!='BLOCKED_VERSION_GAPS':
            raise ValueError('Invalid missing-version observation')
    if sum(len(r['missing_versions']) for r in by_code.values())!=gaps['absent_observed_versions']:
        raise ValueError('Missing version count differs')
    if any(set(r['history_gap_dependencies'])-set(by_code) for r in rows):
        raise ValueError('Unbound relation gap dependency')

def validate():
    verify_manifest(PACKET)
    read = lambda n: json.loads((PACKET/n).read_bytes())
    registry = read('registry.json')
    reports = []
    for prefix, binding in zip(('priority','remaining238'),registry['inputs'],strict=True):
        manifest_raw = (PACKET/(prefix+'-manifest.json')).read_bytes()
        manifest = json.loads(manifest_raw)
        raw = (PACKET/(prefix+'-report.json')).read_bytes()
        receipt = read(prefix+'-projection.json')
        if manifest['files'] != [receipt['private_original_report']] or hashlib.sha256(manifest_raw).hexdigest() != binding['manifest_sha256']:
            raise ValueError('Original observation manifest differs')
        if receipt['public_report'] != dict(bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest()) or receipt['transformation'] != 'Replace absolute code-path keys with unique basenames; all other fields unchanged':
            raise ValueError('Public projection binding differs')
        report=json.loads(raw)
        if any('/' in k or '\\' in k or ':' in k for k in report['code_sha256']):
            raise ValueError('Private absolute code path in public projection')
        reports.append(report)
    unknown = {r['id']: [d['domain'] for d in r['domains']] for r in source_registry()['rows'] if not r['resolved']}
    if len(unknown) != 242:
        raise ValueError('Frozen UNKNOWN identity set differs')
    regenerated = encoded(build(reports,unknown,registry['inputs']))
    if regenerated != (PACKET/'registry.json').read_bytes():
        raise ValueError('Byte-identical registry replay differs')
    gaps=read('observed-gaps.json')
    verify_gap_observations(gaps,registry['rows'])
    if (gaps['objects'],gaps['absent_observed_versions'])!=(159,641):
        raise ValueError('Frozen observed gap cohort differs')
    return dict(status='PASS_OBSERVATION_REPLAY_ONLY',**registry['summary'],source_qualified=False,overpass_equivalence_certified=False,topology_certified=False)

if __name__ == '__main__':
    print(json.dumps(validate()))
