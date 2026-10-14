// P9.0.3 — resolve the 84 P9.0.2 clipped administrative OSM relations without changing ACTUAL.
// Full OSM API way/node geometry is authoritative for this *live* audit, not Geofabrik PBF chronology.
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import RelateOp from 'jsts/org/locationtech/jts/operation/relate/RelateOp.js';
import {readTopologyGeometry} from '../lib/p82-topology.mjs';

const ROOT=new URL('../../',import.meta.url);
const OUT=new URL('../../outputs/P9.0.3/',import.meta.url);
const hash=x=>createHash('sha256').update(x).digest('hex');
const attr=(s,k)=>(s.match(new RegExp('(?:^|\\s)'+k+'="([^"]*)"'))||[])[1];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const numID=x=>/^[1-9][0-9]{0,15}$/.test(String(x));
function parse(xml){
 const nodes=new Map(),ways=new Map(),relations=new Map();
 for(const m of xml.matchAll(/<node\b([^>]*)\/?\s*>/g)){
  const id=attr(m[1],'id'),lon=attr(m[1],'lon'),lat=attr(m[1],'lat');
  if(id&&lon!==undefined&&lat!==undefined)nodes.set(id,[Number(lon),Number(lat)]);
 }
 for(const m of xml.matchAll(/<way\b([^>]*)>([\s\S]*?)<\/way>/g)){
  const id=attr(m[1],'id');
  if(id)ways.set(id,[...m[2].matchAll(/<nd\s+([^>]*?)\/>/g)].map(z=>attr(z[1],'ref')));
 }
 for(const m of xml.matchAll(/<relation\b([^>]*)>([\s\S]*?)<\/relation>/g)){
  const id=attr(m[1],'id');if(!id)continue;
  const tags=Object.fromEntries([...m[2].matchAll(/<tag\s+([^>]*?)\/>/g)].map(z=>[attr(z[1],'k'),attr(z[1],'v')]));
  const members=[...m[2].matchAll(/<member\s+([^>]*?)\/>/g)].map(z=>({type:attr(z[1],'type'),id:attr(z[1],'ref'),role:attr(z[1],'role')}));
  relations.set(id,{id,version:attr(m[1],'version'),timestamp:attr(m[1],'timestamp'),members,tags});
 }
 return {nodes,ways,relations};
}
function ringCoordinates(members,role,ways,nodes){
 const pending=members.filter(m=>m.role===role);
 if(pending.some(m=>m.type!=='way'))throw Error('nested_nonway_'+role);
 const rest=pending.map(m=>{
  const seq=ways.get(m.id);
  if(!seq||seq.length<2||seq.some(id=>!nodes.has(id)))throw Error('missing_way_or_nodes_'+m.id);
  return {id:m.id,seq};
 });
 const rings=[];
 while(rest.length){
  const seq=rest.pop().seq.slice();
  let guard=0;
  while(seq[0]!==seq.at(-1)){
   if(++guard>25000)throw Error('ring_join_guard_exceeded_'+role);
   const tail=seq.at(-1);
   const i=rest.findIndex(w=>w.seq[0]===tail||w.seq.at(-1)===tail);
   if(i<0)throw Error('open_ring_'+role+'_'+tail);
   let next=rest.splice(i,1)[0].seq;
   if(next.at(-1)===tail)next=next.slice().reverse();
   seq.push(...next.slice(1));
  }
  if(seq.length<4||new Set(seq).size<3)throw Error('degenerate_ring_'+role);
  const pts=seq.map(id=>nodes.get(id));
  if(pts.some(p=>p.some(v=>!Number.isFinite(v))))throw Error('bad_coordinates_'+role);
  rings.push(pts);
 }
 return rings;
}
function inside(p,ring){
 let odd=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[i],b=ring[j];
  if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])odd=!odd;
 }
 return odd;
}
function geometryOf(r,ways,nodes){
 const outer=ringCoordinates(r.members,'outer',ways,nodes);
 const holes=ringCoordinates(r.members,'inner',ways,nodes);
 if(!outer.length)throw Error('no_outer_ring');
 const polygons=outer.map(o=>[o]);
 for(const h of holes){
  const owners=polygons.filter(p=>inside(h[0],p[0]));
  if(owners.length!==1)throw Error('ambiguous_hole_assignment');
  owners[0].push(h);
 }
 return polygons.length===1?{type:'Polygon',coordinates:polygons[0]}:{type:'MultiPolygon',coordinates:polygons};
}
async function fetchOSM(id){
 if(!numID(id))throw Error('invalid_osm_id');
 let error;
 for(let attempt=0;attempt<3;attempt++){
  for(const host of ['https://api.openstreetmap.org','https://www.openstreetmap.org']){
   const url=host+'/api/0.6/relation/'+id+'/full';
   try{
    const response=await fetch(url,{headers:{Accept:'application/xml','User-Agent':'ReformaTerritoriala-P903-ReadOnly/1.0 (OSM audit)'},signal:AbortSignal.timeout(85000)});
    if(!response.ok)throw Error('HTTP_'+response.status);
    const xml=await response.text();
    if(!xml.includes('</osm>')||!new RegExp('<relation\\s+id="'+id+'"').test(xml))throw Error('missing_or_truncated_xml');
    return {parsed:parse(xml),url,sha256:hash(xml),bytes:Buffer.byteLength(xml)};
   }catch(e){error=String(e);}
  }
  await wait(1800*(attempt+1));
 }
 throw Error('osm_api_unavailable_'+id+': '+error);
}
function spatialRelation(root,g){
 if(!root.getEnvelopeInternal().intersects(g.getEnvelopeInternal())){
  return {relation:'disjoint',method:'full_valid_geometry_disjoint_envelopes',DE9IM:null};
 }
 const m=RelateOp.relate(root,g);
 const relation=m.isDisjoint()?'disjoint':m.isEquals(2,2)?'equal':
  m.isCovers()?'root_contains':m.isCoveredBy()?'root_within':
  m.get(0,0)===2?'partial_overlap':m.get(1,1)===1?'boundary':'point';
 return {relation,method:'jsts_DE9IM',DE9IM:m.toString()};
}
function test(){
 const xml='<osm><node id="1" lon="0" lat="0"/><node id="2" lon="1" lat="0"/><node id="3" lon="1" lat="1"/><node id="4" lon="0" lat="1"/><way id="7"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="4"/><nd ref="1"/></way><relation id="9" version="1" timestamp="2026-10-13T00:00:00Z"><member type="way" ref="7" role="outer"/><tag k="boundary" v="administrative"/></relation></osm>';
 const p=parse(xml),g=readTopologyGeometry(geometryOf(p.relations.get('9'),p.ways,p.nodes));
 assert.equal(spatialRelation(g,g).relation,'equal');
 assert.equal(spatialRelation(g,readTopologyGeometry({type:'Polygon',coordinates:[[[3,3],[4,3],[4,4],[3,4],[3,3]]]})).relation,'disjoint');
 assert.throws(()=>geometryOf({members:[{id:'8',type:'way',role:'outer'}]},p.ways,p.nodes),/missing_way/);
 console.log('P903_SELF_TEST PASS');
}
async function save(name,data){await mkdir(OUT,{recursive:true});await writeFile(new URL(name,OUT),JSON.stringify(data,null,2)+'\n');}
const manifest=JSON.parse(await readFile(new URL('docs/p9.0.3-missing-relations.json',ROOT),'utf8'));
if(manifest.schema_version!=='p903-nistrenia-missing-relations-v1'||manifest.expected_missing_count!==84||manifest.missing_relations.length!==84)throw Error('unexpected_exception_manifest_contract');
const ids=manifest.missing_relations.map(x=>String(x.id));
if(ids.some(x=>!numID(x))||new Set(ids).size!==84||ids.includes('65335'))throw Error('invalid_exception_ID_set');
if(process.argv.includes('--self-test')){test();process.exit(0);}
if(process.argv.includes('--combine')){
 const chunks=[];
 for(let i=0;i<2;i++){
  const file=new URL('shard-'+i+'.json',OUT);
  chunks.push(JSON.parse(await readFile(file,'utf8')));
 }
 const total=chunks.flatMap(x=>x.records);
 const found=new Set(total.map(x=>x.osm_id));
 const errors=total.filter(x=>x.status!=='resolved');
 const relevant=total.filter(x=>x.status==='resolved'&&!['disjoint','boundary','point'].includes(x.spatial.relation));
 const rootDigests=[...new Set(chunks.map(x=>x.root.geometry_sha256))];
 const rootXmlDigests=[...new Set(chunks.map(x=>x.root.sha256))];
 const rootVersions=[...new Set(chunks.map(x=>x.root.version+'@'+x.root.timestamp))];
 const missing=ids.filter(id=>!found.has(id));
 const duplicate=total.length-found.size;
 const counts=Object.fromEntries([...new Set(total.map(x=>x.spatial?.relation||x.status))].sort().map(k=>[k,total.filter(x=>(x.spatial?.relation||x.status)===k).length]));
 const verdict=found.size===84&&total.length===84&&errors.length===0&&rootDigests.length===1&&rootVersions.length===1?'PASS':'PARTIAL';
 const summary={schema_version:'p903-exception-audit-v1',status:verdict,scope:'full live OSM relation geometry vs live OSM Nistrenia root (not Geofabrik-time-identical)',manifest_source_run_id:manifest.source_run_id,manifest_source_artifact_id:manifest.source_artifact_id,manifest_geofabrik_sha256:manifest.geofabrik_pbf_sha256,reference_missing_count:84,evaluated:total.length,unique:found.size,duplicate,missing,unresolved:errors.length,root_geometry_digest_count:rootDigests.length,root_xml_response_digest_count:rootXmlDigests.length,root_relation_version_count:rootVersions.length,spatial_relation_counts:counts,requires_semantic_review:relevant.map(x=>x.osm_id),snapshot_alignment:'NOT_PROVEN: 2026-10-12 PBF vs separately fetched OSM API versions',source_runtime_versions:'Per-relation version, timestamp, URL and source SHA-256 recorded in records.json',no_import:true};
 await save('records.json',total.sort((a,b)=>Number(a.osm_id)-Number(b.osm_id)));
 await save('summary.json',summary);
 await save('exceptions.json',errors);
 console.log('P903_SUMMARY '+JSON.stringify(summary));
 if(verdict!=='PASS')process.exitCode=2;
}else{
 const shardArg=process.argv.find(x=>x.startsWith('--shard='));
 if(!shardArg||!/^[01]$/.test(shardArg.split('=')[1]))throw Error('provide --shard=0 or --shard=1');
 const shard=Number(shardArg.split('=')[1]);
 const target=manifest.missing_relations.filter((_,i)=>i%2===shard);
 const baseline=await fetchOSM('65335'),r=baseline.parsed.relations.get('65335');
 if(!r)throw Error('root_not_in_osm_full');
 const rootRawGeometry=geometryOf(r,baseline.parsed.ways,baseline.parsed.nodes);
 const rootGeometry=readTopologyGeometry(rootRawGeometry);
 const rootGeometrySha256=hash(JSON.stringify(rootRawGeometry));
 const records=[];
 for(const [i,item] of target.entries()){
  const row={osm_id:String(item.id),admin_level_manifest:item.admin_level,name_manifest:item.name||null,name_ro_manifest:item.name_ro||null,status:'unresolved',spatial:null};
  try{
   const result=await fetchOSM(row.osm_id),rel=result.parsed.relations.get(row.osm_id);
   if(!rel)throw Error('relation_absent_in_full');
   row.source={url:result.url,sha256:result.sha256,bytes:result.bytes,version:rel.version,timestamp:rel.timestamp,boundary:rel.tags.boundary||null,admin_level:rel.tags.admin_level||null};
   if(rel.tags.boundary!=='administrative')throw Error('boundary_tag_no_longer_administrative');
   const g=readTopologyGeometry(geometryOf(rel,result.parsed.ways,result.parsed.nodes));
   row.status='resolved';row.spatial=spatialRelation(rootGeometry,g);
  }catch(e){row.error=String(e);}
  records.push(row);
  console.log('P903_CASE '+JSON.stringify({id:row.osm_id,status:row.status,relation:row.spatial?.relation||null,error:row.error||null,completed:i+1,total:target.length}));
  await wait(350);
 }
 const payload={schema_version:'p903-shard-v1',shard,as_of:new Date().toISOString(),manifest_source_artifact_id:manifest.source_artifact_id,root:{id:'65335',sha256:baseline.sha256,geometry_sha256:rootGeometrySha256,version:r.version,timestamp:r.timestamp,source_url:baseline.url},records};
 await save('shard-'+shard+'.json',payload);
 const incomplete=records.filter(x=>x.status!=='resolved').length;
 console.log('P903_SHARD '+JSON.stringify({shard,checked:records.length,incomplete,root_sha256:baseline.sha256,root_geometry_sha256:rootGeometrySha256}));
}
