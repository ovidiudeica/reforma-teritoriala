"""OSM-ACQ.2c: bounded, read-only OSM historical dependency pilot.

Authentic epoch versions only; NEVER promote OSM source from this pilot.
Original XML bytes, response headers and SHA-256 are saved as CI artifacts.
"""
import argparse, datetime as dt, email.utils, gzip, hashlib, json
import pathlib, time, urllib.error, urllib.request, xml.etree.ElementTree as ET

ROOT=pathlib.Path(__file__).resolve().parents[2]
EPOCH=dt.datetime.fromisoformat('2026-10-20T20:23:47+00:00')
PRIORITIES=(72526,72634,11821462,11905201)
INPUT=ROOT/'docs/evidence/osm-acq2a-incremental-20261022/registry.json.gz'
INPUT_SHA256='6ef70dbd2651b73d467e6a6b25650806e7eb7197bfff83f639c2649c29d003e7'
HEADERS={'User-Agent':'ReformaTeritoriala-OSM-ACQ2c/1.0 (read-only; ovidiudeica/reforma-teritoriala)',
         'Accept':'application/xml'}

def sha(raw):return hashlib.sha256(raw).hexdigest()
def utc(s):
    d=dt.datetime.fromisoformat(s.replace('Z','+00:00'))
    if d.tzinfo is None:raise ValueError('Naive OSM timestamp')
    return d.astimezone(dt.timezone.utc)

def dep(item):
    if isinstance(item,list) and len(item)==2:t,i=item
    elif isinstance(item,dict):t,i=item.get('type'),item.get('id')
    else:raise ValueError('Malformed dependency')
    if t not in ('way','node') or not isinstance(i,int) or i<1:raise ValueError('Invalid dependency')
    return t,i

def plan(registry,per_priority=2,limit=8):
    selected=[];seen=set();counts=[]
    for rid in PRIORITIES:
        rows=[r for r in registry['rows'] if r['id']==rid]
        if len(rows)!=1:raise ValueError('Target ID absent/duplicated')
        missing=set()
        for d in rows[0]['domains']:
            if d['domain'] not in ('RO','MD'):raise ValueError('Invalid domain')
            missing.update(dep(x) for x in d['missing_after'])
        if not missing:raise ValueError('Target unexpectedly complete')
        counts.append({'relation_id':rid,'unique_missing':len(missing),
                       'domains':[d['domain'] for d in rows[0]['domains']]})
        taken=0
        for t,i in sorted(missing,key=lambda p:(p[0]!='way',p[1])):
            if (t,i) not in seen and taken<per_priority and len(selected)<limit:
                selected.append({'relation_id':rid,'type':t,'id':i})
                seen.add((t,i));taken+=1
    return counts,selected

def objects(raw,t,i,history):
    root=ET.fromstring(raw)
    if root.tag!='osm' or root.get('version')!='0.6':raise ValueError('Unexpected XML OSM envelope')
    els=root.findall(t)
    if not els or (not history and len(els)!=1):raise ValueError('Missing/duplicate expected OSM object')
    result=[]
    for e in els:
        if e.get('id')!=str(i):raise ValueError('Mixed OSM object identities')
        v=int(e.get('version','0'))
        if v<1:raise ValueError('Unversioned OSM object')
        tags={}
        for tag in e.findall('tag'):
            k=tag.get('k')
            if not k or k in tags:raise ValueError('Invalid or repeated tag')
            tags[k]=tag.get('v')
        result.append({'type':t,'id':i,'version':v,'timestamp':e.get('timestamp'),
          'visible':e.get('visible','true'),'changeset':e.get('changeset'),
          'nodes':[int(n.get('ref')) for n in e.findall('nd')] if t=='way' else [],
          'lat':e.get('lat') if t=='node' else None,'lon':e.get('lon') if t=='node' else None,
          'tags':tags})
    return result

def verify_history(history,current,t,i):
    rows=sorted(objects(history,t,i,True),key=lambda r:r['version'])
    now=objects(current,t,i,False)[0]
    if [o['version'] for o in rows]!=list(range(1,len(rows)+1)):
        raise ValueError('Incomplete, duplicated or gapped historical versions')
    dates=[utc(o['timestamp']) for o in rows]
    if dates!=sorted(dates):raise ValueError('Non-monotonic history timestamps')
    if now!=rows[-1]:raise ValueError('Current object differs from latest historical version')
    indices=[j for j,date in enumerate(dates) if date<=EPOCH]
    if not indices:raise ValueError('Object not yet created at frozen epoch')
    j=indices[-1];chosen=rows[j]
    if chosen['visible']!='true':raise ValueError('Object deleted at frozen epoch')
    return {'type':t,'id':i,'epoch_version':chosen['version'],
      'effective_from':chosen['timestamp'],'effective_until':rows[j+1]['timestamp'] if j+1<len(rows) else None,
      'latest_version':now['version'],'epoch_object':chosen,'version_count':len(rows)}

