"""OSM-ACQ.2c: exhaustive UNKNOWN ledger and rate-limited *first* history batch.
Never classifies relation spatial membership or promotes the OSM source.
"""
import datetime as dt
import gzip
import hashlib
import json
import pathlib
import time
import urllib.error
import xml.etree.ElementTree as ET
from osm_acq2c_priority import dep, fetch, sha, verify_history

ROOT = pathlib.Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/evidence/osm-acq2b-way-history-20261022/combined-registry.json.gz'
SOURCE_SHA256 = 'f893c3ba01fc870be5dfedb72381d47367ae4cdcacd0093fd56270a547bc36dd'
PRIORITY = (72526, 72634, 11821462, 11905201)
# Exactly these eight objects have already been captured in the pinned #408 pilot;
# do not recapture, and DO NOT assume their proofs resolve a relation.
PILOT_OBJECTS = frozenset({('way', i) for i in (
    128978166, 128978198, 30546198, 30546444,
    4528082, 130189957, 128978182, 128978202
)})
PILOT_ARTIFACT_ID = 12428136987
PILOT_ZIP_SHA256 = '8868e615925ee21ddd2d26272e91c53b5078da050b36205164e0e358f99f1ebe'
EPOCH = '2026-10-20T20:23:47Z'
OUTPUT = ROOT / 'outputs' / 'osm-acq2c-full-batch01'
MAX_BATCH = 64

def plan_registry(registry, strict=True):
    rows = registry['rows']
    ids = [r['id'] for r in rows]
    if len(set(ids)) != len(ids):
        raise ValueError('Duplicate frozen candidate relation ID')
    unknown = [r for r in rows if r['resolved'] is False]
    if strict and (len(rows), len(unknown), sum(len(r['domains']) for r in unknown)) != (391, 242, 244):
        raise ValueError('Pinned corpus cardinality drift')
    by_id = {r['id']: r for r in unknown}
    if strict and any(i not in by_id for i in PRIORITY):
        raise ValueError('Missing required priority ID')
    ordered = [by_id[i] for i in PRIORITY if i in by_id]
    ordered += sorted((r for r in unknown if r['id'] not in PRIORITY),
                      key=lambda r:r['id'])
    uses = {}
    coverage = {}
    for row in ordered:
        missing = set()
        for domain in row['domains']:
            if domain['domain'] not in ('RO','MD'):
                raise ValueError('Unexpected frozen domain')
            for item in domain['missing_after']:
                missing.add(dep(item))
        coverage[row['id']] = {'domains': sorted(d['domain'] for d in row['domains']),
                               'missing_direct': len(missing)}
        for key in sorted(missing, key=lambda p:(p[0] != 'way',p[1])):
            uses.setdefault(key,set()).add(row['id'])
    priority_set = set(PRIORITY)
    def ranking(key):
        linked=uses[key]
        return (0 if linked & priority_set else 1,
                0 if key[0]=='way' else 1,
                -len(linked),key[1])
    all_keys = sorted(uses,key=ranking)
    pending = [k for k in all_keys if k not in PILOT_OBJECTS]
    return {
        'initial_distinct': len(rows), 'unknown_distinct': len(unknown),
        'unknown_domain_rows': sum(len(r['domains']) for r in unknown),
        'relations': coverage, 'total_unique_missing_objects': len(all_keys),
        'already_piloted': [list(k) for k in all_keys if k in PILOT_OBJECTS],
        'remaining_missing_objects': len(pending),
        'ordered': [{'type':k[0],'id':k[1],
                     'needed_by': sorted(uses[k])} for k in pending],
    }

def source_registry():
    raw = SOURCE.read_bytes()
    if sha(raw) != SOURCE_SHA256:
        raise ValueError('Frozen cumulative gzip SHA-256 mismatch')
    return json.loads(gzip.decompress(raw))

def emit(path, obj, ledger):
    content = (json.dumps(obj,sort_keys=True,indent=2,ensure_ascii=False)+'\n').encode('utf8')
    (OUTPUT/path).write_bytes(content)
    ledger.append({'name':path, 'bytes':len(content), 'sha256':sha(content)})

def run():
    plan=plan_registry(source_registry())
    if OUTPUT.exists():
        raise FileExistsError('Refusing to overwrite immutable audit batch')
    OUTPUT.mkdir(parents=True)
    manifest=[]
    summary={k:v for k,v in plan.items() if k not in ('ordered','relations')}
    emit('inventory.json',{'epoch':EPOCH,'source_gzip_sha256':SOURCE_SHA256,
        'priority_ids':list(PRIORITY),
        'prior_pilot_artifact_id':PILOT_ARTIFACT_ID,
        'prior_pilot_zip_sha256':PILOT_ZIP_SHA256,
        'source_promoted':False,'spatial_equivalence_certified':False,
        'coverage':plan['relations'],'summary':summary,
        'pending':plan['ordered']},manifest)
    captured=[]
    for index, item in enumerate(plan['ordered'][:MAX_BATCH]):
        original={};receipts={};error=None
        for mode, suffix in (('history','/history'),('current','')):
            time.sleep(1.0)
            try:
                raw, receipt=fetch(f"{item['type']}/{item['id']}{suffix}")
                filename=f'object-{index:02d}-{mode}.xml'
                (OUTPUT/filename).write_bytes(raw)
                manifest.append({'name':filename,'bytes':len(raw),'sha256':sha(raw)})
                original[mode]=raw
                receipts[mode]={**receipt,'file':filename}
            except (urllib.error.URLError,TimeoutError,ValueError,ET.ParseError) as e:
                error=f'{type(e).__name__}: {e}'
                receipts[mode]={'error':error}
                break
        verdict='RETRIEVAL_INCOMPLETE'
        proof=None
        if error is None:
            try:
                proof=verify_history(original['history'],original['current'],
                                     item['type'],item['id'])
                verdict='HISTORICAL_VERSION_PROVEN'
            except (ValueError,ET.ParseError) as e:
                verdict='HISTORY_REJECTED'
                proof={'error':str(e)}
        captured.append({'target':item,'verdict':verdict,
                         'proof':proof,'receipts':receipts})
    emit('capture.json',{'epoch':EPOCH,'source_gzip_sha256':SOURCE_SHA256,
        'prior_pilot_zip_sha256':PILOT_ZIP_SHA256,
        'planned_unique_missing_objects':plan['total_unique_missing_objects'],
        'remaining_after_prior_pilot':plan['remaining_missing_objects'],
        'batch_size':len(captured),'rows':captured,
        'new_relation_verdicts':0,'source_promoted':False,
        'spatial_equivalence_certified':False},manifest)
    (OUTPUT/'manifest-sha256.json').write_text(
        json.dumps({'files':sorted(manifest,key=lambda r:r['name'])},sort_keys=True,indent=2)+'\n',
        encoding='utf8')
    print(json.dumps({'initial_unknown_distinct':plan['unknown_distinct'],
        'remaining_missing_objects':plan['remaining_missing_objects'],
        'captured':len(captured),
        'historical_proven':sum(x['verdict']=='HISTORICAL_VERSION_PROVEN' for x in captured),
        'incomplete':sum(x['verdict']=='RETRIEVAL_INCOMPLETE' for x in captured),
        'rejected':sum(x['verdict']=='HISTORY_REJECTED' for x in captured),
        'new_relation_verdicts':0},sort_keys=True))
    if any(x['verdict'] != 'HISTORICAL_VERSION_PROVEN' for x in captured):
        raise SystemExit('FAIL CLOSED: incomplete or rejected historical captures; consult original XML artifact')

if __name__=='__main__':
    run()
