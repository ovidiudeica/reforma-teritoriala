import {readFile} from 'node:fs/promises';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import osmtogeojson from 'osmtogeojson';
import {deriveReviewedMalcociCurrentOsmGeometry,geometrySegments,segmentDifference,validSourcePolygon} from './md-current-osm-boundary-derivation.mjs';
import {buildBretcuOjdulaHybridPartition} from './bretcu-ojdula-hybrid-partition.mjs';
const sha256=b=>createHash('sha256').update(b).digest('hex');
const entityId=f=>f.properties?.catalog_id||(/^relation\/\d+$/.test(String(f.id))?'osm-r'+String(f.id).split('/')[1]:null);
export function auditCountryOsmFidelity({country,raw,master,reviewedGeometries={}}){
 const source=osmtogeojson(raw,{flatProperties:false}),sourceById=new Map(source.features.map(f=>[entityId(f),f]));
 const issues=[],exceptions=[],seen=new Set();let checked=0,pure=0;
 for(const f of master.features||[]){
  const id=entityId(f);if(!id||seen.has(id)){issues.push({entity_id:id,issue:'missing_or_duplicate_entity_id'});continue;}seen.add(id);
  let expected=sourceById.get(id)?.geometry,provenance=null,exception=null;
  if(country==='MD'&&id==='osm-r18968071'&&expected&&!validSourcePolygon(sourceById.get(id))){
   try{const derived=deriveReviewedMalcociCurrentOsmGeometry(raw);expected=derived.geometry;provenance=derived.provenance;exception=derived.provenance.geometry_derivation;}
   catch(e){issues.push({entity_id:id,issue:'reviewed_current_osm_contract_failed',message:e.message});continue;}
  }else if(country==='RO'&&['osm-r14735731','siruta-u64096'].includes(id)&&reviewedGeometries[id]){expected=reviewedGeometries[id];exception='reviewed_bretcu_ojdula_ancpi_partition_or_fallback';}
  else if(!id.startsWith('osm-r')){issues.push({entity_id:id,issue:'unreviewed_non_osm_geometry'});continue;}
  if(!expected){issues.push({entity_id:id,issue:'source_geometry_missing'});continue;}
  if(f.properties?.geometry_derivation&&!provenance){issues.push({entity_id:id,issue:'unreviewed_or_expired_derivation_marker'});continue;}
  if(provenance&&Object.entries(provenance).some(([k,v])=>JSON.stringify(f.properties?.[k])!==JSON.stringify(v))){issues.push({entity_id:id,issue:'reviewed_derivation_provenance_drift'});continue;}
  const diff=segmentDifference(geometrySegments(expected),geometrySegments(f.geometry));checked++;
  if(diff.missing.length||diff.extra.length)issues.push({entity_id:id,issue:'boundary_segment_drift',missing:diff.missing.length,extra:diff.extra.length});
  if(exception)exceptions.push({entity_id:id,derivation:exception,missing:diff.missing.length,extra:diff.extra.length});else pure++;
 }
 return {country,status:issues.length?'FAIL':'PASS',checked,pure_osm_checked:pure,exceptions,issues};
}
export async function auditActualOsmFidelity({readFileFn=readFile}={}){
 const json=async path=>JSON.parse(await readFileFn(path,'utf8'));
 const manifest=await json('data/sources/osm-current.json');const results=[];
 const roReviewed={};
 const roMaster=await json('public/geo/current/ro-administrative.geojson');
 const hasHybrid=roMaster.features.some(f=>f.properties?.catalog_id==='osm-r14735731'&&f.properties?.geometry_scope==='uat_hybrid_partition');
 if(hasHybrid){
  const shell=await json('data/sources/ro-osm-ojdula-14735731-reviewed-shell.json'),ojdula=await json('data/sources/ro-ancpi-ojdula-reviewed.json'),ancpi=await json('data/sources/ro-ancpi-uat-fallbacks.json');
  if(shell.relation_id!==14735731||shell.source_commit_sha!=='f21e4954063a884df9922efa5ac31229c5b51d43'||shell.source_snapshot_id!=='actual-990c892d9d27fa46')throw Error('Reviewed Brețcu–Ojdula source shell contract drift');
  const partition=buildBretcuOjdulaHybridPartition({osmOjdulaGeometry:shell.geometry,ancpiOjdulaGeometry:ojdula.feature.geometry,ancpiBretcuGeometry:ancpi.features.find(f=>String(f.legal_id)==='64096').geometry});
  roReviewed['osm-r14735731']=partition.ojdula_geometry;roReviewed['siruta-u64096']=partition.bretcu_geometry;
 }else if(roMaster.features.some(f=>f.properties?.catalog_id==='siruta-u64096')){
  const ancpi=await json('data/sources/ro-ancpi-uat-fallbacks.json');roReviewed['siruta-u64096']=ancpi.features.find(f=>String(f.legal_id)==='64096').geometry;
 }
 for(const country of ['RO','MD']){
  const entry=manifest.countries[country],compressed=await readFileFn(entry.snapshot_path);
  if(sha256(compressed)!==entry.compressed_sha256)throw Error(country+' OSM compressed source hash mismatch');
  const canonical=gunzipSync(compressed);if(sha256(canonical)!==entry.semantic_sha256)throw Error(country+' OSM semantic source hash mismatch');
  const raw=JSON.parse(canonical),master=country==='RO'?roMaster:await json('public/geo/current/md-administrative.geojson');
  const result=auditCountryOsmFidelity({country,raw,master,reviewedGeometries:country==='RO'?roReviewed:{}});result.source_snapshot_at=entry.snapshot_at;result.source_semantic_sha256=entry.semantic_sha256;results.push(result);
 }
 return {status:results.every(r=>r.status==='PASS')?'PASS':'FAIL',comparison:'exact_undirected_boundary_segments',countries:results};
}
