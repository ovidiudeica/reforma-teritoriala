"""Read-only SHA-256/lineage checks for committed OSM-ACQ.2a/2b evidence.
No PBF original is assumed; does not certify Geofabrik/Overpass equivalence.
"""
import gzip
import hashlib
import json
import pathlib
import sys
import unittest

EVIDENCE = pathlib.Path(__file__).resolve().parents[1]
DIRECTORIES = [
    'osm-acq2a-incremental-20261022',
    'osm-acq2b-exact-20261022',
    'osm-acq2b-node-history-20261022',
    'osm-acq2b-way-history-20261022',
]

def sha256(content):
    return hashlib.sha256(content).hexdigest()

def verify_bytes(content, expected_bytes, expected_sha):
    if len(content) != expected_bytes or sha256(content) != expected_sha:
        raise ValueError('Byte length or SHA-256 mismatch')

def inspect():
    results = []
    for name in DIRECTORIES:
        directory = EVIDENCE / name
        manifest = json.loads((directory / 'manifest-sha256.json').read_bytes())
        seen = set()
        for entry in manifest['files']:
            relative = pathlib.PurePosixPath(entry['name'])
            if relative.is_absolute() or '..' in relative.parts or len(relative.parts) != 1:
                raise ValueError('Unsafe manifest path')
            if entry['name'] in seen:
                raise ValueError('Duplicate manifest path')
            seen.add(entry['name'])
            verify_bytes((directory / relative).read_bytes(), entry['bytes'], entry['sha256'])
        actual = {p.name for p in directory.iterdir() if p.is_file()} - {'manifest-sha256.json'}
        if actual != seen:
            raise ValueError('Manifest coverage mismatch in ' + name)
        summary = json.loads((directory / 'summary.json').read_bytes())
        if name != DIRECTORIES[0]:
            packed = (directory / 'combined-registry.json.gz').read_bytes()
            if sha256(packed) != summary['combined_gzip_sha256']:
                raise ValueError('Combined gzip hash drift')
            if sha256(gzip.decompress(packed)) != summary['combined_body_sha256']:
                raise ValueError('Combined JSON body hash drift')
        results.append((name, len(seen), summary))
    exact, node, way = (row[2] for row in results[1:])
    if [exact['total_out_of_scope_proven_ids'], node['total_resolved_ids'], way['total_resolved_ids']] != [131, 145, 149]:
        raise ValueError('Cumulative resolved tally drift')
    if [exact['remaining_unknown_ids'], node['remaining_unknown_ids'], way['remaining_unknown_ids']] != [260, 246, 242]:
        raise ValueError('Remaining cohort drift')
    if node['parent_combined_gzip_sha256'] != exact['combined_gzip_sha256']:
        raise ValueError('Exact -> node lineage broken')
    if way['parent_combined_gzip_sha256'] != node['combined_gzip_sha256']:
        raise ValueError('Node -> way lineage broken')
    boundary = json.loads((EVIDENCE / DIRECTORIES[1] / 'boundary-registry.json').read_bytes())
    rows = boundary['rows']
    if len(rows) != 116 or len({r['id'] for r in rows}) != 116:
        raise ValueError('Boundary cohort cardinality drift')
    if any(r['verdict'] != 'OUT_OF_SCOPE_PROVEN' or r['missing'] or r['inside_witness'] for r in rows):
        raise ValueError('Unexpected boundary verdict or evidence')
    way_replay = json.loads((EVIDENCE / DIRECTORIES[3] / 'replay-complete.json').read_bytes())
    if len(way_replay['rows']) != 4 or {r['id'] for r in way_replay['rows']} != {1025109, 1026160, 1026178, 1026196}:
        raise ValueError('Historical way audit drift')
    if any(r['verdict'] != 'OUT_OF_SCOPE_PROVEN' or r['missing'] for r in way_replay['rows']):
        raise ValueError('Historical way completeness drift')
    if boundary.get('overpass_equivalence_certified') is not False or way_replay.get('source_promoted') is not False:
        raise ValueError('Unsupported promotion claim')
    return [{'directory': name, 'verified_files': count} for name, count, _ in results]

class NegativeTests(unittest.TestCase):
    def test_corrupted_payload_rejected(self):
        self.assertRaises(ValueError, verify_bytes, b'altered', 7, sha256(b'correct'))
    def test_shortened_payload_rejected(self):
        self.assertRaises(ValueError, verify_bytes, b'correct', 8, sha256(b'correct'))

if __name__ == '__main__':
    if '--self-test' in sys.argv:
        sys.argv = [sys.argv[0]]
        unittest.main(verbosity=2)
    else:
        print(json.dumps({'verification': 'PASS_COMMITTED_EVIDENCE_ONLY',
                          'directories': inspect()}, indent=2))
