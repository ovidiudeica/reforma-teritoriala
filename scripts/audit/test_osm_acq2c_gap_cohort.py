import unittest,copy
from osm_acq2c_gap_cohort import extend_cohort

def row(code):return dict(code=code,source_qualified=False,history_gaps_resolved=0,historical_continuity='BLOCKED_VERSION_GAPS',missing_observed_versions=1,observed_versions=[1,3],missing_versions=[2],current_observation='CURRENT_EQUALS_REPLAY_TARGET',missing_version_access=dict(status=403))
def sample():return dict(objects=1,rows=[row('n1')],missing_observed_versions=1,source_qualified=False,history_gaps_resolved=0),dict(rows=[row('w1')],source_qualified=False,history_gaps_resolved=0)
class Tests(unittest.TestCase):
 def test_typed_and_not_approval(self):
  r=extend_cohort(*sample());self.assertEqual(r['objects'],2);self.assertFalse(r['source_qualified']);self.assertEqual(r['history_gaps_resolved'],0)
 def test_input_unchanged(self):
  p,d=sample();old=copy.deepcopy((p,d));extend_cohort(p,d);self.assertEqual((p,d),old)
 def test_duplicate(self):
  p,d=sample();d['rows'][0]['code']='n1';self.assertRaises(ValueError,extend_cohort,p,d)
 def test_count_drift(self):
  p,d=sample();p['missing_observed_versions']=2;self.assertRaises(ValueError,extend_cohort,p,d)
 def test_false_closure(self):
  p,d=sample();d['rows'][0]['historical_continuity']='PASS';self.assertRaises(ValueError,extend_cohort,p,d)
 def test_403_cannot_certify(self):
  p,d=sample();d['rows'][0]['missing_version_access']['accepted_as_version_evidence']=True;self.assertRaises(ValueError,extend_cohort,p,d)
 def test_bad_versions(self):
  for versions in ([2,2],[True],[1]):
   p,d=sample();d['rows'][0]['missing_versions']=versions;self.assertRaises(ValueError,extend_cohort,p,d)
 def test_no_huge_range_allocation(self):
  p,d=sample();d['rows'][0]['observed_versions']=[2**32-1];self.assertRaises(ValueError,extend_cohort,p,d)
 def test_determinism(self):
  p,d=sample();self.assertEqual(extend_cohort(p,d),extend_cohort(copy.deepcopy(p),copy.deepcopy(d)))
if __name__=='__main__':unittest.main()
