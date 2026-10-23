"""Replay gap arithmetic from sparse public projections, never source admission."""
import argparse,collections,hashlib,json,pathlib
from osm_acq2c_gap_state import inspect_gap,instant
from osm_acq2c_selected_epoch_replay import verify_manifest
from verify_osm_acq2c_numeric_certificate import strict_json,packed_json

def verify(root):
    verify_manifest(root)
    raw=(root/'report.json').read_bytes()
    report=strict_json(raw);capsule=packed_json(root/'capsule.json.gz')
    if hashlib.sha256(raw).hexdigest()!=capsule['report_sha256']:raise ValueError('Gap report binding differs')
    if instant(capsule['epoch'])!=instant(report['epoch']) or instant(capsule['epoch'])!=instant('2026-10-20T20:23:47Z') or report['source_qualified'] is not False or capsule['source_qualified'] is not False or report['history_gaps_resolved']!=0 or report['independent_human_or_signed_validation_pending'] is not True or capsule['private_payloads_uploaded'] is not False:raise ValueError('Gap admission scope changed')
    rows=report['rows'];codes=[r['code'] for r in rows]
    if len(codes)!=102 or codes!=sorted(set(codes)):raise ValueError('Distinct gap inventory differs')
    for name in ('histories','targets','current'):
        if set(capsule[name])!=set(codes):raise ValueError('Incomplete gap capsule')
        for code,value in capsule[name].items():
            projections=value if name=='histories' else [value]
            for projection in projections:
                if set(projection)!={'code','version','timestamp','visible','payload_sha256'} or projection['code']!=code or type(projection['visible']) is not bool:raise ValueError('Incomplete or non-sparse payload projection')
    counts=collections.Counter();missing=0
    for row in rows:
        code=row['code'];replayed=inspect_gap(code,capsule['histories'][code],capsule['targets'][code],capsule['current'][code],capsule['epoch'])
        if replayed!={k:v for k,v in row.items() if k!='missing_version_access'}:raise ValueError('Per-object gap replay differs: '+code)
        if replayed['history_gaps_resolved']!=0 or replayed['source_qualified'] is not False:raise ValueError('A gap was admitted without evidence')
        missing+=replayed['missing_observed_versions'];counts[replayed['current_observation']]+=1
    if dict(counts)!=report['counts'] or missing!=report['missing_observed_versions']:raise ValueError('Gap totals differ')
    return dict(status='OBSERVED_GAP_STATE_REPLAY_VERIFIED_NOT_CONTINUITY_ADMISSION',objects=len(codes),counts=dict(counts),missing_observed_versions=missing,history_gaps_resolved=0,source_qualified=False)

REPOSITORY=pathlib.Path(__file__).resolve().parents[2]
FIXED_DIRECTORY=REPOSITORY/'docs/evidence/osm-acq2c-gap-state-20261023'
def approved_directory(raw):
    # A frozen-proof CLI cannot grant arbitrary filesystem-read authority.
    for part in (REPOSITORY/'docs',REPOSITORY/'docs/evidence',FIXED_DIRECTORY):
        if part.is_symlink():raise ValueError('Symlink proof directory is forbidden')
    # Never interpret untrusted CLI text as a filesystem path, even for validation.
    allowed={str(FIXED_DIRECTORY),FIXED_DIRECTORY.as_posix(),FIXED_DIRECTORY.relative_to(REPOSITORY).as_posix()}
    if not isinstance(raw,str) or raw not in allowed:raise ValueError('CLI accepts only the declared repository proof packet')
    return FIXED_DIRECTORY

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--directory',required=True)
    print(json.dumps(verify(approved_directory(p.parse_args().directory)),sort_keys=True))
