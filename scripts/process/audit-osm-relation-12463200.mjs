#!/usr/bin/env node
import {readFile,writeFile} from 'node:fs/promises';
import osmtogeojson from 'osmtogeojson';
import GeoJSONReader from 'jsts/org/locationtech/jts/io/GeoJSONReader.js';
import IsValidOp from 'jsts/org/locationtech/jts/operation/valid/IsValidOp.js';

const RID=12463200, ID='osm-r12463200', OUT='data/current/osm-12463200-audit.json'; // Fîrlădeni, Căușeni
const reader=new GeoJSONReader();
const endpoints=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://overpass.nchc.org.tw/api/interpreter','https://overpass.private.coffee/api/interpreter'];
async function overpass(q){let last;for(const url of endpoints){try{const r=await fetch(url,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','user-agent':'reforma-teritoriala-audit/1.0'},body:new URLSearchParams({data:q})});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json();}catch(e){last=e;}}throw last;}
function valid(g){try{const op=new IsValidOp(reader.read(g));const ok=op.isValid(),e=op.getValidationError();return {valid:ok,error:ok?null:{message:e?.getMessage?.()??null,coordinate:e?.getCoordinate?.()?.toString?.()??null}};}catch(e){return {valid:false,error:{message:String(e.message||e)}};}}
const raw=await overpass(`[out:json][timeout:120];relation(${RID});out meta;>;out meta qt;`);
const relation=raw.elements.find(x=>x.type==='relation'&&x.id===RID);
if(!relation)throw new Error('relation missing from Overpass');
const ways=new Map(raw.elements.filter(x=>x.type==='way').map(x=>[x.id,x]));
const nodes=new Map(raw.elements.filter(x=>x.type==='node').map(x=>[x.id,x]));
const members=(relation.members||[]).map((m,i)=>{const w=m.type==='way'?ways.get(m.ref):null;const first=w?.nodes?.[0],last=w?.nodes?.at(-1);return {index:i,type:m.type,ref:m.ref,role:m.role||'',way_node_count:w?.nodes?.length??null,closed:w?first===last:null,first_node:first??null,last_node:last??null};});
async function osmApi(path){const r=await fetch('https://api.openstreetmap.org/api/0.6/'+path,{headers:{'accept':'application/json','user-agent':'reforma-teritoriala-audit/1.0'}});if(!r.ok)throw new Error('OSM API HTTP '+r.status+' '+path);return r.json();}
const parentRelations={};
for(const wid of [76585146,94511352,76583058,918853574]){
  const rr=await osmApi('way/'+wid+'/relations.json');
  parentRelations[wid]=(rr.elements||[]).filter(x=>x.type==='relation').map(r=>({id:r.id,version:r.version,timestamp:r.timestamp,tags:r.tags||{},members:(r.members||[]).filter(m=>m.type==='way'&&[76585146,94511352,76583058,918853574].includes(m.ref))}));
}
const nodeParents=await osmApi('node/8527658244/ways.json');
const waysAtIntersection=(nodeParents.elements||[]).filter(x=>x.type==='way').map(w=>({id:w.id,version:w.version,timestamp:w.timestamp,tags:w.tags||{},node_indexes:(w.nodes||[]).map((n,i)=>n===8527658244?i:null).filter(i=>i!==null)}));
const geo=osmtogeojson(raw,{flatProperties:false});
const converted=geo.features.find(f=>String(f.id)==='relation/'+RID);
const simulated=structuredClone(raw);
const syntheticNodeId=-8527658244;
simulated.elements.push({type:'node',id:syntheticNodeId,lat:46.7587398,lon:29.2405257});
for(const e of simulated.elements.filter(e=>e.type==='way'&&[94511352,918853574].includes(e.id))) e.nodes=e.nodes.map(n=>n===8527658244?syntheticNodeId:n);
const simGeo=osmtogeojson(simulated,{flatProperties:false});
const simFeature=simGeo.features.find(f=>String(f.id)==='relation/'+RID);
const simValidity=valid(simFeature?.geometry);


const master=JSON.parse(await readFile('public/geo/current/md-administrative.geojson','utf8')).features.find(f=>f.properties?.catalog_id===ID);
const convertedValidity=valid(converted?.geometry),masterValidity=valid(master?.geometry);
const target={lon:29.2405257,lat:46.7587398};
const targetNodes=[...nodes.values()].filter(n=>Math.abs(n.lon-target.lon)<1e-9&&Math.abs(n.lat-target.lat)<1e-9).map(n=>n.id);
const targetWays=[...ways.values()].filter(w=>(w.nodes||[]).some(n=>targetNodes.includes(n))).map(w=>({id:w.id,node_indexes:(w.nodes||[]).map((n,i)=>targetNodes.includes(n)?i:null).filter(i=>i!==null),nodes:w.nodes}));
const endpointDegree=new Map();for(const m of members.filter(x=>x.type==='way')){for(const n of [m.first_node,m.last_node])endpointDegree.set(n,(endpointDegree.get(n)||0)+1);}
const anomalousEndpoints=[...endpointDegree].filter(([,degree])=>degree!==2).map(([node_id,degree])=>({node_id,degree,coordinate:nodes.has(node_id)?[nodes.get(node_id).lon,nodes.get(node_id).lat]:null}));
const report={schema_version:1,generated_at:new Date().toISOString(),relation_id:RID,name:relation.tags?.name??null,relation_version:relation.version??null,changeset:relation.changeset??null,timestamp:relation.timestamp??null,tags:relation.tags??{},member_count:members.length,members,source_counts:{ways:ways.size,nodes:nodes.size},parent_relations_by_way:parentRelations,ways_at_intersection_node:waysAtIntersection,intersection_probe:{coordinate:[target.lon,target.lat],exact_osm_node_ids:targetNodes,ways_using_exact_node:targetWays,outer_endpoint_degree_anomalies:anomalousEndpoints},converted_geometry:{type:converted?.geometry?.type??null,validity:convertedValidity},master_geometry:{type:master?.geometry?.type??null,validity:masterValidity,exactly_matches_fresh_osmtogeojson:JSON.stringify(master?.geometry)===JSON.stringify(converted?.geometry)},simulated_osm_fix:{operation:'split_intersection_node_without_coordinate_change',keep_node_8527658244_on_ways:[76585146,76583058],replace_with_new_coincident_node_on_ways:[94511352,918853574],geometry_type:simFeature?.geometry?.type??null,validity:simValidity},diagnosis:null};
if(simValidity.valid)report.diagnosis='source_topology_fix_identified_split_node_between_baccealia_and_ciobanovca_boundary_pairs';
else if(!convertedValidity.valid&&masterValidity.error?.coordinate===convertedValidity.error?.coordinate)report.diagnosis='self_intersection_reproduced_from_current_osm_relation_through_fresh_osmtogeojson';
else if(convertedValidity.valid&&!masterValidity.valid)report.diagnosis='current_osm_conversion_valid_but_repository_master_stale_or_pipeline_specific';
else if(!convertedValidity.valid)report.diagnosis='current_osm_conversion_invalid_with_different_master_signature';
else report.diagnosis='no_current_topology_failure_reproduced';
await writeFile(OUT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
console.log('SIMULATED_OSM_FIX '+JSON.stringify(report.simulated_osm_fix));
// neighboring relation membership and simulated repair is intentionally read-only and coordinate-preserving


