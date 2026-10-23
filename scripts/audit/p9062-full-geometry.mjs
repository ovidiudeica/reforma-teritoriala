// P9.0.6.2 live /full closure: compare full way/node polygons to frozen PBF geometries.
import assert from 'node:assert/strict';
import {readFileSync,createReadStream,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import readline from 'node:readline';
import RelateOp from 'jsts/org/locationtech/jts/operation/relate/RelateOp.js';
import {readTopologyGeometry} from '../lib/p82-topology.mjs';
import {osmRelationFullUrl} from './helpers/audit-io-boundaries.mjs';
const root=new URL('../../',import.meta.url),out=new URL('../../outputs/P9.0.6.2/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,root),'utf8'));
const sha=x=>createHash('sha256').update(x).digest('hex');
const attr=(s,k)=>(s.match(new RegExp('(?:^|\\s)'+k+'="([^"]*)"'))||[])[1];
const wait=n=>new Promise(r=>setTimeout(r,n));
const records=read('outputs/P9.0.6.2/records.json'),expected=new Map(records.map(x=>[x.osm_id,x]));
const unesc=s=>String(s).replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
function parse(xml){
 const nodes=new Map(),ways=new Map(),rels=new Map();
 for(const x of xml.matchAll(/<node\b([^>]*?)\/?>/g)){
  const id=attr(x[1],'id'),lon=attr(x[1],'lon'),lat=attr(x[1],'lat');if(id&&lon!==undefined&&lat!==undefined)nodes.set(id,[Number(lon),Number(lat)]);
 }
 for(const x of xml.matchAll(/<way\b([^>]*?)>([\s\S]*?)<\/way>/g)){
  const id=attr(x[1],'id');if(!id)continue;
  ways.set(id,[...x[2].matchAll(/<nd\s+([^>]*?)\/>/g)].map(y=>attr(y[1],'ref')));
 }
 for(const x of xml.matchAll(/<relation\b([^>]*?)>([\s\S]*?)<\/relation>/g)){
  const id=attr(x[1],'id');if(!id)continue;
  const members=[...x[2].matchAll(/<member\s+([^>]*?)\/>/g)].map(y=>({type:attr(y[1],'type'),ref:attr(y[1],'ref'),role:unesc(attr(y[1],'role')||'')}));
  const tags=Object.fromEntries([...x[2].matchAll(/<tag\s+([^>]*?)\/>/g)].map(y=>[unesc(attr(y[1],'k')),unesc(attr(y[1],'v'))]).sort(([a],[b])=>a.localeCompare(b)));
  rels.set(id,{version:Number(attr(x[1],'version')),timestamp:attr(x[1],'timestamp')||null,members,members_sha256:sha(JSON.stringify(members)),tags_sha256:sha(JSON.stringify(tags))});
 }
 return {nodes,ways,rels};
}
function ring(members,role,ways,nodes){
 const pending=members.filter(x=>x.role===role).map(m=>({id:m.ref,type:m.type,seq:ways.get(m.ref)}));
 if(pending.some(x=>x.type!=='way'||!x.seq||x.seq.length<2||x.seq.some(id=>!nodes.has(id))))throw Error('incomplete_'+role+'_way_or_node_closure');
 const rings=[];
 while(pending.length){
  const s=pending.pop().seq.slice();let loops=0;
  while(s[0]!==s.at(-1)){
   if(++loops>25000)throw Error('ring_join_limit_'+role);
   const pos=pending.findIndex(w=>w.seq[0]===s.at(-1)||w.seq.at(-1)===s.at(-1));
   if(pos<0)throw Error('open_ring_'+role);
   let n=pending.splice(pos,1)[0].seq;
   if(n.at(-1)===s.at(-1))n=n.slice().reverse();
   s.push(...n.slice(1));
  }
  if(s.length<4)throw Error('degenerate_ring_'+role);
  rings.push(s.map(id=>nodes.get(id)));
 }
 return rings;
}
function inside(p,r){
 let odd=false;for(let i=0,j=r.length-1;i<r.length;j=i++){
 const a=r[i],b=r[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])odd=!odd;}return odd;
}
function geometry(relation,ways,nodes){
 const outer=ring(relation.members,'outer',ways,nodes),holes=ring(relation.members,'inner',ways,nodes);
 if(!outer.length)throw Error('no_outer_ring');
 const ps=outer.map(r=>[r]);
 for(const h of holes){const match=ps.filter(p=>inside(h[0],p[0]));if(match.length!==1)throw Error('ambiguous_inner');match[0].push(h);}
 return ps.length===1?{type:'Polygon',coordinates:ps[0]}:{type:'MultiPolygon',coordinates:ps};
}
function edgessha(geometry){
 const ps=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
 const es=[];
 for(const poly of ps)for(const r of poly)for(let i=1;i<r.length;i++){
  const fmt=p=>p.map(v=>Number(v).toFixed(7)).join(',');
  const a=fmt(r[i-1]),b=fmt(r[i]);es.push(a<b?a+'|'+b:b+'|'+a);
 }
 return sha(es.sort().join('\n'));
}
async function sourceGeom(){
 const m=new Map(),stream=readline.createInterface({input:createReadStream(new URL('outputs/P9.0.6.2/input/geometry-261012.geojsonseq',root)),crlfDelay:Infinity});
 for await(let line of stream){line=line.replace(/^\x1e/,'').trim();if(!line)continue;const f=JSON.parse(line),id=String(f.properties?.['@id']??'');if(expected.has(id)&&f.properties?.['@type']==='relation'&&f.geometry&&['Polygon','MultiPolygon'].includes(f.geometry.type))m.set(id,f.geometry);}
 return m;
}
async function getFull(id){
 let err;for(let attempt=0;attempt<3;attempt++)for(const mirror of [false,true]){
  const url=osmRelationFullUrl(id,mirror);
  try{
   const rsp=await fetch(url,{headers:{Accept:'application/xml','User-Agent':'ReformaAdmin-P9062-FullGeometry-Evidence/1.0'},signal:AbortSignal.timeout(100000)});
   if(!rsp.ok)throw Error('HTTP_'+rsp.status);
   const xml=await rsp.text();if(!xml.includes('</osm>'))throw Error('truncated_xml');
   return {url,xml,bytes:Buffer.byteLength(xml),sha256:sha(xml)};
  }catch(e){err=String(e);}
 }throw Error(err||'unavailable');
}
if(process.argv.includes('--self-test')){
 const data=parse('<osm><node id="1" lon="0" lat="0"/><node id="2" lon="1" lat="0"/><node id="3" lon="1" lat="1"/><way id="8"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="1"/></way><relation id="65335" version="1"><member type="way" ref="8" role="outer"/></relation></osm>');
 const g=geometry(data.rels.get('65335'),data.ways,data.nodes);
 assert.equal(g.type,'Polygon');assert.equal(edgessha(g),edgessha(g));
 console.log('P9062_FULL_GEOMETRY_SELF_TEST PASS');process.exit(0);
}
if(!process.argv.includes('--compare-full'))throw Error('expected --compare-full');
const refGeom=await sourceGeom(),audits=[],rootId='65335';const captures=new Map();
for(const [i,record]of records.entries()){
 const id=record.osm_id,row={osm_id:id,roles:record.roles,status:'UNVERIFIED',matched_bulk_relation_metadata:null,live_polygon_valid:false,full_response:null,reference_pbf_polygon_available:refGeom.has(id),exact_edge_equality_261012:null,topological_equality_261012:null,comparison_status:'NOT_ASSESSED'};
 try{
  const response=await getFull(id);const parsed=parse(response.xml),rel=parsed.rels.get(id);
  if(!rel)throw Error('requested_relation_not_returned');
  row.full_response={url:response.url,sha256:response.sha256,bytes:response.bytes,version:rel.version,timestamp:rel.timestamp,way_objects:parsed.ways.size,node_objects:parsed.nodes.size};
  row.matched_bulk_relation_metadata=rel.version===record.live_api?.version&&rel.members_sha256===record.live_api?.members_sha256&&rel.tags_sha256===record.live_api?.tags_sha256;
  const raw=geometry(rel,parsed.ways,parsed.nodes),g=readTopologyGeometry(raw);row.live_polygon_valid=Boolean(g);
  row.live_polygon_edge_sha256=edgessha(raw);
  if(refGeom.has(id)){
   const old=refGeom.get(id),same=row.live_polygon_edge_sha256===edgessha(old);
   row.exact_edge_equality_261012=same;
   if(same){row.topological_equality_261012=true;row.comparison_status='EXACT_POLYGON_EDGES_261012_TO_LIVE';}
   else{
    const equal=RelateOp.relate(readTopologyGeometry(old),g).isEquals(2,2);
    row.topological_equality_261012=equal;row.comparison_status=equal?'TOPOLOGY_EQUAL_BUT_SEGMENTS_CHANGED':'LIVE_POLYGON_TOPOLOGY_CHANGED';
   }
  }else{
   row.comparison_status='FULL_LIVE_POLYGON_AVAILABLE_BUT_261012_EXTRACT_CLIPPED';
  }
  row.status='RESOLVED';if(id===rootId)captures.set(rootId,raw);
 }catch(e){row.status='ERROR';row.error=String(e);row.comparison_status='LIVE_FULL_SOURCE_OR_GEOMETRY_ERROR';}
 audits.push(row);
 console.log('P9062_FULL_CASE',i+1,'/',records.length,id,row.comparison_status);
 await wait(450);
}
const tally=fn=>Object.fromEntries([...new Set(audits.map(fn))].sort().map(k=>[k,audits.filter(x=>fn(x)===k).length]));
const checks={schema_version:'p9062-live-full-geometry-audit-v1',audit_only:true,records:audits.length,complete:audits.filter(x=>x.status==='RESOLVED').length,errors:audits.filter(x=>x.status==='ERROR').length,relation_metadata_matches:audits.filter(x=>x.matched_bulk_relation_metadata===true).length,comparison:tally(x=>x.comparison_status),time_completed:new Date().toISOString(),summary:'Reference snapshot 261012 is region-clipped for 84 cross-border objects; a full live geometry is not the same as a complete 2026-10-12 historical polygon.',p91_import_allowed:false};
writeFileSync(new URL('full-live-records.json',out),JSON.stringify(audits,null,2)+'\n');
writeFileSync(new URL('full-live-summary.json',out),JSON.stringify(checks,null,2)+'\n');
console.log('P9062_LIVE_FULL_SUMMARY',JSON.stringify(checks));
if(checks.errors>0||checks.records!==177)process.exitCode=2;