def fetch(path):
    request=urllib.request.Request('https://api.openstreetmap.org/api/0.6/'+path,headers=HEADERS)
    with urllib.request.urlopen(request,timeout=25) as response:
        data=response.read(6_000_001)
        if response.status!=200 or len(data)>6_000_000:raise ValueError('Wrong HTTP status or oversized response')
        date=response.headers.get('Date')
        if not date or email.utils.parsedate_to_datetime(date).astimezone(dt.timezone.utc)<EPOCH:
            raise ValueError('Untrustworthy HTTP date')
        return data,{'url':request.full_url,'status':response.status,'date':date,
                     'content_type':response.headers.get('Content-Type'),
                     'sha256':sha(data),'bytes':len(data)}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--plan-only',action='store_true')
    parser.add_argument('--limit-per-priority',type=int,default=2)
    parser.add_argument('--maximum',type=int,default=8)
    args=parser.parse_args()
    if not 1<=args.limit_per_priority<=3 or not 1<=args.maximum<=12:
        raise ValueError('Capture must remain strictly bounded')
    packed=INPUT.read_bytes()
    if sha(packed)!=INPUT_SHA256:raise ValueError('Parent evidence input hash drift')
    counts,selected=plan(json.loads(gzip.decompress(packed)),args.limit_per_priority,args.maximum)
    if args.plan_only:
        print(json.dumps({'missing':counts,'selected':selected,'source_promoted':False},indent=2));return
    out=ROOT/'outputs'/'osm-acq2c-priority-run'
    out.mkdir(parents=True,exist_ok=False)
    results=[];produced=[]
    for index,target in enumerate(selected):
        typ=target['type'];oid=target['id'];receipts={};originals={};error=None
        for mode,path in [('history',f'{typ}/{oid}/history'),('current',f'{typ}/{oid}')]:
            time.sleep(0.8)
            try:
                data,receipt=fetch(path)
                filename=f'object-{index:02d}-{mode}.xml'
                (out/filename).write_bytes(data)
                originals[mode]=data
                produced.append({'name':filename,'bytes':len(data),'sha256':sha(data)})
                receipts[mode]={**receipt,'file':filename}
            except (urllib.error.URLError,TimeoutError,ValueError) as e:
                error=type(e).__name__+': '+str(e);receipts[mode]={'error':error};break
        verdict='RETRIEVAL_INCOMPLETE';proof=None
        if not error:
            try:
                proof=verify_history(originals['history'],originals['current'],typ,oid)
                verdict='HISTORICAL_VERSION_PROVEN'
            except (ValueError,ET.ParseError) as e:
                verdict='HISTORY_REJECTED';proof={'error':str(e)}
        results.append({'target':target,'verdict':verdict,'proof':proof,'receipts':receipts})
    report={'epoch':'2026-10-20T20:23:47Z','scope':'Bounded raw XML read-only pilot only',
      'source_promoted':False,'overpass_equivalence_certified':False,'new_relation_verdicts':0,
      'parent_gzip_sha256':sha(packed),'priority_missing_counts':counts,'selected_count':len(selected),'rows':results}
    capture_bytes=(json.dumps(report,indent=2,ensure_ascii=False,sort_keys=True)+'\n').encode('utf8')
    (out/'capture.json').write_bytes(capture_bytes)
    produced.append({'name':'capture.json','bytes':len(capture_bytes),'sha256':sha(capture_bytes)})
    (out/'manifest-sha256.json').write_text(json.dumps({'files':sorted(produced,key=lambda x:x['name'])},indent=2,sort_keys=True)+'\n',encoding='utf8')
    print(json.dumps({'selected_count':len(selected),'historical_proven':sum(r['verdict']=='HISTORICAL_VERSION_PROVEN' for r in results),
      'retrieval_incomplete':sum(r['verdict']=='RETRIEVAL_INCOMPLETE' for r in results),
      'history_rejected':sum(r['verdict']=='HISTORY_REJECTED' for r in results),'new_relation_verdicts':0},indent=2))

if __name__=='__main__':main()
