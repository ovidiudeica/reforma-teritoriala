import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import GeoJSONReader from 'jsts/org/locationtech/jts/io/GeoJSONReader.js';
import IsValidOp from 'jsts/org/locationtech/jts/operation/valid/IsValidOp.js';
import {inspectMalcociInvalidOsmContract} from './md-osm-invalid-geometry-fallback.mjs';
export const MALCOCI_CURRENT_OSM_CONTRACT=JSON.parse(readFileSync(new URL('./md-malcoci-reviewed-current-osm.json',import.meta.url),'utf8'));
const cfg=MALCOCI_CURRENT_OSM_CONTRACT;
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
export const contractHash=v=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
const relationProjection=r=>({id:r.id,version:r.version,changeset:r.changeset,timestamp:r.timestamp,tags:r.tags,members:r.members});
export const segmentKey=(a,b)=>[JSON.stringify(a),JSON.stringify(b)].sort().join('|');
export function geometrySegments(geometry){
 const rings=geometry?.type==='Polygon'?geometry.coordinates:geometry?.type==='MultiPolygon'?geometry.coordinates.flat():[];
 return new Set(rings.flatMap(r=>r.slice(1).map((c,i)=>segmentKey(r[i],c))));
}
export function segmentDifference(expected,actual){return {missing:[...expected].filter(s=>!actual.has(s)),extra:[...actual].filter(s=>!expected.has(s))};}
export function validSourcePolygon(feature){
 const g=feature?.geometry;
 if(!['Polygon','MultiPolygon'].includes(g?.type))return false;
 const rings=g.type==='Polygon'?g.coordinates:g.coordinates.flat();
 if(!rings.length||rings.some(r=>r.length<4||JSON.stringify(r[0])!==JSON.stringify(r.at(-1))||r.some(c=>!Array.isArray(c)||c.length!==2||!c.every(Number.isFinite))))return false;
 try{return new IsValidOp(new GeoJSONReader().read(g)).isValid();}catch{return false;}
}
export function deriveReviewedMalcociCurrentOsmGeometry(raw){
 const byKey=new Map((raw?.elements||[]).map(e=>[e.type+'/'+e.id,e]));
 const relation=byKey.get('relation/'+cfg.relation_id);
 inspectMalcociInvalidOsmContract(raw);
 if(contractHash(relationProjection(relation))!==cfg.relation.sha256)throw Error('Malcoci reviewed relation contract hash drift');
 const coordinate=id=>{const n=byKey.get('node/'+id);if(!n||!Number.isFinite(n.lon)||!Number.isFinite(n.lat))throw Error('Malcoci current OSM node missing '+id);return [n.lon,n.lat];};
 const wayCoordinates=w=>w.nodes.map(id=>[id,...coordinate(id)]);
 const ways=cfg.ways.map(expected=>{
  const w=byKey.get('way/'+expected.id);
  if(!w||w.version!==expected.version||contractHash(wayCoordinates(w))!==expected.geometry_sha256)throw Error('Malcoci live member geometry/node contract drift '+expected.id);
  return w;
 });
 const connector=byKey.get('way/'+cfg.connector_way_id);
 if(!connector||!Array.isArray(connector.nodes)||JSON.stringify([connector.nodes[0],connector.nodes.at(-1)].sort((a,b)=>a-b))!==JSON.stringify(cfg.odd_endpoint_node_ids))throw Error('Malcoci connector endpoint drift');
 if(connector.version!==cfg.connector.version||connector.changeset!==cfg.connector.changeset||connector.timestamp!==cfg.connector.timestamp||JSON.stringify(connector.nodes)!==JSON.stringify(cfg.connector.nodes)||contractHash(wayCoordinates(connector))!==cfg.connector.geometry_sha256)throw Error('Malcoci connector geometry/node contract drift');
 for(const expected of cfg.evidence){
  const r=byKey.get('relation/'+expected.id);
  if(!r||r.tags?.boundary!=='administrative'||!r.members?.some(m=>m.type==='way'&&m.ref===cfg.connector_way_id&&['outer',''].includes(m.role||''))||r.version!==expected.version||contractHash(relationProjection(r))!==expected.sha256)throw Error('Malcoci administrative evidence relation membership/contract drift '+expected.id);
 }
 const segmentsFor=wayList=>new Set(wayList.flatMap(w=>w.nodes.slice(1).map((id,i)=>segmentKey(coordinate(w.nodes[i]),coordinate(id)))));
 const liveSegments=segmentsFor(ways),connectorSegments=segmentsFor([connector]),expected=new Set([...liveSegments,...connectorSegments]);
 // Assemble separate node chains. No source relation, member, way or node is mutated.
 const pending=[...ways,connector].map(w=>[...w.nodes]);
 const ring=pending.shift();
 while(pending.length){
  const end=ring.at(-1),index=pending.findIndex(chain=>chain[0]===end||chain.at(-1)===end);
  if(index<0)throw Error('Malcoci reviewed boundary network does not form one closed ring');
  const chain=pending.splice(index,1)[0];if(chain.at(-1)===end)chain.reverse();ring.push(...chain.slice(1));
 }
 if(ring[0]!==ring.at(-1))throw Error('Malcoci reviewed boundary network remains open');
 const geometry={type:'Polygon',coordinates:[ring.map(coordinate)]};
 if(!validSourcePolygon({geometry}))throw Error('Malcoci reviewed derived OSM polygon is invalid');
 const actual=geometrySegments(geometry),diff=segmentDifference(expected,actual);
 if(diff.missing.length||diff.extra.length)throw Error('Malcoci current OSM union fidelity failed: '+JSON.stringify(diff));
 const provenance={geometry_derivation:cfg.derivation,source_relation_id:cfg.relation_id,connector_way_id:cfg.connector_way_id,evidence_relation_ids:cfg.evidence_relation_ids,reviewed_contract_sha256:contractHash(cfg),live_relation_version:relation.version,connector_version:connector.version,coordinate_edit:false,source_relation_membership_edit:false,historical_geometry_fallback:false,snapping:false,clipping:false,simplification:false};
 return {geometry,provenance,audit:{live_segment_count:liveSegments.size,connector_segment_count:connectorSegments.size,union_segment_count:expected.size,derived_segment_count:actual.size,missing:diff.missing.length,extra:diff.extra.length},liveSegments,connectorSegments};
}
export function applyReviewedMalcociCurrentOsmGeometry({country,raw,geo,report}){
 if(country!=='MD')return false;
 if(!(raw?.elements||[]).some(e=>e.type==='relation'&&e.id===cfg.relation_id))throw Error('Malcoci source relation missing; re-review required');
 const index=(geo?.features||[]).findIndex(f=>String(f.id)==='relation/'+cfg.relation_id);
 if(index<0)throw Error('Malcoci source feature missing; re-review required');
 const sourceFeature=geo.features[index];
 if(validSourcePolygon(sourceFeature))return false;
 const derived=deriveReviewedMalcociCurrentOsmGeometry(raw);
 geo.features[index]={...sourceFeature,geometry:derived.geometry,properties:{...sourceFeature.properties,...derived.provenance,geometry_derivation_audit:derived.audit}};
 report?.warnings?.push({type:cfg.derivation,jurisdiction:country,relation_id:cfg.relation_id,...derived.provenance,...derived.audit});
 return true;
}
