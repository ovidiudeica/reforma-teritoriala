import pathlib,sys,unittest,copy
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent/'doc-supplement/scripts/audit'))
from leaf_frontier_certificate import close_leaf_frontier
E='2026-10-20T20:23:47Z'
def p():return dict(epoch=E,missing=[dict(code='n1',parents=['w2'])],missing_count=1,recursive_member_graph_closed=False,source_qualified=False)
def r():return {'n1':dict(code='n1',version=1,visible=True,timestamp='2026-10-20T00:00:00Z',x=1,y=2)}
class Tests(unittest.TestCase):
 def test_leaf_closes_only_structure(self):
  v=close_leaf_frontier(p(),r(),E);self.assertTrue(v['recursive_member_graph_closed']);self.assertFalse(v['source_qualified']);self.assertFalse(v['topology_certified']);self.assertEqual(v['unknown_adjudicated'],0)
 def test_missing(self):
  with self.assertRaises(ValueError):close_leaf_frontier(p(),{},E)
 def test_extra(self):
  with self.assertRaises(ValueError):close_leaf_frontier(p(),r()|{'n3':r()['n1']},E)
 def test_deleted(self):
  x=r();x['n1']['visible']=False
  with self.assertRaises(ValueError):close_leaf_frontier(p(),x,E)
 def test_future(self):
  x=r();x['n1']['timestamp']='2026-10-21T00:00:00Z'
  with self.assertRaises(ValueError):close_leaf_frontier(p(),x,E)
 def test_float(self):
  x=r();x['n1']['x']=1.0
  with self.assertRaises(ValueError):close_leaf_frontier(p(),x,E)
 def test_dependencies(self):
  x=r();x['n1']['nodes']=[2]
  with self.assertRaises(ValueError):close_leaf_frontier(p(),x,E)
 def test_parent(self):
  x=p();x['missing'][0]['parents']=[]
  with self.assertRaises(ValueError):close_leaf_frontier(x,r(),E)
 def test_bad_parent_kind(self):
  x=p();x['missing'][0]['parents']=['n2']
  with self.assertRaises(ValueError):close_leaf_frontier(x,r(),E)
 def test_false_source_promotion(self):
  x=p();x['source_qualified']=True
  with self.assertRaises(ValueError):close_leaf_frontier(x,r(),E)
if __name__=='__main__':unittest.main()
