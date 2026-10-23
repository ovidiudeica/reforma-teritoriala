import io,struct,unittest
from osm_acq2c_pbf_blocks import fields,blob_header,scan

def varint(n):
    out=[]
    while n>=128:out.append((n&127)|128);n>>=7
    return bytes(out+[n])
def frame(kind=b'OSMData',data=b'payload'):
    header=b'\x0a'+varint(len(kind))+kind+b'\x18'+varint(len(data))
    return struct.pack('>I',len(header))+header+data

class Tests(unittest.TestCase):
    def setUp(self):self.raw=frame(b'OSMHeader')+frame()+frame(data=b'other')
    def test_complete_framing_not_payload_or_sorting_certification(self):
        r=scan(io.BytesIO(self.raw),len(self.raw));self.assertTrue(r['complete']);self.assertEqual(len(r['blocks']),3)
        for k in ('source_qualified','payloads_validated','global_sorting_verified'):self.assertIs(r[k],False)
    def test_payload_bytes_not_read(self):
        class Tracking(io.BytesIO):
            def read(self,n=-1):
                if n==-1:raise AssertionError('Unbounded read')
                return super().read(n)
        r=scan(Tracking(self.raw),len(self.raw));self.assertLess(r['framing_bytes_read'],len(self.raw))
    def test_partial_not_complete(self):
        r=scan(io.BytesIO(self.raw),len(self.raw),max_blocks=2)
        self.assertFalse(r['complete']);self.assertEqual(r['stop_reason'],'BLOCK_BUDGET')
    def test_time_budget(self):
        times=iter([0,0,2,2]);r=scan(io.BytesIO(self.raw),len(self.raw),seconds=1,clock=lambda:next(times))
        self.assertFalse(r['complete']);self.assertEqual(len(r['blocks']),1)
    def test_deterministic_framing(self):
        a=scan(io.BytesIO(self.raw),len(self.raw));b=scan(io.BytesIO(self.raw),len(self.raw))
        for r in (a,b):r.pop('elapsed_seconds')
        self.assertEqual(a,b)
    def test_missing_dataset_header(self):self.assertRaises(ValueError,scan,io.BytesIO(frame()),len(frame()))
    def test_repeated_dataset_header(self):
        data=frame(b'OSMHeader')*2;self.assertRaises(ValueError,scan,io.BytesIO(data),len(data))
    def test_truncated_prefix(self):self.assertRaises(ValueError,scan,io.BytesIO(b'xx'),2)
    def test_huge_header(self):self.assertRaises(ValueError,scan,io.BytesIO(struct.pack('>I',65537)),4)
    def test_truncated_header(self):self.assertRaises(ValueError,scan,io.BytesIO(b'\0\0\0\x04x'),5)
    def test_oversized_blob(self):self.assertRaises(ValueError,blob_header,b'\x0a\x07OSMData\x18'+varint(33554433))
    def test_blob_beyond_original(self):self.assertRaises(ValueError,scan,io.BytesIO(self.raw),len(self.raw)-1)
    def test_declared_length_exceeds_actual(self):self.assertRaises(ValueError,scan,io.BytesIO(self.raw),len(self.raw)+1)
    def test_duplicate_length(self):self.assertRaises(ValueError,blob_header,b'\x0a\x07OSMData\x18\x01\x18\x01')
    def test_unsupported_type(self):self.assertRaises(ValueError,blob_header,b'\x0a\x03BAD\x18\x01')
    def test_truncated_varint(self):self.assertRaises(ValueError,fields,b'\x80')
    def test_bad_wire_or_field(self):
        for raw in (b'\0',b'\x0b',b'\x0a\x04x',b'\x09x',b'\x08'+b'\xff'*10):
            with self.subTest(raw=raw):self.assertRaises(ValueError,fields,raw)
    def test_invalid_budgets(self):
        for args in ({'max_blocks':True},{'max_blocks':0},{'seconds':True},{'seconds':0}):
            with self.subTest(args=args):self.assertRaises(ValueError,scan,io.BytesIO(self.raw),len(self.raw),**args)
if __name__=='__main__':unittest.main()
