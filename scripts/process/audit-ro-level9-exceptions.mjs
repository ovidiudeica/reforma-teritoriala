#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { area, bbox, pointOnFeature, booleanPointInPolygon } from '@turf/turf';

const evidence=JSON.parse(await readFile('data/sources/ro-level9-exception-evidence.json','utf8'));
const geo=JSON.parse(await readFile('public/geo/current/ro-administrative.geojson','utf8'));
const RO_WIKI='https://wiki.openstreetmap.org/wiki/Ro:WikiProject_Romania/Unit%C4%83%C8%9Bi_administrativ_teritoriale';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function relationId(feature){
 const raw=String(feature?.id||feature?.properties?.id||'');
 const m=raw.match(/(?:relation\/)?(\d+)/);
 return m?Number(m[1]):null;
}
const byId=new Map(geo.features.map(f=>[relationId(f),f]).filter(([id])=>id));

async function fetchText(url){
 let last;
 for(let attempt=1;attempt<=3;attempt++){
  try{
   const r=await fetch(url,{headers:{'user-agent':'reforma-teritoriala-ro-exception-audit/0.1'}});
   if(!r.ok) throw new Error('HTTP '+r.status);
   return await r.text();
  }catch(e){
   last=e;
   if(attempt<3) await sleep(2000*attempt);
  }
 }
 throw last;
}
function attrs(s){
 return Object.fromEntries([...s.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m=>[
  m[1],m[2].replaceAll('&quot;','"').replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>')
 ]));
}
function parseVersions(xml,id){
 const out=[];
 for(const m of xml.matchAll(/<relation\b([^>]*)>([\s\S]*?)<\/relation>/g)){
  const a=attrs(m[1]), body=m[2], tags={}, members=[];
  for(const t of body.matchAll(/<tag\b([^>]*)\/>/g)){
   const x=attrs(t[1]); tags[x.k]=x.v;
  }
  for(const mm of body.matchAll(/<member\b([^>]*)\/>/g)){
   const x=attrs(mm[1]); members.push({type:x.type,ref:Number(x.ref),role:x.role||''});
  }
  out.push({
   version:Number(a.version),timestamp:a.timestamp,changeset:Number(a.changeset),
   visible:a.visible!=='false',user:a.user||null,tags,members
  });
 }
 if(!out.length) throw new Error('No relation versions parsed for '+id);
 return out.sort((a,b)=>a.version-b.version);
}
function summarizeHistory(id,versions){
 const first=versions[0], last=versions.at(-1);
 const unique=(key)=>[...new Set(versions.map(v=>v.tags[key]).filter(v=>v!==undefined))];
 let memberChangeVersions=0;
 for(let i=1;i<versions.length;i++){
  const a=new Set(versions[i-1].members.map(m=>m.type+':'+m.ref+':'+m.role));
  const b=new Set(versions[i].members.map(m=>m.type+':'+m.ref+':'+m.role));
  if(a.size!==b.size||[...a].some(x=>!b.has(x))) memberChangeVersions++;
 }
 return {
  relation_id:id,
  created_at:first.timestamp,
  created_changeset:first.changeset,
  current_version:last.version,
  last_modified_at:last.timestamp,
  last_changeset:last.changeset,
  current_tags:last.tags,
  current_member_count:last.members.length,
  history_signals:{
   admin_level_values:unique('admin_level'),
   boundary_values:unique('boundary'),
   name_values:unique('name'),
   source_values:unique('source'),
   versions_with_member_changes:memberChangeVersions
  }
 };
}
function tagsOf(f){return f?.properties?.tags||f?.properties||{};}
function geometrySummary(feature,parent){
 const result={
  geometry_type:feature?.geometry?.type||null,
  area_km2:feature?area(feature)/1e6:null,
  bbox:feature?bbox(feature):null,
  point_inside_expected_parent:null
 };
 if(feature&&parent){
  try{result.point_inside_expected_parent=booleanPointInPolygon(pointOnFeature(feature),parent);}
  catch{result.point_inside_expected_parent=false;}
 }
 return result;
}

const targetIds=evidence.items.map(x=>x.osm_relation_id);
const parentIds=[...new Set(evidence.items.map(x=>x.osm_parent_relation_id))];
const historyIds=[...new Set([...targetIds,...parentIds])];
const histories=[],errors=[];
for(const id of historyIds){
 try{
  const xml=await fetchText('https://api.openstreetmap.org/api/0.6/relation/'+id+'/history');
  histories.push(summarizeHistory(id,parseVersions(xml,id)));
 }catch(e){
  errors.push({relation_id:id,error:e.message});
 }
}
const historyById=new Map(histories.map(x=>[x.relation_id,x]));

