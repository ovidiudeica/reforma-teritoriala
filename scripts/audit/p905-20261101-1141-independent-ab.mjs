#!/usr/bin/env node
// P9.0.5 read-only qualification of one exact runner profile; never admits it.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {captureObservedHost,validateObservedHost,validateHostTrustManifest,hostTrustFingerprint} from '../lib/actual-host-trust.mjs';

const target='20261101.114.1';
const root='outputs/p905-20261101-1141/';
const sha=b=>createHash('sha256').update(b).digest('hex');
const json=o=>JSON.stringify(o,null,2)+'\n';
const profile=o=>Object.fromEntries(['runner','kernel','docker','engine'].map(k=>[k,structuredClone(o[k])]));
const failures=[];
function check(name,ok){if(!ok)failures.push(name);}
await mkdir(root,{recursive:true});
const manifestBytes=await readFile('data/current/actual-host-trust-manifest.json');
const manifest=JSON.parse(manifestBytes);
const arg=process.argv[2];
if(arg==='capture'){
 const lane=process.env.QUALIFICATION_LANE;
 if(!['A','B'].includes(lane))throw Error('Independent qualification lane missing');
 const observed=await captureObservedHost();
 const validation=validateObservedHost(manifest,observed);
 const approved=manifest.contract.accepted_runtime_profiles;
 const baseline=approved.find(p=>p.id==='github-ubuntu24-20261101.360.1');
 if(!baseline)throw Error('Approved baseline profile missing');
 const good=structuredClone(observed);
 Object.assign(good,profile(baseline));
 const positive=validateObservedHost(manifest,good);
 const containerdNegative=structuredClone(good);containerdNegative.docker.components.containerd.version='UNAPPROVED_NEGATIVE';
 const cpuNegative=structuredClone(good);cpuNegative.cpu.vendor='UNAPPROVED_NEGATIVE';
 const candidate=structuredClone(manifest);
 candidate.contract.accepted_runtime_profiles.push({id:'github-ubuntu24-'+target,...profile(observed)});
 const record={
  schema:'p905-20261101-1141-ab-v1',lane,exact_requested_profile:target,
  checkout_sha:process.env.GITHUB_SHA??null,github_run_id:process.env.GITHUB_RUN_ID??null,
  observed,observed_profile_sha256:sha(Buffer.from(json(profile(observed)))),
  baseline_manifest_sha256:sha(manifestBytes),baseline_fingerprint:manifest.host_trust_fingerprint_sha256,
  static_manifest_status:validateHostTrustManifest(manifest).status,
  target_image_observed:observed.runner.image_version===target,
  approved_profile_match:validation.status,approval_failures:validation.failures.map(f=>f.name),
  cpu_checks:validation.checks.filter(c=>c.name.startsWith('cpu_')).map(c=>({name:c.name,ok:c.ok})),
  positive_existing_profile:positive.status,
  negative_containerd:validateObservedHost(manifest,containerdNegative).status,
  negative_cpu:validateObservedHost(manifest,cpuNegative).status,
  proposed_host_fingerprint:hostTrustFingerprint(candidate).sha256,
  admission:false,canonical_data_modified:false
 };
 await writeFile(root+lane+'.json',json(record));
 console.log(JSON.stringify({lane,observed_image:observed.runner.image_version,expected_image:target,
  observed_kernel:observed.kernel.release,containerd:observed.docker.components.containerd,
  runc:observed.docker.components.runc,cpu:record.cpu_checks,
  validator:record.approved_profile_match,failures:record.approval_failures,
  evidence_sha256:sha(Buffer.from(json(record))),admission:false},null,2));
}else if(arg==='compare'){
 const aBytes=await readFile(root+'A/A.json'),bBytes=await readFile(root+'B/B.json');
 const A=JSON.parse(aBytes),B=JSON.parse(bBytes);
 check('evidence_schema_and_independent_lanes',A.schema===B.schema&&A.schema==='p905-20261101-1141-ab-v1'&&A.lane==='A'&&B.lane==='B'&&A.github_run_id===B.github_run_id&&A.github_run_id!==null);
 check('base_host_manifest_identical',A.baseline_manifest_sha256===B.baseline_manifest_sha256&&A.baseline_fingerprint===B.baseline_fingerprint);
 check('exact_requested_image_A_B',[A,B].every(x=>x.target_image_observed===true&&x.observed.runner.image_version===target));
 check('kernel_docker_containerd_runc_engine_profile_exact',JSON.stringify(profile(A.observed))===JSON.stringify(profile(B.observed)));
 check('same_proposed_fingerprint',A.proposed_host_fingerprint===B.proposed_host_fingerprint);
 check('static_host_trust_contract_valid',[A,B].every(x=>x.static_manifest_status==='PASS'));
 check('currently_not_admitted_but_only_exact_profile_missing',[A,B].every(x=>x.approved_profile_match==='FAIL'&&JSON.stringify(x.approval_failures)===JSON.stringify(['runtime_host_profile_is_explicitly_approved'])));
 check('cpu_contract_passes_A_B',[A,B].every(x=>x.cpu_checks.length===6&&x.cpu_checks.every(y=>y.ok)));
 check('positive_and_negative_controls',[A,B].every(x=>x.positive_existing_profile==='PASS'&&x.negative_containerd==='FAIL'&&x.negative_cpu==='FAIL'));
 check('read_only_evidence',[A,B].every(x=>x.admission===false&&x.canonical_data_modified===false));
 const report={
  schema:'p905-20261101-1141-independent-ab-v1',
  status:failures.length?'BLOCKED_NOT_QUALIFIED':'TECHNICALLY_QUALIFIED_PENDING_SEPARATE_PROVENANCE_PR',
  target,failures,
  a_sha256:sha(aBytes),b_sha256:sha(bBytes),
  a_image:A.observed.runner.image_version,b_image:B.observed.runner.image_version,
  a_kernel:A.observed.kernel.release,b_kernel:B.observed.kernel.release,
  a_containerd:A.observed.docker.components.containerd,b_containerd:B.observed.docker.components.containerd,
  a_runc:A.observed.docker.components.runc,b_runc:B.observed.docker.components.runc,
  a_cpu:A.observed.cpu,b_cpu:B.observed.cpu,
  proposed_fingerprint:A.proposed_host_fingerprint,
  host_profile_admitted:false,release_rebuilt:false,publication_promoted:false
 };
 await writeFile(root+'comparison.json',json(report));
 console.log(JSON.stringify({status:report.status,failures,a_image:report.a_image,b_image:report.b_image,
  a_kernel:report.a_kernel,b_kernel:report.b_kernel,
  a_containerd:report.a_containerd,b_containerd:report.b_containerd,
  a_runc:report.a_runc,b_runc:report.b_runc,
  proposed_fingerprint:report.proposed_fingerprint,host_profile_admitted:false},null,2));
 if(failures.length)process.exitCode=1;
}else throw Error('Usage: capture or compare');
