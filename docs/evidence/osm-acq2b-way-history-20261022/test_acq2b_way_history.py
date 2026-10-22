import unittest,xml.etree.ElementTree as ET
from acq2b_history_validation import validate_way_history

def way(v,t,refs=(1,2),**attrs):
    w=ET.Element('way',{'id':'42','version':str(v),'timestamp':t,**attrs})
    for ref in refs:ET.SubElement(w,'nd',{'ref':str(ref)})
    return w
class WayHistoryTests(unittest.TestCase):
    def setUp(self):self.a=way(1,'2020-01-01T00:00:00Z');self.b=way(2,'2026-10-21T00:00:00Z',(1,3,2))
    def test_historical_members_selected(self):
        self.assertEqual(validate_way_history([self.a,self.b],[self.b])['object']['nodes'],[1,2])
    def test_reordered_current_members_rejected(self):
        current=way(2,'2026-10-21T00:00:00Z',(2,3,1))
        with self.assertRaises(ValueError):validate_way_history([self.a,self.b],[current])
    def test_gap_rejected(self):
        self.b.set('version','3')
        with self.assertRaises(ValueError):validate_way_history([self.a,self.b],[self.b])
    def test_deleted_historical_way_rejected(self):
        self.a.set('visible','false')
        with self.assertRaises(ValueError):validate_way_history([self.a,self.b],[self.b])
    def test_missing_references_rejected(self):
        w=way(1,'2020-01-01T00:00:00Z',())
        with self.assertRaises(ValueError):validate_way_history([w],[w])

if __name__=='__main__':unittest.main(verbosity=2)
