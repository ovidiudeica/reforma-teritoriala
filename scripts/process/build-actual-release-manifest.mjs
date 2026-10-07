#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {actualSemanticFingerprint,byteFingerprintFromHashes} from '../lib/actual-semantic-fingerprint.mjs';
import {SOURCE_BUNDLE_PATH,sourceBundleFingerprint as computeSourceBundleFingerprint} from '../lib/actual-source-bundle.mjs';
import {BUILD_ENVIRONMENT_PATH,buildEnvironmentFingerprint as computeBuildEnvironmentFingerprint} from '../lib/actual-build-environment.mjs';
import {REVIEW_EVIDENCE_BUNDLE_PATH,reviewEvidenceFingerprint as computeReviewEvidenceFingerprint} from '../lib/actual-review-evidence-bundle.mjs';
import {HOST_TRUST_PATH,hostTrustFingerprint as computeHostTrustFingerprint,validateHostTrustManifest} from '../lib/actual-host-trust.mjs';

const OUTPUT='data/current/actual-release-manifest.json';
const NETWORK_DENIAL='data/current/actual-network-denial-audit.json';
const GEOMETRY_ROLE_CONTRACT='schemas/actual-geometry-role-contract.json';
const STAT_PATHS={
 activation:'data/current/actual-statistical-activation.json',
 policy:'data/sources/actual-statistical-policy.json',
 contract:'schemas/actual-statistical-hierarchy-contract.json',
 source_bundle:'data/sources/actual-statistical-source-bundle.json',
 ro_layer:'data/p2/actual-statistical-ro.json',
 md_layer:'data/p2/actual-statistical-md.json',
 ro_osm:'data/sources/ro-statistical-osm-current.json',
 md_osm:'data/sources/md-statistical-osm-current.json',
 ro_osm_snapshot:'data/sources/osm-statistical-snapshots/ro-nuts-2024.json.gz',
 md_osm_snapshot:'data/sources/osm-statistical-snapshots/md-nuts-2017.json.gz',
 public_schema:'schemas/actual-public-entity-v3.schema.json'
};
const PATHS={
 catalog:'data/current/entities.json',
 inventory:'data/current/administrative-inventory.json',
 ro_geojson:'public/geo/current/ro-administrative.geojson',
 md_geojson:'public/geo/current/md-administrative.geojson',
 public_index:'public/data/actual-entities.json',
 public_chunks:'public/data/actual-geometry-chunks.json',
 ro_overview:'public/geo/actual/ro-overview.geojson',
 ro_local:'public/geo/actual/ro-local.geojson',
 ro_detail:'public/geo/actual/ro-detail.geojson',
 md_overview:'public/geo/actual/md-overview.geojson',
 md_local:'public/geo/actual/md-local.geojson',
 md_detail:'public/geo/actual/md-detail.geojson',
 ro_gate:'data/current/ro-release-gate.json',
 md_gate:'data/current/md-release-gate.json',
 ro_official:'data/sources/ro-siruta-current.json',
 md_official:'data/sources/cuatm-current.json',
 md_individual_review:'data/sources/md-cuatm-individual-review.json',
 md_semantic_bridge:'data/current/md-cuatm-semantic-bridge.json',
 topology_audit:'data/current/actual-topology-audit.json',
 regression_audit:'data/current/actual-regression-audit.json',
 structural_completeness_audit:'data/current/actual-structural-completeness-audit.json',
 official_identity_audit:'data/current/actual-official-identity-audit.json',
 settlement_policy:'data/sources/actual-settlement-policy.json'
};
const sha256=buf=>createHash('sha256').update(buf).digest('hex');
const buffers=Object.fromEntries(await Promise.all(Object.entries(PATHS).map(async([key,path])=>[key,await readFile(path)])));
const sourceBundleBytes=await readFile(SOURCE_BUNDLE_PATH);
const sourceBundle=JSON.parse(sourceBundleBytes.toString('utf8'));
const sourceBundleHash=sha256(sourceBundleBytes);
const computedSourceBundleFingerprint=computeSourceBundleFingerprint(sourceBundle);
if(sourceBundle.schema_version!==1||sourceBundle.mode!=='ACTUAL_SOURCE_BUNDLE')throw new Error('Invalid ACTUAL source bundle schema/mode');
if(sourceBundle.bundle_fingerprint_algorithm!==computedSourceBundleFingerprint.algorithm||sourceBundle.bundle_fingerprint_sha256!==computedSourceBundleFingerprint.sha256)throw new Error('ACTUAL source bundle fingerprint mismatch');
const reviewEvidenceBundleBytes=await readFile(REVIEW_EVIDENCE_BUNDLE_PATH);
const reviewEvidenceBundle=JSON.parse(reviewEvidenceBundleBytes.toString('utf8'));
const reviewEvidenceBundleHash=sha256(reviewEvidenceBundleBytes);
const computedReviewEvidenceFingerprint=computeReviewEvidenceFingerprint(reviewEvidenceBundle);
if(reviewEvidenceBundle.schema_version!==1||reviewEvidenceBundle.mode!=='ACTUAL_REVIEW_EVIDENCE_BUNDLE')throw new Error('Invalid ACTUAL review evidence bundle schema/mode');
if(reviewEvidenceBundle.bundle_fingerprint_algorithm!==computedReviewEvidenceFingerprint.algorithm||reviewEvidenceBundle.bundle_fingerprint_sha256!==computedReviewEvidenceFingerprint.sha256)throw new Error('ACTUAL review evidence bundle fingerprint mismatch');
const hostTrustBytes=await readFile(HOST_TRUST_PATH);
const hostTrust=JSON.parse(hostTrustBytes.toString('utf8'));
const hostTrustHash=sha256(hostTrustBytes);
const hostTrustValidation=validateHostTrustManifest(hostTrust);
const computedHostTrustFingerprint=computeHostTrustFingerprint(hostTrust);
if(hostTrustValidation.status!=='PASS')throw new Error('Invalid ACTUAL host-trust contract: '+JSON.stringify(hostTrustValidation.failures));
if(hostTrust.host_trust_fingerprint_algorithm!==computedHostTrustFingerprint.algorithm||hostTrust.host_trust_fingerprint_sha256!==computedHostTrustFingerprint.sha256)throw new Error('ACTUAL host-trust fingerprint mismatch');
const networkDenialBytes=await readFile(NETWORK_DENIAL);
const networkDenial=JSON.parse(networkDenialBytes.toString('utf8'));
if(networkDenial.schema_version!==1||networkDenial.mode!=='ACTUAL_NETWORK_DENIAL'||networkDenial.status!=='PASS')throw new Error('Invalid ACTUAL network-denial proof');
const networkDenialHash=sha256(networkDenialBytes);
const buildEnvironmentBytes=await readFile(BUILD_ENVIRONMENT_PATH);
const buildEnvironment=JSON.parse(buildEnvironmentBytes.toString('utf8'));
const buildEnvironmentHash=sha256(buildEnvironmentBytes);
const computedBuildEnvironmentFingerprint=computeBuildEnvironmentFingerprint(buildEnvironment);
if(buildEnvironment.schema_version!==1||buildEnvironment.mode!=='ACTUAL_BUILD_ENVIRONMENT')throw new Error('Invalid ACTUAL build environment schema/mode');
if(buildEnvironment.environment_fingerprint_algorithm!==computedBuildEnvironmentFingerprint.algorithm||buildEnvironment.environment_fingerprint_sha256!==computedBuildEnvironmentFingerprint.sha256)throw new Error('ACTUAL build environment fingerprint mismatch');
const json=key=>JSON.parse(buffers[key].toString('utf8'));
const catalog=json('catalog');
const inventory=json('inventory');
const roGeo=json('ro_geojson');
const mdGeo=json('md_geojson');
const publicIndex=json('public_index');
const publicChunks=json('public_chunks');
const roGate=json('ro_gate');
const mdGate=json('md_gate');
const siruta=json('ro_official');
const cuatm=json('md_official');
const topologyAudit=json('topology_audit');
const regressionAudit=json('regression_audit');
const structuralCompletenessAudit=json('structural_completeness_audit');
const officialIdentityAudit=json('official_identity_audit');
const mdSemanticBridge=json('md_semantic_bridge');
const settlementPolicy=json('settlement_policy');
const mdIndividualReview=json('md_individual_review');
const geometryRoleContractBytes=await readFile(GEOMETRY_ROLE_CONTRACT);
const geometryRoleContract=JSON.parse(geometryRoleContractBytes.toString('utf8'));
const geometryRoleBindingActive=Boolean(
 settlementPolicy?.geometry_role_contract?.path===GEOMETRY_ROLE_CONTRACT
 && settlementPolicy?.geometry_role_contract?.contract===geometryRoleContract?.contract
 && Number(settlementPolicy?.geometry_role_contract?.schema_version)===Number(geometryRoleContract?.schema_version)
);
const statisticalActivationActive=settlementPolicy?.public_contract==='actual-public-entity-v3';
const statisticalBuffers={};
const statisticalDocs={};
if(statisticalActivationActive){
 for(const [key,path] of Object.entries(STAT_PATHS))statisticalBuffers[key]=await readFile(path);
 for(const key of ['activation','policy','contract','source_bundle','ro_layer','md_layer','ro_osm','md_osm'])statisticalDocs[key]=JSON.parse(statisticalBuffers[key].toString('utf8'));
 if(statisticalDocs.activation?.activated!==true||statisticalDocs.activation?.mode!=='ACTUAL_STATISTICAL_ACTIVATION')throw new Error('ACTUAL statistical activation marker is not active');
 if(publicIndex.contract!=='actual-public-entity-v3'||Number(publicIndex.schema_version)!==3)throw new Error('Statistical activation requires public contract v3');
}

