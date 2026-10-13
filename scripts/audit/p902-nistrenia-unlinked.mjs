// P9.0.2 read-only supplement: OSM administrative relations omitted from "subarea" and ACTUAL MD reuse proposals.
// All network-derived membership remains provisional until full polygon/semantic review.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pointInGeometry} from '../../atlas-point-geometry.mjs';
import {readTopologyGeometry} from '../lib/p82-topology.mjs';
import RelateOp from 'jsts/org/locationtech/jts/operation/relate/RelateOp.js';
const ROOT=new URL('../../',import.meta.url),OUT=new URL('../../outputs/P9.0.2/',import.meta.url);
const read=async path=>JSON.parse(await readFile(new URL(path,ROOT),'utf8'));
const digest=x=>createHash('sha256').update(x).digest('hex');
const attr=(s,k)=>(s.match(new RegExp('(?:^|\\s)'+k+'="([^"]*)"'))||[])[1];
const sleep=n=>new Promise(resolve=>setTimeout(resolve,n));
const ID=/^[1-9][0-9]{0,15}$/;
const safePath=/^public\/geo\/actual\/(?:(?:ro|md)-(?:overview|local|detail|statistical)|chunks\/(?:ro|md)\/(?:local|detail)\/osm-r[0-9]+)\.geojson$/;
const fetchTimeout=60000;
async function getOSMFull(id){
 if(!ID.test(String(id)))throw Error('OSM ID invalid');
 let err;
 for(let attempt=0;attempt<3;attempt++){
  for(const host of ['https://api.openstreetmap.org','https://www.openstreetmap.org']){
   try{
    const res=await fetch(host+'/api/0.6/relation/'+id+'/full',{headers:{Accept:'application/xml','User-Agent':'ReformaTerritoriala-P902-ReadOnly/1.0'},signal:AbortSignal.timeout(fetchTimeout)});
    if(!res.ok)throw Error('HTTP '+res.status);
    const raw=await res.text();if(!raw.includes('</osm>')||!raw.includes('<relation id="'+id+'"'))throw Error('Incomplete XML');
    return {raw,sha256:digest(raw),bytes:Buffer.byteLength(raw)};
   }catch(e){err=e;}
  }
  await sleep(1200*(attempt+1));
 }
 throw Error('OSM relation '+id+': '+err);
}
function polygonFromXML(xml,id){
 const nodes=new Map([...xml.matchAll(/<node\b([^>]*)\/?>/g)].map(m=>{
  const a=m[1];return [attr(a,'id'),[Number(attr(a,'lon')),Number(attr(a,'lat'))]];
 }));
 const ways=new Map([...xml.matchAll(/<way\b([^>]*)>([\s\S]*?)<\/way>/g)].map(m=>[
  attr(m[1],'id'),[...m[2].matchAll(/<nd\s+([^>]*?)\/>/g)].map(z=>attr(z[1],'ref'))
 ]));
 const relation=[...xml.matchAll(/<relation\b([^>]*)>([\s\S]*?)<\/relation>/g)].find(m=>attr(m[1],'id')===String(id));
 if(!relation)throw Error('Missing relation '+id);
 const members=[...relation[2].matchAll(/<member\s+([^>]*?)\/>/g)].map(m=>({type:attr(m[1],'type'),ref:attr(m[1],'ref'),role:attr(m[1],'role')}));
 const rings=role=>{
  const unjoined=members.filter(x=>x.type==='way'&&x.role===role).map(x=>({ref:x.ref,seq:ways.get(x.ref)}));
  if(unjoined.some(x=>!x.seq||x.seq.length<2))throw Error('Missing ways '+role);
  const result=[];
  while(unjoined.length){
   const seq=unjoined.pop().seq.slice();
   while(seq[0]!==seq.at(-1)){
    const i=unjoined.findIndex(x=>x.seq[0]===seq.at(-1)||x.seq.at(-1)===seq.at(-1));
    if(i<0)throw Error('Open ring '+role);
    let next=unjoined.splice(i,1)[0].seq;
    if(next.at(-1)===seq.at(-1))next=next.slice().reverse();
    seq.push(...next.slice(1));
   }
   const coords=seq.map(n=>nodes.get(n));
   if(coords.length<4||coords.some(p=>!p||!p.every(Number.isFinite)))throw Error('Invalid ring coordinates');
   result.push(coords);
  }
  return result;
 };
 const outer=rings('outer'),inner=rings('inner');
 if(!outer.length)throw Error('No polygon outer');
 // Locate holes using the same conservative point-in-polygon primitive as P8.1.
 const polys=outer.map(o=>[o]);for(const h of inner){
  const owners=polys.filter(p=>pointInGeometry(h[0],{type:'Polygon',coordinates:[p[0]]})!=='outside');
  if(owners.length!==1)throw Error('Ambiguous inner ring');
  owners[0].push(h);
 }
 return polys.length===1?{type:'Polygon',coordinates:polys[0]}:{type:'MultiPolygon',coordinates:polys};
}
const inventory=await read('outputs/P9.0.1/inventory.json');
const matrix=await read('outputs/P9.0.1/matrix.json');
const baseSummary=await read('outputs/P9.0.1/summary.json');
if(baseSummary.status!=='PASS'||baseSummary.actual_md_count!==2602||baseSummary.actual_entity_count!==5848)throw Error('Missing P9.0.1 authoritative baseline');
const entities=(await read('public/data/actual-entities.json')).entities;
const md=entities.filter(e=>e.jurisdiction==='MD');
const byId=new Map(md.map(e=>[e.id,e]));
const published=new Set(inventory.map(e=>e.id));
const rootOSM=await getOSMFull(65335),rootRaw=polygonFromXML(rootOSM.raw,65335),rootGeo=readTopologyGeometry(rootRaw);
const xs=[],ys=[];for(const polys of rootRaw.type==='Polygon'?[rootRaw.coordinates]:rootRaw.coordinates)for(const ring of polys)for(const p of ring){xs.push(p[0]);ys.push(p[1]);}
const bbox=[Math.max(-90,Math.min(...ys)-0.035),Math.max(-180,Math.min(...xs)-0.035),Math.min(90,Math.max(...ys)+0.035),Math.min(180,Math.max(...xs)+0.035)];
const q='[out:json][timeout:120][maxsize:536870912];relation["boundary"="administrative"]["admin_level"~"^(4|5|6|7|8|9|10)$"]('+bbox.map(x=>x.toFixed(7)).join(',')+');out tags center;';
const endpoints=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://overpass.private.coffee/api/interpreter'];
let overpass=null,used=null,networkErrors=[];
for(const endpoint of endpoints){
 try{
  const res=await fetch(endpoint,{method:'POST',body:new URLSearchParams({data:q}),headers:{'User-Agent':'ReformaTerritoriala-P902-ReadOnly/1.0','Content-Type':'application/x-www-form-urlencoded'},signal:AbortSignal.timeout(180000)});
  if(!res.ok)throw Error('HTTP '+res.status+' '+(await res.text()).slice(0,120));
  const data=await res.json();if(!Array.isArray(data.elements))throw Error('Bad Overpass JSON');
  overpass=data;used=endpoint;break;
 }catch(e){networkErrors.push({endpoint,message:String(e)});}
}
const sourceRel={...new Map((overpass?.elements||[]).filter(x=>x.type==='relation'&&ID.test(String(x.id))).map(x=>[String(x.id),x])).values()};
const candidates=Object.values(sourceRel).map(x=>{
 const id=String(x.id),tags=x.tags||{},center=x.center,
 insideCenter=Number.isFinite(center?.lon)&&Number.isFinite(center?.lat)?pointInGeometry([center.lon,center.lat],rootRaw):'unknown';
 return {osm_id:id,name_ro:tags['name:ro']||null,name:tags.name||null,admin_level:tags.admin_level||null,
  center:center?{lon:center.lon,lat:center.lat}:null,center_relation:insideCenter,
  in_p901_subarea:published.has(id),in_ACTUAL_MD:byId.has('osm-r'+id),
  ACTUAL_id:byId.has('osm-r'+id)?'osm-r'+id:null,metadata_only:true,full_geometry_review:'not_run'};
}).sort((a,b)=>Number(a.osm_id)-Number(b.osm_id));
const review=candidates.filter(x=>x.center_relation!=='outside'&&!x.in_p901_subarea&&!x.in_ACTUAL_MD)
 .sort((a,b)=>Number(a.admin_level||99)-Number(b.admin_level||99)||Number(a.osm_id)-Number(b.osm_id));
