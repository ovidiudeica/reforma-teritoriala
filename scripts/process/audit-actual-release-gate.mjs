#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {actualSemanticFingerprint,byteFingerprintFromHashes} from '../lib/actual-semantic-fingerprint.mjs';
import {SOURCE_BUNDLE_GATE_PATH,SOURCE_BUNDLE_PATH,sha256 as sourceSha256,validateSourceBundleManifest} from '../lib/actual-source-bundle.mjs';
import {BUILD_ENVIRONMENT_PATH,sha256 as environmentSha256,validateBuildEnvironmentManifest} from '../lib/actual-build-environment.mjs';
const MANIFEST='data/current/actual-release-manifest.json';
const TOPOLOGY_AUDIT='data/current/actual-topology-audit.json';
const topology=JSON.parse(await readFile(TOPOLOGY_AUDIT,'utf8'));

const OUTPUT='data/current/actual-release-gate.json';
const SETTLEMENT_POLICY='data/sources/actual-settlement-policy.json';
const sha256=buf=>createHash('sha256').update(buf).digest('hex');
const manifestBuf=await readFile(MANIFEST);
const settlementPolicyBuf=await readFile(SETTLEMENT_POLICY);
const manifest=JSON.parse(manifestBuf.toString('utf8'));
const settlementPolicy=JSON.parse(settlementPolicyBuf.toString('utf8'));
const sourceBundleBuf=await readFile(SOURCE_BUNDLE_PATH);
const sourceBundle=JSON.parse(sourceBundleBuf.toString('utf8'));
const sourceBundleGate=JSON.parse(await readFile(SOURCE_BUNDLE_GATE_PATH,'utf8'));
const sourceBundleValidation=await validateSourceBundleManifest(sourceBundle);
const buildEnvironmentBuf=await readFile(BUILD_ENVIRONMENT_PATH);
const buildEnvironment=JSON.parse(buildEnvironmentBuf.toString('utf8'));
const buildEnvironmentValidation=await validateBuildEnvironmentManifest(buildEnvironment);
const paths=Object.fromEntries(Object.entries(manifest.components||{}).map(([key,value])=>[key,value?.path]).filter(([,path])=>path));
const buffers={};
for(const [key,path] of Object.entries(paths))buffers[key]=await readFile(path);
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
const mdIndividual=json('md_individual_review');
const mdSemantic=json('md_semantic_bridge');
const jurisdictions=['RO','MD'];
const tierKeys=['ro_overview','ro_local','ro_detail','md_overview','md_local','md_detail'];
const entities=Array.isArray(catalog.entities)?catalog.entities:[];
const entityCounts=Object.fromEntries(jurisdictions.map(j=>[j,entities.filter(e=>e.jurisdiction===j).length]));
const featureCounts={
 RO:Array.isArray(roGeo.features)?roGeo.features.length:0,
 MD:Array.isArray(mdGeo.features)?mdGeo.features.length:0
};
const currentHashes=Object.fromEntries(Object.entries(buffers).map(([key,buf])=>[key,sha256(buf)]));
const legacyFingerprintPayload={
 mode:'ACTUAL',
 jurisdictions,
 components:Object.fromEntries(Object.keys(manifest.components||{}).map(key=>[key,currentHashes[key]??null]))
};
const legacyFingerprint=sha256(Buffer.from(JSON.stringify(legacyFingerprintPayload),'utf8'));
const byteFingerprint=byteFingerprintFromHashes(Object.fromEntries(Object.keys(manifest.components||{}).map(key=>[key,currentHashes[key]??null])));
const semanticFingerprint=actualSemanticFingerprint({
 catalog,
 inventory,
 roGeo,
 mdGeo,
 roOfficial:siruta,
 mdOfficial:cuatm,
 mdIndividualReview:mdIndividual,
 settlementPolicy
});
const failures=[],checks=[];
const check=(name,ok,detail={})=>{checks.push({name,ok:Boolean(ok),detail});if(!ok)failures.push({name,detail});};

check('master_topology_audit_passes',topology?.status==='PASS',{status:topology?.status??null,blocking_issue_count:topology?.blocking_issue_count??null,observation_count:topology?.observation_count??null,source:TOPOLOGY_AUDIT,mutation:false});