const jurisdictions=['RO','MD'];
const entities=Array.isArray(catalog.entities)?catalog.entities:[];
const entityCounts=Object.fromEntries(jurisdictions.map(j=>[j,entities.filter(e=>e.jurisdiction===j).length]));
const featureCounts={
 RO:Array.isArray(roGeo.features)?roGeo.features.length:0,
 MD:Array.isArray(mdGeo.features)?mdGeo.features.length:0
};
const components=Object.fromEntries(Object.entries(PATHS).map(([key,path])=>[key,{
 path,
 sha256:sha256(buffers[key]),
 bytes:buffers[key].byteLength
}]));
if(geometryRoleBindingActive){
 components.geometry_role_contract={
  path:GEOMETRY_ROLE_CONTRACT,
  sha256:sha256(geometryRoleContractBytes),
  bytes:geometryRoleContractBytes.byteLength
 };
}
if(statisticalActivationActive){
 for(const [key,path] of Object.entries(STAT_PATHS)){
  const buf=statisticalBuffers[key];
  components['statistical_'+key]={path,sha256:sha256(buf),bytes:buf.byteLength};
 }
}
const componentHashes=Object.fromEntries(Object.entries(components).map(([key,value])=>[key,value.sha256]));
const byteFingerprint=byteFingerprintFromHashes(componentHashes);
const semanticDocuments={
 catalog,
 inventory,
 roGeo,
 mdGeo,
 roOfficial:siruta,
 mdOfficial:cuatm,
 mdIndividualReview,
 settlementPolicy,
 geometryRoleContract,
 ...(statisticalActivationActive?{
  statisticalActivation:statisticalDocs.activation,
  statisticalPolicy:statisticalDocs.policy,
  statisticalContract:statisticalDocs.contract,
  statisticalSourceBundle:statisticalDocs.source_bundle,
  roStatisticalLayer:statisticalDocs.ro_layer,
  mdStatisticalLayer:statisticalDocs.md_layer
 }:{})
};
const semanticFingerprint=actualSemanticFingerprint(semanticDocuments);
const BASE_REF=process.env.ACTUAL_BASE_REF||null;
let releaseFingerprint=semanticFingerprint.sha256;
let snapshotId='actual-'+releaseFingerprint.slice(0,16);
let baseManifestBytes=null;
let baseManifest=null;
let baseSemanticMatches=false;
let contentIdentity={
 algorithm:semanticFingerprint.algorithm,
 sha256:semanticFingerprint.sha256,
 release_identity_basis:semanticFingerprint.algorithm==='actual-semantic-v3'?'semantic_content_v3':semanticFingerprint.algorithm==='actual-semantic-v2'?'semantic_content_v2':'semantic_content_v1',
 reused_base_release:false
};
if(BASE_REF){
 const gitBuffer=path=>execFileSync('git',['show',BASE_REF+':'+path],{maxBuffer:256*1024*1024});
 const gitJson=path=>JSON.parse(gitBuffer(path).toString('utf8'));
 const baseMarker=gitJson('data/current/actual-release-persisted.json');
 baseManifestBytes=gitBuffer(OUTPUT);
 baseManifest=JSON.parse(baseManifestBytes.toString('utf8'));
 const baseStatisticalDocuments=baseManifest?.statistical_model?.activated===true?{
  statisticalActivation:gitJson(baseManifest.components.statistical_activation.path),
  statisticalPolicy:gitJson(baseManifest.components.statistical_policy.path),
  statisticalContract:gitJson(baseManifest.components.statistical_contract.path),
  statisticalSourceBundle:gitJson(baseManifest.components.statistical_source_bundle.path),
  roStatisticalLayer:gitJson(baseManifest.components.statistical_ro_layer.path),
  mdStatisticalLayer:gitJson(baseManifest.components.statistical_md_layer.path)
 }:{};
 const baseDocuments={
  catalog:gitJson(PATHS.catalog),
  inventory:gitJson(PATHS.inventory),
  roGeo:gitJson(PATHS.ro_geojson),
  mdGeo:gitJson(PATHS.md_geojson),
  roOfficial:gitJson(PATHS.ro_official),
  mdOfficial:gitJson(PATHS.md_official),
  mdIndividualReview:gitJson(PATHS.md_individual_review),
  settlementPolicy:gitJson(PATHS.settlement_policy),
  geometryRoleContract:gitJson(GEOMETRY_ROLE_CONTRACT),
  ...baseStatisticalDocuments
 };
 const baseSemantic=actualSemanticFingerprint(baseDocuments);
 if(baseSemantic.sha256===semanticFingerprint.sha256){
  baseSemanticMatches=true;
  releaseFingerprint=baseMarker.release_fingerprint_sha256;
  snapshotId=baseMarker.snapshot_id;
  contentIdentity={
   ...contentIdentity,
   release_identity_basis:'base_release_compatibility_reuse',
   reused_base_release:true,
   base_ref:BASE_REF,
   base_snapshot_id:baseMarker.snapshot_id,
   base_release_fingerprint_sha256:baseMarker.release_fingerprint_sha256,
   base_content_sha256:baseSemantic.sha256
  };
 }
}
const validTimes=[
 catalog.generated_at,roGate.generated_at,mdGate.generated_at,siruta.fetched_at,cuatm.fetched_at,
 ...(statisticalActivationActive?[statisticalDocs.ro_layer?.generated_at,statisticalDocs.md_layer?.generated_at]:[])
].filter(Boolean).map(x=>new Date(x)).filter(x=>Number.isFinite(x.getTime()));
const generatedAt=(validTimes.length?new Date(Math.max(...validTimes.map(x=>x.getTime()))):new Date(0)).toISOString();
const tier=(jurisdiction,name)=>{
 const key=jurisdiction.toLowerCase()+'_'+name;
 const doc=json(key);
 return {
  path:PATHS[key],
  feature_count:Array.isArray(doc.features)?doc.features.length:0,
  sha256:components[key].sha256
 };
};

