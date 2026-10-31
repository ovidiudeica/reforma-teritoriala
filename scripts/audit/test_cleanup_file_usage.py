"""Regression fixtures for references missed by the original substring audit."""
import importlib.util
import pathlib
import sys
import unittest

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('usage', pathlib.Path(__file__).with_name('cleanup-file-usage.py'))
usage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(usage)


class UsageTests(unittest.TestCase):
    def test_relative_assets_dynamic_import_manifest_and_glob(self):
        texts = {
            'prototypes/example/index.html': '<script src="./app.js"></script><link href="theme.css">',
            'prototypes/example/app.js': 'import("../../shared/helper.mjs"); fetch(computedPath);',
            'prototypes/example/theme.css': 'body {background:url(icon.svg)}',
            '.github/workflows/qa.yml': 'run: node --test scripts/test/*.test.mjs',
            'data/manifest.json': '{"path":"shared/helper.mjs"}',
            'docs/audits/old/per-file.csv': 'path\nshared/helper.mjs\n',
        }
        names = set(texts) | {'prototypes/example/icon.svg', 'shared/helper.mjs', 'scripts/test/one.test.mjs'}
        edges, dynamic = usage.graph([dict(path=p) for p in names], texts)
        self.assertIn(('prototypes/example/index.html', 'prototypes/example/app.js', 'LITERAL_REFERENCE'), edges)
        self.assertIn(('prototypes/example/index.html', 'prototypes/example/theme.css', 'LITERAL_REFERENCE'), edges)
        self.assertIn(('prototypes/example/theme.css', 'prototypes/example/icon.svg', 'LITERAL_REFERENCE'), edges)
        self.assertIn(('prototypes/example/app.js', 'shared/helper.mjs', 'MODULE_IMPORT'), edges)
        self.assertIn(('data/manifest.json', 'shared/helper.mjs', 'DOCUMENT_OR_MANIFEST'), edges)
        self.assertIn(('docs/audits/old/per-file.csv', 'shared/helper.mjs', 'HISTORICAL_INVENTORY'), edges)
        self.assertTrue(any(s == '.github/workflows/qa.yml' and t == 'scripts/test/one.test.mjs' and k.startswith('POSSIBLE_GLOB:') for s, t, k in edges))
        self.assertTrue(any(r['source'] == 'prototypes/example/app.js' for r in dynamic))

    def test_no_reference_never_means_delete(self):
        for path in ('scripts/process/.gitkeep', 'data/historical/.gitkeep', 'schemas/entities.schema.json', 'mystery.bin'):
            label, _ = usage.classify(path)
            self.assertNotEqual(label, 'SAFE_TO_DELETE')
        self.assertEqual(usage.classify('data/proposals/.gitkeep')[0], 'KEEP_FUTURE_MODULE')
        self.assertEqual(usage.classify('schemas/entities.schema.json')[0], 'KEEP_SOURCE')

    def test_external_urls_not_local_dependencies(self):
        edges, _ = usage.graph([dict(path='app.js'), dict(path='other.js')], {'app.js': 'import("https://example.invalid/other.js")'})
        self.assertEqual(edges, [])


if __name__ == '__main__':
    unittest.main()
