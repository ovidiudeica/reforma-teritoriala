"""Read-only incremental audit at the two authenticated extracts' frozen epoch.

This is not a qualification of Overpass's live/generated area cache.
"""
import collections
import datetime
import gzip
import hashlib
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path('work/gis-runtime').resolve()))
import shapely
from shapely.geometry import Polygon, MultiPolygon, Point, LineString

EPOCH = '2026-10-20T20:23:47Z'

def digest(data):
    return hashlib.sha256(data).hexdigest()

def encode(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + '\n').encode('utf8')

def decode_graph(packed, descriptor):
    if descriptor['header']['osmosis_replication_timestamp'] != EPOCH:
        raise ValueError('Incompatible extract epochs')
    if digest(packed) != descriptor['raw_gzip_sha256']:
        raise ValueError('Corrupt compressed graph')
    raw = gzip.decompress(packed)
    if digest(raw) != descriptor['raw_body_sha256']:
        raise ValueError('Corrupt graph body')
    return raw, json.loads(raw)['elements']

def merge_graphs(graphs):
    merged = {}
    origins = collections.defaultdict(list)
    for domain, elements in graphs.items():
        seen = set()
        for obj in elements:
            key = (obj['type'], obj['id'])
            if key in seen:
                raise ValueError('Duplicate object within extract: %r' % (key,))
            seen.add(key)
            if key in merged and merged[key] != obj:
                raise ValueError('Conflicting object versions/content: %r' % (key,))
            if not isinstance(obj.get('version'), int) or obj['version'] < 1 or not obj.get('timestamp'):
                raise ValueError('Unverified object version/timestamp')
            timestamp = datetime.datetime.fromisoformat(obj['timestamp'].replace('Z', '+00:00'))
            if timestamp.tzinfo is None or timestamp > datetime.datetime.fromisoformat(EPOCH.replace('Z', '+00:00')):
                raise ValueError('Object newer than frozen epoch')
            merged[key] = obj
            origins[key].append(domain)
    return merged, origins

def rings(paths):
    remaining = list(paths)
    result = []
    while remaining:
        chain = list(remaining.pop())
        if len(chain) < 2:
            raise ValueError('Degenerate boundary way')
        while chain[-1] != chain[0]:
            choices = [(i, p if p[0] == chain[-1] else list(reversed(p)))
                       for i, p in enumerate(remaining)
                       if p[0] == chain[-1] or p[-1] == chain[-1]]
            if len(choices) != 1:
                raise ValueError('Open or branched boundary by node identity')
            i, path = choices[0]
            chain.extend(path[1:])
            remaining.pop(i)
        result.append(chain)
    return result

def country_area(graph, domain):
    countries = [o for (t, _), o in graph.items() if t == 'relation'
                 and o.get('tags', {}).get('ISO3166-1') == domain
                 and o.get('tags', {}).get('boundary') == 'administrative']
    if len(countries) != 1:
        raise ValueError('Country root is ambiguous')
    root = countries[0]
    paths = {'outer': [], 'inner': []}
    for member in root['members']:
        if member['type'] == 'way':
            paths[member['role'] or 'outer'].append(graph[('way', member['ref'])]['nodes'])
    polygons = {}
    for role, members in paths.items():
        polygons[role] = [Polygon([(graph[('node', n)]['lon'], graph[('node', n)]['lat'])
                                  for n in ring]) for ring in rings(members)]
    if not all(p.is_valid for role in polygons.values() for p in role):
        raise ValueError('Invalid country ring')
    if any(sum(p.contains(h) for p in polygons['outer']) != 1 for h in polygons['inner']):
        raise ValueError('Ambiguous country hole')
    area = MultiPolygon([Polygon(p.exterior.coords,
                         [h.exterior.coords for h in polygons['inner'] if p.contains(h)])
                         for p in polygons['outer']])
    if not area.is_valid:
        raise ValueError('Invalid country polygon')
    shapely.prepare(area)
    return root, area

