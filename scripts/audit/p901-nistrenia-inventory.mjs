// P9.0.1 read-only OSM Nistrenia audit versus ACTUAL MD; no writes to release corpus.
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import RelateOp from 'jsts/org/locationtech/jts/operation/relate/RelateOp.js';
import {readTopologyGeometry} from '../lib/p82-topology.mjs';
const ROOT=new URL('../../',import.meta.url),OUT=new URL('../../outputs/P9.0.1/',import.meta.url);
const hash=x=>createHash('sha256').update(x).digest('hex');
const attr=(s,k)=>(s.match(new RegExp('(?:^|\\s)'+k+'="([^"]*)"'))||[])[1];
const parse=xml=>{
 const nodes=new Map(),ways=new Map(),relations=new Map();
 for(const m of xml.matchAll(/<node\b([^>]*)\/?>/g)){
  const a=m[1],id=attr(a,'id'),lon=attr(a,'lon'),lat=attr(a,'lat');
  if(id&&lon&&lat)nodes.set(id,[Number(lon),Number(lat)]);
 }
 for(const m of xml.matchAll(/<way\b([^>]*)>([\s\S]*?)<\/way>/g)){
  const id=attr(m[1],'id');
  if(id)ways.set(id,[...m[2].matchAll(/<nd\s+([^>]*?)\/>/g)].map(z=>attr(z[1],'ref')));
 }
 for(const m of xml.matchAll(/<relation\b([^>]*)>([\s\S]*?)<\/relation>/g)){
  const id=attr(m[1],'id');if(!id)continue;
  const tags=Object.fromEntries([...m[2].matchAll(/<tag\s+([^>]*?)\/>/g)].map(z=>[attr(z[1],'k'),attr(z[1],'v')]));
  const members=[...m[2].matchAll(/<member\s+([^>]*?)\/>/g)].map(z=>({type:attr(z[1],'type'),id:attr(z[1],'ref'),role:attr(z[1],'role')}));
  relations.set(id,{id,version:attr(m[1],'version'),timestamp:attr(m[1],'timestamp'),tags,members});
 }
 return {nodes,ways,relations};
};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function fetchRelation(id){
 let last;
 for(let attempt=0;attempt<4;attempt++){
  for(const host of ['https://api.openstreetmap.org','https://www.openstreetmap.org']){
   try{
    const url=host+'/api/0.6/relation/'+id+'/full';
    const response=await fetch(url,{headers:{'Accept':'application/xml','User-Agent':'ReformaTeritoriala-P901-ReadOnly-Audit/1.0'},signal:AbortSignal.timeout(90000)});
    if(!response.ok)throw Error('HTTP '+response.status);
    const xml=await response.text();
    if(!xml.includes('</osm>')||!xml.includes('<relation id="'+id+'"'))throw Error('XML incomplet sau relație absentă');
    return {parsed:parse(xml),sha256:hash(xml),bytes:Buffer.byteLength(xml),url};
   }catch(e){last=e;}
  }
  await sleep(1400*(attempt+1));
 }
 throw Error('OSM '+id+': '+last);
}
function rings(members,role,ways,nodes){
 const remaining=members.filter(m=>m.type==='way'&&m.role===role).map(m=>{
  const seq=ways.get(m.id);
  if(!seq||seq.length<2||seq.some(id=>!nodes.has(id)))throw Error('Way incomplet '+m.id);
  return {id:m.id,seq};
 });
 const result=[];
 while(remaining.length){
  const seq=remaining.pop().seq.slice();let count=0;
  while(seq[0]!==seq.at(-1)){
   if(++count>10000)throw Error('Contur circular neînchis');
   const tail=seq.at(-1),i=remaining.findIndex(w=>w.seq[0]===tail||w.seq.at(-1)===tail);
   if(i<0)throw Error('Contur '+role+' deschis în nodul '+tail);
   let next=remaining.splice(i,1)[0].seq;
   if(next.at(-1)===tail)next=next.slice().reverse();
   seq.push(...next.slice(1));
  }
  if(seq.length<4||new Set(seq).size<3)throw Error('Inel degenerat');
  result.push(seq.map(id=>nodes.get(id)));
 }
 return result;
}
function inside(p,ring){
 let odd=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[i],b=ring[j];
  if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])odd=!odd;
 }
 return odd;
}
function relationGeometry(r,ways,nodes){
 const outer=rings(r.members,'outer',ways,nodes),holes=rings(r.members,'inner',ways,nodes);
 if(!outer.length)throw Error('Fără inel exterior');
 const polygons=outer.map(x=>[x]);
 for(const hole of holes){
  const owners=polygons.filter(x=>inside(hole[0],x[0]));
  if(owners.length!==1)throw Error('Inel interior neatribuit sau ambiguu');
  owners[0].push(hole);
 }
 return polygons.length===1?{type:'Polygon',coordinates:polygons[0]}:{type:'MultiPolygon',coordinates:polygons};
}
async function save(path,obj){
 await mkdir(OUT,{recursive:true});
 await writeFile(new URL(path,OUT),typeof obj==='string'?obj:JSON.stringify(obj,null,2)+'\n');
}
const topo=JSON.parse(await readFile(new URL('public/data/actual-topology-index.json',ROOT)));
const catalog=JSON.parse(await readFile(new URL('public/data/actual-entities.json',ROOT)));
const byId=new Map(catalog.entities.map(e=>[e.id,e])),md=new Map(),geometryCache=new Map();
const sourcePaths=Object.keys(topo.sources).sort();
if(sourcePaths.length!==123||byId.size!==5848)throw Error('ACTUAL corpus contract diferit de baza validată');
for(const path of sourcePaths){
 const bytes=await readFile(new URL(path,ROOT));
 if(hash(bytes)!==topo.sources[path])throw Error('SHA-256 invalid la '+path);
 for(const feature of JSON.parse(bytes).features){
  const id=feature.properties.entity_id,e=byId.get(id);
  if(!e)throw Error('Entitate necunoscută '+id);
  if(e.jurisdiction==='MD'&&!md.has(id))md.set(id,feature.geometry);
 }
}
function candidateGeometry(id){
 if(!geometryCache.has(id))geometryCache.set(id,readTopologyGeometry(md.get(id)));
 return geometryCache.get(id);
}
const queue=[{id:'65335',parent:null,depth:0}],seen=new Set(),inventory=[],matrix=[],exceptions=[];
let transferred=0;
while(queue.length){
 const task=queue.shift();if(seen.has(task.id))continue;
 if(seen.size>=160){exceptions.push({id:task.id,error:'Limită de siguranță: 160 relații OSM'});break;}
 seen.add(task.id);console.log('P901 fetching relation',task.id,'remaining',queue.length);
 let fetched,r;
 try{
  fetched=await fetchRelation(task.id);transferred+=fetched.bytes;
  r=fetched.parsed.relations.get(task.id);
  if(!r)throw Error('Relația lipsește din răspuns');
 }catch(error){exceptions.push({id:task.id,parent:task.parent,error:String(error)});continue;}
 const sub=r.members.filter(x=>x.type==='relation'&&x.role==='subarea').map(x=>x.id);
 const row={id:task.id,parent:task.parent,depth:task.depth,
  name_ro:r.tags['name:ro']||null,name:r.tags.name||null,
  admin_level:r.tags.admin_level||null,boundary:r.tags.boundary||null,
  version:r.version,timestamp:r.timestamp,source_sha256:fetched.sha256,source_bytes:fetched.bytes,
  outer_ways:r.members.filter(x=>x.type==='way'&&x.role==='outer').length,
  inner_ways:r.members.filter(x=>x.type==='way'&&x.role==='inner').length,
  subareas:sub,existing_ACTUAL_MD:md.has('osm-r'+task.id)};
 inventory.push(row);
 if(task.depth<4)for(const child of sub)queue.push({id:child,parent:task.id,depth:task.depth+1});
 try{
  const newGeo=readTopologyGeometry(relationGeometry(r,fetched.parsed.ways,fetched.parsed.nodes));
  const envelope=newGeo.getEnvelopeInternal();
  let overlapCount=0;
  for(const [actualId] of md){
   const oldGeo=candidateGeometry(actualId);
   if(!envelope.intersects(oldGeo.getEnvelopeInternal()))continue;
   let kind,matrixText,error;
   try{
    const m=RelateOp.relate(newGeo,oldGeo);matrixText=m.toString();
    kind=m.isDisjoint()?'disjoint':m.isEquals(2,2)?'equal':m.isCovers()?'contains':m.isCoveredBy()?'within':m.get(0,0)===2?'overlap':m.get(1,1)===1?'boundary':'point';
   }catch(e){kind='uncertain';error=String(e);}
   if(kind==='disjoint')continue;
   overlapCount++;
   const entity=byId.get(actualId);
   matrix.push({nistrenia_osm_id:task.id,actual_id:actualId,actual_name:entity?.display_name||null,
    same_osm_id:actualId==='osm-r'+task.id,relation:kind,DE9IM:matrixText||null,error:error||null});
  }
  row.geometry_status='validated';row.pairs=overlapCount;
 }catch(e){row.geometry_status='invalid_or_incomplete';exceptions.push({id:task.id,error:String(e)});}
 await sleep(250);
}
inventory.sort((a,b)=>a.depth-b.depth||Number(a.id)-Number(b.id));
matrix.sort((a,b)=>Number(a.nistrenia_osm_id)-Number(b.nistrenia_osm_id)||a.actual_id.localeCompare(b.actual_id));
const counts={};for(const m of matrix)counts[m.relation]=(counts[m.relation]||0)+1;
const summary={status:exceptions.length?'PARTIAL':'PASS',fetched_utc:new Date().toISOString(),root_osm_relation:65335,
 official_md_relation:2607033,actual_snapshot:topo.snapshot_id,actual_entity_count:byId.size,
 actual_md_count:md.size,geometry_files_verified:sourcePaths.length,osm_relations:inventory.length,
 osm_bytes_downloaded:transferred,geometry_pair_count:matrix.length,relations:counts,
 existing_osm_id_matches:inventory.filter(x=>x.existing_ACTUAL_MD).map(x=>x.id),
 unresolved:exceptions.length,exceptions,policy:'No repair/snapping/simplification. equal is DE-9IM topology, not byte identity; no inference of legal sovereignty.'};
await save('inventory.json',inventory);await save('matrix.json',matrix);await save('exceptions.json',exceptions);await save('summary.json',summary);
const csv=['nistrenia_osm_id,actual_id,actual_name,same_osm_id,relation,DE9IM,error'];
const quote=x=>'"'+String(x??'').replaceAll('"','""')+'"';
for(const m of matrix)csv.push([m.nistrenia_osm_id,m.actual_id,m.actual_name,m.same_osm_id,m.relation,m.DE9IM,m.error].map(quote).join(','));
await save('matrix.csv',csv.join('\n')+'\n');
console.log('P901_SUMMARY '+JSON.stringify(summary));
if(process.env.GITHUB_STEP_SUMMARY)await writeFile(process.env.GITHUB_STEP_SUMMARY,
 '### P9.0.1 read-only Nistrenia OSM audit\n'+
 'Status: **'+summary.status+'**; OSM relations: '+inventory.length+'; ACTUAL MD: '+md.size+
 '; matrix pairs: '+matrix.length+'; exceptions: '+exceptions.length+
 '\nTopological classes: '+JSON.stringify(counts)+'\n',{flag:'a'});
if(exceptions.length)process.exitCode=2;
