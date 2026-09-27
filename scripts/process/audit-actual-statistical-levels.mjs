#!/usr/bin/env node
import {writeFile} from 'node:fs/promises';
const ENDPOINTS=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];
const official={
 RO:{source:'Eurostat NUTS 2024',levels:{1:{expected:4},2:{expected:8},3:{expected:42}}},
 MD:{source:'BNS Moldova, HG 570/2017',levels:{1:{expected:1},2:{expected:2},3:{expected:6}}}
};
async function overpass(q){let last;for(const endpoint of ENDPOINTS){try{const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','user-agent':'reforma-teritoriala-statistical-audit/1.0'},body:new URLSearchParams({data:q})});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json();}catch(e){last=e}}throw last}
const q=iso=>`[out:json][timeout:300];(relation["ISO3166-1"="${iso}"]["boundary"="administrative"];relation["boundary"="statistical"]["ref:nuts"~"^${iso}"];relation["boundary"="statistical"]["ref:NUTS"~"^${iso}"];relation["boundary"="statistical"]["nuts"~"^${iso}"];relation["boundary"="statistical"]["ref:nuts:1"~"^${iso}"];relation["boundary"="statistical"]["ref:nuts:2"~"^${iso}"];relation["boundary"="statistical"]["ref:nuts:3"~"^${iso}"];);out tags center;`;
const results={};
for(const iso of ['RO','MD']){
 const raw=await overpass(q(iso)); const rels=raw.elements.filter(x=>x.type==='relation').map(x=>({relation_id:x.id,name:x.tags?.['name:ro']||x.tags?.name||null,boundary:x.tags?.boundary||null,admin_level:x.tags?.admin_level||null,nuts:x.tags?.['ref:nuts']||x.tags?.['ref:NUTS']||x.tags?.nuts||null,nuts1:x.tags?.['ref:nuts:1']||null,nuts2:x.tags?.['ref:nuts:2']||null,nuts3:x.tags?.['ref:nuts:3']||null,tags:x.tags||{}}));
 const state=rels.filter(x=>x.boundary==='administrative'&&x.tags['ISO3166-1']===iso);
 const statistical=rels.filter(x=>x.boundary==='statistical');
 results[iso]={official:official[iso],state_boundary:state,osm_statistical_relations:statistical,osm_statistical_relation_count:statistical.length};
}
const report={schema_version:1,generated_at:new Date().toISOString(),mode:'ACTUAL',scope:['RO','MD'],purpose:'Audit state polygons and official statistical levels without conflating statistical and administrative hierarchies.',official_baseline:{RO:{classification:'NUTS 2024',level_1:4,level_2:8,level_3:42},MD:{classification:'Nomenclature of Territorial Units for Statistics of Moldova, Government Decision 570/2017',level_1:1,level_2:2,level_3:6}},results,policy:{state_polygon:'Retain OSM national administrative boundary geometry separately as country/state context.',statistical_geometry:'Do not infer official statistical polygons solely from administrative hierarchy. Bind OSM statistical relations only where official statistical identity is explicit; otherwise construct/validate against official composition in a later import step.'}};
await writeFile('data/current/actual-statistical-levels-audit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
