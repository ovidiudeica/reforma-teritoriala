"""Portable path attacks and real Linux symlink isolation, without skipped cases."""
import hashlib,json,os,pathlib,tempfile,unittest
from unittest import mock
import osm_acq2c_selected_epoch_replay as reader
import verify_osm_acq2c_gap_state as gap_cli
import verify_osm_acq2c_numeric_certificate as numeric_cli

class Tests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.base=pathlib.Path(self.tmp.name);self.root=self.base/'packet';self.root.mkdir()
        self.raw=b'fixture-data\n';(self.root/'data.txt').write_bytes(self.raw)
        self.row=dict(name='data.txt',bytes=len(self.raw),sha256=hashlib.sha256(self.raw).hexdigest())
        self.emit()
    def emit(self):
        (self.root/'manifest-sha256.json').write_text(json.dumps({'files':[self.row]}))
    def test_safe_existing_packet(self):self.assertEqual(len(reader.verify_manifest(self.root)['files']),1)
    def test_portable_escapes_devices_and_streams(self):
        for name in ('../data.txt','/etc/passwd','..\\secret','C:\\secret','C:secret','data.txt:stream','NUL','COM1.txt','data.txt.','data.txt ','bad\0name'):
            with self.subTest(name=name):
                self.row['name']=name;self.emit();self.assertRaises(ValueError,reader.verify_manifest,self.root)
    def test_duplicate_json_keys(self):
        (self.root/'manifest-sha256.json').write_text('{"files":[],"files":[]}')
        self.assertRaises(ValueError,reader.verify_manifest,self.root)
    def test_boolean_length_rejected(self):
        (self.root/'data.txt').write_bytes(b'x');self.row.update(bytes=True,sha256=hashlib.sha256(b'x').hexdigest());self.emit()
        self.assertRaises(ValueError,reader.verify_manifest,self.root)
    def test_symlink_member_never_opened(self):
        outside=self.base/'outside.txt';outside.write_bytes(self.raw)
        link=self.root/'data.txt';link.unlink()
        try:link.symlink_to(outside)
        except OSError:
            if os.name!='nt':raise
            # Restricted Windows hosts exercise the same entry-rejection branch;
            # the Ubuntu CI run creates and rejects the actual escaping symlink.
            link.write_bytes(self.raw);original=pathlib.Path.is_symlink
            with mock.patch.object(pathlib.Path,'is_symlink',lambda p:p==link or original(p)):
                with mock.patch.object(reader,'file_sha',side_effect=AssertionError('Forbidden read')):
                    self.assertRaises(ValueError,reader.verify_manifest,self.root)
        else:
            with mock.patch.object(reader,'file_sha',side_effect=AssertionError('Forbidden read')):
                self.assertRaises(ValueError,reader.verify_manifest,self.root)
    def test_symlink_manifest_never_opened(self):
        original=pathlib.Path.is_symlink;manifest=self.root/'manifest-sha256.json'
        with mock.patch.object(pathlib.Path,'is_symlink',lambda p:p==manifest or original(p)):
            self.assertRaises(ValueError,reader.verify_manifest,self.root)
    def test_symlink_root_never_opened(self):
        original=pathlib.Path.is_symlink
        with mock.patch.object(pathlib.Path,'is_symlink',lambda p:p==self.root or original(p)):
            self.assertRaises(ValueError,reader.verify_manifest,self.root)
    def test_cli_rejects_foreign_and_prefix_sibling_roots(self):
        for cli in (gap_cli,numeric_cli):
            for root in (self.root,cli.FIXED_DIRECTORY.parent/(cli.FIXED_DIRECTORY.name+'-other')):
                with self.subTest(cli=cli.__name__,root=str(root)):
                    self.assertRaises(ValueError,cli.approved_directory,str(root))
    def test_cli_raw_text_never_reaches_path_resolution(self):
        for cli in (gap_cli,numeric_cli):
            for text in ('../outside','C:\\outside','file:///etc/passwd','bad\0name',str(cli.FIXED_DIRECTORY)+'/../'+cli.FIXED_DIRECTORY.name):
                with self.subTest(cli=cli.__name__,text=text):
                    with mock.patch.object(pathlib.Path,'resolve',side_effect=AssertionError('Untrusted path interpretation')):
                        self.assertRaises(ValueError,cli.approved_directory,text)
    def test_cli_relative_documented_packet(self):
        for cli in (gap_cli,numeric_cli):self.assertEqual(cli.approved_directory(cli.FIXED_DIRECTORY.relative_to(cli.REPOSITORY).as_posix()),cli.FIXED_DIRECTORY)
    def test_cli_accepts_declared_frozen_packets(self):
        for cli in (gap_cli,numeric_cli):self.assertEqual(cli.approved_directory(str(cli.FIXED_DIRECTORY)),cli.FIXED_DIRECTORY)
if __name__=='__main__':unittest.main()
