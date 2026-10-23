"""Read-only selected base history extraction. Never source qualification.

The base ends on 19 October; this command does NOT claim the target 20 October.
No network, no automatic repairs, no contributor metadata in derived records.
"""
import argparse,hashlib,json,pathlib,re
from osm_acq2c_acquire_history_base import URL,TOTAL,ETAG,MD5,storage_root
from osm_acq2c_bulk_preflight import plan

BASE_EPOCH='2026-10-19T00:00:04Z'

def canonical(value):
    return (json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False)+'\n').encode('utf8')

def request_ids(values):
    if not isinstance(values,list) or not values:raise ValueError('Empty request')
    if any(not isinstance(v,str) or not re.fullmatch(r'[nwr][1-9][0-9]*',v) for v in values):raise ValueError('Invalid typed identity')
    if len(set(values))!=len(values):raise ValueError('Duplicate request')
    return frozenset(values)

def verify_original(path,receipt):
    if (receipt.get('status'),receipt.get('url'),receipt.get('expected_bytes'),receipt.get('etag'),receipt.get('base_epoch'))!=('FULL_BASE_BYTES_VERIFIED_NOT_SOURCE_QUALIFIED',URL,TOTAL,ETAG,BASE_EPOCH):raise ValueError('Incomplete or incompatible base receipt')
    if receipt.get('verified_downloaded_bytes')!=TOTAL or receipt.get('actual_md5')!=MD5:raise ValueError('Incomplete base length or MD5')
    if not re.fullmatch('[0-9a-f]{64}',receipt.get('source_sha256','')):raise ValueError('Missing source SHA-256')
    if path.stat().st_size!=TOTAL:raise ValueError('Original length mismatch')
    sha=hashlib.sha256();md5=hashlib.md5()
    with path.open('rb') as source:
        for block in iter(lambda:source.read(8*1024*1024),b''):sha.update(block);md5.update(block)
    if sha.hexdigest()!=receipt['source_sha256'] or md5.hexdigest()!=MD5:raise ValueError('Independent full original digest mismatch')
    return {'bytes':TOTAL,'sha256':sha.hexdigest(),'md5':md5.hexdigest(),'source_qualified':False}

def object_record(obj):
    typ=obj.type_str()
    if typ not in ('n','w','r') or obj.id<=0 or obj.version<=0:raise ValueError('Invalid OSM object')
    tags=sorted([[t.k,t.v] for t in obj.tags])
    if len({t[0] for t in tags})!=len(tags):raise ValueError('Duplicate tags')
    row={'code':typ+str(obj.id),'version':obj.version,'timestamp':obj.timestamp.isoformat().replace('+00:00','Z'),'visible':not obj.deleted,'tags':tags}
    if typ=='w':row['nodes']=[n.ref for n in obj.nodes]
    if typ=='r':row['members']=[[m.type,m.ref,m.role] for m in obj.members]
    if typ=='n' and not obj.deleted:
        if not obj.location.valid():raise ValueError('Invalid node location')
        row['x']=obj.location.x;row['y']=obj.location.y
    return row

def check_versions(rows,requested):
    seen={};last={};counts={}
    for row in rows:
        code=row['code'];version=row['version']
        if code not in requested or type(version) is not int or version<1:raise ValueError('Unexpected identity/version')
        key=(code,version)
        if key in seen:raise ValueError('Duplicate object version')
        seen[key]=True
        if code in last and (version<=last[code][0] or row['timestamp']<last[code][1]):raise ValueError('Non-monotonic object history')
        last[code]=(version,row['timestamp']);counts.setdefault(code,[]).append(version)
    missing=sorted(requested-counts.keys())
    gaps=sorted(code for code,versions in counts.items() if versions[0]!=1 or any(b!=a+1 for a,b in zip(versions,versions[1:])))
    return {'requested':len(requested),'observed':len(counts),'versions':len(seen),'missing_ids':missing,'gapped_ids':gaps,'source_qualified':False,'dependency_closure_certified':False,'unknown_adjudicated':0}

def read_selection(path,requested,expected_epoch=None):
    import osmium
    # The C++ filter drops unrelated IDs before the Python iterator. Since IDs
    # overlap across types, retain a second exact typed check, never numeric-only.
    native=osmium.filter.IdFilter({int(code[1:]) for code in requested})
    processor=osmium.FileProcessor(str(path)).with_filter(native)
    if not processor.header.has_multiple_object_versions:raise ValueError('Current-only PBF is not full history')
    if expected_epoch is not None and processor.header.get('osmosis_replication_timestamp')!=expected_epoch:raise ValueError('Historical base header epoch mismatch')
    for obj in processor:
        if obj.type_str()+str(obj.id) in requested:yield object_record(obj)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--storage-slot',choices=('workspace','repository'),default='repository')
    args=parser.parse_args();root=storage_root(args.storage_slot)
    receipt=json.loads((root/'history-261019-acquisition.json').read_bytes())
    source=root/'history-261019.osm.pbf'
    if (root/'native-base-extract').exists():raise FileExistsError('Preserve prior extraction; never overwrite')
    integrity=verify_original(source,receipt)
    requested=request_ids(plan()['required_history_object_ids'])
    out=root/'native-base-extract';out.mkdir(exist_ok=False)
    (out/'original-integrity.json').write_bytes(canonical(integrity))
    # Only the selected records enter Python or this small private JSONL file.
    # Missing/redacted versions remain explicit; no relation gets adjudicated.
    rows=read_selection(source,requested,BASE_EPOCH)
    def archive():
        with (out/'selected-base-history.jsonl').open('xb') as target:
            for row in rows:target.write(canonical(row));yield row
    result=check_versions(archive(),requested)
    result.update(base_epoch=BASE_EPOCH,target_epoch_not_reached=True,contributor_metadata_exported=False)
    (out/'report.json').write_bytes(canonical(result))
    files=[]
    for path in sorted(out.iterdir()):
        raw=path.read_bytes();files.append({'name':path.name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
    (out/'manifest-sha256.json').write_bytes(canonical({'files':files,'source_qualified':False}))
    print(json.dumps(result))

if __name__=='__main__':main()
