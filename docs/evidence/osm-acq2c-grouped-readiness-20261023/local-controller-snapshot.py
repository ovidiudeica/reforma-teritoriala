"""Wait for the existing native worker, then replay authenticated tail locally."""
import pathlib,sys,json,time,datetime,hashlib,os,traceback
ROOT=pathlib.Path(__file__).resolve().parent.parent;BULK=ROOT/'work/osm-acq2c-bulk';REPO=ROOT/'work/doc-supplement'
sys.path.insert(0,str(REPO/'scripts/audit'))
from frontier_stream_replay import replay_groups
from osm_acq2c_native_extract import request_ids,canonical
from osm_acq2c_replication_chain import audit,extract_versions
from osm_acq2c_selected_epoch_core import validate_epochs
STATE=BULK/'frontier-epoch-worker.json';state=dict(pid=os.getpid(),phase='STARTED',source_qualified=False,source_promoted=False,download_started=False)
def emit(p,v):p.write_bytes(canonical(v))
def status(**extra):
 state.update(extra,updated_at=datetime.datetime.now(datetime.timezone.utc).isoformat());tmp=BULK/'frontier-epoch-worker.tmp';emit(tmp,state);os.replace(tmp,STATE)
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as s:
  for b in iter(lambda:s.read(8388608),b''):h.update(b)
 return h.hexdigest()
def run():
 with (BULK/'frontier-epoch-controller.lock').open('x') as f:json.dump(dict(pid=os.getpid()),f)
 code_paths=[pathlib.Path(__file__),ROOT/'work/frontier_stream_replay.py',REPO/'scripts/audit/osm_acq2c_selected_epoch_core.py'];code={str(p.relative_to(ROOT)):sha(p) for p in code_paths}
 try:
  status(phase='WAITING_FOR_EXISTING_NATIVE_WORKER',native_worker_pid=18704,code_sha256=code)
  deadline=time.monotonic()+7200;base=BULK/'recursive-frontier-base-20261023'
  while True:
   worker=json.loads((base/'worker.json').read_bytes())
   if worker['phase']=='BASE_EXTRACT_FINISHED_UNQUALIFIED':break
   if worker['phase']=='STOPPED_WITHOUT_QUALIFICATION':raise RuntimeError(worker.get('error','Native worker failed'))
   if time.monotonic()>deadline:raise TimeoutError('Two-hour bounded wait; no source claim')
   time.sleep(30)
  if code!={str(p.relative_to(ROOT)):sha(p) for p in code_paths}:raise ValueError('Replay code changed while waiting')
  manifest=json.loads((base/'manifest-sha256.json').read_bytes());seen=set()
  for r in manifest['files']:
   name=r['name']
   if pathlib.Path(name).name!=name or name in seen or name in ('.','..'):raise ValueError('Unsafe/duplicate manifest name')
   seen.add(name);p=base/name
   if p.stat().st_size!=r['bytes'] or sha(p)!=r['sha256']:raise ValueError('Native selected data manifest mismatch')
  if seen!={p.name for p in base.iterdir() if p.is_file() and p.name not in ('manifest-sha256.json','worker.json','exclusive-lock.json')}:raise ValueError('Incomplete native data manifest')
  plan=ROOT/'outputs/ROADMAP-20261023/recursive-frontier-validated-20261023/missing-ids.txt';ids=request_ids(plan.read_text().splitlines())
  if len(ids)!=199971 or sha(plan)!='644b645b64f073010c0ea573ac4500f14e52dccbc99eff4c790f93bafc8940e3':raise ValueError('Frozen frontier changed')
  research=ROOT/'outputs/ROADMAP-RESUME-20261022/replication-research';doc=json.loads((research/'states.json').read_bytes());states=doc['states']
  validate_epochs(doc['base_epoch'],doc['target_epoch'],'2026-10-19T00:00:04Z','2026-10-20T20:23:47Z')
  receipts=[json.loads((research/(str(s['sequence'])+'-receipt.json')).read_bytes()) for s in states[1:]];by_seq={r['sequence']:r for r in receipts};tail=[]
  status(phase='VERIFYING_AUTHENTIC_REPLICATION_TAIL')
  def read_diff(seq):
   raw=(BULK/'replication-originals'/(str(seq)+'.osc.gz')).read_bytes();receipt=by_seq[seq]
   if len(raw)!=receipt['bytes'] or hashlib.sha256(raw).hexdigest()!=receipt['sha256']:raise ValueError('Raw replication digest mismatch')
   tail.extend(extract_versions(raw,ids));return raw
  chain=audit(states,doc['base_epoch'],doc['target_epoch'],lambda seq:(research/(str(seq)+'.state.txt')).read_bytes(),read_diff,receipts)
  out=BULK/'recursive-frontier-epoch-20261023';out.mkdir(exist_ok=False);status(phase='RECONCILING_GROUPED_HISTORIES',tail_versions=len(tail))
  def rows():
   with (base/'selected-base-history.jsonl').open('rb') as source:
    for line in source:yield json.loads(line)
  with (out/'selected-history.jsonl').open('xb') as target:
   def archive(row):target.write(canonical(row))
   result=replay_groups(rows(),tail,ids,doc['base_epoch'],doc['target_epoch'],archive)
  emit(out/'selected-target.json',result.pop('selected'))
  result.update(base_epoch=doc['base_epoch'],target_epoch=doc['target_epoch'],requested=len(ids),requested_ids_sha256=sha(plan),code_sha256=code,chain=chain,publisher_receipt_crosscheck='REQUIRES_INDEPENDENT_HUMAN_OR_SIGNED_VALIDATION',geometry_validated=False,overpass_equivalence_certified=False,base_manifest_sha256=sha(base/'manifest-sha256.json'))
  emit(out/'report.json',result)
  files=[dict(name=p.name,bytes=p.stat().st_size,sha256=sha(p)) for p in sorted(out.iterdir())]
  emit(out/'manifest-sha256.json',dict(files=files,source_qualified=False))
  status(phase='FRONTIER_EPOCH_REPLAY_FINISHED_UNQUALIFIED',requested=len(ids),missing=len(result['missing_ids']),gapped=len(result['gapped_ids']),versions=result['versions'])
 except Exception as e:
  status(phase='STOPPED_WITHOUT_QUALIFICATION',error=str(e));(BULK/'frontier-epoch-failure.txt').write_bytes(traceback.format_exc().encode());raise
if __name__=='__main__':run()
