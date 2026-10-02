import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';

export const SOURCE_BUNDLE_PATH='data/current/actual-source-bundle-manifest.json';
export const SOURCE_BUNDLE_GATE_PATH='data/current/actual-source-bundle-gate.json';
export const SOURCE_BUNDLE_ALGORITHM='actual-source-bundle-v1';
export const SOURCE_PATHS={
 osm:'data/sources/osm-current.json',
 siruta:'data/sources/ro-siruta-current.json',
 cuatm:'data/sources/cuatm-current.json',
 ro_bretcu_ancpi:'data/sources/ro-bretcu-ancpi-current.json',
 settlement_policy:'data/sources/actual-settlement-policy.json'
};
export const sha256=value=>createHash('sha256').update(value).digest('hex');

export function canonicalizeSourceBundle(value){
 if(Array.isArray(value))return value.map(canonicalizeSourceBundle);
 if(value&&typeof value==='object'){
  return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonicalizeSourceBundle(value[key])]));
 }
 return value;
}

export function sourceBundleFingerprint(bundle){
 const payload=canonicalizeSourceBundle({
  algorithm:SOURCE_BUNDLE_ALGORITHM,
  sources:bundle?.sources??null
 });
 return {
  algorithm:SOURCE_BUNDLE_ALGORITHM,
  sha256:sha256(Buffer.from(JSON.stringify(payload),'utf8')),
  payload
 };
}

const iso=value=>{
 const date=new Date(value);
 return Number.isFinite(date.getTime())?date.toISOString():null;
};

export async function inspectCurrentSourceInputs({readFileFn=readFile}={}){
 const [osmBytes,sirutaBytes,cuatmBytes,settlementPolicyBytes]=await Promise.all([
  readFileFn(SOURCE_PATHS.osm),
  readFileFn(SOURCE_PATHS.siruta),
  readFileFn(SOURCE_PATHS.cuatm),
  readFileFn(SOURCE_PATHS.settlement_policy)
 ]);
 const osm=JSON.parse(osmBytes.toString('utf8'));
 const siruta=JSON.parse(sirutaBytes.toString('utf8'));
 const cuatm=JSON.parse(cuatmBytes.toString('utf8'));
 const settlementPolicy=JSON.parse(settlementPolicyBytes.toString('utf8'));
 const bretcuBinding=(settlementPolicy?.jurisdictions?.RO?.official_geometry_exceptions||[])
  .find(x=>String(x?.legal_id)==='64096');
 let bretcuAncpi=null,bretcuAncpiBytes=null;
 if(bretcuBinding){
  if(bretcuBinding.source_path!==SOURCE_PATHS.ro_bretcu_ancpi)throw new Error('Unexpected Brețcu official geometry source path');
  bretcuAncpiBytes=await readFileFn(SOURCE_PATHS.ro_bretcu_ancpi);
  bretcuAncpi=JSON.parse(bretcuAncpiBytes.toString('utf8'));
  const feature=bretcuAncpi?.feature;
  if(bretcuAncpi?.schema_version!==1||bretcuAncpi?.mode!=='ACTUAL_RO_OFFICIAL_GEOMETRY_EXCEPTION')throw new Error('Invalid Brețcu ANCPI source envelope');
  if(bretcuAncpi?.jurisdiction!=='RO'||String(bretcuAncpi?.legal_id)!=='64096'||bretcuAncpi?.authority?.includes('ANCPI')!==true)throw new Error('Brețcu ANCPI source identity mismatch');
  if(String(feature?.properties?.nationalCode)!=='64096'||feature?.properties?.nationalLevel!=='3rdOrder')throw new Error('Brețcu ANCPI feature identity mismatch');
  if(!['Polygon','MultiPolygon'].includes(feature?.geometry?.type)||!Array.isArray(feature?.geometry?.coordinates)||!feature.geometry.coordinates.length)throw new Error('Brețcu ANCPI source has invalid polygon geometry');
 }
 const countries={};
 for(const code of ['RO','MD']){
  const entry=osm.countries?.[code];
  if(!entry?.snapshot_path)throw new Error('Missing OSM snapshot path for '+code);
  const compressed=await readFileFn(entry.snapshot_path);
  const compressedSha=sha256(compressed);
  if(compressedSha!==entry.compressed_sha256)throw new Error(code+' compressed OSM snapshot SHA-256 mismatch');
  const canonical=gunzipSync(compressed);
  const semanticSha=sha256(canonical);
  if(semanticSha!==entry.semantic_sha256)throw new Error(code+' semantic OSM snapshot SHA-256 mismatch');
  const raw=JSON.parse(canonical.toString('utf8'));
  if((raw.elements||[]).length!==entry.element_count)throw new Error(code+' OSM element count mismatch');
  countries[code]={
   snapshot_path:entry.snapshot_path,
   compressed_sha256:compressedSha,
   semantic_sha256:semanticSha,
   query_sha256:entry.query_sha256??null,
   element_count:entry.element_count??null,
   relation_count:entry.relation_count??null,
   snapshot_at:entry.snapshot_at??null
  };
 }
 const timestamps=[
  osm.snapshot_at,
  ...Object.values(countries).map(x=>x.snapshot_at),
  siruta.fetched_at,
  cuatm.fetched_at,
  bretcuAncpi?.dataset_metadata_modified
 ].map(iso).filter(Boolean);
 const sourceWatermark=(timestamps.length?new Date(Math.max(...timestamps.map(x=>new Date(x).getTime()))):new Date(0)).toISOString();
 return {
  source_watermark:sourceWatermark,
  sources:{
   osm:{
    manifest_path:SOURCE_PATHS.osm,
    manifest_sha256:sha256(osmBytes),
    snapshot_at:osm.snapshot_at??null,
    countries
   },
   siruta:{
    path:SOURCE_PATHS.siruta,
    sha256:sha256(sirutaBytes),
    registry:siruta.registry??'SIRUTA',
    reference_year:siruta.reference_year??null,
    source_content_sha256:siruta.source?.content_sha256??null,
    semantic_sha256:siruta.semantic_sha256??null,
    fetched_at:siruta.fetched_at??null,
    record_count:siruta.record_count??(Array.isArray(siruta.records)?siruta.records.length:null)
   },
   cuatm:{
    path:SOURCE_PATHS.cuatm,
    sha256:sha256(cuatmBytes),
    registry:cuatm.registry??'CUATM',
    source_url:cuatm.source_url??null,
    fetched_at:cuatm.fetched_at??null,
    record_count:cuatm.record_count??(Array.isArray(cuatm.records)?cuatm.records.length:null)
   },
   ...(bretcuAncpi?{
    ro_bretcu_ancpi:{
     path:SOURCE_PATHS.ro_bretcu_ancpi,
     sha256:sha256(bretcuAncpiBytes),
     authority:bretcuAncpi.authority,
     license:bretcuAncpi.license,
     dataset:bretcuAncpi.dataset,
     dataset_metadata_modified:bretcuAncpi.dataset_metadata_modified,
     arcgis_item_id:bretcuAncpi.arcgis_item_id,
     arcgis_layer_id:bretcuAncpi.arcgis_layer_id,
     source_feature_id:bretcuAncpi.source_feature_id,
     legal_registry:bretcuAncpi.legal_registry,
     legal_id:bretcuAncpi.legal_id,
     geometry_role:bretcuAncpi.geometry_role,
     geometry_scope:bretcuAncpi.geometry_scope,
     geometry_sha256:sha256(Buffer.from(JSON.stringify(bretcuAncpi.feature.geometry),'utf8'))
    }
   }:{})
  }
 };
}

