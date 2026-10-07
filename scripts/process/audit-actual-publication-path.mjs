#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

const base=process.env.BASE_SHA;
const head=process.env.HEAD_SHA;
const headRef=process.env.HEAD_REF;
const exactSha=/^[0-9a-f]{40}$/;
if(!exactSha.test(base??'')||!exactSha.test(head??''))throw new Error('BASE_SHA and HEAD_SHA must be exact lowercase 40-hex commits.');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
if(git('rev-parse',base+'^{commit}')!==base)throw new Error('BASE_SHA did not resolve exactly.');
if(git('rev-parse',head+'^{commit}')!==head)throw new Error('HEAD_SHA did not resolve exactly.');

const changed=git('diff','--name-only',base,head).split('\n').filter(Boolean);
console.log(changed.join('\n'));
const publicationSurface=path=>
 path.startsWith('data/current/')
 || path==='public/data/actual-entities.json'
 || path==='public/data/actual-geometry-chunks.json'
 || path==='public/data/actual-consolidated-tree.json'
 || path.startsWith('public/geo/current/')
 || path.startsWith('public/geo/actual/')
 || path==='data/sources/actual-settlement-policy.json'
 || path==='data/sources/actual-statistical-policy.json'
 || path==='schemas/actual-statistical-hierarchy-contract.json'
 || path==='data/sources/ro-siruta-current.json'
 || path==='data/sources/cuatm-current.json'
 || path==='data/sources/osm-current.json'
 || path.startsWith('data/sources/osm-snapshots/')
 || path==='data/sources/ro-osm-official-exception-history.json'
 || path==='data/sources/ro-osm-level9-exception-history.json'
 || path==='data/sources/md-osm-multiple-representation-history.json'
 || path==='data/sources/md-balti-city-boundary-way-history.json'
 || path==='data/sources/md-balti-city-boundary-changeset-semantics.json';

if(!changed.some(publicationSurface)){
 console.log(JSON.stringify({status:'PASS',mode:'no_actual_publication_surface_change',base,head},null,2));
 process.exit(0);
}

const failures=[];
const check=(ok,issue,detail={})=>{if(!ok)failures.push({issue,...detail});};
const sha=x=>createHash('sha256').update(x).digest('hex');

