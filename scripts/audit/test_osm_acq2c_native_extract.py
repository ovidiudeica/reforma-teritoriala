import unittest,pathlib,tempfile
from osm_acq2c_native_extract import request_ids,check_versions,canonical,verify_original

class Tests(unittest.TestCase):
    def row(self,version=1,code='w4',timestamp='2026-10-18T00:00:00Z'):
        return dict(code=code,version=version,timestamp=timestamp)
    def test_typed_overlap(self):self.assertEqual(len(request_ids(['n4','w4','r4'])),3)
    def test_duplicate_id(self):self.assertRaises(ValueError,request_ids,['w4','w4'])
    def test_invalid_ids(self):
        for value in ['w0','w04','w-1','w4/../',True,4,'x4']:
            with self.subTest(value=value):self.assertRaises(ValueError,request_ids,[value])
    def test_empty(self):self.assertRaises(ValueError,request_ids,[])
    def test_missing(self):self.assertEqual(check_versions([],{'w4'})['missing_ids'],['w4'])
    def test_gap(self):self.assertEqual(check_versions([self.row(2)],{'w4'})['gapped_ids'],['w4'])
    def test_duplicate_version(self):self.assertRaises(ValueError,check_versions,[self.row(),self.row()],{'w4'})
    def test_reverse_version(self):self.assertRaises(ValueError,check_versions,[self.row(2),self.row(1)],{'w4'})
    def test_reverse_timestamp(self):self.assertRaises(ValueError,check_versions,[self.row(),self.row(2,timestamp='2026-10-17T00:00:00Z')],{'w4'})
    def test_other_type_same_id(self):self.assertRaises(ValueError,check_versions,[self.row(code='n4')],{'w4'})
    def test_bool_version(self):self.assertRaises(ValueError,check_versions,[self.row(True)],{'w4'})
    def test_complete_is_not_qualification(self):
        result=check_versions([self.row(),self.row(2)],{'w4'})
        self.assertEqual(result['gapped_ids'],[]);self.assertFalse(result['source_qualified']);self.assertFalse(result['dependency_closure_certified']);self.assertEqual(result['unknown_adjudicated'],0)
    def test_canonical_bytes(self):self.assertEqual(canonical({'b':2,'a':1}),b'{"a":1,"b":2}\n')
    def test_incomplete_receipt_precedes_file_io(self):self.assertRaises(ValueError,verify_original,pathlib.Path('missing-original'),{'status':'ACQUIRING_INCOMPLETE'})

if __name__=='__main__':unittest.main()
