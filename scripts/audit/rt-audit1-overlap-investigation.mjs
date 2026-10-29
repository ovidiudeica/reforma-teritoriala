#!/usr/bin/env node
// RT-AUDIT.1.1: read-only quantified examination of P8.2 overlap exceptions.
// Evidence is derived only under outputs/; never clip, snap, repair or reparent.
import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {createGeometricOverlay} from '../../atlas-geometric-overlay.mjs';
const root=new URL('../../',import.meta.url),out='outputs/RT-AUDIT.1/';
const load=async p=>readFile(new URL(p,root)),j=async p=>JSON.parse(await load(p));
const sha=b=>createHash('sha256').update(b).digest('hex');
const fail=m=>{throw new Error('RT-AUDIT.1.1: '+m)};
const round=(x,d=6)=>Number(x.toFixed(d));
const sort=(a,b)=>a<b?-1:a>b?1:0;
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const counts=x=>Object.fromEntries([...new Set(x)].sort(sort).map(k=>[k,x.filter(v=>v===k).length]));
const exactSample=a=>[...a].sort((x,y)=>x-y);
const percentile=(arr,p)=>{if(!arr.length)return null;const x=exactSample(arr),pos=(x.length-1)*p,left=Math.floor(pos),frac=pos-left;return round(x[left]+(x[Math.ceil(pos)]-x[left])*frac,8)};
const registry=await j(out+'parent-child-register.json');
const oldSummary=await j(out+'summary.json');
const candidates=registry.filter(x=>x.category==='GEO');
const equalRows=registry.filter(x=>x.geometry_relation==='equal');
if(registry.length!==5846||candidates.length!==254||equalRows.length!==3)fail('register size / GEO / equal preconditions');
if(candidates.some(x=>x.geometry_relation!=='overlap'||x.jurisdiction!=='MD'))fail('unexpected GEO category');
const indexBytes=await load('public/data/actual-topology-index.json');
const index=JSON.parse(indexBytes);
if(index.snapshot_id!==oldSummary.snapshot_id||sha(indexBytes)!==oldSummary.topology_index_sha256)fail('topology snapshot mismatch');
const pubBytes=await load('public/data/actual-entities.json');
if(sha(pubBytes)!==oldSummary.entity_index_sha256)fail('entity index mismatch');
const entities=new Map(JSON.parse(pubBytes).entities.map(x=>[x.id,x]));
const requested=new Set([...candidates,...equalRows].flatMap(x=>[x.parent_id,x.child_id]));
const sourceIndex=new Map(), geometries=new Map(), geometrySources=new Map();
const paths=(await readdir(new URL('public/geo/actual/',root),{recursive:true}))
 .filter(p=>p.endsWith('.geojson')).map(p=>'public/geo/actual/'+p.replaceAll('\\','/')).sort(sort);
