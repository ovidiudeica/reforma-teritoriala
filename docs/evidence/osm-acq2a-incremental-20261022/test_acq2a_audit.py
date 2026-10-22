import copy
import unittest
import gzip
from acq2a_audit import classify, merge_graphs, rings, encode, EPOCH, Polygon, digest, decode_graph, adjudicate

def node(n, x, y):
    return {'type': 'node', 'id': n, 'version': 1, 'timestamp': EPOCH, 'lon': x, 'lat': y}

def relation(*members):
    return {'members': [{'type': t, 'ref': n} for t, n in members]}

class AuditTests(unittest.TestCase):
    def setUp(self):
        self.area = Polygon([(0,0),(10,0),(10,10),(0,10),(0,0)],
                            holes=[[(3,3),(7,3),(7,7),(3,7),(3,3)]])

    def verdict(self, r, objects):
        return classify(r, {(o['type'], o['id']): o for o in objects}, self.area)['verdict']

    def test_inside_node(self):
        self.assertEqual(self.verdict(relation(('node',1)), [node(1,1,1)]), 'IN_SCOPE_PROVEN')

    def test_boundary_and_hole_excluded(self):
        for xy in [(0,1),(5,5)]:
            self.assertEqual(self.verdict(relation(('node',1)), [node(1,*xy)]), 'OUT_OF_SCOPE_PROVEN')

    def test_crossing_segment_without_inside_vertices(self):
        objects = [node(1,-1,1),node(2,11,1),{'type':'way','id':8,'nodes':[1,2]}]
        self.assertEqual(self.verdict(relation(('way',8)),objects),'IN_SCOPE_PROVEN')

    def test_missing_node_not_bridged(self):
        objects = [node(1,-1,1),node(2,11,1),{'type':'way','id':8,'nodes':[1,99,2]}]
        self.assertEqual(self.verdict(relation(('way',8)),objects),'UNKNOWN_MISSING_DEPENDENCIES')

    def test_partial_witness_stays_unknown(self):
        self.assertEqual(self.verdict(relation(('node',1),('way',99)),[node(1,1,1)]),
                         'UNKNOWN_MISSING_DEPENDENCIES')

    def test_border_only_way_excluded(self):
        objects = [node(1,0,0),node(2,10,0),{'type':'way','id':8,'nodes':[1,2]}]
        self.assertEqual(self.verdict(relation(('way',8)),objects),'OUT_OF_SCOPE_PROVEN')

    def test_cross_extract_deduplication(self):
        obj = node(1,1,1)
        graph, origins = merge_graphs({'RO':[obj], 'MD':[copy.deepcopy(obj)]})
        self.assertEqual(len(graph),1)
        self.assertEqual(origins[('node',1)],['RO','MD'])

    def test_duplicate_within_extract_rejected(self):
        with self.assertRaises(ValueError):
            merge_graphs({'RO':[node(1,1,1),node(1,1,1)]})

    def test_conflicting_version_rejected(self):
        obj = node(1,1,1); obj['version'] = 2
        with self.assertRaises(ValueError):
            merge_graphs({'RO':[node(1,1,1)], 'MD':[obj]})

    def test_missing_or_future_timestamp_rejected(self):
        for timestamp in [None,'2026-10-21T00:00:00Z','2026-10-20T10:00:00']:
            obj = node(1,1,1); obj['timestamp'] = timestamp
            with self.assertRaises(ValueError):
                merge_graphs({'RO':[obj]})

    def test_open_ring_not_snapped(self):
        with self.assertRaises(ValueError):
            rings([[1,2],[2,3]])

    def test_canonical_serialization(self):
        self.assertEqual(encode({'b':2,'a':1}),encode({'a':1,'b':2}))

    def test_corrupt_snapshot_and_epoch(self):
        raw = encode({'elements':[]}); packed = gzip.compress(raw,mtime=0)
        descriptor = {'header':{'osmosis_replication_timestamp':EPOCH},
                      'raw_gzip_sha256':digest(packed),'raw_body_sha256':digest(raw)}
        self.assertEqual(decode_graph(packed,descriptor)[1],[])
        for field, value in [('raw_gzip_sha256','0'*64),('raw_body_sha256','0'*64),
                             ('header',{'osmosis_replication_timestamp':'2026-10-21T00:00:00Z'})]:
            bad = copy.deepcopy(descriptor); bad[field] = value
            with self.assertRaises(ValueError):
                decode_graph(packed,bad)

    def test_boundary_contact_not_counted_resolved(self):
        for distance in [None,0]:
            self.assertEqual(adjudicate({'verdict':'OUT_OF_SCOPE_PROVEN',
                'minimum_direct_geometry_distance_degrees':distance}), 'UNKNOWN_INSUFFICIENT_SPATIAL_EVIDENCE')
        self.assertEqual(adjudicate({'verdict':'OUT_OF_SCOPE_PROVEN',
            'minimum_direct_geometry_distance_degrees':0.1}), 'OUT_OF_SCOPE_PROVEN')

if __name__ == '__main__':
    unittest.main(verbosity=2)
