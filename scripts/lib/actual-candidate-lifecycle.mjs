import {createHash} from 'node:crypto';

export const sha256=value=>createHash('sha256').update(value).digest('hex');

const canonicalizeCandidateIdentity=value=>{
 if(Array.isArray(value))return value.map(canonicalizeCandidateIdentity);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonicalizeCandidateIdentity(value[key])]));
 return value;
};

export const CANDIDATE_IDENTITY_ALGORITHM='actual-candidate-v1';
export function candidateIdentityFingerprint({baseRef,baseRelease,candidate,diffReportSha256}){
 const payload=canonicalizeCandidateIdentity({
  algorithm:CANDIDATE_IDENTITY_ALGORITHM,
  base_ref:baseRef,
  base_release:baseRelease,
  candidate,
  diff_report_sha256:diffReportSha256
 });
 return {algorithm:CANDIDATE_IDENTITY_ALGORITHM,sha256:sha256(Buffer.from(JSON.stringify(payload),'utf8')),payload};
}

export function classifyCandidateDisposition({
 baseContentFingerprint,
 candidateContentFingerprint,
 baseSnapshotId,
 baseReleaseFingerprint,
 candidateSnapshotId,
 candidateReleaseFingerprint,
 detailedChangeCount=0
}){
 const failures=[];
 const semanticContentChanged=baseContentFingerprint!==candidateContentFingerprint;
 const semanticScopeOnlyChangeCount=semanticContentChanged&&detailedChangeCount===0?1:0;
 const substantiveChangeCount=detailedChangeCount+semanticScopeOnlyChangeCount;
 if(!semanticContentChanged){
  if(candidateSnapshotId!==baseSnapshotId)failures.push({issue:'no_change_snapshot_identity_churn',base:baseSnapshotId,candidate:candidateSnapshotId});
  if(candidateReleaseFingerprint!==baseReleaseFingerprint)failures.push({issue:'no_change_release_fingerprint_churn',base:baseReleaseFingerprint,candidate:candidateReleaseFingerprint});
 }
 return {
  status:failures.length?'FAIL':semanticContentChanged?'CHANGE':'NO_CHANGE',
  semantic_content_changed:semanticContentChanged,
  semantic_scope_only_change_count:semanticScopeOnlyChangeCount,
  substantive_change_count:substantiveChangeCount,
  review_required:semanticContentChanged,
  failures
 };
}


export function validateCandidateSemanticManifestBinding({
 manifestContentFingerprint,
 candidateContentFingerprint,
 baselineContentFingerprint,
 exactBaseManifestBytesReused=false
}){
 const explicitBinding=typeof manifestContentFingerprint==='string'
  && manifestContentFingerprint===candidateContentFingerprint;
 const exactLegacyReuse=exactBaseManifestBytesReused===true
  && baselineContentFingerprint===candidateContentFingerprint;
 return {
  status:explicitBinding||exactLegacyReuse?'PASS':'FAIL',
  binding:explicitBinding?'explicit_manifest_fingerprint':exactLegacyReuse?'exact_base_manifest_byte_reuse':null,
  explicit_binding:explicitBinding,
  exact_base_manifest_byte_reuse:exactLegacyReuse
 };
}