if(paths.length!==123)fail('123 master GeoJSON expected');
let sourceBytes=0;
for(const path of paths){
 const buf=await load(path);sourceBytes+=buf.length;
 if(sha(buf)!==index.sources[path])fail('topology source SHA mismatch: '+path);
 sourceIndex.set(path,{sha256:sha(buf),bytes:buf.length});
 for(const feature of JSON.parse(buf).features){
  const id=feature?.properties?.entity_id;
  if(!requested.has(id)||geometries.has(id))continue;
  geometries.set(id,feature.geometry);geometrySources.set(id,path);
 }
}
if(geometries.size!==requested.size)fail('missing polygons: '+[...requested].filter(x=>!geometries.has(x)));
const ctx={};vm.createContext(ctx);
vm.runInContext(await load('vendor/gis/jsts-2.12.1.min.js'),ctx);
const engine=createGeometricOverlay(ctx.jsts);
const reviewed=await j('data/sources/md-cuatm-individual-review.json');
const reviewCases=new Map((reviewed.cases||[]).map(x=>[x.osm_id,x]));
const statistical=await j('data/p2/actual-statistical-md.json');
const statEntries=new Map((statistical.statistical_entities||[]).map(x=>[x.id,x]));
const policy=await j('data/sources/actual-statistical-policy.json');
const officialNuts=await j('data/sources/md-nuts-2017.json');
const cuatm=await j('data/sources/cuatm-current.json');
const bridge=await j('data/current/md-cuatm-semantic-bridge.json');
const legalBinds=new Map((bridge.municipality_validation?.municipalities||[]).map(x=>[normalize(x.legal_name),x]));
const info=(id)=>{
 const e=entities.get(id);
 if(!e)fail('missing entity metadata '+id);
 return {id,name:e.display_name,type:e.display_type,category:e.category,
  roles:e.roles||[],representation:e.representation||null,
  hierarchy:e.hierarchy||null,statistical:e.statistical||null,
  official:e.official||e.official_identity||e.legal_identity||null};
};
const signature=(row,inside,outside,percentOutside)=>{
 const child=info(row.child_id),parent=info(row.parent_id);
 if(child.category==='statistical'||parent.category==='statistical')return 'STATISTICAL_ONLY_PARENT_GEOMETRY_CROSSING';
 if(child.roles.includes('statistical')||parent.roles.includes('statistical'))return 'ADMINISTRATIVE_UAT_WITH_REUSED_STATISTICAL_ROLE';
 if(['non_administrative_or_auxiliary_area','subdivision_or_component_area'].includes(child.type))return 'AUXILIARY_OR_UNCERTAIN_OSM_AREA';
 if(normalize(child.name)===normalize(parent.name))return 'SAME_NAMED_DIFFERENT_OSM_FOOTPRINTS';
 if(percentOutside<=0.1)return 'TRACE_OUTSIDE_PARENT_MAX_0_1_PERCENT';
 if(percentOutside<=1)return 'SMALL_OUTSIDE_PARENT_MAX_1_PERCENT';
 if(percentOutside<=10)return 'OUTSIDE_PARENT_1_TO_10_PERCENT';
 if(percentOutside<=50)return 'OUTSIDE_PARENT_10_TO_50_PERCENT';
 return 'MOSTLY_OUTSIDE_PARENT_OVER_50_PERCENT';
};
const quantified=[],failures=[];
for(const row of candidates){
 const parent=info(row.parent_id),child=info(row.child_id);
 const a=geometries.get(row.parent_id),b=geometries.get(row.child_id);
 try{
  const r=engine.compare(a,b);
  if(r.relation!==row.geometry_relation)fail('geometric relation changed: '+row.child_id+' '+r.relation);
  if(r.intersectionM2<=0||r.exclusiveBM2<=0)fail('invalid partial overlap measure '+row.child_id);
  const insidePct=r.overlapB,outsidePct=100*r.exclusiveBM2/r.b.areaM2;
  const caseEvidence=reviewCases.get(row.child_id);
  const observed=signature(row,r.intersectionM2,r.exclusiveBM2,outsidePct);
  const context=parent.category==='statistical'?'ADMINISTRATIVE_CHILD_VS_STATISTICAL_PARENT':`OSM_ADMIN_LEVEL_${child.representation?.admin_level??'UNKNOWN'}_TO_${parent.representation?.admin_level??'UNKNOWN'}`;
  const caseRow={
   child_id:row.child_id,parent_id:row.parent_id,jurisdiction:'MD',
   child_name:child.name,parent_name:parent.name,child_type:child.type,parent_type:parent.type,
   child_roles:child.roles,parent_roles:parent.roles,child_osm_admin_level:child.representation?.admin_level??null,
   parent_osm_admin_level:parent.representation?.admin_level??null,
   same_normalized_name:normalize(child.name)===normalize(parent.name),
   matrix:r.matrix,geometry_relation:r.relation,observed_pattern:observed,hierarchy_boundary_context:context,
   computed_parent_area_m2:round(r.a.areaM2,3),computed_child_area_m2:round(r.b.areaM2,3),
   intersection_area_m2:round(r.intersectionM2,3),
   child_outside_parent_m2:round(r.exclusiveBM2,3),
   parent_outside_child_m2:round(r.exclusiveAM2,3),
   union_area_m2:round(r.unionM2,3),
   intersection_km2:round(r.intersectionM2/1e6,9),
   child_outside_parent_km2:round(r.exclusiveBM2/1e6,9),
   percent_child_inside_parent:round(insidePct,8),
   percent_child_outside_parent:round(outsidePct,8),
   percent_parent_covered_by_child:round(r.overlapA,8),
   source_parent:geometrySources.get(row.parent_id),source_child:geometrySources.get(row.child_id),
   numeric_tolerance_m2:round(r.validation.toleranceM2,4),
   numeric_residuals_m2:Object.fromEntries(Object.entries(r.validation.residuals).map(([k,v])=>[k,round(v,5)])),
   referenced_review:caseEvidence?{path:'data/sources/md-cuatm-individual-review.json',review_status:caseEvidence.review_status,classification_action:caseEvidence.classification_action,finding:caseEvidence.finding,evidence_gap:caseEvidence.next_evidence_needed}:null,
   root_cause_status:'NOT_PROVEN_FROM_GEOMETRY',
   proposed_action:'REVIEW_SOURCE_MEMBERS_AND_OFFICIAL_BOUNDARY; DO_NOT_AUTO_REPARENT_OR_CLIP'
  };
  quantified.push(caseRow);
 }catch(error){
  failures.push({child_id:row.child_id,parent_id:row.parent_id,error:String(error.message||error),source_parent:geometrySources.get(row.parent_id),source_child:geometrySources.get(row.child_id)});
 }
}
const equality=[];
for(const row of equalRows){
 const p=info(row.parent_id),c=info(row.child_id);
 let measured=null,error=null;
 try{
  const r=engine.compare(geometries.get(row.parent_id),geometries.get(row.child_id));
  if(r.relation!=='equal')fail('equal relation changed: '+row.child_id);
  measured={parent_area_km2:round(r.a.areaM2/1e6,9),child_area_km2:round(r.b.areaM2/1e6,9),symmetric_difference_m2:round(r.exclusiveAM2+r.exclusiveBM2,3),matrix:r.matrix};
 }catch(e){error=String(e.message||e)}
 const statisticalCoextensive=c.roles.includes('statistical')&&p.roles.includes('statistical');
 const sameName=normalize(c.name)===normalize(p.name);
 const bridgeBind=legalBinds.get(normalize(c.name));
 const exactCuatmNameCandidates=(cuatm.records||[]).filter(x=>normalize(x.name)===normalize(c.name)).map(x=>({legal_id:x.code,parent_code:x.parent_code,status_code:x.status_code,legal_name:x.name,source:'data/sources/cuatm-current.json'}));
 const officialStatParent=statisticalCoextensive?(officialNuts.units||[]).find(x=>x.code===p.statistical?.code):null;
 const officialStatChild=statisticalCoextensive?(officialNuts.units||[]).find(x=>x.code===c.statistical?.code):null;
 const officialStatSiblings=statisticalCoextensive?(officialNuts.units||[]).filter(x=>x.parent_code===p.statistical?.code).map(x=>x.code):null;
 equality.push({child_id:row.child_id,parent_id:row.parent_id,
  child:c,parent:p,measured,evaluation_error:error,cuatm_exact_name_candidates:statisticalCoextensive?[]:exactCuatmNameCandidates,
  official_nuts_lineage:statisticalCoextensive?{source:'data/sources/md-nuts-2017.json',parent:officialStatParent,child:officialStatChild,children_of_parent:officialStatSiblings}:null,
  semantic_pattern:statisticalCoextensive?'COEXTENSIVE_STATISTICAL_TIERS':sameName?'SAME_NAME_AND_TYPE_WITH_DISTINCT_OSM_RELATIONS':'UNRESOLVED',
  official_statistical_policy:statisticalCoextensive?{path:'data/sources/actual-statistical-policy.json',md120:policy.jurisdictions?.MD?.special_rules?.MD120||null,child:statEntries.get(c.id)||null,parent:statEntries.get(p.id)||null}:null,
  municipality_policy_reference:normalize(c.name)==='orhei'?{path:'data/current/md-cuatm-semantic-bridge.json',binding:bridgeBind||null}:null,
  administrative_equivalence_certified:false,
  finding:statisticalCoextensive?'Nivelurile statistice MD12 si MD120 au geometrii egale in sursa curenta; clasificarea BNS este distincta de reprezentarea cartografica OSM.':sameName?'Nume si tip identice dar identificatori OSM diferiti; coextensivitatea nu certifica identitate juridica dubla.':'Necesita audit semantic',
  next_steps:statisticalCoextensive?'Confirmati regulile statistice BNS si daca MD12 are un singur copil de nivel 3 in model.':'Verificati CUATM, relatiile si membrii OSM, tipul si apartenenta in arbore; nu deduplicati automat.'
 });
}
const sum=key=>quantified.reduce((s,r)=>s+r[key],0);
const sortedByOutside=[...quantified].sort((a,b)=>b.child_outside_parent_m2-a.child_outside_parent_m2||sort(a.child_id,b.child_id));
const sortedByPercent=[...quantified].sort((a,b)=>b.percent_child_outside_parent-a.percent_child_outside_parent||sort(a.child_id,b.child_id));
const result={
 contract:'rt-audit1-1-geometry-investigation-v1',
 status:failures.length||equality.some(e=>e.evaluation_error)?'PARTIAL_REQUIRES_GIS_REVIEW':'GEOMETRIC_MEASUREMENTS_COMPLETE_SEMANTICS_PARTIAL',
 baseline:{snapshot_id:oldSummary.snapshot_id,topology_index_sha256:sha(indexBytes),public_entities_sha256:sha(pubBytes),
  parent_child_register_sha256:sha(await load(out+'parent-child-register.json')),geometry_sources:paths.length,geometry_source_bytes:sourceBytes,
  sources_md_cuatm_individual_review_sha256:sha(await load('data/sources/md-cuatm-individual-review.json')),
  sources_md_statistical_sha256:sha(await load('data/p2/actual-statistical-md.json'))},
 counts:{expected_overlaps:254,computed_overlaps:quantified.length,errors:failures.length,equalities:3,
  successfully_measured_equalities:equality.filter(r=>r.measured).length},
 observed_patterns:counts(quantified.map(r=>r.observed_pattern)),
 hierarchy_boundary_contexts:counts(quantified.map(r=>r.hierarchy_boundary_context)),
 child_types:counts(quantified.map(r=>r.child_type)),
 parent_types:counts(quantified.map(r=>r.parent_type)),
 same_name_count:quantified.filter(r=>r.same_normalized_name).length,
 pairwise_areas_m2:{sum_intersection:round(sum('intersection_area_m2'),3),sum_child_outside_parent:round(sum('child_outside_parent_m2'),3)},
 pairwise_areas_km2:{sum_intersection:round(sum('intersection_area_m2')/1e6,6),sum_child_outside_parent:round(sum('child_outside_parent_m2')/1e6,6)},
 outside_parent_percentiles_pct:{min:percentile(quantified.map(x=>x.percent_child_outside_parent),0),median:percentile(quantified.map(x=>x.percent_child_outside_parent),.5),p90:percentile(quantified.map(x=>x.percent_child_outside_parent),.9),max:percentile(quantified.map(x=>x.percent_child_outside_parent),1)},
 largest_child_outside_parent:sortedByOutside.slice(0,20).map(r=>({child_id:r.child_id,parent_id:r.parent_id,child_name:r.child_name,parent_name:r.parent_name,km2:r.child_outside_parent_km2,pct:r.percent_child_outside_parent,pattern:r.observed_pattern})),
 highest_percentage_outside_parent:sortedByPercent.slice(0,20).map(r=>({child_id:r.child_id,parent_id:r.parent_id,child_name:r.child_name,parent_name:r.parent_name,km2:r.child_outside_parent_km2,pct:r.percent_child_outside_parent,pattern:r.observed_pattern})),
 limitations:[
  'The sums are over 254 parent-child pairs, not the area of a geographic union; polygons may overlap across pairs.',
  'Areas are spherical geodesic integrals with IUGG mean-radius 6371008.8 m for straight lon/lat source edges; not cadastral survey.',
  'Observed pattern is not a proven historic, cartographic or legal root cause; every row explicitly marks root cause NOT_PROVEN_FROM_GEOMETRY.',
  'Only cited primary review record is attached where independently available. No systematic legal adjudication.',
  'A valid intersection/inside/outside area cannot authorize geometry repairs, clipping or reparenting.'
 ]
};
const files={
 'overlap-254-per-id.json':quantified,
 'overlap-geometry-errors.json':failures,
 'semantic-equalities-3.json':equality,
 'overlap-investigation-summary.json':result
};
await mkdir(new URL(out,root),{recursive:true});
const hashes=[];
for(const [name,obj] of Object.entries(files)){
 const bytes=Buffer.from(JSON.stringify(obj,null,2)+'\n');
 await writeFile(new URL(out+name,root),bytes);hashes.push(sha(bytes)+'  '+name);
}
const csvHeaders=['child_id','parent_id','child_name','parent_name','child_type','parent_type','observed_pattern','intersection_km2','child_outside_parent_km2','percent_child_inside_parent','percent_child_outside_parent','root_cause_status'];
const csvCell=v=>'"'+String(v??'').replaceAll('"','""')+'"';
const csv=[csvHeaders.join(','),...quantified.map(row=>csvHeaders.map(k=>csvCell(row[k])).join(','))].join('\n')+'\n';
await writeFile(new URL(out+'overlap-254-per-id.csv',root),csv);hashes.push(sha(Buffer.from(csv))+'  overlap-254-per-id.csv');
await writeFile(new URL(out+'checksums-investigation.sha256',root),hashes.join('\n')+'\n');
const report=[
 '# RT-AUDIT.1.1 — suprapuneri si egalitati','',
 'Snapshot: '+oldSummary.snapshot_id,
 'Suprapuneri cuantificate: '+quantified.length+'/254; erori GIS: '+failures.length+'; egalitati masurate: '+result.counts.successfully_measured_equalities+'/3.',
 'Suma ariilor de intersectie pe perechi: '+result.pairwise_areas_km2.sum_intersection+' km².',
 'Suma ariilor copilului in afara parintelui: '+result.pairwise_areas_km2.sum_child_outside_parent+' km².',
 '**Atentie:** aceste sume nu sunt reuniuni spatiale si nu se pot interpreta drept suprafata unica afectata.',
 'Clasificari observabile: '+JSON.stringify(result.observed_patterns),
 'Niveluri topologice copil/parinte: '+JSON.stringify(result.hierarchy_boundary_contexts),
 'Cauza administrativa sau istorica nu este demonstrata automat din topologie.',
 'Egalitati: '+equality.map(x=>x.child_id+' / '+x.parent_id+' = '+x.semantic_pattern).join('; '),
 'Metoda: P8.3 JSTS OverlayOp fara snapping, cu validare a identitatilor de arie; arie sferica IUGG 6.371.008,8 m.',
 'Fara modificari ACTUAL, fara reparentari.'
].join('\n\n')+'\n';
await writeFile(new URL(out+'overlap-investigation.md',root),report);
console.log(JSON.stringify({status:result.status,counts:result.counts,areas:result.pairwise_areas_km2,patterns:result.observed_patterns}));
if(failures.length||equality.some(e=>e.evaluation_error))process.exitCode=1;
