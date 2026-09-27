#!/usr/bin/env node
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {area,intersect,featureCollection,pointOnFeature,booleanPointInPolygon} from '@turf/turf';

const reconciliation=JSON.parse(await readFile('data/current/ro-official-reconciliation.json','utf8'));
const official=JSON.parse(await readFile('data/sources/ro-siruta-current.json','utf8'));
const catalog=JSON.parse(await readFile('data/current/entities.json','utf8'));
const geo=JSON.parse(await readFile('public/geo/current/ro-administrative.geojson','utf8'));
const reviewed=JSON.parse(await readFile('data/sources/ro-siruta-reviewed-overrides.json','utf8'));
const parentAssignmentReviewed=JSON.parse(await readFile('data/sources/ro-parent-assignment-reviewed-resolutions.json','utf8'));
const officialOnlyReviewed=JSON.parse(await readFile('data/sources/ro-official-only-reviewed-resolutions.json','utf8'));
const otherLevelReviewed=JSON.parse(await readFile('data/sources/ro-other-level-reviewed-resolutions.json','utf8'));

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
const entityById=new Map((catalog.entities||[]).map(e=>[e.id,e]));
const roAdmin4Entities=(catalog.entities||[]).filter(e=>e.jurisdiction==='RO'&&Number(e.osm?.admin_level)===4);
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
  created_changeset:versions[0].changeset,
  current_version:versions.at(-1).version,
  last_modified_at:versions.at(-1).timestamp,
  last_changeset:versions.at(-1).changeset,
  current_tags:versions.at(-1).tags,
  current_member_count:versions.at(-1).members.length,
  current_members:versions.at(-1).members,
  versions:versions.map(v=>({version:v.version,timestamp:v.timestamp,changeset:v.changeset,user:v.user,tags:v.tags,members:v.members})),
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
 ...(reviewed.mappings||[]).map(x=>Number(x.osm_relation_id)),
 ...(parentAssignmentReviewed.items||[]).map(x=>Number(x.osm_relation_id)),
 ...(officialOnlyReviewed.items||[]).map(x=>Number(x.covering_osm_relation_id)),
 ...(otherLevelReviewed.items||[]).flatMap(x=>[Number(x.osm_relation_id),...(x.osm_sector_relations||[]).map(y=>Number(y.relation_id))])
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
 ...(reviewed.mappings||[]).map(x=>String(x.legal_id)),
 ...(officialOnlyReviewed.items||[]).flatMap(x=>[String(x.legal_id),String(x.covering_osm_relation_legal_id||'')])
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


