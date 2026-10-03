#!/usr/bin/env node
import {readFile,writeFile} from 'node:fs/promises';

const POLICY='data/sources/actual-settlement-policy.json';
const CONTRACT='schemas/actual-geometry-role-contract.json';
const ANCPI_FALLBACK='data/sources/ro-ancpi-uat-fallbacks.json';
const OJDULA_FIXTURE='scripts/fixtures/ro-ancpi-ojdula-64602.json';
const REVIEWED_RESOLUTIONS='data/sources/ro-official-only-reviewed-resolutions.json';
const policy=JSON.parse(await readFile(POLICY,'utf8'));
const contract=JSON.parse(await readFile(CONTRACT,'utf8'));
const ancpiFallback=JSON.parse(await readFile(ANCPI_FALLBACK,'utf8'));
const ojdulaFixture=JSON.parse(await readFile(OJDULA_FIXTURE,'utf8'));
const reviewedResolutions=JSON.parse(await readFile(REVIEWED_RESOLUTIONS,'utf8'));

if(policy.schema_version!==1||policy.mode!=='ACTUAL'||policy.scope!=='settlements_and_component_localities'){
 throw new Error('Unexpected ACTUAL settlement policy baseline.');
}
if(contract.schema_version!==1||contract.contract!=='actual-geometry-role-v1'||contract.mode!=='ACTUAL'){
 throw new Error('Unexpected ACTUAL geometry-role contract.');
}
if(ancpiFallback.schema_version!==1||ancpiFallback.mode!=='ACTUAL_RO_ANCPI_UAT_FALLBACKS'){
 throw new Error('Unexpected ANCPI/RELUAT UAT fallback source contract.');
}
const fallbackFeatures=Array.isArray(ancpiFallback.features)?ancpiFallback.features:[];
const fallbackIds=fallbackFeatures.map(x=>String(x?.legal_id||'')).sort();
if(JSON.stringify(fallbackIds)!==JSON.stringify(['64096']))throw new Error('Migration baseline must contain exactly Brețcu 64096.');
if(ojdulaFixture?.schema_version!==1||ojdulaFixture?.mode!=='ACTUAL_RO_ANCPI_REVIEWED_GEOMETRY_PATCH'||String(ojdulaFixture?.feature?.legal_id)!=='64602')throw new Error('Invalid reviewed Ojdula fixture.');
ancpiFallback.features=[...fallbackFeatures,structuredClone(ojdulaFixture.feature)];
ancpiFallback.source.query=ojdulaFixture.source_patch.query;
ancpiFallback.source.raw_response_sha256=ojdulaFixture.source_patch.raw_response_sha256;
const migratedFallbackIds=ancpiFallback.features.map(x=>String(x?.legal_id||'')).sort();
if(JSON.stringify(migratedFallbackIds)!==JSON.stringify(['64096','64602']))throw new Error('Migrated ANCPI fallback set drift.');
if(!(reviewedResolutions.items||[]).some(x=>String(x.legal_id)==='64602'))reviewedResolutions.items.push(structuredClone(ojdulaFixture.resolution));
reviewedResolutions.policy='Reviewed RO UAT geometry exceptions. SIRUTA remains legal identity authority; OSM remains the default geometry source. Where OSM lacks a distinct UAT boundary or a reviewed OSM boundary materially conflicts with the official ANCPI/RELUAT UAT polygon, the exact ANCPI feature may be used as an explicit fallback representation without asserting legal-geometry equivalence.';

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
  legal_geometry_equivalence_asserted:false
 }
};

await writeFile(ANCPI_FALLBACK,JSON.stringify(ancpiFallback,null,2)+'\n');
await writeFile(REVIEWED_RESOLUTIONS,JSON.stringify(reviewedResolutions,null,2)+'\n');
await writeFile(POLICY,JSON.stringify(migrated,null,2)+'\n');
console.log(JSON.stringify({
 status:'PASS',
 policy_path:POLICY,
 policy_version:migrated.policy_version,
 coverage_contract_version:migrated.coverage_contract_version,
 geometry_role_contract:migrated.geometry_role_contract,
 ro_selector:migrated.jurisdictions.RO.official_inventory_selector,
 ro_coverage_accounting:migrated.jurisdictions.RO.coverage_accounting,
 md_coverage_accounting:migrated.jurisdictions.MD.coverage_accounting,
 public_contract:migrated.public_contract,
 administrative_geometry_fallbacks:migrated.administrative_geometry_fallbacks
},null,2));
