import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
const gitJson=path=>JSON.parse(execFileSync('git',['show','HEAD:'+path],{maxBuffer:32*1024*1024}).toString('utf8'));
const old=gitJson('data/current/actual-release-manifest.json');
const oldPersisted=gitJson('data/current/actual-release-persisted.json');
const bytes=await readFile('data/current/actual-release-manifest.json');
const now=JSON.parse(bytes.toString('utf8'));
const hostBytes=await readFile('data/current/actual-host-trust-manifest.json');
const host=JSON.parse(hostBytes.toString('utf8'));
const envBytes=await readFile('data/current/actual-build-environment-manifest.json');
const env=JSON.parse(envBytes.toString('utf8'));
const releaseGate=JSON.parse(await readFile('data/current/actual-release-gate.json','utf8'));
const envGate=JSON.parse(await readFile('data/current/actual-build-environment-gate.json','utf8'));
const die=(ok,msg)=>{if(!ok)throw Error('P905_PROVENANCE_REBIND_BLOCKED '+msg)};
die(oldPersisted.validated_release_gate_status==='PASS','previous persisted gate');
die(now.snapshot_id===old.snapshot_id,'snapshot identity changed');
die(now.release_fingerprint_sha256===old.release_fingerprint_sha256,'semantic release fingerprint changed');
die(now.content_fingerprint_sha256===old.content_fingerprint_sha256,'semantic content fingerprint changed');
die(JSON.stringify(now.components)===JSON.stringify(old.components),'canonical components drift');
die(JSON.stringify(now.geometry)===JSON.stringify(old.geometry),'master geometry drift');
die(JSON.stringify(now.source_bundle)===JSON.stringify(old.source_bundle),'source bundle drift');
die(JSON.stringify(now.review_evidence_bundle)===JSON.stringify(old.review_evidence_bundle),'review evidence drift');
die(now.host_trust?.sha256===sha(hostBytes)&&now.host_trust?.host_trust_fingerprint_sha256===host.host_trust_fingerprint_sha256,'host trust binding');
die(now.build_environment?.sha256===sha(envBytes)&&now.build_environment?.environment_fingerprint_sha256===env.environment_fingerprint_sha256,'build environment binding');
die(releaseGate.status==='PASS'&&envGate.status==='PASS','release or environment gate failed');
die(host.contract.accepted_runtime_profiles.some(x=>x.id==='github-ubuntu24-20261012.334.1'),'new profile missing');
const marker={
 ...oldPersisted,
 manifest_sha256:sha(bytes),
 host_trust_fingerprint_sha256:host.host_trust_fingerprint_sha256,
 build_environment_fingerprint_sha256:env.environment_fingerprint_sha256,
 provenance_hardening:{
  previous_manifest_sha256:oldPersisted.manifest_sha256,
  change_type:'P9.0.5_runner_host_trust_explicit_refresh',
  host_profile_id:'github-ubuntu24-20261012.334.1',
  method:'provenance_only_no_semantic_change',
  semantic_identity_unchanged:true
 }
};
die(marker.snapshot_id===oldPersisted.snapshot_id&&marker.release_fingerprint_sha256===oldPersisted.release_fingerprint_sha256,'persisted semantic drift');
await writeFile('data/current/actual-release-persisted.json',JSON.stringify(marker,null,2)+'\n');
console.log('P905_PROVENANCE_PASS '+JSON.stringify({snapshot:now.snapshot_id,new_manifest_sha256:marker.manifest_sha256,old_manifest_sha256:oldPersisted.manifest_sha256,host_trust_fingerprint_sha256:marker.host_trust_fingerprint_sha256}));
