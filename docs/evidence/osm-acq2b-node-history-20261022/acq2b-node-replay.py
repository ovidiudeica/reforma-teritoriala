import sys,pathlib,json,hashlib,xml.etree.ElementTree as ET,datetime,email.utils
from acq2b_exact import EPOCH,decode_graph,merge_graphs,root_boundary,ExactArea,audit_relation,encode
from acq2b_history_validation import validate_history
out=pathlib.Path(pathlib.Path('work/current-acq2b-node-history.txt').read_text(encoding='utf8').strip())
batch2='--batch2'in sys.argv
capture=json.loads((out/('capture-batch2.json'if batch2 else'capture.json')).read_text(encoding='utf8'));objects=[];proofs=[]
for row in capture['rows']:
    if row['verdict']!='HISTORICAL_VERSION_PROVEN':continue
    originals=[]
    for kind in ['history','current']:
        receipt=row[kind+'_receipt'];data=(out/receipt['file']).read_bytes()
        if hashlib.sha256(data).hexdigest()!=receipt['sha256']:raise ValueError('Original integrity drift')
        headers={k.lower():v for k,v in receipt['headers'].items()}
        server_time=email.utils.parsedate_to_datetime(headers['date'])
        if server_time<datetime.datetime.fromisoformat(EPOCH.replace('Z','+00:00')):raise ValueError('Observation predates target')
        root=ET.fromstring(data)
        if root.tag!='osm':raise ValueError('Placeholder or wrong original')
        originals.append(root.findall('node'))
    verified=validate_history(*originals)
    if verified['object']!=row['object']:raise ValueError('Captured/derived version mismatch')
    objects.append(verified['object']);proofs.append({'relation_id':row['candidate_relation'],'node_id':row['node_id'],
        **verified,'history_sha256':row['history_receipt']['sha256'],'current_sha256':row['current_receipt']['sha256']})
root=pathlib.Path(pathlib.Path('work/current-osm-resume-20261022.txt').read_text(encoding='utf8').strip())
reports=json.loads((root/'extract-replay-v2/report.json').read_text(encoding='utf8'))['reports'];graphs={}
parent=json.loads(pathlib.Path('outputs/OSM-ACQ2a-20261022/registry-final.json').read_text(encoding='utf8'))
for report in reports:
    if report['raw_gzip_sha256']!=next(r['gzip_sha256']for r in parent['input_evidence']if r['domain']==report['country']):raise ValueError('Graph not bound to parent')
    _,graphs[report['country']]=decode_graph((root/'extract-replay-v2'/report['raw_file']).read_bytes(),report)
graph,_=merge_graphs(graphs)
for o in objects:
    key=('node',o['id'])
    if key in graph:raise ValueError('Recovered node unexpectedly already present')
    graph[key]=o
own={(o['type'],o['id']):o for o in graphs['RO']};country,edges,_=root_boundary(own,'RO');area=ExactArea(edges);rows=[]
for p in proofs:
    old=next(r for r in parent['rows']if r['id']==p['relation_id'])
    if old['resolved'] or len(old['domains'])!=1 or old['domains'][0]['domain']!='RO':raise ValueError('Candidate mismatch')
    relation=graph[('relation',p['relation_id'])]
    if hashlib.sha256(encode(relation)).hexdigest()!=old['domains'][0]['relation_sha256']:raise ValueError('Relation drift')
    result=audit_relation(relation,graph,area)
    rows.append({'id':p['relation_id'],'domain':'RO','version':relation['version'],'timestamp':relation['timestamp'],
                 'previous_verdict':'UNKNOWN_MISSING_DEPENDENCIES','recovered_node_id':p['node_id'],**result})
new_resolved=[r['id']for r in rows if not r['verdict'].startswith('UNKNOWN')]
result={'epoch':EPOCH,'scope':'Independent frozen spatial predicate, using authenticated official node histories for the two missing dependencies.',
    'proofs':proofs,'rows':rows,'summary':{'new_resolved_ids':new_resolved,'previous_resolved_ids':131,'total_resolved_ids':131+len(new_resolved),'remaining_unknown_ids':260-len(new_resolved)},
    'source_promoted':False,'overpass_equivalence_certified':False}
data=encode(result);destination=out/('replay-batch2.json'if batch2 else'replay.json')
if '--verify'in sys.argv:
    if destination.read_bytes()!=data:raise ValueError('Nonidentical replay')
else:
    if destination.exists():raise FileExistsError('Do not overwrite')
    destination.write_bytes(data)
print(json.dumps({'summary':result['summary'],'rows':[{'id':r['id'],'verdict':r['verdict'],'missing':r['missing']}for r in rows],'sha256':hashlib.sha256(data).hexdigest()}))
