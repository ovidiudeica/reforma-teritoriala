#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';

const POLICY='data/sources/actual-settlement-policy.json';
const CONTRACT='schemas/actual-geometry-role-contract.json';
const ANCPI_FALLBACK='data/sources/ro-ancpi-uat-fallbacks.json';
const OJDULA_REVIEW='data/sources/ro-ancpi-ojdula-reviewed.json';
const sha256=value=>createHash('sha256').update(value).digest('hex');

const policy=JSON.parse(await readFile(POLICY,'utf8'));
const contract=JSON.parse(await readFile(CONTRACT,'utf8'));
const ancpiBytes=await readFile(ANCPI_FALLBACK);
const ancpiFallback=JSON.parse(ancpiBytes.toString('utf8'));
const ojdulaBytes=await readFile(OJDULA_REVIEW);
const ojdulaReview=JSON.parse(ojdulaBytes.toString('utf8'));

if(policy.schema_version!==1||policy.mode!=='ACTUAL'||policy.scope!=='settlements_and_component_localities')throw new Error('Unexpected ACTUAL settlement policy baseline.');
if(contract.schema_version!==1||contract.contract!=='actual-geometry-role-v1'||contract.mode!=='ACTUAL')throw new Error('Unexpected ACTUAL geometry-role contract.');
if(ancpiFallback.schema_version!==1||ancpiFallback.mode!=='ACTUAL_RO_ANCPI_UAT_FALLBACKS')throw new Error('Unexpected ANCPI/RELUAT UAT fallback source contract.');
const fallbackFeatures=Array.isArray(ancpiFallback.features)?ancpiFallback.features:[];
if(fallbackFeatures.length!==1||String(fallbackFeatures[0]?.legal_id)!=='64096')throw new Error('Reviewed missing-UAT fallback must remain exactly Brețcu SIRUTA 64096.');
if(
 ojdulaReview.schema_version!==1
 ||ojdulaReview.mode!=='ACTUAL_RO_ANCPI_REVIEWED_GEOMETRY_OVERRIDE'
 ||String(ojdulaReview.feature?.legal_id)!=='64602'
 ||Number(ojdulaReview.feature?.replacement_osm_relation_id)!==14735731
 ||ojdulaReview.feature?.geometry_role!=='administrative_boundary'
 ||ojdulaReview.feature?.geometry_scope!=='uat_fallback'
 ||!['Polygon','MultiPolygon'].includes(ojdulaReview.feature?.geometry?.type)
)throw new Error('Unexpected reviewed Ojdula geometry override.');

const migrated=structuredClone(policy);
migrated.policy_version='2026-10-04-v1.4';
migrated.coverage_contract_version=2;
migrated.geometry_role_contract={path:CONTRACT,contract:contract.contract,schema_version:contract.schema_version};
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
  legal_ids:['64096'],
  legal_identity_authority:'SIRUTA',
  legal_geometry_equivalence_asserted:false,
  reviewed_geometry_overrides:[{
   legal_id:'64602',
   entity_id:'osm-r14735731',
   osm_relation_id:14735731,
   evidence:OJDULA_REVIEW,
   evidence_sha256:sha256(ojdulaBytes),
   source:'OSM shell + ANCPI shared boundary',
   source_object_id:1167,
   inspire_id_local_id:'1.145.64602',
   paired_legal_id:'64096',
   paired_entity_id:'siruta-u64096',
   disposition:'partition_osm_shell_by_ancpi_shared_boundary'
  }]
 }
};
await writeFile(POLICY,JSON.stringify(migrated,null,2)+'\n');
console.log(JSON.stringify({
 status:'PASS',
 policy_path:POLICY,
 policy_version:migrated.policy_version,
 missing_uat_fallback_ids:migrated.administrative_geometry_fallbacks.RO.legal_ids,
 reviewed_geometry_overrides:migrated.administrative_geometry_fallbacks.RO.reviewed_geometry_overrides
},null,2));
