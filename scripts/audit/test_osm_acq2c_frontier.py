import unittest
from osm_acq2c_frontier import frontier, normalize_regional, verify_overlay

E='2026-10-20T20:23:47Z'
def rel(code, members):return dict(code=code, visible=True, members=members)
class FrontierTests(unittest.TestCase):
    def test_indirect_nodes_and_roles(self):
        g={'r1':rel('r1',[['w',2,'inner'],['r',3,'subarea']]),
           'w2':dict(code='w2',visible=True,nodes=[4,5]),'r3':rel('r3',[['n',6,'label']]),
           'n4':dict(code='n4',visible=True)}
        _,missing,_=frontier(['r1'],g.get)
        self.assertEqual(missing,{'n5':{'w2'},'n6':{'r3'}})
    def test_cycles_terminate(self):
        g={'r1':rel('r1',[['r',2,'']]),'r2':rel('r2',[['r',1,'']])}
        self.assertEqual(frontier(['r1'],g.get)[0],{'r1','r2'})
    def test_missing_root(self):self.assertEqual(frontier(['r1'],{}.get)[1],{'r1':set()})
    def test_duplicate_references_and_roots(self):
        g={'r1':rel('r1',[['w',2,''],['w',2,'']])}
        self.assertEqual(frontier(['r1','r1'],g.get)[1],{'w2':{'r1'}})
    def test_deleted_reference(self):
        with self.assertRaises(ValueError):frontier(['n1'],lambda c:dict(code='n1',visible=False))
    def test_wrong_identity(self):
        with self.assertRaises(ValueError):frontier(['n1'],lambda c:dict(code='n2',visible=True))
    def test_invalid_identity(self):
        with self.assertRaises(ValueError):frontier(['r0'],{}.get)
    def test_absence_never_means_deleted(self):
        missing=frontier(['r1'],{}.get)[1];self.assertIn('r1',missing)
    def test_exact_coordinate(self):
        o=dict(type='node',id=1,version=1,timestamp=E,lon=28.858393,lat=46.8331996)
        self.assertEqual(normalize_regional(o,E)['y'],468331996)
    def test_non_osm_precision(self):
        o=dict(type='node',id=1,version=1,timestamp=E,lon='1.00000001',lat='2')
        with self.assertRaises(ValueError):normalize_regional(o,E)
    def test_future_epoch(self):
        o=dict(type='node',id=1,version=1,timestamp='2026-10-21T00:00:00Z',lon=1,lat=2)
        with self.assertRaises(ValueError):normalize_regional(o,E)
    def test_version_content_conflict(self):
        o=dict(type='node',id=1,version=1,timestamp=E,lon=1,lat=2)
        row=normalize_regional(o,E);row['version']=2
        with self.assertRaises(ValueError):verify_overlay({'n1':row},lambda c:o,E)
    def test_identical_overlay(self):
        o=dict(type='node',id=1,version=1,timestamp=E,lon=1,lat=2)
        self.assertEqual(verify_overlay({'n1':normalize_regional(o,E)},lambda c:o,E),1)
    def test_deterministic_frontier(self):
        g={'r1':rel('r1',[['n',2,''],['n',3,'']])}
        self.assertEqual(frontier(['r1'],g.get),frontier(['r1'],g.get))
if __name__=='__main__':unittest.main()