const items=evidence.items.map(ev=>{
 const feature=byId.get(ev.osm_relation_id);
 const parent=byId.get(ev.osm_parent_relation_id);
 const tags=tagsOf(feature), parentTags=tagsOf(parent);
 const name=tags['name:ro']||tags.name||ev.name;
 const isSector=/^sector(?:ul)?\s+[1-6]$/i.test(name);
 const parentIsBucharest=String(parentTags['name:ro']||parentTags.name||'').toLowerCase().includes('bucurești');
 const level9MatchesProjectRule=isSector&&parentIsBucharest;
 const osmHistory=historyById.get(ev.osm_relation_id)||null;
 return {
  osm_relation_id:ev.osm_relation_id,
  name,
  current_osm:{
   admin_level:tags.admin_level?Number(tags.admin_level):null,
   boundary:tags.boundary||null,
   type:tags.type||null,
   name_prefix:tags['name:prefix']||null,
   official_name:tags.official_name||null,
   place:tags.place||null,
   place_ro:tags['place:ro']||null,
   fixme:tags.fixme||null,
   source:tags.source||null,
   expected_parent_relation_id:ev.osm_parent_relation_id,
   actual_catalog_parent_relation_id:Number(String(feature?.properties?.parent_id||'').replace(/\D/g,''))||null
  },
  legal_evidence:{
   status:ev.legal_status,
   parent_name:ev.legal_parent_name,
   parent_type:ev.legal_parent_type,
   hierarchy_verified:ev.legal_hierarchy_verified,
   geometry_verified:ev.legal_geometry_verified,
   source:evidence.primary_legal_source
  },
  geometry:geometrySummary(feature,parent),
  history:osmHistory,
  interpretation:{
   romanian_osm_level9_sector_rule_matches:level9MatchesProjectRule,
   legal_unit_is_standalone_uat:false,
   osm_geometry_is_legal_authority:false,
   semantic_classification:ev.semantic_classification,
   review_status:'resolved_semantic_classification',
   rationale: level9MatchesProjectRule
    ? 'Matches the documented Romanian OSM sector convention.'
    : 'Verified legal component locality/village inside its level-8 parent; admin_level=9 is not the documented Romanian sector convention and the OSM polygon is retained only as an OSM representation, not official legal geometry.'
  }
 };
});

const checks=[
 {
  name:'all_five_relations_present_in_ro_snapshot',
  ok:items.every(x=>byId.has(x.osm_relation_id)),
  detail:{missing:targetIds.filter(id=>!byId.has(id))}
 },
 {
  name:'all_expected_parents_present',
  ok:parentIds.every(id=>byId.has(id)),
  detail:{missing:parentIds.filter(id=>!byId.has(id))}
 },
 {
  name:'all_geometrically_within_expected_parent',
  ok:items.every(x=>x.geometry.point_inside_expected_parent===true),
  detail:{failed:items.filter(x=>x.geometry.point_inside_expected_parent!==true).map(x=>x.osm_relation_id)}
 },
 {
  name:'all_legal_hierarchies_verified',
  ok:items.every(x=>x.legal_evidence.hierarchy_verified===true),
  detail:{failed:items.filter(x=>!x.legal_evidence.hierarchy_verified).map(x=>x.osm_relation_id)}
 },
 {
  name:'no_legal_geometry_claims',
  ok:items.every(x=>x.legal_evidence.geometry_verified===false&&x.interpretation.osm_geometry_is_legal_authority===false),
  detail:{}
 },
 {
  name:'all_osm_histories_available',
  ok:errors.length===0,
  detail:{errors}
 }
];
const failures=checks.filter(x=>!x.ok);
const audit={
 schema_version:1,
 generated_at:new Date().toISOString(),
 jurisdiction:'RO',
 scope:'Five remaining admin_level=9 release-gate review exceptions',
 policy:'Resolve semantic identity/status without promoting OSM geometry to official legal geometry. Romania OSM project documentation lists admin_level=9 as Sector; non-sector level-9 polygons are treated as OSM component-locality representations pending any separate geometry authority evidence.',
 osm_convention_source:RO_WIKI,
 legal_source:evidence.primary_legal_source,
 status:failures.length?'FAIL':'PASS',
 checks,
 items,
 summary:{
  item_count:items.length,
  resolved_semantic_classification_count:items.filter(x=>x.interpretation.review_status==='resolved_semantic_classification').length,
  component_village_boundary_representation:items.filter(x=>x.interpretation.semantic_classification==='component_village_boundary_representation').length,
  municipality_component_locality_boundary_representation:items.filter(x=>x.interpretation.semantic_classification==='municipality_component_locality_boundary_representation').length,
  legal_geometry_verified_count:items.filter(x=>x.legal_evidence.geometry_verified).length
 },
 failures
};
const historyOut={
 schema_version:1,
 generated_at:audit.generated_at,
 source:'OpenStreetMap API 0.6 relation history',
 source_pattern:'https://api.openstreetmap.org/api/0.6/relation/{id}/history',
 relation_count:historyIds.length,
 history_count:histories.length,
 error_count:errors.length,
 errors,
 relations:histories
};
await mkdir('data/current',{recursive:true});
await mkdir('data/sources',{recursive:true});
await writeFile('data/current/ro-level9-exception-audit.json',JSON.stringify(audit,null,2)+'\n');
await writeFile('data/sources/ro-osm-level9-exception-history.json',JSON.stringify(historyOut,null,2)+'\n');
console.log(JSON.stringify({status:audit.status,summary:audit.summary,errors},null,2));
if(failures.length) process.exitCode=1;
