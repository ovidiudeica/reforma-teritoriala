import sys,pathlib,json,hashlib,xml.etree.ElementTree as ET,datetime,email.utils
from acq2b_exact import decode_graph,merge_graphs,root_boundary,ExactArea,audit_relation,encode,EPOCH
from acq2b_history_validation import validate_history,validate_way_history
out=pathlib.Path(pathlib.Path('work/current-acq2b-way-probe.txt').read_text(encoding='utf8').strip())
node_dir=pathlib.Path(pathlib.Path('work/current-acq2b-node-history.txt').read_text(encoding='utf8').strip())
way_capture=json.loads((out/'capture.json').read_text(encoding='utf8'))
node_capture_path=node_dir/'capture-waynodes.json'
if not node_capture_path.exists():node_capture_path=out/'capture-waynodes.json'
node_capture=json.loads(node_capture_path.read_text(encoding='utf8'))
def verify(row,directory,kind,validator):
    originals=[]
    for suffix in ['history','current']:
        receipt=row[suffix+'_receipt'];original=directory/receipt['file']
        if not original.exists():original=out/receipt['file']
        data=original.read_bytes()
        if hashlib.sha256(data).hexdigest()!=receipt['sha256']:raise ValueError('Original hash drift')
        headers={k.lower():v for k,v in receipt['headers'].items()}
        if email.utils.parsedate_to_datetime(headers['date'])<datetime.datetime.fromisoformat(EPOCH.replace('Z','+00:00')):raise ValueError('HTTP observation before target')
        root=ET.fromstring(data)
        if root.tag!='osm' or root.get('version')!='0.6':raise ValueError('Wrong document')
        originals.append(root.findall(kind))
    proof=validator(*originals)
    if proof['object']!=row['object']:raise ValueError('History-derived object changed')
    return {**proof,'history_sha256':row['history_receipt']['sha256'],'current_sha256':row['current_receipt']['sha256']}
node_proofs=[]
for row in node_capture['rows']:
    if row['verdict']=='HISTORICAL_VERSION_PROVEN':node_proofs.append(verify(row,node_dir,'node',validate_history))
way_proofs=[]
for row in way_capture['rows']:
    if row['status']=='HISTORICAL_VERSION_PROVEN':way_proofs.append({'relation_id':row['relation_id'],**verify(row,out,'way',validate_way_history)})
root=pathlib.Path(pathlib.Path('work/current-osm-resume-20261022.txt').read_text(encoding='utf8').strip())
reports=json.loads((root/'extract-replay-v2/report.json').read_text(encoding='utf8'))['reports'];graphs={}
parent_bytes=pathlib.Path('outputs/OSM-ACQ2a-20261022/registry-final.json').read_bytes()
if hashlib.sha256(parent_bytes).hexdigest()!='833a25a36d4251c022ed84853207e90a71771498f4bd99c4189e901aacdd539e':raise ValueError('Parent drift')
parent=json.loads(parent_bytes)
for report in reports:
    if report['raw_gzip_sha256']!=next(r['gzip_sha256']for r in parent['input_evidence']if r['domain']==report['country']):raise ValueError('Unbound graph')
    _,graphs[report['country']]=decode_graph((root/'extract-replay-v2'/report['raw_file']).read_bytes(),report)
graph,_=merge_graphs(graphs)
for proof in node_proofs+way_proofs:
    obj=proof['object'];key=(obj['type'],obj['id'])
    if key in graph and graph[key]!=obj:raise ValueError('Conflicting historical object')
    graph[key]=obj
_,edges,_=root_boundary({(o['type'],o['id']):o for o in graphs['RO']},'RO');area=ExactArea(edges);rows=[]
for proof in way_proofs:
    relation=graph[('relation',proof['relation_id'])]
    old=next(r for r in parent['rows']if r['id']==relation['id'])
    if len(old['domains'])!=1 or old['domains'][0]['domain']!='RO' or old['resolved']:raise ValueError('Bad target')
    if hashlib.sha256(encode(relation)).hexdigest()!=old['domains'][0]['relation_sha256']:raise ValueError('Relation version drift')
    rows.append({'id':relation['id'],'domain':'RO','version':relation['version'],'timestamp':relation['timestamp'],
        'recovered_way_id':proof['object']['id'],**audit_relation(relation,graph,area)})
new=[r['id']for r in rows if not r['verdict'].startswith('UNKNOWN')]
result={'epoch':EPOCH,'scope':'Independent frozen PBF spatial predicate with historical way/node dependency proofs, not Overpass qualification.',
    'way_proofs':way_proofs,'node_proofs':node_proofs,'rows':rows,
    'summary':{'new_resolved_ids':new,'previous_resolved_ids':145,'total_resolved_ids':145+len(new),'remaining_unknown_ids':246-len(new)},
    'source_promoted':False,'overpass_equivalence_certified':False}
data=encode(result);p=out/'replay-complete.json'
if '--verify'in sys.argv:
    if p.read_bytes()!=data:raise ValueError('Nonidentical regeneration')
else:
    if p.exists():raise FileExistsError('Do not overwrite')
    p.write_bytes(data)
print(json.dumps({'summary':result['summary'],'rows':[{'id':r['id'],'verdict':r['verdict'],'missing':r['missing']}for r in rows],'sha256':hashlib.sha256(data).hexdigest()}))
