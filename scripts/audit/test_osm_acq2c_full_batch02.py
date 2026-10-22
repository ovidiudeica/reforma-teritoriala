"""Offline continuity checks; no OSM network or fabricated verdicts."""
import unittest
from osm_acq2c_full_batch02 import ordered_slice
from osm_acq2c_full_batch import plan_registry,source_registry

class BatchContinuityTests(unittest.TestCase):
    def test_pinned_full_registry_and_no_overlap(self):
        plan=plan_registry(source_registry())
        batch=ordered_slice(plan)
        self.assertEqual(len(batch),64)
        first={(x['type'],x['id']) for x in plan['ordered'][:64]}
        later={(x['type'],x['id']) for x in batch}
        self.assertFalse(first & later)
        self.assertEqual(len(first),64)
        self.assertEqual(len(later),64)
    def test_refuse_cardinality_drift(self):
        plan=plan_registry(source_registry())
        plan['unknown_distinct']-=1
        with self.assertRaises(ValueError):ordered_slice(plan)
    def test_refuse_prior_object_order_drift(self):
        plan=plan_registry(source_registry())
        plan['ordered'][0],plan['ordered'][1]=plan['ordered'][1],plan['ordered'][0]
        with self.assertRaises(ValueError):ordered_slice(plan)
    def test_refuse_prior_object_identity_drift(self):
        plan=plan_registry(source_registry())
        plan['ordered'][0]=dict(plan['ordered'][0],id=123)
        with self.assertRaises(ValueError):ordered_slice(plan)
    def test_refuse_new_batch_overlap(self):
        plan=plan_registry(source_registry())
        plan['ordered'][64]=dict(plan['ordered'][0])
        with self.assertRaises(ValueError):ordered_slice(plan)

if __name__=='__main__':
    unittest.main(verbosity=2)
