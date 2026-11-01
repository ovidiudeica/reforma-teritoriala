#!/usr/bin/env python3
"""Conservative, reproducible usage register from canonical Git blobs. Never deletes.

Static edges, directory/glob possibilities and unresolved dynamic readers are kept
separate. A missing edge is never a proof of dead code. Python 3 stdlib only.
"""
import argparse
import ast
import collections
import csv
import fnmatch
import hashlib
import json
import pathlib
import posixpath
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[2]
GIT = ['git', '-c', 'safe.directory=' + ROOT.as_posix()]
LABELS = ('KEEP_RUNTIME', 'KEEP_SOURCE', 'KEEP_EVIDENCE', 'KEEP_CI',
          'KEEP_DOCUMENTATION', 'KEEP_FUTURE_MODULE', 'REFACTOR_CANDIDATE',
          'ARCHIVE_CANDIDATE', 'SAFE_TO_DELETE', 'UNRESOLVED')
TEXT = {'.mjs', '.js', '.cjs', '.json', '.html', '.css', '.md', '.yml', '.yaml',
        '.py', '.sh', '.txt', '.csv', '.toml', '.xml', '.svg', '.gitignore', '.gitattributes'}


def git(*args):
    return subprocess.check_output(GIT + list(args), cwd=ROOT)


def snapshot(ref):
    rows, bodies = [], {}
    for item in git('ls-tree', '-rlz', ref).split(b'\0'):
        if not item:
            continue
        meta, path = item.split(b'\t', 1)
        mode, kind, oid, size = meta.decode().split()
        if kind == 'blob':
            rows.append(dict(path=path.decode('utf8'), mode=mode,
                             git_blob_sha=oid, bytes=int(size)))
    process = subprocess.Popen(GIT + ['cat-file', '--batch'], cwd=ROOT,
                               stdin=subprocess.PIPE, stdout=subprocess.PIPE)
    hashes = {}
    for row in rows:
        oid = row['git_blob_sha']
        if oid not in hashes:
            process.stdin.write((oid + '\n').encode()); process.stdin.flush()
            header = process.stdout.readline().split()
            assert header[0].decode() == oid and header[1] == b'blob'
            body = process.stdout.read(int(header[2]))
            assert len(body) == int(header[2]) and process.stdout.read(1) == b'\n'
            hashes[oid] = hashlib.sha256(body).hexdigest()
            p = pathlib.PurePosixPath(row['path'])
            if p.suffix.lower() in TEXT or p.name in {'.gitignore', '.gitattributes', 'LICENSE'}:
                try:
                    bodies[oid] = body.decode('utf8') if b'\0' not in body else None
                except UnicodeError:
                    bodies[oid] = None
        row['sha256'] = hashes[oid]
    process.stdin.close()
    assert process.wait() == 0
    return rows, {r['path']: bodies[r['git_blob_sha']] for r in rows
                  if bodies.get(r['git_blob_sha']) is not None}


