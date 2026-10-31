"""Reconstruct seven fixed MD differences from preserved histories; default is read-only."""
import json,gzip,copy,hashlib,collections,datetime,argparse,subprocess,sys
from pathlib import Path
from shapely.geometry import shape
repo=Path(__file__).resolve().parents[2];out=repo/'docs/audits/auto3-osmb/md-remaining-boundary-history'
ap=argparse.ArgumentParser();ap.add_argument('--apply-evidence',action='store_true');args=ap.parse_args()
facts=json.loads((out/'fixed-snapshot-facts.json').read_bytes());epochs={r['scope']:r['source_epoch'] for r in facts['sources']}
bundle=json.loads(gzip.decompress((repo/'docs/audits/auto3-osmb/geometry-cases.json.gz').read_bytes()))

# Verify the exact fixed subset against the pinned accepted snapshots; no feature census.
for source in facts['sources']:
 data=(repo/source['path']).read_bytes();assert hashlib.sha256(data).hexdigest()==source['sha256']
 records=[r for r in facts['records'] if r['scope']==source['scope']]
 wanted={(x['type'],x['id']):x for r in records for x in [r['relation']]+r['ways']+r['nodes']}
 parsed=json.loads(gzip.decompress(data));actual={(x['type'],x['id']):x for x in parsed['elements'] if (x['type'],x['id']) in wanted}
 assert actual==wanted,source['scope']
 del parsed,actual,data

for r in json.loads((out/'retrieval.json').read_bytes())['sources']:
 assert r['status']==200 and hashlib.sha256((out/r['file']).read_bytes()).hexdigest()==r['sha256']
 elements=json.loads((out/r['file']).read_bytes())['elements']
 assert elements and all(e['id']==r['id'] and e['type']==r['type'] for e in elements)
 assert [e['version'] for e in elements]==sorted({e['version'] for e in elements})
hist={int(p.name[4:-13]):json.loads(p.read_bytes())['elements'] for p in sorted(out.glob('node*-history.json'),key=lambda p:p.name)}
coord=lambda n:(n['lon'],n['lat'])
stamp=lambda s:datetime.datetime.fromisoformat(s.replace('Z','+00:00')).timestamp()
def rings(v):
 if v and v[0] and isinstance(v[0][0],(int,float)):return [v]
 return [r for x in v for r in rings(x)]
def transform(v,fn):
 if v and v[0] and isinstance(v[0][0],(int,float)):return fn(v)
 return [transform(x,fn) for x in v]
