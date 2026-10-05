#!/usr/bin/env node
import {readFile} from 'node:fs/promises';

const current=JSON.parse(await readFile('public/geo/current/md-administrative.geojson','utf8'));
const currentIds=new Map(current.features.map(f=>[
 Number(String(f.properties?.catalog_id||'').replace(/^osm-r/,'')),
 {id:f.properties?.catalog_id,name:f.properties?.tags?.['name:ro']||f.properties?.tags?.name||f.properties?.name||null,admin_level:Number(f.properties?.tags?.admin_level||f.properties?.admin_level||0)}
]).filter(([id])=>Number.isFinite(id)));

const q='[out:json][timeout:300];relation["ISO3166-1"="MD"]["boundary"="administrative"]->.countryRel;.countryRel map_to_area ->.country;(.countryRel;relation(area.country)["boundary"="administrative"]["admin_level"="4"];relation(area.country)["boundary"="administrative"]["admin_level"="6"];relation(area.country)["boundary"="administrative"]["admin_level"="8"];relation(area.country)["boundary"="administrative"]["admin_level"="9"];relation(1813306);relation(1813297);relation(58512);relation(1813315);relation(1813316););out body;';
const endpoints=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://overpass.private.coffee/api/interpreter'];
let json=null,endpoint=null;
for(const e of endpoints){
 try{
  const r=await fetch(e,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','user-agent':'reforma-teritoriala-md-live-inventory-audit/1.0'},body:new URLSearchParams({data:q}),signal:AbortSignal.timeout(180000)});
  if(!r.ok)throw new Error('HTTP '+r.status);
  json=await r.json();endpoint=e;break;
 }catch(err){console.error('endpoint failed',e,String(err?.message||err));}
}
if(!json)throw new Error('all endpoints failed');
const live=new Map(json.elements.filter(x=>x.type==='relation').map(x=>[Number(x.id),x]));
const missing=[...currentIds.entries()].filter(([id])=>!live.has(id)).map(([id,meta])=>({relation_id:id,...meta}));
const added=[...live.entries()].filter(([id])=>!currentIds.has(id)).map(([id,x])=>({relation_id:id,name:x.tags?.['name:ro']||x.tags?.name||null,admin_level:Number(x.tags?.admin_level||0),boundary:x.tags?.boundary||null}));
console.log(JSON.stringify({endpoint,current_count:currentIds.size,live_relation_count:live.size,missing,added},null,2));
