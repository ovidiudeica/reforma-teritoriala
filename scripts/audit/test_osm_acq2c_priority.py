"""Independent fail-closed synthetic tests, no OSM network calls."""
import unittest
from osm_acq2c_priority import verify_history,plan,PRIORITIES,objects,dep

def xml(versions):
    parts=['<osm version="0.6">']
    for v,when,visible,nodes in versions:
        nd=''.join('<nd ref="%s"/>'%i for i in nodes)
        parts.append(f'<way id="15" version="{v}" timestamp="{when}" visible="{visible}" changeset="12">{nd}<tag k="boundary" v="administrative"/></way>')
    return (''.join(parts)+'</osm>').encode('utf8')

BEFORE=(1,'2026-10-20T17:00:00Z','true',[1,2])
AFTER=(2,'2026-10-21T17:00:00Z','true',[1,3])

class HistoricalEvidenceTests(unittest.TestCase):
    def test_select_epoch_with_later_version(self):
        proof=verify_history(xml([BEFORE,AFTER]),xml([AFTER]),'way',15)
        self.assertEqual((proof['epoch_version'],proof['latest_version']),(1,2))
        self.assertEqual(proof['effective_until'],AFTER[1])

    def test_history_gap_rejected(self):
        third=(3,*AFTER[1:])
        with self.assertRaises(ValueError):
            verify_history(xml([BEFORE,third]),xml([third]),'way',15)

    def test_duplicate_version_rejected(self):
        with self.assertRaises(ValueError):
            verify_history(xml([BEFORE,BEFORE]),xml([BEFORE]),'way',15)

    def test_current_mismatch_rejected(self):
        with self.assertRaises(ValueError):
            verify_history(xml([BEFORE,AFTER]),xml([(2,AFTER[1],'true',[5,6])]),'way',15)

    def test_deleted_at_epoch_rejected(self):
        deleted=(2,'2026-10-20T19:00:00Z','false',[])
        with self.assertRaises(ValueError):
            verify_history(xml([BEFORE,deleted]),xml([deleted]),'way',15)

    def test_created_after_epoch_rejected(self):
        future=(1,'2026-10-21T17:00:00Z','true',[1,3])
        with self.assertRaises(ValueError):
            verify_history(xml([future]),xml([future]),'way',15)

    def test_foreign_object_rejected(self):
        with self.assertRaises(ValueError):
            verify_history(xml([BEFORE]),xml([BEFORE]).replace(b'id="15"',b'id="16"'),'way',15)

    def test_malformed_xml_rejected(self):
        with self.assertRaises(Exception):
            objects(b'<osm><way></osm>','way',15,True)

    def test_no_cross_domain_duplicate_retrieval(self):
        rows=[{'id':n,'domains':[
            {'domain':'RO','missing_after':[['node',100+j] for j in range(3)]},
            {'domain':'MD','missing_after':[['node',100+j] for j in range(3)]}
        ]} for n in PRIORITIES]
        counts,selected=plan({'rows':rows},per_priority=2,limit=8)
        self.assertEqual(len(selected),3)
        self.assertEqual([c['unique_missing'] for c in counts],[3,3,3,3])

    def test_invalid_dependency_fails(self):
        for item in (['relation',12],['node',-1],['node','42'],['node']):
            with self.assertRaises(ValueError):dep(item)

if __name__=='__main__':unittest.main(verbosity=2)