proof=[]
for case in facts['records']:
 d=bundle[case['geometry_key']];epoch=epochs[case['scope']];epoch_s=stamp(epoch);current={n['id']:n for n in case['nodes']};oldcoords=set(map(tuple,case['removed_coordinates']));newcoords=set(map(tuple,case['added_coordinates']));oldids=set();oldedges=collections.defaultdict(list);newedges=set();wayevents=[]
 for w in case['ways']:
  versions=json.loads((out/f"way{w['id']}-history.json").read_bytes())['elements'];targets=[v for v in versions if v.get('nodes')==w['nodes'] and stamp(v['timestamp'])<=epoch_s and ('version' not in w or v['version']==w['version'])];target=max(targets,key=lambda v:v['version'])
  for vi,v in enumerate(versions):
   if not v.get('nodes') or v['version']>target['version']:continue
   begin=stamp(v['timestamp']);end=min(epoch_s,stamp(versions[vi+1]['timestamp']) if vi+1<len(versions) else epoch_s)
   oldids.update(v['nodes'])
   for a,b in zip(v['nodes'],v['nodes'][1:]):oldedges[frozenset((a,b))].append({'way':w['id'],'version':v['version'],'start':begin,'end':end})
  newedges.update(frozenset((coord(current[a]),coord(current[b]))) for a,b in zip(w['nodes'],w['nodes'][1:]))
  wayevents.append({'way':w['id'],'version':target['version'],'changeset':target['changeset'],'timestamp':target['timestamp'],'node_list_matches_accepted_snapshot':True,'original_snapshot_version':w.get('version'),'version_match_policy':'PINNED_SNAPSHOT_VERSION' if 'version' in w else 'COMPATIBLE_HISTORY_WITNESS_EXACT_CAPTURE_VERSION_UNCERTIFIED'})
 oldmap=collections.defaultdict(list);coordstates=collections.defaultdict(list)
 for oid in sorted(oldids):
  if oid in hist:
   for vi,v in enumerate(hist[oid]):
    if 'lon' not in v or stamp(v['timestamp'])>epoch_s:continue
    if coord(v) in oldcoords:oldmap[coord(v)].append(v)
    end=min(epoch_s,stamp(hist[oid][vi+1]['timestamp']) if vi+1<len(hist[oid]) else epoch_s)
    coordstates[coord(v)].append({'node':oid,'version':v['version'],'start':stamp(v['timestamp']),'end':end})
 # Historical anchors need exact identities and overlapping node/way validity.
 changes={};edits=[];missing=[]
 for c in sorted(oldcoords):
  ids={v['id'] for v in oldmap[c]}
  if len(ids)!=1:missing.append({'coordinate':c,'candidate_ids':sorted(ids)});continue
  oid=next(iter(ids));old=max(oldmap[c],key=lambda v:v['version'])
  if oid in current:
   n=current[oid];versions=[v for v in hist[oid] if 'lon' in v and coord(v)==coord(n) and stamp(v['timestamp'])<=epoch_s and ('version' not in n or v['version']==n['version'])];target=max(versions,key=lambda v:v['version']);assert target['version']>old['version'];changes[c]=[list(coord(n))]
   edits.append({'node':oid,'operation':'MOVE','old_version':old['version'],'old_coordinate':c,'target_version':target['version'],'target_coordinate':coord(n),'changeset':target['changeset'],'timestamp':target['timestamp']})
  else:
   changes[c]=[];edits.append({'node':oid,'operation':'REMOVE_FROM_SELECTED_WAY_NETWORK','old_version':old['version'],'old_coordinate':c})
 old_edge_gaps=[];old_edge_witnesses=[]
 for ring in rings(d['source']['geometry']['coordinates']):
  for a,b in zip(ring,ring[1:]):
   a,b=tuple(a),tuple(b)
   if a not in oldcoords and b not in oldcoords:continue
   witnesses=[]
   for na in coordstates[a]:
    for nb in coordstates[b]:
     for w in oldedges[frozenset((na['node'],nb['node']))]:
      lo=max(na['start'],nb['start'],w['start']);hi=min(na['end'],nb['end'],w['end'])
      if lo<hi:witnesses.append({'node_a':na['node'],'version_a':na['version'],'node_b':nb['node'],'version_b':nb['version'],'way':w['way'],'way_version':w['version'],'compatible_from':datetime.datetime.fromtimestamp(lo,datetime.timezone.utc).isoformat(),'compatible_until_exclusive':datetime.datetime.fromtimestamp(hi,datetime.timezone.utc).isoformat()})
   if not witnesses:old_edge_gaps.append([a,b])
   else:old_edge_witnesses.append({'edge':[a,b],'witness':max(witnesses,key=lambda x:(x['compatible_from'],x['way'],x['way_version'],x['node_a'],x['version_a'],x['node_b'],x['version_b']))})
 def patch_nodes(ring):
  pts=[c for p in ring for c in changes.get(tuple(p),[p])]
  if pts and pts[0]!=pts[-1]:pts.append(pts[0])
  return pts
 candidate=copy.deepcopy(d['source']['geometry']);candidate['coordinates']=transform(candidate['coordinates'],patch_nodes)
 anchors={tuple(c) for ring in rings(candidate['coordinates']) for c in ring};insertions={};new_edge_gaps=[];inserted_events=[]
 for n in case['added_nodes']:
  versions=[v for v in hist[n['id']] if 'lon' in v and coord(v)==coord(n) and stamp(v['timestamp'])<=epoch_s and ('version' not in n or v['version']==n['version'])];assert versions,{'node':n['id'],'case':case['case_id']}
  target=max(versions,key=lambda v:v['version']);inserted_events.append({'node':n['id'],'version':target['version'],'coordinate':coord(n),'changeset':target['changeset'],'timestamp':target['timestamp'],'original_snapshot_version':n.get('version'),'version_match_policy':'PINNED_SNAPSHOT_VERSION' if 'version' in n else 'COMPATIBLE_HISTORY_WITNESS_EXACT_CAPTURE_VERSION_UNCERTIFIED'})
 for closed in rings(d['actual']['geometry']['coordinates']):
  ring=closed[:-1];idx=[i for i,c in enumerate(ring) if tuple(c) in anchors]
  for j,start in enumerate(idx):
   stop=idx[(j+1)%len(idx)];path=ring[start:stop+1] if stop>start else ring[start:]+ring[:stop+1]
   if len(path)<=2:continue
   assert all(tuple(c) in newcoords for c in path[1:-1])
   for a,b in zip(path,path[1:]):
    if frozenset((tuple(a),tuple(b))) not in newedges:new_edge_gaps.append([a,b])
   a,b=tuple(path[0]),tuple(path[-1]);value=path[1:-1]
   assert (a,b) not in insertions or insertions[a,b]==value
   insertions[a,b]=value;insertions[b,a]=value[::-1]
 def patch_insertions(ring):
  pts=[]
  for a,b in zip(ring,ring[1:]):pts.append(a);pts.extend(insertions.get((tuple(a),tuple(b)),[]))
  pts.append(ring[-1]);return pts
 candidate['coordinates']=transform(candidate['coordinates'],patch_insertions);geom=shape(candidate);actual=shape(d['actual']['geometry'])
 exact=geom.is_valid and geom.equals(actual)
 proof.append({'case_id':case['case_id'],'source_scope':case['scope'],'source_epoch':epoch,'reconstructed_geometry_valid':geom.is_valid,'reconstructed_geometry_equals_actual':exact,'symmetric_difference_degree2':geom.symmetric_difference(actual).area if geom.is_valid else None,'missing_old_coordinates':missing,'old_edges_without_attested_history':old_edge_gaps,'old_edge_temporal_witnesses':old_edge_witnesses,'new_edges_without_attested_snapshot':new_edge_gaps,'moved_or_removed_nodes':edits,'target_changed_coordinate_versions':inserted_events,'selected_way_versions':wayevents,'exact_cause_demonstrated':exact and not missing and not old_edge_gaps and not new_edge_gaps,'actual_modified':False,'legal_boundary_certified':False,'osmb_export_time_certified':False})