check('manifest_quality_gates_pass',
 manifest.quality_gates?.topology?.status==='PASS'
 && manifest.quality_gates?.regression?.status==='PASS'
 && manifest.quality_gates?.structural_completeness?.status==='PASS'
 && manifest.quality_gates?.official_identity?.status==='PASS',
 {topology:manifest.quality_gates?.topology?.status??null,
  regression:manifest.quality_gates?.regression?.status??null,
  structural_completeness:manifest.quality_gates?.structural_completeness?.status??null,
  structural_blocking_issue_count:manifest.quality_gates?.structural_completeness?.blocking_issue_count??null,
  official_identity:manifest.quality_gates?.official_identity?.status??null,
  official_identity_blocking_issue_count:manifest.quality_gates?.official_identity?.blocking_issue_count??null});
check('settlement_policy_is_explicit_and_fail_closed',
 settlementPolicy.schema_version===1
 && settlementPolicy.mode==='ACTUAL'
 && settlementPolicy.scope==='settlements_and_component_localities'
 && settlementPolicy.common_requirements?.exhaustive_polygon_coverage_required===false
 && settlementPolicy.common_requirements?.missing_official_settlement_polygon_is_blocking===false
 && settlementPolicy.common_requirements?.geometry_coordinate_mutation_allowed===false
 && settlementPolicy.common_requirements?.unreviewed_identity_inference_allowed===false,
 {schema_version:settlementPolicy.schema_version??null,mode:settlementPolicy.mode??null,scope:settlementPolicy.scope??null,common_requirements:settlementPolicy.common_requirements??null});
check('manifest_records_current_settlement_policy',
 manifest.settlement_policy?.schema_version===settlementPolicy.schema_version
 && manifest.settlement_policy?.policy_version===settlementPolicy.policy_version
 && manifest.settlement_policy?.scope===settlementPolicy.scope
 && manifest.settlement_policy?.sha256===sha256(settlementPolicyBuf),
 {manifest:manifest.settlement_policy??null,actual:{schema_version:settlementPolicy.schema_version??null,policy_version:settlementPolicy.policy_version??null,scope:settlementPolicy.scope??null,sha256:sha256(settlementPolicyBuf)}});
check('md_semantic_bridge_passes',mdSemantic.status==='PASS',{status:mdSemantic.status??null,summary:mdSemantic.summary??null});
check('manifest_records_current_md_semantic_bridge',manifest.semantic_bridges?.MD?.status==='PASS'&&manifest.semantic_bridges?.MD?.sha256===currentHashes.md_semantic_bridge,{manifest:manifest.semantic_bridges?.MD??null,actual:{status:mdSemantic.status??null,sha256:currentHashes.md_semantic_bridge??null}});
check('source_bundle_gate_passes',
 sourceBundleValidation.status==='PASS'
 && sourceBundleGate.status==='PASS'
 && sourceBundleGate.source_bundle_sha256===sourceSha256(sourceBundleBuf)
 && sourceBundleGate.bundle_fingerprint_sha256===sourceBundle.bundle_fingerprint_sha256,
 {validation_status:sourceBundleValidation.status,gate_status:sourceBundleGate.status,gate_bundle_sha256:sourceBundleGate.source_bundle_sha256??null,actual_bundle_sha256:sourceSha256(sourceBundleBuf),fingerprint:sourceBundle.bundle_fingerprint_sha256??null});
check('manifest_binds_current_source_bundle',
 manifest.source_bundle?.path===SOURCE_BUNDLE_PATH
 && manifest.source_bundle?.schema_version===sourceBundle.schema_version
 && manifest.source_bundle?.mode===sourceBundle.mode
 && manifest.source_bundle?.source_watermark===sourceBundle.source_watermark
 && manifest.source_bundle?.bundle_fingerprint_algorithm===sourceBundle.bundle_fingerprint_algorithm
 && manifest.source_bundle?.bundle_fingerprint_sha256===sourceBundle.bundle_fingerprint_sha256
 && manifest.source_bundle?.sha256===sourceSha256(sourceBundleBuf),
 {manifest:manifest.source_bundle??null,actual:{path:SOURCE_BUNDLE_PATH,schema_version:sourceBundle.schema_version,mode:sourceBundle.mode,source_watermark:sourceBundle.source_watermark,bundle_fingerprint_algorithm:sourceBundle.bundle_fingerprint_algorithm,bundle_fingerprint_sha256:sourceBundle.bundle_fingerprint_sha256,sha256:sourceSha256(sourceBundleBuf)}});
