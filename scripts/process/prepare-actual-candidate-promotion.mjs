#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';

const BASE_REF=process.env.ACTUAL_BASE_REF||'origin/main';
const EXPECTED=process.env.EXPECTED_CANDIDATE_SNAPSHOT;
const CONFIRM=process.env.CONFIRM_PROMOTION;
if(!EXPECTED)throw new Error('EXPECTED_CANDIDATE_SNAPSHOT is required.');
if(CONFIRM!=='PROMOTE '+EXPECTED)throw new Error('CONFIRM_PROMOTION must equal "PROMOTE '+EXPECTED+'".');
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
const failures=[];
const check=(ok,issue,detail={})=>{if(!ok)failures.push({issue,...detail});};
check(candidateMarker.schema_version===1&&candidateMarker.mode==='ACTUAL_CANDIDATE'&&candidateMarker.status==='CHANGE','candidate_marker_not_promotable',{status:candidateMarker.status??null});
check(candidateMarker.review_required===true&&Number(candidateMarker.substantive_change_count)>0,'candidate_has_no_substantive_change',{review_required:candidateMarker.review_required??null,substantive_change_count:candidateMarker.substantive_change_count??null});
check(candidateMarker.candidate?.snapshot_id===EXPECTED,'unexpected_candidate_snapshot',{expected:EXPECTED,actual:candidateMarker.candidate?.snapshot_id});
check(manifest.snapshot_id===EXPECTED,'manifest_snapshot_mismatch',{expected:EXPECTED,actual:manifest.snapshot_id});
check(gate.status==='PASS'&&gate.snapshot_id===EXPECTED,'candidate_gate_invalid',{status:gate.status,snapshot_id:gate.snapshot_id});
check(candidateMarker.candidate?.manifest_sha256===sha256(manifestBytes),'candidate_manifest_hash_drift');
check(candidateMarker.diff_report_sha256===sha256(diffBytes),'candidate_diff_hash_drift');
check(diff.status==='CHANGE'&&diff.candidate?.snapshot_id===EXPECTED&&diff.summary?.semantic_content_changed===true,'candidate_diff_invalid',{status:diff.status,snapshot_id:diff.candidate?.snapshot_id,semantic_content_changed:diff.summary?.semantic_content_changed??null});
check(currentPersisted.snapshot_id===candidateMarker.base_release?.snapshot_id,'base_snapshot_moved',{candidate_base:candidateMarker.base_release?.snapshot_id,current:currentPersisted.snapshot_id});
check(currentPersisted.release_fingerprint_sha256===candidateMarker.base_release?.release_fingerprint_sha256,'base_fingerprint_moved');
check(currentPersisted.manifest_sha256===candidateMarker.base_release?.manifest_sha256,'base_manifest_marker_moved');
check(currentPersisted.snapshot_id===currentManifest.snapshot_id,'current_main_marker_manifest_snapshot_mismatch');
check(currentPersisted.manifest_sha256===sha256(currentManifestBytes),'current_main_manifest_hash_mismatch');
const audit={
 schema_version:1,
 generated_at:new Date().toISOString(),
 mode:'ACTUAL_CANDIDATE_PROMOTION',
 status:failures.length?'FAIL':'PASS',
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
 manifest_sha256:sha256(manifestBytes),
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
