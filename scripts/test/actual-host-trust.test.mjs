import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 EXPECTED_HOST_TRUST,
 HOST_TRUST_PATH,
 buildHostTrustManifest,
 validateHostTrustManifest
} from '../lib/actual-host-trust.mjs';

test('committed ACTUAL host trust manifest exactly matches pinned contract',async()=>{
 const committed=JSON.parse(await readFile(HOST_TRUST_PATH,'utf8'));
 const expected=buildHostTrustManifest();
 const validation=validateHostTrustManifest(committed);
 assert.equal(validation.status,'PASS',JSON.stringify(validation.failures));
 assert.deepEqual(committed,expected);
 assert.deepEqual(EXPECTED_HOST_TRUST.cpu_contract.accepted_vendors,['AuthenticAMD','GenuineIntel']);
 assert.deepEqual(EXPECTED_HOST_TRUST.accepted_runtime_profiles.map(x=>x.id),[
  'github-ubuntu24-20260920.314.1',
  'github-ubuntu24-20260927.320.1',
  'github-ubuntu24-20261004.327.1'
 ]);
 assert.equal(EXPECTED_HOST_TRUST.cpu_contract.execution_profile.node_options,'--jitless');
 assert.equal(EXPECTED_HOST_TRUST.cpu_contract.execution_profile.cpuset_cpus,'0');
});

test('candidate gates host before OCI execution and forces CPU-neutral deterministic profile',async()=>{
 const workflow=await readFile('.github/workflows/actual-candidate.yml','utf8');
 const gate=workflow.indexOf('Gate ACTUAL host trust boundary');
 const pull=workflow.indexOf('Authenticate and pull exact ACTUAL runtime');
 const deterministic=workflow.indexOf('Run entire deterministic ACTUAL phase with kernel egress disabled');
 assert.ok(gate>=0&&pull>gate&&deterministic>pull);
 assert.match(workflow,/--platform linux\/amd64/);
 assert.match(workflow,/--cpuset-cpus 0/);
 assert.match(workflow,/--env NODE_OPTIONS=--jitless/);
 assert.match(workflow,/--env UV_THREADPOOL_SIZE=1/);
 assert.match(workflow,/--env TZ=UTC/);
 assert.match(workflow,/--env LANG=C\.UTF-8/);
 assert.match(workflow,/--env LC_ALL=C\.UTF-8/);
 assert.match(workflow,/actual-host-trust-audit\.json/);
});

test('deterministic runner fails closed unless the CPU execution profile is exact',async()=>{
 const script=await readFile('scripts/process/run-actual-deterministic-candidate.sh','utf8');
 assert.match(script,/test "\$NODE_OPTIONS" = "--jitless"/);
 assert.match(script,/test "\$UV_THREADPOOL_SIZE" = "1"/);
 assert.match(script,/test "\$TZ" = "UTC"/);
 assert.match(script,/test "\$LANG" = "C\.UTF-8"/);
 assert.match(script,/test "\$LC_ALL" = "C\.UTF-8"/);
});

test('both complete approved hosts pass; unknown and mixed profiles fail closed',async()=>{
 const {validateObservedHost}=await import('../lib/actual-host-trust.mjs');
 const manifest=buildHostTrustManifest();
 const contract=EXPECTED_HOST_TRUST.cpu_contract;
 const cpu={architecture:contract.architecture,op_modes:contract.op_modes,hypervisor:contract.hypervisor,virtualization:contract.virtualization,vendor:'GenuineIntel',flags:contract.required_flags};
 const observed=EXPECTED_HOST_TRUST.accepted_runtime_profiles.map(({id,...host})=>({...structuredClone(host),cpu}));
 for(const host of observed)assert.equal(validateObservedHost(manifest,host).status,'PASS');
 const unknown=structuredClone(observed[1]);unknown.runner.image_version='20990101.1.1';
 assert.equal(validateObservedHost(manifest,unknown).status,'FAIL');
 const mixed=structuredClone(observed[0]);mixed.docker=observed[1].docker;
 assert.equal(validateObservedHost(manifest,mixed).status,'FAIL');
 for(const section of ['runner','kernel','docker','engine']){
  const changed=structuredClone(observed[1]);changed[section].unexpected='unapproved';
  assert.equal(validateObservedHost(manifest,changed).status,'FAIL',section);
 }
});