check('build_environment_manifest_matches_repository',
 buildEnvironmentValidation.status==='PASS',
 {status:buildEnvironmentValidation.status,failures:buildEnvironmentValidation.failures});
check('manifest_binds_current_build_environment',
 manifest.build_environment?.path===BUILD_ENVIRONMENT_PATH
 && manifest.build_environment?.schema_version===buildEnvironment.schema_version
 && manifest.build_environment?.mode===buildEnvironment.mode
 && manifest.build_environment?.runner_label===buildEnvironment.environment?.runner?.label
 && manifest.build_environment?.runner_image_version===buildEnvironment.environment?.runner?.image_version
 && manifest.build_environment?.environment_fingerprint_algorithm===buildEnvironment.environment_fingerprint_algorithm
 && manifest.build_environment?.environment_fingerprint_sha256===buildEnvironment.environment_fingerprint_sha256
 && manifest.build_environment?.sha256===environmentSha256(buildEnvironmentBuf),
 {manifest:manifest.build_environment??null,actual:{path:BUILD_ENVIRONMENT_PATH,schema_version:buildEnvironment.schema_version,mode:buildEnvironment.mode,runner_label:buildEnvironment.environment?.runner?.label??null,runner_image_version:buildEnvironment.environment?.runner?.image_version??null,environment_fingerprint_algorithm:buildEnvironment.environment_fingerprint_algorithm,environment_fingerprint_sha256:buildEnvironment.environment_fingerprint_sha256,sha256:environmentSha256(buildEnvironmentBuf)}});
check('manifest_mode_is_actual',manifest.mode==='ACTUAL',{mode:manifest.mode});
check('manifest_jurisdictions_are_exactly_ro_md',
 Array.isArray(manifest.jurisdictions)&&manifest.jurisdictions.length===2&&manifest.jurisdictions[0]==='RO'&&manifest.jurisdictions[1]==='MD',
 {jurisdictions:manifest.jurisdictions});
check('jurisdiction_release_gates_pass',roGate.status==='PASS'&&mdGate.status==='PASS',{RO:roGate.status,MD:mdGate.status});
check('manifest_records_passing_jurisdiction_gates',
 manifest.jurisdiction_gates?.RO?.status==='PASS'&&manifest.jurisdiction_gates?.MD?.status==='PASS',
 {RO:manifest.jurisdiction_gates?.RO?.status,MD:manifest.jurisdiction_gates?.MD?.status});

const componentDrift=[];
for(const [key,entry] of Object.entries(manifest.components||{})){
 const actual=currentHashes[key]??null;
 if(actual!==entry?.sha256)componentDrift.push({key,path:entry?.path??null,expected:entry?.sha256??null,actual});
}
check('manifest_component_hashes_match_current_snapshot',componentDrift.length===0,{drift:componentDrift});
if((manifest.schema_version??0)>=3){
 check('manifest_component_byte_fingerprint_matches_current_snapshot',
  manifest.component_byte_fingerprint_sha256===byteFingerprint.sha256,
  {expected:manifest.component_byte_fingerprint_sha256??null,actual:byteFingerprint.sha256});
 check('manifest_semantic_content_fingerprint_matches_current_snapshot',
  manifest.content_identity?.algorithm===semanticFingerprint.algorithm
  && manifest.content_fingerprint_sha256===semanticFingerprint.sha256
  && manifest.content_identity?.sha256===semanticFingerprint.sha256,
  {manifest:manifest.content_identity??null,expected:semanticFingerprint.sha256,actual:manifest.content_fingerprint_sha256??null});
 const reused=manifest.content_identity?.reused_base_release===true;
 const expectedReleaseFingerprint=reused
  ?manifest.content_identity?.base_release_fingerprint_sha256
  :semanticFingerprint.sha256;
 check('release_identity_basis_is_valid',
  reused
   ?manifest.content_identity?.release_identity_basis==='base_release_compatibility_reuse'
     && manifest.content_identity?.base_content_sha256===semanticFingerprint.sha256
     && typeof manifest.content_identity?.base_snapshot_id==='string'
   :manifest.content_identity?.release_identity_basis==='semantic_content_v1',
  {content_identity:manifest.content_identity??null});
 check('release_fingerprint_matches_semantic_identity',
  manifest.release_fingerprint_sha256===expectedReleaseFingerprint,
  {expected:expectedReleaseFingerprint??null,actual:manifest.release_fingerprint_sha256??null,reused_base_release:reused});
 const expectedSnapshotId=reused
  ?manifest.content_identity?.base_snapshot_id
  :'actual-'+semanticFingerprint.sha256.slice(0,16);
 check('snapshot_id_matches_stable_release_identity',
  manifest.snapshot_id===expectedSnapshotId,
  {expected:expectedSnapshotId??null,actual:manifest.snapshot_id,reused_base_release:reused});
}else{
 const expectedSnapshotId='actual-'+legacyFingerprint.slice(0,16);
 check('release_fingerprint_matches_current_components',
  manifest.release_fingerprint_sha256===legacyFingerprint,
  {expected:manifest.release_fingerprint_sha256,actual:legacyFingerprint});
 check('snapshot_id_matches_release_fingerprint',manifest.snapshot_id===expectedSnapshotId,{expected:expectedSnapshotId,actual:manifest.snapshot_id});
}

