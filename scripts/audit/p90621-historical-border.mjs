// P9.0.6.2.1 — historical OSM way/node closure at the Geofabrik replication timestamp.
// Audit-only; no ACTUAL writes. For a currently unmodified element, its OSM
// version+timestamp <= cutoff is a proof that the element existed identically
// at the cutoff. For post-cutoff elements, fetch complete per-element history.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,appendFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import readline from 'node:readline';
import {createReadStream} from 'node:fs';
import RelateOp from 'jsts/org/locationtech/jts/operation/relate/RelateOp.js';
import {readTopologyGeometry} from '../lib/p82-topology.mjs';

const root=new URL('../../',import.meta.url),out=new URL('../../outputs/P9.0.6.2.1/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,root),'utf8'));
const scope=read('docs/p9.0.6.2-osm-audit-scope.json');
const previous=read('docs/p9.0.6.2-verified-evidence-ledger.json');
const ledger=new Map(previous.rows.map(x=>[x.osm_id,x]));
const missing=read('docs/p9.0.3-missing-relations.json');
const ids=missing.missing_relations.map(x=>String(x.id));
const cutoff='2026-10-12T20:21:35Z',end=Date.parse(cutoff);
const sha=x=>createHash('sha256').update(x).digest('hex');
const attr=(s,k)=>(s.match(new RegExp('(?:^|\\s)'+k+'="([^"]*)"'))||[])[1];
const unesc=s=>String(s||'').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const sleep=n=>new Promise(r=>setTimeout(r,n));
assert.equal(ids.length,84);assert.equal(new Set(ids).size,84);
assert.equal(previous.snapshot_261012.sha256,'4ebd791fb953a22961e40ef7921914251c7b7292c33ed1e90e919488f1a397b8');
assert(ids.every(id=>scope.relations.some(x=>x.id===id&&x.roles.includes('p903_crossborder_84'))));
const cutoffVersion=x=>x.timestamp&&Date.parse(x.timestamp)<=end;
function parse(xml){
 const nodes=new Map(),ways=new Map(),relations=new Map();
 for(const m of xml.matchAll(/<node\b([^>]*?)(?:\/>|>)/g)){
  const a=m[1],id=attr(a,'id'),lat=attr(a,'lat'),lon=attr(a,'lon');
  if(id&&lat!==undefined&&lon!==undefined)nodes.set(id,{id,type:'node',version:Number(attr(a,'version')),timestamp:attr(a,'timestamp'),lon:Number(lon),lat:Number(lat)});
 }
 for(const m of xml.matchAll(/<way\b([^>]*?)>([\s\S]*?)<\/way>/g)){
  const a=m[1],id=attr(a,'id');if(!id)continue;
  ways.set(id,{id,type:'way',version:Number(attr(a,'version')),timestamp:attr(a,'timestamp'),nodes:[...m[2].matchAll(/<nd\s+([^>]*?)\/>/g)].map(n=>attr(n[1],'ref'))});
 }
 for(const m of xml.matchAll(/<relation\b([^>]*?)>([\s\S]*?)<\/relation>/g)){
  const a=m[1],id=attr(a,'id');if(!id)continue;
  const members=[...m[2].matchAll(/<member\s+([^>]*?)\/>/g)].map(n=>({type:attr(n[1],'type'),ref:attr(n[1],'ref'),role:unesc(attr(n[1],'role'))}));
  const tags=Object.fromEntries([...m[2].matchAll(/<tag\s+([^>]*?)\/>/g)].map(n=>[unesc(attr(n[1],'k')),unesc(attr(n[1],'v'))]).sort(([a],[b])=>a.localeCompare(b)));
  relations.set(id,{id,type:'relation',version:Number(attr(a,'version')),timestamp:attr(a,'timestamp'),members,tags});
 }
 return {nodes,ways,relations};
}
const orderedMembersSha=r=>sha(JSON.stringify(r.members));
const tagsSha=r=>sha(JSON.stringify(r.tags));
function rings(members,role,ways,nodes){
 const pending=members.filter(x=>x.role===role).map(m=>{
  if(m.type!=='way')throw Error('nonway_'+role);
  const w=ways.get(m.ref);if(!w||w.nodes.length<2)throw Error('missing_member_way_'+m.ref);
  if(w.nodes.some(id=>!nodes.has(id)))throw Error('missing_member_node_'+m.ref);
  return w.nodes.slice();
 });
 const rings=[];
 while(pending.length){
  const seq=pending.pop();let guard=0;
  while(seq[0]!==seq.at(-1)){
   if(++guard>25000)throw Error('ring_join_limit');
   const i=pending.findIndex(s=>s[0]===seq.at(-1)||s.at(-1)===seq.at(-1));
   if(i<0)throw Error('open_ring_'+role+'_'+seq.at(-1));
   let next=pending.splice(i,1)[0];if(next.at(-1)===seq.at(-1))next=next.reverse();
   seq.push(...next.slice(1));
  }
  const coords=seq.map(id=>{const n=nodes.get(id);return [n.lon,n.lat]});
  if(coords.length<4||coords.some(p=>p.some(v=>!Number.isFinite(v))))throw Error('degenerate_ring');
  rings.push(coords);
 }
 return rings;
}
function inside(p,ring){
 let odd=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
 const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])odd=!odd;}
 return odd;
}
function geometry(rel,ways,nodes){
 const outer=rings(rel.members,'outer',ways,nodes),holes=rings(rel.members,'inner',ways,nodes);
 if(!outer.length)throw Error('no_outer_ring');
 const ps=outer.map(r=>[r]);
 for(const h of holes){const owner=ps.filter(p=>inside(h[0],p[0]));if(owner.length!==1)throw Error('ambiguous_inner_ring');owner[0].push(h);}
 return ps.length===1?{type:'Polygon',coordinates:ps[0]}:{type:'MultiPolygon',coordinates:ps};
}
function edgeHash(g){
 const ps=g.type==='Polygon'?[g.coordinates]:g.coordinates,es=[];
 for(const p of ps)for(const ring of p)for(let i=1;i<ring.length;i++){
  const canonical=v=>v.map(x=>Number(x).toFixed(7)).join(',');
  const a=canonical(ring[i-1]),b=canonical(ring[i]);es.push(a<b?a+'|'+b:b+'|'+a);
 }
 return sha(es.sort().join('\n'));
}
function relate(root,other){
 if(!root.getEnvelopeInternal().intersects(other.getEnvelopeInternal()))return {relation:'disjoint',method:'envelope_disjoint',DE9IM:null};
 const m=RelateOp.relate(root,other);
 return {relation:m.isDisjoint()?'disjoint':m.isEquals(2,2)?'equal':m.isCovers()?'root_contains':m.isCoveredBy()?'root_within':m.get(0,0)===2?'partial_overlap':m.get(1,1)===1?'boundary':'point',DE9IM:m.toString(),method:'JSTS_DE9IM'};
}
async function get(url){
 let last;
 for(let attempt=0;attempt<4;attempt++){
  for(const host of ['https://api.openstreetmap.org','https://www.openstreetmap.org']){
  try{
   const rsp=await fetch(host+url,{headers:{Accept:'application/xml','User-Agent':'ReformaAdmin-P90621-Historical-Osm-Audit/1.0'},signal:AbortSignal.timeout(100000)});
   if(!rsp.ok)throw Error('HTTP_'+rsp.status);
   const text=await rsp.text();if(!text.includes('</osm>'))throw Error('truncated_xml');return {url:host+url,xml:text,digest:sha(text),bytes:Buffer.byteLength(text)};
  }catch(e){last=String(e);}
  }
  if(attempt<3)await sleep(2200*(attempt+1));
 }
 throw Error('osm_read_failed '+url+' '+last);
}
let historyCalls=0;
const historyBudget=300;
const historyCache=new Map();
async function historic(type,id){
 const key=type+'/'+id;
 if(historyCache.has(key))return historyCache.get(key);
 if(++historyCalls>historyBudget)throw Error('history_request_budget_exceeded');
 const f=await get('/api/0.6/'+type+'/'+id+'/history');
 const parsed=parse(f.xml),data=type==='node'?parsed.nodes:parsed.ways;
 // NOTE: parse() Map would overwrite repeated versions; select via versioned XML fragments instead.
 const elems=[];
 const re=type==='node'?/<node\b([^>]*?)(?:\/>|>[\s\S]*?<\/node>)/g:/<way\b([^>]*?)>([\s\S]*?)<\/way>/g;
 for(const m of f.xml.matchAll(re)){
  const a=m[1],oid=attr(a,'id'),v=Number(attr(a,'version')),timestamp=attr(a,'timestamp');
  if(oid!==id||!timestamp||Date.parse(timestamp)>end)continue;
  if(type==='node'){
   const lon=attr(a,'lon'),lat=attr(a,'lat');
   if(lon!==undefined&&lat!==undefined)elems.push({id,type,version:v,timestamp,lon:Number(lon),lat:Number(lat)});
  }else elems.push({id,type,version:v,timestamp,nodes:[...(m[2]||'').matchAll(/<nd\s+([^>]*?)\/>/g)].map(x=>attr(x[1],'ref'))});
 }
 elems.sort((a,b)=>b.version-a.version);
 if(!elems.length)throw Error('historical_'+type+'_not_found_at_cutoff_'+id);
 const res={element:elems[0],source_url:f.url,history_sha256:f.digest};
 historyCache.set(key,res);await sleep(260);return res;
}
async function reconstruct(rel,p){
 if(!cutoffVersion(rel))throw Error('relation_after_cutoff_cannot_use_current_members');
 const included=rel.members.filter(x=>['outer','inner'].includes(x.role));
 if(included.some(x=>x.type!=='way'))throw Error('nested_boundary_members_needing_history');
 const wayIds=[...new Set(included.map(x=>x.ref))],ways=new Map(),nodes=new Map(),recovered=[];
 for(const id of wayIds){
  let obj=p.ways.get(id);if(!obj)throw Error('missing_live_way_'+id);
  if(!cutoffVersion(obj)){
   const h=await historic('way',id);obj=h.element;recovered.push({type:'way',id,current_version:p.ways.get(id).version,asof_version:obj.version,asof_timestamp:obj.timestamp,history_sha256:h.history_sha256});
  }
  ways.set(id,obj);
 }
 const nodeIds=[...new Set([...ways.values()].flatMap(w=>w.nodes))];
 for(const id of nodeIds){
  let obj=p.nodes.get(id);
  if(!obj||!cutoffVersion(obj)){
   const h=await historic('node',id);obj=h.element;recovered.push({type:'node',id,current_version:p.nodes.get(id)?.version??null,asof_version:obj.version,asof_timestamp:obj.timestamp,history_sha256:h.history_sha256});
  }
  nodes.set(id,obj);
 }
 const versionedWays=[...ways.values()].sort((a,b)=>Number(a.id)-Number(b.id)).map(w=>[w.id,w.version,w.timestamp,w.nodes]);
 const versionedNodes=[...nodes.values()].sort((a,b)=>Number(a.id)-Number(b.id)).map(n=>[n.id,n.version,n.timestamp,n.lon,n.lat]);
 return {geometry:geometry(rel,ways,nodes),ways:ways.size,nodes:nodes.size,recovered,way_version_sha256:sha(JSON.stringify(versionedWays)),node_version_coordinate_sha256:sha(JSON.stringify(versionedNodes))};
}
async function pinnedRoot(){
 const p=new URL('outputs/P9.0.6.2.1/input/pinned-root.geojsonseq',root);
 const reader=readline.createInterface({input:createReadStream(p),crlfDelay:Infinity});
 for await (let line of reader){
  line=line.replace(/^\x1e/,'').trim();if(!line)continue;
  const f=JSON.parse(line);if(f.properties?.['@type']==='relation'&&String(f.properties?.['@id'])==='65335'){
   assert.equal(sha(JSON.stringify(f.geometry)),ledger.get('65335').source_polygon_261012_sha256);
   return f.geometry;
  }
 }throw Error('pinned_261012_root_polygon_missing');
}
if(process.argv.includes('--self-test')){
 const sample='<osm><node id="1" version="1" timestamp="2026-08-01T00:00:00Z" lon="0" lat="0"/><node id="2" version="1" timestamp="2026-08-01T00:00:00Z" lon="1" lat="0"/><node id="3" version="1" timestamp="2026-08-01T00:00:00Z" lon="1" lat="1"/><way id="5" version="3" timestamp="2026-10-01T00:00:00Z"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="1"/></way><relation id="9" version="2" timestamp="2026-10-01T00:00:00Z"><member type="way" ref="5" role="outer"/></relation></osm>';
 const p=parse(sample),g=geometry(p.relations.get('9'),p.ways,p.nodes);
 assert.equal(g.type,'Polygon');assert.equal(g.coordinates[0].length,4);assert(cutoffVersion(p.ways.get('5')));
 assert(!cutoffVersion({...p.ways.get('5'),timestamp:'2026-10-13T00:00:00Z'}));
 assert.equal(relate(readTopologyGeometry(g),readTopologyGeometry(g)).relation,'equal');
 console.log('P90621_HISTORICAL_GEOMETRY_SELF_TEST PASS');process.exit(0);
}
if(!process.argv.includes('--historical'))throw Error('use --historical');
const baseGeo=await pinnedRoot(),rootGeometry=readTopologyGeometry(baseGeo);
mkdirSync(out,{recursive:true});const rows=[];
const output=(name,value)=>writeFileSync(new URL(name,out),JSON.stringify(value,null,2)+'\n');
for(const [i,id]of ids.entries()){
 const ref=ledger.get(id),row={osm_id:id,status:'UNRESOLVED',reference_relation_version:ref?.relation_version_261012??null,source_cutoff:cutoff,historical_geometry_status:'NOT_PROVEN',historical_spatial:null};
 try{
  if(!ref)throw Error('missing_p9062_ledger');
  const f=await get('/api/0.6/relation/'+id+'/full'),p=parse(f.xml),rel=p.relations.get(id);
  if(!rel)throw Error('missing_relation_in_full');
  row.osm_full_sha256=f.digest;row.osm_full_bytes=f.bytes;row.live_relation_version=rel.version;
  row.live_relation_timestamp=rel.timestamp;
  if(rel.version!==ref.relation_version_261012||orderedMembersSha(rel)!==ref.ordered_members_sha256||tagsSha(rel)!==ref.tags_sha256)throw Error('historical_vs_live_relation_metadata_drift');
  const historical=await reconstruct(rel,p),g=readTopologyGeometry(historical.geometry);
  row.historical_geometry_status='PROVEN_AS_OF_CUTOFF_BY_VERSION_TIMESTAMPS';
  row.status='RESOLVED';row.asof_ways=historical.ways;row.asof_nodes=historical.nodes;
  row.recovered_historical_elements=historical.recovered;
  row.asof_way_version_sha256=historical.way_version_sha256;
  row.asof_node_version_coordinate_sha256=historical.node_version_coordinate_sha256;
  row.asof_polygon_edge_sha256=edgeHash(historical.geometry);
  row.live_polygon_edge_sha256=ref.live_polygon_edges_sha256;
  row.asof_edges_match_live=row.asof_polygon_edge_sha256===ref.live_polygon_edges_sha256;
  row.historical_spatial=relate(rootGeometry,g);
 }catch(e){row.status='UNRESOLVED';row.reason=String(e);}
 rows.push(row);appendFileSync(new URL('progress.jsonl',out),JSON.stringify(row)+'\n');
 console.log('P90621_CASE',i+1,'/',ids.length,id,row.status,row.historical_spatial?.relation??row.reason);
 await sleep(430);
}
const counts={
 scope:84,unique:new Set(rows.map(r=>r.osm_id)).size,verified:rows.filter(r=>r.status==='RESOLVED').length,
 unresolved:rows.filter(r=>r.status==='UNRESOLVED').length,
 edge_matches:rows.filter(r=>r.asof_edges_match_live===true).length,
 edge_differences:rows.filter(r=>r.asof_edges_match_live===false).length,
 recovered_history_requests:historyCalls,
 recovered_elements:rows.reduce((n,r)=>n+(r.recovered_historical_elements?.length||0),0),
 spatial:Object.fromEntries([...new Set(rows.map(r=>r.historical_spatial?.relation||'unresolved'))].sort().map(k=>[k,rows.filter(r=>(r.historical_spatial?.relation||'unresolved')===k).length]))
};
const full=counts.verified===84&&counts.unique===84&&counts.spatial.disjoint===65&&counts.spatial.boundary===19&&counts.edge_differences===0;
const summary={schema_version:'p90621-historical-way-node-topology-v1',audit_only:true,p91_import_allowed:false,as_of:cutoff,reference_261012_sha256:previous.snapshot_261012.sha256,reference_root_edge_sha256:ledger.get('65335').live_polygon_edges_sha256,scope_84_provenance:'docs/p9.0.3-missing-relations.json',counts,status:full?'PASS':'PARTIAL',semantic_acceptance:'BLOCKED_INCOMPLETE',note:'Historical evidence is reconstructed from version/timestamp of every referenced way and node, with history API recovery only when a latest component changed after the cutoff. Topology checked using PBF 12Oct root. This is not administrative membership proof.'};
output('records.json',rows);output('summary.json',summary);
console.log('P90621_SUMMARY',JSON.stringify(summary));
if(!full)process.exitCode=2;