def classify(relation, graph, area):
    """Direct node/way proper-interior predicate; never bridge a missing node."""
    dependencies = set()
    missing = set()
    witnesses = []
    separation_distances = []
    valid = True
    for member in relation['members']:
        if member['type'] not in ('node', 'way'):
            continue  # Nested relations are not direct area-query witnesses.
        key = (member['type'], member['ref'])
        dependencies.add(key)
        obj = graph.get(key)
        if obj is None:
            missing.add(key)
            continue
        refs = [key[1]] if key[0] == 'node' else obj['nodes']
        chunk = []
        chunks = []
        for node_id in refs:
            nk = ('node', node_id)
            dependencies.add(nk)
            node = graph.get(nk)
            if node is None:
                missing.add(nk)
                if len(set(chunk)) > 1:
                    chunks.append(chunk)
                chunk = []
                continue
            xy = (node['lon'], node['lat'])
            if not (-180 <= xy[0] <= 180 and -90 <= xy[1] <= 90):
                valid = False
                continue
            chunk.append(xy)
            if key[0] == 'node':
                separation_distances.append(area.distance(Point(xy)))
            if area.contains(Point(xy)):
                witnesses.append({'type': 'node', 'id': node_id, 'member': list(key)})
        if len(set(chunk)) > 1:
            chunks.append(chunk)
        if key[0] == 'way':
            separation_distances.extend(area.distance(LineString(c)) for c in chunks)
            if len(refs) == 1 and chunk:
                separation_distances.append(area.distance(Point(chunk[0])))
        if key[0] == 'way' and any(LineString(c).relate_pattern(area, 'T********') for c in chunks):
            witnesses.append({'type': 'way', 'id': key[1]})
    # Incomplete geometry is deliberately retained as UNKNOWN even with a witness.
    if missing or not valid:
        verdict = 'UNKNOWN_MISSING_DEPENDENCIES' if missing else 'UNKNOWN_INSUFFICIENT_SPATIAL_EVIDENCE'
    else:
        verdict = 'IN_SCOPE_PROVEN' if witnesses else 'OUT_OF_SCOPE_PROVEN'
    return {'verdict': verdict, 'dependencies': sorted(dependencies),
            'missing': sorted(missing), 'witness': witnesses[0] if witnesses else None,
            'coordinates_valid': valid,
            'minimum_direct_geometry_distance_degrees': min(separation_distances) if separation_distances else None}

def adjudicate(spatial_result):
    # Keep boundary contacts unresolved until the exact Overpass boundary rule is
    # independently reproduced. Strict separation uses zero, not a chosen buffer.
    verdict = spatial_result['verdict']
    if verdict == 'OUT_OF_SCOPE_PROVEN':
        distance = spatial_result['minimum_direct_geometry_distance_degrees']
        if distance is None or distance <= 0:
            return 'UNKNOWN_INSUFFICIENT_SPATIAL_EVIDENCE'
    return verdict