export function buildSourceBundleManifest(inspected){
 const draft={
  schema_version:1,
  mode:'ACTUAL_SOURCE_BUNDLE',
  source_watermark:inspected.source_watermark,
  policy:inspected.sources?.ro_bretcu_ancpi
   ?'Exact provenance binding for ACTUAL inputs. The bundle cryptographically binds the OSM manifest and both durable raw OSM snapshots, the official RO SIRUTA snapshot, the official MD CUATM snapshot, and the explicitly activated ANCPI Brețcu official geometry exception. Runtime clocks are excluded; identical source bytes reproduce identical bundle bytes.'
   :'Exact provenance binding for ACTUAL inputs. The bundle cryptographically binds the OSM manifest and both durable raw OSM snapshots, the official RO SIRUTA snapshot, and the official MD CUATM snapshot. Runtime clocks are excluded; identical source bytes reproduce identical bundle bytes.',
  sources:inspected.sources
 };
 const fingerprint=sourceBundleFingerprint(draft);
 return {
  schema_version:draft.schema_version,
  mode:draft.mode,
  source_watermark:draft.source_watermark,
  bundle_fingerprint_algorithm:fingerprint.algorithm,
  bundle_fingerprint_sha256:fingerprint.sha256,
  policy:draft.policy,
  sources:draft.sources
 };
}

export async function validateSourceBundleManifest(bundle,{readFileFn=readFile}={}){
 const checks=[],failures=[];
 const check=(name,ok,detail={})=>{
  checks.push({name,ok:Boolean(ok),detail});
  if(!ok)failures.push({name,detail});
 };
 let current=null,error=null;
 try{current=await inspectCurrentSourceInputs({readFileFn});}
 catch(err){error=err;}
 check('bundle_schema_and_mode',
  bundle?.schema_version===1&&bundle?.mode==='ACTUAL_SOURCE_BUNDLE',
  {schema_version:bundle?.schema_version??null,mode:bundle?.mode??null});
 if(error){
  check('bundle_source_watermark_matches_current_sources',false,{error:error.message});
  check('bundle_sources_match_current_sources',false,{error:error.message});
 }else{
  check('bundle_source_watermark_matches_current_sources',
   bundle?.source_watermark===current.source_watermark,
   {expected:current.source_watermark,actual:bundle?.source_watermark??null});
  const expected=JSON.stringify(canonicalizeSourceBundle(current.sources));
  const actual=JSON.stringify(canonicalizeSourceBundle(bundle?.sources??null));
  check('bundle_sources_match_current_sources',actual===expected,{source_count:Object.keys(current.sources).length,osm_country_count:Object.keys(current.sources.osm.countries).length});
 }
 const fingerprint=sourceBundleFingerprint(bundle);
 check('bundle_fingerprint_matches_current_sources',
  bundle?.bundle_fingerprint_algorithm===fingerprint.algorithm
  && bundle?.bundle_fingerprint_sha256===fingerprint.sha256,
  {algorithm:fingerprint.algorithm,expected:fingerprint.sha256,actual:bundle?.bundle_fingerprint_sha256??null});
 return {status:failures.length?'FAIL':'PASS',checks,failures,current,fingerprint};
}
