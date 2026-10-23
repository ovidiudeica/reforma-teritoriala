import unittest,tempfile,pathlib,json,hashlib,importlib.util
spec=importlib.util.spec_from_file_location('loader',pathlib.Path(__file__).with_name('osm_acq2c_selected_epoch_replay.py'));loader=importlib.util.module_from_spec(spec);spec.loader.exec_module(loader)
class Tests(unittest.TestCase):
    def fixture(self,root):
        raw=b'original\n';(root/'data.txt').write_bytes(raw)
        row=dict(name='data.txt',bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest())
        (root/'manifest-sha256.json').write_text(json.dumps(dict(files=[row])))
        return row
    def test_valid(self):
        with tempfile.TemporaryDirectory() as d:
            root=pathlib.Path(d);self.fixture(root);self.assertEqual(len(loader.verify_manifest(root)['files']),1)
    def test_corrupt(self):
        with tempfile.TemporaryDirectory() as d:
            root=pathlib.Path(d);self.fixture(root);(root/'data.txt').write_bytes(b'changed\n');self.assertRaises(ValueError,loader.verify_manifest,root)
    def test_unlisted(self):
        with tempfile.TemporaryDirectory() as d:
            root=pathlib.Path(d);self.fixture(root);(root/'extra.txt').write_bytes(b'extra');self.assertRaises(ValueError,loader.verify_manifest,root)
    def test_duplicate(self):
        with tempfile.TemporaryDirectory() as d:
            root=pathlib.Path(d);row=self.fixture(root);(root/'manifest-sha256.json').write_text(json.dumps(dict(files=[row,row])));self.assertRaises(ValueError,loader.verify_manifest,root)
    def test_unsafe_parent(self):
        with tempfile.TemporaryDirectory() as d:
            root=pathlib.Path(d);row=self.fixture(root);row['name']='..';(root/'manifest-sha256.json').write_text(json.dumps(dict(files=[row])));self.assertRaises(ValueError,loader.verify_manifest,root)
    def test_missing_manifest(self):
        with tempfile.TemporaryDirectory() as d:self.assertRaises(FileNotFoundError,loader.verify_manifest,pathlib.Path(d))
if __name__=='__main__':unittest.main()
