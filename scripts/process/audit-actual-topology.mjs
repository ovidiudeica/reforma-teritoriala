#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import osmtogeojson from 'osmtogeojson';
import GeoJSONReader from 'jsts/org/locationtech/jts/io/GeoJSONReader.js';
import IsValidOp from 'jsts/org/locationtech/jts/operation/valid/IsValidOp.js';

const jtsReader=new GeoJSONReader();

const SOURCES={RO:'public/geo/current/ro-administrative.geojson',MD:'public/geo/current/md-administrative.geojson'};
const CATALOG='data/current/entities.json';
const OUTPUT='data/current/actual-topology-audit.json';
const sha256=value=>createHash('sha256').update(value).digest('hex');
const same=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>v===b[i]);
const blockers=[],observations=[],stats={};
const osmMapFidelity={schema_version:1,criterion:'Exact undirected boundary-segment equality against the materialized OSM relation geometry. Ring order/orientation and Polygon/MultiPolygon grouping may differ; coordinates or boundary segments may not.',jurisdictions:{},mismatches:[]};

const coordKey=c=>JSON.stringify([Number(c[0]),Number(c[1])]);
const edgeKey=(a,b)=>[coordKey(a),coordKey(b)].sort().join('|');
function geometryBoundaryEdges(geometry){
 const edges=new Set();
 const rings=[];
 if(geometry?.type==='Polygon')for(const ring of geometry.coordinates||[])rings.push(ring);
 else if(geometry?.type==='MultiPolygon')for(const poly of geometry.coordinates||[])for(const ring of poly||[])rings.push(ring);
 for(const ring of rings)for(let i=1;i<ring.length;i++)edges.add(edgeKey(ring[i-1],ring[i]));
 return edges;
}
function osmRelationId(feature){
 const id=String(feature?.id||'');
 const m=id.match(/relation\/(\d+)/);
 return m?Number(m[1]):null;
}
async function auditOsmBoundaryFidelity(){
 const manifest=JSON.parse(await readFile('data/sources/osm-current.json','utf8'));
 for(const [jurisdiction,path] of Object.entries(SOURCES)){
  const entry=manifest.countries?.[jurisdiction];
  if(!entry?.snapshot_path)throw new Error('Missing OSM snapshot for '+jurisdiction);
  const raw=JSON.parse(gunzipSync(await readFile(entry.snapshot_path)).toString('utf8'));
  const osmGeo=osmtogeojson(raw,{flatProperties:false});
  const expectedByRelation=new Map((osmGeo.features||[]).map(f=>[osmRelationId(f),f]).filter(([rid,f])=>rid&&['Polygon','MultiPolygon'].includes(f.geometry?.type)));
  const master=JSON.parse(await readFile(path,'utf8'));
  let osmIdCount=0,exactCount=0,nonOsmIdCount=0,missingRelationCount=0;
  for(const feature of master.features||[]){
   const id=String(feature.properties?.catalog_id||'');
   const m=id.match(/^osm-r(\d+)$/);
   if(!m){nonOsmIdCount++;continue;}
   osmIdCount++;
   const rid=Number(m[1]),expected=expectedByRelation.get(rid);
   if(!expected){
    missingRelationCount++;
    osmMapFidelity.mismatches.push({jurisdiction,entity_id:id,relation_id:rid,issue:'relation_missing_from_materialized_osm_snapshot'});
    continue;
   }
   const actualEdges=geometryBoundaryEdges(feature.geometry),expectedEdges=geometryBoundaryEdges(expected.geometry);
   const missing=[...expectedEdges].filter(x=>!actualEdges.has(x));
   const extra=[...actualEdges].filter(x=>!expectedEdges.has(x));
   if(!missing.length&&!extra.length){exactCount++;continue;}
   osmMapFidelity.mismatches.push({
    jurisdiction,entity_id:id,relation_id:rid,issue:'boundary_segments_differ_from_osm',
    expected_edge_count:expectedEdges.size,actual_edge_count:actualEdges.size,
    missing_osm_edge_count:missing.length,extra_actual_edge_count:extra.length,
    missing_osm_edge_samples:missing.slice(0,3),extra_actual_edge_samples:extra.slice(0,3)
   });
  }
  osmMapFidelity.jurisdictions[jurisdiction]={
   master_feature_count:(master.features||[]).length,
   osm_id_feature_count:osmIdCount,
   exact_osm_boundary_count:exactCount,
   non_osm_id_feature_count:nonOsmIdCount,
   missing_relation_count:missingRelationCount,
   mismatch_count:osmMapFidelity.mismatches.filter(x=>x.jurisdiction===jurisdiction).length,
   source_snapshot_at:entry.snapshot_at??manifest.snapshot_at??null,
   source_semantic_sha256:entry.semantic_sha256??null
  };
 }
 osmMapFidelity.status=osmMapFidelity.mismatches.length?'REVIEW':'PASS';
}

const add=(list,jurisdiction,id,issue,detail={})=>list.push({jurisdiction,entity_id:id??null,issue,...detail});

