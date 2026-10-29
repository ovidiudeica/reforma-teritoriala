#!/usr/bin/env node
// P9.0.5: evidence-only qualification. Does NOT admit any host profile.
import {mkdir, writeFile, readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {captureObservedHost,validateObservedHost,hostTrustFingerprint} from '../lib/actual-host-trust.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const requireTrue=(c,m)=>{if(!c)throw Error('P905_HOST_QUALIFICATION_FAIL_CLOSED: '+m)};
const profileOf=o=>Object.fromEntries(['runner','kernel','docker','engine'].map(k=>[k,structuredClone(o[k])]));
const asJson=o=>JSON.stringify(o,null,2)+'\n';
const canonical=o=>JSON.stringify(o,Object.keys(o).sort());
const original=await readFile('data/current/actual-host-trust-manifest.json');
const manifest=JSON.parse(original);
const a=await captureObservedHost();
const current=validateObservedHost(manifest,a);
const approved=manifest.contract.accepted_runtime_profiles;
const latest=approved.at(-1);
const actual=profileOf(a);
const old=profileOf(latest);
const differences=[];
function diff(x,y,path=''){
  if(x&&y&&typeof x==='object'&&typeof y==='object'&&!Array.isArray(x)&&!Array.isArray(y)){
    for(const k of [...new Set([...Object.keys(x),...Object.keys(y)])].sort())diff(x[k],y[k],path?path+'.'+k:k);
  }else if(JSON.stringify(x)!==JSON.stringify(y))differences.push({field:path,approved:x??null,observed:y??null});
}
diff(old,actual);
requireTrue(a.runner.image_version==='20261026.354.1','unexpected new runner version');
requireTrue(current.status==='FAIL'&&current.failures.length===1&&current.failures[0].name==='runtime_host_profile_is_explicitly_approved','unexpected static/CPU failure');
requireTrue(differences.some(x=>x.field==='kernel.release'),'kernel difference not recorded');
requireTrue(differences.some(x=>x.field==='docker.components.containerd.version'),'containerd difference not recorded');
const positive=structuredClone(a);
Object.assign(positive,profileOf(latest)); // positive control with truly approved existing profile + observed CPU
requireTrue(validateObservedHost(manifest,positive).status==='PASS','approved positive control unexpectedly fails');
const negative=structuredClone(positive);
negative.docker.components.containerd.version='UNAPPROVED_NEGATIVE_CONTROL';
requireTrue(validateObservedHost(manifest,negative).status==='FAIL','unapproved containerd accepted');
const tampered=structuredClone(positive);tampered.cpu.vendor='UNAPPROVED_VENDOR';
requireTrue(validateObservedHost(manifest,tampered).status==='FAIL','unapproved CPU vendor accepted');
const candidate=structuredClone(manifest);
candidate.contract.accepted_runtime_profiles.push({id:'github-ubuntu24-20261026.354.1',...actual});
const proposedFingerprint=hostTrustFingerprint(candidate).sha256;
const currentBytesAfter=await readFile('data/current/actual-host-trust-manifest.json');
requireTrue(original.equals(currentBytesAfter),'protected manifest mutated');
const lane=process.env.QUALIFICATION_LANE;
requireTrue(lane==='A'||lane==='B','lane required');
const result={
 schema:'p905-20261026-qualification-v1', lane,baseline_commit:'af9ea48fa5a123fc40f63995a4358ff75a6cfb44',
 baseline_manifest_sha256:sha(original), baseline_fingerprint:manifest.host_trust_fingerprint_sha256,
 baseline_profile:latest.id,official_release:'https://github.com/actions/runner-images/releases/tag/ubuntu24%2F20261026.354',
 observed:a,observed_profile_sha256:sha(Buffer.from(asJson(actual))),
 differences, current_validator_status:current.status,current_failures:current.failures.map(x=>x.name),
 positive_existing_approved_profile:'PASS',negative_mutated_containerd:'REJECTED',negative_mutated_cpu_vendor:'REJECTED',
 proposed_profile_id:'github-ubuntu24-20261026.354.1',proposed_fingerprint:proposedFingerprint,
 proposal_status:'TECHNICAL_EVIDENCE_ONLY_NOT_AUTHORIZED',host_profile_approved:false,
 actual_manifests_modified:false,actual_reproducibility_A_B_executed:false,
 next_gate:'Independent A/B comparison, owner approval, separate provenance rebind, actual A/B reproduction'
};
await mkdir('outputs/p905-runner-qualification',{recursive:true});
const evidencePath=lane==='A'?'outputs/p905-runner-qualification/A.json':'outputs/p905-runner-qualification/B.json';
await writeFile(evidencePath,asJson(result));
console.log(JSON.stringify({lane,status:result.proposal_status,image:a.runner.image_version,baseline:latest.id,differences:differences.map(x=>x.field),proposed_fingerprint:proposedFingerprint,positive:'PASS',negative:'REJECTED',manifest_unchanged:true}));
