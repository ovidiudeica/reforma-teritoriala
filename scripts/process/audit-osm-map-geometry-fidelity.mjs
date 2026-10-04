#!/usr/bin/env node
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import osmtogeojson from 'osmtogeojson';
import {area,difference,featureCollection} from '@turf/turf';

const MANIFEST='data/sources/osm-current.json';
const SOURCES={RO:'public/geo/current/ro-administrative.geojson',MD:'public/geo/current/md-administrative.geojson'};
const CATALOG='data/current/entities.json';
const OUTPUT='/tmp/osm-geometry-fidelity.json';
const ENDPOINTS=[
 'https://overpass-api.de/api/interpreter',
 'https://overpass.kumi.systems/api/interpreter',
 'https://overpass.private.coffee/api/interpreter'
];
const CONFIG={
 RO:{iso:'RO',levels:[4,8,9],requiredRelations:[]},
 MD:{iso:'MD',levels:[4,6,8,9],requiredRelations:[1813306,1813297,58512,1813315,1813316]}
};
const relationId=f=>{const m=String(f?.id||'').match(/relation\/(\d+)/);return m?Number(m[1]):null};
const idForRelation=id=>'osm-r'+id;
const coordKey=c=>JSON.stringify([Number(c[0]),Number(c[1])]);
const edgeKey=(a,b)=>[coordKey(a),coordKey(b)].sort().join('|');

function geometryEdges(geometry){
 const out=new Map();
 const addRing=ring=>{for(let i=0;i<ring.length-1;i++){const k=edgeKey(ring[i],ring[i+1]);out.set(k,(out.get(k)||0)+1);}};
 if(geometry?.type==='Polygon')for(const ring of geometry.coordinates||[])addRing(ring);
 else if(geometry?.type==='MultiPolygon')for(const poly of geometry.coordinates||[])for(const ring of poly)addRing(ring);
 return out;
}
function sameMultiset(a,b){
 if(a.size!==b.size)return false;
 for(const [k,v] of a)if(b.get(k)!==v)return false;
 return true;
}
function relationMemberEdges(raw,rid){
 const rel=(raw.elements||[]).find(x=>x.type==='relation'&&Number(x.id)===Number(rid));
 if(!rel)return null;
 const ways=new Map((raw.elements||[]).filter(x=>x.type==='way').map(x=>[Number(x.id),x]));
 const nodes=new Map((raw.elements||[]).filter(x=>x.type==='node').map(x=>[Number(x.id),x]));
 const out=new Map();
 for(const m of rel.members||[]){
  if(m.type!=='way')continue;
  const w=ways.get(Number(m.ref));
  if(!w||!Array.isArray(w.nodes))continue;
  for(let i=0;i<w.nodes.length-1;i++){
   const a=nodes.get(Number(w.nodes[i])),b=nodes.get(Number(w.nodes[i+1]));
   if(!a||!b)continue;
   const k=edgeKey([a.lon,a.lat],[b.lon,b.lat]);out.set(k,(out.get(k)||0)+1);
  }
 }
 return out;
}
function sourceMap(raw){
 const geo=osmtogeojson(raw,{flatProperties:false});
 return new Map((geo.features||[]).filter(f=>['Polygon','MultiPolygon'].includes(f.geometry?.type)&&relationId(f)).map(f=>[relationId(f),f]));
}
function queryFor(cfg){
 const filters=cfg.levels.map(l=>`relation(area.country)["boundary"="administrative"]["admin_level"="${l}"];`).join('\n');
 const required=cfg.requiredRelations.map(id=>`relation(${id});`).join('\n');
 return `[out:json][timeout:300];relation["ISO3166-1"="${cfg.iso}"]["boundary"="administrative"]->.countryRel;.countryRel map_to_area ->.country;(.countryRel;${filters}${required?'\n'+required:''});out body;>;out skel qt;`;
}
async function fetchLive(code,cfg){
 const query=queryFor(cfg),attempts=[];
 for(const endpoint of ENDPOINTS){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),180000);
  const started=Date.now();
  try{
   const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','user-agent':'reforma-teritoriala-osm-fidelity-audit/1.0'},body:new URLSearchParams({data:query}),signal:controller.signal});
   const body=await r.text();
   if(!r.ok)throw new Error('HTTP '+r.status+': '+body.slice(0,160).replace(/\s+/g,' '));
   const raw=JSON.parse(body);
   if(!Array.isArray(raw.elements)||raw.elements.length<10000)throw new Error('unexpectedly small OSM response');
   attempts.push({endpoint,status:'success',duration_ms:Date.now()-started,element_count:raw.elements.length});
   return {raw,endpoint,attempts};
  }catch(e){
   attempts.push({endpoint,status:'failure',duration_ms:Date.now()-started,error:controller.signal.aborted?'timeout':String(e.message||e)});
  }finally{clearTimeout(timer);}
 }
 throw new Error(code+' live OSM fetch failed: '+JSON.stringify(attempts));
}
function intentionalExclusion(entity){
 if(!entity)return 'missing_catalog_entity';
 if(entity.id==='siruta-u64096')return 'reviewed_ANCPI_Bretcu_fallback';
 if(entity.geometry?.scope==='uat_hybrid_partition')return 'reviewed_Bretcu_Ojdula_hybrid_partition';
 if(entity.representation?.source&&entity.representation.source!=='OpenStreetMap')return 'reviewed_non_OSM_representation';
 if(entity.source&&entity.source!=='OpenStreetMap')return 'non_OSM_source';
 return null;
}
function symmetricDiffM2(a,b){
 try{
  const ab=difference(featureCollection([a,b]));
  const ba=difference(featureCollection([b,a]));
  return (ab?area(ab):0)+(ba?area(ba):0);
 }catch{return null;}
}
function compareOne(master,source,raw,rid){
 const me=geometryEdges(master.geometry);
 if(!source)return {status:'SOURCE_RELATION_GEOMETRY_MISSING',master_edge_count:[...me.values()].reduce((a,b)=>a+b,0)};
 const se=geometryEdges(source.geometry);
 if(sameMultiset(me,se))return {status:'EXACT_BOUNDARY_EDGES',master_edge_count:[...me.values()].reduce((a,b)=>a+b,0),source_edge_count:[...se.values()].reduce((a,b)=>a+b,0)};
 if(Number(rid)===12463200){
  const rawEdges=relationMemberEdges(raw,rid);
  if(rawEdges&&sameMultiset(me,rawEdges))return {status:'EXACT_RAW_MEMBER_EDGES_AFTER_REVIEWED_POINT_TOUCH_NORMALIZATION',master_edge_count:[...me.values()].reduce((a,b)=>a+b,0),source_edge_count:[...rawEdges.values()].reduce((a,b)=>a+b,0)};
 }
 const diff=symmetricDiffM2(master,source);
 if(diff!==null&&diff<=0.01)return {status:'SAME_DRAWN_BOUNDARY_SEGMENTATION_ONLY',symmetric_difference_m2:diff};
 return {status:'GEOMETRY_DIFFERENT',symmetric_difference_m2:diff,master_edge_count:[...me.values()].reduce((a,b)=>a+b,0),source_edge_count:[...se.values()].reduce((a,b)=>a+b,0)};
}

