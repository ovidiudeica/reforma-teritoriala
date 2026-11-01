"""Credential redaction and exact-blob acknowledgement regressions."""
import datetime
import importlib.util
import json
import pathlib
import sys
import unittest

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('signatures', pathlib.Path(__file__).with_name('cleanup-security-signatures.py'))
signatures = importlib.util.module_from_spec(spec)
spec.loader.exec_module(signatures)


class SignatureTests(unittest.TestCase):
    def test_new_identifier_in_old_receipt_path_requires_review_and_is_redacted(self):
        value = b'ASIA' + b'A' * 16
        path = next(iter(signatures.EXPIRED_RECEIPTS))
        result = signatures.inspect_payload(path, b'header\n' + value + b'\n', datetime.datetime(2026, 11, 1, tzinfo=datetime.timezone.utc))
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['line'], 2)
        self.assertEqual(result[0]['disposition'], 'REVIEW_REQUIRED')
        self.assertEqual(set(result[0]), {'path', 'line', 'rule', 'disposition'})
        self.assertTrue(value not in json.dumps(result).encode(), 'redaction invariant failed')

    def test_private_key_header_is_reported_without_copying_payload(self):
        header = b'-' * 5 + b'BEGIN ' + b'PRIVATE KEY' + b'-' * 5
        result = signatures.inspect_payload('new.txt', header + b'\nfixture\n', datetime.datetime(2026, 11, 1, tzinfo=datetime.timezone.utc))
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['rule'], 'private_key_pem')
        self.assertTrue(header not in json.dumps(result).encode(), 'redaction invariant failed')


if __name__ == '__main__':
    unittest.main()
