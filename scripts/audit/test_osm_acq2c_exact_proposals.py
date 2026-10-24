import copy
import unittest
from osm_acq2c_exact_proposals import build, encoded, EPOCH

class Tests(unittest.TestCase):
    def setUp(self):
        self.expected={7:['RO']}
        self.row=dict(id=7,domains=['RO'],version=1,timestamp=EPOCH,formal_adjudication=False,source_qualified=False,status='PROVISIONAL_EXACT_PBF_NOT_SOURCE_ACCEPTANCE',missing_direct_geometry=[],history_gap_dependencies=[],exact_predicate={'RO':dict(verdict='OUT_OF_SCOPE_PROVEN',missing=[],inside_witness=None,node_occurrence_states={'boundary':1},segment_interval_states={'outside':2})})
        self.report=dict(epoch=EPOCH,source_qualified=False,topology_certified=False,unknown_adjudicated=0,country_boundaries={'RO':{'root':90689}},rows=[self.row])
    def run_build(self):return build([self.report],self.expected,[])
    def test_deterministic(self):self.assertEqual(encoded(self.run_build()),encoded(self.run_build()))
    def test_duplicate(self):
        self.report['rows'].append(copy.deepcopy(self.row));self.assertRaises(ValueError,self.run_build)
    def test_missing(self):
        self.report['rows']=[];self.assertRaises(ValueError,self.run_build)
    def test_wrong_domain(self):
        self.row['domains']=['MD'];self.assertRaises(ValueError,self.run_build)
    def test_partial_geometry(self):
        self.row['missing_direct_geometry']=['n1'];self.assertRaises(ValueError,self.run_build)
    def test_future_epoch(self):
        self.row['timestamp']='2026-10-21T00:00:00Z';self.assertRaises(ValueError,self.run_build)
    def test_boolean_version(self):
        self.row['version']=True;self.assertRaises(ValueError,self.run_build)
    def test_formal_promotion(self):
        self.row['formal_adjudication']=True;self.assertRaises(ValueError,self.run_build)
    def test_inside_contradiction(self):
        self.row['exact_predicate']['RO']['segment_interval_states']['inside']=1;self.assertRaises(ValueError,self.run_build)
    def test_wrong_boundary(self):
        other=copy.deepcopy(self.report);other['country_boundaries']={};other['rows']=[]
        self.assertRaises(ValueError,build,[self.report,other],self.expected,[])
    def test_gaps_stay_unaccepted(self):
        self.row['history_gap_dependencies']=['n1'];r=self.run_build();self.assertEqual(r['summary']['relations_with_observed_history_gaps'],1);self.assertFalse(r['source_qualified']);self.assertEqual(r['summary']['formal_unknown_remaining'],1)
    def test_shared_domains_count_identity_once(self):
        self.expected[7]=['RO','MD'];self.row['domains'].append('MD');self.row['exact_predicate']['MD']=copy.deepcopy(self.row['exact_predicate']['RO']);r=self.run_build();self.assertEqual(r['summary']['domain_observations'],2);self.assertEqual(r['summary']['distinct_relations'],1)

if __name__=='__main__':unittest.main()
