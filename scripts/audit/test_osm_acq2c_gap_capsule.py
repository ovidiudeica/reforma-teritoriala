"""Adversarial changes to real frozen evidence, including re-signed test manifests."""
import pathlib,tempfile,unittest,json,gzip,hashlib
from verify_osm_acq2c_gap_state import verify

ROOT=pathlib.Path(__file__).resolve().parents[2]/'docs/evidence/osm-acq2c-gap-state-20261023'
class Tests(unittest.TestCase):
    def reject(self,mutation):
        with tempfile.TemporaryDirectory() as t:
            root=pathlib.Path(t)
            report=json.loads((ROOT/'report.json').read_bytes())
            capsule=json.loads(gzip.decompress((ROOT/'capsule.json.gz').read_bytes()))
            mutation(report,capsule)
            raw=(json.dumps(report,sort_keys=True,indent=2)+'\n').encode()
            capsule['report_sha256']=hashlib.sha256(raw).hexdigest()
            (root/'report.json').write_bytes(raw)
            (root/'capsule.json.gz').write_bytes(gzip.compress(json.dumps(capsule).encode(),mtime=0))
            (root/'manifest-sha256.json').write_bytes(json.dumps({'files':[dict(name=p.name,bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in sorted(root.iterdir())]}).encode())
            self.assertRaises(ValueError,verify,root)
    def test_missing_all_payload_fingerprints(self):
        def mutate(r,c):
            for name in ('histories','targets','current'):
                for value in c[name].values():
                    for row in value if name=='histories' else [value]:row.pop('payload_sha256')
        self.reject(mutate)
    def test_raw_contributor_attribute_rejected(self):
        self.reject(lambda r,c:next(iter(c['current'].values())).update(user='must-not-be-exported'))
    def test_changed_payload_same_version(self):
        self.reject(lambda r,c:next(iter(c['current'].values())).update(payload_sha256='0'*64))
    def test_source_admission_flip(self):self.reject(lambda r,c:r.update(source_qualified=True))
    def test_human_review_cannot_be_self_approved(self):self.reject(lambda r,c:r.update(independent_human_or_signed_validation_pending=False))
    def test_missing_current_identity(self):self.reject(lambda r,c:c['current'].pop(next(iter(c['current']))))
    def test_duplicate_report_identity(self):self.reject(lambda r,c:r['rows'].append(r['rows'][0]))
    def test_forged_gap_range(self):self.reject(lambda r,c:r['rows'][0]['gaps'][0].update(last_missing=999999))
    def test_wrong_frozen_epoch(self):
        def mutate(r,c):r['epoch']=c['epoch']='2026-10-21T20:23:47Z'
        self.reject(mutate)
if __name__=='__main__':unittest.main()
