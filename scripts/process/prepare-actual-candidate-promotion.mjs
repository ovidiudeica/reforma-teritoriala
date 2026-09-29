#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {validateCandidatePromotion} from '../lib/actual-candidate-lifecycle.mjs';

const BASE_REF=process.env.ACTUAL_BASE_REF;
if(!BASE_REF||!/^[0-9a-f]{40}$/.test(BASE_REF))throw new Error('ACTUAL_BASE_REF must be the exact lowercase 40-hex current main commit SHA.');
const resolvedBaseCommit=execFileSync('git',['rev-parse',BASE_REF+'^{commit}'],{encoding:'utf8'}).trim();
if(resolvedBaseCommit!==BASE_REF)throw new Error('ACTUAL_BASE_REF did not resolve byte-for-byte to the requested current main commit SHA.');
const EXPECTED=process.env.EXPECTED_CANDIDATE_SNAPSHOT;
const CONFIRM=process.env.CONFIRM_PROMOTION;
const CANDIDATE_COMMIT_SHA=process.env.ACTUAL_CANDIDATE_COMMIT_SHA;
const CANDIDATE_TREE_SHA=process.env.ACTUAL_CANDIDATE_TREE_SHA;
if(!CANDIDATE_COMMIT_SHA||!/^[0-9a-f]{40}$/.test(CANDIDATE_COMMIT_SHA))throw new Error('ACTUAL_CANDIDATE_COMMIT_SHA must be an exact lowercase 40-hex commit SHA.');
if(!CANDIDATE_TREE_SHA||!/^[0-9a-f]{40}$/.test(CANDIDATE_TREE_SHA))throw new Error('ACTUAL_CANDIDATE_TREE_SHA must be an exact lowercase 40-hex tree SHA.');
const actualCandidateCommitSha=execFileSync('git',['rev-parse','HEAD^{commit}'],{encoding:'utf8'}).trim();
const actualCandidateTreeSha=execFileSync('git',['rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim();
const actualCandidateParentSha=execFileSync('git',['rev-parse','HEAD^'],{encoding:'utf8'}).trim();
const actualCandidateCommitCount=Number(execFileSync('git',['rev-list','--count',BASE_REF+'..HEAD'],{encoding:'utf8'}).trim());
const sha256=value=>createHash('sha256').update(value).digest('hex');
const gitBuffer=path=>execFileSync('git',['show',BASE_REF+':'+path],{maxBuffer:256*1024*1024});
const gitJson=path=>JSON.parse(gitBuffer(path).toString('utf8'));
const readJson=async path=>JSON.parse(await readFile(path,'utf8'));
const candidateMarker=await readJson('data/current/actual-release-candidate.json');
const diff=await readJson('data/current/actual-candidate-diff.json');
const manifestBytes=await readFile('data/current/actual-release-manifest.json');
const manifest=JSON.parse(manifestBytes.toString('utf8'));
const gateBytes=await readFile('data/current/actual-release-gate.json');
const gate=JSON.parse(gateBytes.toString('utf8'));
const diffBytes=await readFile('data/current/actual-candidate-diff.json');
const currentPersisted=gitJson('data/current/actual-release-persisted.json');
const currentManifestBytes=gitBuffer('data/current/actual-release-manifest.json');
const currentManifest=JSON.parse(currentManifestBytes.toString('utf8'));
const actualCandidateManifestSha256=sha256(manifestBytes);
const actualCandidateDiffSha256=sha256(diffBytes);
const currentManifestSha256=sha256(currentManifestBytes);
const validation=validateCandidatePromotion({
 candidateMarker,
 diff,
 manifest,
 gate,
 expectedSnapshot:EXPECTED,
 confirmation:CONFIRM,
 candidateManifestSha256:candidateMarker.candidate?.manifest_sha256??null,
 actualCandidateManifestSha256,
 candidateDiffSha256:candidateMarker.diff_report_sha256??null,
 actualCandidateDiffSha256,
 currentPersisted,
 currentManifest,
 currentManifestSha256,
 currentBaseCommitSha:BASE_REF,
 candidateCommitSha:CANDIDATE_COMMIT_SHA,
 candidateTreeSha:CANDIDATE_TREE_SHA,
 actualCandidateCommitSha,
 actualCandidateTreeSha,
 actualCandidateParentSha,
 actualCandidateCommitCount
});
const failures=validation.failures;
const audit={
 schema_version:2,
 mode:'ACTUAL_CANDIDATE_PROMOTION',
 status:validation.status,
 base_ref:BASE_REF,
 base_release:candidateMarker.base_release,
 candidate:candidateMarker.candidate,
 review_required:candidateMarker.review_required,
 substantive_change_count:candidateMarker.substantive_change_count,
 candidate_commit_sha:CANDIDATE_COMMIT_SHA,
 candidate_tree_sha:CANDIDATE_TREE_SHA,
 confirmation:CONFIRM,
 failures,
 policy:'Only CHANGE candidates are promotable. NO_CHANGE candidates are terminal and must never create a promotion PR. CHANGE promotion still requires exact candidate bytes, passing gate and an unchanged persisted base.'
};
await writeFile('data/current/actual-candidate-promotion-audit.json',JSON.stringify(audit,null,2)+'\n');
if(failures.length){console.error(JSON.stringify(audit,null,2));process.exit(1);}
const persisted={
 schema_version:1,
 snapshot_id:manifest.snapshot_id,
 release_fingerprint_sha256:manifest.release_fingerprint_sha256,
 manifest_sha256:actualCandidateManifestSha256,
 source_bundle_fingerprint_sha256:manifest.source_bundle?.bundle_fingerprint_sha256??null,
 review_evidence_bundle_fingerprint_sha256:manifest.review_evidence_bundle?.bundle_fingerprint_sha256??null,
 network_denial_sha256:manifest.network_denial?.sha256??null,
 host_trust_fingerprint_sha256:manifest.host_trust?.host_trust_fingerprint_sha256??null,
 build_environment_fingerprint_sha256:manifest.build_environment?.environment_fingerprint_sha256??null,
 validated_release_gate_status:'PASS',
 promoted_from_candidate:{
  base_snapshot_id:candidateMarker.base_release.snapshot_id,
  base_commit_sha:candidateMarker.base_ref,
  diff_report_sha256:candidateMarker.diff_report_sha256,
  review_required:candidateMarker.review_required,
  substantive_change_count:candidateMarker.substantive_change_count,
  candidate_identity_sha256:candidateMarker.candidate_identity_sha256,
  candidate_commit_sha:CANDIDATE_COMMIT_SHA,
  candidate_tree_sha:CANDIDATE_TREE_SHA,
  promotion_audit_path:'data/current/actual-candidate-promotion-audit.json'
 },
 policy:'Persisted ACTUAL release marker written only by explicit candidate promotion after exact deterministic candidate validation, exact source-bundle, frozen review-evidence, host-trust contract, kernel network-denial and execution-environment binding, and unchanged-base verification. Volatile workflow execution metadata is intentionally excluded from persisted release bytes.'
};
await writeFile('data/current/actual-release-persisted.json',JSON.stringify(persisted,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',base_snapshot_id:candidateMarker.base_release.snapshot_id,promoted_snapshot_id:manifest.snapshot_id,review_required:candidateMarker.review_required,substantive_change_count:candidateMarker.substantive_change_count},null,2));