result=json.loads(json.dumps({'cases':proof,'historical_witnesses_do_not_certify_osmb_export_version':True,'source_geometries_modified':False,'actual_modified':False,'legal_boundary_certified':False}))
assert len(proof)==7 and all(r['exact_cause_demonstrated'] for r in proof)
assert {r['case_id'] for r in proof}=={'AUTO3-osm-r1691800','AUTO3-osm-r18822134','AUTO3-osm-r18822135','AUTO3-osm-r18967099','AUTO3-osm-r19100157','AUTO3-osm-r85827','AUTO3-stat-MD112'}
proofpath=out/'reconstruction-proofs.json'
if args.apply_evidence:
 proofpath.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
 register=repo/'docs/audits/auto3-osmb/register.json';reg=json.loads(register.read_bytes());byid={r['case_id']:r for r in proof};ref=proofpath.relative_to(repo).as_posix();digest=hashlib.sha256(proofpath.read_bytes()).hexdigest()
 for row in reg['records']:
  if row['case_id'] not in byid:continue
  row['cause_status']='OFFICIAL_OSM_NODE_WAY_HISTORY_AND_TEMPORAL_EDGES_DEMONSTRATED'
  row['cartographic_status']='CARTOGRAPHIC_RECONCILED'
  row['decision']='RETAIN_ACCEPTED_SNAPSHOT_CONTOUR_NO_LEGAL_INFERENCE'
  row['remaining_evidence']=['Exact OSMB per-object export/version timestamp remains uncertified; the demonstrated history and exact reconstruction do not certify administrative or legal boundaries.']
  row['demonstrated_findings']=[x for x in row['demonstrated_findings'] if x.get('proof')!=ref]
  row['demonstrated_findings'].append({'finding':'Every changed source coordinate is matched to an original node history; every affected old edge has node/way versions with overlapping validity intervals; every inserted edge is in the pinned accepted way network; reconstruction equals ACTUAL exactly','proof':ref,'proof_sha256':digest})
  row['existing_audit_evidence']=[x for x in row['existing_audit_evidence'] if x.get('path')!=ref];row['existing_audit_evidence'].append({'path':ref,'sha256':digest})
 register.write_text(json.dumps(reg,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
 # Existing refresh updates the shared matrix, statistics and roadmap without ACTUAL writes.
 subprocess.check_call([sys.executable,str(repo/'scripts/audit/auto3-osmb-md-source-history.py'),'--apply-evidence'])
 readme=repo/'docs/audits/auto3-osmb/README.md';s=readme.read_text(encoding='utf8').split('\n## Încă șapte istorii MD')[0]
 s+='\n## Încă șapte istorii MD\n\nȘapte contururi sunt reconstruite exact din geometriile OSMB folosind istoriile originale ale nodurilor și căilor: Ialoveni 1691800, Malcoci 18822134, Nimoreni 18822135 și 18967099, Scoreni 19100157, Strășeni 85827 și regiunea statistică Centru MD112. Fiecare muchie istorică afectată are versiuni de noduri și cale cu intervale de valabilitate suprapuse; muchiile introduse sunt atestate de snapshotul acceptat. Sunt excluse versiunile ulterioare fiecărui snapshot. Nu se deduce ora exactă a exportului OSMB, nu se certifică hotare juridice și nu se schimbă ACTUAL.\n\nReproducere fără rețea: `python scripts/audit/auto3-osmb-md-remaining-histories.py`. Registrul are acum 189 cazuri cu mecanism/proveniență cartografică documentată și 109 REVIEW_REQUIRED; toate păstrează separat verdictul juridic și `resolved_globally=false`.\n'
 readme.write_text(s,encoding='utf8',newline='\n')
 audit=repo/'docs/audits/auto3-osmb';manifest={p.relative_to(audit).as_posix():{'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in sorted(audit.rglob('*'),key=lambda p:p.relative_to(audit).as_posix()) if p.is_file() and p.name!='sha256-manifest.json'}
 (audit/'sha256-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2,sort_keys=True)+'\n',encoding='utf8',newline='\n')
else:
 assert json.loads(proofpath.read_bytes())==result
 reg=json.loads((repo/'docs/audits/auto3-osmb/register.json').read_bytes())
 assert all(r['cause_status']=='OFFICIAL_OSM_NODE_WAY_HISTORY_AND_TEMPORAL_EDGES_DEMONSTRATED' for r in reg['records'] if r['case_id'] in {p['case_id'] for p in proof})
print(json.dumps({'status':'PASS','exact_reconstructions':7,'all_changed_old_edges_temporally_attested':True,'actual_modified':False,'legal_boundary_certified':False}))