const manifest=JSON.parse(await readFile(MANIFEST,'utf8'));
const catalog=JSON.parse(await readFile(CATALOG,'utf8'));
const entityById=new Map((catalog.entities||[]).map(e=>[e.id,e]));
const masters={};
for(const [code,path] of Object.entries(SOURCES))masters[code]=JSON.parse(await readFile(path,'utf8'));

const report={
 schema_version:1,
 mode:'OSM_STANDARD_MAP_GEOMETRY_FIDELITY_AUDIT',
 audited_main_snapshot_id:JSON.parse(await readFile('data/current/actual-release-persisted.json','utf8')).snapshot_id,
 osm_manifest_snapshot_at:manifest.snapshot_at,
 policy:'Compare ACTUAL polygons whose geometry provenance is OSM against the exact OSM relation boundary edges. Intentional reviewed non-OSM/hybrid geometries are excluded. Live comparison uses the same Overpass relation scope that feeds the standard OSM database; exact boundary edges are stronger evidence than raster visual inspection.',
 jurisdictions:{},
 blockers:[]
};

for(const code of ['RO','MD']){
 const entry=manifest.countries[code];
 const snapshotRaw=JSON.parse(gunzipSync(await readFile(entry.snapshot_path)).toString('utf8'));
 const snapshotMap=sourceMap(snapshotRaw);
 const live=await fetchLive(code,CONFIG[code]);
 const liveMap=sourceMap(live.raw);
 const rows=[],excluded=[];
 for(const master of masters[code].features||[]){
  const id=master.properties?.catalog_id;
  const entity=entityById.get(id);
  const exclusion=intentionalExclusion(entity);
  if(exclusion){excluded.push({id,reason:exclusion});continue;}
  const rid=Number(entity?.osm?.relation_id??String(id||'').replace(/^osm-r/,''));
  if(!Number.isFinite(rid)){excluded.push({id,reason:'no_OSM_relation_id'});continue;}
  const snapshot=compareOne(master,snapshotMap.get(rid),snapshotRaw,rid);
  const current=compareOne(master,liveMap.get(rid),live.raw,rid);
  rows.push({id,name:entity?.name??null,relation_id:rid,admin_level:entity?.osm?.admin_level??null,snapshot,current});
 }
 const summarize=(key)=>{
  const counts={};
  for(const r of rows)counts[r[key].status]=(counts[r[key].status]||0)+1;
  return counts;
 };
 const liveDifferences=rows.filter(r=>!['EXACT_BOUNDARY_EDGES','EXACT_RAW_MEMBER_EDGES_AFTER_REVIEWED_POINT_TOUCH_NORMALIZATION','SAME_DRAWN_BOUNDARY_SEGMENTATION_ONLY'].includes(r.current.status));
 const snapshotDifferences=rows.filter(r=>!['EXACT_BOUNDARY_EDGES','EXACT_RAW_MEMBER_EDGES_AFTER_REVIEWED_POINT_TOUCH_NORMALIZATION','SAME_DRAWN_BOUNDARY_SEGMENTATION_ONLY'].includes(r.snapshot.status));
 report.jurisdictions[code]={
  master_feature_count:(masters[code].features||[]).length,
  osm_geometry_checked_count:rows.length,
  intentionally_excluded_count:excluded.length,
  intentionally_excluded:excluded,
  snapshot_source:{snapshot_at:entry.snapshot_at,semantic_sha256:entry.semantic_sha256,summary:summarize('snapshot'),difference_count:snapshotDifferences.length,differences:snapshotDifferences},
  live_source:{endpoint:live.endpoint,attempts:live.attempts,summary:summarize('current'),difference_count:liveDifferences.length,differences:liveDifferences}
 };
 if(snapshotDifferences.length)report.blockers.push({jurisdiction:code,issue:'persisted_OSM_geometry_not_faithful_to_bound_snapshot',count:snapshotDifferences.length});
}
report.status=report.blockers.length?'FAIL':'PASS';
await writeFile(OUTPUT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(report.blockers.length)process.exitCode=1;
