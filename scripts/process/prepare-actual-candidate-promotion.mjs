#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {validateCandidatePromotion} from '../lib/actual-candidate-lifecycle.mjs';

const BASE_REF=process.env.ACTUAL_BASE_REF||'origin/main';
const EXPECTED=process.env.EXPECTED_CANDIDATE_SNAPSHOT;
const CONFIRM=process.env.CONFIRM_PROMOTION;
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
 currentManifestSha256
});
const failures=validation.failures;
const audit={
 schema_version:1,
 generated_at:new Date().toISOString(),
 mode:'ACTUAL_CANDIDATE_PROMOTION',
 status:validation.status,
 base_ref:BASE_REF,
 base_release:candidateMarker.base_release,
 candidate:candidateMarker.candidate,
 review_required:candidateMarker.review_required,
 substantive_change_count:candidateMarker.substantive_change_count,
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
 validated_release_gate_status:'PASS',
 promoted_from_candidate:{
  base_snapshot_id:candidateMarker.base_release.snapshot_id,
  diff_report_sha256:candidateMarker.diff_report_sha256,
  review_required:candidateMarker.review_required,
  substantive_change_count:candidateMarker.substantive_change_count,
  promotion_audit_path:'data/current/actual-candidate-promotion-audit.json'
 },
 source_candidate:candidateMarker.source,
 policy:'Persisted ACTUAL release marker written only by explicit candidate promotion after exact candidate validation and unchanged-base verification.'
};
await writeFile('data/current/actual-release-persisted.json',JSON.stringify(persisted,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',base_snapshot_id:candidateMarker.base_release.snapshot_id,promoted_snapshot_id:manifest.snapshot_id,review_required:candidateMarker.review_required,substantive_change_count:candidateMarker.substantive_change_count},null,2));
