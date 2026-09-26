#!/usr/bin/env node
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {area,intersect,difference,booleanIntersects,featureCollection,bbox,centroid} from '@turf/turf';
const geo=JSON.parse(await readFile('public/geo/current/md-administrative.geojson','utf8'));
const rid=f=>Number(f.properties?.osm_relation_id??f.properties?.relation_id??String(f.properties?.catalog_id||f.properties?.id||'').replace(/^osm-r/,''));
const ids=[58983,12207955,18967626,10628644,18967193,10628645,18968062];
const by=new Map(geo.features.filter(f=>ids.includes(rid(f))).map(f=>[rid(f),f]));
for(const id of [58983,12207955,18967626])if(!by.has(id))throw new Error('Missing required relation '+id);
const km2=f=>f?area(f)/1e6:0;
const safe=fn=>{try{return fn()}catch{return null}};
const c8=by.get(12207955),c9=by.get(18967626),uat=by.get(58983);
const d8=safe(()=>difference(featureCollection([c8,c9]))),d9=safe(()=>difference(featureCollection([c9,c8])));
const components=[
 {legal_id:'0301',name:'Elizaveta',relations:[10628644,18967193]},
 {legal_id:'4839',name:'Sadovoe',relations:[10628645,18968062]}
];
const overlap=(a,b)=>{if(!a||!b)return null;const i=safe(()=>intersect(featureCollection([a,b])));return {intersects:safe(()=>booleanIntersects(a,b)),intersection_km2:km2(i),fraction_of_a:km2(a)?km2(i)/km2(a):null,fraction_of_b:km2(b)?km2(i)/km2(b):null}};
const componentResults=components.map(g=>({...g,representations:g.relations.filter(id=>by.has(id)).map(id=>{const f=by.get(id);return {relation_id:id,area_km2:km2(f),with_city_12207955:overlap(f,c8),with_city_18967626:overlap(f,c9),with_difference_12207955_minus_18967626:overlap(f,d8),with_difference_18967626_minus_12207955:overlap(f,d9),with_uat_58983:overlap(f,uat)};})}));
const describe=d=>d?{area_km2:km2(d),bbox:bbox(d),centroid:centroid(d).geometry.coordinates}:null;
const out={schema_version:1,generated_at:new Date().toISOString(),legal_id:'0300',legal_name:'Bălți',policy:'Diagnostic only. Localizes the symmetric difference and tests overlap with reconciled Elizaveta and Sadovoe representations; no canonical geometry is selected.',difference_regions:{city_12207955_minus_18967626:describe(d8),city_18967626_minus_12207955:describe(d9)},components:componentResults};
await mkdir('data/current',{recursive:true});await writeFile('data/current/md-balti-component-locality-geometry.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out,null,2));
