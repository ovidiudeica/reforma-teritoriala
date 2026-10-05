import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';

export const MD_MALCOCI_INVALID_OSM_FALLBACK=Object.freeze({
 relation_id:18968071,
 legal_id:'5520',
 expected_relation_version:8,
 expected_relation_changeset:190022801,
 expected_relation_timestamp:'2026-10-05T09:21:08Z',
 expected_members:Object.freeze([
  Object.freeze({ref:1565133362,role:'outer',version:1,changeset:190022801,timestamp:'2026-10-05T09:21:08Z'}),
  Object.freeze({ref:1565133360,role:'outer',version:1,changeset:190022801,timestamp:'2026-10-05T09:21:08Z'}),
  Object.freeze({ref:1565092221,role:'outer',version:1,changeset:190015997,timestamp:'2026-10-05T07:00:47Z'}),
  Object.freeze({ref:1565092216,role:'outer',version:1,changeset:190015997,timestamp:'2026-10-05T07:00:47Z'}),
  Object.freeze({ref:1555122788,role:'',version:1,changeset:188527021,timestamp:'2026-09-04T13:57:10Z'}),
  Object.freeze({ref:1376180717,role:'outer',version:8,changeset:190033096,timestamp:'2026-10-05T12:34:25Z'}),
  Object.freeze({ref:1565133361,role:'outer',version:1,changeset:190022801,timestamp:'2026-10-05T09:21:08Z'})
 ]),
 expected_odd_endpoints:Object.freeze([
  Object.freeze({node_id:353223870,coordinate:Object.freeze([28.6176407,47.0341981])}),
  Object.freeze({node_id:1379403420,coordinate:Object.freeze([28.617828,47.0343526])})
 ]),
 fallback_snapshot:Object.freeze({
  path:'data/sources/osm-snapshots/md-057890e4d6b1bd6d76e98576622f2c727958dad82f902ec5c39d87bcc1b223fe.json.gz',
  semantic_sha256:'057890e4d6b1bd6d76e98576622f2c727958dad82f902ec5c39d87bcc1b223fe',
  compressed_sha256:'e55945a99b0b26e1ee09bbf26cd3c64bfe957acf6147936900f253f981f009dc',
  snapshot_at:'2026-09-27T20:33:04.478Z'
 }),
 policy:'Retain the last cryptographically bound valid OSM polygon for relation 18968071 only while the authoritative live OSM relation matches the exact reviewed open-ring defect. Never fabricate the missing closure segment. Any upstream relation/way/node drift fails closed and requires re-review.'
});

const sha256=value=>createHash('sha256').update(value).digest('hex');
const sameCoord=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&Number(a[0])===Number(b[0])&&Number(a[1])===Number(b[1]);
const relationId=feature=>{
 const match=String(feature?.id||'').match(/relation\/(\d+)/);
 return match?Number(match[1]):null;
};

export function inspectMalcociInvalidOsmContract(raw){
 const cfg=MD_MALCOCI_INVALID_OSM_FALLBACK;
 const elements=Array.isArray(raw?.elements)?raw.elements:[];
 const relation=elements.find(x=>x.type==='relation'&&Number(x.id)===cfg.relation_id);
 if(!relation)throw new Error('Reviewed Malcoci OSM relation is missing');
 if(
  Number(relation.version)!==cfg.expected_relation_version
  ||Number(relation.changeset)!==cfg.expected_relation_changeset
  ||relation.timestamp!==cfg.expected_relation_timestamp
  ||String(relation.tags?.['ref:cuatm:codunic']||'')!==cfg.legal_id
  ||String(relation.tags?.admin_level||'')!=='9'
  ||relation.tags?.boundary!=='administrative'
 ){
  throw new Error('Reviewed Malcoci OSM relation contract drift');
 }

 const wayById=new Map(elements.filter(x=>x.type==='way').map(x=>[Number(x.id),x]));
 const nodeById=new Map(elements.filter(x=>x.type==='node').map(x=>[Number(x.id),x]));
 const actualMembers=(relation.members||[]).filter(x=>x.type==='way').map(x=>({ref:Number(x.ref),role:String(x.role||'')}));
 if(actualMembers.length!==cfg.expected_members.length)throw new Error('Reviewed Malcoci OSM member count drift');

 for(let i=0;i<cfg.expected_members.length;i++){
  const expected=cfg.expected_members[i],actual=actualMembers[i];
  if(actual.ref!==expected.ref||actual.role!==expected.role)throw new Error('Reviewed Malcoci OSM member order/role drift');
  const way=wayById.get(expected.ref);
  if(!way)throw new Error('Reviewed Malcoci OSM member way missing '+expected.ref);
  if(Number(way.version)!==expected.version||Number(way.changeset)!==expected.changeset||way.timestamp!==expected.timestamp){
   throw new Error('Reviewed Malcoci OSM member way contract drift '+expected.ref);
  }
 }

 const endpointCounts=new Map();
 for(const {ref} of actualMembers){
  const way=wayById.get(ref);
  if(!Array.isArray(way?.nodes)||way.nodes.length<2)throw new Error('Reviewed Malcoci OSM member way has invalid node chain '+ref);
  for(const nodeId of [Number(way.nodes[0]),Number(way.nodes.at(-1))])endpointCounts.set(nodeId,(endpointCounts.get(nodeId)||0)+1);
 }
 const odd=[...endpointCounts.entries()].filter(([,count])=>count%2===1).map(([node_id,count])=>{
  const node=nodeById.get(node_id);
  if(!node)throw new Error('Reviewed Malcoci OSM odd endpoint node missing '+node_id);
  return {node_id,count,coordinate:[Number(node.lon),Number(node.lat)]};
 }).sort((a,b)=>a.node_id-b.node_id);
 const expectedOdd=[...cfg.expected_odd_endpoints].map(x=>({node_id:x.node_id,count:1,coordinate:[...x.coordinate]})).sort((a,b)=>a.node_id-b.node_id);
 if(odd.length!==expectedOdd.length||odd.some((x,i)=>x.node_id!==expectedOdd[i].node_id||x.count!==1||!sameCoord(x.coordinate,expectedOdd[i].coordinate))){
  throw new Error('Reviewed Malcoci OSM open-ring endpoint contract drift');
 }
 return {relation,odd_endpoints:odd};
}

