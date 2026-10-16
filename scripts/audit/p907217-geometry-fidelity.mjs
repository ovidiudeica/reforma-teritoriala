// P9.0.7.2.17 — read-only OSM 2026-10-12 vs published ACTUAL polygon audit.
// Compares canonical undirected, unsimplified 7-decimal OSM edge multisets.
// Legal/de facto jurisdiction and ACTUAL release are never modified.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import RelateOp from 'jsts/org/locationtech/jts/operation/relate/RelateOp.js';
import {readTopologyGeometry,classifyMatrix} from '../lib/p82-topology.mjs';

const read=p=>JSON.parse(readFileSync(new URL('../../'+p,import.meta.url),'utf8'));
const sha=x=>createHash('sha256').update(x).digest('hex');
const sourceTime='2026-10-12T20:21:35Z';
const sourcePbf='4ebd791fb953a22961e40ef7921914251c7b7292c33ed1e90e919488f1a397b8';
const mdFiles=['public/geo/actual/md-overview.geojson','public/geo/actual/md-local.geojson','public/geo/actual/md-detail.geojson'];
const specialIds=new Set(['osm-r12463379','osm-r9581354','osm-r8291058','osm-r9301463','osm-r19001619','osm-r1216706','osm-r9659979']);

export function edgeDigest(g){
 assert(['Polygon','MultiPolygon'].includes(g?.type),'only raw polygon geometry allowed');
 const polygons=g.type==='Polygon'?[g.coordinates]:g.coordinates;
 assert(polygons.length>0,'empty polygon');
 const edges=[];
 for(const polygon of polygons)for(const ring of polygon){
  assert(ring.length>=4,'degenerate ring');
  assert.equal(JSON.stringify(ring[0]),JSON.stringify(ring.at(-1)),'unclosed raw ring');
  for(let i=1;i<ring.length;i++){
   const fmt=p=>{
    assert(Array.isArray(p)&&p.length===2&&p.every(Number.isFinite),'nonfinite/multi-dimensional coordinate');
    return p.map(v=>Number(v).toFixed(7)).join(',');
   };
   const a=fmt(ring[i-1]),b=fmt(ring[i]);
   assert.notEqual(a,b,'zero-length OSM edge after 7-decimal encoding');
   edges.push(a<b?a+'|'+b:b+'|'+a);
  }
 }
 return {sha256:sha(edges.sort().join('\n')),segments:edges.length};
}
function envelope(g){
 const polygons=g.type==='Polygon'?[g.coordinates]:g.coordinates;
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const p of polygons)for(const r of p)for(const [x,y] of r){
  minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
 }
 return [minX,minY,maxX,maxY];
}
const bbIntersects=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
const sample={type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,0]]]};
if(process.argv.includes('--self-test')){
 assert.equal(edgeDigest(sample).sha256,edgeDigest({type:'Polygon',coordinates:[[[1,1],[1,0],[0,0],[1,1]]]}).sha256);
 assert.notEqual(edgeDigest(sample).sha256,edgeDigest({type:'Polygon',coordinates:[[[0,0],[1.0000001,0],[1,1],[0,0]]]}).sha256);
 assert.throws(()=>edgeDigest({type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,1]]]}),/unclosed/);
 console.log('P907217_EDGE_HASH_SELF_TEST_PASS');process.exit(0);
}
if(!process.argv.includes('--audit'))throw Error('Use --audit or --self-test');

