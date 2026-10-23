import copy,unittest
from osm_acq2c_gap_state import inspect_gap
T='2026-10-20T20:23:47Z'
def obj(v,x=3):return dict(code='n1',version=v,timestamp=T,visible=True,tags=[],x=x,y=4)
class Tests(unittest.TestCase):
 def go(self,h=None,t=None,c=None):return inspect_gap('n1',h or [obj(1),obj(3)],t or obj(3),c)
 def test_gap_bracket(self):self.assertEqual(self.go()['gaps'][0]['first_missing'],2)
 def test_initial_gap(self):self.assertIsNone(self.go([obj(3)])['gaps'][0]['before'])
 def test_current_match_never_grants_admission(self):
  r=self.go(c=obj(3));self.assertEqual(r['current_observation'],'CURRENT_EQUALS_REPLAY_TARGET');self.assertFalse(r['source_qualified']);self.assertEqual(r['history_gaps_resolved'],0)
 def test_changed_current_not_gap_repair(self):self.assertEqual(self.go(c=obj(4))['historical_continuity'],'BLOCKED_VERSION_GAPS')
 def test_same_version_different_geometry(self):self.assertRaises(ValueError,self.go,c=obj(3,5))
 def test_lower_current_version(self):self.assertRaises(ValueError,self.go,c=obj(2))
 def test_wrong_identity(self):
  c=obj(3);c['code']='w1';self.assertRaises(ValueError,self.go,c=c)
 def test_duplicate_version(self):self.assertRaises(ValueError,self.go,h=[obj(1),obj(1),obj(3)])
 def test_reversed_versions(self):self.assertRaises(ValueError,self.go,h=[obj(3),obj(1)])
 def test_no_gap(self):self.assertRaises(ValueError,self.go,h=[obj(1),obj(2),obj(3)])
 def test_missing_target(self):self.assertRaises(ValueError,self.go,t=obj(4))
 def test_naive_time(self):
  h=[obj(1),obj(3)];h[0]['timestamp']='2026-10-20T20:23:47';self.assertRaises(ValueError,self.go,h=h)
 def test_equal_utc_offsets(self):
  c=obj(3);c['timestamp']='2026-10-20T20:23:47+00:00';self.assertEqual(self.go(c=c)['current_observation'],'CURRENT_EQUALS_REPLAY_TARGET')
 def test_stale_target_rejected(self):self.assertRaises(ValueError,self.go,t=obj(1))
 def test_future_target_rejected(self):
  h=[obj(1),obj(3)];h[-1]['timestamp']='2026-10-21T00:00:00Z';self.assertRaises(ValueError,self.go,h=h,t=h[-1])
 def test_invalid_typed_identity(self):self.assertRaises(ValueError,inspect_gap,'n0',[obj(1),obj(3)],obj(3))
 def test_boolean_target_version_rejected(self):
  t=obj(3);t['version']=True;self.assertRaises(ValueError,self.go,t=t)
if __name__=='__main__':unittest.main()