const manifest={
 schema_version:statisticalActivationActive?10:geometryRoleBindingActive?9:8,
 mode:'ACTUAL',
 snapshot_id:snapshotId,
 generated_at:generatedAt,
 release_fingerprint_sha256:releaseFingerprint,
 content_fingerprint_sha256:semanticFingerprint.sha256,
 component_byte_fingerprint_sha256:byteFingerprint.sha256,
 content_identity:contentIdentity,
 policy:'Stable administrative-content identity separated from exact-byte integrity, exact source provenance, frozen review-evidence provenance, explicit host-trust provenance, kernel-enforced network-denial proof and exact execution-environment provenance. Snapshot identity is derived from canonical semantic ACTUAL content; exact component SHA256 values plus source-bundle, review-evidence-bundle, host-trust, network-denial and build-environment bindings remain mandatory integrity constraints.',
 jurisdictions,
 source_bundle:{
  path:SOURCE_BUNDLE_PATH,
  schema_version:sourceBundle.schema_version,
  mode:sourceBundle.mode,
  source_watermark:sourceBundle.source_watermark??null,
  bundle_fingerprint_algorithm:sourceBundle.bundle_fingerprint_algorithm,
  bundle_fingerprint_sha256:sourceBundle.bundle_fingerprint_sha256,
  sha256:sourceBundleHash
 },
 review_evidence_bundle:{
  path:REVIEW_EVIDENCE_BUNDLE_PATH,
  schema_version:reviewEvidenceBundle.schema_version,
  mode:reviewEvidenceBundle.mode,
  evidence_watermark:reviewEvidenceBundle.evidence_watermark??null,
  bundle_fingerprint_algorithm:reviewEvidenceBundle.bundle_fingerprint_algorithm,
  bundle_fingerprint_sha256:reviewEvidenceBundle.bundle_fingerprint_sha256,
  sha256:reviewEvidenceBundleHash
 },
 host_trust:{
  path:HOST_TRUST_PATH,
  schema_version:hostTrust.schema_version,
  mode:hostTrust.mode,
  host_trust_fingerprint_algorithm:hostTrust.host_trust_fingerprint_algorithm,
  host_trust_fingerprint_sha256:hostTrust.host_trust_fingerprint_sha256,
  runner_image_version:hostTrust.contract?.runner?.image_version??null,
  kernel_release:hostTrust.contract?.kernel?.release??null,
  docker_server_version:hostTrust.contract?.docker?.server_version??null,
  containerd_version:hostTrust.contract?.docker?.components?.containerd?.version??null,
  runc_version:hostTrust.contract?.docker?.components?.runc?.version??null,
  cpu_execution_profile:hostTrust.contract?.cpu_contract?.execution_profile??null,
  sha256:hostTrustHash
 },
 network_denial:{
  path:NETWORK_DENIAL,
  schema_version:networkDenial.schema_version,
  mode:networkDenial.mode,
  status:networkDenial.status,
  enforcement:networkDenial.enforcement??null,
  docker_socket_mounted:networkDenial.docker_socket_mounted??null,
  sha256:networkDenialHash
 },
 build_environment:{
  path:BUILD_ENVIRONMENT_PATH,
  schema_version:buildEnvironment.schema_version,
  mode:buildEnvironment.mode,
  runner_label:buildEnvironment.environment?.runner?.label??null,
  runner_image_version:buildEnvironment.environment?.runner?.image_version??null,
  environment_fingerprint_algorithm:buildEnvironment.environment_fingerprint_algorithm,
  environment_fingerprint_sha256:buildEnvironment.environment_fingerprint_sha256,
  sha256:buildEnvironmentHash
 },
 catalog:{
  path:PATHS.catalog,
  schema_version:catalog.schema_version??null,
  generated_at:catalog.generated_at??null,
  classifier_version:catalog.classifier_version??null,
  source:catalog.source??null,
  license:catalog.license??null,
  entity_count:entities.length,
  declared_entity_count:catalog.entity_count??null,
  entity_count_by_jurisdiction:entityCounts,
  sha256:components.catalog.sha256
 },
 administrative_model:{
  path:PATHS.inventory,
  schema_version:inventory.schema_version??null,
  as_of:inventory.as_of??null,
  sha256:components.inventory.sha256
 },
 ...(statisticalActivationActive?{
  statistical_model:{
   activated:true,
   activation:{path:STAT_PATHS.activation,sha256:components.statistical_activation.sha256,fingerprint:statisticalDocs.activation.activation_fingerprint_sha256},
   policy:{path:STAT_PATHS.policy,sha256:components.statistical_policy.sha256},
   contract:{path:STAT_PATHS.contract,sha256:components.statistical_contract.sha256,contract:statisticalDocs.contract.contract},
   source_bundle:{path:STAT_PATHS.source_bundle,sha256:components.statistical_source_bundle.sha256,bundle_fingerprint_sha256:statisticalDocs.source_bundle.bundle_fingerprint_sha256},
   layers:{
    RO:{path:STAT_PATHS.ro_layer,sha256:components.statistical_ro_layer.sha256,fingerprint:statisticalDocs.ro_layer.layer_fingerprint_sha256},
    MD:{path:STAT_PATHS.md_layer,sha256:components.statistical_md_layer.sha256,fingerprint:statisticalDocs.md_layer.layer_fingerprint_sha256}
   },
   public_entity_count:publicIndex.entity_count,
   administrative_entity_count:publicIndex.administrative_entity_count,
   statistical_only_entity_count:publicIndex.statistical_only_entity_count,
   hierarchy_contract:publicIndex.hierarchy_tree?.contract??null,
   hierarchy_node_count:publicIndex.hierarchy_tree?.node_count??null
  }
 }:{ }),
 settlement_policy:{
  path:PATHS.settlement_policy,
  schema_version:settlementPolicy.schema_version??null,
  policy_version:settlementPolicy.policy_version??null,
  coverage_contract_version:settlementPolicy.coverage_contract_version??1,
  scope:settlementPolicy.scope??null,
  geometry_role_contract:settlementPolicy.geometry_role_contract??null,
  ...(Object.prototype.hasOwnProperty.call(settlementPolicy,'public_contract')?{public_contract:settlementPolicy.public_contract}:{}),
  ...(Object.prototype.hasOwnProperty.call(settlementPolicy,'administrative_geometry_fallbacks')?{administrative_geometry_fallbacks:settlementPolicy.administrative_geometry_fallbacks}:{}),
  sha256:components.settlement_policy.sha256
 },
 ...(geometryRoleBindingActive?{
  geometry_role_contract:{
   path:GEOMETRY_ROLE_CONTRACT,
   schema_version:geometryRoleContract.schema_version??null,
   contract:geometryRoleContract.contract??null,
   mode:geometryRoleContract.mode??null,
   sha256:components.geometry_role_contract.sha256
  }
 }:{ }),
 geometry:{
  RO:{path:PATHS.ro_geojson,feature_count:featureCounts.RO,sha256:components.ro_geojson.sha256},
  MD:{path:PATHS.md_geojson,feature_count:featureCounts.MD,sha256:components.md_geojson.sha256}
 },
 public_contract:{
  path:PATHS.public_index,
  contract:publicIndex.contract??null,
  schema_version:publicIndex.schema_version??null,
  generated_at:publicIndex.generated_at??null,
  entity_count:publicIndex.entity_count??null,
  entity_count_by_jurisdiction:publicIndex.entity_count_by_jurisdiction??null,
  legal_identity_status_counts:publicIndex.legal_identity_status_counts??null,
  sha256:components.public_index.sha256,
  ...(statisticalActivationActive?{
   schema_path:STAT_PATHS.public_schema,
   schema_sha256:components.statistical_public_schema.sha256,
   hierarchy:{contract:publicIndex.hierarchy_tree?.contract??null,root_count:publicIndex.hierarchy_tree?.root_count??null,node_count:publicIndex.hierarchy_tree?.node_count??null}
  }:{ }),
  geometry_chunks:{
   path:PATHS.public_chunks,
   contract:publicChunks.contract??null,
   schema_version:publicChunks.schema_version??null,
   chunk_count:publicChunks.chunk_count??null,
   sha256:components.public_chunks.sha256
  },
  geometry_tiers:{
   RO:{overview:tier('RO','overview'),local:tier('RO','local'),detail:tier('RO','detail')},
   MD:{overview:tier('MD','overview'),local:tier('MD','local'),detail:tier('MD','detail')}
  }
 },
 semantic_bridges:{
  MD:{path:PATHS.md_semantic_bridge,status:mdSemanticBridge.status??null,summary:mdSemanticBridge.summary??null,sha256:components.md_semantic_bridge.sha256}
 },
 quality_gates:{
  topology:{path:PATHS.topology_audit,status:topologyAudit.status??null,blocking_issue_count:topologyAudit.blocking_issue_count??null,sha256:components.topology_audit.sha256},
  regression:{path:PATHS.regression_audit,status:regressionAudit.status??null,blocking_issue_count:regressionAudit.blocking_issue_count??null,sha256:components.regression_audit.sha256},
  structural_completeness:{path:PATHS.structural_completeness_audit,status:structuralCompletenessAudit.status??null,blocking_gap_count:structuralCompletenessAudit.blocking_gap_count??null,blocking_policy_violation_count:structuralCompletenessAudit.blocking_policy_violation_count??null,blocking_issue_count:structuralCompletenessAudit.blocking_issue_count??null,sha256:components.structural_completeness_audit.sha256},
  official_identity:{path:PATHS.official_identity_audit,status:officialIdentityAudit.status??null,blocking_issue_count:officialIdentityAudit.blocking_issue_count??null,sha256:components.official_identity_audit.sha256}
 },
 jurisdiction_gates:{
  RO:{path:PATHS.ro_gate,status:roGate.status??null,generated_at:roGate.generated_at??null,sha256:components.ro_gate.sha256},
  MD:{path:PATHS.md_gate,status:mdGate.status??null,generated_at:mdGate.generated_at??null,sha256:components.md_gate.sha256}
 },
 official_sources:{
  RO:{
   registry:siruta.registry??'SIRUTA',
   authority:siruta.authority??null,
   path:PATHS.ro_official,
   reference_year:siruta.reference_year??null,
   fetched_at:siruta.fetched_at??null,
   record_count:siruta.record_count??(Array.isArray(siruta.records)?siruta.records.length:null),
   source_content_sha256:siruta.source?.content_sha256??null,
   semantic_sha256:siruta.semantic_sha256??null,
   sha256:components.ro_official.sha256
  },
  MD:{
   registry:'CUATM',
   authority:'Biroul Național de Statistică al Republicii Moldova',
   path:PATHS.md_official,
   source_url:cuatm.source_url??null,
   fetched_at:cuatm.fetched_at??null,
   record_count:cuatm.record_count??(Array.isArray(cuatm.records)?cuatm.records.length:null),
   sha256:components.md_official.sha256
  }
 },
 components
};

