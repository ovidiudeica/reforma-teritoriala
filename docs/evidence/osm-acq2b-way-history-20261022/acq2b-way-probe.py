import pathlib,json,datetime,urllib.request,urllib.error,hashlib,xml.etree.ElementTree as ET,email.utils
from acq2b_exact import decode_graph,merge_graphs,root_boundary,ExactArea,audit_relation,encode,EPOCH
from acq2b_history_validation import validate_way_history
out=pathlib.Path('outputs')/('OSM-ACQ2b-WAY-PROBE-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));out.mkdir(exist_ok=False)
pathlib.Path('work/current-acq2b-way-probe.txt').write_text(str(out.resolve()),encoding='utf8')
targets=[(57874849,1025109),(57880069,1026160),(57880129,1026178),(57876327,1026196)]
rows=[]
def fetch(i,kind):
    url=f'https://api.openstreetmap.org/api/0.6/way/{i}'+('/history'if kind=='history'else'')
    receipt={'url':url,'requested_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat()}
    try:
        req=urllib.request.Request(url,headers={'User-Agent':'ReformaTeritoriala-OSM-ACQ2b-evidence/1.0 (https://github.com/ovidiudeica/reforma-teritoriala)','Accept':'application/xml'})
        with urllib.request.urlopen(req,timeout=20)as r:
            receipt.update(status=r.status,final_url=r.url,headers=dict(r.headers));body=r.read(1024*1024+1)
        file=f'way-{i}-{kind}.response';(out/file).write_bytes(body)
        receipt.update(file=file,bytes=len(body),sha256=hashlib.sha256(body).hexdigest(),complete=len(body)<=1024*1024)
        if not receipt['complete']:raise ValueError('Bounded response incomplete; not an accepted original')
        if urllib.parse.urlparse(receipt['final_url']).hostname!='api.openstreetmap.org':raise ValueError('Unexpected source')
        if email.utils.parsedate_to_datetime(next(v for k,v in receipt['headers'].items()if k.lower()=='date'))<datetime.datetime.fromisoformat(EPOCH.replace('Z','+00:00')):raise ValueError('Observation predates epoch')
        root=ET.fromstring(body)
        if root.tag!='osm' or root.get('version')!='0.6':raise ValueError('Wrong document or placeholder')
        elements=root.findall('way')
        if not elements or any(int(e.get('id'))!=i for e in elements):raise ValueError('Wrong object')
        return elements,receipt
    except Exception as e:receipt['error']=str(e);return None,receipt
for i,candidate in targets:
    h,hr=fetch(i,'history');row={'way_id':i,'relation_id':candidate,'history_receipt':hr,'status':'BLOCKED_EVIDENCE'}
    if h:
        c,cr=fetch(i,'current');row['current_receipt']=cr
        try:
            if not c:raise ValueError('Current observation unavailable')
            row.update(validate_way_history(h,c),status='HISTORICAL_VERSION_PROVEN')
        except Exception as e:row['validation_error']=str(e)
    rows.append(row);(out/'capture.json').write_bytes(encode({'epoch':EPOCH,'rows':rows,'source_promoted':False}))
    print(json.dumps({'way_id':i,'status':row['status'],'target_nodes':len(row.get('object',{}).get('nodes',[]))}),flush=True)
root=pathlib.Path(pathlib.Path('work/current-osm-resume-20261022.txt').read_text(encoding='utf8').strip());reports=json.loads((root/'extract-replay-v2/report.json').read_text(encoding='utf8'))['reports'];graphs={}
parent=json.loads(pathlib.Path('outputs/OSM-ACQ2a-20261022/registry-final.json').read_text(encoding='utf8'))
for report in reports:
    if report['raw_gzip_sha256']!=next(i['gzip_sha256']for i in parent['input_evidence']if i['domain']==report['country']):raise ValueError('Unbound graph input')
    _,graphs[report['country']]=decode_graph((root/'extract-replay-v2'/report['raw_file']).read_bytes(),report)
graph,_=merge_graphs(graphs)
node_dir=pathlib.Path(pathlib.Path('work/current-acq2b-node-history.txt').read_text(encoding='utf8').strip());node_replay=(node_dir/'replay-batch2.json').read_bytes()
if hashlib.sha256(node_replay).hexdigest()!='c1ae350f54e746286c76652548bad9dd818728df0ddf8710e11d5137c5b85f5d':raise ValueError('Node proof drift')
for proof in json.loads(node_replay)['proofs']:graph[('node',proof['node_id'])]=proof['object']
_,edges,_=root_boundary({(o['type'],o['id']):o for o in graphs['RO']},'RO');area=ExactArea(edges);replayed=[]
for row in rows:
    if row['status']!='HISTORICAL_VERSION_PROVEN':continue
    obj=row['object'];key=('way',obj['id'])
    if key in graph:raise ValueError('Way unexpectedly already indexed')
    graph[key]=obj
    relation=graph[('relation',row['relation_id'])];audit=audit_relation(relation,graph,area)
    replayed.append({'id':row['relation_id'],'domain':'RO','relation_version':relation['version'],'recovered_way_id':row['way_id'],**audit})
new=[r['id']for r in replayed if not r['verdict'].startswith('UNKNOWN')]
result={'epoch':EPOCH,'rows':replayed,'summary':{'new_resolved_ids':new,'total_resolved_ids':145+len(new),'remaining_unknown_ids':246-len(new)},'source_promoted':False,'overpass_equivalence_certified':False}
(out/'replay.json').write_bytes(encode(result));print(json.dumps({'out':str(out),'summary':result['summary'],'rows':[{'id':r['id'],'verdict':r['verdict'],'missing':r['missing']}for r in replayed]}))
