"""Prove the two RO contour differences from original OSM histories; default read-only.
--apply-evidence updates only derived AUTO-3 documentation, never ACTUAL.
"""
import argparse,gzip,json,hashlib,copy,csv,collections
from pathlib import Path
from shapely.geometry import shape
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'docs/audits/auto3-osmb';SRC=OUT/'ro-shared-node-history'
sha=lambda b:hashlib.sha256(b).hexdigest()
load=lambda p:json.loads(p.read_bytes())
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--apply-evidence',action='store_true');a=ap.parse_args()
 acquisition=load(SRC/'retrieval.json')
 for row in acquisition['sources']:assert row['status']==200 and sha((SRC/(row['id']+'.json')).read_bytes())==row['sha256']
 moved=load(SRC/'node7251357104-history.json')['elements'];new=load(SRC/'node14251631333-history.json')['elements'];ways=load(SRC/'way777134710-history.json')['elements']
 oldnode=next(x for x in moved if x['version']==1);movednode=next(x for x in moved if x['version']==2);inserted=next(x for x in new if x['version']==1)
 oldway=next(x for x in ways if x['version']==1);newway=next(x for x in ways if x['version']==2)
 assert movednode['changeset']==inserted['changeset']==newway['changeset']==190023879
 assert movednode['timestamp']==inserted['timestamp']==newway['timestamp']=='2026-10-05T09:41:11Z'
 assert [x for x in newway['nodes'] if x!=14251631333]==oldway['nodes']
 diagnostic=load(SRC/'source-diagnostic.json')
 assert {x['id'] for x in diagnostic['relations']}=={14772881,10761201}
 assert all(any(m['type']=='way' and m['ref']==777134710 for m in r['members']) for r in diagnostic['relations'])
 old=[oldnode['lon'],oldnode['lat']];replacement=[[inserted['lon'],inserted['lat']],[movednode['lon'],movednode['lat']]]
 assert old==[26.4941608,46.8443263]
 geometries=load(OUT/'register.json');bundle=json.loads(gzip.decompress((OUT/'geometry-cases.json.gz').read_bytes()));proofs=[]
 def patch_ring(v,order):
  if isinstance(v,list) and len(v)>=2 and isinstance(v[0],(float,int)):return order if v==old else [v]
  output=[]
  for child in v:
   if isinstance(child,list) and child and isinstance(child[0],(float,int)):output.extend(patch_ring(child,order))
   else:output.append(patch_ring(child,order))
  return output
 for key in ['osm-r10761201','osm-r14772881']:
  data=bundle[key];actual=shape(data['actual']['geometry']);matches=[]
  for order in [replacement,replacement[::-1]]:
   candidate=copy.deepcopy(data['source']['geometry']);candidate['coordinates']=patch_ring(candidate['coordinates'],order)
   if shape(candidate).is_valid and shape(candidate).equals(actual):matches.append(order)
  assert len(matches)==1,{'case':key,'matching_reconstructions':len(matches)}
  proofs.append({'case_id':'AUTO3-'+key,'shared_way':777134710,'removed_old_node_coordinate':old,'node_7251357104_version_2_coordinate':[movednode['lon'],movednode['lat']],'inserted_node_14251631333_coordinate':[inserted['lon'],inserted['lat']],'unique_ring_order_reproducing_actual':matches[0],'all_other_source_coordinates_preserved':True,'reconstructed_geometry_equals_actual':True,'source_geometry_modified':False})
 result={'cases':proofs,'causal_changeset':190023879,'edit_timestamp':'2026-10-05T09:41:11Z','finding':'OSMB contours match the earlier shared-way node configuration; ACTUAL contours match the later configuration, and changing only these two node positions reconstructs both ACTUAL polygons exactly.','osmb_exact_export_timestamp_certified':False,'legal_boundary_certified':False,'actual_modified':False,'p91_authorized':False}
 proofpath=SRC/'cartographic-cause.json'
 if a.apply_evidence:
  proofpath.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
  for row in geometries['records']:
   if row['case_id'] not in {x['case_id'] for x in proofs}:continue
   row['cause_status']='OFFICIAL_OSM_NODE_AND_WAY_VERSION_DIVERGENCE_DEMONSTRATED';row['cartographic_status']='CARTOGRAPHIC_RECONCILED';row['decision']='RETAIN_ACCEPTED_LATER_OSM_CONTOUR_NO_LEGAL_INFERENCE';row['remaining_evidence']=['Exact OSMB per-object export/version timestamp is not supplied; legal-boundary equivalence remains outside this cartographic finding.']
   proof='docs/audits/auto3-osmb/ro-shared-node-history/cartographic-cause.json'
   row['demonstrated_findings']=[x for x in row['demonstrated_findings'] if x.get('proof')!=proof]
   row['demonstrated_findings'].append({'finding':'Only the moved/inserted nodes of changeset 190023879 are needed to reconstruct this ACTUAL polygon exactly from the OSMB contour','proof':proof,'proof_sha256':sha(proofpath.read_bytes())})
   row['existing_audit_evidence']=[x for x in row['existing_audit_evidence'] if x.get('path')!=proof]
   row['existing_audit_evidence'].append({'path':proof,'sha256':sha(proofpath.read_bytes())})
  (OUT/'register.json').write_text(json.dumps(geometries,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
  stats=load(OUT/'statistics.json')
  for c in ['RO','MD']:stats['by_jurisdiction'][c]['cartographic_status']=dict(sorted(collections.Counter(x['cartographic_status'] for x in geometries['records'] if x['jurisdiction']==c).items()))
  (OUT/'statistics.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
  byid={x['case_id']:x for x in geometries['records']}
  with (OUT/'decision-matrix.csv').open(encoding='utf8',newline='') as f:matrix=list(csv.DictReader(f))
  for row in matrix:
   for k in ['cause_status','cartographic_status','decision','remaining_evidence']:
    val=byid[row['case_id']][k];row[k]=json.dumps(val,ensure_ascii=False) if isinstance(val,list) else val
  with (OUT/'decision-matrix.csv').open('w',encoding='utf8',newline='') as f:
   w=csv.DictWriter(f,fieldnames=list(matrix[0]),lineterminator='\n');w.writeheader();w.writerows(matrix)
  readme=(OUT/'README.md').read_text(encoding='utf8').split('\n## Istoric OSM suplimentar')[0]
  lines=readme.splitlines()
  for i,line in enumerate(lines):
   if line.startswith('| AUTO3-'):
    cid=line.split('|')[1].strip();row=byid[cid];lines[i]='| '+' | '.join(str(row[k]).replace('|','/') for k in ['case_id','jurisdiction','name','category','cartographic_status','decision'])+' |'
  readme='\n'.join(lines)+'\n\n## Istoric OSM suplimentar\n\nIstoriile API OSM originale (HTTP 200, SHA-256) ale nodurilor 7251357104/14251631333 și ale căii 777134710 demonstrează changesetul 190023879 din 2026-10-05T09:41:11Z. Mutarea primului nod și inserarea celui de-al doilea reconstruiesc exact ambele geometrii ACTUAL Săvinești/Roznov din contururile OSMB, cu toate celelalte coordonate păstrate. Ora exactă a exportului OSMB nu este dedusă din acest rezultat. Verificare: `python scripts/audit/auto3-osmb-ro-source-history.py`.\n\nDupă această probă nouă, 180 de cazuri au mecanism/proveniență cartografică documentată, iar 118 rămân REVIEW_REQUIRED. Nicio certificare juridică nouă și nicio modificare ACTUAL.\n'
  pending=sum(x['cartographic_status']=='REVIEW_REQUIRED' for x in geometries['records'])
  readme=readme.replace('După această probă nouă, ','Bilanțul curent al registrului: ').replace('180 de cazuri',f'{len(geometries["records"])-pending} de cazuri').replace('118 rămân',f'{pending} rămân')
  (OUT/'README.md').write_text(readme,encoding='utf8',newline='\n')
  roadmap=ROOT/'docs/roadmap/autonomous-completion-register.json'
  if roadmap.exists():
   state=load(roadmap)
   for task in state['tasks']:
    if task['id']=='AUTO-3-FOLLOWUP':task['description']=f'Dovezi suplimentare pentru cele {pending} cazuri REVIEW_REQUIRED'
   roadmap.write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
  manifest={p.relative_to(OUT).as_posix():{'sha256':sha(p.read_bytes()),'bytes':p.stat().st_size} for p in sorted(OUT.rglob('*')) if p.is_file() and p.name!='sha256-manifest.json'}
  (OUT/'sha256-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
 else:
  assert load(proofpath)==result
  assert all(r['cause_status']=='OFFICIAL_OSM_NODE_AND_WAY_VERSION_DIVERGENCE_DEMONSTRATED' for r in geometries['records'] if r['case_id'] in {x['case_id'] for x in proofs})
 print(json.dumps({'status':'PASS','cases':2,'exact_reconstructions':2,'changeset':190023879,'actual_modified':False,'legal_boundary_certified':False}))
if __name__=='__main__':main()
