#!/usr/bin/env node
import {readFile,writeFile} from 'node:fs/promises';
import osmtogeojson from 'osmtogeojson';
import GeoJSONReader from 'jsts/org/locationtech/jts/io/GeoJSONReader.js';
import IsValidOp from 'jsts/org/locationtech/jts/operation/valid/IsValidOp.js';

const RID=12463200, ID='osm-r12463200', OUT='data/current/osm-12463200-audit.json'; // Fîrlădeni, Căușeni
const reader=new GeoJSONReader();
const endpoints=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];
async function overpass(q){let last;for(const url of endpoints){try{const r=await fetch(url,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','user-agent':'reforma-teritoriala-audit/1.0'},body:new URLSearchParams({data:q})});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json();}catch(e){last=e;}}throw last;}
function valid(g){try{const op=new IsValidOp(reader.read(g));const ok=op.isValid(),e=op.getValidationError();return {valid:ok,error:ok?null:{message:e?.getMessage?.()??null,coordinate:e?.getCoordinate?.()?.toString?.()??null}};}catch(e){return {valid:false,error:{message:String(e.message||e)}};}}
const raw=await overpass(`[out:json][timeout:120];relation(${RID});out body;>;out body qt;`);
const relation=raw.elements.find(x=>x.type==='relation'&&x.id===RID);
if(!relation)throw new Error('relation missing from Overpass');
const ways=new Map(raw.elements.filter(x=>x.type==='way').map(x=>[x.id,x]));
const nodes=new Map(raw.elements.filter(x=>x.type==='node').map(x=>[x.id,x]));
const members=(relation.members||[]).map((m,i)=>{const w=m.type==='way'?ways.get(m.ref):null;const first=w?.nodes?.[0],last=w?.nodes?.at(-1);return {index:i,type:m.type,ref:m.ref,role:m.role||'',way_node_count:w?.nodes?.length??null,closed:w?first===last:null,first_node:first??null,last_node:last??null};});
const geo=osmtogeojson(raw,{flatProperties:false});
const converted=geo.features.find(f=>String(f.id)==='relation/'+RID);
const master=JSON.parse(await readFile('public/geo/current/md-administrative.geojson','utf8')).features.find(f=>f.properties?.catalog_id===ID);
const convertedValidity=valid(converted?.geometry),masterValidity=valid(master?.geometry);
const report={schema_version:1,generated_at:new Date().toISOString(),relation_id:RID,name:relation.tags?.name??null,relation_version:relation.version??null,changeset:relation.changeset??null,timestamp:relation.timestamp??null,tags:relation.tags??{},member_count:members.length,members,source_counts:{ways:ways.size,nodes:nodes.size},converted_geometry:{type:converted?.geometry?.type??null,validity:convertedValidity},master_geometry:{type:master?.geometry?.type??null,validity:masterValidity,exactly_matches_fresh_osmtogeojson:JSON.stringify(master?.geometry)===JSON.stringify(converted?.geometry)},diagnosis:null};
if(!convertedValidity.valid&&masterValidity.error?.coordinate===convertedValidity.error?.coordinate)report.diagnosis='self_intersection_reproduced_from_current_osm_relation_through_fresh_osmtogeojson';
else if(convertedValidity.valid&&!masterValidity.valid)report.diagnosis='current_osm_conversion_valid_but_repository_master_stale_or_pipeline_specific';
else if(!convertedValidity.valid)report.diagnosis='current_osm_conversion_invalid_with_different_master_signature';
else report.diagnosis='no_current_topology_failure_reproduced';
await writeFile(OUT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
