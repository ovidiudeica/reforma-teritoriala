#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';

const POLICY='data/sources/actual-settlement-policy.json';
const CONTRACT='schemas/actual-geometry-role-contract.json';
const ANCPI_FALLBACK='data/sources/ro-ancpi-uat-fallbacks.json';
const OJDULA_REVIEW='data/sources/ro-ancpi-ojdula-reviewed.json';
const OJDULA_OSM_SHELL='data/sources/ro-osm-ojdula-14735731-reviewed-shell.json';
const TERMINAL_CLOSURE_REVIEW='data/sources/ro-bretcu-ojdula-terminal-closure-reviewed.json';
const STATISTICAL_CONTRACT='schemas/actual-statistical-hierarchy-contract.json';
const STATISTICAL_POLICY='data/sources/actual-statistical-policy.json';
const STATISTICAL_SOURCE_BUNDLE='data/sources/actual-statistical-source-bundle.json';
const RO_STATISTICAL_LAYER='data/p2/actual-statistical-ro.json';
const MD_STATISTICAL_LAYER='data/p2/actual-statistical-md.json';
const RO_STATISTICAL_OSM='data/sources/ro-statistical-osm-current.json';
const MD_STATISTICAL_OSM='data/sources/md-statistical-osm-current.json';
const sha256=value=>createHash('sha256').update(value).digest('hex');

const policy=JSON.parse(await readFile(POLICY,'utf8'));
const contract=JSON.parse(await readFile(CONTRACT,'utf8'));
const ancpiBytes=await readFile(ANCPI_FALLBACK);
const ancpiFallback=JSON.parse(ancpiBytes.toString('utf8'));
const ojdulaBytes=await readFile(OJDULA_REVIEW);
const ojdulaReview=JSON.parse(ojdulaBytes.toString('utf8'));
const ojdulaShellBytes=await readFile(OJDULA_OSM_SHELL);
const ojdulaShell=JSON.parse(ojdulaShellBytes.toString('utf8'));
const terminalClosureBytes=await readFile(TERMINAL_CLOSURE_REVIEW);
const terminalClosureReview=JSON.parse(terminalClosureBytes.toString('utf8'));
const [
 statisticalContractBytes,statisticalPolicyBytes,statisticalSourceBundleBytes,
 roStatisticalLayerBytes,mdStatisticalLayerBytes,roStatisticalOsmBytes,mdStatisticalOsmBytes
]=await Promise.all([
 readFile(STATISTICAL_CONTRACT),readFile(STATISTICAL_POLICY),readFile(STATISTICAL_SOURCE_BUNDLE),
 readFile(RO_STATISTICAL_LAYER),readFile(MD_STATISTICAL_LAYER),readFile(RO_STATISTICAL_OSM),readFile(MD_STATISTICAL_OSM)
]);
const statisticalContract=JSON.parse(statisticalContractBytes.toString('utf8'));
const statisticalPolicy=JSON.parse(statisticalPolicyBytes.toString('utf8'));
const statisticalSourceBundle=JSON.parse(statisticalSourceBundleBytes.toString('utf8'));
const roStatisticalLayer=JSON.parse(roStatisticalLayerBytes.toString('utf8'));
const mdStatisticalLayer=JSON.parse(mdStatisticalLayerBytes.toString('utf8'));
const roStatisticalOsm=JSON.parse(roStatisticalOsmBytes.toString('utf8'));
const mdStatisticalOsm=JSON.parse(mdStatisticalOsmBytes.toString('utf8'));

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
if(
 ojdulaShell.schema_version!==1
 ||ojdulaShell.mode!=='ACTUAL_RO_REVIEWED_OSM_OUTER_SHELL'
 ||Number(ojdulaShell.relation_id)!==14735731
 ||ojdulaShell.source_commit_sha!=='f21e4954063a884df9922efa5ac31229c5b51d43'
 ||ojdulaShell.source_snapshot_id!=='actual-990c892d9d27fa46'
 ||ojdulaShell.geometry?.type!=='Polygon'
)throw new Error('Unexpected reviewed Ojdula OSM outer-shell fixture.');
if(
 terminalClosureReview.schema_version!==1
 ||terminalClosureReview.mode!=='ACTUAL_RO_BRETCU_OJDULA_TERMINAL_CLOSURE_REVIEW'
 ||terminalClosureReview.conclusion!=='retain_legacy_osm_shell_with_reviewed_terminal_adaptations'
 ||terminalClosureReview.decision?.preserve_legacy_osm_exterior!==true
 ||terminalClosureReview.decision?.allow_non_ancpi_terminal_closure!==true
 ||Number(terminalClosureReview.decision?.non_ancpi_terminal_closure_count)!==1
)throw new Error('Unexpected reviewed Brețcu–Ojdula terminal-closure evidence.');
if(
 statisticalContract?.contract!=='actual-statistical-hierarchy-v1'
 ||statisticalPolicy?.activation_requested!==true
 ||statisticalPolicy?.target_public_contract!=='actual-public-entity-v3'
 ||statisticalSourceBundle?.mode!=='ACTUAL_STATISTICAL_SOURCE_BUNDLE'
 ||roStatisticalLayer?.contract!=='actual-statistical-ro-v1'
 ||mdStatisticalLayer?.contract!=='actual-statistical-md-v1'
 ||roStatisticalLayer?.counts?.statistical_only_entities!==12
 ||roStatisticalLayer?.counts?.reused_existing_nuts3_entities!==42
 ||mdStatisticalLayer?.counts?.statistical_only_entities!==6
 ||mdStatisticalLayer?.counts?.reused_existing_statistical_entities!==3
 ||mdStatisticalLayer?.counts?.component_bindings!==37
 ||roStatisticalOsm?.semantic_sha256!==roStatisticalLayer?.sources?.osm_statistical?.semantic_sha256
 ||mdStatisticalOsm?.semantic_sha256!==mdStatisticalLayer?.sources?.osm_statistical?.semantic_sha256
)throw new Error('Unexpected P2 statistical activation source contract.');

