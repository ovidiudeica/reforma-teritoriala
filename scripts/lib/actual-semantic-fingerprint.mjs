import {createHash} from 'node:crypto';

const VOLATILE_KEYS=new Set([
 'generated_at','fetched_at','downloaded_at','retrieved_at','created_at','updated_at','imported_at'
]);
const NON_ADMIN_METADATA_KEYS=new Set(['wikipedia','wikidata']);

const sha256=value=>createHash('sha256').update(value).digest('hex');

export function canonicalize(value,{dropNonAdministrativeMetadata=false}={}){
 if(Array.isArray(value))return value.map(x=>canonicalize(x,{dropNonAdministrativeMetadata}));
 if(value&&typeof value==='object'){
  return Object.fromEntries(
   Object.entries(value)
    .filter(([key])=>!VOLATILE_KEYS.has(key)&&!(dropNonAdministrativeMetadata&&NON_ADMIN_METADATA_KEYS.has(key)))
    .sort(([a],[b])=>a.localeCompare(b))
    .map(([key,val])=>[key,canonicalize(val,{dropNonAdministrativeMetadata})])
  );
 }
 return value;
}

export function semanticCatalogEntities(catalog){
 return (catalog?.entities||[])
  .map(entity=>canonicalize(entity,{dropNonAdministrativeMetadata:true}))
  .sort((a,b)=>String(a.id??'').localeCompare(String(b.id??'')));
}

export function semanticGeometry(geojson){
 return (geojson?.features||[])
  .map(feature=>({
   catalog_id:feature?.properties?.catalog_id??null,
   geometry:canonicalize(feature?.geometry??null)
  }))
  .sort((a,b)=>String(a.catalog_id??'').localeCompare(String(b.catalog_id??'')));
}

function semanticRegistry(registry){
 return {
  schema:canonicalize(registry?.schema??null),
  reference_year:registry?.reference_year??null,
  record_count:registry?.record_count??(Array.isArray(registry?.records)?registry.records.length:null),
  records:(registry?.records||[])
   .map(record=>canonicalize(record,{dropNonAdministrativeMetadata:true}))
   .sort((a,b)=>String(a.code??a.CodUnic??'').localeCompare(String(b.code??b.CodUnic??'')))
 };
}

export function actualSemanticPayload(documents){
 const {
  catalog,inventory,roGeo,mdGeo,roOfficial,mdOfficial,mdIndividualReview,settlementPolicy
 }=documents;
 return canonicalize({
  algorithm:'actual-semantic-v1',
  jurisdictions:['RO','MD'],
  catalog:{
   schema_version:catalog?.schema_version??null,
   classifier_version:catalog?.classifier_version??null,
   entity_count:catalog?.entity_count??(catalog?.entities||[]).length,
   entities:semanticCatalogEntities(catalog)
  },
  administrative_model:canonicalize(inventory),
  geometry:{
   RO:semanticGeometry(roGeo),
   MD:semanticGeometry(mdGeo)
  },
  official_registries:{
   RO:semanticRegistry(roOfficial),
   MD:semanticRegistry(mdOfficial)
  },
  reviewed_identity:canonicalize(mdIndividualReview,{dropNonAdministrativeMetadata:true}),
  settlement_policy:canonicalize(settlementPolicy,{dropNonAdministrativeMetadata:true})
 });
}

export function actualSemanticFingerprint(documents){
 const payload=actualSemanticPayload(documents);
 const serialized=JSON.stringify(payload);
 return {
  algorithm:'actual-semantic-v1',
  sha256:sha256(Buffer.from(serialized,'utf8')),
  payload
 };
}

export function byteFingerprintFromHashes(hashes){
 const payload={
  mode:'ACTUAL',
  jurisdictions:['RO','MD'],
  components:Object.fromEntries(Object.entries(hashes).sort(([a],[b])=>a.localeCompare(b)))
 };
 return {
  algorithm:'actual-component-bytes-v1',
  sha256:sha256(Buffer.from(JSON.stringify(payload),'utf8')),
  payload
 };
}
