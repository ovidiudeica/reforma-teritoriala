#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {actualSemanticFingerprint,byteFingerprintFromHashes} from '../lib/actual-semantic-fingerprint.mjs';
import {SOURCE_BUNDLE_PATH,sourceBundleFingerprint as computeSourceBundleFingerprint} from '../lib/actual-source-bundle.mjs';
import {BUILD_ENVIRONMENT_PATH,buildEnvironmentFingerprint as computeBuildEnvironmentFingerprint} from '../lib/actual-build-environment.mjs';
import {REVIEW_EVIDENCE_BUNDLE_PATH,reviewEvidenceFingerprint as computeReviewEvidenceFingerprint} from '../lib/actual-review-evidence-bundle.mjs';

const OUTPUT='data/current/actual-release-manifest.json';
const NETWORK_DENIAL='data/current/actual-network-denial-audit.json';
const PATHS={
 catalog:'data/current/entities.json',
 inventory:'data/current/administrative-inventory.json',
 ro_geojson:'public/geo/current/ro-administrative.geojson',
 md_geojson:'public/geo/current/md-administrative.geojson',
 public_index:'public/data/actual-entities.json',
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
 settlementPolicy
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
 release_identity_basis:'semantic_content_v1',
 reused_base_release:false
};
if(BASE_REF){
 const gitBuffer=path=>execFileSync('git',['show',BASE_REF+':'+path],{maxBuffer:256*1024*1024});
 const gitJson=path=>JSON.parse(gitBuffer(path).toString('utf8'));
 const baseMarker=gitJson('data/current/actual-release-persisted.json');
 baseManifestBytes=gitBuffer(OUTPUT);
 baseManifest=JSON.parse(baseManifestBytes.toString('utf8'));
 const baseDocuments={
  catalog:gitJson(PATHS.catalog),
  inventory:gitJson(PATHS.inventory),
  roGeo:gitJson(PATHS.ro_geojson),
  mdGeo:gitJson(PATHS.md_geojson),
  roOfficial:gitJson(PATHS.ro_official),
  mdOfficial:gitJson(PATHS.md_official),
  mdIndividualReview:gitJson(PATHS.md_individual_review),
  settlementPolicy:gitJson(PATHS.settlement_policy)
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
 catalog.generated_at,roGate.generated_at,mdGate.generated_at,siruta.fetched_at,cuatm.fetched_at
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
 schema_version:7,
 mode:'ACTUAL',
 snapshot_id:snapshotId,
 generated_at:generatedAt,
 release_fingerprint_sha256:releaseFingerprint,
 content_fingerprint_sha256:semanticFingerprint.sha256,
 component_byte_fingerprint_sha256:byteFingerprint.sha256,
 content_identity:contentIdentity,
 policy:'Stable administrative-content identity separated from exact-byte integrity, exact source provenance, frozen review-evidence provenance, kernel-enforced network-denial proof and exact execution-environment provenance. Snapshot identity is derived from canonical semantic ACTUAL content; exact component SHA256 values plus source-bundle, review-evidence-bundle, network-denial and build-environment bindings remain mandatory integrity constraints.',
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
 settlement_policy:{
  path:PATHS.settlement_policy,
  schema_version:settlementPolicy.schema_version??null,
  policy_version:settlementPolicy.policy_version??null,
  scope:settlementPolicy.scope??null,
  sha256:components.settlement_policy.sha256
 },
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

const baseComponentBytesMatch=Boolean(baseManifest)&&Object.keys(PATHS).every(key=>
 baseManifest.components?.[key]?.sha256===components[key].sha256
 && Number(baseManifest.components?.[key]?.bytes)===Number(components[key].bytes)
);
const baseSourceBundleMatches=Boolean(baseManifest)
 && baseManifest.source_bundle?.path===SOURCE_BUNDLE_PATH
 && baseManifest.source_bundle?.sha256===sourceBundleHash
 && baseManifest.source_bundle?.bundle_fingerprint_sha256===sourceBundle.bundle_fingerprint_sha256;
const baseReviewEvidenceMatches=Boolean(baseManifest)
 && baseManifest.review_evidence_bundle?.path===REVIEW_EVIDENCE_BUNDLE_PATH
 && baseManifest.review_evidence_bundle?.sha256===reviewEvidenceBundleHash
 && baseManifest.review_evidence_bundle?.bundle_fingerprint_sha256===reviewEvidenceBundle.bundle_fingerprint_sha256;
const baseNetworkDenialMatches=Boolean(baseManifest)
 && baseManifest.network_denial?.path===NETWORK_DENIAL
 && baseManifest.network_denial?.sha256===networkDenialHash
 && baseManifest.network_denial?.status==='PASS';
const baseBuildEnvironmentMatches=Boolean(baseManifest)
 && baseManifest.build_environment?.path===BUILD_ENVIRONMENT_PATH
 && baseManifest.build_environment?.sha256===buildEnvironmentHash
 && baseManifest.build_environment?.environment_fingerprint_sha256===buildEnvironment.environment_fingerprint_sha256;
const reuseExactBaseManifest=baseSemanticMatches&&baseComponentBytesMatch&&baseSourceBundleMatches&&baseReviewEvidenceMatches&&baseNetworkDenialMatches&&baseBuildEnvironmentMatches&&baseManifestBytes;

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
  build_environment_fingerprint_sha256:manifest.build_environment.environment_fingerprint_sha256,
  release_identity_basis:manifest.content_identity?.release_identity_basis??null,
  exact_base_manifest_bytes_reused:false,
  entity_count:manifest.catalog.entity_count,
  public_contract:manifest.public_contract.contract,
  feature_count:{RO:manifest.geometry.RO.feature_count,MD:manifest.geometry.MD.feature_count},
  gates:{RO:manifest.jurisdiction_gates.RO.status,MD:manifest.jurisdiction_gates.MD.status}
 },null,2));
}