function overlapEvidence(child,parent){
 if(!child||!parent)return {available:false,reason:'missing_geometry'};
 try{
  const childArea=area(child);
  const overlap=intersect(featureCollection([child,parent]));
  const overlapArea=overlap?area(overlap):0;
  return {
   available:true,
   child_area_km2:childArea/1e6,
   intersection_km2:overlapArea/1e6,
   child_coverage_ratio:childArea?overlapArea/childArea:null
  };
 }catch(e){return {available:false,reason:e.message};}
}
const crossCountyReviewed=(reviewed.mappings||[]).filter(x=>String(x.resolution||'').includes('cross_county_parent_conflict'));
const crossCountyParentAudits=crossCountyReviewed.map(x=>{
 const relationId=Number(x.osm_relation_id),legalId=String(x.legal_id);
 const childEntity=entityByRelation.get(relationId)||null;
 const childFeature=featureByRelation.get(relationId)||null;
 const legalUat=uatByCode.get(legalId)||null;
 const geometricParent=childEntity?.parent_id?entityById.get(childEntity.parent_id)||null:null;
 const legalParent=legalUat?.county_name?roAdmin4Entities.find(e=>norm(e.name)===norm(legalUat.county_name))||null:null;
 const geometricParentFeature=geometricParent?featureByRelation.get(Number(geometricParent.osm?.relation_id))||null:null;
 const legalParentFeature=legalParent?featureByRelation.get(Number(legalParent.osm?.relation_id))||null:null;
 let representativePoint=null,pointInsideGeometricParent=null,pointInsideLegalParent=null;
 try{
  representativePoint=childFeature?pointOnFeature(childFeature):null;
  if(representativePoint&&geometricParentFeature)pointInsideGeometricParent=booleanPointInPolygon(representativePoint,geometricParentFeature);
  if(representativePoint&&legalParentFeature)pointInsideLegalParent=booleanPointInPolygon(representativePoint,legalParentFeature);
 }catch{}
 const geometricOverlap=overlapEvidence(childFeature,geometricParentFeature);
 const legalOverlap=overlapEvidence(childFeature,legalParentFeature);
 const gc=geometricOverlap.child_coverage_ratio,lc=legalOverlap.child_coverage_ratio;
 let auditClassification='geometry_or_parent_conflict_requires_review';
 if(Number.isFinite(lc)&&Number.isFinite(gc)){
  if(lc>=0.95&&gc<=0.05)auditClassification='point_on_feature_parent_assignment_artifact';
  else if(lc>gc)auditClassification='legal_parent_dominant_overlap_parent_assignment_conflict';
  else if(gc>lc)auditClassification='osm_geometry_dominantly_in_geometric_parent';
  else auditClassification='ambiguous_parent_overlap';
 }
 return {
  osm_relation_id:relationId,
  osm_name:childEntity?.name||x.osm_name||null,
  legal_id:legalId,
  legal_name:legalUat?.name||x.legal_name||null,
  legal_parent_name:legalUat?.county_name||null,
  legal_parent_osm_relation_id:legalParent?.osm?.relation_id??null,
  geometric_parent_id:childEntity?.parent_id||null,
  geometric_parent_name:geometricParent?.name||null,
  geometric_parent_osm_relation_id:geometricParent?.osm?.relation_id??null,
  representative_point:representativePoint?.geometry?.coordinates||null,
  representative_point_inside_geometric_parent:pointInsideGeometricParent,
  representative_point_inside_legal_parent:pointInsideLegalParent,
  legal_parent_overlap:legalOverlap,
  geometric_parent_overlap:geometricOverlap,
  official_locality_containment:containmentEvidence(relationId,[legalId])[0]||null,
  osm_history:historyById.get(relationId)||null,
  audit_classification:auditClassification
 };
});


const parentAssignmentResolutions=(parentAssignmentReviewed.items||[]).map(x=>{
 const relationId=Number(x.osm_relation_id),legalId=String(x.legal_id);
 const entity=entityByRelation.get(relationId)||null;
 const actualParent=entity?.parent_id?entityById.get(entity.parent_id)||null:null;
 const expectedParent=entityByRelation.get(Number(x.resolved_parent_osm_relation_id))||null;
 const previousParent=entityByRelation.get(Number(x.previous_incorrect_parent_osm_relation_id))||null;
 const childFeature=featureByRelation.get(relationId)||null;
 const expectedParentFeature=expectedParent?featureByRelation.get(Number(expectedParent.osm?.relation_id))||null:null;
 const previousParentFeature=previousParent?featureByRelation.get(Number(previousParent.osm?.relation_id))||null:null;
 const expectedOverlap=overlapEvidence(childFeature,expectedParentFeature);
 const previousOverlap=overlapEvidence(childFeature,previousParentFeature);
 const reconciliationMatch=(reconciliation.matches||[]).find(m=>Number(m.osm_relation_id)===relationId)||null;
 const overridePresent=(reviewed.mappings||[]).some(m=>Number(m.osm_relation_id)===relationId);
 const legalUat=uatByCode.get(legalId)||null;
 const history=historyById.get(relationId)||null;
 const ok=Boolean(
  entity
  && actualParent
  && Number(actualParent.osm?.relation_id)===Number(x.resolved_parent_osm_relation_id)
  && legalUat
  && norm(legalUat.county_name)===norm(x.legal_parent_name)
  && reconciliationMatch
  && String(reconciliationMatch.legal_id)===legalId
  && reconciliationMatch.match_method==='exact_normalized_name_and_county'
  && !overridePresent
  && expectedOverlap.available===true
  && Number(expectedOverlap.child_coverage_ratio)>=0.95
  && previousOverlap.available===true
  && Number(previousOverlap.child_coverage_ratio)<=0.05
 );
 return {
  osm_relation_id:relationId,
  osm_name:entity?.name||x.osm_name||null,
  legal_id:legalId,
  legal_name:legalUat?.name||x.legal_name||null,
  expected_parent_osm_relation_id:Number(x.resolved_parent_osm_relation_id),
  actual_parent_osm_relation_id:actualParent?.osm?.relation_id??null,
  actual_parent_name:actualParent?.name||null,
  reconciliation_match_method:reconciliationMatch?.match_method||null,
  reviewed_identity_override_present:overridePresent,
  expected_parent_overlap:expectedOverlap,
  previous_parent_overlap:previousOverlap,
  history,
  resolution:x.resolution||null,
  stable:ok
 };
});