const migrated=structuredClone(policy);
migrated.policy_version='2026-10-04-v1.5';
migrated.coverage_contract_version=2;
migrated.geometry_role_contract={path:CONTRACT,contract:contract.contract,schema_version:contract.schema_version};
migrated.jurisdictions.RO.official_inventory_selector='SIRUTA records whose level is 3';
migrated.jurisdictions.RO.coverage_accounting='unique_official_legal_identity';
migrated.jurisdictions.MD.coverage_accounting='unique_official_legal_identity';
migrated.public_contract='actual-public-entity-v3';
migrated.statistical_hierarchy={
 activated:true,
 contract:statisticalContract.contract,
 hierarchy_contract:'actual-public-hierarchy-v1',
 public_contract:'actual-public-entity-v3',
 expected_public_entity_count:5848,
 expected_administrative_entity_count:5830,
 expected_statistical_only_entity_count:18,
 expected_entity_count_by_jurisdiction:{RO:3246,MD:2602},
 contract_source:{path:STATISTICAL_CONTRACT,sha256:sha256(statisticalContractBytes)},
 policy_source:{path:STATISTICAL_POLICY,sha256:sha256(statisticalPolicyBytes)},
 source_bundle:{
  path:STATISTICAL_SOURCE_BUNDLE,
  sha256:sha256(statisticalSourceBundleBytes),
  fingerprint_algorithm:statisticalSourceBundle.bundle_fingerprint_algorithm,
  fingerprint_sha256:statisticalSourceBundle.bundle_fingerprint_sha256
 },
 layers:{
  RO:{path:RO_STATISTICAL_LAYER,sha256:sha256(roStatisticalLayerBytes),fingerprint_sha256:roStatisticalLayer.layer_fingerprint_sha256},
  MD:{path:MD_STATISTICAL_LAYER,sha256:sha256(mdStatisticalLayerBytes),fingerprint_sha256:mdStatisticalLayer.layer_fingerprint_sha256}
 },
 osm_geometry_sources:{
  RO:{path:RO_STATISTICAL_OSM,sha256:sha256(roStatisticalOsmBytes),semantic_sha256:roStatisticalOsm.semantic_sha256,compressed_sha256:roStatisticalOsm.compressed_sha256},
  MD:{path:MD_STATISTICAL_OSM,sha256:sha256(mdStatisticalOsmBytes),semantic_sha256:mdStatisticalOsm.semantic_sha256,compressed_sha256:mdStatisticalOsm.compressed_sha256}
 },
 geometry_policy:'Administrative master geometry remains immutable; reused statistical roles share existing entity geometry; statistical-only geometry is exact from reviewed OSM statistical snapshots.'
};
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
   outer_shell_evidence:OJDULA_OSM_SHELL,
   outer_shell_evidence_sha256:sha256(ojdulaShellBytes),
   outer_shell_source_commit_sha:ojdulaShell.source_commit_sha,
   outer_shell_source_snapshot_id:ojdulaShell.source_snapshot_id,
   source:'OSM shell + ANCPI shared boundary + reviewed terminal adaptations',
   terminal_closure_evidence:TERMINAL_CLOSURE_REVIEW,
   terminal_closure_evidence_sha256:sha256(terminalClosureBytes),
   terminal_closure_policy:'ancpi_shared_path_with_reviewed_osm_shell_terminal_adaptations',
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
 reviewed_geometry_overrides:migrated.administrative_geometry_fallbacks.RO.reviewed_geometry_overrides,
 statistical_hierarchy:migrated.statistical_hierarchy
},null,2));
