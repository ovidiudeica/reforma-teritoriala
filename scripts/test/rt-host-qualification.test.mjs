import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {EXPECTED_HOST_TRUST,buildHostTrustManifest,hostTrustFingerprint} from '../lib/actual-host-trust.mjs';
import {bytes,captureHostEvidence,compareHostEvidence,validateHostAdmission,RT_HOST_REPOSITORY,RT_HOST_WORKFLOW} from '../lib/rt-host-qualification.mjs';

const baseline=buildHostTrustManifest(),baselineBytes=bytes(baseline);
const sha='a'.repeat(40);
const cpu=()=>({
 architecture:'x86_64',op_modes:'32-bit, 64-bit',hypervisor:'Microsoft',virtualization:'full',
 vendor:'GenuineIntel',model_name:'independent-observed-cpu',flags:[...EXPECTED_HOST_TRUST.cpu_contract.required_flags]
});
const source=(lane,run_id=9001)=>({
 repository:RT_HOST_REPOSITORY,workflow:RT_HOST_WORKFLOW,
 event:'workflow_dispatch',ref:'refs/heads/main',commit_sha:sha,
 run_id,run_attempt:1,lane,job:'observe'
});
const unknown=()=>{
 const {id,...approved}=EXPECTED_HOST_TRUST.accepted_runtime_profiles.at(-1);
 const observed={...structuredClone(approved),cpu:cpu()};
 observed.runner.image_version='20261101.114.1';
 observed.kernel.release='7.0.0-1014-aws';
 observed.kernel.version='#14-Ubuntu SMP PREEMPT 2026'; // evidence is observed, not guessed for admission
 observed.engine.kernel_version=observed.kernel.release;
 return observed;
};
const observe=(o,lane,run)=>captureHostEvidence({baseline,baselineBytes,observed:o,source:source(lane,run)});
const pair=()=>{const o=unknown();return {A:observe(o,'A',9001),B:observe(o,'B',9002)};};

test('RT-HOST.1: independent runs with byte-identical unknown host qualify without admitting',()=>{
 const {A,B}=pair();
 assert.equal(A.checks.validator_status,'FAIL');
 assert.deepEqual(A.checks.validator_failures,['runtime_host_profile_is_explicitly_approved']);
 assert.equal(A.checks.existing_profile_positive,'PASS');
 assert.equal(A.checks.containerd_negative,'FAIL');
 assert.equal(A.checks.cpu_negative,'FAIL');
 const result=compareHostEvidence({baseline,baselineBytes,A,B,targetImage:'20261101.114.1'});
 assert.equal(result.status,'QUALIFIED_PENDING_SEPARATE_ADMISSION',JSON.stringify(result.failures));
 assert.deepEqual(result.failures,[]);
 assert.equal(result.proposed_profile_id,'github-ubuntu24-20261101.114.1');
 assert.equal(result.host_profile_admitted,false);
 assert.notEqual(A.source.run_id,B.source.run_id);
});

test('RT-HOST.1: already approved hosts may be independently observed on different runs',()=>{
 const {id,...known}=EXPECTED_HOST_TRUST.accepted_runtime_profiles.at(-1);
 const actual={...structuredClone(known),cpu:cpu()};
 const result=compareHostEvidence({baseline,baselineBytes,A:observe(actual,'A',101),B:observe(actual,'B',102)});
 assert.equal(result.status,'ALREADY_APPROVED',JSON.stringify(result.failures));
 assert.equal(result.host_profile_admitted,false);
});

test('RT-HOST.1: mismatching host image, kernel, containerd, runc or engine always blocks',()=>{
 for(const mutate of [
  x=>{x.runner.image_version='20261101.360.1';},
  x=>{x.kernel.release='7.0.0-1017-azure';},
  x=>{x.docker.components.containerd.version='v0.0.0';},
  x=>{x.docker.components.runc.version='v0.0.0';},
  x=>{x.engine.kernel_version='7.0.0-1017-azure';}
 ]){
  const {A}=pair();const changed=unknown();mutate(changed);
  const B=observe(changed,'B',102);
  const report=compareHostEvidence({baseline,baselineBytes,A,B});
  assert.equal(report.status,'NOT_QUALIFIED',JSON.stringify(report.failures));
  assert.ok(report.failures.includes('same_exact_runner_kernel_docker_engine'));
 }
});

