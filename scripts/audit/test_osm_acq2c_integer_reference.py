import unittest
from fractions import Fraction
from osm_acq2c_integer_reference import IntegerArea,intersection_parameters,relation_has_interior
def ring(points):return list(zip(points,points[1:]+points[:1]))
SQUARE=ring([(0,0),(10,0),(10,10),(0,10)])
class Tests(unittest.TestCase):
 def setUp(self):self.a=IntegerArea(SQUARE,3)
 def test_inside(self):self.assertEqual(self.a.point((5,5)),'inside')
 def test_boundary(self):self.assertEqual(self.a.point((0,5)),'boundary')
 def test_outside(self):self.assertEqual(self.a.point((-1,5)),'outside')
 def test_hole(self):self.assertEqual(IntegerArea(SQUARE+ring([(3,3),(7,3),(7,7),(3,7)]),2).point((5,5)),'outside')
 def test_disconnected(self):self.assertEqual(IntegerArea(SQUARE+ring([(20,0),(30,0),(30,10),(20,10)]),4).point((25,5)),'inside')
 def test_crossing_without_inside_vertices(self):self.assertTrue(self.a.segment_has_interior((-1,5),(11,5)))
 def test_boundary_segment(self):self.assertFalse(self.a.segment_has_interior((0,0),(10,0)))
 def test_corner_touch(self):self.assertFalse(self.a.segment_has_interior((-1,1),(1,-1)))
 def test_partial_collinear(self):self.assertFalse(self.a.segment_has_interior((-5,0),(5,0)))
 def test_hole_only_segment(self):self.assertFalse(IntegerArea(SQUARE+ring([(3,3),(7,3),(7,7),(3,7)]),2).segment_has_interior((4,5),(6,5)))
 def test_rational_point(self):self.assertEqual(self.a.point((Fraction(1,3),Fraction(1,7))),'inside')
 def test_degenerate_inside(self):self.assertTrue(self.a.segment_has_interior((5,5),(5,5)))
 def test_degenerate_boundary(self):self.assertFalse(self.a.segment_has_interior((0,5),(0,5)))
 def test_index_width_changes_no_predicate(self):
  areas=[IntegerArea(SQUARE,w) for w in (1,3,1000000)]
  for p in [(-1,5),(0,0),(5,5),(10,5),(11,11)]:self.assertEqual(len({a.point(p) for a in areas}),1)
  for p,q in [((-1,5),(11,5)),((-1,1),(1,-1)),((-5,0),(5,0))]:self.assertEqual(len({a.segment_has_interior(p,q) for a in areas}),1)
 def test_exact_intersection(self):self.assertIn(Fraction(1,3),intersection_parameters((0,0),(3,0),(1,-1),(1,1)))
 def test_missing_node_rejected(self):
  with self.assertRaises(ValueError):relation_has_interior({'members':[['w',1,'outer']]},{},{'1':{'nodes':[1,2]}},self.a)
 def test_missing_way_rejected(self):
  with self.assertRaises(ValueError):relation_has_interior({'members':[['w',1,'outer']]},{},{},self.a)
 def test_nested_relation_not_direct_witness(self):self.assertFalse(relation_has_interior({'members':[['r',1,'outer']]},{},{},self.a))
 def test_relation_node_boundary_excluded(self):self.assertFalse(relation_has_interior({'members':[['n',1,'label']]},{'1':{'x':0,'y':5}},{},self.a))
 def test_invalid_index(self):
  with self.assertRaises(ValueError):IntegerArea(SQUARE,0)
if __name__=='__main__':unittest.main()
