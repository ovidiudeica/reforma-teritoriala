#!/usr/bin/env node
import {mkdir,readFile,writeFile} from 'node:fs/promises';

const SNAPSHOT='data/sources/ro-siruta-current.json';
const OUTPUT='data/current/ro-official-reconciliation.json';
const catalog=JSON.parse(await readFile('data/current/entities.json','utf8'));
const geo=JSON.parse(await readFile('public/geo/current/ro-administrative.geojson','utf8'));
const official=JSON.parse(await readFile(SNAPSHOT,'utf8'));

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
 let officialRow=null,method=null,confidence=null,reason=null,candidates=[];
 if(explicit){
  const resolved=officialUatForAnySirutaCode(explicit.value);
  officialRow=resolved?.row||null;
  if(officialRow){method=resolved.method;confidence='high';}
  else reason='explicit_siruta_code_absent_from_official_snapshot';
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
 const typeMatches=officialRow?e.type===officialRow.legal_type:null;
 results.push({
  osm_id:e.id,
  osm_relation_id:e.osm?.relation_id??null,
  osm_name:e.name,
  osm_parent_id:e.parent_id||null,
  osm_parent_name:parent?.name||null,
  osm_entity_type:e.type,
  explicit_siruta_tag:explicit,
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
const representedElsewhere=[];
const roOther=(catalog.entities||[]).filter(e=>e.jurisdiction==='RO'&&Number(e.osm?.admin_level)!==8);
for(const r of officialRows.filter(x=>!matchedLegalIds.has(x.siruta))){
 const alt=roOther.filter(e=>norm(e.name)===r.normalized_name);
 if(alt.length)representedElsewhere.push({legal_id:r.siruta,legal_name:r.name,legal_type:r.legal_type,osm:alt.map(e=>({id:e.id,relation_id:e.osm?.relation_id,admin_level:e.osm?.admin_level,name:e.name,type:e.type}))});
}
const elsewhereIds=new Set(representedElsewhere.map(x=>x.legal_id));
const officialOnly=officialRows.filter(x=>!matchedLegalIds.has(x.siruta)&&!elsewhereIds.has(x.siruta)).map(x=>({legal_id:x.siruta,legal_name:x.name,legal_type:x.legal_type,legal_type_code:x.type_code,legal_parent_id:x.parent_siruta,legal_parent_name:x.county_name}));
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
const report={
 schema_version:1,
 generated_at:new Date().toISOString(),
 jurisdiction:'RO',
 scope:'Reconciliation of all current OSM admin_level=8 administrative entities against the official INS SIRUTA 2026 snapshot.',
 policy:'Official SIRUTA supplies legal identity, hierarchy and UAT type. OSM supplies imported geometry and mapping provenance. Explicit SIRUTA codes are preferred; when an OSM code identifies a component locality, its official SIRUTA parent chain may resolve the NIV=2 UAT. Otherwise only exact normalized UAT name plus exact county is auto-matched. Fuzzy matching is never automatic.',
 status:failures.length?'FAIL':'PASS',
 source:{
  official_snapshot:SNAPSHOT,
  official_dataset:official.source,
  osm_catalog_generated_at:catalog.generated_at
 },
 checks,
 summary:{
  osm_admin_level_8_count:entities.length,
  official_uat_count:officialRows.length,
  matched_count:matched.length,
  unmatched_osm_count:unmatched.length,
  official_only_count:officialOnly.length,
  represented_at_other_osm_level_count:representedElsewhere.length,
  duplicate_legal_mapping_count:duplicates.length,
  parent_mismatch_count:parentMismatches.length,
  type_mismatch_count:typeMismatches.length,
  match_methods:byMethod,
  unmatched_by_reason:byIssue
 },
 unmatched_osm:unmatched,
 official_only:officialOnly,
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
