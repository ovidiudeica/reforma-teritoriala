import importlib.util,io,json,pathlib,tempfile,unittest,urllib.error
from unittest.mock import Mock,patch
spec=importlib.util.spec_from_file_location('capture',pathlib.Path(__file__).resolve().parents[1]/'audit/osm-fix5-capture.py')
capture=importlib.util.module_from_spec(spec);spec.loader.exec_module(capture)
class Response:
 status=200;headers={'Content-Type':'application/json'}
 def __enter__(self):return self
 def __exit__(self,*args):pass
 def read(self,n):return b'{"elements":[]}'
class CaptureTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);capture.OUT=pathlib.Path(self.temp.name);capture.rows=[];capture.deadline=200
  self.monotonic=patch.object(capture.time,'monotonic',return_value=100);self.monotonic.start();self.addCleanup(self.monotonic.stop)
  self.sleep=patch.object(capture.time,'sleep');self.sleep.start();self.addCleanup(self.sleep.stop)
  capture.opener=Mock()
 def limited(self):return urllib.error.HTTPError('https://api.openstreetmap.org/',429,'limited',{'Retry-After':'2'},io.BytesIO(b'limited'))
 def test_get_only_official_whitelisted_paths(self):
  with self.assertRaises(AssertionError):capture.get('relation/1.json?upload=true')
  capture.opener.open.assert_not_called()
 def test_transient_retry_preserves_failed_and_successful_receipts(self):
  capture.opener.open.side_effect=[self.limited(),Response()];self.assertEqual(capture.get('relation/1.json')['http_status'],200);self.assertEqual([r['http_status'] for r in capture.rows],[429,200])
 def test_request_budget_applies_to_retry_not_just_initial_call(self):
  capture.rows=[{}]*79;capture.opener.open.side_effect=[self.limited(),Response()]
  with self.assertRaisesRegex(RuntimeError,'BUDGET'):capture.get('relation/1.json')
  self.assertEqual(capture.opener.open.call_count,1);self.assertEqual(len(capture.rows),80)
 def test_expired_global_budget_never_opens_network(self):
  capture.deadline=99
  with self.assertRaisesRegex(RuntimeError,'BUDGET'):capture.get('relation/1.json')
  capture.opener.open.assert_not_called()
 def test_retry_backoff_cannot_cross_global_deadline(self):
  clock={'now':100};capture.time.monotonic.side_effect=lambda:clock['now'];capture.time.sleep.side_effect=lambda seconds:clock.update(now=205)
  capture.opener.open.side_effect=[self.limited(),Response()]
  with self.assertRaisesRegex(RuntimeError,'BUDGET'):capture.get('relation/1.json')
  self.assertEqual(capture.opener.open.call_count,1)
 def test_unbounded_retry_after_is_not_followed(self):
  capture.opener.open.side_effect=urllib.error.HTTPError('https://api.openstreetmap.org/',503,'busy',{'Retry-After':'60'},io.BytesIO(b'busy'));self.assertEqual(capture.get('relation/1.json')['http_status'],503);self.assertEqual(capture.opener.open.call_count,1)
if __name__=='__main__':unittest.main()
