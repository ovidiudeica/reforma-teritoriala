#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import osmtogeojson from 'osmtogeojson';
import { pointOnFeature, booleanPointInPolygon } from '@turf/turf';

const ENDPOINTS=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];
const countries={
 RO:{name:'România',iso:'RO',levels:[4,8,9]},
 MD:{name:'Republica Moldova',iso:'MD',levels:[4,6,8,9]}
};

async function overpass(query){
 let last;
 for(const endpoint of ENDPOINTS){
  try{
   const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','user-agent':'reforma-teritoriala-import/0.3'},body:new URLSearchParams({data:query})});
   if(!r.ok) throw new Error(endpoint+' HTTP '+r.status);
   return await r.json();
  }catch(e){last=e;}
 }
 throw last;
}
function queryFor({iso,levels}){
 const filters=levels.map(l=>`relation(area.country)["boundary"="administrative"]["admin_level"="${l}"];`).join('\n');
 return `[out:json][timeout:300];area["ISO3166-1"="${iso}"]["boundary"="administrative"]->.country;(${filters});out body;>;out skel qt;`;
}
function norm(v){return (v||'').trim().toLowerCase();}
function classify(country,t={}){
 const l=Number(t.admin_level), p=norm(t.place), n=norm(t['name:ro']||t.name), official=norm(t.official_name);
 if(country==='RO'){
  if(l===4)return {type:n.includes('bucurești')||p==='city'?'capital_municipality':'county',confidence:'high'};
  if(l===9){
   if(/^sectorul [1-6]$/.test(n))return {type:'sector',confidence:'high'};
   return {type:'subdivision_or_mistagged_boundary',confidence:'low',reason:'RO admin_level=9 is only a Bucharest sector when the name identifies Sectorul 1–6'};
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
  osm:{element_type:'relation',relation_id:rid,admin_level:t.admin_level?Number(t.admin_level):null,boundary:t.boundary||null,relation_type:t.type||null,place:t.place||null,designation:t.designation||null,wikidata:t.wikidata||null,wikipedia:t.wikipedia||null},
  classification:{version:'2.1',confidence:c.confidence,reason:c.reason||null},
  source:'OpenStreetMap',source_url:`https://www.openstreetmap.org/relation/${rid}`,imported_at:new Date().toISOString(),review_required:c.confidence==='low'};
}
function assignParents(entities,featuresById){
 for(const child of entities){
  const cf=featuresById.get(child.id); if(!cf)continue;
  const pt=pointOnFeature(cf), cl=child.osm.admin_level??99;
  const candidates=entities.filter(p=>p.jurisdiction===child.jurisdiction&&(p.osm.admin_level??99)<cl);
  const containing=candidates.filter(p=>{const pf=featuresById.get(p.id);try{return pf&&booleanPointInPolygon(pt,pf);}catch{return false;}});
  containing.sort((a,b)=>(b.osm.admin_level??0)-(a.osm.admin_level??0));
  child.parent_id=containing[0]?.id||child.jurisdiction;
 }
}
async function main(){
 await mkdir('data/current',{recursive:true}); await mkdir('public/geo/current',{recursive:true});
 const all=[], report={generated_at:new Date().toISOString(),classifier_version:'2.1',countries:{},warnings:[]};
 for(const [code,cfg] of Object.entries(countries)){
  const raw=await overpass(queryFor(cfg)), geo=osmtogeojson(raw,{flatProperties:false});
  const polygons=geo.features.filter(f=>relationId(f)&&['Polygon','MultiPolygon'].includes(f.geometry?.type));
  const entities=polygons.map(f=>entity(code,f));
  const byId=new Map(polygons.map(f=>[`osm-r${relationId(f)}`,f]));
  assignParents(entities,byId); all.push(...entities);
  const entityById=new Map(entities.map(e=>[e.id,e]));
  const fc={type:'FeatureCollection',features:polygons.map(f=>{const id=`osm-r${relationId(f)}`;const e=entityById.get(id);return {...f,properties:{...f.properties,catalog_id:id,parent_id:e?.parent_id||null,jurisdiction:code,entity_type:e?.type||'unclassified',classification_confidence:e?.classification?.confidence||'low'}};})};
  await writeFile(`public/geo/current/${code.toLowerCase()}-administrative.geojson`,JSON.stringify(fc));
  const confidence=Object.groupBy?Object.groupBy(entities,e=>e.classification.confidence):null;
  report.countries[code]={name:cfg.name,count:entities.length,review_required:entities.filter(x=>x.review_required).length,geojson_features:fc.features.length,
   confidence:confidence?Object.fromEntries(Object.entries(confidence).map(([k,v])=>[k,v.length])):{}};
 }
 all.sort((a,b)=>a.jurisdiction.localeCompare(b.jurisdiction)||(a.osm.admin_level??99)-(b.osm.admin_level??99)||(a.name||'').localeCompare(b.name||'','ro'));
 await writeFile('data/current/entities.json',JSON.stringify({schema_version:2,generated_at:new Date().toISOString(),classifier_version:'2.1',source:'OpenStreetMap via Overpass API',license:'ODbL',entity_count:all.length,entities:all},null,2)+'\n');
 await writeFile('data/current/import-report.json',JSON.stringify(report,null,2)+'\n');
 console.log('Catalog:',all.length,'entities; classifier v2.1');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
