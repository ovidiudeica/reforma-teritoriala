"""Offline proof of three edit mechanisms and109 original OSM identity timelines."""
from pathlib import Path
import json,gzip,hashlib,math,re,csv,collections
import shapely,pyproj
from shapely.geometry import shape,Polygon,LineString
from shapely.ops import polygonize_full,unary_union
repo=Path(__file__).resolve().parents[2];root=repo/'docs/audits/auto4-history-followup-20261031';base=repo/'docs/audits/auto4-osmb-109'
load=lambda p:json.loads(p.read_bytes());canon=lambda v:json.dumps(v,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode('utf8');sha=lambda b:hashlib.sha256(b).hexdigest()
manifest=load(root/'sha256-manifest.json');files={p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file()};assert files==set(manifest)|{'sha256-manifest.json'}
for name,spec in manifest.items():
 assert not name.startswith('/') and '..' not in name and '\\' not in name;b=(root/name).read_bytes();assert sha(b)==spec['sha256'] and len(b)==spec['bytes'],name
retrieval=load(root/'retrieval.json');assert len(retrieval)==24
observation=load(root/'public-registry-browser-observation.json');assert observation['source_kind']=='NORMALIZED_BROWSER_ACCESSIBILITY_OBSERVATION_NOT_REGISTRY_EXTRACT'
assert all(observation[k] is False for k in ('query_submitted','identifier_transmitted','captcha_solved_or_bypassed','registry_record_acquired','negative_entity_existence_inference_allowed'))
required={'verify-persisted-release','actual-change-reproducibility','actual-release-trust-chain','p2-statistical-foundation','frontend-geometry-taxonomy','frontend-browser-qa'}
roadmap=load(repo/'docs/roadmap/autonomous-completion-register.json');tasks={t['id']:t for t in roadmap['tasks']};assert not roadmap['actual_mutation_allowed'] and not roadmap['p91_authorized'];assert roadmap['current_exception_state']['cartographic_explained']==189 and roadmap['current_exception_state']['review_required']==109
for pr,name in ((485,'auto4-pr485-postmerge-verification.json'),(486,'auto2-pr486-postmerge-verification.json')):
 receipt=load(root/name);assert receipt['pr']==pr and receipt['merged'] and receipt['postmerge_verified'];head=receipt['tested_head'];merge=receipt['merge_commit'];pc=receipt['pr_checks'];checks=receipt['postmerge_checks'];runs=receipt['postmerge_runs'];assert pc['total_count']==len(pc['check_runs']) and all(c['head_sha']==head and c['status']=='completed' and c['conclusion'] in ('success','skipped') for c in pc['check_runs']);assert required<={c['name'] for c in pc['check_runs'] if c['conclusion']=='success'}
 assert {c['name'] for c in pc['check_runs'] if c['conclusion']=='skipped'}=={'actual-change-repro-compare','actual-change-repro-${{ matrix.proof }}'}
 assert checks['total_count']==len(checks['check_runs']) and all(c['head_sha']==merge and c['status']=='completed' and c['conclusion']=='success' for c in checks['check_runs']);assert required<={c['name'] for c in checks['check_runs']}
 assert runs['total_count']==len(runs['workflow_runs'])==12 and all(r['head_sha']==merge and r['head_branch']=='main' and r['event']=='push' and r['status']=='completed' and r['conclusion']=='success' for r in runs['workflow_runs'])
 task=tasks['AUTO-4'] if pr==485 else tasks['AUTO-2']['normative_chain_integration'];assert task['pr']==pr and task['tested_head']==head and task['merge_commit']==merge
assert tasks['AUTO-4']['status']=='IN_PROGRESS' and tasks['AUTO-4']['integration_status']=='POST_MERGE_VERIFIED' and tasks['AUTO-2']['status']=='IN_PROGRESS' and tasks['AUTO-2']['normative_chain_integration_status']=='POST_MERGE_VERIFIED'
for name,r in retrieval.items():
 b=(root/r['compressed_file']).read_bytes();assert sha(b)==r['compressed_sha256'];raw=gzip.decompress(b);assert sha(raw)==r['sha256'] and len(raw)==r['bytes'] and r['status']==200
def original(name):return json.loads(gzip.decompress((root/'originals'/f'{name}.gz').read_bytes()))
targets=load(base/'register.json')['records'];assert len(targets)==109
index=load(root/'identity-history-index.json');assert len(index['records'])==109;indexed={r['case_id']:r for r in index['records']}
stats=load(root/'statistics.json');assert stats['by_jurisdiction']==dict(collections.Counter(r['jurisdiction'] for r in index['records']))=={'RO':10,'MD':99};assert stats['comparison_reference_origins']==dict(collections.Counter(r['comparison_reference_origin'] for r in index['records']))=={'OSMB_FIXED_SOURCE':108,'ACTUAL_ACCEPTED_SNAPSHOT_NOT_OSMB':1};assert stats['full_closures']==0 and stats['status']=={'REVIEW_REQUIRED':109} and stats['prior_explained_unchanged']==189
with (root/'decision-matrix.csv').open(encoding='utf8',newline='') as f:matrix=list(csv.DictReader(f))
assert len(matrix)==109 and {r['case_id'] for r in matrix}==set(indexed)
for row in matrix:
 x=indexed[row['case_id']];assert row['status']=='REVIEW_REQUIRED' and row['comparison_reference_origin']==x['comparison_reference_origin']
 for k,v in x['evidence_dimension_assessment'].items():assert row[k]==v['status']
for r in targets:
 x=indexed[r['case_id']];p=base/'osm'/f'{r["osm"]["type"]}{r["osm"]["id"]}-history.json.gz';b=p.read_bytes();assert sha(b)==x['history_compressed_sha256'];elements=json.loads(gzip.decompress(b))['elements'];previous={};timeline=[];assert x['status']=='REVIEW_REQUIRED' and not x['official_identity_certified'] and not x['legal_status_certified']
 for e in elements:
  tags=e.get('tags',{});selected={k:v for k,v in tags.items() if k in ('name','official_name','short_name','boundary','admin_level','place','landuse','type') or k.startswith('ref:')};changes={k:{'before':previous.get(k),'after':selected.get(k)} for k in sorted(set(previous)|set(selected)) if previous.get(k)!=selected.get(k)};timeline.append({'version':e['version'],'timestamp':e['timestamp'],'changeset':e.get('changeset'),'visible':e.get('visible',True),'identity_and_role_tags':selected,'tag_changes_since_previous':changes});previous=selected
 assert timeline==x['timeline'],r['case_id']
 names=list(dict.fromkeys(v['identity_and_role_tags'].get('name') for v in timeline if v['identity_and_role_tags'].get('name')));assert names==x['historical_names_as_osm_claims']
 refs={}
 for e in timeline:
  for k,v in e['identity_and_role_tags'].items():
   if k.startswith('ref:'):refs.setdefault(k,[]);refs[k]+=[v] if v not in refs[k] else []
 assert refs==x['reference_timeline_values'] and x['jurisdiction']==r['jurisdiction']
 assert x['comparison_reference_origin']==('OSMB_FIXED_SOURCE' if r['exception_kind']=='OSMB_ONLY' else 'ACTUAL_ACCEPTED_SNAPSHOT_NOT_OSMB')
 assert set(x['evidence_dimension_assessment'])=={'identity','geometry','administrative_level_and_role','parent_child_relationship','provenance_and_chronology'}
 assert all(v['status'] and v['missing'] for v in x['evidence_dimension_assessment'].values())
 shaped=[v for v in refs.get('ref:rson:idno',[]) if re.fullmatch(r'\d{13}',str(v))];latest=elements[-1].get('tags',{}).get('ref:rson:idno');assert x['previous_13_digit_key_missing_or_different_now']==bool(shaped and latest not in shaped)
proof=load(root/'reconstruction-proofs.json');currentbytes=(base/'geometry-results.json').read_bytes();assert sha(currentbytes)==proof['source_current_geometry_report_sha256'];current={r['case_id']:r for r in json.loads(currentbytes)['records']};bundlebytes=(repo/'docs/audits/auto3-osmb/geometry-cases.json.gz').read_bytes();assert sha(bundlebytes)==proof['source_geometry_bundle_sha256'];bundle=json.loads(gzip.decompress(bundlebytes));assert {r['case_id'] for r in proof['records']}=={'AUTO3-osm-r11793466','AUTO3-osm-w889101812','AUTO3-osm-w889101833'}
assert stats['current_reconstruction_reference_origins']==dict(collections.Counter(indexed[r['case_id']]['comparison_reference_origin'] for r in current.values() if 'geometry' in r['current_osm_comparison']))
assert stats['exact_equality_reference_origins']==dict(collections.Counter(indexed[r['case_id']]['comparison_reference_origin'] for r in current.values() if r['current_osm_comparison'].get('equals_archive')))
projection=pyproj.Transformer.from_crs(4326,3035,always_xy=True);area=lambda g:shapely.transform(g,projection.transform,interleaved=False).area
def assemble(typ,oid,nodes,ways,relations):
 coords=lambda refs:[(nodes[n]['lon'],nodes[n]['lat']) for n in refs]
 if typ=='way':return Polygon(coords(ways[oid]['nodes']))
 groups={'outer':[],'inner':[]}
 for m in relations[oid]['members']:
  if m['type']=='node':continue
  if m.get('role','') not in ('','outer','inner'):continue
  assert m['type']=='way';groups['inner' if m.get('role')=='inner' else 'outer'].append(LineString(coords(ways[m['ref']]['nodes'])))
 polygons={}
 for role,lines in groups.items():
  p,cuts,dangles,invalid=polygonize_full(lines);assert all(g.is_empty for g in (cuts,dangles,invalid));polygons[role]=unary_union(list(p.geoms))
 return polygons['outer'].difference(polygons['inner'])
for r in proof['records']:
 cid=r['case_id'];key=cid.removeprefix('AUTO3-');typ='relation' if key.startswith('osm-r') else 'way';oid=int(key[5:]);fullbytes=(base/'osm'/f'{typ}{oid}-full.json.gz').read_bytes();elements=json.loads(gzip.decompress(fullbytes))['elements'];nodes={e['id']:e for e in elements if e['type']=='node'};ways={e['id']:e for e in elements if e['type']=='way'};relations={e['id']:e for e in elements if e['type']=='relation'};now=assemble(typ,oid,nodes,ways,relations);assert now.equals(shape(current[cid]['current_osm_comparison']['geometry']))
 for edit in r['edit_witnesses']:
  if edit['type']=='NODE_MOVED_WITHOUT_WAY_VERSION_CHANGE':
   h=original(f'delta-node{edit["node_id"]}-history.json')['elements'];old=next(e for e in h if e['version']==edit['old_version']);new=next(e for e in h if e['version']==edit['new_version']);assert [old['lon'],old['lat']]==edit['old_coordinate'] and [new['lon'],new['lat']]==edit['new_coordinate'];assert nodes[edit['node_id']]['version']==new['version'];nodes[edit['node_id']]=old
  else:
   assert edit['type']=='ORDER_PRESERVING_NODE_INSERTIONS';h=original(f'delta-way{edit["way_id"]}-history.json')['elements'];old=next(e for e in h if e['version']==edit['old_way_version']);new=next(e for e in h if e['version']==edit['new_way_version']);nids={n['id'] for n in edit['inserted_nodes']};assert [n for n in new['nodes'] if n not in nids]==old['nodes'];assert set(new['nodes'])-set(old['nodes'])==nids
   for n in edit['inserted_nodes']:
    nh=original(f'delta-node{n["id"]}-history.json')['elements'];assert nh[0]['version']==1 and nh[0]['timestamp']==n['creation_timestamp'] and [nh[0]['lon'],nh[0]['lat']]==n['coordinate']
   ways[edit['way_id']]=old
 before=assemble(typ,oid,nodes,ways,relations);archive=shape(bundle[key]['source']['geometry']);assert before.is_valid and before.equals(archive) and before.equals(shape(r['inverse_geometry']));assert before.symmetric_difference(archive).is_empty
 witness=r['compatible_historical_state_witness'];assert sha(fullbytes)==witness['current_full_input_sha256'];time=witness['timestamp_utc'];assert time=='2026-10-05T23:59:59Z';refs={n for way in ways.values() for n in way['nodes']};assert all(nodes[n]['timestamp']<=time for n in refs) and all(w['timestamp']<=time for w in ways.values()) and all(v['timestamp']<=time for v in relations.values())
 assert witness['node_versions']==[{'id':n,'version':nodes[n]['version'],'valid_from':nodes[n]['timestamp'],'coordinate':[nodes[n]['lon'],nodes[n]['lat']]} for n in sorted(refs)]
 assert witness['way_versions']==[{'id':e['id'],'version':e['version'],'valid_from':e['timestamp'],'node_ids':e['nodes']} for e in sorted(ways.values(),key=lambda e:e['id'])]
 assert witness['relation_versions']==[{'id':e['id'],'version':e['version'],'valid_from':e['timestamp'],'members':e['members']} for e in relations.values()]
 for edit in r['edit_witnesses']:
  name=f'delta-node{edit["node_id"]}-history.json' if 'node_id' in edit else f'delta-way{edit["way_id"]}-history.json';h=original(name)['elements'];version=edit.get('old_version',edit.get('old_way_version'));a=next(e for e in h if e['version']==version);nxt=next(e for e in h if e['version']==version+1);assert a['timestamp']<=time<nxt['timestamp']
 assert math.isclose(area(now.symmetric_difference(archive)),r['current_archive_symmetric_difference_m2'],rel_tol=1e-11,abs_tol=1e-6)
 assert not r['source_export_epoch_certified'] and not r['legal_geometry_certified'] and not r['actual_mutation_allowed'] and not r['p91_authorized'] and r['global_status']=='REVIEW_REQUIRED'
print(json.dumps({'status':'PASS','individual_history_timelines':109,'exact_inverse_reconstructions':3,'original_new_responses':24,'osmb_export_epoch_certified':False,'legal_certifications':0,'actual_changes':0,'p91_authorized':False}))
