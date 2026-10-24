import unittest,copy
from osm_acq2c_native_order import validate_order

def fixture():
 e={k:'a'*64 for k in ('original_sha256','executable_sha256','native_stdout_sha256','prior_integrity_proof_sha256','positive_negative_fixture_sha256')};e.update(source_bytes=10,base_epoch='2026-10-19T00:00:04Z')
 r=dict(e,status='INDEPENDENT_NATIVE_ALL_OBJECT_ORDER_CHECK_PASS',native_exit_code=0,global_sorting_verified=True,source_stat_unchanged=True,source_qualified=False,provenance_human_or_signed_validation_pending=True)
 n=dict(file=dict(size=10),header=dict(with_history=True,option=dict(osmosis_replication_timestamp=e['base_epoch'])),data=dict(multiple_versions=True,objects_ordered=True,timestamp=dict(last=e['base_epoch']),count=dict(nodes=1,ways=1,relations=1)))
 return n,r,e
class Tests(unittest.TestCase):
 def test_valid_not_source_approval(self):
  v=validate_order(*fixture());self.assertTrue(v['global_sorting_verified']);self.assertFalse(v['source_qualified']);self.assertTrue(v['provenance_human_or_signed_validation_pending'])
 def test_no_mutation(self):
  f=fixture();old=copy.deepcopy(f);validate_order(*f);self.assertEqual(f,old)
 def test_unordered(self):
  n,r,e=fixture();n['data']['objects_ordered']=False;self.assertRaises(ValueError,validate_order,n,r,e)
 def test_size(self):
  n,r,e=fixture();n['file']['size']=9;self.assertRaises(ValueError,validate_order,n,r,e)
 def test_nonhistory(self):
  n,r,e=fixture();n['header']['with_history']=False;self.assertRaises(ValueError,validate_order,n,r,e)
 def test_wrong_header_epoch(self):
  n,r,e=fixture();n['header']['option']['osmosis_replication_timestamp']='2026-10-20T00:00:00Z';self.assertRaises(ValueError,validate_order,n,r,e)
 def test_wrong_data_epoch(self):
  n,r,e=fixture();n['data']['timestamp']['last']='2026-10-20T00:00:00Z';self.assertRaises(ValueError,validate_order,n,r,e)
 def test_native_exit(self):
  n,r,e=fixture();r['native_exit_code']=1;self.assertRaises(ValueError,validate_order,n,r,e)
 def test_boolean_exit(self):
  n,r,e=fixture();r['native_exit_code']=False;self.assertRaises(ValueError,validate_order,n,r,e)
 def test_changed_stat(self):
  n,r,e=fixture();r['source_stat_unchanged']=False;self.assertRaises(ValueError,validate_order,n,r,e)
 def test_source_promotion(self):
  n,r,e=fixture();r['source_qualified']=True;self.assertRaises(ValueError,validate_order,n,r,e)
 def test_self_approved_provenance(self):
  n,r,e=fixture();r['provenance_human_or_signed_validation_pending']=False;self.assertRaises(ValueError,validate_order,n,r,e)
 def test_each_digest(self):
  for k in ('original_sha256','executable_sha256','native_stdout_sha256','prior_integrity_proof_sha256','positive_negative_fixture_sha256'):
   n,r,e=fixture();r[k]='b'*64;self.assertRaises(ValueError,validate_order,n,r,e)
 def test_zero_counts(self):
  for k in ('nodes','ways','relations'):
   n,r,e=fixture();n['data']['count'][k]=0;self.assertRaises(ValueError,validate_order,n,r,e)
 def test_incomplete_status(self):
  n,r,e=fixture();r['status']='RUNNING';self.assertRaises(ValueError,validate_order,n,r,e)
if __name__=='__main__':unittest.main()