const baseComponentBytesMatch=Boolean(baseManifest)
 && Object.keys(components).every(key=>
  baseManifest.components?.[key]?.sha256===components[key].sha256
  && Number(baseManifest.components?.[key]?.bytes)===Number(components[key].bytes)
 )
 && Object.keys(baseManifest.components||{}).every(key=>
  components[key]?.sha256===baseManifest.components[key]?.sha256
  && Number(components[key]?.bytes)===Number(baseManifest.components[key]?.bytes)
 );
const baseSourceBundleMatches=Boolean(baseManifest)
 && baseManifest.source_bundle?.path===SOURCE_BUNDLE_PATH
 && baseManifest.source_bundle?.sha256===sourceBundleHash
 && baseManifest.source_bundle?.bundle_fingerprint_sha256===sourceBundle.bundle_fingerprint_sha256;
const baseReviewEvidenceMatches=Boolean(baseManifest)
 && baseManifest.review_evidence_bundle?.path===REVIEW_EVIDENCE_BUNDLE_PATH
 && baseManifest.review_evidence_bundle?.sha256===reviewEvidenceBundleHash
 && baseManifest.review_evidence_bundle?.bundle_fingerprint_sha256===reviewEvidenceBundle.bundle_fingerprint_sha256;
const baseHostTrustMatches=Boolean(baseManifest)
 && baseManifest.host_trust?.path===HOST_TRUST_PATH
 && baseManifest.host_trust?.sha256===hostTrustHash
 && baseManifest.host_trust?.host_trust_fingerprint_sha256===hostTrust.host_trust_fingerprint_sha256;
