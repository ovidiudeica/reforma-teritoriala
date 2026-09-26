#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import osmtogeojson from 'osmtogeojson';
import { pointOnFeature, booleanPointInPolygon } from '@turf/turf';

const ENDPOINTS=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://overpass.nchc.org.tw/api/interpreter'];
const RETRIES_PER_ENDPOINT=3;
const CLASSIFIER_VERSION='2.3';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const countries={
 RO:{name:'România',iso:'RO',levels:[4,8,9]},
 MD:{name:'Republica Moldova',iso:'MD',levels:[4,6,8,9]}
};
const roSemanticEvidence=JSON.parse(await readFile('data/sources/ro-level9-exception-evidence.json','utf8'));
const roSemanticByRelation=new Map((roSemanticEvidence.items||[]).map(x=>[Number(x.osm_relation_id),x]));
const RO_SEMANTIC_CLASSES=new Set([
 'component_village_boundary_representation',
 'municipality_component_locality_boundary_representation'
]);

async function overpass(query){
 let last;
 for(const endpoint of ENDPOINTS){
  for(let attempt=1;attempt<=RETRIES_PER_ENDPOINT;attempt++){
   try{
    const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','user-agent':'reforma-teritoriala-import/0.4'},body:new URLSearchParams({data:query})});
    if(!r.ok) throw new Error(endpoint+' HTTP '+r.status);
    return await r.json();
   }catch(e){
    last=e;
    console.warn(`Overpass attempt ${attempt}/${RETRIES_PER_ENDPOINT} failed for ${endpoint}: ${e.message}`);
    if(attempt<RETRIES_PER_ENDPOINT) await sleep(5000*attempt);
   }
  }
 }
 throw last;
}
function queryFor({iso,levels}){
 const filters=levels.map(l=>`relation(area.country)["boundary"="administrative"]["admin_level"="${l}"];`).join('\n');
 // Include the country relation itself so candidate geometries can be validated
 // spatially against the actual country polygon after osmtogeojson conversion.
 return `[out:json][timeout:300];relation["ISO3166-1"="${iso}"]["boundary"="administrative"]->.countryRel;.countryRel map_to_area ->.country;(.countryRel;${filters});out body;>;out skel qt;`;
}
function norm(v){return (v||'').trim().toLowerCase();}
function classify(country,t={}){
 const l=Number(t.admin_level), p=norm(t.place), n=norm(t['name:ro']||t.name), official=norm(t.official_name);
 if(country==='RO'){
  if(l===4)return {type:n.includes('bucurești')||p==='city'?'capital_municipality':'county',confidence:'high'};
  if(l===9){
   return {type:'subdivision_or_mistagged_boundary',confidence:'low',reason:'RO admin_level=9 requires post-parent validation; only Sector 1–6 inside București is a sector'};
  }
  if(l===8){
   if(n==='cristești')return {type:'commune',confidence:'high',reason:'Official Romanian source identifies Cristești, Botoșani as a comună'};
   if(p==='city')return {type:'municipality',confidence:'high'};
   if(p==='town')return {type:'town',confidence:'high'};
   if(p==='municipality'){
    if(n.startsWith('municipiul ')||official.startsWith('municipiul '))return {type:'municipality',confidence:'high'};
    if(n.startsWith('orașul ')||official.startsWith('orașul '))return {type:'town',confidence:'high'};
    if(n.startsWith('comuna ')||official.startsWith('comuna '))return {type:'commune',confidence:'high'};
    return {type:'commune',confidence:'medium',reason:'RO admin_level=8 + place=municipality without explicit legal prefix; inferred from dominant OSM convention'};
   }
   return {type:'local_uat',confidence:'low',reason:'RO admin_level=8 lacks a usable place/legal-name discriminator'};
  }
 }
 if(country==='MD'){
  if(l===4){
   if(p==='district')return {type:'district',confidence:'high'};
   if(p==='region')return {type:'special_territorial_unit',confidence:'medium',reason:'MD admin_level=4 + place=region requires legal cross-check'};
   if(p==='municipality')return {type:'level_2_municipality',confidence:'medium',reason:'MD admin_level=4 + place=municipality requires legal cross-check'};
   return {type:'level_2_or_special_unit',confidence:'low',reason:'MD admin_level=4 without recognised place discriminator'};
  }
  if(l===6)return {type:'intermediate_administrative_unit',confidence:'low',reason:'No admin_level=6 features were observed in the 2026-09-25 audit'};
  if(l===8){
   if(p==='town')return {type:'town_uat',confidence:'high'};
   if(p==='city')return {type:'municipality_or_city_uat',confidence:'medium',reason:'OSM place does not encode Moldovan legal municipality status reliably'};
   if(p==='municipality')return {type:'level_1_uat',confidence:'medium',reason:'Administrative UAT boundary; legal subtype requires official-list cross-check'};
   if(p==='village')return {type:'commune_or_independent_village_uat',confidence:'medium',reason:'OSM place=village does not distinguish commune from independent village'};
   return {type:'level_1_uat',confidence:'low',reason:'MD admin_level=8 lacks a usable place/legal discriminator'};
  }
  if(l===9){
   if(['village','town','city'].includes(p))return {type:'component_locality',confidence:'medium',reason:'Nested locality boundary; exact legal subtype requires official-list cross-check'};
   if(p==='allotments')return {type:'non_administrative_or_auxiliary_area',confidence:'low',reason:'place=allotments is not sufficient evidence of an administrative unit'};
   return {type:'subdivision_or_component_area',confidence:'low',reason:'MD admin_level=9 is heterogeneous in current OSM data'};
  }
 }
 return {type:'unclassified',confidence:'low',reason:'No classifier rule matched'};
}
function relationId(feature){
 const id=String(feature.id||''); const m=id.match(/relation\/(\d+)/); return m?Number(m[1]):null;
}
function entity(country,feature){
 const t=feature.properties?.tags||feature.properties||{}, rid=relationId(feature), c=classify(country,t);
 return {id:`osm-r${rid}`,name:t['name:ro']||t.name||null,official_name:t.official_name||null,jurisdiction:country,category:'administrative',type:c.type,status:'current',parent_id:null,
  osm:{element_type:'relation',relation_id:rid,admin_level:t.admin_level?Number(t.admin_level):null,boundary:t.boundary||null,relation_type:t.type||null,place:t.place||null,designation:t.designation||null,name_prefix:t['name:prefix']||null,full_name:t.full_name||null,cuatm_code:t['ref:cuatm']||t['ref:cuatm:cod']||null,cuatm_unique_id:t['ref:cuatm:codunic']||null,wikidata:t.wikidata||null,wikipedia:t.wikipedia||null},
  classification:{version:CLASSIFIER_VERSION,confidence:c.confidence,reason:c.reason||null},
  source:'OpenStreetMap',source_url:`https://www.openstreetmap.org/relation/${rid}`,imported_at:new Date().toISOString(),review_required:c.confidence==='low'};
}
function assignParents(entities,featuresById,warnings=[]){
 for(const child of entities){
  const cf=featuresById.get(child.id); if(!cf)continue;
  let pt;
  try{
   pt=pointOnFeature(cf);
  }catch(e){
   warnings.push({type:'invalid_child_geometry',entity_id:child.id,relation_id:child.osm.relation_id,message:e.message});
   child.parent_id=child.jurisdiction;
   continue;
  }
  const cl=child.osm.admin_level??99;
  const candidates=entities.filter(p=>p.jurisdiction===child.jurisdiction&&(p.osm.admin_level??99)<cl);
  const containing=candidates.filter(p=>{
   const pf=featuresById.get(p.id);
   if(!pf)return false;
   try{return booleanPointInPolygon(pt,pf);}
   catch(e){
    warnings.push({type:'invalid_parent_geometry',entity_id:p.id,relation_id:p.osm.relation_id,child_id:child.id,message:e.message});
    return false;
   }
  });
  containing.sort((a,b)=>(b.osm.admin_level??0)-(a.osm.admin_level??0));
  child.parent_id=containing[0]?.id||child.jurisdiction;
 }
}
function finalizeAfterParents(entities){
 const byId=new Map(entities.map(e=>[e.id,e]));
 for(const e of entities){
  if(e.jurisdiction!=='RO'||e.osm.admin_level!==9)continue;
  const n=norm(e.name), parent=byId.get(e.parent_id);
  const parentName=norm(parent?.name);
  if(/^sector(?:ul)? [1-6]$/.test(n)&&parent?.osm?.admin_level===4&&parentName.includes('bucurești')){
   e.type='sector';
   e.classification={version:CLASSIFIER_VERSION,confidence:'high',reason:'Sector 1–6 validated only when its geometric parent is București'};
   e.review_required=false;
   continue;
  }
  const ev=roSemanticByRelation.get(e.osm.relation_id);
  const expectedParent=ev?.osm_parent_relation_id?`osm-r${ev.osm_parent_relation_id}`:null;
  const evidenceMatches=ev
   && ev.legal_hierarchy_verified===true
   && ev.legal_geometry_verified===false
   && RO_SEMANTIC_CLASSES.has(ev.semantic_classification)
   && e.parent_id===expectedParent;
  if(evidenceMatches){
   e.type=ev.semantic_classification;
   e.classification={
    version:CLASSIFIER_VERSION,
    confidence:'high',
    reason:'Semantic classification resolved by audited RO level-9 evidence; OSM geometry remains a representation and is not promoted to official legal geometry.',
    evidence:'data/sources/ro-level9-exception-evidence.json'
   };
   e.review_required=false;
  }
 }
}
async function main(){
 await mkdir('data/current',{recursive:true}); await mkdir('public/geo/current',{recursive:true});
 const all=[], report={generated_at:new Date().toISOString(),classifier_version:CLASSIFIER_VERSION,countries:{},warnings:[]};
 for(const [code,cfg] of Object.entries(countries)){
  const raw=await overpass(queryFor(cfg)), geo=osmtogeojson(raw,{flatProperties:false});
  const allPolygons=geo.features.filter(f=>relationId(f)&&['Polygon','MultiPolygon'].includes(f.geometry?.type));
  const countryFeature=allPolygons.find(f=>(f.properties?.tags||f.properties||{})['ISO3166-1']===cfg.iso);
  if(!countryFeature) throw new Error(`Missing country boundary geometry for ${code}`);
  const polygons=allPolygons.filter(f=>{
   if(f===countryFeature)return false;
   try{return booleanPointInPolygon(pointOnFeature(f),countryFeature);}
   catch(e){report.warnings.push({type:'country_membership_geometry_error',jurisdiction:code,relation_id:relationId(f),message:e.message});return false;}
  });
  const excluded=allPolygons.filter(f=>f!==countryFeature&&!polygons.includes(f)).map(f=>relationId(f));
  if(excluded.length) report.warnings.push({type:'outside_country_boundary_excluded',jurisdiction:code,relation_ids:excluded});
  const entities=polygons.map(f=>entity(code,f));
  const byId=new Map(polygons.map(f=>[`osm-r${relationId(f)}`,f]));
  assignParents(entities,byId,report.warnings); finalizeAfterParents(entities); all.push(...entities);
  const entityById=new Map(entities.map(e=>[e.id,e]));
  const fc={type:'FeatureCollection',features:polygons.map(f=>{const id=`osm-r${relationId(f)}`;const e=entityById.get(id);return {...f,properties:{...f.properties,catalog_id:id,parent_id:e?.parent_id||null,jurisdiction:code,entity_type:e?.type||'unclassified',classification_confidence:e?.classification?.confidence||'low'}};})};
  await writeFile(`public/geo/current/${code.toLowerCase()}-administrative.geojson`,JSON.stringify(fc));
  const confidence=Object.groupBy?Object.groupBy(entities,e=>e.classification.confidence):null;
  report.countries[code]={name:cfg.name,count:entities.length,review_required:entities.filter(x=>x.review_required).length,geojson_features:fc.features.length,
   confidence:confidence?Object.fromEntries(Object.entries(confidence).map(([k,v])=>[k,v.length])):{}};
 }
 all.sort((a,b)=>a.jurisdiction.localeCompare(b.jurisdiction)||(a.osm.admin_level??99)-(b.osm.admin_level??99)||(a.name||'').localeCompare(b.name||'','ro'));
 await writeFile('data/current/entities.json',JSON.stringify({schema_version:2,generated_at:new Date().toISOString(),classifier_version:CLASSIFIER_VERSION,source:'OpenStreetMap via Overpass API',license:'ODbL',entity_count:all.length,entities:all},null,2)+'\n');
 await writeFile('data/current/import-report.json',JSON.stringify(report,null,2)+'\n');
 console.log('Catalog:',all.length,'entities; classifier v'+CLASSIFIER_VERSION);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
