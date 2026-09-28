#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

const marker=JSON.parse(await readFile('data/current/actual-release-persisted.json','utf8'));
const manifestBytes=await readFile('data/current/actual-release-manifest.json');
const manifest=JSON.parse(manifestBytes);
const buildEnvironment=JSON.parse(await readFile('data/current/actual-build-environment-manifest.json','utf8'));
const reviewEvidence=JSON.parse(await readFile('data/current/actual-review-evidence-bundle.json','utf8'));
const hostTrust=JSON.parse(await readFile('data/current/actual-host-trust-manifest.json','utf8'));
const sha=createHash('sha256').update(manifestBytes).digest('hex');

const failures=[];
const check=(name,ok,detail={})=>{if(!ok)failures.push({name,detail});};
check('validated_release_gate_pass',marker.validated_release_gate_status==='PASS',{actual:marker.validated_release_gate_status??null});
check('snapshot_id_matches',marker.snapshot_id===manifest.snapshot_id,{marker:marker.snapshot_id??null,manifest:manifest.snapshot_id??null});
check('release_fingerprint_matches',marker.release_fingerprint_sha256===manifest.release_fingerprint_sha256);
check('manifest_sha256_matches',marker.manifest_sha256===sha,{marker:marker.manifest_sha256??null,actual:sha});
check('build_environment_marker_matches_manifest',marker.build_environment_fingerprint_sha256===manifest.build_environment?.environment_fingerprint_sha256);
check('build_environment_manifest_matches_current',manifest.build_environment?.environment_fingerprint_sha256===buildEnvironment.environment_fingerprint_sha256);
check('review_evidence_marker_matches_manifest',marker.review_evidence_bundle_fingerprint_sha256===manifest.review_evidence_bundle?.bundle_fingerprint_sha256);
check('review_evidence_manifest_matches_current',manifest.review_evidence_bundle?.bundle_fingerprint_sha256===reviewEvidence.bundle_fingerprint_sha256);
check('network_denial_marker_matches_manifest',marker.network_denial_sha256===manifest.network_denial?.sha256,{marker:marker.network_denial_sha256??null,manifest:manifest.network_denial?.sha256??null});
check('host_trust_marker_matches_manifest',marker.host_trust_fingerprint_sha256===manifest.host_trust?.host_trust_fingerprint_sha256,{marker:marker.host_trust_fingerprint_sha256??null,manifest:manifest.host_trust?.host_trust_fingerprint_sha256??null});
check('host_trust_manifest_matches_current',manifest.host_trust?.host_trust_fingerprint_sha256===hostTrust.host_trust_fingerprint_sha256,{manifest:manifest.host_trust?.host_trust_fingerprint_sha256??null,current:hostTrust.host_trust_fingerprint_sha256??null});

const report={
 status:failures.length?'FAIL':'PASS',
 snapshot_id:manifest.snapshot_id??null,
 manifest_sha256:sha,
 build_environment_fingerprint_sha256:buildEnvironment.environment_fingerprint_sha256??null,
 review_evidence_bundle_fingerprint_sha256:reviewEvidence.bundle_fingerprint_sha256??null,
 network_denial_sha256:manifest.network_denial?.sha256??null,
 host_trust_fingerprint_sha256:hostTrust.host_trust_fingerprint_sha256??null,
 failures
};
console.log(JSON.stringify(report,null,2));
if(failures.length)process.exit(1);
