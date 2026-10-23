import unittest,hashlib
from osm_acq2c_reader_provenance import verify_sources
class Tests(unittest.TestCase):
    def setUp(self):self.sources={'reader.py':b'old exact bytes\n'};self.receipt=dict(code_sha256={'reader.py':hashlib.sha256(self.sources['reader.py']).hexdigest()},source_qualified=False,unknown_adjudicated=0)
    def test_original_bytes_bind(self):self.assertEqual(verify_sources(self.receipt,self.sources)['bound_sources'],1)
    def test_one_changed_byte_fails(self):self.assertRaises(ValueError,verify_sources,self.receipt,{'reader.py':b'old exact bytes!\n'})
    def test_missing_source_fails(self):self.assertRaises(ValueError,verify_sources,self.receipt,{})
    def test_extra_source_fails(self):self.assertRaises(ValueError,verify_sources,self.receipt,dict(self.sources,extra=b'x'))
    def test_no_admission_promotion(self):
        self.receipt['source_qualified']=True;self.assertRaises(ValueError,verify_sources,self.receipt,self.sources)
if __name__=='__main__':unittest.main()
