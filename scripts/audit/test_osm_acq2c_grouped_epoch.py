import pathlib,sys,unittest
from osm_acq2c_grouped_epoch import replay_groups
from osm_acq2c_selected_epoch_core import reconcile
B='2026-10-19T00:00:04Z';T='2026-10-20T20:23:47Z'
def row(c='w4',v=1):return dict(code=c,version=v,timestamp='2026-10-18T00:00:00Z',visible=True,tags=[],nodes=[1,2])
def tail(v=2,t='2026-10-20T00:00:00Z'):return dict(type='way',id=4,version=v,timestamp=t,visible='true',action='modify',tags=[],nodes=[1,2])
class Tests(unittest.TestCase):
 def run_it(self,b,t,ids={'w4'}):
  output=[];r=replay_groups(iter(b),t,ids,B,T,output.append);return r,output
 def test_matches_existing_validator(self):
  b=[row(),row('w5')];t=[tail()];ids={'w4','w5'};r,out=self.run_it(b,t,ids);old=reconcile(b,t,ids,B,T)
  for k in ('selected','missing_ids','gapped_ids','duplicate_observations_deduplicated','post_target_versions_retained'):self.assertEqual(r[k],old[k])
  self.assertEqual(sorted((x['code'],x['version']) for x in out),[('w4',1),('w4',2),('w5',1)])
 def test_gap_not_closed(self):self.assertEqual(self.run_it([row()],[tail(3)])[0]['gapped_ids'],['w4'])
 def test_missing(self):self.assertEqual(self.run_it([],[])[0]['missing_ids'],['w4'])
 def test_new_tail_identity(self):self.assertEqual(self.run_it([],[tail(1)])[0]['selected']['w4']['version'],1)
 def test_overlap(self):self.assertEqual(self.run_it([row()],[tail(1,'2026-10-18T00:00:00Z')])[0]['duplicate_observations_deduplicated'],1)
 def test_conflicting_overlap(self):
  t=tail(1,'2026-10-18T00:00:00Z');t['nodes']=[2,1]
  with self.assertRaises(ValueError):self.run_it([row()],[t])
 def test_post_target(self):self.assertEqual(self.run_it([row()],[tail(2,'2026-10-20T21:00:00Z')])[0]['selected']['w4']['version'],1)
 def test_deleted(self):
  t=tail();t.update(visible='false',action='delete',nodes=[])
  self.assertFalse(self.run_it([row()],[t])[0]['selected']['w4']['visible'])
 def test_noncontiguous(self):
  with self.assertRaises(ValueError):self.run_it([row(),row('w5'),row(v=2)],[],{'w4','w5'})
 def test_duplicate_version(self):
  with self.assertRaises(ValueError):self.run_it([row(),row()],[])
 def test_unrequested_base(self):
  with self.assertRaises(ValueError):self.run_it([row('w5')],[])
 def test_unrequested_tail(self):
  with self.assertRaises(ValueError):self.run_it([], [tail()],{'w5'})
class RepresentationTest(unittest.TestCase):
 def test_group_order_is_explicit_not_global_lexical_order(self):
  output=[];base=[row('w2'),row('w10')];ids={'w2','w10'}
  result=replay_groups(iter(base),[],ids,B,T,output.append)
  self.assertEqual([r['code'] for r in output],['w2','w10'])
  self.assertEqual(result['selected'],reconcile(base,[],ids,B,T)['selected'])
if __name__=='__main__':unittest.main()
