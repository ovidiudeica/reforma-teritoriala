#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

const marker=JSON.parse(await readFile('data/current/actual-release-persisted.json','utf8'));
const manifestBytes=await readFile('data/current/actual-release-manifest.json');
const manifest=JSON.parse(manifestBytes.toString('utf8'));
const buildEnvironment=JSON.parse(await readFile('data/current/actual-build-environment-manifest.json','utf8'));
const reviewEvidence=JSON.parse(await readFile('data/current/actual-review-evidence-bundle.json','utf8'));
const networkDenial=JSON.parse(await readFile('data/current/actual-network-denial-audit.json','utf8'));
const manifestSha=createHash('sha256').update(manifestBytes).digest('hex');

const failures=[];
const check=(name,ok,detail={})=>{if(!ok)failures.push({name,detail});};

check('persisted_gate_passes',marker.validated_release_gate_status==='PASS',{actual:marker.validated_release_gate_status??null});
check('snapshot_identity_matches',marker.snapshot_id===manifest.snapshot_id,{marker:marker.snapshot_id??null,manifest:manifest.snapshot_id??null});
check('release_fingerprint_matches',marker.release_fingerprint_sha256===manifest.release_fingerprint_sha256,{marker:marker.release_fingerprint_sha256??null,manifest:manifest.release_fingerprint_sha256??null});
check('manifest_hash_matches',marker.manifest_sha256===manifestSha,{marker:marker.manifest_sha256??null,actual:manifestSha});
check('build_environment_binding_matches',
 marker.build_environment_fingerprint_sha256===manifest.build_environment?.environment_fingerprint_sha256
 && manifest.build_environment?.environment_fingerprint_sha256===buildEnvironment.environment_fingerprint_sha256,
 {marker:marker.build_environment_fingerprint_sha256??null,manifest:manifest.build_environment?.environment_fingerprint_sha256??null,current:buildEnvironment.environment_fingerprint_sha256??null});
check('review_evidence_binding_matches',
 marker.review_evidence_bundle_fingerprint_sha256===manifest.review_evidence_bundle?.bundle_fingerprint_sha256
 && manifest.review_evidence_bundle?.bundle_fingerprint_sha256===reviewEvidence.bundle_fingerprint_sha256,
 {marker:marker.review_evidence_bundle_fingerprint_sha256??null,manifest:manifest.review_evidence_bundle?.bundle_fingerprint_sha256??null,current:reviewEvidence.bundle_fingerprint_sha256??null});
check('network_denial_binding_matches',
 marker.network_denial_sha256===manifest.network_denial?.sha256
 && manifest.network_denial?.status==='PASS'
 && networkDenial.status==='PASS',
 {marker:marker.network_denial_sha256??null,manifest:manifest.network_denial?.sha256??null,status:networkDenial.status??null});

const report={
 status:failures.length?'FAIL':'PASS',
 snapshot_id:manifest.snapshot_id??null,
 manifest_sha256:manifestSha,
 build_environment_fingerprint_sha256:buildEnvironment.environment_fingerprint_sha256??null,
 review_evidence_bundle_fingerprint_sha256:reviewEvidence.bundle_fingerprint_sha256??null,
 network_denial_sha256:manifest.network_denial?.sha256??null,
 failures
};
console.log(JSON.stringify(report,null,2));
if(failures.length)process.exit(1);
