#!/usr/bin/env node
import {readFile,writeFile} from 'node:fs/promises';

const POLICY='data/sources/actual-settlement-policy.json';
const FALLBACK='data/sources/ro-ancpi-uat-fallbacks.json';
const policy=JSON.parse(await readFile(POLICY,'utf8'));
const fallback=JSON.parse(await readFile(FALLBACK,'utf8'));

if(policy.schema_version!==1||policy.mode!=='ACTUAL'||Number(policy.coverage_contract_version)!==2){
 throw new Error('Unexpected ACTUAL geometry policy baseline.');
}
if(fallback.schema_version!==1||fallback.mode!=='ACTUAL_RO_ANCPI_UAT_FALLBACKS'){
 throw new Error('Unexpected ANCPI fallback source contract.');
}
const features=Array.isArray(fallback.features)?fallback.features:[];
if(features.length!==1||String(features[0]?.legal_id)!=='64096'){
 throw new Error('P1.2 migration requires exactly the reviewed Brețcu SIRUTA 64096 fallback.');
}

const migrated=structuredClone(policy);
migrated.policy_version='2026-10-03-v1.2';
migrated.administrative_geometry_fallbacks={
 ...(migrated.administrative_geometry_fallbacks||{}),
 RO:{
  path:FALLBACK,
  mode:fallback.mode,
  authority:fallback.source?.authority??null,
  arcgis_item_id:fallback.source?.arcgis_item_id??null,
  geometry_role:'administrative_boundary',
  geometry_scope:'uat_fallback',
  legal_ids:['64096'],
  legal_identity_authority:'SIRUTA',
  legal_geometry_equivalence_asserted:false
 }
};

await writeFile(POLICY,JSON.stringify(migrated,null,2)+'\n');
console.log(JSON.stringify({
 status:'PASS',
 policy_path:POLICY,
 policy_version:migrated.policy_version,
 administrative_geometry_fallbacks:migrated.administrative_geometry_fallbacks
},null,2));
