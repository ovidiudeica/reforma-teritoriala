"""Synthetic offline tests; no history source or OSM network needed."""
import hashlib
import pathlib
import tempfile
import unittest
from unittest import mock
import osm_acq2c_bulk_osh as bulk

class BulkHistoryTests(unittest.TestCase):
    def test_exact_source_digest_and_authentication_required(self):
        with tempfile.TemporaryDirectory() as tmp:
            original=bulk.PRIVATE;bulk.PRIVATE=pathlib.Path(tmp)
            try:
                for name in bulk.SOURCES:(bulk.PRIVATE/(name+'.osh.pbf')).write_bytes(name.encode())
                entries={name:{'sha256':hashlib.sha256(name.encode()).hexdigest(),
                               'authenticated':True,'format':'osh.pbf'}
                         for name in bulk.SOURCES}
                d={'epoch':bulk.EPOCH,'sources':entries}
                self.assertEqual(set(bulk.source_contract(d)),set(bulk.SOURCES))
                entries['RO']['sha256']='0'*64
                with self.assertRaises(ValueError):bulk.source_contract(d)
                entries['RO']['sha256']=hashlib.sha256(b'RO').hexdigest()
                entries['RO']['authenticated']=False
                with self.assertRaises(ValueError):bulk.source_contract(d)
            finally:bulk.PRIVATE=original
    def test_source_epoch_mismatch_rejected(self):
        with self.assertRaises(ValueError):bulk.source_contract({'epoch':'2026-10-21T00:00:00Z'})
    def test_closure_requires_all_way_nodes(self):
        plan={'relations':{72526:{'domains':['RO']},72634:{'domains':['MD']}}}
        graphs={'RO':{('r',72526):{'version':1,'timestamp':'t','refs':(('w',5),)},
                      ('w',5):{'version':1,'timestamp':'t','refs':(('n',2),)},
                      ('n',2):{'version':1,'timestamp':'t','refs':()}},
                'MD':{('r',72634):{'version':1,'timestamp':'t','refs':(('w',7),)}}}
        rows=bulk.reconcile(graphs,plan)
        self.assertEqual(rows[0]['verdict'],'DEPENDENCY_CLOSURE_CANDIDATE')
        self.assertEqual(rows[1]['verdict'],'UNKNOWN_INCOMPLETE_DEPENDENCIES')
        self.assertEqual(rows[1]['missing'],[['w',7]])
    def test_missing_relation_keeps_unknown(self):
        rows=bulk.reconcile({'RO':{},'MD':{}},{'relations':{72526:{}}})
        self.assertEqual(rows[0]['verdict'],'UNKNOWN_RELATION_NOT_IN_HISTORY_EXTRACT')
    def test_cross_domain_conflict_rejected(self):
        obj={'version':1,'timestamp':'t','refs':()}
        other={'version':2,'timestamp':'t','refs':()}
        with self.assertRaises(ValueError):
            bulk.reconcile({'RO':{('n',1):obj},'MD':{('n',1):other}},
                           {'relations':{72526:{}}})
    def test_id_file_deterministic_sorted(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=pathlib.Path(tmp)/'ids'
            bulk.write_ids(p,[('n',1),('r',72526),('w',7)])
            self.assertEqual(p.read_text(),'n1\nr72526\nw7\n')
    def test_osmium_never_executes_shell(self):
        with mock.patch.object(bulk.subprocess,'run') as run:
            bulk.run_osmium(['osmium','getid','-i','example'])
            self.assertEqual(run.call_args.args[0][0],'osmium')
            self.assertFalse(run.call_args.kwargs.get('shell',False))
            self.assertTrue(run.call_args.kwargs['check'])
    def test_real_pinned_inventory_counts_without_originals(self):
        plan=bulk.plan_registry(bulk.source_registry())
        self.assertEqual((plan['unknown_distinct'],plan['unknown_domain_rows']),(242,244))
        self.assertGreaterEqual(len(bulk.expected_ids(plan)),2966)

if __name__=='__main__':unittest.main(verbosity=2)