test('RT-HOST.1: CPU compatibility is per observation, not arbitrary CPU model equality',()=>{
 const {A,B}=pair();
 B.observed.cpu.model_name='a-different-compatible-model';
 const report=compareHostEvidence({baseline,baselineBytes,A,B});
 assert.equal(report.status,'QUALIFIED_PENDING_SEPARATE_ADMISSION');
 const {A:one,B:bad}=pair();
 bad.checks.cpu[0].ok=false;
 assert.equal(compareHostEvidence({baseline,baselineBytes,A:one,B:bad}).status,'NOT_QUALIFIED');
});

test('RT-HOST.1: evidence is bound to base manifest bytes, SHA, exact target and distinct jobs',()=>{
 const changes=[
  x=>{x.B.baseline_fingerprint='0'.repeat(64);},
  x=>{x.B.source.commit_sha='b'.repeat(40);},
  x=>{x.B.source.repository='attacker/repository';},
  x=>{x.B.source.workflow='untrusted.yml';},
  x=>{x.B.source.lane='A';},
  x=>{x.B.profile_sha256='0'.repeat(64);},
  x=>{x.B.checks.containerd_negative='PASS';},
  x=>{x.B.semantic_data_modified=true;},
  x=>{x.B.checks.validator_failures=[];}
 ];
 for(const change of changes){
  const p=pair();change(p);
  assert.equal(compareHostEvidence({baseline,baselineBytes,...p,targetImage:'20261101.114.1'}).status,
    'NOT_QUALIFIED');
 }
 const p=pair();
 assert.equal(compareHostEvidence({baseline,baselineBytes,...p,targetImage:'20261101.360.1'}).status,'NOT_QUALIFIED');
});

test('RT-HOST.2: proposal with no authenticated exact code-pin remains blocked',()=>{
 const p=pair(),comparison=compareHostEvidence({baseline,baselineBytes,...p});
 const proposed=structuredClone(baseline);
 proposed.contract.accepted_runtime_profiles.push({id:comparison.proposed_profile_id,...comparison.proposed_profile});
 proposed.host_trust_fingerprint_sha256=hostTrustFingerprint(proposed).sha256;
 const result=validateHostAdmission({baseline,baselineBytes,proposed,...p,comparison});
 assert.equal(result.status,'BLOCKED');
 assert.ok(result.failures.includes('proposed_manifest_is_exactly_pinned_in_code'));
 assert.equal(result.no_auto_admission,true);
 assert.equal(result.canonical_data_changed,false);
});

test('RT-HOST.2: proposal rejects substituted source and tampered historical profiles',()=>{
 const p=pair(),comparison=compareHostEvidence({baseline,baselineBytes,...p});
 const proposed=structuredClone(baseline);
 proposed.contract.accepted_runtime_profiles[0].docker.components.runc.version='tampered';
 proposed.contract.accepted_runtime_profiles.push({id:comparison.proposed_profile_id,...comparison.proposed_profile});
 proposed.host_trust_fingerprint_sha256=hostTrustFingerprint(proposed).sha256;
 const result=validateHostAdmission({baseline,baselineBytes,proposed,...p,comparison});
 assert.equal(result.status,'BLOCKED');
 assert.ok(result.failures.includes('sole_append_only_profile'));
 const forged=structuredClone(comparison);forged.status='ALREADY_APPROVED';
 const another=validateHostAdmission({baseline,baselineBytes,proposed,...p,comparison:forged});
 assert.ok(another.failures.includes('comparison_evidence_is_unchanged'));
 const viaPr=pair();
 viaPr.A.source.event='pull_request';
 assert.equal(validateHostAdmission({baseline,baselineBytes,proposed,...viaPr,comparison}).status,'BLOCKED');
});

test('RT-HOST workflow is read-only, has no automatic admission, and retains independent proofs',async()=>{
 const q=await readFile('.github/workflows/rt-host-qualification.yml','utf8');
 const a=await readFile('.github/workflows/rt-host-admission-gate.yml','utf8');
 for(const flow of [q,a]){
  assert.match(flow,/permissions:/);
  assert.match(flow,/contents: read/);
  assert.doesNotMatch(flow,/contents:\s*write/);
  assert.doesNotMatch(flow,/\bgit push\b/);
  assert.doesNotMatch(flow,/gh pr create/);
 }
 assert.match(q,/matrix:/);
 assert.match(q,/lane: \[A, B\]/);
 assert.match(q,/rt-host-observation-/);
 assert.match(q,/--record-only/);
 assert.match(a,/--require-qualified/);
 assert.match(a,/RT_HOST_ADMISSION_GATE/);
});
