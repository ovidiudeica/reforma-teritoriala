import unittest,tempfile,pathlib,hashlib,json,io,contextlib
from unittest.mock import patch
import osm_acq2c_acquire_history_base as module
from osm_acq2c_acquire_history_base import validate_range,TOTAL,ETAG,exclusive_acquisition
class Tests(unittest.TestCase):
 def headers(self):return {'Content-Range':f'bytes 0-15/{TOTAL}','Content-Length':'16','ETag':ETAG}
 def test_valid(self):validate_range(206,self.headers(),0,15)
 def test_full_response_is_not_range(self):self.assertRaises(ValueError,validate_range,200,self.headers(),0,15)
 def test_wrong_epoch_file_size(self):h=self.headers();h['Content-Range']='bytes 0-15/17';self.assertRaises(ValueError,validate_range,206,h,0,15)
 def test_wrong_range(self):self.assertRaises(ValueError,validate_range,206,self.headers(),1,16)
 def test_wrong_etag(self):h=self.headers();h['ETag']='new';self.assertRaises(ValueError,validate_range,206,h,0,15)
 def test_partial(self):h=self.headers();h['Content-Length']='15';self.assertRaises(ValueError,validate_range,206,h,0,15)
 def test_exclusive_lock_and_release(self):
  with tempfile.TemporaryDirectory()as d:
   root=pathlib.Path(d)
   with exclusive_acquisition(root):
    with self.assertRaises(FileExistsError):
     with exclusive_acquisition(root):pass
   self.assertFalse((root/'history-261019-acquisition.lock').exists())
 def test_release_after_error(self):
  with tempfile.TemporaryDirectory()as d:
   root=pathlib.Path(d)
   with self.assertRaises(ValueError):
    with exclusive_acquisition(root):raise ValueError('Simulated failure')
   self.assertFalse((root/'history-261019-acquisition.lock').exists())

class AcquisitionFixtures(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=pathlib.Path(self.tmp.name)
  self.raw=b'0123456789abcdef'
  self.stack=contextlib.ExitStack();self.addCleanup(self.stack.close)
  for key,value in [('ROOT',self.root),('TOTAL',16),('MD5',hashlib.md5(self.raw).hexdigest())]:self.stack.enter_context(patch.object(module,key,value))
  self.stack.enter_context(patch.object(module.shutil,'disk_usage',return_value=type('Disk',(),{'free':100*1024**3})()))
 def response(self,data,start=0):
  r=io.BytesIO(data);r.status=206;r.headers={'ETag':ETAG,'Content-Length':str(16-start),'Content-Range':f'bytes {start}-15/16'};return r
 def runacquire(self,data=None,resume=False,start=0):
  with patch.object(module.urllib.request,'urlopen',return_value=self.response(self.raw if data is None else data,start))as request:
   module.acquire(resume);return request
 def state(self):return json.loads((self.root/'history-261019-acquisition.json').read_bytes())
 def prefix(self,raw=b'01234567',digest=None,extra=b''):
  (self.root/'history-261019.osm.pbf.partial').write_bytes(raw+extra)
  (self.root/'history-261019-acquisition.json').write_text(json.dumps({'url':module.URL,'expected_bytes':16,'etag':ETAG,'source_qualified':False,'chunks':[{'offset':0,'bytes':len(raw),'sha256':digest or hashlib.sha256(raw).hexdigest()}]}))
 def test_complete_fixture_keeps_source_unqualified(self):
  self.runacquire();self.assertEqual((self.root/'history-261019.osm.pbf').read_bytes(),self.raw)
  self.assertEqual(self.state()['source_sha256'],hashlib.sha256(self.raw).hexdigest());self.assertFalse(self.state()['source_qualified'])
 def test_partial_fixture_cannot_be_promoted(self):
  with self.assertRaises(ValueError):self.runacquire(b'123')
  self.assertFalse((self.root/'history-261019.osm.pbf').exists());self.assertEqual(self.state()['verified_downloaded_bytes'],0)
 def test_oversized_response(self):
  with self.assertRaises(ValueError):self.runacquire(self.raw+b'x')
  self.assertFalse((self.root/'history-261019.osm.pbf').exists())
 def test_md5_mismatch_preserves_failed_original(self):
  with patch.object(module,'MD5','0'*32),self.assertRaises(ValueError):self.runacquire()
  self.assertEqual((self.root/'history-261019.osm.pbf.partial').read_bytes(),self.raw);self.assertFalse((self.root/'history-261019.osm.pbf').exists())
 def test_resume_exact_prefix(self):
  self.prefix();r=self.runacquire(self.raw[8:],True,8);self.assertEqual(r.call_args.args[0].headers['Range'],'bytes=8-15')
  self.assertEqual((self.root/'history-261019.osm.pbf').read_bytes(),self.raw)
 def test_corrupt_resume_refused(self):
  self.prefix(digest='0'*64)
  with self.assertRaises(ValueError):self.runacquire(resume=True)
  self.assertFalse((self.root/'history-261019.osm.pbf').exists())
 def test_uncommitted_suffix_never_truncated(self):
  self.prefix(extra=b'crash');p=self.root/'history-261019.osm.pbf.partial';before=p.read_bytes()
  with self.assertRaises(ValueError):self.runacquire(resume=True)
  self.assertEqual(p.read_bytes(),before)
 def test_existing_evidence_not_overwritten(self):
  self.prefix();before=(self.root/'history-261019-acquisition.json').read_bytes()
  with self.assertRaises(FileExistsError):self.runacquire()
  self.assertEqual((self.root/'history-261019-acquisition.json').read_bytes(),before)
 def test_transient_http_retry_is_bounded(self):
  for status in (429,502,503,504):
   with self.subTest(status=status),tempfile.TemporaryDirectory()as d,patch.object(module,'ROOT',pathlib.Path(d)),patch.object(module.time,'sleep')as sleep:
    error=module.urllib.error.HTTPError(module.URL,status,'fixture',{},None)
    with patch.object(module.urllib.request,'urlopen',side_effect=error)as request,self.assertRaises(module.urllib.error.HTTPError):module.acquire()
    self.assertEqual(request.call_count,4);self.assertEqual(sleep.call_count,3)
 def test_timeout_then_success(self):
  with patch.object(module.time,'sleep'),patch.object(module.urllib.request,'urlopen',side_effect=[TimeoutError('fixture'),self.response(self.raw)])as request:module.acquire()
  self.assertEqual(request.call_count,2);self.assertFalse(self.state()['source_qualified'])
 def test_permanent_http_error_not_retried(self):
  error=module.urllib.error.HTTPError(module.URL,404,'fixture',{},None)
  with patch.object(module.urllib.request,'urlopen',side_effect=error)as request,self.assertRaises(module.urllib.error.HTTPError):module.acquire()
  self.assertEqual(request.call_count,1)
if __name__=='__main__':unittest.main()
