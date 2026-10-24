import pathlib,sys,unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
from osm_acq2c_selected_epoch_store import replay_to_store
from osm_acq2c_selected_epoch_core import reconcile
B='2026-10-19T00:00:04Z';T='2026-10-20T20:23:47Z'
def base(c='n1',v=1):return dict(code=c,version=v,timestamp='2026-10-18T00:00:00Z',visible=True,tags=[],x=1,y=2)
def tail(c=1,v=2,t='2026-10-20T00:00:00Z'):return dict(type='node',id=c,version=v,timestamp=t,visible='true',action='modify',tags=[],lon='0.0000001',lat='0.0000002',nodes=[],members=[])
class Tests(unittest.TestCase):
 def compare(self,b,t,ids):
  h=[];s={};r=replay_to_store(iter(b),t,ids,B,T,h.append,lambda c,row:s.update({c:row}));old=reconcile(b,t,ids,B,T);self.assertEqual(s,old['selected']);self.assertEqual(r['selected_count'],len(s));self.assertEqual(h,[row for history in old['histories'].values() for row in history]);self.assertEqual(r['versions'],len(h));self.assertFalse(r['source_qualified']);self.assertFalse(r['dependency_closure_certified']);self.assertEqual(r['unknown_adjudicated'],0)
  for key in ['missing_ids','gapped_ids','duplicate_observations_deduplicated','post_target_versions_retained']:self.assertEqual(r[key],old[key])
 def test_matching_stream(self):self.compare([base(),base('n2')],[tail()],{'n1','n2'})
 def test_missing(self):self.compare([base()],[],{'n1','n2'})
 def test_gap(self):self.compare([base(v=3)],[],{'n1'})
 def test_new_tail(self):self.compare([], [tail(v=1)],{'n1'})
 def test_post_target(self):self.compare([base()],[tail(t='2026-10-21T00:00:00Z')],{'n1'})
 def test_overlap(self):self.compare([base()],[tail(v=1,t='2026-10-18T00:00:00Z')],{'n1'})
 def test_conflict(self):
  with self.assertRaises(ValueError):replay_to_store([base()],[tail(v=1,t='2026-10-18T00:00:00Z')|{'lat':'1'}],{'n1'},B,T,lambda r:None,lambda c,r:None)
 def test_noncontiguous(self):
  with self.assertRaises(ValueError):replay_to_store([base(),base('n2'),base()],[],{'n1','n2'},B,T,lambda r:None,lambda c,r:None)
 def test_no_selected_map(self):
  r=replay_to_store([base()],[],{'n1'},B,T,lambda r:None,lambda c,r:None);self.assertNotIn('selected',r);self.assertEqual(r['selected_count'],1)
if __name__=='__main__':unittest.main()