const validTimes=[
 catalog.generated_at,roGate.generated_at,mdGate.generated_at,siruta.fetched_at,cuatm.fetched_at
].filter(Boolean).map(x=>new Date(x)).filter(x=>Number.isFinite(x.getTime()));
const expectedGeneratedAt=(validTimes.length?new Date(Math.max(...validTimes.map(x=>x.getTime()))):new Date(0)).toISOString();
check('manifest_generated_at_matches_snapshot_watermark',manifest.generated_at===expectedGeneratedAt,{expected:expectedGeneratedAt,actual:manifest.generated_at});

check('catalog_declared_entity_count_is_consistent',catalog.entity_count===entities.length,{declared:catalog.entity_count,actual:entities.length});
check('manifest_catalog_entity_count_is_current',
 manifest.catalog?.entity_count===entities.length&&manifest.catalog?.declared_entity_count===catalog.entity_count,
 {manifest:manifest.catalog?.entity_count,catalog_declared:catalog.entity_count,actual:entities.length});
check('actual_catalog_contains_current_entities_only',
 entities.every(e=>e.status==='current'),
 {non_current:entities.filter(e=>e.status!=='current').slice(0,25).map(e=>({id:e.id,status:e.status}))});
check('manifest_jurisdiction_entity_counts_are_current',
 jurisdictions.every(j=>manifest.catalog?.entity_count_by_jurisdiction?.[j]===entityCounts[j]),
 {manifest:manifest.catalog?.entity_count_by_jurisdiction,actual:entityCounts});
check('manifest_classifier_version_is_current',
 manifest.catalog?.classifier_version===catalog.classifier_version,
 {manifest:manifest.catalog?.classifier_version,actual:catalog.classifier_version});
check('manifest_administrative_model_is_current',
 manifest.administrative_model?.schema_version===inventory.schema_version&&manifest.administrative_model?.as_of===inventory.as_of,
 {manifest:manifest.administrative_model,actual:{schema_version:inventory.schema_version,as_of:inventory.as_of}});

check('public_geojson_feature_counts_are_nonzero',featureCounts.RO>0&&featureCounts.MD>0,featureCounts);
check('manifest_public_geojson_feature_counts_are_current',
 manifest.geometry?.RO?.feature_count===featureCounts.RO&&manifest.geometry?.MD?.feature_count===featureCounts.MD,
 {manifest:{RO:manifest.geometry?.RO?.feature_count,MD:manifest.geometry?.MD?.feature_count},actual:featureCounts});

const publicEntities=Array.isArray(publicIndex.entities)?publicIndex.entities:[];
const publicIds=new Set(publicEntities.map(x=>x.id));
const catalogIds=new Set(entities.map(x=>x.id));
const missingPublic=[...catalogIds].filter(id=>!publicIds.has(id));
const unexpectedPublic=[...publicIds].filter(id=>!catalogIds.has(id));
check('public_contract_identity_set_matches_catalog',
 publicIndex.contract==='actual-public-entity-v1'&&publicEntities.length===entities.length&&missingPublic.length===0&&unexpectedPublic.length===0,
 {contract:publicIndex.contract,public_count:publicEntities.length,catalog_count:entities.length,missing:missingPublic.slice(0,25),unexpected:unexpectedPublic.slice(0,25)});
