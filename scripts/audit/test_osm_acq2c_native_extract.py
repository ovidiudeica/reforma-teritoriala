import unittest,pathlib,tempfile,hashlib
from unittest.mock import patch
import osm_acq2c_native_extract as module
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
    def test_large_version_gap_without_range_allocation(self):self.assertEqual(check_versions([self.row(1),self.row(4294967295)],{'w4'})['gapped_ids'],['w4'])
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
    def original_case(self,change=None,corrupt=False):
        raw=b'small full-original fixture'
        digest=hashlib.sha256(raw).hexdigest();md5=hashlib.md5(raw).hexdigest()
        receipt=dict(status='FULL_BASE_BYTES_VERIFIED_NOT_SOURCE_QUALIFIED',url=module.URL,expected_bytes=len(raw),etag=module.ETAG,base_epoch=module.BASE_EPOCH,verified_downloaded_bytes=len(raw),actual_md5=md5,source_sha256=digest,chunks=[dict(offset=0,bytes=len(raw),sha256=digest)])
        if change:receipt.update(change)
        with tempfile.TemporaryDirectory() as d,patch.multiple(module,TOTAL=len(raw),MD5=md5):
            path=pathlib.Path(d)/'fixture.pbf';path.write_bytes(b'X'*len(raw) if corrupt else raw)
            return verify_original(path,receipt)
    def test_full_digest_success(self):self.assertFalse(self.original_case()['source_qualified'])
    def test_corrupt_original(self):self.assertRaises(ValueError,self.original_case,corrupt=True)
    def test_wrong_sha(self):self.assertRaises(ValueError,self.original_case,{'source_sha256':'0'*64})
    def test_wrong_etag(self):self.assertRaises(ValueError,self.original_case,{'etag':'changed'})
    def test_wrong_length(self):self.assertRaises(ValueError,self.original_case,{'verified_downloaded_bytes':1})
    def test_wrong_epoch(self):self.assertRaises(ValueError,self.original_case,{'base_epoch':'2026-10-20T20:23:47Z'})
    def test_wrong_publisher(self):self.assertRaises(ValueError,self.original_case,{'url':'https://example.invalid/fixture.pbf'})
    def test_missing_segments(self):self.assertRaises(ValueError,self.original_case,{'chunks':[]})
    def test_segment_offset_gap(self):self.assertRaises(ValueError,self.original_case,{'chunks':[dict(offset=1,bytes=27,sha256='0'*64)]})
    def test_segment_hash_conflict(self):self.assertRaises(ValueError,self.original_case,{'chunks':[dict(offset=0,bytes=len(b'small full-original fixture'),sha256='0'*64)]})

if __name__=='__main__':unittest.main()
