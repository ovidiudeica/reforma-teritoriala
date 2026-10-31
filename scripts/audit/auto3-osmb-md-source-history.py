import json,gzip,difflib,copy,hashlib,argparse,subprocess,sys
from pathlib import Path
from shapely.geometry import shape
R=Path(__file__).resolve().parents[2];P=R/'docs/audits/auto3-osmb/md-shared-boundary-history';T='2026-10-05T09:21:08Z'
load=lambda f:json.loads((P/f).read_bytes())
ap=argparse.ArgumentParser();ap.add_argument('--apply-evidence',action='store_true');args=ap.parse_args()
for row in load('condrita-history-retrieval.json')['sources']+load('removed-node-retrieval.json'):
 assert row['status']==200 and hashlib.sha256((P/row['file']).read_bytes()).hexdigest()==row['sha256']
acquired=load('way69469001-acquisition.json');assert acquired['status']==200 and hashlib.sha256((P/'way69469001-history.json').read_bytes()).hexdigest()==acquired['sha256']
for row in load('nodes-retrieval.json')['sources']:assert row['status']==200 and hashlib.sha256((P/f"nodes-current-{row['id']}.json").read_bytes()).hexdigest()==row['sha256']
facts=load('condrita-shared-ways.json');assert {r['id'] for r in facts['relations']}=={1813319,1691801}
assert all({69469001,123810097}.issubset({m['ref'] for m in r['members'] if m['type']=='way'}) for r in facts['relations'])
coord=lambda e:(e['lon'],e['lat'])
current={e['id']:e for f in P.glob('nodes-current-*.json') for e in json.loads(f.read_bytes())['elements']}
removed=[7298612264,12313798520];endpoint_ids=[353223870,1379403420]
changes={};evidence=[]
for n in endpoint_ids:
 versions=load(f'node{n}-history.json')['elements'];old=max((x for x in versions if x['timestamp']<T and 'lon' in x),key=lambda x:x['version']);new=next(x for x in versions if x['timestamp']==T)
 changes[coord(old)]=[list(coord(new))];evidence.append({'node':n,'old_version':old['version'],'new_version':new['version'],'old_coordinate':coord(old),'new_coordinate':coord(new),'changeset':new['changeset']})
versions=load('way69469001-history.json')['elements'];old=max((x for x in versions if x['timestamp']<T),key=lambda x:x['version']);new=next(x for x in versions if x['timestamp']==T)
rawways={x['id']:x for x in facts['ways']};assert rawways[69469001]['nodes']==new['nodes']
connector=next(x for x in load('way123810097-history.json')['elements'] if x['timestamp']==T);assert rawways[123810097]['nodes']==connector['nodes']
for tag,i,j,a,b in difflib.SequenceMatcher(a=old['nodes'],b=new['nodes'],autojunk=False).get_opcodes():
 if tag=='equal':continue
 assert tag in ['delete','replace'] and j-i==1
 oldid=old['nodes'][i];history=load(f'node{oldid}-history.json')['elements'];before=max((x for x in history if x['timestamp']<T and 'lon' in x),key=lambda x:x['version']);replacement=[]
 for newid in new['nodes'][a:b]:
  after=current[newid];assert after['timestamp']==T and after['version']==1;replacement.append(list(coord(after)))
 changes[coord(before)]=replacement;evidence.append({'removed_node':oldid,'inserted_nodes':new['nodes'][a:b],'old_coordinate':coord(before),'new_coordinates':replacement,'changeset':190022801})
mid=list(coord(current[14251506230]));assert current[14251506230]['timestamp']==T
ends={tuple(changes[coord(max((x for x in load(f'node{n}-history.json')['elements'] if x['timestamp']<T and 'lon' in x),key=lambda x:x['version']))][0]) for n in endpoint_ids}
def patch(v,reverse):
 if v and isinstance(v[0],list) and v[0] and isinstance(v[0][0],(float,int)):
  ring=[]
  for c in v:
   replacement=changes.get(tuple(c),[c]);ring.extend(replacement[::-1] if reverse and len(replacement)>1 else replacement)
  out=[]
  for i,c in enumerate(ring):
   out.append(c)
   if i+1<len(ring) and {tuple(c),tuple(ring[i+1])}==ends:out.append(mid)
  return out
 return [patch(x,reverse) for x in v]
bundle=json.loads(gzip.decompress((R/'docs/audits/auto3-osmb/geometry-cases.json.gz').read_bytes()));proof=[]
for k in ['osm-r1813319','osm-r1691801']:
 data=bundle[k];matches=[]
 for reverse in [False,True]:
  candidate=copy.deepcopy(data['source']['geometry']);candidate['coordinates']=patch(candidate['coordinates'],reverse)
  if shape(candidate).is_valid and shape(candidate).equals(shape(data['actual']['geometry'])):matches.append(reverse)
 assert len(matches)==1,{'case':k,'matching_orders':matches}
 proof.append({'case_id':'AUTO3-'+k,'reconstructed_geometry_equals_actual':True,'reverse_changed_way_subchain_for_ring_orientation':matches[0],'source_geometry_modified':False})