def graph(rows, texts):
    names = {r['path'] for r in rows}
    directories = collections.defaultdict(set)
    for path in names:
        parent = posixpath.dirname(path)
        while parent:
            directories[parent].add(path)
            parent = posixpath.dirname(parent)
    edges, unresolved = set(), []
    path_tokens = re.compile(r'(?:\.{1,2}/|/?[A-Za-z0-9_.-]+/)[A-Za-z0-9_./*?{}@+%=:~-]+|\b[A-Za-z0-9_.-]+\.(?:mjs|cjs|js|json|geojson|py|sh|css|html|yml|yaml|png|jpe?g|svg|webp|ico|woff2?|ttf|tar|gz)\b')
    quotes = re.compile(r'''["'`]([^"'`\r\n]{1,1200})["'`]''')
    imports = re.compile(r'''(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)["']([^"']+)["']''')

    def resolve(source, token, kind):
        token = token.split('#', 1)[0].split('?', 1)[0] if not any(c in token for c in '*{') else token
        if not token or re.match(r'^[a-zA-Z]+:', token):
            return
        parent = posixpath.dirname(source)
        relative = posixpath.normpath(posixpath.join(parent, token))
        candidates = [relative, token.removeprefix('/')]
        if token.startswith('/'):
            candidates += ['public/' + token.lstrip('/')]
        if kind == 'MODULE_IMPORT':
            candidates += [p + ext for p in candidates[:] for ext in ('.js', '.mjs', '.json', '/index.js')]
        for target in dict.fromkeys(candidates):
            if target in names and target != source:
                edges.add((source, target, kind))
            elif target.rstrip('/') in directories:
                for child in directories[target.rstrip('/')]:
                    if child != source:
                        edges.add((source, child, 'POSSIBLE_DIRECTORY:' + kind))
            elif any(c in target for c in '*?['):
                for child in names:
                    if fnmatch.fnmatchcase(child, target) and child != source:
                        edges.add((source, child, 'POSSIBLE_GLOB:' + kind))

    for source, text in texts.items():
        historical = source.startswith('docs/audits/') and source.endswith(('.csv', '.json'))
        kind = 'HISTORICAL_INVENTORY' if historical else ('DOCUMENT_OR_MANIFEST' if source.endswith(('.md', '.json', '.csv')) else 'LITERAL_REFERENCE')
        for token in path_tokens.findall(text):
            resolve(source, token.rstrip('.,:;'), kind)
        for token in quotes.findall(text):
            if '/' in token or '.' in token:
                resolve(source, token, kind)
        if source.endswith(('.js', '.mjs', '.cjs')):
            for token in imports.findall(text):
                if token.startswith(('.', '/')):
                    resolve(source, token, 'MODULE_IMPORT')
        if source.endswith('.py'):
            try:
                for node in ast.walk(ast.parse(text)):
                    modules = [a.name for a in node.names] if isinstance(node, ast.Import) else ([node.module] if node.module else [a.name for a in node.names]) if isinstance(node, ast.ImportFrom) else []
                    for module in modules:
                        prefix = '../' * max(0, node.level - 1) if isinstance(node, ast.ImportFrom) else ''
                        resolve(source, prefix + module.replace('.', '/') + '.py', 'PYTHON_MODULE')
            except SyntaxError as error:
                unresolved.append(dict(source=source, kind='PYTHON_PARSE', line=error.lineno))
        if source.endswith(('.js', '.mjs', '.cjs', '.py', '.sh', '.yml', '.yaml')):
            # List readers that need human reasoning. Literal-prefix edges above
            # are possibilities, not guarantees; eval/environment/network and
            # command substitutions cannot be soundly resolved statically.
            for line, value in enumerate(text.splitlines(), 1):
                if re.search(r'\b(readFile|readFileSync|readdir|glob|fetch|open|importlib|eval)\s*\(', value) or '${' in value or '$(' in value:
                    unresolved.append(dict(source=source, kind='DYNAMIC_READER_OR_INTERPOLATION', line=line))
    return sorted(edges), unresolved


