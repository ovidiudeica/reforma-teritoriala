#!/usr/bin/env node
import {mkdir,readFile,writeFile} from 'node:fs/promises';

const SNAPSHOT='data/sources/ro-siruta-current.json';
const OUTPUT='data/current/ro-official-reconciliation.json';
const OVERRIDES='data/sources/ro-siruta-reviewed-overrides.json';
const OFFICIAL_ONLY_RESOLUTIONS='data/sources/ro-official-only-reviewed-resolutions.json';
const OTHER_LEVEL_RESOLUTIONS='data/sources/ro-other-level-reviewed-resolutions.json';
const catalog=JSON.parse(await readFile('data/current/entities.json','utf8'));
const geo=JSON.parse(await readFile('public/geo/current/ro-administrative.geojson','utf8'));
const official=JSON.parse(await readFile(SNAPSHOT,'utf8'));
const reviewed=JSON.parse(await readFile(OVERRIDES,'utf8'));
const officialOnlyReviewed=JSON.parse(await readFile(OFFICIAL_ONLY_RESOLUTIONS,'utf8'));
const otherLevelReviewed=JSON.parse(await readFile(OTHER_LEVEL_RESOLUTIONS,'utf8'));

const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
 .replace(/[„”"'’]/g,' ')
 .replace(/\b(judetul|judet|municipiul|municipiu|orasul|oras|comuna|sectorul|sector)\b/g,' ')
 .replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const digits=v=>String(v??'').replace(/\.0$/,'').replace(/\D/g,'');
const typeFromTip=tip=>{
 switch(String(tip??'')){
  case '1':case '4':return 'municipality';
  case '2':case '5':return 'town';
  case '3':return 'commune';
  case '6':return 'sector';
  default:return null;
 }
};
const tagsOf=f=>f?.properties?.tags||f?.properties||{};
const osmClaimedLegalType=t=>{
 const fold=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const prefix=fold(t?.['name:prefix']||t?.name_prefix),placeRo=fold(t?.['place:ro']),place=fold(t?.place),official=fold(t?.official_name);
 if(prefix.startsWith('municipiul')||placeRo==='municipiu'||official.startsWith('municipiul')||place==='city')return 'municipality';
 if(prefix.startsWith('orasul')||placeRo==='oras'||official.startsWith('orasul')||place==='town')return 'town';
 if(prefix.startsWith('comuna')||placeRo==='comuna'||official.startsWith('comuna')||place==='municipality')return 'commune';
 return null;
};
const explicitSiruta=t=>{
 for(const k of ['siruta:code','ref:siruta','siruta','ref:ins:siruta','natCode','natcode']){
  const v=digits(t?.[k]);
  if(v)return {key:k,value:v};
 }
 return null;
};

const records=official.records||[];
const byCode=new Map(records.map(x=>[String(x.siruta),x]));
const counties=records.filter(x=>Number(x.level)===1);
const uats=records.filter(x=>Number(x.level)===2&&(x.legal_type||typeFromTip(x.type_code)));
const countyByJud=new Map();
for(const c of counties)if(c.county_code&&!countyByJud.has(String(c.county_code)))countyByJud.set(String(c.county_code),c);
const officialCounty=x=>byCode.get(String(x.parent_siruta||''))||countyByJud.get(String(x.county_code||''))||null;
const officialRows=uats.map(x=>{
 const county=officialCounty(x);
 return {...x,normalized_name:norm(x.name),legal_type:x.legal_type||typeFromTip(x.type_code),county_name:x.county_name||county?.name||x.parent_name||null,normalized_county:norm(x.county_name||county?.name||x.parent_name||'')};
});
const officialByCode=new Map(officialRows.map(x=>[String(x.siruta),x]));
const officialUatForAnySirutaCode=code=>{
 const direct=officialByCode.get(String(code));
 if(direct)return {row:direct,method:'explicit_siruta_code'};
 const record=byCode.get(String(code));
 if(!record)return null;
 let current=record,guard=0;
 while(current&&Number(current.level)!==2&&current.parent_siruta&&guard++<8)current=byCode.get(String(current.parent_siruta));
 const row=current&&Number(current.level)===2?officialByCode.get(String(current.siruta)):null;
 return row?{row,method:'explicit_siruta_locality_code_to_parent_uat'}:null;
};
const overrideRows=reviewed.mappings||[];
const overrideByRelation=new Map();
for(const x of overrideRows){
 const id=Number(x.osm_relation_id);
 if(!id||overrideByRelation.has(id))throw new Error('Duplicate/invalid reviewed override relation: '+x.osm_relation_id);
 overrideByRelation.set(id,x);
}
const officialOnlyResolutionRows=officialOnlyReviewed.items||[];
const otherLevelResolutionRows=otherLevelReviewed.items||[];
const otherLevelResolutionByLegalId=new Map();
for(const x of otherLevelResolutionRows){
 const legalId=String(x.legal_id||'');
 if(!legalId||otherLevelResolutionByLegalId.has(legalId))throw new Error('Duplicate/invalid reviewed other-level legal id: '+x.legal_id);
 otherLevelResolutionByLegalId.set(legalId,x);
}
const officialOnlyResolutionByLegalId=new Map();
for(const x of officialOnlyResolutionRows){
 const legalId=String(x.legal_id||'');
 if(!legalId||officialOnlyResolutionByLegalId.has(legalId))throw new Error('Duplicate/invalid reviewed official-only legal id: '+x.legal_id);
 officialOnlyResolutionByLegalId.set(legalId,x);
}
const officialByName=new Map();
for(const r of officialRows){
 if(!officialByName.has(r.normalized_name))officialByName.set(r.normalized_name,[]);
 officialByName.get(r.normalized_name).push(r);
}

const entities=(catalog.entities||[]).filter(e=>e.jurisdiction==='RO'&&Number(e.osm?.admin_level)===8);
const entityById=new Map((catalog.entities||[]).filter(e=>e.jurisdiction==='RO').map(e=>[e.id,e]));
const featureById=new Map((geo.features||[]).map(f=>[f.properties?.catalog_id,f]));
const results=[];
for(const e of entities){
 const feature=featureById.get(e.id),tags=tagsOf(feature);
 const parent=entityById.get(e.parent_id)||null;
 const osmCounty=norm(parent?.name||'');
 const explicit=explicitSiruta(tags);
 const reviewedOverride=overrideByRelation.get(Number(e.osm?.relation_id))||null;
 let officialRow=null,method=null,confidence=null,reason=null,candidates=[];
 if(explicit){
  const resolved=officialUatForAnySirutaCode(explicit.value);
  officialRow=resolved?.row||null;
  if(officialRow){method=resolved.method;confidence='high';}
  else if(reviewedOverride){
   officialRow=officialByCode.get(String(reviewedOverride.legal_id))||null;
   if(officialRow){method='reviewed_siruta_override';confidence='high';}
   else reason='reviewed_override_legal_id_absent_from_official_snapshot';
  }else reason='explicit_siruta_code_absent_from_official_snapshot';
 }else if(reviewedOverride){
  officialRow=officialByCode.get(String(reviewedOverride.legal_id))||null;
  if(officialRow){method='reviewed_siruta_override';confidence='high';}
  else reason='reviewed_override_legal_id_absent_from_official_snapshot';
 }else{
  const nameHits=officialByName.get(norm(e.name))||[];
  const parentHits=osmCounty?nameHits.filter(x=>x.normalized_county===osmCounty):[];
  candidates=(parentHits.length?parentHits:nameHits).map(x=>({siruta:x.siruta,name:x.name,county_name:x.county_name,legal_type:x.legal_type}));
  if(parentHits.length===1){officialRow=parentHits[0];method='exact_normalized_name_and_county';confidence='medium';}
  else if(parentHits.length>1)reason='name_ambiguous_within_county';
  else if(nameHits.length===0)reason='name_absent_from_official_snapshot';
  else if(!osmCounty&&nameHits.length===1)reason='unique_name_but_osm_county_unverified';
  else if(nameHits.length===1)reason='exact_name_but_county_mismatch';
  else reason='name_ambiguous';
 }
 const parentMatches=officialRow?Boolean(osmCounty&&officialRow.normalized_county===osmCounty):null;
 const osmClaimedType=osmClaimedLegalType(tags);
 const typeMatches=officialRow&&osmClaimedType?osmClaimedType===officialRow.legal_type:null;
 results.push({
  osm_id:e.id,
  osm_relation_id:e.osm?.relation_id??null,
  osm_name:e.name,
  osm_parent_id:e.parent_id||null,
  osm_parent_name:parent?.name||null,
  osm_entity_type:e.type,
  osm_claimed_legal_type:osmClaimedType,
  explicit_siruta_tag:explicit,
  reviewed_override:reviewedOverride?{legal_id:String(reviewedOverride.legal_id),resolution:reviewedOverride.resolution||null}:null,
  legal_id:officialRow?.siruta||null,
  legal_name:officialRow?.name||null,
  legal_type:officialRow?.legal_type||null,
  legal_type_code:officialRow?.type_code||null,
  legal_parent_id:officialRow?.parent_siruta||null,
  legal_parent_name:officialRow?.county_name||null,
  match_method:method,
  confidence,
  matched:Boolean(officialRow),
  parent_matches:parentMatches,
  type_matches:typeMatches,
  issue:reason,
  candidates:officialRow?[]:candidates.slice(0,20)
 });
}
const matched=results.filter(x=>x.matched),unmatched=results.filter(x=>!x.matched);
const mappings=new Map();
for(const x of matched){
 if(!mappings.has(x.legal_id))mappings.set(x.legal_id,[]);
 mappings.get(x.legal_id).push(x);
}
const duplicates=[...mappings.entries()].filter(([,v])=>v.length>1).map(([legal_id,items])=>({legal_id,osm_ids:items.map(x=>x.osm_id),osm_relation_ids:items.map(x=>x.osm_relation_id)}));
const matchedLegalIds=new Set(matched.map(x=>x.legal_id));
const rawRepresentedElsewhere=[];
const roOther=(catalog.entities||[]).filter(e=>e.jurisdiction==='RO'&&Number(e.osm?.admin_level)!==8);
for(const r of officialRows.filter(x=>!matchedLegalIds.has(x.siruta))){
 const alt=roOther.filter(e=>norm(e.name)===r.normalized_name);
 if(alt.length)rawRepresentedElsewhere.push({legal_id:r.siruta,legal_name:r.name,legal_type:r.legal_type,legal_parent_id:r.parent_siruta,legal_parent_name:r.county_name,osm:alt.map(e=>({id:e.id,relation_id:e.osm?.relation_id,admin_level:e.osm?.admin_level,name:e.name,type:e.type,parent_id:e.parent_id||null}))});
}
const reviewedOtherLevelResolutions=[],representedElsewhere=[];
for(const row of rawRepresentedElsewhere){
 const resolution=otherLevelResolutionByLegalId.get(String(row.legal_id))||null;
 if(!resolution){representedElsewhere.push(row);continue;}
 const matches=(row.osm||[]).filter(o=>Number(o.relation_id)===Number(resolution.osm_relation_id));
 const osm=matches.length===1?matches[0]:null;
 const stable=Boolean(
  osm
  && Number(osm.admin_level)===Number(resolution.osm_admin_level)
  && norm(osm.name)===norm(resolution.osm_relation_name)
  && osm.type===resolution.osm_entity_type
  && String(osm.parent_id||'')===String(resolution.expected_catalog_parent_id||'')
  && norm(row.legal_name)===norm(resolution.legal_name)
  && row.legal_type===resolution.legal_type
  && String(row.legal_parent_id||'')===String(resolution.legal_parent_id||'')
  && norm(row.legal_parent_name)===norm(resolution.legal_parent_name)
 );
 if(!stable){representedElsewhere.push(row);continue;}
 reviewedOtherLevelResolutions.push({
  ...row,
  classification:resolution.classification,
  osm_relation_id:Number(resolution.osm_relation_id),
  osm_relation_name:osm.name,
  osm_admin_level:Number(osm.admin_level),
  osm_entity_type:osm.type,
  expected_catalog_parent_id:String(resolution.expected_catalog_parent_id||''),
  evidence_registry:OTHER_LEVEL_RESOLUTIONS
 });
}
const elsewhereIds=new Set(rawRepresentedElsewhere.map(x=>x.legal_id));
const rawOfficialOnly=officialRows.filter(x=>!matchedLegalIds.has(x.siruta)&&!elsewhereIds.has(x.siruta)).map(x=>({legal_id:x.siruta,legal_name:x.name,legal_type:x.legal_type,legal_type_code:x.type_code,legal_parent_id:x.parent_siruta,legal_parent_name:x.county_name}));
const reviewedOfficialOnlyResolutions=[],officialOnly=[];
for(const row of rawOfficialOnly){
 const resolution=officialOnlyResolutionByLegalId.get(String(row.legal_id))||null;
 if(!resolution){officialOnly.push(row);continue;}
 const covering=entityById.get('osm-r'+Number(resolution.covering_osm_relation_id))||null;
 const coveringParent=covering?.parent_id?entityById.get(covering.parent_id)||null:null;
 const stable=Boolean(
  covering
  && Number(covering.osm?.admin_level)===8
  && norm(covering.name)===norm(resolution.covering_osm_relation_name)
  && Number(coveringParent?.osm?.relation_id)===Number(resolution.expected_parent_osm_relation_id)
  && norm(row.legal_name)===norm(resolution.legal_name)
  && row.legal_type===resolution.legal_type
  && norm(row.legal_parent_name)===norm(resolution.legal_parent_name)
 );
 if(!stable){officialOnly.push(row);continue;}
 reviewedOfficialOnlyResolutions.push({
  ...row,
  classification:resolution.classification,
  covering_osm_relation_id:Number(resolution.covering_osm_relation_id),
  covering_osm_relation_name:covering.name,
  covering_osm_relation_legal_id:String(resolution.covering_osm_relation_legal_id||''),
  expected_parent_osm_relation_id:Number(resolution.expected_parent_osm_relation_id),
  evidence_registry:OFFICIAL_ONLY_RESOLUTIONS
 });
}
const byIssue=unmatched.reduce((a,x)=>(a[x.issue]=(a[x.issue]||0)+1,a),{});
const byMethod=matched.reduce((a,x)=>(a[x.match_method]=(a[x.match_method]||0)+1,a),{});
const typeMismatches=matched.filter(x=>x.type_matches===false);
const parentMismatches=matched.filter(x=>x.parent_matches===false);
const checks=[],failures=[];
const check=(name,ok,detail)=>{checks.push({name,ok,detail});if(!ok)failures.push({name,detail});};
check('official_snapshot_is_siruta_2026',official.registry==='SIRUTA'&&Number(official.reference_year)===2026,{registry:official.registry,reference_year:official.reference_year});
check('official_snapshot_has_uat_level',officialRows.length>=3100,{official_uat_count:officialRows.length,source_type:official.source?.source_type||null});
check('official_siruta_codes_are_unique',officialByCode.size===officialRows.length,{official_uat_count:officialRows.length,unique_code_count:officialByCode.size});
check('all_osm_admin_level_8_entities_accounted',results.length===entities.length,{osm_admin_level_8_count:entities.length,result_count:results.length});
const missingOverrideRelations=overrideRows.filter(x=>!entities.some(e=>Number(e.osm?.relation_id)===Number(x.osm_relation_id))).map(x=>x.osm_relation_id);
const missingOverrideLegalIds=overrideRows.filter(x=>!officialByCode.has(String(x.legal_id))).map(x=>({osm_relation_id:x.osm_relation_id,legal_id:x.legal_id}));
check('reviewed_override_relations_exist',missingOverrideRelations.length===0,{missing:missingOverrideRelations});
check('reviewed_override_legal_ids_exist',missingOverrideLegalIds.length===0,{missing:missingOverrideLegalIds});
const missingOfficialOnlyResolutionLegalIds=officialOnlyResolutionRows.filter(x=>!officialByCode.has(String(x.legal_id))).map(x=>x.legal_id);
const missingOfficialOnlyCoveringRelations=officialOnlyResolutionRows.filter(x=>!entityById.has('osm-r'+Number(x.covering_osm_relation_id))).map(x=>x.covering_osm_relation_id);
const unresolvedReviewedOfficialOnly=officialOnlyResolutionRows.filter(x=>!reviewedOfficialOnlyResolutions.some(y=>String(y.legal_id)===String(x.legal_id))).map(x=>x.legal_id);
check('reviewed_official_only_legal_ids_exist',missingOfficialOnlyResolutionLegalIds.length===0,{missing:missingOfficialOnlyResolutionLegalIds});
check('reviewed_official_only_covering_relations_exist',missingOfficialOnlyCoveringRelations.length===0,{missing:missingOfficialOnlyCoveringRelations});
check('reviewed_official_only_structural_resolution_stable',unresolvedReviewedOfficialOnly.length===0,{unresolved:unresolvedReviewedOfficialOnly});
const missingOtherLevelLegalIds=otherLevelResolutionRows.filter(x=>!officialByCode.has(String(x.legal_id))).map(x=>x.legal_id);
const missingOtherLevelRelations=otherLevelResolutionRows.filter(x=>!entityById.has('osm-r'+Number(x.osm_relation_id))).map(x=>x.osm_relation_id);
const unresolvedReviewedOtherLevel=otherLevelResolutionRows.filter(x=>!reviewedOtherLevelResolutions.some(y=>String(y.legal_id)===String(x.legal_id))).map(x=>x.legal_id);
check('reviewed_other_level_legal_ids_exist',missingOtherLevelLegalIds.length===0,{missing:missingOtherLevelLegalIds});
check('reviewed_other_level_osm_relations_exist',missingOtherLevelRelations.length===0,{missing:missingOtherLevelRelations});
check('reviewed_other_level_structural_resolution_stable',unresolvedReviewedOtherLevel.length===0,{unresolved:unresolvedReviewedOtherLevel});
const report={
 schema_version:1,
 generated_at:new Date().toISOString(),
 jurisdiction:'RO',
 scope:'Reconciliation of all current OSM admin_level=8 administrative entities against the official INS SIRUTA 2026 snapshot.',
 policy:'Official SIRUTA supplies legal identity, hierarchy and UAT type. OSM supplies imported geometry and mapping provenance. Explicit SIRUTA codes are preferred; when an OSM code identifies a component locality, its official SIRUTA parent chain may resolve the NIV=2 UAT. Reviewed relation-to-SIRUTA overrides may resolve audited identity exceptions. Reviewed official UATs without a distinct OSM boundary may be classified separately only when their covering OSM representation remains structurally stable; reviewed UATs represented at a jurisdiction-specific exceptional OSM admin_level may likewise be resolved only when that representation remains structurally stable. No OSM geometry is promoted to legal geometry. Otherwise only exact normalized UAT name plus exact county is auto-matched. Fuzzy matching is never automatic.',
 status:failures.length?'FAIL':'PASS',
 source:{
  official_snapshot:SNAPSHOT,
  official_dataset:official.source,
  reviewed_overrides:OVERRIDES,
  reviewed_override_count:overrideRows.length,
  reviewed_official_only_resolutions:OFFICIAL_ONLY_RESOLUTIONS,
  reviewed_other_level_resolutions:OTHER_LEVEL_RESOLUTIONS,
  osm_catalog_generated_at:catalog.generated_at
 },
 checks,
 summary:{
  osm_admin_level_8_count:entities.length,
  official_uat_count:officialRows.length,
  matched_count:matched.length,
  unmatched_osm_count:unmatched.length,
  official_only_count:officialOnly.length,
  reviewed_official_only_resolution_count:reviewedOfficialOnlyResolutions.length,
  reviewed_other_level_resolution_count:reviewedOtherLevelResolutions.length,
  represented_at_other_osm_level_count:representedElsewhere.length,
  duplicate_legal_mapping_count:duplicates.length,
  parent_mismatch_count:parentMismatches.length,
  type_mismatch_count:typeMismatches.length,
  reviewed_override_count:overrideRows.length,
  match_methods:byMethod,
  unmatched_by_reason:byIssue
 },
 unmatched_osm:unmatched,
 official_only:officialOnly,
 reviewed_official_only_resolutions:reviewedOfficialOnlyResolutions,
 reviewed_other_level_resolutions:reviewedOtherLevelResolutions,
 represented_at_other_osm_level:representedElsewhere,
 duplicate_legal_mappings:duplicates,
 parent_mismatches:parentMismatches,
 type_mismatches:typeMismatches,
 matches:matched,
 failures
};
await mkdir('data/current',{recursive:true});
await writeFile(OUTPUT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,summary:report.summary,failures},null,2));
if(failures.length)process.exitCode=1;
