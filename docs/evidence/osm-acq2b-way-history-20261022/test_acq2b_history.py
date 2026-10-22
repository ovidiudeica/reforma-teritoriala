import unittest,xml.etree.ElementTree as ET
from acq2b_history_validation import validate_history

def node(v,t,**attrs):
    return ET.Element('node',{'id':'42','version':str(v),'timestamp':t,'lon':'20','lat':'46',**attrs})
class HistoryTests(unittest.TestCase):
    def setUp(self):
        self.a=node(1,'2020-01-01T00:00:00Z');self.b=node(2,'2026-10-21T00:00:00Z',lon='21')
    def test_select_version_before_intervening_change(self):
        r=validate_history([self.a,self.b],[self.b]);self.assertEqual(r['object']['version'],1);self.assertEqual(r['effective_until'],self.b.get('timestamp'))
    def test_gap_rejected(self):
        self.b.set('version','3')
        with self.assertRaises(ValueError):validate_history([self.a,self.b],[self.b])
    def test_current_mismatch_rejected(self):
        with self.assertRaises(ValueError):validate_history([self.a,self.b],[self.a])
    def test_deleted_target_rejected(self):
        self.a.set('visible','false')
        with self.assertRaises(ValueError):validate_history([self.a,self.b],[self.b])
    def test_missing_prior_version_rejected(self):
        with self.assertRaises(ValueError):validate_history([self.a],[self.a],target='2010-01-01T00:00:00Z')
    def test_non_grid_coordinates_rejected(self):
        self.a.set('lon','20.0000000001')
        with self.assertRaises(ValueError):validate_history([self.a],[self.a])
    def test_identity_mix_rejected(self):
        self.b.set('id','43')
        with self.assertRaises(ValueError):validate_history([self.a,self.b],[self.b])
    def test_tag_order_is_not_object_change(self):
        a=node(1,'2020-01-01T00:00:00Z');b=node(1,'2020-01-01T00:00:00Z')
        for k in ['a','b']:ET.SubElement(a,'tag',{'k':k,'v':k})
        for k in ['b','a']:ET.SubElement(b,'tag',{'k':k,'v':k})
        self.assertEqual(validate_history([a],[b])['object']['version'],1)

if __name__=='__main__':unittest.main(verbosity=2)
