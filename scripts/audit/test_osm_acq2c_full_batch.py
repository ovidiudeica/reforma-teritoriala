"""Fail-closed, offline tests for full UNKNOWN dependency inventory and first batch."""
import unittest
from osm_acq2c_full_batch import plan_registry, PILOT_OBJECTS, PRIORITY

def row(rid, missing, domains=('RO',), resolved=False):
    return {'id':rid,'resolved':resolved,'domains':[
        {'domain':domain,'missing_after':missing} for domain in domains]}

class InventoryTests(unittest.TestCase):
    def test_full_priority_order_and_dedup(self):
        a,b=sorted(PILOT_OBJECTS)[:2]
        items=[row(72526,[list(a),['node',100],['way',200]],('RO','MD')),
               row(72634,[['node',100],['way',300]],('RO','MD')),
               row(11821462,[['node',400]],('MD',)),
               row(11905201,[['node',500]],('MD',)),
               row(999999,[['node',100],['node',600]],('RO',)),
               row(777777,[],resolved=True)]
        p=plan_registry({'rows':items},strict=False)
        self.assertEqual(p['unknown_distinct'],5)
        self.assertEqual(p['unknown_domain_rows'],7)
        self.assertEqual(len(p['already_piloted']),1)
        self.assertEqual(p['ordered'][0]['type'],'way')
        self.assertEqual(p['ordered'][0]['id'],200)
        self.assertEqual(p['ordered'][0]['needed_by'],[72526])
        self.assertEqual(next(x for x in p['ordered'] if x['id']==100)['needed_by'],
                         [72526,72634,999999])
    def test_duplicate_relation_fails(self):
        with self.assertRaises(ValueError):
            plan_registry({'rows':[row(72526,[]),row(72526,[])]},strict=False)
    def test_unknown_is_not_excluded_by_empty_dependencies(self):
        p=plan_registry({'rows':[row(72526,[])]},strict=False)
        self.assertEqual(p['unknown_distinct'],1)
        self.assertEqual(p['relations'][72526]['missing_direct'],0)
        self.assertEqual(p['remaining_missing_objects'],0)
    def test_untrusted_domain_fails(self):
        with self.assertRaises(ValueError):
            plan_registry({'rows':[row(72526,[['node',2]],('ZZ',))]},strict=False)
    def test_bad_dependency_fails(self):
        for miss in ([['relation',2]],[['node',-1]],[['way','32']],[['node']]):
            with self.subTest(miss=miss),self.assertRaises(ValueError):
                plan_registry({'rows':[row(72526,miss)]},strict=False)
    def test_strict_missing_corpus_fails(self):
        with self.assertRaises(ValueError):
            plan_registry({'rows':[row(72526,[['node',1]])]},strict=True)
    def test_pilot_set_does_not_label_any_relation_proven(self):
        obj=next(iter(PILOT_OBJECTS))
        p=plan_registry({'rows':[row(72526,[list(obj)])]},strict=False)
        self.assertEqual(len(p['already_piloted']),1)
        self.assertEqual(p['unknown_distinct'],1)

if __name__=='__main__':
    unittest.main(verbosity=2)
