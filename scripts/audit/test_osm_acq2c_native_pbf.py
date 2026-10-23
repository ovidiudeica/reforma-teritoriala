"""Real native-filter tests: requires the pinned Pyosmium runtime, no mocks."""
import unittest,tempfile,pathlib,osmium
from osm_acq2c_native_extract import read_selection,canonical,check_versions
XML=b'''<osm version="0.6"><node id="4" version="1" timestamp="2026-10-18T00:00:00Z" lat="46.8331996" lon="28.8583930" uid="123" user="DO_NOT_EXPORT" changeset="2"/><way id="4" version="1" timestamp="2026-10-18T00:00:00Z"><nd ref="4"/></way><way id="4" version="2" timestamp="2026-10-19T00:00:00Z"><nd ref="4"/><nd ref="5"/></way><relation id="4" version="1" timestamp="2026-10-18T00:00:00Z"><member type="way" ref="4" role="outer"/></relation></osm>'''

class Tests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='osm-native-history-')
        self.root=pathlib.Path(self.temp.name);self.xml=self.root/'fixture.osm';self.xml.write_bytes(XML)
        self.pbf=self.root/'fixture.osh.pbf';header=osmium.io.Header();header.has_multiple_object_versions=True
        with osmium.SimpleWriter(str(self.pbf),header=header) as writer:
            for obj in osmium.FileProcessor(str(self.xml)):writer.add(obj)
    def tearDown(self):self.temp.cleanup()
    def test_native_typed_filter(self):
        rows=list(read_selection(self.pbf,{'n4','w4'}))
        self.assertEqual([r['code'] for r in rows],['n4','w4','w4'])
        self.assertEqual(check_versions(rows,{'n4','w4'})['gapped_ids'],[])
    def test_exact_integer_coordinates(self):
        row=list(read_selection(self.pbf,{'n4'}))[0]
        self.assertEqual((row['x'],row['y']),(288583930,468331996))
    def test_contributor_metadata_not_exported(self):
        raw=canonical(list(read_selection(self.pbf,{'n4'})))
        for field in (b'DO_NOT_EXPORT',b'uid',b'changeset',b'user'):self.assertNotIn(field,raw)
    def test_repeat_identical(self):
        self.assertEqual(canonical(list(read_selection(self.pbf,{'w4'}))),canonical(list(read_selection(self.pbf,{'w4'}))))
    def test_current_only_rejected(self):
        with self.assertRaises(ValueError):list(read_selection(self.xml,{'w4'}))
    def test_missing_id_stays_missing(self):
        self.assertEqual(check_versions(list(read_selection(self.pbf,{'w5'})),{'w5'})['missing_ids'],['w5'])
    def test_epoch_header_required_when_requested(self):
        with self.assertRaises(ValueError):list(read_selection(self.pbf,{'w4'},'2026-10-19T00:00:04Z'))
    def test_native_masks_equal_unrestricted_union(self):
        all_rows=list(read_selection(self.pbf,{'n4','w4','r4'}))
        typed=[]
        for kind in ('n','w','r'):typed.extend(read_selection(self.pbf,{kind+'4'},entity_kind=kind))
        self.assertEqual(canonical(all_rows),canonical(typed))
    def test_mask_keeps_all_versions_and_members(self):
        ways=list(read_selection(self.pbf,{'w4'},entity_kind='w'))
        self.assertEqual([r['version'] for r in ways],[1,2])
        self.assertEqual(ways[-1]['nodes'],[4,5])
        relation=list(read_selection(self.pbf,{'r4'},entity_kind='r'))[0]
        self.assertEqual(relation['members'],[['w',4,'outer']])
    def test_mask_never_hides_mixed_request(self):
        for kind in ('n','w','r'):
            with self.subTest(kind=kind):
                with self.assertRaises(ValueError):list(read_selection(self.pbf,{'n4','w4','r4'},entity_kind=kind))
    def test_invalid_mask(self):
        for kind in ('ALL','node','x',True):
            with self.subTest(kind=kind):
                with self.assertRaises(ValueError):list(read_selection(self.pbf,{'n4'},entity_kind=kind))
    def test_mask_does_not_bypass_history_header(self):
        with self.assertRaises(ValueError):list(read_selection(self.xml,{'n4'},entity_kind='n'))
    def test_mask_does_not_bypass_epoch(self):
        with self.assertRaises(ValueError):list(read_selection(self.pbf,{'r4'},'2026-10-19T00:00:04Z',entity_kind='r'))
    def test_mask_missing_id_is_explicit(self):
        rows=list(read_selection(self.pbf,{'r5'},entity_kind='r'))
        self.assertEqual(check_versions(rows,{'r5'})['missing_ids'],['r5'])
    def test_mask_repeat_is_byte_identical(self):
        self.assertEqual(canonical(list(read_selection(self.pbf,{'r4'},entity_kind='r'))),canonical(list(read_selection(self.pbf,{'r4'},entity_kind='r'))))
    def test_framing_index_accepts_real_native_history_fixture(self):
        from osm_acq2c_pbf_blocks import scan
        with self.pbf.open('rb') as source:result=scan(source,self.pbf.stat().st_size)
        self.assertTrue(result['complete']);self.assertEqual(result['blocks'][0]['kind'],'OSMHeader')
        self.assertTrue(all(r['kind']=='OSMData' for r in result['blocks'][1:]))
        self.assertEqual(result['next_offset'],self.pbf.stat().st_size)

if __name__=='__main__':unittest.main()