const baseNetworkDenialMatches=Boolean(baseManifest)
 && baseManifest.network_denial?.path===NETWORK_DENIAL
 && baseManifest.network_denial?.sha256===networkDenialHash
 && baseManifest.network_denial?.status==='PASS';
const baseBuildEnvironmentMatches=Boolean(baseManifest)
 && baseManifest.build_environment?.path===BUILD_ENVIRONMENT_PATH
 && baseManifest.build_environment?.sha256===buildEnvironmentHash
 && baseManifest.build_environment?.environment_fingerprint_sha256===buildEnvironment.environment_fingerprint_sha256;
const reuseExactBaseManifest=baseSemanticMatches&&baseComponentBytesMatch&&baseSourceBundleMatches&&baseReviewEvidenceMatches&&baseHostTrustMatches&&baseNetworkDenialMatches&&baseBuildEnvironmentMatches&&baseManifestBytes;

await mkdir('data/current',{recursive:true});
if(reuseExactBaseManifest){
 await writeFile(OUTPUT,baseManifestBytes);
 console.log(JSON.stringify({
  snapshot_id:baseManifest.snapshot_id,
  generated_at:baseManifest.generated_at,
  release_fingerprint_sha256:baseManifest.release_fingerprint_sha256,
  release_identity_basis:'exact_base_manifest_byte_reuse',
  exact_base_manifest_bytes_reused:true,
  component_hash_changed_count:0,
  entity_count:baseManifest.catalog?.entity_count??null,
  feature_count:{RO:baseManifest.geometry?.RO?.feature_count??null,MD:baseManifest.geometry?.MD?.feature_count??null},
  gates:{RO:baseManifest.jurisdiction_gates?.RO?.status??null,MD:baseManifest.jurisdiction_gates?.MD?.status??null}
 },null,2));
}else{
 await writeFile(OUTPUT,JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify({
  snapshot_id:manifest.snapshot_id,
  generated_at:manifest.generated_at,
  release_fingerprint_sha256:manifest.release_fingerprint_sha256,
  content_fingerprint_sha256:manifest.content_fingerprint_sha256,
  component_byte_fingerprint_sha256:manifest.component_byte_fingerprint_sha256,
  source_bundle_fingerprint_sha256:manifest.source_bundle.bundle_fingerprint_sha256,
  review_evidence_bundle_fingerprint_sha256:manifest.review_evidence_bundle.bundle_fingerprint_sha256,
  host_trust_fingerprint_sha256:manifest.host_trust.host_trust_fingerprint_sha256,
  build_environment_fingerprint_sha256:manifest.build_environment.environment_fingerprint_sha256,
  release_identity_basis:manifest.content_identity?.release_identity_basis??null,
  exact_base_manifest_bytes_reused:false,
  entity_count:manifest.catalog.entity_count,
  public_contract:manifest.public_contract.contract,
  feature_count:{RO:manifest.geometry.RO.feature_count,MD:manifest.geometry.MD.feature_count},
  gates:{RO:manifest.jurisdiction_gates.RO.status,MD:manifest.jurisdiction_gates.MD.status}
 },null,2));
}