check('public_contract_contains_current_entities_only',
 publicEntities.every(x=>x.status==='current'),
 {non_current:publicEntities.filter(x=>x.status!=='current').slice(0,25).map(x=>({id:x.id,status:x.status}))});
check('public_contract_separates_legal_and_representation',
 publicEntities.every(x=>Object.prototype.hasOwnProperty.call(x,'legal')&&x.representation?.source==='OpenStreetMap'&&x.representation?.geometry_role==='current_representation'),
 {invalid:publicEntities.filter(x=>!Object.prototype.hasOwnProperty.call(x,'legal')||x.representation?.source!=='OpenStreetMap'||x.representation?.geometry_role!=='current_representation').slice(0,25).map(x=>x.id)});
check('public_contract_jurisdiction_counts_match_catalog',
 jurisdictions.every(j=>publicIndex.entity_count_by_jurisdiction?.[j]===entityCounts[j]),
 {public:publicIndex.entity_count_by_jurisdiction,actual:entityCounts});

const reviewedPublicById=new Map(publicEntities.map(x=>[x.id,x]));
const reviewedStatusIssues=(mdIndividual.cases||[]).flatMap(review=>{
 const entity=reviewedPublicById.get(review.osm_id);
 const expected=review.review_status==='resolved_positive_identity'
  ?'reconciled'
  :review.review_status==='resolved_semantic_classification'
   ?'reviewed_representation_without_legal_identity'
   :review.review_status==='unresolved_identity'?'unresolved':null;
 const identityOk=review.review_status!=='resolved_positive_identity'
  ||(entity?.legal?.registry==='CUATM'&&String(entity?.legal?.id||'')===String(review.official_legal_id||'')&&entity?.legal?.geometry_equivalence_asserted===false);
 return entity&&expected&&entity.validation?.legal_identity_status===expected&&identityOk
  ?[]
  :[{osm_id:review.osm_id,review_status:review.review_status,expected,expected_legal_id:review.official_legal_id??null,actual:entity?.validation?.legal_identity_status??null,actual_legal:entity?.legal??null}];
});
check('md_reviewed_public_identity_status_is_stable',reviewedStatusIssues.length===0,{issues:reviewedStatusIssues});

const tierDocs=Object.fromEntries(tierKeys.map(key=>[key,json(key)]));
const tierIssues=[];
const fidelityIssues=[];
const seenGeometryIds=new Set();
const publicById=new Map(publicEntities.map(x=>[x.id,x]));
const masterGeometryById=new Map(
 [...(roGeo.features||[]),...(mdGeo.features||[])]
  .filter(f=>f.properties?.catalog_id)
  .map(f=>[f.properties.catalog_id,f.geometry])
);
for(const key of tierKeys){
 const doc=tierDocs[key];
 const [jurisdictionRaw,tier]=key.split('_');
 const jurisdiction=jurisdictionRaw.toUpperCase();
 for(const f of doc.features||[]){
  const p=f.properties||{};
  const entity=publicById.get(p.entity_id);
  if(!entity)tierIssues.push({key,entity_id:p.entity_id,issue:'unknown_entity'});
  if(entity&&entity.jurisdiction!==jurisdiction)tierIssues.push({key,entity_id:p.entity_id,issue:'jurisdiction_mismatch'});
  if(entity&&entity.map?.tier!==tier)tierIssues.push({key,entity_id:p.entity_id,issue:'tier_mismatch',expected:entity.map?.tier});
  if('tags' in p)tierIssues.push({key,entity_id:p.entity_id,issue:'raw_tags_leaked'});
  if(p.geometry_precision!=='master_coordinate_fidelity')fidelityIssues.push({key,entity_id:p.entity_id,issue:'precision_marker_mismatch',actual:p.geometry_precision??null});
  const masterGeometry=masterGeometryById.get(p.entity_id);
  if(!masterGeometry)fidelityIssues.push({key,entity_id:p.entity_id,issue:'master_geometry_missing'});
  else if(JSON.stringify(f.geometry)!==JSON.stringify(masterGeometry))fidelityIssues.push({key,entity_id:p.entity_id,issue:'coordinate_drift'});
  if(seenGeometryIds.has(p.entity_id))tierIssues.push({key,entity_id:p.entity_id,issue:'duplicate_public_geometry'});
  seenGeometryIds.add(p.entity_id);
 }
}
const missingGeometry=[...publicIds].filter(id=>!seenGeometryIds.has(id));
check('tiered_public_geometry_matches_public_contract',
 tierIssues.length===0&&missingGeometry.length===0&&seenGeometryIds.size===publicEntities.length,
 {issues:tierIssues.slice(0,25),missing:missingGeometry.slice(0,25),geometry_count:seenGeometryIds.size,entity_count:publicEntities.length});
