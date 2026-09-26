#!/usr/bin/env node
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {area,intersect,difference,booleanContains,booleanWithin,featureCollection} from '@turf/turf';
const geo=JSON.parse(await readFile('public/geo/current/md.geojson','utf8'));
const wanted=new Map([[58983,'uat'],[12207955,'city_level8'],[18967626,'city_level9']]);
const relId=f=>Number(f.properties?.osm_relation_id??f.properties?.relation_id??String(f.properties?.id||'').replace(/^osm-r/,''));
const by=new Map(geo.features.filter(f=>wanted.has(relId(f))).map(f=>[relId(f),f]));
for(const id of wanted.keys())if(!by.has(id))throw new Error('Missing Bălți relation geometry '+id);
const km2=f=>area(f)/1e6;
const safe=(fn)=>{try{return fn()}catch(e){return null}};
const pair=(aId,bId)=>{
 const a=by.get(aId),b=by.get(bId);
 const i=safe(()=>intersect(featureCollection([a,b])));
 const ab=safe(()=>difference(featureCollection([a,b])));
 const ba=safe(()=>difference(featureCollection([b,a])));
 const aa=km2(a),bb=km2(b),ia=i?km2(i):0,dab=ab?km2(ab):0,dba=ba?km2(ba):0;
 return {relations:[aId,bId],area_km2:{[aId]:aa,[bId]:bb},intersection_km2:ia,intersection_over_smaller:ia/Math.min(aa,bb),intersection_over_union:ia/(aa+bb-ia),difference_km2:{[aId+'_minus_'+bId]:dab,[bId+'_minus_'+aId]:dba},symmetric_difference_km2:dab+dba,containment:{[aId+'_contains_'+bId]:safe(()=>booleanContains(a,b)),[bId+'_contains_'+aId]:safe(()=>booleanContains(b,a)),[aId+'_within_'+bId]:safe(()=>booleanWithin(a,b)),[bId+'_within_'+aId]:safe(()=>booleanWithin(b,a))}};
};
const uat=by.get(58983),c8=by.get(12207955),c9=by.get(18967626);
const out={schema_version:1,generated_at:new Date().toISOString(),legal_id:'0300',legal_name:'Bălți',policy:'Geometry diagnostic only; no canonical city representation is selected and no OSM geometry or CUATM reconciliation is changed.',areas_km2:{uat_58983:km2(uat),city_12207955:km2(c8),city_18967626:km2(c9)},comparisons:{city_candidates:pair(12207955,18967626),uat_vs_city_level8:pair(58983,12207955),uat_vs_city_level9:pair(58983,18967626)}};
await mkdir('data/current',{recursive:true});await writeFile('data/current/md-balti-geometry-comparison.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out,null,2));
