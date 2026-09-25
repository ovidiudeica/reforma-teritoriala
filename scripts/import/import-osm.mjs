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
   const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','user-agent':'reforma-teritoriala-import/0.2'},body:new URLSearchParams({data:query})});
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
function classify(country,t={}){
 const l=Number(t.admin_level), p=t.place||'', d=(t.designation||'').toLowerCase();
 if(country==='RO'){
  if(l===4)return'county'; if(l===9)return'sector';
  if(l===8&&p==='city')return'municipality_or_city';
  if(l===8&&p==='town')return'town';
  if(l===8&&(p==='village'||d.includes('comun')))return'commune_or_local_uat';
  if(l===8)return'local_uat';
 }
 if(country==='MD'){
  if(l===4)return'level_2_or_special_unit';
  if(l===6)return'intermediate_or_municipal_unit';
  if(l===9)return'sector_or_subdivision';
  if(l===8&&p==='town')return'town';
  if(l===8)return'commune_village_or_local_uat';
 }
 return'unclassified';
}
function relationId(feature){
 const id=String(feature.id||'');
 const m=id.match(/relation\/(\d+)/); return m?Number(m[1]):null;
}
function entity(country,feature){
 const t=feature.properties?.tags||feature.properties||{}, rid=relationId(feature), type=classify(country,t);
 return {id:`osm-r${rid}`,name:t['name:ro']||t.name||null,official_name:t.official_name||null,jurisdiction:country,category:'administrative',type,status:'current',parent_id:null,
  osm:{element_type:'relation',relation_id:rid,admin_level:t.admin_level?Number(t.admin_level):null,boundary:t.boundary||null,wikidata:t.wikidata||null,wikipedia:t.wikipedia||null},
  source:'OpenStreetMap',source_url:`https://www.openstreetmap.org/relation/${rid}`,imported_at:new Date().toISOString(),review_required:type.includes('or_')||type==='unclassified'};
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
 const all=[], report={generated_at:new Date().toISOString(),countries:{},warnings:[]};
 for(const [code,cfg] of Object.entries(countries)){
  const raw=await overpass(queryFor(cfg)), geo=osmtogeojson(raw,{flatProperties:false});
  const polygons=geo.features.filter(f=>relationId(f)&&['Polygon','MultiPolygon'].includes(f.geometry?.type));
  const entities=polygons.map(f=>entity(code,f));
  const byId=new Map(polygons.map(f=>[`osm-r${relationId(f)}`,f]));
  assignParents(entities,byId); all.push(...entities);
  const fc={type:'FeatureCollection',features:polygons.map(f=>{const id=`osm-r${relationId(f)}`;const e=entities.find(x=>x.id===id);return {...f,properties:{...f.properties,catalog_id:id,parent_id:e?.parent_id||null,jurisdiction:code,entity_type:e?.type||'unclassified'}};})};
  await writeFile(`public/geo/current/${code.toLowerCase()}-administrative.geojson`,JSON.stringify(fc));
  report.countries[code]={name:cfg.name,count:entities.length,review_required:entities.filter(x=>x.review_required).length,geojson_features:fc.features.length};
 }
 all.sort((a,b)=>a.jurisdiction.localeCompare(b.jurisdiction)||(a.osm.admin_level??99)-(b.osm.admin_level??99)||(a.name||'').localeCompare(b.name||'','ro'));
 await writeFile('data/current/entities.json',JSON.stringify({schema_version:1,generated_at:new Date().toISOString(),source:'OpenStreetMap via Overpass API',license:'ODbL',entity_count:all.length,entities:all},null,2)+'\n');
 await writeFile('data/current/import-report.json',JSON.stringify(report,null,2)+'\n');
 console.log('Catalog:',all.length,'entities');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