if(/^actual\/candidate-/.test(headRef??'')){
 const candidateCommit=git('rev-parse',head+'^');
 const candidateParent=git('rev-parse',candidateCommit+'^');
 const candidateChanged=git('diff','--name-only',base,candidateCommit).split('\n').filter(Boolean);
 const promotionChanged=git('diff','--name-only',candidateCommit,head).split('\n').filter(Boolean);
 const candidateAllowed=path=>publicationSurface(path);
 const candidateForbidden=candidateChanged.filter(path=>
  !candidateAllowed(path)
  || path==='data/current/actual-release-persisted.json'
  || path==='data/current/actual-candidate-promotion-audit.json'
 );
 const expectedPromotionWrites=[
  'data/current/actual-candidate-promotion-audit.json',
  'data/current/actual-release-persisted.json'
 ];
 const candidate=JSON.parse(await readFile('data/current/actual-release-candidate.json','utf8'));
 const promotion=JSON.parse(await readFile('data/current/actual-candidate-promotion-audit.json','utf8'));
 const persisted=JSON.parse(await readFile('data/current/actual-release-persisted.json','utf8'));
 const diffBytes=await readFile('data/current/actual-candidate-diff.json');
 const manifestBytes=await readFile('data/current/actual-release-manifest.json');
 const manifest=JSON.parse(manifestBytes);

 const count=Number(git('rev-list','--count',base+'..'+head));
 check(count===2,'promotion_pr_not_exactly_two_commits',{count});
 check(candidateParent===base,'promotion_candidate_not_direct_child_of_base',{expected:base,actual:candidateParent});
 check(candidateForbidden.length===0,'candidate_commit_write_boundary_violation',{paths:candidateForbidden});
 check(JSON.stringify([...promotionChanged].sort())===JSON.stringify(expectedPromotionWrites),'promotion_commit_write_boundary_violation',{expected:expectedPromotionWrites,actual:[...promotionChanged].sort()});
 check(candidate.schema_version===2&&candidate.mode==='ACTUAL_CANDIDATE'&&candidate.status==='CHANGE','candidate_marker_not_change');
 check(candidate.base_ref===base,'candidate_base_sha_mismatch',{candidate:candidate.base_ref,base});
 check(promotion.status==='PASS'&&promotion.mode==='ACTUAL_CANDIDATE_PROMOTION','promotion_audit_not_pass');
 check(promotion.base_ref===base,'promotion_audit_base_sha_mismatch',{promotion:promotion.base_ref,base});
 check(promotion.candidate_commit_sha===candidateCommit,'promotion_audit_candidate_commit_mismatch',{promotion:promotion.candidate_commit_sha,candidateCommit});
 check(persisted.snapshot_id===manifest.snapshot_id,'persisted_snapshot_manifest_mismatch');
 check(persisted.manifest_sha256===sha(manifestBytes),'persisted_manifest_hash_mismatch');
 check(persisted.promoted_from_candidate?.base_commit_sha===base,'persisted_promotion_base_mismatch');
 check(persisted.promoted_from_candidate?.candidate_identity_sha256===candidate.candidate_identity_sha256,'persisted_candidate_identity_mismatch');
 check(persisted.promoted_from_candidate?.candidate_commit_sha===candidateCommit,'persisted_candidate_commit_mismatch',{persisted:persisted.promoted_from_candidate?.candidate_commit_sha,candidateCommit});
 check(persisted.promoted_from_candidate?.diff_report_sha256===sha(diffBytes),'persisted_diff_hash_mismatch');
 check(persisted.validated_release_gate_status==='PASS','persisted_gate_not_pass');

 console.log(JSON.stringify({status:failures.length?'FAIL':'PASS',mode:'candidate_promotion',base,head,candidate_commit:candidateCommit,failures},null,2));
}else if(headRef==='p2/public-statistical-contract'){
 const allowedPrep=new Set([
  '.github/workflows/p2-statistical-foundation.yml',
  'app.js','index.html','style.css',
  'schemas/actual-public-entity-v3.schema.json',
  'schemas/actual-statistical-hierarchy-contract.json',
  'scripts/lib/actual-semantic-fingerprint.mjs',
  'scripts/lib/actual-statistical-public.mjs',
  'scripts/process/audit-actual-publication-path.mjs',
  'scripts/process/audit-actual-release-gate.mjs',
  'scripts/process/audit-actual-statistical-public.mjs',
  'scripts/process/build-actual-public-data.mjs',
  'scripts/process/build-actual-release-manifest.mjs',
  'scripts/test/actual-candidate-lifecycle.test.mjs',
  'scripts/test/actual-statistical-public.test.mjs',
  'scripts/test/frontend-smoke.test.mjs',
  'tools/p2/actual-md-statistical-layer.mjs',
  'tools/p2/actual-ro-statistical-layer.mjs',
  'tools/p2/actual-statistical-contract.mjs',
  'tools/p2/actual-statistical-contract.test.mjs'
 ]);
 const forbidden=changed.filter(path=>!allowedPrep.has(path));
 const basePolicy=JSON.parse(execFileSync('git',['show',base+':data/sources/actual-statistical-policy.json'],{encoding:'utf8',maxBuffer:256*1024*1024}));
 const headPolicy=JSON.parse(await readFile('data/sources/actual-statistical-policy.json','utf8'));
 const baseManifest=JSON.parse(execFileSync('git',['show',base+':data/current/actual-release-manifest.json'],{encoding:'utf8',maxBuffer:256*1024*1024}));
 const headManifest=JSON.parse(await readFile('data/current/actual-release-manifest.json','utf8'));
 const basePublic=JSON.parse(execFileSync('git',['show',base+':public/data/actual-entities.json'],{encoding:'utf8',maxBuffer:256*1024*1024}));
 const headPublic=JSON.parse(await readFile('public/data/actual-entities.json','utf8'));
 check(forbidden.length===0,'p2_public_prep_changed_forbidden_paths',{paths:forbidden});
 check(basePolicy.activated===false&&headPolicy.activated===false,'p2_public_prep_must_not_activate_policy');
 check(baseManifest.snapshot_id===headManifest.snapshot_id&&baseManifest.release_fingerprint_sha256===headManifest.release_fingerprint_sha256,'p2_public_prep_changed_release_identity');
 check(basePublic.contract===headPublic.contract&&basePublic.entity_count===headPublic.entity_count,'p2_public_prep_changed_public_contract');
 console.log(JSON.stringify({status:failures.length?'FAIL':'PASS',mode:'p2_public_statistical_contract_prep',base,head,failures},null,2));
}else if(/^actual\/provenance-/.test(headRef??'')){
 const allowedPublication=new Set([
  'data/current/actual-host-trust-manifest.json',
  'data/current/actual-oci-builder.json',
  'data/current/actual-oci-builder-gate.json',
  'data/current/actual-runtime-image.json',
  'data/current/actual-build-environment-manifest.json',
  'data/current/actual-build-environment-gate.json',
  'data/current/actual-release-manifest.json',
  'data/current/actual-release-gate.json',
  'data/current/actual-release-persisted.json'
 ]);
 const publicationChanged=changed.filter(publicationSurface);
 const forbiddenPublication=publicationChanged.filter(path=>!allowedPublication.has(path));
 const basePersisted=JSON.parse(execFileSync('git',['show',base+':data/current/actual-release-persisted.json'],{encoding:'utf8'}));
 const headPersisted=JSON.parse(await readFile('data/current/actual-release-persisted.json','utf8'));
 const baseManifest=JSON.parse(execFileSync('git',['show',base+':data/current/actual-release-manifest.json'],{encoding:'utf8'}));
 const headManifestBytes=await readFile('data/current/actual-release-manifest.json');
 const headManifest=JSON.parse(headManifestBytes);
 const hostTrustBytes=await readFile('data/current/actual-host-trust-manifest.json');
 const hostTrust=JSON.parse(hostTrustBytes);
 const baseOciBuilder=JSON.parse(execFileSync('git',['show',base+':data/current/actual-oci-builder.json'],{encoding:'utf8'}));
 const ociBuilderBytes=await readFile('data/current/actual-oci-builder.json');
 const ociBuilder=JSON.parse(ociBuilderBytes);
 const ociBuilderGate=JSON.parse(await readFile('data/current/actual-oci-builder-gate.json','utf8'));
 const baseRuntime=JSON.parse(execFileSync('git',['show',base+':data/current/actual-runtime-image.json'],{encoding:'utf8'}));
 const runtimeBytes=await readFile('data/current/actual-runtime-image.json');
 const runtime=JSON.parse(runtimeBytes);
 const buildEnvironmentBytes=await readFile('data/current/actual-build-environment-manifest.json');
 const buildEnvironment=JSON.parse(buildEnvironmentBytes);
 const releaseGate=JSON.parse(await readFile('data/current/actual-release-gate.json','utf8'));

 check(forbiddenPublication.length===0,'provenance_migration_changed_forbidden_publication_paths',{paths:forbiddenPublication});
 check(headManifest.snapshot_id===baseManifest.snapshot_id,'provenance_migration_changed_snapshot_identity');
 check(headManifest.release_fingerprint_sha256===baseManifest.release_fingerprint_sha256,'provenance_migration_changed_release_fingerprint');
 check(headManifest.content_fingerprint_sha256===baseManifest.content_fingerprint_sha256,'provenance_migration_changed_content_fingerprint');
 check(headPersisted.snapshot_id===basePersisted.snapshot_id,'provenance_migration_persisted_snapshot_changed');
 check(headPersisted.release_fingerprint_sha256===basePersisted.release_fingerprint_sha256,'provenance_migration_persisted_fingerprint_changed');
 check(headPersisted.provenance_hardening?.previous_manifest_sha256===basePersisted.manifest_sha256,'provenance_migration_previous_manifest_binding_missing',{expected:basePersisted.manifest_sha256,actual:headPersisted.provenance_hardening?.previous_manifest_sha256??null});
 check(headPersisted.manifest_sha256===sha(headManifestBytes),'provenance_migration_manifest_hash_mismatch');
 check(JSON.stringify(ociBuilder.toolchain)===JSON.stringify(baseOciBuilder.toolchain),'provenance_migration_oci_toolchain_changed');
 check(JSON.stringify(ociBuilder.builder)===JSON.stringify(baseOciBuilder.builder),'provenance_migration_oci_builder_contract_changed');
 check(runtime.runtime?.digest===baseRuntime.runtime?.digest&&JSON.stringify(runtime.runtime)===JSON.stringify(baseRuntime.runtime),'provenance_migration_runtime_identity_changed',{expected:baseRuntime.runtime,actual:runtime.runtime});
 check(runtime.source?.dockerfile?.sha256===baseRuntime.source?.dockerfile?.sha256,'provenance_migration_runtime_dockerfile_changed');
 check(runtime.source?.builder_workflow?.sha256===ociBuilder.source?.builder_workflow?.sha256,'provenance_migration_runtime_builder_workflow_mismatch');
 check(runtime.builder_provenance?.manifest_sha256===sha(ociBuilderBytes),'provenance_migration_runtime_builder_manifest_hash_mismatch');
 check(runtime.builder_provenance?.builder_fingerprint_sha256===ociBuilder.builder_fingerprint_sha256,'provenance_migration_runtime_builder_fingerprint_mismatch');
 check(ociBuilderGate.status==='PASS','provenance_migration_oci_builder_gate_not_pass');
 check(ociBuilderGate.builder_manifest_sha256===sha(ociBuilderBytes),'provenance_migration_oci_builder_gate_manifest_mismatch');
 check(ociBuilderGate.builder_fingerprint_sha256===ociBuilder.builder_fingerprint_sha256,'provenance_migration_oci_builder_gate_fingerprint_mismatch');
 check(buildEnvironment.environment?.runtime_image?.manifest_sha256===sha(runtimeBytes),'provenance_migration_build_environment_runtime_hash_mismatch');
 check(buildEnvironment.environment?.runtime_image?.runtime_fingerprint_sha256===runtime.runtime_fingerprint_sha256,'provenance_migration_build_environment_runtime_fingerprint_mismatch');
 check(buildEnvironment.environment?.oci_builder?.manifest_sha256===sha(ociBuilderBytes),'provenance_migration_build_environment_oci_hash_mismatch');
 check(buildEnvironment.environment?.oci_builder?.builder_fingerprint_sha256===ociBuilder.builder_fingerprint_sha256,'provenance_migration_build_environment_oci_fingerprint_mismatch');
 check(headPersisted.host_trust_fingerprint_sha256===hostTrust.host_trust_fingerprint_sha256,'provenance_migration_host_trust_fingerprint_mismatch');
 check(headManifest.host_trust?.host_trust_fingerprint_sha256===hostTrust.host_trust_fingerprint_sha256,'provenance_migration_manifest_host_trust_fingerprint_mismatch');
 check(headManifest.host_trust?.sha256===sha(hostTrustBytes),'provenance_migration_host_trust_hash_mismatch');
 check(headPersisted.build_environment_fingerprint_sha256===buildEnvironment.environment_fingerprint_sha256,'provenance_migration_build_environment_fingerprint_mismatch');
 check(headManifest.build_environment?.environment_fingerprint_sha256===buildEnvironment.environment_fingerprint_sha256,'provenance_migration_manifest_build_environment_mismatch');
 check(headManifest.build_environment?.sha256===sha(buildEnvironmentBytes),'provenance_migration_build_environment_hash_mismatch');
 check(releaseGate.status==='PASS','provenance_migration_release_gate_not_pass');
 check(releaseGate.manifest_sha256===sha(headManifestBytes),'provenance_migration_release_gate_manifest_mismatch');
 check(headPersisted.validated_release_gate_status==='PASS','provenance_migration_persisted_gate_not_pass');
 console.log(JSON.stringify({status:failures.length?'FAIL':'PASS',mode:'provenance_migration',base,head,publication_changed:publicationChanged,failures},null,2));
}else if(/^actual\/review-evidence-/.test(headRef??'')){
 const allowed=new Set([
  'data/current/ro-official-exception-audit.json',
  'data/current/ro-level9-exception-audit.json',
  'data/current/md-cuatm-individual-deep-audit.json',
  'data/current/actual-review-evidence-bundle.json',
  'data/current/actual-review-evidence-bundle-gate.json',
  'data/current/md-special-municipality-analysis.json',
  'data/current/md-release-gate.json',
  'data/current/ro-release-gate.json',
  'data/current/actual-source-bundle-manifest.json',
  'data/current/actual-source-bundle-gate.json',
  'data/current/actual-release-manifest.json',
  'data/current/actual-release-gate.json',
  'data/current/actual-release-persisted.json',
  'data/sources/ro-osm-official-exception-history.json',
  'data/sources/ro-osm-level9-exception-history.json',
  'data/sources/md-osm-multiple-representation-history.json',
  'data/sources/md-balti-city-boundary-way-history.json',
  'data/sources/md-balti-city-boundary-changeset-semantics.json'
 ]);
 const forbidden=changed.filter(path=>!allowed.has(path));
 const basePersisted=JSON.parse(execFileSync('git',['show',base+':data/current/actual-release-persisted.json'],{encoding:'utf8'}));
 const headPersisted=JSON.parse(await readFile('data/current/actual-release-persisted.json','utf8'));
 const baseManifest=JSON.parse(execFileSync('git',['show',base+':data/current/actual-release-manifest.json'],{encoding:'utf8'}));
 const headManifest=JSON.parse(await readFile('data/current/actual-release-manifest.json','utf8'));
 const count=Number(git('rev-list','--count',base+'..'+head));
 check(count===1,'review_evidence_pr_not_single_commit',{count});
 check(forbidden.length===0,'review_evidence_pr_changed_forbidden_paths',{paths:forbidden});
 check(headManifest.snapshot_id===baseManifest.snapshot_id,'review_evidence_changed_snapshot_identity');
 check(headManifest.release_fingerprint_sha256===baseManifest.release_fingerprint_sha256,'review_evidence_changed_release_fingerprint');
 check(headPersisted.snapshot_id===basePersisted.snapshot_id,'review_evidence_persisted_snapshot_changed');
 check(headPersisted.release_fingerprint_sha256===basePersisted.release_fingerprint_sha256,'review_evidence_persisted_fingerprint_changed');
 check(headPersisted.provenance_refresh?.previous_manifest_sha256===basePersisted.manifest_sha256,'review_evidence_previous_manifest_binding_missing');
 check(headPersisted.validated_release_gate_status==='PASS','review_evidence_gate_not_pass');
 console.log(JSON.stringify({status:failures.length?'FAIL':'PASS',mode:'review_evidence_refresh',base,head,failures},null,2));
}else{
 failures.push({issue:'unauthorized_actual_publication_branch',head_ref:headRef??null});
 console.log(JSON.stringify({status:'FAIL',mode:'unauthorized_publication',base,head,head_ref:headRef??null,failures},null,2));
}

if(failures.length)process.exit(1);
