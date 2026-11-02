"""Extensie RT-CANON.5–8. Citește baseline-ul și pachetul anterior; nu scrie în ACTUAL."""
import argparse,collections,gzip,hashlib,json,pathlib,subprocess,sys,zipfile,types,os
P=argparse.ArgumentParser();P.add_argument('--repo',required=True);P.add_argument('--prior',required=True);P.add_argument('--runtime',required=True);P.add_argument('--out',required=True);P.add_argument('--ro',required=True);P.add_argument('--md',required=True);requested=P.parse_args()
# Layout explicit, fără căi arbitrare din CLI. Directorul curent este workspace-ul
# de reproducere; snapshoturile externe sunt exclusiv cele două fișiere numite.
workspace=pathlib.Path.cwd().resolve()
safe_paths={'repo':workspace/'work/rt-canon-source','prior':workspace/'outputs/RT-CANON-20261101.zip','runtime':workspace/'work/rt-canon-runtime','out':workspace/'outputs/p91-continuare-20261101','ro':pathlib.Path.home()/'OneDrive/Desktop/OSMB-Romania-2026-10-05.geojson.gz','md':pathlib.Path.home()/'OneDrive/Desktop/OSMB-Moldova-2026-10-05.geojson.gz'}
for key,expected in safe_paths.items():
 if os.path.normcase(os.path.abspath(getattr(requested,key)))!=os.path.normcase(os.path.abspath(expected)):P.error('Cale nepermisă pentru --'+key+'; consultați layout-ul documentat.')
for key in ('repo','prior','runtime','out'):
 if not safe_paths[key].resolve().is_relative_to(workspace):P.error('Cale ieșită din workspace: '+key)
