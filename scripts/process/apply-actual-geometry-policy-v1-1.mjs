#!/usr/bin/env node
import {readFile,writeFile} from 'node:fs/promises';

const POLICY='data/sources/actual-settlement-policy.json';
const CONTRACT='schemas/actual-geometry-role-contract.json';
const ANCPI_FALLBACK='data/sources/ro-ancpi-uat-fallbacks.json';
const OJDULA_REVIEW='data/sources/ro-ancpi-ojdula-reviewed.json';

const policy=JSON.parse(await readFile(POLICY,'utf8'));
const contract=JSON.parse(await readFile(CONTRACT,'utf8'));
const ancpiFallback=JSON.parse(await readFile(ANCPI_FALLBACK,'utf8'));
const ojdulaReview=JSON.parse(await readFile(OJDULA_REVIEW,'utf8'));

if(policy.schema_version!==1||policy.mode!=='ACTUAL'||policy.scope!=='settlements_and_component_localities'){
 throw new Error('Unexpected ACTUAL settlement policy baseline.');
}
if(contract.schema_version!==1||contract.contract!=='actual-geometry-role-v1'||contract.mode!=='ACTUAL'){
 throw new Error('Unexpected ACTUAL geometry-role contract.');
}
if(ancpiFallback.schema_version!==1||ancpiFallback.mode!=='ACTUAL_RO_ANCPI_UAT_FALLBACKS'){
 throw new Error('Unexpected ANCPI/RELUAT UAT fallback source contract.');
}
if(
 ojdulaReview.schema_version!==1
 ||ojdulaReview.mode!=='ACTUAL_RO_ANCPI_REVIEWED_GEOMETRY_OVERRIDE'
 ||String(ojdulaReview.feature?.legal_id)!=='64602'
 ||Number(ojdulaReview.feature?.replacement_osm_relation_id)!==14735731
){
 throw new Error('Unexpected reviewed Ojdula geometry override.');
}

const features=Array.isArray(ancpiFallback.features)?structuredClone(ancpiFallback.features):[];
const byId=new Map(features.map(x=>[String(x.legal_id),x]));
if(!byId.has('64096'))throw new Error('Brețcu SIRUTA 64096 fallback must already exist.');
if(!byId.has('64602'))features.push(structuredClone(ojdulaReview.feature));
const ids=features.map(x=>String(x.legal_id)).sort();
if(JSON.stringify(ids)!==JSON.stringify(['64096','64602'])){
 throw new Error('Reviewed ANCPI fallback set must be exactly Brețcu 64096 + Ojdula 64602.');
}
for(const f of features){
 if(
  f.legal_registry!=='SIRUTA'
  ||f.geometry_role!=='administrative_boundary'
  ||f.geometry_scope!=='uat_fallback'
  ||!['Polygon','MultiPolygon'].includes(f.geometry?.type)
 ){
  throw new Error('Invalid ANCPI fallback feature '+f.legal_id);
 }
}

ancpiFallback.features=features.sort((a,b)=>String(a.legal_id).localeCompare(String(b.legal_id)));
ancpiFallback.source={
 ...ancpiFallback.source,
 query_set:{
  '64096':'nationalCode=64096; outSR=EPSG:4326',
  '64602':'nationalCode=64602; outSR=EPSG:4326'
 },
 raw_response_sha256_by_legal_id:{
  '64096':ancpiFallback.source?.raw_response_sha256??null,
  '64602':ojdulaReview.source?.raw_response_sha256??null
 }
};
await writeFile(ANCPI_FALLBACK,JSON.stringify(ancpiFallback,null,2)+'\n');

const migrated=structuredClone(policy);
migrated.policy_version='2026-10-03-v1.3';
migrated.coverage_contract_version=2;
migrated.geometry_role_contract={
 path:CONTRACT,
 contract:contract.contract,
 schema_version:contract.schema_version
};
migrated.jurisdictions.RO.official_inventory_selector='SIRUTA records whose level is 3';
migrated.jurisdictions.RO.coverage_accounting='unique_official_legal_identity';
migrated.jurisdictions.MD.coverage_accounting='unique_official_legal_identity';
migrated.public_contract='actual-public-entity-v2';
migrated.administrative_geometry_fallbacks={
 ...(migrated.administrative_geometry_fallbacks||{}),
 RO:{
  path:ANCPI_FALLBACK,
  mode:ancpiFallback.mode,
  authority:ancpiFallback.source?.authority??null,
  arcgis_item_id:ancpiFallback.source?.arcgis_item_id??null,
  geometry_role:'administrative_boundary',
  geometry_scope:'uat_fallback',
  legal_ids:['64096','64602'],
  legal_identity_authority:'SIRUTA',
  legal_geometry_equivalence_asserted:false,
  reviewed_geometry_overrides:[{
   legal_id:'64602',
   entity_id:'osm-r14735731',
   osm_relation_id:14735731,
   evidence:OJDULA_REVIEW,
   disposition:'replace_osm_geometry_keep_stable_entity_id'
  }]
 }
};

await writeFile(POLICY,JSON.stringify(migrated,null,2)+'\n');
console.log(JSON.stringify({
 status:'PASS',
 policy_path:POLICY,
 policy_version:migrated.policy_version,
 legal_ids:migrated.administrative_geometry_fallbacks.RO.legal_ids,
 reviewed_geometry_overrides:migrated.administrative_geometry_fallbacks.RO.reviewed_geometry_overrides
},null,2));