out={'cases':proof,'changeset':190022801,'timestamp':T,'coordinate_changes':evidence,'inserted_connector_node':14251506230,'inserted_connector_coordinate':mid,'later_node_version_excluded':{'node':1379403420,'version':3,'timestamp':'2026-10-12T17:52:07Z'},'osmb_exact_export_time_certified':False,'actual_modified':False,'legal_boundary_certified':False}
out=json.loads(json.dumps(out));proofpath=P/'condrita-exact-cause.json';register=R/'docs/audits/auto3-osmb/register.json'
if args.apply_evidence:
 proofpath.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
 reg=json.loads(register.read_bytes());wanted={x['case_id'] for x in proof};proofref='docs/audits/auto3-osmb/md-shared-boundary-history/condrita-exact-cause.json';proofsha=hashlib.sha256(proofpath.read_bytes()).hexdigest()
 for row in reg['records']:
  if row['case_id'] not in wanted:continue
  row['cause_status']='OFFICIAL_OSM_SHARED_BOUNDARY_REVISION_DEMONSTRATED';row['cartographic_status']='CARTOGRAPHIC_RECONCILED';row['decision']='RETAIN_ACCEPTED_20261005_OSM_CONTOUR_EXCLUDE_LATER_NODE_EDIT';row['remaining_evidence']=['Exact OSMB per-object export timestamp remains uncertified; this is a cartographic cause, not legal boundary certification.']
  row['demonstrated_findings']=[x for x in row['demonstrated_findings'] if x.get('proof')!=proofref];row['demonstrated_findings'].append({'finding':'The moved endpoints, removed nodes and inserted nodes of changeset 190022801 reconstruct ACTUAL exactly; the 2026-10-12 node revision is excluded','proof':proofref,'proof_sha256':proofsha})
  row['existing_audit_evidence']=[x for x in row['existing_audit_evidence'] if x.get('path')!=proofref];row['existing_audit_evidence'].append({'path':proofref,'sha256':proofsha})
 register.write_text(json.dumps(reg,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
 # Reuse the existing generic matrix/statistics refresh, preserving all open legal states.
 subprocess.check_call([sys.executable,str(R/'scripts/audit/auto3-osmb-ro-source-history.py'),'--apply-evidence'])
 readme=R/'docs/audits/auto3-osmb/README.md';s=readme.read_text(encoding='utf8').split('\n## Istoric comun Condrița')[0]
 s+='\n## Istoric comun Condrița / Chișinău\n\nIstoriile API OSM originale arată changesetul 190022801 din 2026-10-05T09:21:08Z: două noduri de capăt mutate, două noduri eliminate, două inserate pe calea 69469001 și un nod inserat pe calea 123810097. Aplicarea exclusivă a acestor operații în memorie reconstruiește exact ambele contururi ACTUAL, fără alte coordonate schimbate. Pentru nodul 1379403420 este folosită versiunea 2 din 5 octombrie; versiunea 3 din 12 octombrie este păstrată ca probă de istoric, dar exclusă din reconstrucție. Nu se deduce ora exportului OSMB și nu se certifică hotarul juridic.\n\nVerificare fără rețea: `python scripts/audit/auto3-osmb-md-source-history.py`. Bilanțul actualizat este 182 mecanisme/proveniențe cartografice documentate și 116 cazuri REVIEW_REQUIRED.\n\nDate cartografice și istorii: © OpenStreetMap contributors, ODbL; răspunsurile API originale păstrează informațiile de atribuire și proveniență.\n';pending=sum(r['cartographic_status']=='REVIEW_REQUIRED' for r in reg['records']);s=s.replace('182 mecanisme/proveniențe',str(298-pending)+' mecanisme/proveniențe').replace('116 cazuri REVIEW_REQUIRED',str(pending)+' cazuri REVIEW_REQUIRED');readme.write_text(s,encoding='utf8',newline='\n')
 root=R/'docs/audits/auto3-osmb';m={p.relative_to(root).as_posix():{'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in sorted(root.rglob('*')) if p.is_file() and p.name!='sha256-manifest.json'};(root/'sha256-manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2,sort_keys=True)+'\n',encoding='utf8',newline='\n')
else:
 assert load('condrita-exact-cause.json')==out
 reg=json.loads(register.read_bytes());assert all(x['cause_status']=='OFFICIAL_OSM_SHARED_BOUNDARY_REVISION_DEMONSTRATED' for x in reg['records'] if x['case_id'] in {v['case_id'] for v in proof})
print(json.dumps({'status':'PASS','exact_reconstructions':len(proof),'changeset':190022801,'actual_modified':False,'legal_boundary_certified':False}))
