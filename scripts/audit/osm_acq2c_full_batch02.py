"""OSM-ACQ.2c batch02: 64 NEW dependencies, strictly after proven batch01."""
import hashlib
import json
import pathlib
import time
import urllib.error
import xml.etree.ElementTree as ET
from osm_acq2c_full_batch import plan_registry,source_registry,fetch,verify_history,sha,SOURCE_SHA256,EPOCH

ROOT=pathlib.Path(__file__).resolve().parents[2]
OUTPUT=ROOT/'outputs'/'osm-acq2c-full-batch02'
PREVIOUS_ARTIFACT_ID=12437338609
PREVIOUS_ARTIFACT_SHA256='b13762100c9107bba0e08280a5c8efb6ebb5c546052e8d9effd4b94e929ec6ab'
PREVIOUS_INVENTORY_SHA256='320bd869240b67ed498824036e0de6ac8d5d6e6cd20f6283f10f70bb0ffa4727'
PREVIOUS_FIRST64_SHA256='05178089441a5e992d18fd10987e2cfb12eb1c6a7abb744019ac9f5fb98ea380'
START,END=64,128

def ordered_slice(plan):
    if (plan['initial_distinct'],plan['unknown_distinct'],plan['unknown_domain_rows'],
        plan['total_unique_missing_objects'],plan['remaining_missing_objects'])!=(391,242,244,2966,2958):
        raise ValueError('Frozen source cardinality changed; cannot skip previous batch')
    prior=[(x['type'],x['id']) for x in plan['ordered'][:START]]
    digest=sha(json.dumps(prior,sort_keys=True,separators=(',',':')).encode())
    if digest!=PREVIOUS_FIRST64_SHA256:
        raise ValueError('Previous 64 object identities/order drift; cannot skip evidence')
    batch=plan['ordered'][START:END]
    if len(batch)!=64 or len({(x['type'],x['id']) for x in batch})!=64:
        raise ValueError('Expected exactly 64 new and distinct objects')
    if set(prior)&{(x['type'],x['id']) for x in batch}:
        raise ValueError('Batch overlaps earlier genuine captures')
    return batch

def write(name,obj,manifest):
    raw=(json.dumps(obj,indent=2,sort_keys=True,ensure_ascii=False)+'\n').encode()
    (OUTPUT/name).write_bytes(raw)
    manifest.append({'name':name,'bytes':len(raw),'sha256':sha(raw)})

def main():
    plan=plan_registry(source_registry())
    batch=ordered_slice(plan)
    if OUTPUT.exists(): raise FileExistsError('Refusing to overwrite previous evidence')
    OUTPUT.mkdir(parents=True)
    originals=[];rows=[]
    write('plan.json',{'epoch':EPOCH,'source_gzip_sha256':SOURCE_SHA256,
        'previous_artifact_id':PREVIOUS_ARTIFACT_ID,
        'previous_artifact_sha256':PREVIOUS_ARTIFACT_SHA256,
        'previous_inventory_sha256':PREVIOUS_INVENTORY_SHA256,
        'skip_previously_proven_first64_sha256':PREVIOUS_FIRST64_SHA256,
        'start':START,'end':END,'new_objects':batch,
        'source_promoted':False,'relation_verdicts_added':0},originals)
    for i,item in enumerate(batch):
        raws={};receipts={};failure=None
        for mode,suffix in (('history','/history'),('current','')):
            time.sleep(1.0)
            try:
                data,receipt=fetch(f"{item['type']}/{item['id']}{suffix}")
                filename=f'object-{i:02d}-{mode}.xml'
                (OUTPUT/filename).write_bytes(data)
                originals.append({'name':filename,'bytes':len(data),'sha256':sha(data)})
                raws[mode]=data
                receipts[mode]={**receipt,'file':filename}
            except (urllib.error.URLError,TimeoutError,ValueError) as ex:
                failure=f'{type(ex).__name__}: {ex}'
                receipts[mode]={'error':failure}
                break
        verdict='RETRIEVAL_INCOMPLETE';proof=None
        if failure is None:
            try:
                proof=verify_history(raws['history'],raws['current'],item['type'],item['id'])
                verdict='HISTORICAL_VERSION_PROVEN'
            except (ValueError,ET.ParseError) as ex:
                verdict='HISTORY_REJECTED';proof={'error':str(ex)}
        rows.append({'target':item,'verdict':verdict,'proof':proof,'receipts':receipts})
    write('capture.json',{'epoch':EPOCH,'prior_artifact_sha256':PREVIOUS_ARTIFACT_SHA256,
        'source_sha256':SOURCE_SHA256,'batch_size':len(rows),
        'new_relation_verdicts':0,'overpass_equivalence_certified':False,
        'source_promoted':False,'rows':rows},originals)
    (OUTPUT/'manifest-sha256.json').write_text(json.dumps(
        {'files':sorted(originals,key=lambda x:x['name'])},indent=2,sort_keys=True)+'\n',
        encoding='utf8')
    print(json.dumps({'new_objects':len(rows),
        'historical_proven':sum(r['verdict']=='HISTORICAL_VERSION_PROVEN' for r in rows),
        'retrieval_incomplete':sum(r['verdict']=='RETRIEVAL_INCOMPLETE' for r in rows),
        'history_rejected':sum(r['verdict']=='HISTORY_REJECTED' for r in rows),
        'relation_verdicts_added':0}))
    if any(r['verdict']!='HISTORICAL_VERSION_PROVEN' for r in rows):
        raise SystemExit('Batch02 contains incomplete or rejected proofs; original evidence archived')

if __name__=='__main__':
    main()
