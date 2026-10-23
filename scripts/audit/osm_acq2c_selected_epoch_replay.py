"""Bounded local wait, then selected base/tail reconciliation; never promotion."""
import sys,pathlib,json,hashlib,time,datetime
ROOT=pathlib.Path(__file__).resolve().parents[2];WORK=ROOT.parent;REPO=ROOT;BULK=WORK/'osm-acq2c-bulk'
sys.path.insert(0,str(REPO/'scripts'/'audit'))
from osm_acq2c_bulk_preflight import plan
from osm_acq2c_replication_chain import audit,extract_versions
from osm_acq2c_selected_epoch_core import reconcile,validate_epochs
sha=lambda b:hashlib.sha256(b).hexdigest()
def file_sha(path):
    h=hashlib.sha256();size=0
    with path.open('rb') as source:
        for raw in iter(lambda:source.read(8*1024*1024),b''):h.update(raw);size+=len(raw)
    return size,h.hexdigest()
def verify_manifest(root):
    manifest=json.loads((root/'manifest-sha256.json').read_bytes());seen=set()
    for row in manifest['files']:
        name=row['name']
        if not isinstance(name,str) or not name or name in ('.','..') or pathlib.Path(name).name!=name or name in seen:raise ValueError('Unsafe/duplicate evidence name')
        seen.add(name)
        if file_sha(root/name)!=(row['bytes'],row['sha256']):raise ValueError('Evidence digest mismatch: '+name)
    if seen!={p.name for p in root.iterdir() if p.is_file() and p.name!='manifest-sha256.json'}:raise ValueError('Incomplete evidence manifest')
    return manifest
def emit(path,value):path.write_bytes((json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False)+'\n').encode())

def run():
    code_paths=[pathlib.Path(__file__),REPO/'scripts'/'audit'/'osm_acq2c_selected_epoch_core.py'];code={p.name:sha(p.read_bytes()) for p in code_paths}
    deadline=time.monotonic()+7200
    while True:
        worker=json.loads((BULK/'native-extraction-worker.json').read_bytes())
        if worker['phase']=='SELECTED_BASE_EXTRACT_FINISHED_UNQUALIFIED':break
        if worker['phase']=='STOPPED_WITHOUT_QUALIFICATION':raise RuntimeError('Native extraction stopped: '+worker.get('error','unknown'))
        if time.monotonic()>deadline:raise TimeoutError('Two-hour bounded wait expired without complete extraction')
        time.sleep(30)
    if code!={p.name:sha(p.read_bytes()) for p in code_paths}:raise ValueError('Processing code changed during wait')
    base=BULK/'native-base-extract';manifest=verify_manifest(base)
    base_report=json.loads((base/'report.json').read_bytes())
    if base_report.get('requested')!=3208 or base_report.get('source_qualified') is not False or base_report.get('target_epoch_not_reached') is not True:raise ValueError('Unexpected base extraction scope')
    integrity=json.loads((base/'original-integrity.json').read_bytes())
    if integrity['sha256']!='149ce6e8d1d4aad41e94fddb8f9721f80697d42d51e5f612879c98d1c236e5a9' or integrity['source_qualified'] is not False:raise ValueError('Unexpected base provenance')
    request=plan();ids=frozenset(request['required_history_object_ids']);ids_sha=sha(('\n'.join(sorted(ids))+'\n').encode('ascii'))
    if ids_sha!='1911a146e69d54c46a960a21fbbc85dd55398d700d9560f1f9e67436e36ec3ac':raise ValueError('Frozen ID plan changed')
    research=WORK.parent/'outputs'/'ROADMAP-RESUME-20261022'/'replication-research'
    doc=json.loads((research/'states.json').read_bytes());states=doc['states']
    validate_epochs(doc['base_epoch'],doc['target_epoch'],'2026-10-19T00:00:04Z',request['epoch'])
    receipts=[json.loads((research/(str(s['sequence'])+'-receipt.json')).read_bytes()) for s in states[1:]];by_sequence={r['sequence']:r for r in receipts};selected_tail=[]
    def read_diff(seq):
        raw=(BULK/'replication-originals'/(str(seq)+'.osc.gz')).read_bytes();receipt=by_sequence[seq]
        if len(raw)!=receipt['bytes'] or sha(raw)!=receipt['sha256']:raise ValueError('Raw tail digest mismatch')
        selected_tail.extend(extract_versions(raw,ids));return raw
    chain=audit(states,doc['base_epoch'],doc['target_epoch'],lambda seq:(research/(str(seq)+'.state.txt')).read_bytes(),read_diff,receipts)
    def base_rows():
        with (base/'selected-base-history.jsonl').open('rb') as source:
            for line in source:yield json.loads(line)
    result=reconcile(base_rows(),selected_tail,ids,doc['base_epoch'],doc['target_epoch'])
    out=BULK/'selected-epoch-published-20261023';out.mkdir(exist_ok=False)
    emit(out/'selected-target.json',result['selected'])
    with (out/'selected-history.jsonl').open('xb') as target:
        for rows in result['histories'].values():
            for row in rows:target.write((json.dumps(row,sort_keys=True,separators=(',',':'),ensure_ascii=False)+'\n').encode())
    summary={k:v for k,v in result.items() if k not in ('selected','histories')}
    summary.update(base_epoch=doc['base_epoch'],target_epoch=doc['target_epoch'],base_source_sha256=integrity['sha256'],base_bytes_independently_verified=True,requested_ids_sha256=ids_sha,code_sha256=code,chain=chain,publisher_receipt_crosscheck='REQUIRES_INDEPENDENT_HUMAN_OR_SIGNED_VALIDATION',geometry_validated=False,overpass_equivalence_certified=False)
    emit(out/'report.json',summary)
    files=[]
    for path in sorted(out.iterdir()):
        size,digest=file_sha(path);files.append(dict(name=path.name,bytes=size,sha256=digest))
    emit(out/'manifest-sha256.json',dict(files=files,source_qualified=False))
    print(json.dumps({k:v for k,v in summary.items() if k!='chain'}))

if __name__=='__main__':run()