export function assertMalcociGeojsonIsExactlyOpenAtReviewedEndpoints(feature){
 const cfg=MD_MALCOCI_INVALID_OSM_FALLBACK;
 if(relationId(feature)!==cfg.relation_id||feature?.geometry?.type!=='Polygon')throw new Error('Reviewed Malcoci GeoJSON feature contract drift');
 const rings=feature.geometry.coordinates||[];
 if(rings.length!==1||!Array.isArray(rings[0])||rings[0].length<4)throw new Error('Reviewed Malcoci GeoJSON ring structure drift');
 const ring=rings[0],first=ring[0],last=ring.at(-1);
 if(sameCoord(first,last))throw new Error('Reviewed Malcoci OSM geometry is now closed; remove stale fallback and re-review live OSM geometry');
 const endpoints=cfg.expected_odd_endpoints.map(x=>x.coordinate);
 const forward=sameCoord(first,endpoints[0])&&sameCoord(last,endpoints[1]);
 const reverse=sameCoord(first,endpoints[1])&&sameCoord(last,endpoints[0]);
 if(!forward&&!reverse)throw new Error('Reviewed Malcoci GeoJSON open-ring coordinates drift');
 return {first,last};
}

export async function applyReviewedMalcociLastValidOsmGeometry({country,raw,geo,report,readFileFn=readFile,convertRawToGeoJson}){
 if(country!=='MD')return false;
 const cfg=MD_MALCOCI_INVALID_OSM_FALLBACK;
 inspectMalcociInvalidOsmContract(raw);
 const liveFeature=(geo?.features||[]).find(x=>relationId(x)===cfg.relation_id);
 if(!liveFeature)throw new Error('Reviewed Malcoci live GeoJSON feature missing');
 assertMalcociGeojsonIsExactlyOpenAtReviewedEndpoints(liveFeature);

 const compressed=await readFileFn(cfg.fallback_snapshot.path);
 if(sha256(compressed)!==cfg.fallback_snapshot.compressed_sha256)throw new Error('Reviewed Malcoci fallback compressed snapshot hash mismatch');
 const canonical=gunzipSync(compressed);
 if(sha256(canonical)!==cfg.fallback_snapshot.semantic_sha256)throw new Error('Reviewed Malcoci fallback semantic snapshot hash mismatch');
 const fallbackRaw=JSON.parse(canonical.toString('utf8'));
 if(typeof convertRawToGeoJson!=='function')throw new Error('Reviewed Malcoci fallback requires an explicit OSM-to-GeoJSON converter');
 const fallbackGeo=convertRawToGeoJson(fallbackRaw,{flatProperties:false});
 const fallbackFeature=(fallbackGeo.features||[]).find(x=>relationId(x)===cfg.relation_id);
 if(!fallbackFeature||!['Polygon','MultiPolygon'].includes(fallbackFeature.geometry?.type))throw new Error('Reviewed Malcoci fallback polygon missing');
 const fallbackRings=fallbackFeature.geometry.type==='Polygon'?fallbackFeature.geometry.coordinates:fallbackFeature.geometry.coordinates.flat();
 if(fallbackRings.some(r=>!Array.isArray(r)||r.length<4||!sameCoord(r[0],r.at(-1))))throw new Error('Reviewed Malcoci fallback snapshot does not contain closed polygon rings');

 liveFeature.geometry=structuredClone(fallbackFeature.geometry);
 liveFeature.properties={
  ...(liveFeature.properties||{}),
  topology_normalization:'reviewed_last_valid_osm_geometry_fallback',
  topology_evidence:'issue #204; authoritative OSM relation 18968071 is currently open',
  geometry_source_snapshot_at:cfg.fallback_snapshot.snapshot_at,
  geometry_source_snapshot_semantic_sha256:cfg.fallback_snapshot.semantic_sha256,
  live_osm_relation_version:cfg.expected_relation_version,
  live_osm_relation_changeset:cfg.expected_relation_changeset,
  live_osm_open_ring_preserved_as_source_defect:true,
  fabricated_closure:false
 };
 report?.warnings?.push({
  type:'reviewed_last_valid_osm_geometry_fallback',
  jurisdiction:'MD',
  relation_id:cfg.relation_id,
  legal_id:cfg.legal_id,
  live_relation_version:cfg.expected_relation_version,
  live_relation_changeset:cfg.expected_relation_changeset,
  odd_endpoints:cfg.expected_odd_endpoints,
  fallback_snapshot_path:cfg.fallback_snapshot.path,
  fallback_snapshot_semantic_sha256:cfg.fallback_snapshot.semantic_sha256,
  geometry_source_snapshot_stale:true,
  fabricated_closure:false,
  policy:cfg.policy
 });
 return true;
}
