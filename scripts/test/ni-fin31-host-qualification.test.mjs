import test from 'node:test';import assert from 'node:assert/strict';
import {buildQualification,loadQualificationInputs,generateQualification,qualifyObserved} from '../audit/ni-fin31-host-qualification.mjs';
import {validateObservedHost,buildHostTrustManifest} from '../../docs/evidence/ni-fin31-host-qualification-20261025/baseline-host-trust.mjs';
const input=loadQualificationInputs();
test('authentic A/B differ only by image version and remain unauthorized',()=>{const x=buildQualification(input);assert.equal(x.runtime_authorized,false);assert.equal(x.owner_authorization,'WAITING_OWNER_AUTHORIZATION');assert.equal(x.A.contract_field_comparison.length,27);assert.equal(x.A.contract_field_comparison.filter(r=>r.match).length,26);assert.deepEqual(x.A.differences.map(r=>r.field),['runner.image_version']);assert.deepEqual(x.B.differences,x.A.differences);assert.equal(x.preserved_approved_profile_ids.length,4);assert.equal(validateObservedHost(input.manifest,input.a.observed).status,'FAIL');assert.deepEqual(buildHostTrustManifest(),input.manifest);});
test('proposal and evidence hashes regenerate byte-identically',()=>assert.equal(generateQualification(true).status,'BYTE_IDENTICAL_EVIDENCE'));
for(const [label,mutate] of [
 ['kernel drift',x=>x.a.observed.kernel.release='unapproved'],
 ['Docker drift',x=>x.a.observed.docker.server_version='0'],
 ['containerd drift',x=>x.b.observed.docker.components.containerd.version='0'],
 ['runc drift',x=>x.b.observed.docker.components.runc.git_commit='0'],
 ['storage drift',x=>x.a.observed.engine.storage_driver='other'],
 ['cgroup drift',x=>x.a.observed.engine.cgroup_version='1'],
 ['CPU flags missing',x=>x.a.observed.cpu.flags=[]],
 ['CPU architecture drift',x=>x.a.observed.cpu.architecture='aarch64'],
 ['wrong image',x=>x.a.observed.runner.image_version='20261024.unreviewed'],
 ['manifest mismatch',x=>x.a.host_trust_fingerprint_sha256='0'.repeat(64)],
 ['missing publication',x=>x.release.body='placeholder'],
 ['draft publication',x=>x.release.draft=true],
 ['wrong README',x=>x.readme='ANTIDDOS'],
 ['approved policy changed',x=>x.manifest.contract.accepted_runtime_profiles.push({id:'arbitrary'})]
])test('reject '+label,()=>{const x=structuredClone(input);mutate(x);assert.throws(()=>buildQualification(x),/qualification/);});
test('unchanged approved profile is not relabeled as the new proposal',()=>{const x=structuredClone(input.a.observed);x.runner.image_version='20261012.334.1';assert.throws(()=>qualifyObserved(input.manifest,x),/unexpected runtime difference/);});
