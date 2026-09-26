#!/usr/bin/env node
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {area,intersect,featureCollection,pointOnFeature,booleanPointInPolygon} from '@turf/turf';

const reconciliation=JSON.parse(await readFile('data/current/ro-official-reconciliation.json','utf8'));
const official=JSON.parse(await readFile('data/sources/ro-siruta-current.json','utf8'));
const catalog=JSON.parse(await readFile('data/current/entities.json','utf8'));
const geo=JSON.parse(await readFile('public/geo/current/ro-administrative.geojson','utf8'));
const reviewed=JSON.parse(await readFile('data/sources/ro-siruta-reviewed-overrides.json','utf8'));

const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
 .replace(/[„”"'’]/g,' ')
 .replace(/\b(judetul|judet|municipiul|municipiu|orasul|oras|comuna|sectorul|sector)\b/g,' ')
 .replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const lev=(a,b)=>{
 a=norm(a);b=norm(b);
 const m=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
 for(let i=0;i<=a.length;i++)m[i][0]=i;
 for(let j=0;j<=b.length;j++)m[0][j]=j;
 for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)m[i][j]=Math.min(
  m[i-1][j]+1,m[i][j-1]+1,m[i-1][j-1]+(a[i-1]===b[j-1]?0:1)
 );
 return m[a.length][b.length];
};
const tagsOf=f=>f?.properties?.tags||f?.properties||{};
const relationId=f=>{
 const raw=String(f?.id||f?.properties?.id||'');
 const m=raw.match(/(?:relation\/)?(\d+)/);
 return m?Number(m[1]):null;
};
const featureByRelation=new Map((geo.features||[]).map(f=>[relationId(f),f]).filter(([id])=>id));
const entityByRelation=new Map((catalog.entities||[]).filter(e=>e.jurisdiction==='RO').map(e=>[Number(e.osm?.relation_id),e]));
const byCode=new Map((official.records||[]).map(x=>[String(x.siruta),x]));
const uats=(official.records||[]).filter(x=>Number(x.level)===2);
const countyName=x=>{
 let p=byCode.get(String(x.parent_siruta||''));
 return x.county_name||p?.name||x.parent_name||null;
};
const uatRows=uats.map(x=>({...x,county_name:countyName(x),n_name:norm(x.name),n_county:norm(countyName(x))}));
const uatByCode=new Map(uatRows.map(x=>[String(x.siruta),x]));
const INS_LOCALITIES='https://webgis.insse.ro/servicii/rest/services/Operational/Localitati/MapServer/0/query';
const ascendUat=record=>{
 let x=record,guard=0;
 while(x&&Number(x.level)!==2&&x.parent_siruta&&guard++<8)x=byCode.get(String(x.parent_siruta));
 return x&&Number(x.level)===2?uatByCode.get(String(x.siruta))||null:null;
};
const componentIndex=new Map();
for(const rec of official.records||[]){
 if(Number(rec.level)<=2)continue;
 const k=norm(rec.name); if(!k)continue;
 const uat=ascendUat(rec); if(!uat)continue;
 if(!componentIndex.has(k))componentIndex.set(k,[]);
 componentIndex.get(k).push({record:rec,uat});
}

async function fetchText(url){
 let last;
 for(let attempt=1;attempt<=3;attempt++){
  try{
   const r=await fetch(url,{headers:{'user-agent':'reforma-teritoriala-ro-official-exception-audit/0.1'},signal:AbortSignal.timeout(30000)});
   if(!r.ok)throw new Error('HTTP '+r.status);
   return await r.text();
  }catch(e){last=e;if(attempt<3)await new Promise(r=>setTimeout(r,2000*attempt));}
 }
 throw last;
}
const attrs=s=>Object.fromEntries([...s.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m=>[
 m[1],m[2].replaceAll('&quot;','"').replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>')
]));
function parseHistory(xml,id){
 const versions=[];
 for(const m of xml.matchAll(/<relation\b([^>]*)>([\s\S]*?)<\/relation>/g)){
  const a=attrs(m[1]),body=m[2],tags={},members=[];
  for(const t of body.matchAll(/<tag\b([^>]*)\/>/g)){const x=attrs(t[1]);tags[x.k]=x.v;}
  for(const mm of body.matchAll(/<member\b([^>]*)\/>/g)){const x=attrs(mm[1]);members.push({type:x.type,ref:Number(x.ref),role:x.role||''});}
  versions.push({version:Number(a.version),timestamp:a.timestamp,changeset:Number(a.changeset),user:a.user||null,tags,members});
 }
 if(!versions.length)throw new Error('No OSM history parsed for '+id);
 const unique=k=>[...new Set(versions.map(v=>v.tags[k]).filter(v=>v!==undefined))];
 return {
  relation_id:id,
  created_at:versions[0].timestamp,
  current_version:versions.at(-1).version,
  last_modified_at:versions.at(-1).timestamp,
  last_changeset:versions.at(-1).changeset,
  current_tags:versions.at(-1).tags,
  current_member_count:versions.at(-1).members.length,
  history_signals:{
   name_values:unique('name'),official_name_values:unique('official_name'),admin_level_values:unique('admin_level'),
   place_values:unique('place'),place_ro_values:unique('place:ro'),source_values:unique('source'),
   siruta_code_values:[...new Set(versions.flatMap(v=>['siruta:code','ref:siruta','siruta','ref:ins:siruta'].map(k=>v.tags[k]).filter(Boolean)))]
  }
 };
}

const targetIds=[...new Set([
 ...(reconciliation.unmatched_osm||[]).map(x=>x.osm_relation_id),
 ...(reconciliation.duplicate_legal_mappings||[]).flatMap(x=>x.osm_relation_ids||[]),
 ...(reconciliation.type_mismatches||[]).map(x=>x.osm_relation_id),
 ...(reviewed.mappings||[]).map(x=>Number(x.osm_relation_id))
].filter(Boolean))];
const histories=[],historyErrors=[];
for(const id of targetIds){
 try{histories.push(parseHistory(await fetchText('https://api.openstreetmap.org/api/0.6/relation/'+id+'/history'),id));}
 catch(e){historyErrors.push({relation_id:id,error:e.message});}
}
const historyById=new Map(histories.map(x=>[x.relation_id,x]));

async function fetchOfficialLocalityGeometries(codes){
 const ids=[...new Set(codes.map(String).filter(x=>/^\d+$/.test(x)))];
 if(!ids.length)return [];
 const features=[];
 for(let i=0;i<ids.length;i+=40){
  const chunk=ids.slice(i,i+40);
  const params=new URLSearchParams({
   where:'siruta_sup IN ('+chunk.join(',')+')',
   outFields:'siruta,siruta_sup,denumire,den_superior,judet,cod_jud,loc,tiplocalitate',
   returnGeometry:'true',outSR:'4326',f:'geojson'
  });
  let j=null,last=null;
  for(let attempt=1;attempt<=3;attempt++){
   try{
    const r=await fetch(INS_LOCALITIES+'?'+params,{headers:{'user-agent':'reforma-teritoriala-ro-official-exception-audit/0.2'},signal:AbortSignal.timeout(30000)});
    if(!r.ok)throw new Error('INS locality geometry HTTP '+r.status);
    j=await r.json();
    if(j.error)throw new Error('INS locality geometry '+JSON.stringify(j.error));
    break;
   }catch(e){last=e;if(attempt<3)await new Promise(r=>setTimeout(r,2000*attempt));}
  }
  if(!j)throw last||new Error('INS locality geometry unavailable');
  features.push(...(j.features||[]));
 }
 return features;
}
const sameCountyContainingName=(name,county)=>uatRows.filter(r=>r.n_county===norm(county)&&(r.n_name.includes(norm(name))||norm(name).includes(r.n_name)));
const provisionalUnmatched=(reconciliation.unmatched_osm||[]).map(x=>{
 const county=norm(x.osm_parent_name);
 const sameCounty=uatRows.filter(r=>r.n_county===county);
 const nearest=sameCounty.map(r=>({
  legal_id:r.siruta,legal_name:r.name,legal_type:r.legal_type||null,legal_parent_name:r.county_name,
  edit_distance:lev(x.osm_name,r.name)
 })).sort((a,b)=>a.edit_distance-b.edit_distance||String(a.legal_id).localeCompare(String(b.legal_id))).slice(0,5);
 const components=(componentIndex.get(norm(x.osm_name))||[])
  .filter(c=>c.uat.n_county===county)
  .map(c=>({component_siruta:c.record.siruta,component_name:c.record.name,legal_id:c.uat.siruta,legal_name:c.uat.name,legal_type:c.uat.legal_type||null,legal_parent_name:c.uat.county_name}));
 const contains=sameCountyContainingName(x.osm_name,x.osm_parent_name).map(r=>({legal_id:r.siruta,legal_name:r.name,legal_type:r.legal_type||null,legal_parent_name:r.county_name}));
 const candidateIds=[...new Set([
  ...components.map(y=>y.legal_id),
  ...nearest.map(y=>y.legal_id),
  ...(x.candidates||[]).map(y=>y.siruta),
  ...contains.map(y=>y.legal_id)
 ].filter(Boolean).map(String))];
 return {base:x,county,nearest,components,contains,candidateIds};
});
const duplicateCandidateIds=new Set();
for(const g of reconciliation.duplicate_legal_mappings||[]){
 duplicateCandidateIds.add(String(g.legal_id));
 const firstRelation=(g.osm_relation_ids||[])[0];
 const parentName=entityByRelation.get(firstRelation)?.parent_id?catalog.entities.find(e=>e.id===entityByRelation.get(firstRelation).parent_id)?.name:null;
 for(const o of reconciliation.official_only||[])if(norm(o.legal_parent_name)===norm(parentName))duplicateCandidateIds.add(String(o.legal_id));
}
const allCandidateCodes=[
 ...provisionalUnmatched.flatMap(x=>x.candidateIds),
 ...duplicateCandidateIds,
 ...(reviewed.mappings||[]).map(x=>String(x.legal_id))
];
let officialLocalityFeatures=[],officialLocalityGeometryError=null;
try{officialLocalityFeatures=await fetchOfficialLocalityGeometries(allCandidateCodes);}
catch(e){officialLocalityGeometryError=e.message;}
const officialLocalitiesByUat=new Map();
for(const f of officialLocalityFeatures){
 const p=f.properties||{},id=String(p.siruta_sup??p.SIRUTA_SUP??'');
 if(!id)continue;
 if(!officialLocalitiesByUat.has(id))officialLocalitiesByUat.set(id,[]);
 officialLocalitiesByUat.get(id).push(f);
}
function containmentEvidence(relationId,candidateIds){
 const polygon=featureByRelation.get(relationId);
 if(!polygon)return [];
 return [...new Set(candidateIds.map(String))].map(legal_id=>{
  const feats=officialLocalitiesByUat.get(legal_id)||[],inside=[];
  for(const f of feats){
   try{
    const pt=f.geometry?.type==='Point'?f:pointOnFeature(f);
    if(booleanPointInPolygon(pt,polygon))inside.push({
     siruta:String(f.properties?.siruta??f.properties?.SIRUTA??''),
     name:f.properties?.denumire??f.properties?.DENUMIRE??null
    });
   }catch{}
  }
  const uat=uatByCode.get(legal_id);
  return {legal_id,legal_name:uat?.name||null,legal_parent_name:uat?.county_name||null,official_locality_count:feats.length,inside_count:inside.length,inside_localities:inside};
 }).sort((a,b)=>b.inside_count-a.inside_count||String(a.legal_id).localeCompare(String(b.legal_id)));
}

const unmatched=provisionalUnmatched.map(({base:x,nearest,components,contains,candidateIds})=>{
 const containment=containmentEvidence(x.osm_relation_id,candidateIds);
 return {
  ...x,
  current_osm_tags:tagsOf(featureByRelation.get(x.osm_relation_id)),
  history:historyById.get(x.osm_relation_id)||null,
  exact_component_locality_candidates:components,
  official_name_contains_candidates:contains,
  nearest_official_uat_candidates:nearest,
  official_locality_containment:containment,
  audit_classification:containment.filter(y=>y.inside_count>0).length===1?'single_official_uat_localities_inside_osm_polygon':components.length===1?'exact_component_locality_points_to_single_uat':'requires_review'
 };
});

const duplicateGroups=(reconciliation.duplicate_legal_mappings||[]).map(g=>{
 const firstRelation=(g.osm_relation_ids||[])[0];
 const parentId=entityByRelation.get(firstRelation)?.parent_id||null;
 const parentName=parentId?(catalog.entities||[]).find(e=>e.id===parentId)?.name:null;
 const altOfficial=(reconciliation.official_only||[]).filter(o=>norm(o.legal_parent_name)===norm(parentName)).map(o=>String(o.legal_id));
 const candidateIds=[String(g.legal_id),...altOfficial];
 const items=(g.osm_relation_ids||[]).map(id=>{
  const f=featureByRelation.get(id),e=entityByRelation.get(id);
  return {relation_id:id,name:e?.name||tagsOf(f).name||null,parent_id:e?.parent_id||null,area_km2:f?area(f)/1e6:null,tags:tagsOf(f),history:historyById.get(id)||null,official_locality_containment:containmentEvidence(id,candidateIds)};
 });
 let overlap=null;
 if(items.length===2){
  const a=featureByRelation.get(items[0].relation_id),b=featureByRelation.get(items[1].relation_id);
  try{
   const i=intersect(featureCollection([a,b]));
   const ia=i?area(i)/1e6:0,aa=area(a)/1e6,ba=area(b)/1e6;
   overlap={intersection_km2:ia,intersection_over_smaller:Math.min(aa,ba)?ia/Math.min(aa,ba):null,intersection_over_union:(aa+ba-ia)?ia/(aa+ba-ia):null};
  }catch(e){overlap={error:e.message};}
 }
 return {...g,items,overlap};
});

const reviewedOverrideValidation=(reviewed.mappings||[]).map(x=>{
 const relationId=Number(x.osm_relation_id),legalId=String(x.legal_id);
 const entity=entityByRelation.get(relationId)||null;
 const uat=uatByCode.get(legalId)||null;
 const containment=containmentEvidence(relationId,[legalId])[0]||null;
 const containmentOk=officialLocalityGeometryError?null:Boolean(containment&&containment.official_locality_count>0&&containment.inside_count===containment.official_locality_count);
 return {
  osm_relation_id:relationId,
  osm_name:entity?.name||x.osm_name||null,
  legal_id:legalId,
  legal_name:uat?.name||x.legal_name||null,
  resolution:x.resolution||null,
  relation_present:Boolean(entity),
  official_uat_present:Boolean(uat),
  official_locality_containment:containment,
  identity_containment_ok:containmentOk
 };
});

const typeMismatches=(reconciliation.type_mismatches||[]).map(x=>({
 ...x,
 current_osm_tags:tagsOf(featureByRelation.get(x.osm_relation_id)),
 history:historyById.get(x.osm_relation_id)||null,
 audit_classification:'official_legal_type_conflicts_with_osm_classifier'
}));

const checks=[],failures=[],warnings=[];
const check=(name,ok,detail)=>{checks.push({name,ok,detail});if(!ok)failures.push({name,detail});};
check('all_exception_histories_available',historyErrors.length===0,{errors:historyErrors});
checks.push({name:'official_locality_geometry_available',ok:officialLocalityGeometryError===null,diagnostic:true,detail:{error:officialLocalityGeometryError,feature_count:officialLocalityFeatures.length}});
if(officialLocalityGeometryError)warnings.push({name:'official_locality_geometry_unavailable',detail:{error:officialLocalityGeometryError}});
check('all_unmatched_cases_audited',unmatched.length===(reconciliation.unmatched_osm||[]).length,{count:unmatched.length});
check('all_duplicate_groups_audited',duplicateGroups.length===(reconciliation.duplicate_legal_mappings||[]).length,{count:duplicateGroups.length});
check('all_type_mismatches_audited',typeMismatches.length===(reconciliation.type_mismatches||[]).length,{count:typeMismatches.length});
const missingReviewedRelations=reviewedOverrideValidation.filter(x=>!x.relation_present).map(x=>x.osm_relation_id);
const missingReviewedUats=reviewedOverrideValidation.filter(x=>!x.official_uat_present).map(x=>({osm_relation_id:x.osm_relation_id,legal_id:x.legal_id}));
check('reviewed_override_relations_present',missingReviewedRelations.length===0,{missing:missingReviewedRelations});
check('reviewed_override_uats_present',missingReviewedUats.length===0,{missing:missingReviewedUats});
if(!officialLocalityGeometryError){
 const badContainment=reviewedOverrideValidation.filter(x=>x.identity_containment_ok!==true).map(x=>({osm_relation_id:x.osm_relation_id,legal_id:x.legal_id,containment:x.official_locality_containment}));
 check('reviewed_override_identity_containment_stable',badContainment.length===0,{failed:badContainment});
}

const report={
 schema_version:1,generated_at:new Date().toISOString(),jurisdiction:'RO',
 scope:'Targeted audit of unresolved/duplicate/type-conflict cases from official SIRUTA reconciliation.',
 policy:'Diagnostic only. Exact SIRUTA hierarchy and OSM provenance are recorded; no fuzzy candidate is auto-assigned. OSM geometry is not treated as legal authority.',
 status:failures.length?'FAIL':'PASS',checks,
 summary:{
  target_relation_count:targetIds.length,
  unmatched_case_count:unmatched.length,
  single_official_uat_locality_containment_count:unmatched.filter(x=>x.audit_classification==='single_official_uat_localities_inside_osm_polygon').length,
  exact_component_locality_single_uat_count:unmatched.filter(x=>x.audit_classification==='exact_component_locality_points_to_single_uat').length,
  requires_review_count:unmatched.filter(x=>x.audit_classification==='requires_review').length,
  duplicate_group_count:duplicateGroups.length,
  type_mismatch_count:typeMismatches.length,
  reviewed_override_count:reviewedOverrideValidation.length,
  reviewed_override_containment_failure_count:reviewedOverrideValidation.filter(x=>x.identity_containment_ok===false).length,
  history_error_count:historyErrors.length,
  diagnostic_warning_count:warnings.length
 },
 unmatched,duplicate_groups:duplicateGroups,type_mismatches:typeMismatches,reviewed_overrides:reviewedOverrideValidation,warnings,failures
};
const historyOut={schema_version:1,generated_at:report.generated_at,source:'OpenStreetMap API 0.6 relation history',relation_count:targetIds.length,history_count:histories.length,error_count:historyErrors.length,errors:historyErrors,relations:histories};
await mkdir('data/current',{recursive:true});await mkdir('data/sources',{recursive:true});
await writeFile('data/current/ro-official-exception-audit.json',JSON.stringify(report,null,2)+'\n');
await writeFile('data/sources/ro-osm-official-exception-history.json',JSON.stringify(historyOut,null,2)+'\n');
console.log(JSON.stringify({status:report.status,summary:report.summary,failures},null,2));
if(failures.length)process.exitCode=1;
