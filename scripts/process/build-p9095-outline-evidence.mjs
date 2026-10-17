// P9.0.9.5 — one-time capture of eight independent OSM boundary relations.
// NO ACTUAL writes, no inferred union/bbox geometry, never a legal P9.1 promotion.
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
const ids=[65335,1702216,1702217,1702215,1702214,1702219,1702218,944727];
const root=resolve(new URL('../../',import.meta.url).pathname);
const relId=id=>id===65335?'view-nistrenia':'view-nistrenia-group-osm-r'+id;
const sha=x=>createHash('sha256').update(x).digest('hex');
const attr=(x,k)=>(x.match(new RegExp('(?:^|\\s)'+k+'="([^"]*)"'))||[])[1];
function parse(xml,id){
 const nodes=new Map(),ways=new Map(),rels=new Map();
 for(const m of xml.matchAll(/<node\b([^>]*?)(?:\/>|>)/g)){
  const a=m[1],n=attr(a,'id'),lon=attr(a,'lon'),lat=attr(a,'lat');
  if(n&&lon!==undefined&&lat!==undefined)nodes.set(n,[Number(lon),Number(lat)]);
 }
 for(const m of xml.matchAll(/<way\b([^>]*?)>([\s\S]*?)<\/way>/g)){
  ways.set(attr(m[1],'id'),[...m[2].matchAll(/<nd\s+([^>]*?)\/>/g)].map(n=>attr(n[1],'ref')));
 }
 for(const m of xml.matchAll(/<relation\b([^>]*?)>([\s\S]*?)<\/relation>/g)){
  const a=m[1],k=attr(a,'id');
  const members=[...m[2].matchAll(/<member\s+([^>]*?)\/>/g)].map(n=>({type:attr(n[1],'type'),ref:attr(n[1],'ref'),role:attr(n[1],'role')||''}));
  const tags=Object.fromEntries([...m[2].matchAll(/<tag\s+([^>]*?)\/>/g)].map(n=>[attr(n[1],'k'),attr(n[1],'v')]));
  rels.set(k,{version:Number(attr(a,'version')),timestamp:attr(a,'timestamp'),members,tags});
 }
 const rel=rels.get(String(id));if(!rel)throw Error('relation absent '+id);
 if(rel.tags.boundary!=='administrative'||!['boundary','multipolygon'].includes(rel.tags.type))throw Error('unverified OSM administrative boundary '+id);
 if(!rel.members.some(m=>m.role==='outer'))throw Error('missing outer ways '+id);
 return {nodes,ways,rel};
}
function ringCollection(members,role,ways,nodes,id){
 const pending=members.filter(m=>m.role===role).map(m=>{
  if(m.type!=='way'||!ways.has(m.ref))throw Error('incomplete '+role+' member '+id+' '+m.ref);
  const ns=ways.get(m.ref);
  if(ns.length<2||ns.some(n=>!nodes.has(n)))throw Error('incomplete '+role+' member nodes '+id+' '+m.ref);
  return ns.slice();
 });
 const out=[];
 while(pending.length){
  const seq=pending.pop();let loops=0;
  while(seq[0]!==seq.at(-1)){
   if(++loops>40000)throw Error('join limit '+id);
   const i=pending.findIndex(n=>n[0]===seq.at(-1)||n.at(-1)===seq.at(-1));
   if(i<0)throw Error('unclosed '+role+' ring '+id+' '+seq.at(-1));
   let next=pending.splice(i,1)[0];
   if(next.at(-1)===seq.at(-1))next=next.reverse();
   seq.push(...next.slice(1));
  }
  const coords=seq.map(n=>nodes.get(n));
  if(coords.length<4||coords[0][0]!==coords.at(-1)[0]||coords[0][1]!==coords.at(-1)[1])throw Error('invalid closed geometry '+id);
  out.push(coords);
 }
 return out;
}
function inside(point,polygon){
 let odd=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const a=polygon[i],b=polygon[j];
  if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])odd=!odd;
 }return odd;
}
function shape({nodes,ways,rel},id){
 const outer=ringCollection(rel.members,'outer',ways,nodes,id);
 const holes=ringCollection(rel.members,'inner',ways,nodes,id);
 if(!outer.length)throw Error('empty polygon '+id);
 const polys=outer.map(r=>[r]);
 for(const hole of holes){const ps=polys.filter(p=>inside(hole[0],p[0]));if(ps.length!==1)throw Error('hole not uniquely enclosed '+id);ps[0].push(hole);}
 return polys.length===1?{type:'Polygon',coordinates:polys[0]}:{type:'MultiPolygon',coordinates:polys};
}
function geometryAudit(geometry){
 const polys=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
 const coords=polys.flat(2),xs=coords.map(p=>p[0]),ys=coords.map(p=>p[1]);
 if(!coords.length||coords.some(p=>p.length!==2||!p.every(Number.isFinite)||p[0]<25||p[0]>32||p[1]<45||p[1]>50))throw Error('out-of-area coordinates');
 const edges=[];
 for(const poly of polys)for(const ring of poly){
  if(ring.length<4)throw Error('short ring');
  for(let i=1;i<ring.length;i++){
   const a=ring[i-1].map(x=>x.toFixed(7)).join(','),b=ring[i].map(x=>x.toFixed(7)).join(',');
   edges.push(a<b?a+'|'+b:b+'|'+a);
  }
 }
 return {bbox:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)],rings:polys.reduce((n,p)=>n+p.length,0),vertices:coords.length,edges_sha256:sha(edges.sort().join('\n'))};
}
async function live(id){
 let error;
 for(let attempt=0;attempt<3;attempt++)for(const host of ['https://api.openstreetmap.org','https://www.openstreetmap.org']){
  const url=host+'/api/0.6/relation/'+id+'/full';
  try{const resp=await fetch(url,{headers:{Accept:'application/xml','User-Agent':'ReformaAdmin-P9095-Source-Evidence/1.0'},signal:AbortSignal.timeout(85000)});
   if(!resp.ok)throw Error('HTTP '+resp.status);
   const xml=await resp.text();
   if(!xml.includes('</osm>'))throw Error('truncated XML');
   return {url,xml};
  }catch(e){error=e;console.error('RETRY',id,attempt,String(e));}
 }
 throw Error('OSM relation '+id+' failed '+String(error));
}
function auditPackage(geo,proof){
 if(geo.type!=='FeatureCollection'||geo.features.length!==8||proof.relations.length!==8)throw Error('invalid eight-outline count');
 if(new Set(geo.features.map(f=>f.id)).size!==8)throw Error('duplicate outline ids');
 for(let i=0;i<8;i++){
  const feature=geo.features[i],p=proof.relations[i];
  if(feature.id!==relId(ids[i])||feature.properties.osm_relation_id!==ids[i]||p.id!==feature.id)throw Error('incorrect source relation binding '+ids[i]);
  const a=geometryAudit(feature.geometry);if(a.edges_sha256!==p.edges_sha256||a.vertices!==p.vertices)throw Error('geometry proof mismatch '+ids[i]);
 }
 return true;
}
function upload(path,content){
 // Only isolated reviewed UI overlay paths can be published; never touch public/data/actual*, data/current or public/geo/actual.
 if(!/^public\/data\/p9095-osm-outlines(?:-manifest)?\.json$/.test(path))throw Error('write outside P9.0.9.5 whitelist');
 const repo=process.env.P9095_REPO||'ovidiudeica/reforma-teritoriala';
 const branch=process.env.P9095_BRANCH||'feat/p9.0.9.5-nistrenia-outline-parity';
 if(!/^feat\/p9\.0\.9\.5-/.test(branch))throw Error('refuse write outside isolated branch');
 const payload=JSON.stringify({message:'P9.0.9.5 pin source-only OSM outline evidence '+path,content:Buffer.from(content).toString('base64'),branch});
 const file=resolve(process.env.TEMP||'.','p9095-gh-upload-'+path.split('/').at(-1)+'.json');
 writeFileSync(file,payload);
 const response=execFileSync('gh',['api','--method','PUT','repos/'+repo+'/contents/'+path,'--input',file],{encoding:'utf8',maxBuffer:1024*1024*4});
 return JSON.parse(response).commit.sha;
}
if(process.argv.includes('--self-test')){
 const xml='<osm><node id="1" lat="46" lon="29"/><node id="2" lat="46" lon="30"/><node id="3" lat="47" lon="30"/><way id="8"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="1"/></way><relation id="65335" version="1" timestamp="2026-10-12T20:21:35Z"><member type="way" ref="8" role="outer"/><tag k="type" v="boundary"/><tag k="boundary" v="administrative"/></relation></osm>';
 const a=parse(xml,65335),s=shape(a,65335),g=geometryAudit(s);
 if(g.vertices!==4||g.rings!==1||g.edges_sha256.length!==64)throw Error('self-test failed');
 console.log('P9095_OUTLINE_SELFTEST_PASS');process.exit(0);
}
if(!process.argv.includes('--capture'))throw Error('use --self-test or --capture');
const capturedAt=new Date().toISOString(),features=[],rows=[];
for(const [index,id]of ids.entries()){
 const capture=await live(id),p=parse(capture.xml,id),geom=shape(p,id),audit=geometryAudit(geom);
 if(audit.vertices>100000)throw Error('unexpectedly huge outline '+id);
 const virtualId=relId(id);
 const feature={type:'Feature',id:virtualId,properties:{entity_id:virtualId,osm_relation_id:id,osm_version:p.rel.version,osm_timestamp:p.rel.timestamp,source:'OpenStreetMap relation /full',jurisdiction:'NI',view_only:true,legal_certified:false},geometry:geom};
 features.push(feature);
 rows.push({id:virtualId,osm_relation_id:id,relation_version:p.rel.version,relation_timestamp:p.rel.timestamp,source_url:capture.url,source_xml_sha256:sha(capture.xml),source_xml_bytes:Buffer.byteLength(capture.xml),member_count:p.rel.members.length,members_sha256:sha(JSON.stringify(p.rel.members)),way_objects:p.ways.size,node_objects:p.nodes.size,...audit});
 console.log('P9095_CAPTURE',index+1,'/8',id,'version',p.rel.version,'vertices',audit.vertices,'rings',audit.rings);
 await new Promise(resolve=>setTimeout(resolve,350));
}
const geo={type:'FeatureCollection',metadata:{contract:'p9095-osm-independent-outlines-v1',osm_attribution:'© OpenStreetMap contributors, ODbL',source_relation_count:8,legal_parent_mutation:false,actual_mutation:false,p91_import_allowed:false,semantic_acceptance:'BLOCKED_INCOMPLETE'},features};
const json=JSON.stringify(geo)+'\n';
const manifest={schema:'p9095-osm-independent-outlines-proof-v1',captured_at_utc:capturedAt,source:'OSM relation/id/full',source_atomic_snapshot:false,osm_attribution:'© OpenStreetMap contributors, ODbL',file:'public/data/p9095-osm-outlines.json',file_sha256:sha(json),relation_count:8,actual_geometry_untouched:true,actual_catalog_untouched:true,p91_import_allowed:false,semantic_acceptance:'BLOCKED_INCOMPLETE',relations:rows};
auditPackage(geo,manifest);
console.log('P9095_OUTLINES_READY',JSON.stringify({bytes:Buffer.byteLength(json),sha256:manifest.file_sha256,ids:rows.map(x=>x.osm_relation_id),versions:rows.map(x=>x.relation_version)}));
if(process.argv.includes('--upload')){
 const c1=upload('public/data/p9095-osm-outlines.json',json);
 const c2=upload('public/data/p9095-osm-outlines-manifest.json',JSON.stringify(manifest,null,2)+'\n');
 console.log('P9095_UPLOAD_SUCCESS',JSON.stringify({geometry_commit:c1,manifest_commit:c2}));
}else{
 const folder=resolve(process.env.TEMP||'.','p9095-evidence');mkdirSync(folder,{recursive:true});
 writeFileSync(resolve(folder,'p9095-osm-outlines.json'),json);
 writeFileSync(resolve(folder,'p9095-osm-outlines-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log('P9095_LOCAL_ONLY',folder);
}
