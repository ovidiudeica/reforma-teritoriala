// P9.0.6.2 — pinned Geofabrik polygon/OSM relation metadata evidence; audit-only.
import assert from 'node:assert/strict';
import {readFileSync,createReadStream,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import readline from 'node:readline';
import RelateOp from 'jsts/org/locationtech/jts/operation/relate/RelateOp.js';
import {readTopologyGeometry} from '../lib/p82-topology.mjs';
const root=new URL('../../',import.meta.url),out=new URL('../../outputs/P9.0.6.2/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,root),'utf8'));
const scope=read('docs/p9.0.6.2-osm-audit-scope.json');
const ids=scope.relations.map(x=>String(x.id)),set=new Set(ids);
assert.equal(scope.counts.unique,177);assert.equal(ids.length,177);assert.equal(set.size,177);
const hash=x=>createHash('sha256').update(x).digest('hex');
const attr=(s,k)=>(s.match(new RegExp('(?:^|\\s)'+k+'="([^"]*)"'))||[])[1];
const unesc=s=>String(s).replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
function parse(xml){
 const m=new Map();
 for(const x of xml.matchAll(/<relation\b([^>]*?)>([\s\S]*?)<\/relation>/g)){
  const id=attr(x[1],'id');if(!set.has(id))continue;
  const members=[...x[2].matchAll(/<member\s+([^>]*?)\/>/g)].map(y=>({type:attr(y[1],'type'),ref:attr(y[1],'ref'),role:unesc(attr(y[1],'role')||'')}));
  const tags=Object.fromEntries([...x[2].matchAll(/<tag\s+([^>]*?)\/>/g)].map(y=>[unesc(attr(y[1],'k')),unesc(attr(y[1],'v'))]).sort(([a],[b])=>a.localeCompare(b)));
  m.set(id,{version:Number(attr(x[1],'version')),timestamp:attr(x[1],'timestamp')||null,members_count:members.length,members_sha256:hash(JSON.stringify(members)),tags_sha256:hash(JSON.stringify(tags)),members,tags});
 }return m;
}
const cmp=(a,b)=>!a||!b?'MISSING_RELATION':a.version===b.version&&a.members_sha256===b.members_sha256&&a.tags_sha256===b.tags_sha256?'EXACT_RELATION_METADATA_MATCH':a.version===b.version?'SAME_VERSION_CONTENT_MISMATCH':a.members_sha256!==b.members_sha256?'MEMBERS_CHANGED':a.tags_sha256!==b.tags_sha256?'TAGS_CHANGED':'VERSION_CHANGED_CONTENT_EQUAL';
const geom=async file=>{
 const m=new Map(),lines=readline.createInterface({input:createReadStream(new URL(file,root)),crlfDelay:Infinity});
 for await(let line of lines){line=line.replace(/^\x1e/,'').trim();if(!line)continue;
  const f=JSON.parse(line),id=String(f.properties?.['@id']||'');
  if(f.properties?.['@type']==='relation'&&set.has(id)&&f.geometry&&['Polygon','MultiPolygon'].includes(f.geometry.type))m.set(id,{geometry:f.geometry,sha256:hash(JSON.stringify(f.geometry))});
 }return m;
};
function gcmp(a,b){
 if(!a||!b)return {status:!a&&!b?'NO_POLYGON_IN_EITHER_PBF':!a?'NO_261012_POLYGON':'NO_261013_POLYGON',equal:null,old_sha:a?.sha256||null,new_sha:b?.sha256||null};
 if(a.sha256===b.sha256)return {status:'EXACT_COORDINATE_REPRESENTATION',equal:true,old_sha:a.sha256,new_sha:b.sha256};
 try{
  const equal=RelateOp.relate(readTopologyGeometry(a.geometry),readTopologyGeometry(b.geometry)).isEquals(2,2);
  return {status:equal?'COORDINATE_REPRESENTATION_CHANGED_TOPOLOGY_EQUAL':'POLYGON_TOPOLOGY_CHANGED',equal,old_sha:a.sha256,new_sha:b.sha256};
 }catch(e){return {status:'GEOMETRY_COMPARISON_ERROR',equal:null,error:String(e),old_sha:a.sha256,new_sha:b.sha256};}
}
async function fetchLive(){
 const result=new Map(),errors=[];
 for(let i=0;i<ids.length;i+=20){
  const batch=ids.slice(i,i+20),url='https://api.openstreetmap.org/api/0.6/relations?relations='+batch.join(',');
  let ok=false;
  for(let a=0;a<4;a++)try{
   const rsp=await fetch(url,{headers:{Accept:'application/xml','User-Agent':'ReformaAdmin-P9062-Evidence-Only/1.0'},signal:AbortSignal.timeout(90000)});
   if(!rsp.ok)throw Error('HTTP_'+rsp.status);
   const found=parse(await rsp.text());for(const [id,x]of found)result.set(id,x);
   errors.push(...batch.filter(id=>!found.has(id)).map(id=>({id,error:'MISSING_FROM_API'})));ok=true;break;
  }catch(e){if(a===3)errors.push(...batch.map(id=>({id,error:String(e)})));else await new Promise(r=>setTimeout(r,1500*(a+1)));}
  console.log('P9062_OSM_LIVE',Math.min(ids.length,i+20),'of',ids.length,'ok',ok);
  await new Promise(r=>setTimeout(r,500));
 }return {result,errors};
}
if(process.argv.includes('--self-test')){
 const x=parse('<osm><relation id="65335" version="424" timestamp="2026-09-07T19:31:29Z"><member type="way" ref="12" role="outer"/><tag k="boundary" v="administrative"/></relation></osm>').get('65335');
 assert.equal(x.version,424);assert.equal(x.members_count,1);assert.equal(cmp(x,x),'EXACT_RELATION_METADATA_MATCH');
 assert.equal(gcmp(null,null).status,'NO_POLYGON_IN_EITHER_PBF');console.log('P9062_SELF_TEST PASS');process.exit(0);
}
if(!process.argv.includes('--reconcile'))throw Error('expected --reconcile');
const old=parse(readFileSync(new URL('outputs/P9.0.6.2/input/relations-261012.osm',root),'utf8'));
const updated=parse(readFileSync(new URL('outputs/P9.0.6.2/input/relations-261013.osm',root),'utf8'));
const [oldGeo,newGeo]=await Promise.all([geom('outputs/P9.0.6.2/input/geometry-261012.geojsonseq'),geom('outputs/P9.0.6.2/input/geometry-261013.geojsonseq')]);
const live=await fetchLive(),source=read('outputs/P9.0.6.2/input/sources.json');
const rows=scope.relations.map(s=>({osm_id:s.id,roles:s.roles,baseline_261012:old.get(s.id)||null,updated_261013:updated.get(s.id)||null,live_api:live.result.get(s.id)||null,relation_12_to_13:cmp(old.get(s.id),updated.get(s.id)),relation_12_to_live:cmp(old.get(s.id),live.result.get(s.id)),relation_13_to_live:cmp(updated.get(s.id),live.result.get(s.id)),snapshot_geometry:gcmp(oldGeo.get(s.id),newGeo.get(s.id)),live_full_way_node_geometry:'NOT_PROVEN',p91_import_allowed:false}));
const count=fn=>Object.fromEntries([...new Set(rows.map(fn))].sort().map(k=>[k,rows.filter(x=>fn(x)===k).length]));
const integrity=source.snapshot_261012.sha256===scope.reference_sha256&&source.snapshot_261012.bytes===101337752;
const summary={schema_version:'p9062-version-and-polygon-compare-v1',status:'PARTIAL',audit_only:true,p91_import_allowed:false,semantic_acceptance:'BLOCKED_INCOMPLETE',source_integrity:integrity?'PASS':'FAIL',scope:scope.counts,snapshot_261012:source.snapshot_261012,snapshot_261013:source.snapshot_261013,live_api:{endpoint:'https://api.openstreetmap.org/api/0.6/relations',started_at:source.live_capture_start,ended_at:new Date().toISOString(),returned:live.result.size,errors:live.errors.length},relation_12_to_13:count(x=>x.relation_12_to_13),relation_12_to_live:count(x=>x.relation_12_to_live),relation_13_to_live:count(x=>x.relation_13_to_live),geometry_12_to_13:count(x=>x.snapshot_geometry.status),live_geometry_status:'UNVERIFIED_RELATION_API_DOES_NOT_RETURN_WAY_NODE_GEOMETRY',crossborder_geometry_status:'GEOBABRIK_EXTRACT_CLIPPING_MUST_BE_SEPARATE_FROM_OSM_LIVE',warning:'A relation can retain identical version and member IDs while referenced way/node geometry changes. Never infer polygon equality from relation metadata.'};
mkdirSync(out,{recursive:true});
for(const [n,v]of [['summary.json',summary],['records.json',rows],['errors.json',live.errors]])writeFileSync(new URL(n,out),JSON.stringify(v,null,2)+'\n');
console.log('P9062_SUMMARY '+JSON.stringify(summary));
if(!integrity||rows.length!==177||live.errors.length)process.exitCode=2;