export function validateCandidatePromotion({
 candidateMarker,
 diff,
 manifest,
 gate,
 expectedSnapshot,
 confirmation,
 candidateManifestSha256,
 actualCandidateManifestSha256,
 candidateDiffSha256,
 actualCandidateDiffSha256,
 currentPersisted,
 currentManifest,
 currentManifestSha256,
 currentBaseCommitSha,
 expectedCandidateCommitSha,
 actualCandidateCommitSha
}){
 const failures=[];
 const check=(ok,issue,detail={})=>{if(!ok)failures.push({issue,...detail});};
 check(Boolean(expectedSnapshot),'missing_expected_candidate_snapshot');
 check(confirmation==='PROMOTE '+expectedSnapshot,'invalid_promotion_confirmation',{expected:'PROMOTE '+expectedSnapshot,actual:confirmation});
 check(candidateMarker?.schema_version===2&&candidateMarker?.mode==='ACTUAL_CANDIDATE'&&candidateMarker?.status==='CHANGE','candidate_marker_not_promotable',{schema_version:candidateMarker?.schema_version??null,status:candidateMarker?.status??null});
 check(/^[0-9a-f]{40}$/.test(currentBaseCommitSha??''),'current_base_commit_not_exact_sha',{actual:currentBaseCommitSha??null});
 check(/^[0-9a-f]{40}$/.test(expectedCandidateCommitSha??''),'expected_candidate_commit_not_exact_sha',{actual:expectedCandidateCommitSha??null});
 check(expectedCandidateCommitSha===actualCandidateCommitSha,'candidate_commit_sha_mismatch',{expected:expectedCandidateCommitSha??null,actual:actualCandidateCommitSha??null});
 check(/^[0-9a-f]{40}$/.test(candidateMarker?.base_ref??''),'candidate_base_commit_not_exact_sha',{actual:candidateMarker?.base_ref??null});
 check(candidateMarker?.base_ref===currentBaseCommitSha,'base_commit_moved',{candidate_base:candidateMarker?.base_ref??null,current_main:currentBaseCommitSha??null});
 check(diff?.base_ref===candidateMarker?.base_ref,'candidate_diff_base_commit_mismatch',{marker:candidateMarker?.base_ref??null,diff:diff?.base_ref??null});
 const candidateIdentity=candidateIdentityFingerprint({baseRef:candidateMarker?.base_ref??null,baseRelease:candidateMarker?.base_release??null,candidate:candidateMarker?.candidate??null,diffReportSha256:candidateMarker?.diff_report_sha256??null});
 check(candidateMarker?.candidate_identity_algorithm===candidateIdentity.algorithm&&candidateMarker?.candidate_identity_sha256===candidateIdentity.sha256,'candidate_identity_mismatch',{algorithm:candidateMarker?.candidate_identity_algorithm??null,expected:candidateIdentity.sha256,actual:candidateMarker?.candidate_identity_sha256??null});
 check(candidateMarker?.review_required===true&&Number(candidateMarker?.substantive_change_count)>0,'candidate_has_no_substantive_change',{review_required:candidateMarker?.review_required??null,substantive_change_count:candidateMarker?.substantive_change_count??null});
 check(candidateMarker?.candidate?.snapshot_id===expectedSnapshot,'unexpected_candidate_snapshot',{expected:expectedSnapshot,actual:candidateMarker?.candidate?.snapshot_id??null});
 check(candidateMarker?.candidate?.source_bundle_fingerprint_sha256===manifest?.source_bundle?.bundle_fingerprint_sha256,'candidate_source_bundle_mismatch',{marker:candidateMarker?.candidate?.source_bundle_fingerprint_sha256??null,manifest:manifest?.source_bundle?.bundle_fingerprint_sha256??null});
 check(candidateMarker?.candidate?.review_evidence_bundle_fingerprint_sha256===manifest?.review_evidence_bundle?.bundle_fingerprint_sha256,'candidate_review_evidence_bundle_mismatch',{marker:candidateMarker?.candidate?.review_evidence_bundle_fingerprint_sha256??null,manifest:manifest?.review_evidence_bundle?.bundle_fingerprint_sha256??null});
 check(candidateMarker?.candidate?.network_denial_sha256===manifest?.network_denial?.sha256,'candidate_network_denial_mismatch',{marker:candidateMarker?.candidate?.network_denial_sha256??null,manifest:manifest?.network_denial?.sha256??null});
 check(candidateMarker?.candidate?.host_trust_fingerprint_sha256===manifest?.host_trust?.host_trust_fingerprint_sha256,'candidate_host_trust_mismatch',{marker:candidateMarker?.candidate?.host_trust_fingerprint_sha256??null,manifest:manifest?.host_trust?.host_trust_fingerprint_sha256??null});
 check(candidateMarker?.candidate?.build_environment_fingerprint_sha256===manifest?.build_environment?.environment_fingerprint_sha256,'candidate_build_environment_mismatch',{marker:candidateMarker?.candidate?.build_environment_fingerprint_sha256??null,manifest:manifest?.build_environment?.environment_fingerprint_sha256??null});
 check(manifest?.snapshot_id===expectedSnapshot,'manifest_snapshot_mismatch',{expected:expectedSnapshot,actual:manifest?.snapshot_id??null});
 check(gate?.status==='PASS'&&gate?.snapshot_id===expectedSnapshot,'candidate_gate_invalid',{status:gate?.status??null,snapshot_id:gate?.snapshot_id??null});
 check(candidateManifestSha256===actualCandidateManifestSha256,'candidate_manifest_hash_drift',{expected:candidateManifestSha256??null,actual:actualCandidateManifestSha256??null});
 check(candidateDiffSha256===actualCandidateDiffSha256,'candidate_diff_hash_drift',{expected:candidateDiffSha256??null,actual:actualCandidateDiffSha256??null});
 check(diff?.status==='CHANGE'&&diff?.candidate?.snapshot_id===expectedSnapshot&&diff?.summary?.semantic_content_changed===true,'candidate_diff_invalid',{status:diff?.status??null,snapshot_id:diff?.candidate?.snapshot_id??null,semantic_content_changed:diff?.summary?.semantic_content_changed??null});
 check(currentPersisted?.snapshot_id===candidateMarker?.base_release?.snapshot_id,'base_snapshot_moved',{candidate_base:candidateMarker?.base_release?.snapshot_id??null,current:currentPersisted?.snapshot_id??null});
 check(currentPersisted?.release_fingerprint_sha256===candidateMarker?.base_release?.release_fingerprint_sha256,'base_fingerprint_moved');
 check(currentPersisted?.manifest_sha256===candidateMarker?.base_release?.manifest_sha256,'base_manifest_marker_moved');
 check(currentPersisted?.source_bundle_fingerprint_sha256===candidateMarker?.base_release?.source_bundle_fingerprint_sha256,'base_source_bundle_moved',{candidate_base:candidateMarker?.base_release?.source_bundle_fingerprint_sha256??null,current:currentPersisted?.source_bundle_fingerprint_sha256??null});
 check(currentPersisted?.review_evidence_bundle_fingerprint_sha256===candidateMarker?.base_release?.review_evidence_bundle_fingerprint_sha256,'base_review_evidence_bundle_moved',{candidate_base:candidateMarker?.base_release?.review_evidence_bundle_fingerprint_sha256??null,current:currentPersisted?.review_evidence_bundle_fingerprint_sha256??null});
 check(currentPersisted?.network_denial_sha256===candidateMarker?.base_release?.network_denial_sha256,'base_network_denial_moved',{candidate_base:candidateMarker?.base_release?.network_denial_sha256??null,current:currentPersisted?.network_denial_sha256??null});
 check(currentPersisted?.host_trust_fingerprint_sha256===candidateMarker?.base_release?.host_trust_fingerprint_sha256,'base_host_trust_moved',{candidate_base:candidateMarker?.base_release?.host_trust_fingerprint_sha256??null,current:currentPersisted?.host_trust_fingerprint_sha256??null});
 check(currentPersisted?.build_environment_fingerprint_sha256===candidateMarker?.base_release?.build_environment_fingerprint_sha256,'base_build_environment_moved',{candidate_base:candidateMarker?.base_release?.build_environment_fingerprint_sha256??null,current:currentPersisted?.build_environment_fingerprint_sha256??null});
 check(currentPersisted?.snapshot_id===currentManifest?.snapshot_id,'current_main_marker_manifest_snapshot_mismatch');
 check(currentPersisted?.manifest_sha256===currentManifestSha256,'current_main_manifest_hash_mismatch',{marker:currentPersisted?.manifest_sha256??null,actual:currentManifestSha256??null});
 return {status:failures.length?'FAIL':'PASS',failures};
}
