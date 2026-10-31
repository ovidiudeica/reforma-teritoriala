"""AUTO-3: targeted reconciliation of the fixed 298 exceptions, never an ACTUAL writer.
python scripts/audit/auto3-osmb-reconcile.py --baseline PATH --archives PATH
Requires shapely 2.2.0, pyproj 3.8.0, numpy 2.5.4. No network requests.
"""
import argparse,collections,csv,gzip,hashlib,json,re,subprocess,sys
from pathlib import Path
import shapely,pyproj
from shapely.geometry import shape,mapping
from shapely.strtree import STRtree

ROOT=Path(__file__).resolve().parents[2]
BASE='f38e6b81c2da03644e5558b9b25c0481c3f17dbd'
sha=lambda b:hashlib.sha256(b).hexdigest()
canon=lambda x:json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode('utf8')
def osmkey(n):return f'osm-r{-n}' if n<0 else f'osm-w{n}'
def readcsv(p):
 with p.open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
def counter(xs):return dict(sorted(collections.Counter(xs).items()))
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--baseline',type=Path,required=True);ap.add_argument('--archives',type=Path,required=True);a=ap.parse_args()
 out=ROOT/'docs/audits/auto3-osmb';out.mkdir(parents=True,exist_ok=True)
 git=['git','-c',f'safe.directory={ROOT.as_posix()}','-C',str(ROOT)]
 inputs={}
 def blob(p):
  b=subprocess.check_output(git+['show',BASE+':'+p]);inputs[p]={'sha256':sha(b),'bytes':len(b),'git_commit':BASE};return b
 def load(p):return json.loads(blob(p))
 def put(p,d):
  q=out/p;q.parent.mkdir(exist_ok=True,parents=True);q.write_bytes(json.dumps(d,ensure_ascii=False,indent=2,allow_nan=False,sort_keys=p=='sha256-manifest.json').encode('utf8')+b'\n')
 def csvout(p,rows):
  with (out/p).open('w',encoding='utf8',newline='') as f:
   w=csv.DictWriter(f,fieldnames=list(rows[0]),lineterminator='\n');w.writeheader()
   for row in rows:w.writerow({k:json.dumps(v,ensure_ascii=False) if isinstance(v,(list,dict)) else v for k,v in row.items()})
 prior=json.loads((a.baseline/'rezumat.json').read_bytes());assert prior['repository_commit']==BASE
 manifest=json.loads((a.baseline/'manifest-rezultate-sha256.json').read_bytes())
 for name in ['RAPORT.md','reconciliere-osmb-actual.csv','actual-fara-corespondent-osmb.json','diferente-geometrice.json','metadata-originale.jsonl']:
  assert sha((a.baseline/name).read_bytes())==manifest[name]['sha256'],name
 zipfile=a.baseline.parent/'audit-osmb-20261005.zip'
 expectedzip=(zipfile.with_suffix('.zip.sha256')).read_text().split()[0]
 assert sha(zipfile.read_bytes())==expectedzip
 baseline_rows=readcsv(a.baseline/'reconciliere-osmb-actual.csv')
 selected=[x for x in baseline_rows if x['match_status']=='OSMB_ONLY' or x['geometry_status']=='DIFFERENT']
 onlyactual=json.loads((a.baseline/'actual-fara-corespondent-osmb.json').read_bytes())
 assert len(selected)==296 and len(onlyactual)==2
 targets={x['osmb_key'] for x in selected};meta={}
 for line in (a.baseline/'metadata-originale.jsonl').read_text(encoding='utf8').splitlines():
  d=json.loads(line)
  if d['derived_osm_key'] in targets:meta[d['derived_osm_key']]=d
 sourcefeatures={};sourceproof={}
 for c,entry in prior['source_integrity'].items():
  p=a.archives/entry['filename'];b=p.read_bytes();assert sha(b)==entry['sha256']
  sourceproof[c]={'filename':p.name,'sha256':sha(b),'source_date':'2026-10-05','per_object_osmb_version_timestamp':None}
  # Extract the fixed target IDs only; no census or global topology is rerun.
  for f in json.loads(gzip.decompress(b))['features']:
   key=osmkey(f['properties']['osm_id'])
   if key in targets:
    assert sha(canon(f))==meta[key]['feature_canonical_sha256'];sourcefeatures[key]=f
 assert set(sourcefeatures)==targets
 catalog=load('public/data/actual-entities.json');entities={x['id']:x for x in catalog['entities']}
 actual={};actualpaths={}
 for c in ['ro','md']:
  for tier in ['overview','local','detail','statistical']:
   path=f'public/geo/actual/{c}-{tier}.geojson'
   for f in load(path)['features']:actual[f['properties']['entity_id']]=f;actualpaths[f['properties']['entity_id']]=path
 geoms={eid:shape(f['geometry']) for eid,f in actual.items()};ids=list(geoms);tree=STRtree([geoms[x] for x in ids])
 for g in geoms.values():shapely.prepare(g)
 proj=pyproj.Transformer.from_crs(4326,3035,always_xy=True)
 project=lambda g:shapely.transform(g,proj.transform,interleaved=False)
 areas=lambda g:float(project(g).area)
 allcases=[];bundles={};deltas={};equivalent={}
 for b in selected:
  k=b['osmb_key'];sg=shape(sourcefeatures[k]['geometry']);eq=[]
  for j in tree.query(sg):
   eid=ids[int(j)]
   if geoms[eid].equals(sg):eq.append(eid)
  equivalent[k]=sorted(eq)
  if b['actual_id']:
   ag=geoms[b['actual_id']];minus=sg.difference(ag);plus=ag.difference(sg);delta=sg.symmetric_difference(ag);deltas[k]=delta
   metrics={'osmb_area_m2':areas(sg),'actual_area_m2':areas(ag),'source_only_area_m2':areas(minus),'actual_only_area_m2':areas(plus),'symmetric_difference_m2':areas(delta),'equals':sg.equals(ag),'source_valid':sg.is_valid,'actual_valid':ag.is_valid,'source_bbox':list(sg.bounds),'actual_bbox':list(ag.bounds)}
   assert abs(metrics['symmetric_difference_m2']-float(b['symmetric_difference_epsg3035_m2']))<1e-5
   bundles[k]={'source':sourcefeatures[k],'actual':actual[b['actual_id']],'source_minus_actual':mapping(minus),'actual_minus_source':mapping(plus)}
  else:
   metrics={'osmb_area_m2':areas(sg),'source_valid':sg.is_valid,'source_bbox':list(sg.bounds),'equal_actual_ids':eq}
   bundles[k]={'source':sourcefeatures[k],'equal_actual_features':[actual[e] for e in eq]}
  allcases.append({'baseline':b,'source_key':k,'geometry':metrics})
 print('Targeted geometry comparisons complete',counter('DIFFERENCE' if x['baseline']['actual_id'] else 'EQUAL_COUNTERPART' if x['geometry']['equal_actual_ids'] else 'NO_EQUAL_COUNTERPART' for x in allcases),flush=True)
 # Collect exact source-control evidence; Git blobs avoid Windows CRLF transformations.
 osm=load('data/sources/osm-current.json');build=blob('scripts/process/build-osm-actual.mjs').decode()
 required=['data/sources/actual-settlement-policy.json','data/sources/actual-statistical-policy.json','data/sources/ro-official-only-reviewed-resolutions.json','data/sources/ro-bretcu-ojdula-terminal-closure-reviewed.json','data/sources/md-cuatm-individual-review.json','scripts/lib/md-malcoci-reviewed-current-osm.json','scripts/lib/md-current-osm-boundary-derivation.mjs','public/data/p909-nistrenia-osm-navigation.json','docs/audits/rt-adm2/identity-decision-register.json','docs/audits/rt-adm2-5/osmb-cartographic-closure.json']
 docs={p:blob(p).decode('utf8') for p in required};nav=json.loads(docs['public/data/p909-nistrenia-osm-navigation.json'])
 navigated={nav['root_osm_relation_id'],*[x['osm_relation_id'] for x in nav['groups']]}
 # Per-ID citations in existing RT-AUDIT/RT-ADM and reviewed source records, never name-only matching.
 evidence_index=collections.defaultdict(list)
 searchpaths=subprocess.check_output(git+['ls-tree','-r','--name-only',BASE,'docs/audits','data/sources','scripts/lib'],text=True).splitlines()
 numeric={str(abs(meta[k]['osm_id_original'])):k for k in targets}
 for p in searchpaths:
  if not p.endswith(('.json','.md','.mjs')) or 'osm-snapshot' in p:continue
  size=int(subprocess.check_output(git+['cat-file','-s',BASE+':'+p]))
  if size>350000:continue
  raw=blob(p);txt=raw.decode('utf8',errors='replace')
  for n in set(re.findall(r'(?<!\d)\d{5,}(?!\d)',txt))&numeric.keys():
   k=numeric[n]
   for lineno,line in enumerate(txt.splitlines(),1):
    if re.search(r'(?<!\d)'+n+r'(?!\d)',line):
     evidence_index[k].append({'path':p,'line':lineno,'sha256':sha(raw),'excerpt':line.strip()[:450]});break
 # All relation geometries that exactly equal an OSMB way are tied to explicit memberships below.
 relationwanted={int(eid[5:]) for eq in equivalent.values() for eid in eq if eid.startswith('osm-r')}
 relationwanted|={abs(meta[k]['osm_id_original']) for k in targets if k.startswith('osm-r')}
 relationwanted.add(12104636)
 waywanted={meta[k]['osm_id_original'] for k in targets if k.startswith('osm-w')}
 rawfacts={};memberships=collections.defaultdict(list)
 # Stream the materialized raw snapshots rather than keeping all nodes in memory.
 def elements(path):
  dec=json.JSONDecoder();buf='';started=False;done=False
  with gzip.open(path,'rt',encoding='utf8') as f:
   while not done:
    chunk=f.read(1048576)
    if not chunk and not buf.strip():break
    buf+=chunk
    if not started:
     m=re.search(r'"elements"\s*:\s*\[',buf)
     if not m:
      if not chunk:raise ValueError('No elements array')
      continue
     buf=buf[m.end():];started=True
    while True:
     buf=buf.lstrip(' \r\n\t,')
     if buf.startswith(']'):done=True;break
     try:v,end=dec.raw_decode(buf)
     except json.JSONDecodeError:
      if not chunk:raise
      break
     yield v;buf=buf[end:]
 for country,entry in osm['countries'].items():
  p=ROOT/entry['snapshot_path'];assert sha(p.read_bytes())==entry['compressed_sha256']
  inputs[entry['snapshot_path']]={'sha256':entry['compressed_sha256'],'semantic_sha256':entry['semantic_sha256'],'snapshot_at':entry['snapshot_at']}
  h=hashlib.sha256()
  with gzip.open(p,'rb') as f:
   for block in iter(lambda:f.read(1048576),b''):h.update(block)
  assert h.hexdigest()==entry['semantic_sha256']
  for e in elements(p):
   if e['type']=='relation':
    if e['id'] in relationwanted:rawfacts['relation/'+str(e['id'])]=e
    for m in e.get('members',[]):
     if m['type']=='way' and m['ref'] in waywanted:memberships[m['ref']].append({'relation_id':e['id'],'role':m.get('role'),'selected':e['id'] in entry['selected_relation_ids'],'jurisdiction':country})
   elif e['type']=='way' and e['id'] in waywanted:rawfacts['way/'+str(e['id'])]=e
  print('Raw source evidence extracted',country,flush=True)
 put('raw-source-facts.json',rawfacts)
 # Quantify exactly shared change footprints; this demonstrates propagation, not an unknown edit history.
 coupling=[]
 for i,(k,g) in enumerate(deltas.items()):
  for q,h in list(deltas.items())[i+1:]:
   inter=g.intersection(h)
   if inter.area>0:coupling.append({'left':k,'right':q,'equal_delta':g.equals(h),'intersection_m2':areas(inter),'left_covered_fraction':areas(inter)/areas(g),'right_covered_fraction':areas(inter)/areas(h)})
 put('change-footprint-coupling.json',coupling)
 shell=shape(bundles['osm-r14735731']['source']['geometry']);oj=shape(bundles['osm-r14735731']['actual']['geometry']);br=shape(bundles['siruta-u64096']['actual']['geometry']) if 'siruta-u64096' in bundles else geoms['siruta-u64096']
 partition={'source_osm_relation':14735731,'actual_ids':['osm-r14735731','siruta-u64096'],'union_equals_osmb_shell':oj.union(br).equals(shell),'union_shell_symmetric_difference_m2':areas(oj.union(br).symmetric_difference(shell)),'interior_overlap_m2':areas(oj.intersection(br)),'interpretation':'Reviewed partition mechanism is supported; the measured nonzero residual is retained, not rounded to exact equality. Legal boundary certification is not asserted.'}
 put('bretcu-ojdula-partition-check.json',partition)
 records=[]
 for item in allcases:
  b=item['baseline'];k=item['source_key'];m=meta[k];p=sourcefeatures[k]['properties'];eid=b['actual_id'] or None;e=entities.get(eid);level=p.get('admin_level');rid=abs(p['osm_id']);kind='relation' if p['osm_id']<0 else 'way'
  selectedids=osm['countries'][b['source_country']]['selected_relation_ids'];parents=p.get('parents_administrative');same=equivalent[k];refs=evidence_index[k]
  cause=[];status='REVIEW_REQUIRED';decision='HOLD_NO_ACTUAL_CHANGE';rootcause='INSUFFICIENT_EVIDENCE';requirements=[]
  if not eid:
   cause.append({'finding':'Not selected by administrative relation source manifest','selected_relation':kind=='relation' and rid in selectedids,'selection_evidence':'data/sources/osm-current.json','relation_only_pipeline':'scripts/process/build-osm-actual.mjs'})
   if same:
    category='ALTERNATE_OSM_OBJECT_SAME_CARTOGRAPHIC_FOOTPRINT';rootcause='EXACT_GEOMETRY_EQUIVALENCE_DEMONSTRATED';status='CARTOGRAPHIC_RECONCILED';decision='RETAIN_BOTH_SOURCE_IDENTITIES_NO_IMPORT'
    cause.append({'finding':'Source polygon equals existing ACTUAL polygon(s) topologically','actual_ids':same,'raw_way_memberships':memberships[rid] if kind=='way' else []})
   elif p.get('boundary')!='administrative':
    category='NON_ADMINISTRATIVE_OSM_LAYER';rootcause='SOURCE_ROLE_AND_IMPORT_SCOPE_DEMONSTRATED';status='CARTOGRAPHIC_SCOPE_EXPLAINED';decision='RETAIN_SOURCE_OUTSIDE_ADMINISTRATIVE_IMPORT'
    cause.append({'finding':'OSMB explicitly describes another cartographic role','boundary':p.get('boundary'),'place':p.get('tags',{}).get('place')})
   elif kind=='way':
    category='ADMINISTRATIVE_TAGGED_WAY_NOT_SELECTED_AS_RELATION';rootcause='OBJECT_TYPE_AND_IMPORT_SCOPE_DEMONSTRATED';cause.append({'finding':'Administrative tag on a way is not selection of a reviewed administrative relation','place':p.get('tags',{}).get('place'),'memberships':memberships[rid]});requirements.append('Positive identity and reviewed role/geometry evidence before any inclusion; no legal unit is inferred from way tags.')
   elif rid in navigated:
    category='NISTRENIA_SOURCE_ONLY_VIRTUAL_GROUP';rootcause='EXISTING_VIRTUAL_NAVIGATION_POLICY_DEMONSTRATED';status='CARTOGRAPHIC_SCOPE_EXPLAINED';decision='REUSE_EXISTING_GROUP_EVIDENCE_KEEP_P91_BLOCKED';cause.append({'finding':'Already retained as virtual source group, not new ACTUAL jurisdiction','evidence':'public/data/p909-nistrenia-osm-navigation.json','semantic_acceptance':nav['legal_semantic_acceptance']})
   elif level not in [2,*osm['countries'][b['source_country']]['levels']]:
    category='ADMINISTRATIVE_TAGGED_LEVEL_OUTSIDE_SELECTED_SCOPE';rootcause='LEVEL_AND_EXPLICIT_SOURCE_SELECTION_DEMONSTRATED';cause.append({'finding':'OSMB administrative level is outside the current import levels','level':level,'import_levels':osm['countries'][b['source_country']]['levels']});requirements.append('Independent administrative status and applicable official hierarchy; source level alone cannot adjudicate inclusion.')
   else:category='UNEXPLAINED_SELECTION_DIFFERENCE';requirements.append('Resolve why this identity is absent from selected source scope.')
  else:
   category='GEOMETRIC_DIFFERENCE';cause.append({'finding':'Symmetric difference reproduced against the exact committed ACTUAL public geometry','source_vs_actual':item['geometry'],'actual_provenance':e['representation']})
   if eid=='osm-r14735731':
    rootcause='REVIEWED_OSM_SHELL_ANCPI_PARTITION';status='CARTOGRAPHIC_RECONCILED';decision='REUSE_REVIEWED_BRETCU_OJDULA_PARTITION';cause.append({'finding':'ACTUAL explicitly partitions the legacy OSM shell using the reviewed Brețcu–Ojdula divider','evidence':'data/sources/ro-bretcu-ojdula-terminal-closure-reviewed.json'})
   elif eid=='osm-r18968071':
    rootcause='REVIEWED_CURRENT_OSM_NETWORK_DERIVATION_VS_OSMB_EXPORT';status='CARTOGRAPHIC_PROVENANCE_EXPLAINED';decision='REUSE_REVIEWED_MALCOCI_CONTRACT';cause.append({'finding':'ACTUAL source is the reviewed boundary-network derivation, not a blind OSMB replacement','contract':'scripts/lib/md-malcoci-reviewed-current-osm.json','connector_way_id':123810097});requirements.append('OSMB does not supply per-object versions: the historical reason for its exported contour remains uncertified.')
   else:
    rootcause='DIFFERENT_SOURCE_CONTOURS_WITH_MEASURED_SHARED_CHANGES';requirements.append('Dated OSMB per-object version or independent edit/node history linking each changed segment to a source epoch; do not infer a chronology from the filename.')
   cause.append({'finding':'Measured relationships with other changed footprints','relationships':[x for x in coupling if k in [x['left'],x['right']]]})
  if rootcause!='INSUFFICIENT_EVIDENCE':cause.append({'causal_scope':'Cartographic mechanism/import selection only; it does not demonstrate applicable legal boundary or every historical edit.'})
  raw=rawfacts.get(kind+'/'+str(rid))
  record={'case_id':'AUTO3-'+(eid if eid and eid.startswith('stat-') else k),'exception_kind':'GEOMETRY_DIFFERENCE' if eid else 'OSMB_ONLY','osm':{'type':kind,'id':rid,'signed_osmb_id':p['osm_id'],'url':f'https://www.openstreetmap.org/{kind}/{rid}','metadata_original':p,'baseline_source_index':m['source_index_0based'],'feature_canonical_sha256':m['feature_canonical_sha256'],'geometry_canonical_sha256':m['geometry_canonical_sha256'],'actual_raw_snapshot_fact_key':kind+'/'+str(rid) if raw else None,'actual_snapshot_version':raw.get('version') if raw else None,'actual_snapshot_timestamp':raw.get('timestamp') if raw else None},'jurisdiction':b['source_country'],'name':p.get('name'),'admin_level':level,'hierarchy':{'osmb_parents_original':p.get('parents'),'osmb_parents_administrative_original':parents,'actual':e.get('hierarchy') if e else None,'equal_geometry_actual_hierarchies':{x:entities[x].get('hierarchy') for x in same}},'actual_id':eid,'actual_identity':{'legal':e.get('legal'),'validation':e.get('validation'),'representation':e.get('representation')} if e else None,'geometry':item['geometry'],'category':category,'cause_status':rootcause,'demonstrated_findings':cause,'existing_audit_evidence':refs,'geometry_bundle':f'geometry/{k}.json.gz','cartographic_status':status,'administrative_verdict':'EXISTING_ACCEPTED_IDENTITY_PRESERVED' if e else 'NOT_ADJUDICATED_NO_NEW_UNIT_INFERRED','legal_verdict':'NO_NEW_LEGAL_CERTIFICATION','decision':decision,'remaining_evidence':requirements,'resolved_globally':False,'actual_mutation_allowed':False,'p91_import_allowed':False}
  records.append(record)
 for x in onlyactual:
  eid=x['actual_id'];e=entities[eid];g=geoms[eid];key=eid
  counterpart=[k for k,eq in equivalent.items() if eid in eq]
  known=eid=='siruta-u64096';raw=rawfacts.get('relation/12104636') if not known else None
  rec={'case_id':'AUTO3-'+eid,'exception_kind':'ACTUAL_ONLY','osm':{'type':'relation' if not known else None,'id':12104636 if not known else None,'url':'https://www.openstreetmap.org/relation/12104636' if not known else None,'actual_raw_snapshot_fact_key':'relation/12104636' if raw else None,'version':raw.get('version') if raw else None,'timestamp':raw.get('timestamp') if raw else None},'jurisdiction':e['jurisdiction'],'name':e['name'],'admin_level':e['representation'].get('admin_level'),'hierarchy':{'actual':e['hierarchy'],'osmb_equivalent_object_ids':counterpart},'actual_id':eid,'actual_identity':{'legal':e.get('legal'),'validation':e.get('validation'),'representation':e.get('representation')},'geometry':{'actual_area_m2':areas(g),'valid':g.is_valid,'bbox':list(g.bounds),'equal_osmb_ids':counterpart},'category':'REVIEWED_OFFICIAL_ID_WITHOUT_DISTINCT_OSM_RELATION' if known else 'UNNAMED_ACCEPTED_RELATION_IDENTITY_REMAINS_OPEN','cause_status':'REVIEWED_OFFICIAL_IDENTITY_AND_PARTITION_DEMONSTRATED' if known else 'RELATION_ABSENT_AS_ID_IN_OSMB_EXPORT_ROOT_CAUSE_UNCERTIFIED','demonstrated_findings':[{'finding':'Reviewed Brețcu official identity uses a partition of the Ojdula shell and must not be forced into an invented OSM ID','evidence':'data/sources/ro-official-only-reviewed-resolutions.json'}] if known else [{'finding':'Existing RT-ADM identity exception remains without positive identity; OSMB absence is not deletion evidence','evidence':'data/sources/md-cuatm-individual-review.json','equal_osmb_ids':counterpart}],'existing_audit_evidence':[{'path':p,'sha256':inputs[p]['sha256']} for p in (['data/sources/ro-official-only-reviewed-resolutions.json','data/sources/ro-bretcu-ojdula-terminal-closure-reviewed.json'] if known else ['docs/audits/rt-adm2/identity-decision-register.json','docs/audits/rt-adm2-5/osmb-cartographic-closure.json','data/sources/md-cuatm-individual-review.json'])],'geometry_bundle':f'geometry/{key}.json.gz','cartographic_status':'CARTOGRAPHIC_RECONCILED' if known else 'REVIEW_REQUIRED','administrative_verdict':'EXISTING_ACCEPTED_IDENTITY_PRESERVED' if known else 'POSITIVE_IDENTITY_UNRESOLVED','legal_verdict':'NO_NEW_LEGAL_CERTIFICATION','decision':'REUSE_REVIEWED_BRETCU_PARTITION' if known else 'HOLD_EXISTING_RT_ADM_IDENTITY_EXCEPTION','remaining_evidence':[] if known else ['Positive identification of the unnamed footprint; export selection/version evidence explaining the missing relation ID.'],'resolved_globally':False,'actual_mutation_allowed':False,'p91_import_allowed':False}
  records.append(rec);bundles[key]={'actual':actual[eid],'equal_osmb_features':[sourcefeatures[k] for k in counterpart]}
 records.sort(key=lambda x:x['case_id']);assert len(records)==298 and len({x['case_id'] for x in records})==298
 # Freeze per-ID geometry inputs and difference outputs for independent reproduction, including empty differences.
 (out/'geometry-cases.json.gz').write_bytes(gzip.compress(canon(bundles),compresslevel=9,mtime=0))
 for record in records:
  record['geometry_key']=record['geometry_bundle'].split('/')[-1].removesuffix('.json.gz')
  record['geometry_bundle']='geometry-cases.json.gz'
  record['geometry_case_canonical_sha256']=sha(canon(bundles[record['geometry_key']]))
 # Keep the fixed baseline exception list and selected metadata, rather than repeating the census.
 put('baseline-exceptions.json',{'base_commit':BASE,'geometry_difference':13,'osmb_only':283,'actual_only':2,'zip_sha256':expectedzip,'baseline_files':{k:manifest[k] for k in ['RAPORT.md','reconciliere-osmb-actual.csv','metadata-originale.jsonl','diferente-geometrice.json','actual-fara-corespondent-osmb.json']},'source_archives':sourceproof,'exception_ids':[x['case_id'] for x in records]})
 put('register.json',{'schema':'auto3-osmb-exception-register-v1','source_commit':BASE,'scope':'Fixed 298 exceptions; no 6129-feature census repeated','policy':{'actual_mutation_allowed':False,'p91_import_allowed':False,'legal_geometry_certified':False,'unresolved_cases_must_remain_open':True},'records':records})
 csvout('decision-matrix.csv',[{'case_id':x['case_id'],'jurisdiction':x['jurisdiction'],'exception_kind':x['exception_kind'],'osm_type':x['osm']['type'],'osm_id':x['osm']['id'],'name':x['name'],'admin_level':x['admin_level'],'category':x['category'],'cause_status':x['cause_status'],'cartographic_status':x['cartographic_status'],'administrative_verdict':x['administrative_verdict'],'legal_verdict':x['legal_verdict'],'decision':x['decision'],'resolved_globally':False,'remaining_evidence':x['remaining_evidence']} for x in records])
 stats={'total':298,'by_jurisdiction':{c:{'total':sum(x['jurisdiction']==c for x in records),'exception_kinds':counter(x['exception_kind'] for x in records if x['jurisdiction']==c),'categories':counter(x['category'] for x in records if x['jurisdiction']==c),'cartographic_status':counter(x['cartographic_status'] for x in records if x['jurisdiction']==c)} for c in ['RO','MD']},'legal_geometry_certifications':0,'globally_resolved':0,'actual_changes':0,'p91_authorizations':0,'tools':{'python':sys.version.split()[0],'shapely':shapely.__version__,'geos':shapely.geos_version_string,'pyproj':pyproj.__version__},'area_crs':'EPSG:3035','operations_crs':'EPSG:4326','threshold':'No area threshold, no snap, no make_valid, no geometry edits'}
 put('statistics.json',stats);put('input-sha256.json',inputs)
 report=['# AUTO-3 — Reconcilierea celor 298 de excepții OSMB–ACTUAL','',f'Bază ACTUAL: `{BASE}`. Inventarul de 6.129 de geometrii nu a fost repetat. Au fost extrase și comparate exclusiv cele 298 de excepții fixe din auditul anterior.','', '**Verdict: registru tehnic exhaustiv; certificarea juridică și cazurile cu dovezi insuficiente rămân deschise. ACTUAL nemodificat; P9.1 blocat.**','','| Jurisdicție | Diferențe geometrice | Numai OSMB | Numai ACTUAL | Total |','|---|---:|---:|---:|---:|']
 for c in ['RO','MD']:
  ss=stats['by_jurisdiction'][c];kk=ss['exception_kinds'];report.append(f"| {c} | {kk.get('GEOMETRY_DIFFERENCE',0)} | {kk.get('OSMB_ONLY',0)} | {kk.get('ACTUAL_ONLY',0)} | {ss['total']} |")
 report+=['','## Metodologie și limite','','Registrul JSON păstrează per-ID identitatea OSM (way/relation), jurisdicția, nivelul, metadatele și părinții originali, părinții ACTUAL, geometriile, proveniența și dovada fiecărei clasificări. Asocierea geometrică alternativă folosește egalitatea topologică exactă, fără nume aproximative. Aceasta demonstrează un contur comun; nu demonstrează identitate juridică. Variantele way/relation rămân identificatori distincti.','','Geometriile fiecărui caz sunt păstrate în `geometry/*.json.gz`, cu intrările originale și diferențele pentru cele 13 cazuri. Suprafețe EPSG:3035, operații EPSG:4326; nu se aplică toleranță, reparare sau simplificare. `change-footprint-coupling.json` măsoară legăturile dintre modificările de contur, fără să inventeze cronologia editărilor. OSMB nu furnizează versiunea și data fiecărui obiect.','','Selecția actuală se probează cu `osm-current.json` și `build-osm-actual.mjs`, nu prin presupunerea că toate obiectele OSMB trebuie importate. Rolurile tematice non-administrative sunt documentate ca roluri OSM, fără o adjudecare juridică nouă a fiecărui obiect. Pentru etichetele administrative din afara selecției se menține revizuirea, fără eliminare sau import automat.','','RT-ADM este reutilizat explicit pentru Brețcu/Ojdula, Malcoci și relația fără identitate pozitivă 12104636. Grupurile virtuale Nistrenia reutilizează politica publică existentă; nu sunt transformate în jurisdicții legale și nu autorizează P9.1. Coincidența ID-ului într-un document existent este indexată ca trimitere documentară; nu echivalează cu închiderea unui caz.','','`cartographic_status` este limitat la mecanismul sau proveniența demonstrată. `resolved_globally=false` pentru toate cazurile: clasificarea tehnică nu închide tacit aspecte juridice. Cazurile `REVIEW_REQUIRED` au probele încă necesare în `remaining_evidence`.','','## Matrice per-ID','','| Caz | Țară | Nume | Categorie | Statut cartografic | Decizie |','|---|---|---|---|---|---|']
 for x in records:report.append('| '+' | '.join(str(x[k]).replace('|','/') for k in ['case_id','jurisdiction','name','category','cartographic_status','decision'])+' |')
 report+=['','## Reproducere','','Generare: `python scripts/audit/auto3-osmb-reconcile.py --baseline /cale/audit-osmb-20261005 --archives /cale/arhive`. Necesită pachetul ZIP anterior și SHA-ul său în directorul părinte al baseline-ului, precum și cele două arhive originale. Biblioteci: Shapely 2.2.0, pyproj 3.8.0, NumPy 2.5.4. Scriptul citește bloburi Git din commitul fixat și nu scrie ACTUAL.','','Verificare fără biblioteci GIS: `node scripts/audit/auto3-osmb-verify.mjs`. Reproducerea geometrică pe intrările per-ID deja păstrate: `python scripts/audit/auto3-osmb-geometry-check.py`. Aceste două verificări nu recalculează inventarul inițial.','','`input-sha256.json` consemnează sursele Git exacte și snapshoturile OSM brute verificate atât comprimat cât și semantic. `sha256-manifest.json` consemnează toate livrabilele. Copia binară a arhivelor originale rămâne în pachetul anterior și nu este duplicată în repository.','']
 (out/'README.md').write_text('\n'.join(report),encoding='utf8',newline='\n')
 put('sha256-manifest.json',{p.relative_to(out).as_posix():{'sha256':sha(p.read_bytes()),'bytes':p.stat().st_size} for p in sorted(out.rglob('*')) if p.is_file() and p.name!='sha256-manifest.json'})
 print(json.dumps(stats,ensure_ascii=False),flush=True)
 subprocess.check_call([sys.executable,str(ROOT/'scripts/audit/auto3-osmb-enrich.py'),'--baseline',str(a.baseline.resolve())])
 if (out/'ro-shared-node-history/retrieval.json').exists():subprocess.check_call([sys.executable,str(ROOT/'scripts/audit/auto3-osmb-ro-source-history.py'),'--apply-evidence'])
 if (out/'md-shared-boundary-history/condrita-history-retrieval.json').exists():subprocess.check_call([sys.executable,str(ROOT/'scripts/audit/auto3-osmb-md-source-history.py'),'--apply-evidence'])
 if (out/'md-remaining-boundary-history/retrieval.json').exists():subprocess.check_call([sys.executable,str(ROOT/'scripts/audit/auto3-osmb-md-remaining-histories.py'),'--apply-evidence'])
if __name__=='__main__':main()
