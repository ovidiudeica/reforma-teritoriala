import unittest,hashlib,copy,gzip
from osm_acq2c_replication_chain import audit,extract_versions
class Tests(unittest.TestCase):
 def setUp(self):
  self.raw={i:f'sequenceNumber={i}\ntimestamp=2026-10-20T0{i}\\:00\\:00Z\n'.encode() for i in (1,2,3)}
  self.states=[{'sequence':i,'timestamp':f'2026-10-20T0{i}:00:00Z','sha256':hashlib.sha256(self.raw[i]).hexdigest()}for i in (1,2,3)]
  self.receipts=[{'sequence':i,'bytes':1,'sha256':hashlib.sha256(b'x').hexdigest(),'gzip_xml_complete':True,'url':f'https://planet.openstreetmap.org/replication/hour/000/000/00{i}.osc.gz','selected_versions':[]}for i in (2,3)]
 def runaudit(self):return audit(self.states,'2026-10-20T01:00:04Z','2026-10-20T02:30:00Z',self.raw.__getitem__,lambda seq:b'x',self.receipts)
 def test_deterministic_and_unqualified(self):self.assertEqual(self.runaudit(),self.runaudit());self.assertFalse(self.runaudit()['source_qualified'])
 def test_missing_diff(self):self.receipts.pop();self.assertRaises(ValueError,self.runaudit)
 def test_duplicate_diff(self):self.receipts[1]=copy.deepcopy(self.receipts[0]);self.assertRaises(ValueError,self.runaudit)
 def test_bad_hash(self):self.receipts[0]['sha256']='0'*64;self.assertRaises(ValueError,self.runaudit)
 def test_bad_size(self):self.receipts[0]['bytes']=True;self.assertRaises(ValueError,self.runaudit)
 def test_incomplete_xml(self):self.receipts[0]['gzip_xml_complete']=False;self.assertRaises(ValueError,self.runaudit)
 def test_missing_state(self):self.states.pop(1);self.assertRaises(ValueError,self.runaudit)
 def test_state_hash(self):self.states[0]['sha256']='0'*64;self.assertRaises(ValueError,self.runaudit)
 def test_wrong_url_sequence(self):self.receipts[0]['url']=self.receipts[1]['url'];self.assertRaises(ValueError,self.runaudit)
 def test_publisher(self):self.receipts[0]['url']=self.receipts[0]['url'].replace('planet.openstreetmap.org','example.com');self.assertRaises(ValueError,self.runaudit)
 def test_uncovered_target(self):self.states.pop();self.receipts.pop();self.assertRaises(ValueError,self.runaudit)
 def test_naive_time(self):self.states[0]['timestamp']='2026-10-20T01:00:00';self.assertRaises(ValueError,self.runaudit)
 def test_all_versions_without_personal_metadata(self):
  raw=b'<osmChange version="0.6"><modify><way id="4" version="2" timestamp="2026-10-20T02:00:00Z" user="private" uid="7"><nd ref="6"/></way><way id="4" version="3" timestamp="2026-10-20T02:01:00Z"><nd ref="8"/></way></modify></osmChange>'
  found=extract_versions(gzip.compress(raw),{'w4'});self.assertEqual([r['version']for r in found],[2,3]);self.assertNotIn('user',found[0]);self.assertNotIn('uid',found[0])
 def test_delete_is_not_implicitly_visible(self):
  raw=b'<osmChange version="0.6"><delete><way id="4" version="2" timestamp="2026-10-20T02:00:00Z"/></delete></osmChange>'
  self.assertEqual(extract_versions(gzip.compress(raw),{'w4'})[0]['visible'],'false')
 def test_duplicate_version_is_blocked(self):
  item=b'<way id="4" version="2" timestamp="2026-10-20T02:00:00Z"/>'
  with self.assertRaises(ValueError):extract_versions(gzip.compress(b'<osmChange version="0.6"><modify>'+item+item+b'</modify></osmChange>'),{'w4'})
 def test_partial_gzip(self):
  with self.assertRaises((EOFError,ValueError)):extract_versions(gzip.compress(b'<osmChange version="0.6"/>')[:-4],set())
 def test_unknown_entity_does_not_become_selected(self):
  raw=b'<osmChange version="0.6"><modify><way id="4" version="2" timestamp="2026-10-20T02:00:00Z"/></modify></osmChange>'
  self.assertEqual(extract_versions(gzip.compress(raw),{'w5'}),[])
if __name__=='__main__':unittest.main()
