import pathlib,sys,tempfile,unittest,hashlib
from osm_acq2c_preserved_history import read_receipt,recover_row,load_validator
E='2026-10-20T20:23:47Z';URL='https://api.openstreetmap.org/api/0.6/node/1/history'
class Tests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.path=pathlib.Path(self.tmp.name)
  self.raw=b'<osm version="0.6"><node id="1" version="1"/></osm>';(self.path/'original.xml').write_bytes(self.raw)
  self.r=dict(file='original.xml',url=URL,final_url=URL,status=200,bytes=len(self.raw),sha256=hashlib.sha256(self.raw).hexdigest(),headers={'Date':'Thu, 22 Oct 2026 10:05:28 GMT','Content-Type':'application/xml; charset=utf-8'})
 def go(self):return read_receipt(self.r,[self.path],'node',1,'history',E)
 def test_valid_original(self):self.assertEqual(self.go()[0].get('version'),'1')
 def test_corrupt_original(self):self.r['sha256']='0'*64;self.assertRaises(ValueError,self.go)
 def test_wrong_length(self):self.r['bytes']+=1;self.assertRaises(ValueError,self.go)
 def test_untrusted_redirect(self):self.r['final_url']='https://example.org';self.assertRaises(ValueError,self.go)
 def test_403_not_original(self):self.r['status']=403;self.assertRaises(ValueError,self.go)
 def test_before_epoch(self):self.r['headers']['Date']='Sun, 19 Oct 2025 10:05:28 GMT';self.assertRaises(ValueError,self.go)
 def test_missing_date(self):del self.r['headers']['Date'];self.assertRaises(ValueError,self.go)
 def test_placeholder_mime(self):self.r['headers']['Content-Type']='text/html';self.assertRaises(ValueError,self.go)
 def test_path_traversal(self):self.r['file']='..\\original.xml';self.assertRaises(ValueError,self.go)
 def test_windows_drive_form(self):
  self.r['file']='D:outside.xml'
  with self.assertRaisesRegex(ValueError,'Unsafe original basename'):self.go()
 def test_windows_ads(self):
  self.r['file']='original.xml:stream'
  with self.assertRaisesRegex(ValueError,'Unsafe original basename'):self.go()
 def test_nul_name(self):
  self.r['file']='original\0.xml'
  with self.assertRaisesRegex(ValueError,'Unsafe original basename'):self.go()
 def test_nonstring_name(self):
  self.r['file']=12
  with self.assertRaisesRegex(ValueError,'Unsafe original basename'):self.go()
 def test_missing_file(self):self.r['file']='absent.xml';self.assertRaises(ValueError,self.go)
 def test_wrong_id(self):
  self.raw=self.raw.replace(b'id="1"',b'id="2"');(self.path/'original.xml').write_bytes(self.raw);self.r.update(bytes=len(self.raw),sha256=hashlib.sha256(self.raw).hexdigest());self.assertRaises(ValueError,self.go)
 def test_changed_derived_object(self):
  current=dict(self.r,url=URL.removesuffix('/history'),final_url=URL.removesuffix('/history'))
  row=dict(object={'id':1},history_receipt=self.r,current_receipt=current)
  with self.assertRaises(ValueError):recover_row(row,[self.path],'node',lambda h,c,e:{'object':{'id':2}},E)
class LoaderTests(unittest.TestCase):
 def test_sibling_loader_restores_import_path(self):
  with tempfile.TemporaryDirectory() as t:
   p=pathlib.Path(t);before=sys.path[:]
   (p/'acq2b_exact.py').write_text('EPOCH="frozen"\ngrid=lambda x:x\n')
   (p/'acq2a_audit.py').write_text('EPOCH="frozen"\n')
   (p/'acq2b_history_validation.py').write_text('from acq2b_exact import grid,EPOCH\n')
   self.assertEqual(load_validator(p).EPOCH,'frozen');self.assertEqual(sys.path,before)
 def test_import_failure_restores_path(self):
  with tempfile.TemporaryDirectory() as t:
   p=pathlib.Path(t);before=sys.path[:]
   (p/'acq2b_history_validation.py').write_text('raise RuntimeError("expected failure")\n')
   self.assertRaises(RuntimeError,load_validator,p);self.assertEqual(sys.path,before)
 def test_conflicting_cached_module_rejected(self):
  import types
  with tempfile.TemporaryDirectory() as t:
   p=pathlib.Path(t);(p/'acq2b_exact.py').write_text('x=1\n');other=p/'different.py';other.write_text('x=2\n')
   old=sys.modules.get('acq2b_exact');sys.modules['acq2b_exact']=types.SimpleNamespace(__file__=str(other))
   try:self.assertRaises(ValueError,load_validator,p)
   finally:
    if old is None:sys.modules.pop('acq2b_exact',None)
    else:sys.modules['acq2b_exact']=old
if __name__=='__main__':unittest.main()
