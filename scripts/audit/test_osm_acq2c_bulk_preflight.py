"""Offline fail-closed source provenance and exact-ID contract tests."""
import unittest
import hashlib
import json
import pathlib
import tempfile
from unittest.mock import patch
import osm_acq2c_bulk_preflight as preflight
from osm_acq2c_bulk_preflight import plan,evaluate_provenance,item_code,APPROVED_HOSTS,EPOCH

GOOD={"publication_url":"https://planet.openstreetmap.org/pbf/full-history/history-261026.osm.pbf",
      "source_sha256":"a"*64,"source_bytes":42,
      "history_through":"2026-10-21T21:00:00Z",
      "independent_publication_receipt_sha256":"b"*64}

class BulkPreflightTests(unittest.TestCase):
    def test_complete_deduplicated_cohort(self):
        p=plan()
        self.assertEqual(len(p["required_history_object_ids"]),3208)
        self.assertEqual(p["unknown_relation_count"],242)
        self.assertEqual(p["direct_missing_unique_count"],2966)
        self.assertEqual(len(set(p["required_history_object_ids"])),3208)
        self.assertTrue({"r72526","r72634","r11821462","r11905201"} <=
                        set(p["required_history_object_ids"]))
        self.assertFalse(p["all_relations_adjudicated"])
    def test_no_improper_qualifications(self):
        v=evaluate_provenance(GOOD,42,"a"*64)
        self.assertEqual(v["local_integrity"],"PASS")
        self.assertFalse(v["source_qualified"])
        self.assertNotEqual(v["publisher_receipt_crosscheck"],"PASS")
    def test_reject_malicious_or_private_host(self):
        for url in ("http://planet.openstreetmap.org/a.osm.pbf",
                    "https://planet.openstreetmap.org.evil.invalid/a.osm.pbf",
                    "https://fake.example/a.osm.pbf"):
            with self.subTest(url=url),self.assertRaises(ValueError):
                evaluate_provenance(dict(GOOD,publication_url=url),42,"a"*64)
    def test_reject_wrong_digest_and_length(self):
        with self.assertRaises(ValueError):evaluate_provenance(GOOD,42,"b"*64)
        with self.assertRaises(ValueError):evaluate_provenance(GOOD,43,"a"*64)
    def test_reject_pre_epoch_snapshot(self):
        with self.assertRaises(ValueError):
            evaluate_provenance(dict(GOOD,history_through="2026-10-20T20:23:46Z"),42,"a"*64)
    def test_reject_naive_timestamp(self):
        with self.assertRaises(ValueError):
            evaluate_provenance(dict(GOOD,history_through="2026-10-21T00:00:00"),42,"a"*64)
    def test_no_receipt_no_certification(self):
        with self.assertRaises(ValueError):
            evaluate_provenance(dict(GOOD,independent_publication_receipt_sha256=""),42,"a"*64)
    def test_invalid_ids(self):
        for typ,id in (("relation",-1),("bad",5),("node","1"),("way",0),("relation",True),("node",False)):
            with self.subTest(typ=typ,id=id),self.assertRaises(ValueError):
                item_code(typ,id)

    def test_malformed_publication_receipt_is_not_an_identifier(self):
        for receipt in (None,"","not-a-digest","a"*63,"g"*64,True,{}):
            with self.subTest(receipt=receipt),self.assertRaises(ValueError):
                evaluate_provenance(dict(GOOD,independent_publication_receipt_sha256=receipt),42,"a"*64)

    def test_lengths_require_integers_not_boolean_or_float(self):
        for declared,actual in ((True,1),(42.0,42),(42,42.0),(1,True)):
            with self.subTest(declared=declared,actual=actual),self.assertRaises(ValueError):
                evaluate_provenance(dict(GOOD,source_bytes=declared),actual,"a"*64)

    def test_written_bytes_match_declared_digest_and_repeat_identically(self):
        with tempfile.TemporaryDirectory() as temporary:
            snapshots=[]
            for index in range(2):
                directory=pathlib.Path(temporary)/str(index)
                with patch.object(preflight,"OUTPUT",directory):preflight.execute(False)
                ids=(directory/"requested-object-ids.txt").read_bytes()
                raw_plan=(directory/"plan.json").read_bytes()
                metadata=json.loads(raw_plan)
                self.assertNotIn(b"\r",ids)
                self.assertNotIn(b"\r",raw_plan)
                self.assertEqual(hashlib.sha256(ids).hexdigest(),metadata["ids_sha256"])
                self.assertEqual(metadata["ids_sha256"],"1911a146e69d54c46a960a21fbbc85dd55398d700d9560f1f9e67436e36ec3ac")
                snapshots.append((ids,raw_plan))
            self.assertEqual(snapshots[0],snapshots[1])

if __name__=="__main__":
    unittest.main(verbosity=2)