const officialOnlyResolutionValidation=(officialOnlyReviewed.items||[]).map(x=>{
 const legalId=String(x.legal_id),coveringLegalId=String(x.covering_osm_relation_legal_id||'');
 const relationId=Number(x.covering_osm_relation_id);
 const reviewedResolution=(reconciliation.reviewed_official_only_resolutions||[]).find(y=>String(y.legal_id)===legalId)||null;
 const entity=entityByRelation.get(relationId)||null;
 const parent=entity?.parent_id?entityById.get(entity.parent_id)||null:null;
 const feature=featureByRelation.get(relationId)||null;
 const primaryContainment=containmentEvidence(relationId,[legalId])[0]||null;
 const coveringContainment=coveringLegalId?containmentEvidence(relationId,[coveringLegalId])[0]||null:null;
 const history=historyById.get(relationId)||null;
 let relationAreaKm2=null;
 try{relationAreaKm2=feature?area(feature)/1e6:null;}catch{}
 const primaryInsideAll=Boolean(primaryContainment&&primaryContainment.official_locality_count>0&&primaryContainment.inside_count===primaryContainment.official_locality_count);
 const coveringInsideAll=Boolean(coveringContainment&&coveringContainment.official_locality_count>0&&coveringContainment.inside_count===coveringContainment.official_locality_count);
 const expectedComponentIds=[...(x.official_component_locality_ids||[])].map(String).sort();
 const actualComponentIds=[...(primaryContainment?.inside_localities||[])].map(y=>String(y.siruta)).filter(Boolean).sort();
 const componentIdsMatch=expectedComponentIds.length>0&&expectedComponentIds.length===actualComponentIds.length&&expectedComponentIds.every((id,i)=>id===actualComponentIds[i]);
 const stable=Boolean(
  reviewedResolution
  && reviewedResolution.classification===x.classification
  && entity
  && Number(entity.osm?.admin_level)===8
  && norm(entity.name)===norm(x.covering_osm_relation_name)
  && Number(parent?.osm?.relation_id)===Number(x.expected_parent_osm_relation_id)
  && primaryInsideAll
  && coveringInsideAll
  && componentIdsMatch
  && history
 );
 return {
  legal_id:legalId,
  legal_name:x.legal_name,
  legal_type:x.legal_type,
  legal_parent_name:x.legal_parent_name,
  classification:x.classification,
  covering_osm_relation_id:relationId,
  covering_osm_relation_name:entity?.name||null,
  covering_osm_relation_legal_id:coveringLegalId||null,
  covering_osm_parent_relation_id:parent?.osm?.relation_id??null,
  covering_relation_area_km2:relationAreaKm2,
  official_locality_containment:primaryContainment,
  covering_uat_official_locality_containment:coveringContainment,
  expected_component_locality_ids:expectedComponentIds,
  actual_component_locality_ids:actualComponentIds,
  component_locality_ids_match:componentIdsMatch,
  osm_history:history,
  geometry_modified:false,
  legal_geometry_claimed:false,
  stable
 };
});

