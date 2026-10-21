// P9.0.7.2.18 — read-only live OSM way/node closure against pinned 12 Oct 2026.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import RelateOp from 'jsts/org/locationtech/jts/operation/relate/RelateOp.js';
import {readTopologyGeometry} from '../lib/p82-topology.mjs';

const read=p=>JSON.parse(readFileSync(new URL('../../'+p,import.meta.url),'utf8'));
const sha=x=>createHash('sha256').update(x).digest('hex');
const cutoff='2026-10-12T20:21:35Z',cutoffMs=Date.parse(cutoff);
const pbf='4ebd791fb953a22961e40ef7921914251c7b7292c33ed1e90e919488f1a397b8';
const mdFiles=['public/geo/actual/md-overview.geojson','public/geo/actual/md-local.geojson','public/geo/actual/md-detail.geojson'];
const sleep=n=>new Promise(r=>setTimeout(r,n));
const attr=(s,k)=>(s.match(new RegExp('(?:^|\\s)'+k+'="([^"]*)"'))||[])[1];
const unesc=s=>String(s??'').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const sorted=o=>Object.fromEntries(Object.entries(o).sort(([a],[b])=>a.localeCompare(b)));

export function parseFull(xml){
 if(!xml.includes('<osm')||!xml.includes('</osm>'))throw Error('truncated_OSM_XML');
 const nodes=new Map(),ways=new Map(),relations=new Map();
 for(const m of xml.matchAll(/<node\b([^>]*?)(?:\/>|>)/g)){
  const a=m[1],id=attr(a,'id'),lat=attr(a,'lat'),lon=attr(a,'lon');
  if(!id||lat===undefined||lon===undefined)continue;
  if(nodes.has(id))throw Error('duplicate_node_'+id);
  nodes.set(id,{id,version:Number(attr(a,'version')),timestamp:attr(a,'timestamp'),lat:Number(lat),lon:Number(lon)});
 }
 for(const m of xml.matchAll(/<way\b([^>]*?)>([\s\S]*?)<\/way>/g)){
  const a=m[1],id=attr(a,'id');if(!id)continue;
  if(ways.has(id))throw Error('duplicate_way_'+id);
  ways.set(id,{id,version:Number(attr(a,'version')),timestamp:attr(a,'timestamp'),
   nodes:[...m[2].matchAll(/<nd\s+([^>]*?)\/>/g)].map(x=>attr(x[1],'ref'))});
 }
 for(const m of xml.matchAll(/<relation\b([^>]*?)>([\s\S]*?)<\/relation>/g)){
  const a=m[1],id=attr(a,'id');if(!id)continue;
  if(relations.has(id))throw Error('duplicate_relation_'+id);
  const members=[...m[2].matchAll(/<member\s+([^>]*?)\/>/g)].map(x=>({type:attr(x[1],'type'),ref:attr(x[1],'ref'),role:unesc(attr(x[1],'role'))}));
  const tags=sorted(Object.fromEntries([...m[2].matchAll(/<tag\s+([^>]*?)\/>/g)].map(x=>[unesc(attr(x[1],'k')),unesc(attr(x[1],'v'))])));
  relations.set(id,{id,version:Number(attr(a,'version')),timestamp:attr(a,'timestamp'),members,tags});
 }
 return {nodes,ways,relations};
}
function rings(members,role,ways,nodes){
 const pending=members.filter(x=>x.role===role).map(m=>{
  if(m.type!=='way')throw Error('non_way_'+role);
  const w=ways.get(m.ref);
  if(!w||w.nodes.length<2||w.nodes.some(id=>!nodes.has(id)))throw Error('incomplete_way_node_closure_'+m.ref);
  return w.nodes.slice();
 });
 const result=[];
 while(pending.length){
  const seq=pending.pop();let counter=0;
  while(seq[0]!==seq.at(-1)){
   if(++counter>25000)throw Error('ring_join_limit');
   const idx=pending.findIndex(x=>x[0]===seq.at(-1)||x.at(-1)===seq.at(-1));
   if(idx<0)throw Error('open_ring_'+role);
   let next=pending.splice(idx,1)[0];if(next.at(-1)===seq.at(-1))next=next.reverse();
   seq.push(...next.slice(1));
  }
  if(seq.length<4)throw Error('degenerate_ring');
  result.push(seq.map(id=>[nodes.get(id).lon,nodes.get(id).lat]));
 }
 return result;
}
function inside(p,r){
 let odd=false;
 for(let i=0,j=r.length-1;i<r.length;j=i++){
  const a=r[i],b=r[j];
  if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])odd=!odd;
 }return odd;
}
export function polygon(rel,ways,nodes){
 const outer=rings(rel.members,'outer',ways,nodes),holes=rings(rel.members,'inner',ways,nodes);
 if(!outer.length)throw Error('no_outer_ring');
 const polys=outer.map(x=>[x]);
 for(const h of holes){const owners=polys.filter(p=>inside(h[0],p[0]));if(owners.length!==1)throw Error('ambiguous_inner_ring');owners[0].push(h);}
 return polys.length===1?{type:'Polygon',coordinates:polys[0]}:{type:'MultiPolygon',coordinates:polys};
}
export function segments(g){
 assert(['Polygon','MultiPolygon'].includes(g?.type));
 const polys=g.type==='Polygon'?[g.coordinates]:g.coordinates,lines=[];
 for(const poly of polys)for(const ring of poly){
  assert(ring.length>=4,'short_ring');assert.deepEqual(ring[0],ring.at(-1),'open_ring');
  const point=p=>{assert(p.length===2&&p.every(Number.isFinite),'invalid_coordinate');return p.map(v=>Number(v).toFixed(7)).join(',')};
  for(let i=1;i<ring.length;i++){
   const a=point(ring[i-1]),b=point(ring[i]);assert.notEqual(a,b,'zero_edge');
   lines.push(a<b?a+'|'+b:b+'|'+a);
  }
 }
 lines.sort();return {digest:sha(lines.join('\n')),lines};
}
function segmentDiff(ref,cur){
 let i=0,j=0,removed=0,added=0;const a=[],b=[];
 while(i<ref.length||j<cur.length){
  if(i<ref.length&&(j>=cur.length||ref[i]<cur[j])){removed++;if(a.length<10)a.push(ref[i]);i++;}
  else if(j<cur.length&&(i>=ref.length||cur[j]<ref[i])){added++;if(b.length<10)b.push(cur[j]);j++;}
  else {i++;j++;}
 }
 return {baseline_only:removed,live_only:added,baseline_sample:a,live_sample:b};
}
async function full(id){
 let error;
 for(let i=0;i<3;i++){
  for(const host of ['https://api.openstreetmap.org','https://www.openstreetmap.org']){
   const url=host+'/api/0.6/relation/'+id+'/full';
   try{
    const start=new Date().toISOString();
    const response=await fetch(url,{headers:{Accept:'application/xml','User-Agent':'ReformaAdmin-P907218-OSM-Live-ReadOnly/1.0'},signal:AbortSignal.timeout(95000)});
    if(!response.ok)throw Error('OSM_HTTP_'+response.status);
    const xml=await response.text();if(!xml.includes('</osm>'))throw Error('truncated_XML');
    return {xml,url,start,end:new Date().toISOString(),sha256:sha(xml),bytes:Buffer.byteLength(xml),status:response.status};
   }catch(e){error=String(e);}
  }
  if(i<2)await sleep(1800*(i+1));
 }
 throw Error('OSM_full_unavailable_'+id+'_'+error);
}
async function main(){
if(process.argv.includes('--self-test')){
 const sample='<osm><node id="1" lon="0" lat="0" version="1" timestamp="2026-01-01T00:00:00Z"/><node id="2" lon="1" lat="0" version="1" timestamp="2026-01-01T00:00:00Z"/><node id="3" lon="1" lat="1" version="1" timestamp="2026-01-01T00:00:00Z"/><way id="8" version="1" timestamp="2026-01-01T00:00:00Z"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="1"/></way><relation id="9" version="1" timestamp="2026-01-01T00:00:00Z"><member type="way" ref="8" role="outer"/><tag k="name" v="A &amp; B"/></relation></osm>';
 const f=parseFull(sample),g=polygon(f.relations.get('9'),f.ways,f.nodes);
 assert.equal(f.relations.get('9').tags.name,'A & B');
 assert.equal(segments(g).digest,segments({type:'Polygon',coordinates:[g.coordinates[0].slice().reverse()]}).digest);
 assert.notEqual(segments(g).digest,segments({type:'Polygon',coordinates:[[[0,0],[1.0000001,0],[1,1],[0,0]]]}).digest);
 assert.equal(segmentDiff(['a','b'],['b','c']).baseline_only,1);
 console.log('P907218_LIVE_SOURCE_SELF_TEST_PASS');process.exit(0);
}
if(!process.argv.includes('--audit'))throw Error('Use --self-test or --audit');
const catalog=read('public/data/p907216-osm-roles.json');
const ledger=read('docs/p9.0.6.2-verified-evidence-ledger.json');
const census=read('docs/p9.0.7.2.15-osm-tag-census.json');
const semantic=read('docs/p9.0.7.2.15-osm-semantic-reconciliation.json');
const policy=read('docs/p9.0.4.3-promotion-policy.json');
assert.equal(ledger.snapshot_261012.sha256,pbf);
assert.equal(ledger.snapshot_261012.replication_timestamp,cutoff);
assert.equal(catalog.osm_source_date,cutoff);
assert.equal(catalog.existing_actual_snapshot_id,'actual-a9e5a4ddcb5277ef');
assert.equal(catalog.relation_count,85);assert.equal(catalog.rows.length,85);
assert.equal(census.rows.length,85);assert.equal(semantic.rows.length,85);
assert.equal(policy.semantic_acceptance,'BLOCKED_INCOMPLETE');assert.equal(policy.p91_import_allowed,false);
assert.equal(semantic.actual_mutation_allowed,false);assert.equal(catalog.legal_de_facto_certified,0);
const refs=new Map(ledger.rows.map(x=>[x.osm_id,x]));
const sourceTags=new Map(census.rows.map(x=>[x.osm_relation_id,x]));
const semanticIds=new Map(semantic.rows.map(x=>[x.actual_id,x]));
const wanted=new Set(catalog.rows.map(x=>x.id));assert.equal(wanted.size,85);
const actual=new Map();
for(const file of mdFiles)for(const f of read(file).features){
 const id=f.properties?.entity_id;if(!wanted.has(id))continue;
 assert(!actual.has(id),'duplicate_published_geometry_'+id);
 actual.set(id,{file,geometry:f.geometry});
}
assert.equal(actual.size,85,'missing_published_ACTUAL_geometry');
const folder=resolve('outputs/P9.0.7.2.18'),raw=resolve(folder,'raw-osm-full');mkdirSync(raw,{recursive:true});
const rows=[],captureStart=new Date().toISOString();
for(const [i,c] of catalog.rows.entries()){
 const id=String(c.osm_relation_id),base=refs.get(id),tags=sourceTags.get(id),semanticRow=semanticIds.get(c.id),act=actual.get(c.id);
 assert(base&&tags&&semanticRow&&act,'incomplete_reference_'+c.id);
 const old=segments(act.geometry);
 assert.equal(old.digest,base.live_polygon_edges_sha256,'baseline_ACTUAL_source_mismatch_'+c.id);
 assert.equal(semanticRow.osm_relation_version,c.osm_relation_version);
 assert.equal(tags.relation_version,base.relation_version_261012);
 const row={id:c.id,name:c.display_name,osm_relation_id:id,baseline_version:base.relation_version_261012,
  baseline_edge_sha256:base.live_polygon_edges_sha256,baseline_segments:old.lines.length,
  legal_de_facto_certified:false,source_status:'UNRESOLVED'};
 try{
  const response=await full(id),parsed=parseFull(response.xml),rel=parsed.relations.get(id);
  if(!rel)throw Error('relation_missing_from_full_XML');
  writeFileSync(resolve(raw,'relation-'+id+'.osm.xml.gz'),gzipSync(response.xml,{mtime:0}));
  row.capture={source:response.url,http_status:response.status,start_utc:response.start,end_utc:response.end,
   raw_xml_sha256:response.sha256,raw_xml_bytes:response.bytes};
  const live=polygon(rel,parsed.ways,parsed.nodes);
  const liveTopology=readTopologyGeometry(live),liveSegments=segments(live);
  const wayIds=[...new Set(rel.members.filter(x=>x.role==='outer'||x.role==='inner').map(x=>x.ref))];
  const ways=wayIds.map(x=>parsed.ways.get(x));if(ways.some(x=>!x))throw Error('missing_way');
  const nodeIds=[...new Set(ways.flatMap(w=>w.nodes))];
  const nodes=nodeIds.map(x=>parsed.nodes.get(x));if(nodes.some(x=>!x))throw Error('missing_node');
  const seen=[rel,...ways,...nodes],end=Date.parse(response.end);
  if(seen.some(x=>!x.timestamp||!Number.isInteger(x.version)||x.version<1||Date.parse(x.timestamp)>end))throw Error('invalid_version_timestamps');
  const newerWays=ways.filter(x=>Date.parse(x.timestamp)>cutoffMs),newerNodes=nodes.filter(x=>Date.parse(x.timestamp)>cutoffMs);
  const membersSha=sha(JSON.stringify(rel.members)),tagsSha=sha(JSON.stringify(rel.tags));
  const versionEq=rel.version===base.relation_version_261012,
   membersEq=membersSha===base.ordered_members_sha256,tagsEq=tagsSha===base.tags_sha256,
   metadataEq=versionEq&&membersEq&&tagsEq&&rel.timestamp===base.relation_timestamp;
  const liveExact=liveSegments.digest===old.digest;
  const topologyEq=liveExact?true:RelateOp.relate(readTopologyGeometry(act.geometry),liveTopology).isEquals(2,2);
  const changedTags=[];
  for(const key of new Set([...Object.keys(tags.tags),...Object.keys(rel.tags)]))
   if(tags.tags[key]!==rel.tags[key])changedTags.push({tag:key,reference:tags.tags[key]??null,live:rel.tags[key]??null});
  const classification=metadataEq&&liveExact&&!newerWays.length&&!newerNodes.length?'UNCHANGED_SINCE_PINNED_SOURCE':
   !liveExact?(topologyEq?'SEGMENTS_CHANGED_TOPOLOGY_EQUAL':'GEOMETRY_CHANGED'):
   !metadataEq?'RELATION_METADATA_CHANGED_GEOMETRY_EQUAL':'WAY_NODE_METADATA_CHANGED_GEOMETRY_EQUAL';
  Object.assign(row,{source_status:'RESOLVED',classification,relation_version_live:rel.version,
   relation_timestamp_live:rel.timestamp,relation_version_equal:versionEq,relation_members_equal:membersEq,
   tags_equal:tagsEq,metadata_equal:metadataEq,live_members_sha256:membersSha,live_tags_sha256:tagsSha,
   changed_tags:changedTags,live_edge_sha256:liveSegments.digest,
   geometry_equal_to_reference:liveExact,topology_equal_to_reference:topologyEq,
   live_segments:liveSegments.lines.length,segment_diff:liveExact?{baseline_only:0,live_only:0}:segmentDiff(old.lines,liveSegments.lines),
   way_count:ways.length,node_count:nodes.length,newer_way_count:newerWays.length,newer_node_count:newerNodes.length,
   newer_ways_sample:newerWays.slice(0,12).map(w=>[w.id,w.version,w.timestamp]),
   newer_nodes_sample:newerNodes.slice(0,12).map(n=>[n.id,n.version,n.timestamp]),
   way_version_refs_sha256:sha(JSON.stringify(ways.sort((a,b)=>Number(a.id)-Number(b.id)).map(w=>[w.id,w.version,w.timestamp,w.nodes]))),
   node_version_coordinates_sha256:sha(JSON.stringify(nodes.sort((a,b)=>Number(a.id)-Number(b.id)).map(n=>[n.id,n.version,n.timestamp,n.lon,n.lat])))});
 }catch(e){row.source_status='UNRESOLVED';row.error=String(e);}
 rows.push(row);console.log('P907218_CASE '+(i+1)+'/85 '+id+' '+(row.classification||row.error));
 await sleep(450);
}
const resolved=rows.filter(x=>x.source_status==='RESOLVED');
const failed=rows.filter(x=>x.source_status!=='RESOLVED');
const changed=resolved.filter(x=>!x.geometry_equal_to_reference);
const tally=Object.fromEntries([...new Set(rows.map(x=>x.classification||'UNRESOLVED'))].sort().map(c=>[c,rows.filter(x=>(x.classification||'UNRESOLVED')===c).length]));
const counts={scope:85,resolved:resolved.length,unresolved:failed.length,
 exact_geometry:resolved.length-changed.length,geometry_changed:changed.length,
 full_unchanged:resolved.filter(x=>x.classification==='UNCHANGED_SINCE_PINNED_SOURCE').length,
 changed_relation_metadata:resolved.filter(x=>!x.metadata_equal).length,
 revised_way_node_since_cutoff:resolved.filter(x=>x.newer_way_count||x.newer_node_count).length,
 classifications:tally};
const verdict=failed.length?'INCOMPLETE_SOURCE':counts.full_unchanged===85?'COMPLETE_85_UNCHANGED':'COMPLETE_WITH_DIFFERENCES';
const report={schema_version:'p907218-live-way-node-geometry-v1',audit_only:true,
 source_baseline:{pbf_sha256:pbf,cutoff,actual_snapshot:catalog.existing_actual_snapshot_id},
 live_capture:{start_utc:captureStart,end_utc:new Date().toISOString(),atomic_snapshot:false,
  method:'85 sequential relation/id/full OSM API GETs; archived lossless XML and way/node versions per ID'},
 protected_policy:{p91_import_allowed:false,semantic_acceptance:'BLOCKED_INCOMPLETE',actual_mutation_allowed:false,
  legal_de_facto_certified:0,no_new_polygons:true,automatic_ACTUAL_promotion:false},
 counts,verdict,rows};
writeFileSync(resolve(folder,'live-source-85.json'),JSON.stringify(report,null,2)+'\n');
writeFileSync(resolve(folder,'summary.json'),JSON.stringify({verdict,counts,baseline:cutoff,capture:report.live_capture},null,2)+'\n');
console.log('P907218_SUMMARY '+JSON.stringify({verdict,counts}));
if(failed.length)process.exitCode=2;

}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) await main();