def generate(root):
    replay = root / 'extract-replay-v2'
    report = json.loads((replay / 'report.json').read_text(encoding='utf8'))
    pinned = pathlib.Path('work/osmfix2/docs/evidence/osm-fix2/geofabrik-qualification-20261022/replay-report.json')
    if report != json.loads(pinned.read_text(encoding='utf8')):
        raise ValueError('Local replay differs from repository evidence')
    inputs = []
    graphs = {}
    matrices = {}
    for row in report['reports']:
        domain = row['country']
        packed = (replay / row['raw_file']).read_bytes()
        raw, graphs[domain] = decode_graph(packed, row)
        matrix_path = root / 'spatial-diagnostic' / (domain.lower() + '-matrix.json')
        matrix_raw = matrix_path.read_bytes()
        matrices[domain] = json.loads(matrix_raw)
        inputs.append({'domain': domain, 'raw_file': row['raw_file'], 'gzip_sha256': digest(packed),
                       'body_sha256': digest(raw), 'matrix_sha256': digest(matrix_raw), 'epoch': EPOCH})
    union, origins = merge_graphs(graphs)
    own = {c: {(o['type'], o['id']): o for o in elements} for c, elements in graphs.items()}
    grouped = collections.defaultdict(list)
    countries = []
    inventory = []
    historical = json.loads(pathlib.Path('work/osmfix2/data/sources/osm-current.json').read_text(encoding='utf8'))
    for domain, matrix in matrices.items():
        country, area = country_area(own[domain], domain)
        area_hash = digest(area.wkb)
        if area_hash != matrix['summary']['country_geometry_wkb_sha256']:
            raise ValueError('Country boundary drift')
        countries.append({'domain': domain, 'relation_id': country['id'], 'version': country['version'],
                          'wkb_sha256': area_hash})
        old_ids = set(historical['countries'][domain]['selected_relation_ids'])
        candidate_ids = {r['id'] for r in matrix['rows']}
        inventory.append({'domain': domain, 'historical_ids': len(old_ids), 'tag_candidates': len(candidate_ids),
                          'candidate_not_historical': len(candidate_ids - old_ids),
                          'historical_not_candidate': len(old_ids - candidate_ids),
                          'previous_status_counts': dict(collections.Counter(r['status'] for r in matrix['rows']))})
        for old in matrix['rows']:
            if old['status'] != 'UNKNOWN_MISSING_DIRECT_GEOMETRY':
                continue
            relation = own[domain][('relation', old['id'])]
            if relation['version'] != old['version']:
                raise ValueError('Relation version drift')
            before = classify(relation, own[domain], area)
            if before['verdict'] != 'UNKNOWN_MISSING_DEPENDENCIES':
                raise ValueError('Previous UNKNOWN cannot be reproduced')
            after = classify(relation, union, area)
            verdict = adjudicate(after)
            deps = [{'type': k[0], 'id': k[1], 'version': union[k]['version'],
                     'timestamp': union[k]['timestamp'], 'extracts': origins[k]}
                    for k in after['dependencies'] if k in union]
            recovered = [d for d in deps if (d['type'], d['id']) not in own[domain]]
            grouped[old['id']].append({'domain': domain, 'version': relation['version'],
                'timestamp': relation['timestamp'], 'epoch': EPOCH, 'tags': relation.get('tags', {}),
                'relation_sha256': digest(encode(relation)),
                'historical_member': old['id'] in old_ids, 'previous_verdict': old['status'],
                'new_verdict': verdict, 'frozen_predicate_verdict': after['verdict'], 'witness': after['witness'],
                'minimum_direct_geometry_distance_degrees': after['minimum_direct_geometry_distance_degrees'],
                'missing_before': before['missing'], 'missing_after': after['missing'],
                'direct_dependency_count': len(after['dependencies']),
                'dependencies_sha256': digest(encode(deps)), 'recovered_dependencies': recovered,
                'reason': ('Complete direct geometry strictly separated from the unchanged frozen country polygon.'
                    if verdict == 'OUT_OF_SCOPE_PROVEN' else
                    'Complete direct geometry has a proper-interior witness in the frozen country polygon.'
                    if verdict == 'IN_SCOPE_PROVEN' else
                    'Complete direct geometry contacts the frontier; exact Overpass boundary equivalence remains unproven.'
                    if verdict == 'UNKNOWN_INSUFFICIENT_SPATIAL_EVIDENCE' else
                    'Direct geometry remains incomplete; no exclusion inferred.'),
                'limitations': ['Frozen country-polygon predicate only; not certified live Overpass area-cache equivalence.',
                                'Not recursive topology qualification or administrative/legal attribution.']})
    rows = [{'id': rid, 'domains': domains,
             'resolved': all(not r['new_verdict'].startswith('UNKNOWN') for r in domains)}
            for rid, domains in sorted(grouped.items())]
    domain_counts = collections.Counter(r['new_verdict'] for row in rows for r in row['domains'])
    resolved = [r for r in rows if r['resolved']]
    summary = {'reported_unknown_initial_domain_rows': 393,
        'unknown_initial_distinct_ids': len(rows), 'unknown_domain_rows': sum(len(r['domains']) for r in rows),
        'duplicate_domain_ids': [r['id'] for r in rows if len(r['domains']) > 1],
        'unknown_resolved_distinct_ids': len(resolved), 'unknown_remaining_distinct_ids': len(rows) - len(resolved),
        'in_scope_proven_new_distinct_ids': sum(any(d['new_verdict'] == 'IN_SCOPE_PROVEN' for d in r['domains']) for r in resolved),
        'out_of_scope_proven_new_distinct_ids': sum(all(d['new_verdict'] == 'OUT_OF_SCOPE_PROVEN' for d in r['domains']) for r in resolved),
        'domain_verdict_counts': dict(domain_counts), 'unmodified_previously_nonunknown_domain_rows':
            sum(len(m['rows']) for m in matrices.values()) - sum(len(r['domains']) for r in rows)}
    assert summary['unknown_domain_rows'] == 393
    assert summary['unknown_initial_distinct_ids'] == 391
    assert summary['unknown_resolved_distinct_ids'] + summary['unknown_remaining_distinct_ids'] == 391
    assert summary['in_scope_proven_new_distinct_ids'] + summary['out_of_scope_proven_new_distinct_ids'] == len(resolved)
    return {'schema': 'osm-acq2a-independent-frozen-spatial-review-v1', 'epoch': EPOCH,
        'scope': 'Direct member proper-interior selection against frozen PBF country polygons; independent evidence only.',
        'overpass_equivalence_certified': False, 'source_promoted': False, 'formal_source_gate': 'BLOCKED_SOURCE_TRANSITION',
        'input_evidence': inputs, 'country_boundaries': countries, 'inventory_reconciliation': inventory,
        'summary': summary, 'rows': rows, 'shapely_version': shapely.__version__}

if __name__ == '__main__':
    root = pathlib.Path(pathlib.Path('work/current-osm-resume-20261022.txt').read_text(encoding='utf8').strip())
    result = generate(root)
    destination = pathlib.Path('outputs/OSM-ACQ2a-20261022/registry-final.json')
    content = encode(result)
    if '--verify' in sys.argv:
        assert destination.read_bytes() == content, 'Non-identical regeneration'
    else:
        if destination.exists():
            raise FileExistsError('Do not overwrite an existing audit result')
        destination.write_bytes(content)
    print(json.dumps({'summary': result['summary'], 'registry_sha256': digest(content)}, ensure_ascii=True))