const maxFull=80;
const audited=[],exceptions=[];
for(const x of review.slice(0,maxFull)){
 try{
  const fetchResult=await getOSMFull(x.osm_id),geo=readTopologyGeometry(polygonFromXML(fetchResult.raw,x.osm_id));
  const m=RelateOp.relate(rootGeo,geo);
  const relation=m.isDisjoint()?'disjoint':m.isEquals(2,2)?'equal':m.isCovers()?'root_contains':m.isCoveredBy()?'root_within':m.get(0,0)===2?'partial_overlap':m.get(1,1)===1?'boundary':'point';
  audited.push({...x,full_geometry_review:relation,DE9IM:m.toString(),relation_version:(fetchResult.raw.match(new RegExp('<relation id="'+x.osm_id+'"[^>]*version="([0-9]+)"'))||[])[1]||null,source_sha256:fetchResult.sha256});
 }catch(error){audited.push({...x,full_geometry_review:'error',error:String(error)});exceptions.push({id:x.osm_id,error:String(error)});}
 await sleep(180);
}
const grouped=new Map();
for(const row of matrix){
 if(!byId.has(row.actual_id))continue;
 if(!grouped.has(row.actual_id))grouped.set(row.actual_id,{id:row.actual_id,name:byId.get(row.actual_id).display_name,root:null,parents:[],ambiguous:[]});
 const obj=grouped.get(row.actual_id);
 if(row.nistrenia_osm_id==='65335'){obj.root=row.relation;continue;}
 const item={osm_parent_id:row.nistrenia_osm_id,relation:row.relation};
 if(inventory.some(e=>e.id===row.nistrenia_osm_id&&e.depth===1)){
  if(['contains','equal'].includes(row.relation))obj.parents.push(item);
  else if(['overlap','boundary','point'].includes(row.relation))obj.ambiguous.push(item);
 }
}
const reuses=[...grouped.values()].filter(v=>['contains','equal','overlap','boundary'].includes(v.root)).map(x=>({
 ...x,root_geometric_relation:x.root,
 proposed_de_facto_parent:x.parents.length===1?x.parents[0].osm_parent_id:null,
 membership_status:x.root==='overlap'?'partially_intersecting_needs_review':x.parents.length===1?'geometry_candidate_requires_semantic_review':x.parents.length>1?'multiple_parent_candidates':'no_unique_parent',
 reuse_master_geometry:true
})).sort((a,b)=>a.id.localeCompare(b.id));
const summary={status:!overpass||review.length>maxFull||exceptions.length?'PARTIAL':'PASS',
 actual_snapshot:baseSummary.actual_snapshot,source_p901_utc:baseSummary.fetched_utc,
 p901_matrix_pairs:matrix.length,p901_inventory:inventory.length,
 fetched_utc:new Date().toISOString(),osm_root_65335_sha256:rootOSM.sha256,
 bbox_south_west_north_east:bbox,overpass_endpoint:used,overpass_query:q,overpass_failed_attempts:networkErrors,
 overpass_relations_found:candidates.length,known_subarea_candidates:candidates.filter(x=>x.in_p901_subarea).length,
 OSM_id_already_in_ACTUAL_MD:candidates.filter(x=>x.in_ACTUAL_MD).length,
 unlinked_not_in_ACTUAL_center_candidate_count:review.length,unlinked_geometry_checked:audited.length,
 unlinked_root_contains:audited.filter(x=>x.full_geometry_review==='root_contains').length,
 unlinked_root_overlap:audited.filter(x=>x.full_geometry_review==='partial_overlap').length,
 unknown_remaining:Math.max(0,review.length-audited.length),
 reuse_ACTUAL_MD_geometries:reuses.length,reuse_unique_parent:reuses.filter(x=>x.proposed_de_facto_parent).length,
 unresolved_geometry:exceptions.length,policy:'De facto parentage is never inferred from geometry; center is prefilter only, full geometry reviewed separately; no changes in ACTUAL.'};
await mkdir(OUT,{recursive:true});
for(const [name,data]of [['summary.json',summary],['overpass-candidates.json',candidates],['unlinked-reviewed.json',audited],['reuse-proposals.json',reuses],['exceptions.json',exceptions]]){
 await writeFile(new URL(name,OUT),JSON.stringify(data,null,2)+'\n');
}
console.log('P902_SUMMARY '+JSON.stringify(summary));
if(summary.status!=='PASS')process.exitCode=2;