function inspectCoordinates(geometry,jurisdiction,id){
 let coordinateCount=0,ringCount=0;
 const walk=(node,depth=0)=>{
  if(!Array.isArray(node))return;
  if(node.length>=2&&typeof node[0]==='number'&&typeof node[1]==='number'){
   coordinateCount++;
   if(!Number.isFinite(node[0])||!Number.isFinite(node[1]))add(blockers,jurisdiction,id,'non_finite_coordinate');
   else if(node[0]<-180||node[0]>180||node[1]<-90||node[1]>90)add(blockers,jurisdiction,id,'coordinate_out_of_epsg4326_range',{coordinate:node.slice(0,2)});
   return;
  }
  if(depth>=1&&node.length&&Array.isArray(node[0])&&node[0].length>=2&&typeof node[0][0]==='number'){
   ringCount++;
   if(node.length<4)add(blockers,jurisdiction,id,'ring_has_fewer_than_four_positions',{position_count:node.length});
   else if(!same(node[0],node.at(-1)))add(blockers,jurisdiction,id,'ring_not_closed');
  }
  for(const child of node)walk(child,depth+1);
 };
 walk(geometry?.coordinates);
 return {coordinateCount,ringCount};
}

const catalog=JSON.parse(await readFile(CATALOG,'utf8'));
const entities=Array.isArray(catalog.entities)?catalog.entities:[];
const entityById=new Map(entities.map(e=>[e.id,e]));
const featureById=new Map();
const bboxById=new Map();
const exactGeometryOwners=new Map();

for(const [jurisdiction,path] of Object.entries(SOURCES)){
 const doc=JSON.parse(await readFile(path,'utf8'));
 const features=Array.isArray(doc.features)?doc.features:[];
 let coordinateCount=0,ringCount=0;
 for(const f of features){
  const id=f.properties?.catalog_id??null;
  if(!id){add(blockers,jurisdiction,null,'missing_catalog_id');continue;}
  if(featureById.has(id))add(blockers,jurisdiction,id,'duplicate_catalog_id_in_master_geometry');
  featureById.set(id,f);
  const g=f.geometry;
  if(!g){add(blockers,jurisdiction,id,'missing_geometry');continue;}
  if(!['Polygon','MultiPolygon'].includes(g.type)){add(blockers,jurisdiction,id,'unexpected_geometry_type',{geometry_type:g.type});continue;}
  if(!Array.isArray(g.coordinates)||g.coordinates.length===0){add(blockers,jurisdiction,id,'empty_geometry');continue;}
  const counts=inspectCoordinates(g,jurisdiction,id); coordinateCount+=counts.coordinateCount; ringCount+=counts.ringCount;
  const bbox=[Infinity,Infinity,-Infinity,-Infinity];
  const scan=n=>{if(!Array.isArray(n))return;if(n.length>=2&&typeof n[0]==='number'&&typeof n[1]==='number'){bbox[0]=Math.min(bbox[0],n[0]);bbox[1]=Math.min(bbox[1],n[1]);bbox[2]=Math.max(bbox[2],n[0]);bbox[3]=Math.max(bbox[3],n[1]);return;}for(const c of n)scan(c);};
  scan(g.coordinates); bboxById.set(id,bbox);
  try{
   const validity=new IsValidOp(jtsReader.read(g));
   if(!validity.isValid()){
    const error=validity.getValidationError();
    add(blockers,jurisdiction,id,'invalid_polygon_topology',{reason:error?.getMessage?.()??null,coordinate:error?.getCoordinate?.()?.toString?.()??null});
   }
  }catch(error){add(blockers,jurisdiction,id,'geometry_validation_exception',{message:String(error?.message||error)});continue;}
  const hash=sha256(JSON.stringify(g));
  const previous=exactGeometryOwners.get(hash);
  if(previous)add(blockers,jurisdiction,id,'exact_duplicate_geometry',{same_as:previous});
  else exactGeometryOwners.set(hash,id);
 }
 stats[jurisdiction]={feature_count:features.length,coordinate_count:coordinateCount,ring_count:ringCount};
}

for(const e of entities){
 const child=featureById.get(e.id);
 if(!child)continue;
 const parentId=e.parent_id??e.parent?.id??e.parent_entity_id??null;
 if(!parentId||parentId===e.jurisdiction)continue;
 const parent=featureById.get(parentId);
 if(!parent){add(observations,e.jurisdiction,e.id,'parent_geometry_not_available',{parent_id:parentId});continue;}
 const childBox=bboxById.get(e.id),parentBox=bboxById.get(parentId);
 if(childBox&&parentBox&&(childBox[0]<parentBox[0]||childBox[1]<parentBox[1]||childBox[2]>parentBox[2]||childBox[3]>parentBox[3]))
  add(observations,e.jurisdiction,e.id,'child_bbox_exceeds_parent_bbox',{parent_id:parentId,child_bbox:childBox,parent_bbox:parentBox});
}

const missingMaster=entities.filter(e=>['RO','MD'].includes(e.jurisdiction)&&!featureById.has(e.id)).map(e=>e.id);
for(const id of missingMaster)add(blockers,entityById.get(id)?.jurisdiction??null,id,'catalog_entity_missing_master_geometry');

await auditOsmBoundaryFidelity();

const report={
 schema_version:1,
 generated_at:new Date().toISOString(),
 mode:'ACTUAL',
 scope:['RO','MD'],
 status:blockers.length?'FAIL':'PASS',
 policy:{
  blocking:'Only structural geometry corruption blocks release: missing/empty/non-polygon geometry, invalid EPSG:4326 coordinates, malformed rings, invalid polygon topology, duplicate master identity/geometry, or missing master geometry.',
  report_only:'Parent-child bounding-box containment anomalies are observations because administrative exceptions and disputed/de-facto representations require semantic review. No geometry is modified or repaired.'
 },
 sources:SOURCES,
 stats,
 blocking_issue_count:blockers.length,
 observation_count:observations.length,
 blocking_issues:blockers,
 observations,
 osm_map_fidelity_diagnostic:osmMapFidelity
};
await mkdir('data/current',{recursive:true});
await writeFile(OUTPUT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(blockers.length)process.exit(1);
