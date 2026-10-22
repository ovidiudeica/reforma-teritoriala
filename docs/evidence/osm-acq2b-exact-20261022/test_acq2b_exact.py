import unittest
from fractions import Fraction
from acq2b_exact import ExactArea,grid,cuts,audit_relation

def ring(points):return list(zip(points,points[1:]+points[:1]))
SQUARE=ring([(0,0),(10,0),(10,10),(0,10)])
def n(i,x,y):return {'type':'node','id':i,'version':1,'timestamp':'2026-10-20T20:23:47Z','lon':x/10**7,'lat':y/10**7}

class ExactTests(unittest.TestCase):
    def setUp(self):self.area=ExactArea(SQUARE)
    def test_inside_outside_border(self):
        for p,want in [((1,1),'inside'),((-1,1),'outside'),((0,1),'boundary'),((10,10),'boundary')]:
            self.assertEqual(self.area.point(p),want)
    def test_hole(self):
        area=ExactArea(SQUARE+ring([(3,3),(7,3),(7,7),(3,7)]))
        self.assertEqual(area.point((5,5)),'outside');self.assertEqual(area.point((3,5)),'boundary')
    def test_rational_points(self):
        self.assertEqual(self.area.point((Fraction(1,3),Fraction(1,7))),'inside')
        self.assertEqual(self.area.point((Fraction(-1,10**20),Fraction(1,3))),'outside')
    def test_no_snapping(self):
        self.assertEqual(grid(28.858393),288583930)
        with self.assertRaises(ValueError):grid('28.85839300000001')
    def test_crossing_without_inside_vertices(self):
        self.assertTrue(self.area.segment((-1,5),(11,5))['inside'])
    def test_shared_border_segment(self):
        result=self.area.segment((0,0),(10,0));self.assertFalse(result['inside']);self.assertEqual(result['intervals'],{'boundary':1})
    def test_partial_border_overlap(self):
        r=self.area.segment((-5,0),(15,0));self.assertFalse(r['inside']);self.assertEqual(r['intervals'],{'outside':2,'boundary':1})
    def test_corner_touch(self):self.assertFalse(self.area.segment((-1,1),(1,-1))['inside'])
    def test_corner_entry(self):self.assertTrue(self.area.segment((-1,-1),(11,11))['inside'])
    def test_hole_only_segment(self):
        area=ExactArea(SQUARE+ring([(3,3),(7,3),(7,7),(3,7)]))
        self.assertFalse(area.segment((4,5),(6,5))['inside'])
    def test_reverse_invariance(self):
        for a,b in [((-1,5),(11,5)),((-5,0),(15,0)),((4,4),(9,9))]:
            self.assertEqual(self.area.segment(a,b),self.area.segment(b,a))
    def test_disconnected_outer_rings(self):
        area=ExactArea(SQUARE+ring([(20,0),(30,0),(30,10),(20,10)]))
        self.assertEqual(area.point((25,5)),'inside');self.assertEqual(area.point((15,5)),'outside')
    def test_intersection_parameters_exact(self):
        self.assertEqual(cuts((0,0),(3,0),(1,-1),(1,1)),[Fraction(1,3)])
    def test_missing_node_never_bridged(self):
        objs=[n(1,-1,5),n(2,11,5),{'type':'way','id':8,'nodes':[1,99,2]}]
        graph={(o['type'],o['id']):o for o in objs}
        r=audit_relation({'members':[{'type':'way','ref':8}]},graph,self.area)
        self.assertEqual(r['verdict'],'UNKNOWN_MISSING_DEPENDENCIES');self.assertEqual(r['segment_count'],0)
    def test_boundary_relation_has_no_interior(self):
        objs=[n(1,0,0),n(2,10,0),{'type':'way','id':8,'nodes':[1,2]}]
        graph={(o['type'],o['id']):o for o in objs}
        r=audit_relation({'members':[{'type':'way','ref':8}]},graph,self.area)
        self.assertEqual(r['verdict'],'OUT_OF_SCOPE_PROVEN')

if __name__=='__main__':unittest.main(verbosity=2)
