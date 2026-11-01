#!/usr/bin/env python3
"""Read-only bounded credential-signature inventory. Never emits matched values."""
import argparse
import datetime
import gzip
import hashlib
import io
import json
import pathlib
import re
import subprocess
import tarfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
RULES = {
    'private_key_pem': rb'-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----',
    'github_classic_token': rb'\bgh[pousr]_[A-Za-z0-9]{36,255}\b',
    'github_fine_grained_token': rb'\bgithub_pat_[A-Za-z0-9_]{50,255}\b',
    'aws_access_key_id': rb'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b',
    'google_api_key': rb'\bAIza[0-9A-Za-z_-]{35}\b',
    'slack_token': rb'\bxox[baprs]-[0-9A-Za-z-]{20,255}\b',
}
# These exact original blobs contain Anaconda/S3 signed-download URLs, expired
# on 2026-10-24. A changed receipt or another file is never acknowledged by name.
EXPIRED_RECEIPTS = {
    'docs/evidence/osm-acq2c-native-order-20261024/package-receipt.json': 'b41d9a585e40012162338e432c50b2788de407e7766a94de37a8a512deef1621',
    'docs/evidence/osm-acq2c-native-order-20261024/dependency-download-receipts.json': '7f8046f3fb60cca11ada53dc87a411460b5685fbea67dc8860b6ae3b899c3482',
}
MAX_EXPANDED = 64 * 1024 * 1024


def inspect_payload(path, body, observed):
    acknowledged = (hashlib.sha256(body).hexdigest() == EXPIRED_RECEIPTS.get(path)
                    and observed >= datetime.datetime(2026, 10, 25, tzinfo=datetime.timezone.utc))
    rows = []
    for rule, pattern in RULES.items():
        for match in re.finditer(pattern, body):
            rows.append(dict(path=path, line=body.count(b'\n', 0, match.start()) + 1,
                rule=rule, disposition='KNOWN_EXPIRED_THIRD_PARTY_SIGNED_DOWNLOAD_RECEIPT'
                if acknowledged and rule == 'aws_access_key_id' else 'REVIEW_REQUIRED'))
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ref', default='HEAD')
    parser.add_argument('--repository', type=pathlib.Path, default=ROOT)
    parser.add_argument('--out', type=pathlib.Path)
    parser.add_argument('--as-of', help='Timezone-aware ISO timestamp for replay of the temporal observation')
    args = parser.parse_args()
    root = args.repository.resolve()
    output = args.out or root / 'outputs/cleanup-final/security-signatures.json'
    observed = datetime.datetime.fromisoformat(args.as_of) if args.as_of else datetime.datetime.now(datetime.timezone.utc)
    if observed.tzinfo is None:
        parser.error('--as-of requires an explicit timezone')
    command = ['git', '-c', 'safe.directory=' + root.as_posix()]
    def git(*parts):
        return subprocess.check_output(command + list(parts), cwd=root)
    head = git('rev-parse', '--verify', args.ref + '^{commit}').decode().strip()
    rows = []
    for item in git('ls-tree', '-rlz', head).split(b'\0'):
        if item:
            meta, path = item.split(b'\t', 1)
            _, kind, oid, size = meta.decode().split()
            if kind == 'blob':
                rows.append((path.decode('utf8'), oid, int(size)))
    findings, limits, expanded = [], [], 0
    process = subprocess.Popen(command + ['cat-file', '--batch'], cwd=root, stdin=subprocess.PIPE, stdout=subprocess.PIPE)
    for path, oid, size in rows:
        process.stdin.write((oid + '\n').encode()); process.stdin.flush()
        header = process.stdout.readline().split()
        assert header[0].decode() == oid and header[1] == b'blob' and int(header[2]) == size
        body = process.stdout.read(size)
        assert len(body) == size and process.stdout.read(1) == b'\n'
        findings.extend(inspect_payload(path, body, observed))
        if path.endswith('.gz'):
            try:
                with gzip.GzipFile(fileobj=io.BytesIO(body)) as stream:
                    raw = stream.read(MAX_EXPANDED + 1)
                if len(raw) > MAX_EXPANDED:
                    limits.append(dict(path=path, reason='gzip exceeds 64 MiB expanded payload'))
                else:
                    findings.extend(inspect_payload(path + '::gzip', raw, observed)); expanded += len(raw)
            except (OSError, EOFError) as error:
                limits.append(dict(path=path, reason=type(error).__name__))
        if path.endswith('.tar'):
            with tarfile.open(fileobj=io.BytesIO(body), mode='r:') as archive:
                for member in archive:
                    if not member.isfile():
                        continue
                    if member.size > MAX_EXPANDED:
                        limits.append(dict(path=path + '::' + member.name, reason='tar member exceeds 64 MiB')); continue
                    raw = archive.extractfile(member).read()
                    findings.extend(inspect_payload(path + '::' + member.name, raw, observed)); expanded += len(raw)
    process.stdin.close()
    assert process.wait() == 0
    unknown = sum(row['disposition'] == 'REVIEW_REQUIRED' for row in findings)
    report = dict(schema='cleanup-security-signatures-v2', commit=head, observed_at=observed.isoformat(),
        tracked_blobs=len(rows), logical_bytes=sum(row[2] for row in rows), expanded_bytes_scanned=expanded,
        findings=findings, limits=limits, review_required=unknown, acknowledged_legacy_findings=len(findings)-unknown,
        values_printed=False, status='REVIEW_REQUIRED' if unknown or limits else 'NO_UNACKNOWLEDGED_SIGNATURES',
        limitations=['Signature scan is not proof that every possible secret, PII or vulnerability is absent',
                    'Gzip and tar payloads bounded to 64 MiB each; nested archives and binary/OCR content are not exhaustively interpreted',
                    'Acknowledgement requires the exact immutable receipt SHA-256 and expired timestamp; GitHub alerts remain explicitly open'])
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + '\n', encoding='utf8', newline='\n')
    print(json.dumps(report))
    return int(bool(unknown or limits))


if __name__ == '__main__':
    raise SystemExit(main())