check('tiered_public_geometry_preserves_master_coordinates',
 fidelityIssues.length===0,
 {issues:fidelityIssues.slice(0,25),checked_geometry_count:seenGeometryIds.size});

const publicTierCounts={
 RO:['ro_overview','ro_local','ro_detail'].reduce((n,key)=>n+(tierDocs[key].features||[]).length,0),
 MD:['md_overview','md_local','md_detail'].reduce((n,key)=>n+(tierDocs[key].features||[]).length,0)
};
check('tiered_public_geometry_cardinality_matches_master',
 publicTierCounts.RO===featureCounts.RO&&publicTierCounts.MD===featureCounts.MD,
 {public:publicTierCounts,master:featureCounts});
check('manifest_public_contract_is_current',
 manifest.public_contract?.contract===publicIndex.contract
 && manifest.public_contract?.entity_count===publicIndex.entity_count
 && manifest.public_contract?.sha256===currentHashes.public_index,
 {manifest:manifest.public_contract,actual:{contract:publicIndex.contract,entity_count:publicIndex.entity_count,sha256:currentHashes.public_index}});

check('manifest_jurisdiction_gate_timestamps_are_current',
 manifest.jurisdiction_gates?.RO?.generated_at===roGate.generated_at&&manifest.jurisdiction_gates?.MD?.generated_at===mdGate.generated_at,
 {manifest:{RO:manifest.jurisdiction_gates?.RO?.generated_at,MD:manifest.jurisdiction_gates?.MD?.generated_at},actual:{RO:roGate.generated_at,MD:mdGate.generated_at}});

const sirutaCount=siruta.record_count??(Array.isArray(siruta.records)?siruta.records.length:null);
const cuatmCount=cuatm.record_count??(Array.isArray(cuatm.records)?cuatm.records.length:null);
check('manifest_ro_official_source_is_current',
 manifest.official_sources?.RO?.reference_year===siruta.reference_year
 && manifest.official_sources?.RO?.fetched_at===siruta.fetched_at
 && manifest.official_sources?.RO?.record_count===sirutaCount
 && manifest.official_sources?.RO?.semantic_sha256===(siruta.semantic_sha256??null)
 && manifest.official_sources?.RO?.source_content_sha256===(siruta.source?.content_sha256??null),
 {manifest:manifest.official_sources?.RO,actual:{reference_year:siruta.reference_year,fetched_at:siruta.fetched_at,record_count:sirutaCount}});
check('manifest_md_official_source_is_current',
 manifest.official_sources?.MD?.source_url===(cuatm.source_url??null)
 && manifest.official_sources?.MD?.fetched_at===(cuatm.fetched_at??null)
 && manifest.official_sources?.MD?.record_count===cuatmCount,
 {manifest:manifest.official_sources?.MD,actual:{source_url:cuatm.source_url??null,fetched_at:cuatm.fetched_at??null,record_count:cuatmCount}});

const report={
 schema_version:2,
 generated_at:new Date().toISOString(),
 mode:'ACTUAL',
 snapshot_id:manifest.snapshot_id??null,
 manifest_path:MANIFEST,
 manifest_sha256:sha256(manifestBuf),
 status:failures.length?'FAIL':'PASS',
 policy:'The public ACTUAL RO+MD release is publishable only when the exact OSM/SIRUTA/CUATM source bundle and exact GitHub Actions execution environment are cryptographically bound by the release manifest, master topology has no blocking structural corruption, both jurisdiction gates pass, exact master/public bytes remain bound, and public geometry preserves master coordinates without simplification. Any source, environment or release drift fails closed.',
 checks,
 failures
};
const readOnly=process.env.ACTUAL_RELEASE_GATE_READ_ONLY==='1';
if(!readOnly)await writeFile(OUTPUT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,read_only:readOnly},null,2));
if(failures.length)process.exit(1);
