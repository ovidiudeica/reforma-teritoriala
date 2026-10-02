#!/usr/bin/env node
import {readFile,writeFile} from 'node:fs/promises';

const POLICY='data/sources/actual-settlement-policy.json';
const CONTRACT='schemas/actual-geometry-role-contract.json';
const policy=JSON.parse(await readFile(POLICY,'utf8'));
const contract=JSON.parse(await readFile(CONTRACT,'utf8'));

if(policy.schema_version!==1||policy.mode!=='ACTUAL'||policy.scope!=='settlements_and_component_localities'){
 throw new Error('Unexpected ACTUAL settlement policy baseline.');
}
if(contract.schema_version!==1||contract.contract!=='actual-geometry-role-v1'||contract.mode!=='ACTUAL'){
 throw new Error('Unexpected ACTUAL geometry-role contract.');
}

const migrated=structuredClone(policy);
migrated.policy_version='2026-10-03-v1.1-p1.2';
migrated.coverage_contract_version=2;
migrated.geometry_role_contract={
 path:CONTRACT,
 contract:contract.contract,
 schema_version:contract.schema_version
};
migrated.jurisdictions.RO.official_inventory_selector='SIRUTA records whose level is 3';
migrated.jurisdictions.RO.coverage_accounting='unique_official_legal_identity';
migrated.jurisdictions.MD.coverage_accounting='unique_official_legal_identity';
migrated.official_geometry_contract_version=1;
migrated.public_contract='actual-public-entity-v2';
migrated.jurisdictions.RO.official_geometry_exceptions=[{
 legal_id:'64096',
 source_path:'data/sources/ro-bretcu-ancpi-current.json',
 authority:'ANCPI',
 geometry_role:'administrative_boundary',
 geometry_scope:'uat',
 public_entity_id:'ro-siruta-64096'
}];

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
 official_geometry_contract_version:migrated.official_geometry_contract_version,
 public_contract:migrated.public_contract,
 ro_official_geometry_exceptions:migrated.jurisdictions.RO.official_geometry_exceptions
},null,2));