const otherLevelResolutionValidation=(otherLevelReviewed.items||[]).map(x=>{
 const legalId=String(x.legal_id),relationId=Number(x.osm_relation_id);
 const reviewedResolution=(reconciliation.reviewed_other_level_resolutions||[]).find(y=>String(y.legal_id)===legalId)||null;
 const entity=entityByRelation.get(relationId)||null;
 const feature=featureByRelation.get(relationId)||null;
 const uat=uatByCode.get(legalId)||null;
 const history=historyById.get(relationId)||null;
 const expectedOfficialSectorIds=[...(x.official_sector_ids||[])].map(String).sort();
 const actualOfficialSectors=(official.records||[])
  .filter(r=>String(r.parent_siruta||'')===legalId&&String(r.type_code||'')==='6')
  .map(r=>({siruta:String(r.siruta),name:r.name})).sort((a,b)=>a.siruta.localeCompare(b.siruta));
 const actualOfficialSectorIds=actualOfficialSectors.map(r=>r.siruta);
 const officialSectorIdsMatch=expectedOfficialSectorIds.length===actualOfficialSectorIds.length&&expectedOfficialSectorIds.every((id,i)=>id===actualOfficialSectorIds[i]);
 const expectedOsmSectors=[...(x.osm_sector_relations||[])].map(y=>({relation_id:Number(y.relation_id),name:y.name})).sort((a,b)=>a.relation_id-b.relation_id);
 const actualOsmSectors=expectedOsmSectors.map(expected=>{
  const sector=entityByRelation.get(expected.relation_id)||null;
  const sectorFeature=featureByRelation.get(expected.relation_id)||null;
  const coverage=overlapEvidence(sectorFeature,feature);
  return {
   relation_id:expected.relation_id,
   expected_name:expected.name,
   actual_name:sector?.name||null,
   admin_level:sector?.osm?.admin_level??null,
   type:sector?.type||null,
   parent_id:sector?.parent_id||null,
   parent_coverage_ratio:coverage.child_coverage_ratio??null,
   history:historyById.get(expected.relation_id)||null
  };
 });
 const osmSectorsStable=actualOsmSectors.length===6&&actualOsmSectors.every(y=>
  y.actual_name&&norm(y.actual_name)===norm(y.expected_name)
  && Number(y.admin_level)===9
  && y.type==='sector'
  && y.parent_id==='osm-r'+relationId
  && Number(y.parent_coverage_ratio)>=0.999
  && y.history
 );
 const stable=Boolean(
  reviewedResolution
  && reviewedResolution.classification===x.classification
  && entity
  && Number(entity.osm?.admin_level)===Number(x.osm_admin_level)
  && entity.type===x.osm_entity_type
  && norm(entity.name)===norm(x.osm_relation_name)
  && String(entity.parent_id||'')===String(x.expected_catalog_parent_id||'')
  && uat
  && norm(uat.name)===norm(x.legal_name)
  && uat.legal_type===x.legal_type
  && String(uat.parent_siruta||'')===String(x.legal_parent_id||'')
  && norm(uat.county_name)===norm(x.legal_parent_name)
  && officialSectorIdsMatch
  && osmSectorsStable
  && history
  && String(history.current_tags?.admin_level||'')===String(x.osm_admin_level)
 );
 return {
  legal_id:legalId,
  legal_name:uat?.name||x.legal_name,
  legal_type:uat?.legal_type||x.legal_type,
  legal_parent_id:uat?.parent_siruta||null,
  legal_parent_name:uat?.county_name||null,
  classification:x.classification,
  osm_relation_id:relationId,
  osm_relation_name:entity?.name||null,
  osm_admin_level:entity?.osm?.admin_level??null,
  osm_entity_type:entity?.type||null,
  catalog_parent_id:entity?.parent_id||null,
  official_sectors:actualOfficialSectors,
  official_sector_ids_match:officialSectorIdsMatch,
  osm_sectors:actualOsmSectors,
  osm_history:history,
  geometry_modified:false,
  legal_geometry_claimed:false,
  stable
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
check('cross_county_parent_conflicts_audited',crossCountyParentAudits.length===crossCountyReviewed.length,{expected:crossCountyReviewed.length,audited:crossCountyParentAudits.length});
const unstableParentAssignments=parentAssignmentResolutions.filter(x=>!x.stable);
check('reviewed_parent_assignment_resolutions_stable',unstableParentAssignments.length===0,{failed:unstableParentAssignments});
const unstableOfficialOnlyResolutions=officialOnlyResolutionValidation.filter(x=>!x.stable);
check('reviewed_official_only_resolutions_stable',unstableOfficialOnlyResolutions.length===0,{failed:unstableOfficialOnlyResolutions});
const unstableOtherLevelResolutions=otherLevelResolutionValidation.filter(x=>!x.stable);
check('reviewed_other_level_resolutions_stable',unstableOtherLevelResolutions.length===0,{failed:unstableOtherLevelResolutions});
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
 scope:'Targeted audit of unresolved/duplicate/type-conflict cases, reviewed missing-distinct-boundary cases, and reviewed exceptional cross-level OSM representations from official SIRUTA reconciliation.',
 policy:'Exact SIRUTA hierarchy, official locality containment and OSM provenance are recorded; no fuzzy candidate is auto-assigned. An OSM relation that overcovers multiple legal UAT locality sets is retained only as representation evidence and is never promoted to legal geometry for the missing UAT. Jurisdiction-specific exceptional OSM admin levels are accepted only through reviewed structural resolutions with stable legal identity, hierarchy, nested subdivisions and OSM history.',
 status:failures.length?'FAIL':'PASS',checks,
 summary:{
  target_relation_count:targetIds.length,
  unmatched_case_count:unmatched.length,
  single_official_uat_locality_containment_count:unmatched.filter(x=>x.audit_classification==='single_official_uat_localities_inside_osm_polygon').length,
  exact_component_locality_single_uat_count:unmatched.filter(x=>x.audit_classification==='exact_component_locality_points_to_single_uat').length,
  requires_review_count:unmatched.filter(x=>x.audit_classification==='requires_review').length,
  duplicate_group_count:duplicateGroups.length,
  type_mismatch_count:typeMismatches.length,
  cross_county_parent_conflict_count:crossCountyParentAudits.length,
  reviewed_parent_assignment_resolution_count:parentAssignmentResolutions.length,
  reviewed_official_only_resolution_count:officialOnlyResolutionValidation.length,
   reviewed_other_level_resolution_count:otherLevelResolutionValidation.length,
  reviewed_override_count:reviewedOverrideValidation.length,
  reviewed_override_containment_failure_count:reviewedOverrideValidation.filter(x=>x.identity_containment_ok===false).length,
  history_error_count:historyErrors.length,
  diagnostic_warning_count:warnings.length
 },
 unmatched,duplicate_groups:duplicateGroups,type_mismatches:typeMismatches,cross_county_parent_conflicts:crossCountyParentAudits,reviewed_parent_assignment_resolutions:parentAssignmentResolutions,reviewed_official_only_resolutions:officialOnlyResolutionValidation,reviewed_other_level_resolutions:otherLevelResolutionValidation,reviewed_overrides:reviewedOverrideValidation,warnings,failures
};
const historyOut={schema_version:1,generated_at:report.generated_at,source:'OpenStreetMap API 0.6 relation history',relation_count:targetIds.length,history_count:histories.length,error_count:historyErrors.length,errors:historyErrors,relations:histories};
await mkdir('data/current',{recursive:true});await mkdir('data/sources',{recursive:true});
await writeFile('data/current/ro-official-exception-audit.json',JSON.stringify(report,null,2)+'\n');
await writeFile('data/sources/ro-osm-official-exception-history.json',JSON.stringify(historyOut,null,2)+'\n');
console.log(JSON.stringify({status:report.status,summary:report.summary,failures},null,2));
if(failures.length)process.exitCode=1;