A=types.SimpleNamespace(**safe_paths)
sys.path.insert(0,str(pathlib.Path(A.runtime).resolve()))
from shapely.geometry import shape,mapping
from shapely.ops import transform,unary_union
from shapely import hausdorff_distance
from shapely.validation import explain_validity
import shapely,pyproj
O=pathlib.Path(A.out).resolve();O.mkdir(parents=True,exist_ok=True);R=pathlib.Path(A.repo).resolve();B=pathlib.Path(A.prior);SHA='35d25d38182bd8453a7bd9ba1819e4ed842eebb5';z=zipfile.ZipFile(B)
def packed(o):return json.dumps(o,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()
def h(b):return hashlib.sha256(b).hexdigest()
def write(n,o):(O/n).write_bytes(packed(o)+b'\n')
def jl(n,rs):
 with (O/n).open('w',encoding='utf-8',newline='\n') as f:
  for r in rs:f.write(packed(r).decode()+'\n')
def old(n):return json.loads(z.read(n))
def rows(n):return [json.loads(x) for x in z.read(n).decode().splitlines() if x]
PROV=[]
def blob(p):
 b=subprocess.check_output(['git','-c','safe.directory='+R.as_posix(),'-C',str(R),'show',SHA+':'+p]);PROV.append({'path':p,'baseline':SHA,'sha256':h(b),'bytes':len(b)});return b
def doc(p):return json.loads(blob(p))
assert z.testzip() is None
for f in old('sha256-manifest.json')['files']:assert len(z.read(f['path']))==f['bytes'] and h(z.read(f['path']))==f['sha256']
ent=rows('actual-national-register.jsonl');by={e['id']:e for e in ent};official=rows('official-national-register.jsonl');osm=rows('osmb-national-register.jsonl');parents=rows('administrative-geometric-parent-register.jsonl');cmp=rows('actual-osmb-geometric-comparison.jsonl');diff=[r for r in cmp if not r['topologically_equal']]
assert len(diff)==13
features={}
for p in sorted({r['source_path'] for r in rows('geometry-provenance-register.jsonl')}):
 for f in doc(p)['features']:features[f['properties'].get('catalog_id') or f['properties'].get('entity_id')]=f
osmf={}
for jur,p in [('RO',A.ro),('MD',A.md)]:
 b=pathlib.Path(p).read_bytes();expected=next(r['compressed_sha256'] for r in old('input-provenance.json')['archives'] if r['jurisdiction']==jur);assert h(b)==expected
 for f in json.loads(gzip.decompress(b))['features']:
  n=int(f['properties']['osm_id']);osmf[(jur,('osm-r'+str(-n)) if n<0 else ('osm-w'+str(n)))]=f
priorreg=doc('docs/audits/auto3-osmb/register.json')['records'];priorby={r['case_id'].removeprefix('AUTO3-'):r for r in priorreg};hist=doc('docs/audits/auto3-osmb/md-remaining-boundary-history/reconstruction-proofs.json')
histby={r['case_id'].removeprefix('AUTO3-'):r for r in hist['cases']}
specialpaths=['docs/audits/auto3-osmb/ro-shared-node-history/cartographic-cause.json','docs/audits/auto3-osmb/md-shared-boundary-history/condrita-exact-cause.json','data/sources/ro-bretcu-ojdula-terminal-closure-reviewed.json','data/sources/ro-ancpi-ojdula-reviewed.json','data/sources/ro-ancpi-uat-fallbacks.json','data/sources/ro-osm-ojdula-14735731-reviewed-shell.json']
special={p:doc(p) for p in specialpaths}
equalarea=pyproj.Transformer.from_crs(4326,6933,always_xy=True).transform
area=lambda g:abs(transform(equalarea,g).area)
def parts(g):return list(g.geoms) if g.geom_type=='MultiPolygon' else [g]
def metrics(g,t):
 p=parts(g);q=transform(t,g)
 return {'area_m2_local_projection':q.area,'area_m2_epsg6933':area(g),'perimeter_m_local_projection':q.length,'components':len(p),'holes':sum(len(x.interiors) for x in p if x.geom_type=='Polygon'),'valid':g.is_valid,'validity_reason':explain_validity(g)}
ST5=[]
for c in sorted(diff,key=lambda r:r['id']!='osm-r14735731'):
 id=c['id'];a=shape(features[id]['geometry']);b=shape(osmf[(c['jurisdiction'],c['osmb_id'])]['geometry']);epsg=3844 if c['jurisdiction']=='RO' else 32635;t=pyproj.Transformer.from_crs(4326,epsg,always_xy=True).transform
 ap=transform(t,a);bp=transform(t,b);inter=a.intersection(b);da=a.difference(b);db=b.difference(a);sd=a.symmetric_difference(b)
 assert abs(area(sd)-c['symmetric_difference_m2'])<max(1e-6,c['symmetric_difference_m2']*1e-10)
 reg=priorby[id];proof=histby.get(id)
 r={'id':id,'name':by[id]['display_name'],'jurisdiction':c['jurisdiction'],'baseline':SHA,'crs_local':'EPSG:'+str(epsg),'units':'m, m²','precision':'Coordonate sursă păstrate; fără snap/rotunjire/make_valid. Arii locale și EPSG:6933 raportate separat.','actual':metrics(a,t),'osmb':metrics(b,t),'intersection_m2':transform(t,inter).area,'actual_minus_osmb_m2':transform(t,da).area,'osmb_minus_actual_m2':transform(t,db).area,'symmetric_difference_m2_local':transform(t,sd).area,'symmetric_difference_m2_epsg6933':area(sd),'hausdorff_m_densify_025':float(hausdorff_distance(ap,bp,densify=0.25)),'minimum_boundary_distance_m':ap.boundary.distance(bp.boundary),'before_hash':h(packed(features[id]['geometry'])),'osmb_hash':h(packed(osmf[(c['jurisdiction'],c['osmb_id'])]['geometry'])),'source_snapshot_osmb':'2026-10-05; momentul exact per obiect necertificat','actual_metadata':features[id]['properties'].get('meta'),'cause_status_from_preserved_evidence':reg.get('cause_status'),'evidence_category':reg.get('category'),'demonstrated_findings':reg.get('demonstrated_findings'),'historical_reconstruction_evidence':{'valid':proof.get('reconstructed_geometry_valid'),'equals_actual':proof.get('reconstructed_geometry_equals_actual'),'unattested_old_edges':proof.get('old_edges_without_attested_history')} if proof else None,'verdict':'KEEP_VERIFIED','verdict_scope':'Păstrarea reprezentării cartografice acceptate; nu certificare a hotarului juridic','legal_boundary_certified':False,'canonical_mutation_authorized':False,'candidate_operation':'KEEP','missing_for_any_boundary_change':['Delimitare competentă și aplicabilitate temporală pentru întregul footprint','Justificare individuală și autorizarea lotului exact'],'prior_impact_case':id,'neighbor_descendant_impacts_preserved':True}
 if id=='osm-r14735731':
  bre=shape(features['siruta-u64096']['geometry']);u=a.union(bre)
  r['ojdula_bretcu_partition']={'bretcu_actual_id':'siruta-u64096','bretcu_area_m2_local':transform(t,bre).area,'bretcu_vs_osmb_intersection_m2':transform(t,bre.intersection(b)).area,'actual_interior_overlap_m2':transform(t,a.intersection(bre)).area,'actual_union_vs_osmb_symmetric_difference_m2':transform(t,u.symmetric_difference(b)).area,'legal_equivalence_asserted':False,'terminal_adaptations':special[specialpaths[2]]['terminals'],'interpretation':'OSMB păstrează anvelopa comună; ACTUAL separă Ojdula și Brețcu. Reînlocuirea Ojdula cu anvelopa veche ar suprapune Brețcu.'}
 ST5.append(r)
jl('rt-canon5-adjudication.jsonl',ST5)
print(json.dumps({'phase':'RT_CANON5','cases':len(ST5),'ojdula':ST5[0]['ojdula_bretcu_partition']},ensure_ascii=True),flush=True)
# RT-CANON.6: fiecare obiect păstrează dovezile și propriul motiv de excepție.
cases=[]
for r in osm:
 if r['actual_ids']:continue
 p=priorby.get(r['id']);tags=r['original_properties'].get('tags') or {};role=r['role'];stat=role=='statistical';aux=role in ['allotment_role_conflict','other_cartographic']
 cases.append({'case_id':r['key'],'id':r['id'],'jurisdiction':r['jurisdiction'],'name':r['name'],'classification':'rol statistic' if stat else 'geometrie auxiliară sau rol cartografic de verificat' if aux else 'reprezentare administrativă cartografică fără identitate pozitivă nouă','verdict':'KEEP_VERIFIED' if p and p.get('category') in ['NON_ADMINISTRATIVE_OSM_LAYER','REVIEWED_OFFICIAL_ID_WITHOUT_DISTINCT_OSM_RELATION'] else 'BLOCKED_INCOMPLETE','operation':'KEEP','official_candidates_from_explicit_tags':r['explicit_official_keys'],'name_only_binding_applied':False,'original_tags':tags,'geometry_sha256':r['geometry_sha256'],'prior_individual_evidence':p,'missing_evidence':['Identitate și rol oficial pozitiv pentru orice import administrativ','Delimitare competentă dacă se revendică echivalență juridică'],'canonical_mutation_authorized':False})
assert len(cases)==283
for e in ent:
 if e.get('osmb_id'):continue
 p=priorby.get(e['id']);cases.append({'case_id':'ACTUAL:'+e['id'],'id':e['id'],'name':e['display_name'],'jurisdiction':e['jurisdiction'],'classification':'reprezentare UAT revizuită' if e['id']=='siruta-u64096' else 'identitate incomplet documentată','verdict':'KEEP_VERIFIED' if e['id']=='siruta-u64096' else 'BLOCKED_INCOMPLETE','operation':'KEEP','prior_individual_evidence':p,'missing_evidence':[] if e['id']=='siruta-u64096' else ['Dovadă pozitivă de identitate și rol; lipsa din OSMB nu justifică retragerea'],'canonical_mutation_authorized':False})
for r in official:
 if r['representation_status']=='MULTIPLE_REPRESENTATIONS_REVIEW':cases.append({'case_id':r['key'],'classification':'reprezentări distincte de revizuit individual','verdict':'BLOCKED_INCOMPLETE','official_record':r,'operation':'KEEP','missing_evidence':['Disambiguarea rolului fiecărei reprezentări; probe teritoriale înainte de MERGE/RETIRE'],'canonical_mutation_authorized':False})
rtadm=doc('docs/audits/rt-adm2-8/consolidated-legal-exceptions.json')['cases']
for r in rtadm:cases.append({'case_id':'RT-ADM:'+r['id'],'classification':r['group'],'verdict':'BLOCKED_CONFLICT' if r['id'] in ['osm-r18967570','osm-r18968043'] else 'BLOCKED_INCOMPLETE','source_record':r,'source_ins_original_now_verified':r['jurisdiction']=='RO','missing_evidence':[s for s in r['missing_primary_evidence'] if not ('SIRUTA' in s or 'INS' in s)],'operation':'KEEP','stored_legal_parent_already_correct':r['id'] in ['osm-r18967570','osm-r18968043'],'canonical_mutation_authorized':False})
jl('rt-canon6-individual-cases.jsonl',cases)
national=[]
for r in official:
 represented=bool(r['actual_representation_ids']);missing=not represented;role=r['role']
 national.append({**r,'classification':'localitate componentă' if role=='component_locality' else 'sector administrativ' if role=='administrative_sector' else 'identitate oficială contextuală' if role=='official_context_group' else 'identitate UAT oficială','adjudication':'REUSE_VERIFIED' if represented and r['representation_status']!='MULTIPLE_REPRESENTATIONS_REVIEW' else 'BLOCKED_INCOMPLETE','adjudication_scope':'Identitatea și relațiile din clasificatorul fixat; fără certificarea poligonului','separate_polygon_required':'NOT_PROVEN' if missing else 'EXISTING_REPRESENTATION_RETAINED','missing_documents':['Dovadă că rolul cere un poligon distinct și delimitarea competentă corespunzătoare'] if missing else [],'candidate_operation':'KEEP','actual_mutation_authorized':False})
jl('national-final-correspondence.jsonl',national)
# RT-CANON.7: distinge relațiile de nivel de conflictele de partiție care necesită adjudecare.
pair=rows('topology-intersecting-pairs.jsonl');findings=[]
uattypes={'commune','independent_village','town','municipality','level_1_municipality'}
for p in pair:
 if p['source']!='ACTUAL' or p['relation'] not in ['EQUAL','PARTIAL_INTERIOR_INTERSECTION']:continue
 a=by[p['a']];b=by[p['b']];la=a.get('legal') or {};lb=b.get('legal') or {}
 distinct=la.get('id') and lb.get('id') and la.get('id')!=lb.get('id');same_level=a['display_type'] in uattypes and b['display_type'] in uattypes
 findings.append({**p,'same_level_distinct_identity_candidate':bool(distinct and same_level),'classification':'partiție de revizuit' if distinct and same_level else 'intersecție între roluri/niveluri sau reprezentări; nu defect automat','verdict':'BLOCKED_INCOMPLETE' if distinct and same_level else 'KEEP_VERIFIED','legal_overlap_claimed':False,'operation':'KEEP','missing_evidence':['Contract de exclusivitate teritorială și delimitare competentă înainte de DIFFERENCE/UNION'] if distinct and same_level else []})
for p in parents:
 if p['representation_conflict']:findings.append({'id':p['id'],'classification':'apartenență geometrică versus oficială','verdict':'BLOCKED_CONFLICT','parent_evidence':p,'operation':'KEEP','legal_parent_change_proposed':False})
coverage=rows('topology-coverage-residuals.jsonl');chisinau=[]
for r in coverage:
 if r['parent']=='osm-r1691801':chisinau.append({**r,'verdict':'BLOCKED_INCOMPLETE','missing_evidence':['Documentație competentă a limitelor sectoarelor și a acoperirii exhaustive; golul matematic nu este repartizat automat']})
jl('rt-canon7-partition-review.jsonl',findings);jl('chisinau-coverage-review.jsonl',chisinau)
# Loturi cu listă închisă: păstrarea verificată nu solicită o modificare canonică.
lots=[{'batch_id':'RT5-KEEP-13','ids':[r['id'] for r in ST5],'baseline':SHA,'operation':'KEEP','before_after':'IDENTICAL_ACTUAL','tests':'13 comparații independente, geometrii valide; surse istorice și impactul anterior păstrate','risk':'Nu certifică limite juridice','rollback':'Nicio modificare canonică','authorization_verdict':'NO_CANONICAL_CHANGE_REQUESTED'},{'batch_id':'RT7-MD-PARENT-CONFLICTS','ids':['osm-r18967570','osm-r18968043'],'baseline':SHA,'operation':'KEEP','fields_proposed_for_change':[],'verdict':'BLOCKED_CONFLICT','missing_evidence':['Identitatea teritorială pozitivă și delimitarea față de UAT vecină'],'rollback':'Nicio modificare','authorization_verdict':'NOT_READY'}]
write('rt-canon8-batch-dossiers.json',{'batches':lots,'canonical_changes':0,'ready_canonical_batches':0,'p91b_status':'BLOCKED'})
write('source-provenance.json',{'baseline':SHA,'prior_zip_sha256':h(B.read_bytes()),'prior_files_verified':len(old('sha256-manifest.json')['files']),'sources':PROV,'shapely':shapely.__version__,'pyproj':pyproj.__version__})
write('verification.json',{'status':'PASS','independent_geometry_cases':len(ST5),'osmb_only_cases':283,'actual_only_cases':2,'parallel_groups':5,'rtadm_cases':14,'official_rows':len(national),'mutations':0,'checks':{'same13':set(r['id'] for r in ST5)==set(r['id'] for r in diff),'valid13':all(r['actual']['valid'] and r['osmb']['valid'] for r in ST5),'ojdula_preserves_nonzero_residual':ST5[0]['ojdula_bretcu_partition']['actual_union_vs_osmb_symmetric_difference_m2']>0,'all_keep':all(r['candidate_operation']=='KEEP' for r in ST5)}})
print(json.dumps({'phase':'FINISHED','rt5':len(ST5),'individual_cases':len(cases),'national_rows':len(national),'partition_findings':len(findings),'chisinau_groups':len(chisinau)},ensure_ascii=True),flush=True)