def classify(path):
    if path.startswith(('data/historical/', 'data/proposals/')):
        return 'KEEP_FUTURE_MODULE', 'Reserved corpus; not published or authorized for import'
    if path.startswith(('docs/audits/', 'docs/evidence/')):
        return 'KEEP_EVIDENCE', 'Historical audit/source/proof; paths retained for reproduction'
    if path.startswith(('public/', 'views/', 'vendor/')) or re.fullmatch(r'[^/]+\.(?:mjs|js|css|html)', path):
        return 'KEEP_RUNTIME', 'Public runtime, view contract or offline dependency; immutable baseline guard applies'
    if path.startswith(('data/', 'schemas/')) or path in ('package.json', 'package-lock.json'):
        return 'KEEP_SOURCE', 'Canonical source/build contract; no cleanup writes authorized'
    if path.startswith(('.github/', 'scripts/test/', 'tools/p2/')):
        return 'KEEP_CI', 'CI, regression or explicitly retained GitHub configuration'
    if path.startswith(('scripts/', 'tools/', 'container/')):
        return 'KEEP_SOURCE', 'Build/import/audit/manual reproduction entry point; execution requires its own policy'
    if path.startswith('prototypes/'):
        return 'ARCHIVE_CANDIDATE', 'Retain in place; prototype has relative assets and potential design provenance'
    if path.startswith('docs/') or path.endswith('.md') or path in ('LICENSE', '.gitignore', '.gitattributes'):
        return 'KEEP_DOCUMENTATION', 'Documentation, licensing or implicit repository configuration'
    return 'UNRESOLVED', 'Retain; role needs evidence before any deletion decision'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ref', default='HEAD')
    parser.add_argument('--out', type=pathlib.Path, default=ROOT / 'outputs/cleanup-final/usage')
    parser.add_argument('--baseline', type=pathlib.Path, help='Canonical protected-file JSON; exits nonzero on any missing/changed blob')
    parser.add_argument('--json-line-endings', choices=('lf', 'legacy-crlf'), default='lf',
                        help='LF is portable; legacy-crlf replays the original Windows evidence without changing it')
    args = parser.parse_args()
    json_newline = '\r\n' if args.json_line_endings == 'legacy-crlf' else '\n'
    ref = git('rev-parse', args.ref + '^{commit}').decode().strip()
    rows, texts = snapshot(ref)
    edges, unresolved = graph(rows, texts)
    incoming, outgoing = collections.defaultdict(list), collections.defaultdict(list)
    for source, target, kind in edges:
        incoming[target].append((source, kind))
        outgoing[source].append((target, kind))
    # Reachability witnesses are operational roots, not arbitrary historical docs.
    roots = sorted(p for p in texts if p == 'index.html' or p == 'package.json' or p.startswith('.github/workflows/'))
    witness = {p: p for p in roots}
    queue = collections.deque(roots)
    while queue:
        source = queue.popleft()
        for target, kind in outgoing[source]:
            if target not in witness and kind != 'HISTORICAL_INVENTORY':
                witness[target] = witness[source]
                queue.append(target)
    register = []
    for row in rows:
        path = row['path']; label, role = classify(path)
        refs = incoming[path]
        register.append({**row, 'classification': label, 'known_role': role,
            'direct_reference_count': sum(not k.startswith('POSSIBLE_') and k != 'HISTORICAL_INVENTORY' for _, k in refs),
            'historical_inventory_count': sum(k == 'HISTORICAL_INVENTORY' for _, k in refs),
            'possible_dynamic_reference_count': sum(k.startswith('POSSIBLE_') for _, k in refs),
            'indirect_operational_reachability': witness.get(path, 'not established; retain'),
            'evidence_required': label == 'KEEP_EVIDENCE' or path.startswith('data/'),
            'regenerable': 'not a deletion justification; consult producer and source bundle',
            'delete_decision': 'RETAIN', 'proof_test': 'canonical Git blob/SHA-256 equality; relevant CI; no deletion authorized by graph'})
    failures = []
    by_path = {r['path']: r for r in rows}
    if args.baseline:
        for row in json.loads(args.baseline.read_text(encoding='utf8')):
            actual = by_path.get(row['path'])
            if actual is None or any(actual[k] != row[k] for k in ('git_blob_sha', 'sha256', 'bytes')):
                failures.append(row['path'])
    summary = dict(schema='cleanup-file-usage-v1', commit=ref, tracked_files=len(rows),
        logical_tree_bytes=sum(r['bytes'] for r in rows), text_sources=len(texts), edges=len(edges),
        classifications=dict(collections.Counter(r['classification'] for r in register)),
        allowed_classifications=LABELS, protected_failures=failures, unresolved_reader_locations=len(unresolved),
        limitations=['Static graph records literal imports, relative paths, manifests, shell/YAML paths, Python modules, directory/glob possibilities and operational reachability.',
                     'Environment, computed strings, network responses and external consumers cannot be exhaustively proven by static analysis. Listed dynamic readers require retention.',
                     'No absence of references permits deletion; historical inventories are separate from executable consumers.',
                     'All blobs are hashed, including binary/large/compressed blobs. Binary contents are not executed or interpreted.'])
    args.out.mkdir(parents=True, exist_ok=True)
    for name, value in [('summary.json', summary), ('dynamic-readers.json', unresolved)]:
        (args.out / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf8', newline=json_newline)
    for name, fields, values in [('per-file.csv', list(register[0]), register),
                                 ('dependencies.csv', ['source', 'target', 'kind'], [dict(zip(('source', 'target', 'kind'), e)) for e in edges])]:
        with (args.out / name).open('w', newline='', encoding='utf8') as handle:
            writer = csv.DictWriter(handle, fieldnames=fields, lineterminator='\n'); writer.writeheader(); writer.writerows(values)
    products = sorted(p for p in args.out.iterdir() if p.name in {'summary.json', 'dynamic-readers.json', 'per-file.csv', 'dependencies.csv'})
    (args.out / 'SHA256SUMS').write_text(''.join(hashlib.sha256(p.read_bytes()).hexdigest() + '  ' + p.name + '\n' for p in products), encoding='ascii', newline=json_newline)
    print(json.dumps(summary, ensure_ascii=False))
    return int(bool(failures))


if __name__ == '__main__':
    raise SystemExit(main())