const catalog=read('public/data/p907216-osm-roles.json');
const ledger=read('docs/p9.0.6.2-verified-evidence-ledger.json');
const policy=read('docs/p9.0.4.3-promotion-policy.json');
const sourceRoles=read('docs/p9.0.7.2.15-osm-semantic-reconciliation.json');
assert.equal(ledger.snapshot_261012.sha256,sourcePbf);
assert.equal(ledger.snapshot_261012.replication_timestamp,sourceTime);
assert.equal(catalog.osm_source_date,sourceTime);
assert.equal(catalog.existing_actual_snapshot_id,'actual-a9e5a4ddcb5277ef');
assert.equal(catalog.relation_count,85);
assert.equal(catalog.rows.length,85);
assert.equal(sourceRoles.total,85);
assert.equal(policy.semantic_acceptance,'BLOCKED_INCOMPLETE');
assert.equal(policy.p91_import_allowed,false);
assert.equal(catalog.no_new_geometries,true);
assert.equal(catalog.no_new_jurisdictions,true);
assert.equal(catalog.legal_de_facto_certified,0);
assert.equal(sourceRoles.actual_mutation_allowed,false);
assert.equal(sourceRoles.p91_import_allowed,false);
const ids=new Set(catalog.rows.map(x=>x.id));
assert.equal(ids.size,85);
const ledgerById=new Map(ledger.rows.map(x=>[x.osm_id,x]));
const semanticById=new Map(sourceRoles.rows.map(x=>[x.actual_id,x]));
const features=new Map();
for(const file of mdFiles)for(const f of read(file).features){
 const id=f.properties?.entity_id;
 if(!ids.has(id))continue;
 assert(!features.has(id),'duplicate published ACTUAL geometry '+id);
 features.set(id,{file,feature:f});
}
const rows=[],geometryById=new Map(),missing=[],changed=[],sourceErrors=[];
for(const r of catalog.rows){
 const prev=ledgerById.get(String(r.osm_relation_id)),s=semanticById.get(r.id),entry=features.get(r.id);
 if(!prev||!s||!prev.live_polygon_edges_sha256||!prev.live_vs_2026_10_12_exact||prev.snapshot_polygon_status!=='EXACT_COORDINATE_REPRESENTATION'){
  sourceErrors.push(r.id);continue;
 }
 assert.equal(s.pinned_2026_10_12_polygon_sha256,prev.source_polygon_261012_sha256);
 assert.equal(s.osm_relation_id,String(r.osm_relation_id));
 assert.equal(s.osm_relation_version,r.osm_relation_version);
 if(!entry){missing.push(r.id);rows.push({id:r.id,name:r.display_name,status:'ACTUAL_MISSING'});continue;}
 const g=entry.feature.geometry,edge=edgeDigest(g);
 const status=edge.sha256===prev.live_polygon_edges_sha256?'EXACT_2026_10_12_EDGESET':'EDGESET_CHANGED';
 if(status!=='EXACT_2026_10_12_EDGESET')changed.push(r.id);
 const row={id:r.id,name:r.display_name,cartographic_role:r.role,source_relation_version:r.osm_relation_version,
  actual_file:entry.file,actual_geometry_type:g.type,actual_bbox:envelope(g),segments:edge.segments,
  actual_edge_sha256:edge.sha256,pinned_osm_edge_sha256:prev.live_polygon_edges_sha256,status,
  legal_parent_unchanged:entry.feature.properties?.parent_catalog_id??null,
  juridical_certification:'NOT_CERTIFIED'};
 rows.push(row);
 try{geometryById.set(r.id,readTopologyGeometry(g));}
 catch(e){sourceErrors.push(r.id+':geometry_invalid:'+String(e));}
}
assert.equal(rows.length+sourceErrors.filter(x=>!x.includes(':')).length,85,'incomplete review scope');
const geometryHashDuplicates=[];
const seenDigests=new Map();
for(const row of rows){
 if(!row.actual_edge_sha256)continue;
 const existing=seenDigests.get(row.actual_edge_sha256);
 if(existing)geometryHashDuplicates.push([existing,row.id]);
 else seenDigests.set(row.actual_edge_sha256,row.id);
}
const pairs=[];
let skippedByBBox=0,relateErrors=[];
for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
 const a=rows[i],b=rows[j];
 if(!a.actual_bbox||!b.actual_bbox)continue;
 if(!bbIntersects(a.actual_bbox,b.actual_bbox)){skippedByBBox++;continue;}
 try{
  const matrix=RelateOp.relate(geometryById.get(a.id),geometryById.get(b.id));
  pairs.push({a:a.id,b:b.id,relation:classifyMatrix(matrix),de9im:matrix.toString(),
   special:specialIds.has(a.id)||specialIds.has(b.id)});
 }catch(e){relateErrors.push({a:a.id,b:b.id,error:String(e)});}
}
const counts={scope:85,geometries_found:features.size,exact_edges:rows.filter(r=>r.status==='EXACT_2026_10_12_EDGESET').length,
 changed_edges:changed.length,missing:missing.length,source_errors:sourceErrors.length,
 duplicate_geometry_hash_pairs:geometryHashDuplicates.length,topology_errors:relateErrors.length,
 topology_bbox_disjoint:skippedByBBox,topology_bboxes_evaluated:pairs.length,
 topo_relations:Object.fromEntries([...new Set(pairs.map(x=>x.relation))].sort().map(k=>[k,pairs.filter(x=>x.relation===k).length]))};
const accepted=counts.geometries_found===85&&counts.exact_edges===85&&counts.changed_edges===0&&
 counts.missing===0&&counts.source_errors===0&&counts.duplicate_geometry_hash_pairs===0&&counts.topology_errors===0;
const result={schema_version:'p907217-osm-actual-edge-fidelity-v1',audited_main_sha:'f04c20163a12dd264345eebff85138681792d107',
 audit_only:true,p91_import_allowed:false,actual_mutation_allowed:false,semantic_acceptance:'BLOCKED_INCOMPLETE',
 source:{snapshot_pbf_sha256:sourcePbf,timestamp:sourceTime,ledger:'docs/p9.0.6.2-verified-evidence-ledger.json',
  edge_method:'sorted undirected EPSG:4326 segments, toFixed(7), full multiplicity, no coordinate changes'},
 actual:{snapshot:catalog.existing_actual_snapshot_id,fingerprint:catalog.existing_actual_release_fingerprint_sha256,
  sources:mdFiles},counts,geometry_hash_duplicates:geometryHashDuplicates,source_errors:sourceErrors,
 changed,missing,topology_errors:relateErrors,topology_intersecting_envelopes:pairs,rows,
 status:accepted?'PASS':'BLOCKED_INCOMPLETE',interpretation:'Exact segment equality against previously certified 2026-10-12 OSM source. No fresh OSM fetch and no proof of legal de facto membership; topological overlaps, if any, are observations, not promotions.'};
const out=resolve('outputs/P9.0.7.2.17/geometry-fidelity-audit.json');
mkdirSync(dirname(out),{recursive:true});
writeFileSync(out,JSON.stringify(result,null,2)+'\n');
console.log('P907217_SUMMARY '+JSON.stringify({status:result.status,counts,source_sha256:sourcePbf,
 special_topology:pairs.filter(x=>x.special),result:out}).slice(0,14000));
if(!accepted)process.exitCode=2;
