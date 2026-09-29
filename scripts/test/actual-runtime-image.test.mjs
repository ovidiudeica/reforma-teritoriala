import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {OCI_BUILDER_PATH} from '../lib/actual-oci-builder.mjs';
import {EXPECTED_RUNTIME_IMAGE,RUNTIME_IMAGE_PATH,validateRuntimeImageManifest} from '../lib/actual-runtime-image.mjs';

test('committed ACTUAL OCI runtime exactly matches pinned definition',async()=>{
 const manifest=JSON.parse(await readFile(RUNTIME_IMAGE_PATH,'utf8'));
 const validation=await validateRuntimeImageManifest(manifest);
 assert.equal(validation.status,'PASS',JSON.stringify(validation.failures));
 assert.deepEqual(manifest.runtime,EXPECTED_RUNTIME_IMAGE);
 const builderBytes=await readFile(OCI_BUILDER_PATH);
 const builder=JSON.parse(builderBytes.toString('utf8'));
 const builderSha=createHash('sha256').update(builderBytes).digest('hex');
 assert.equal(manifest.builder_provenance.manifest_sha256,builderSha);
 assert.equal(manifest.builder_provenance.builder_fingerprint_sha256,builder.builder_fingerprint_sha256);
});

test('all ACTUAL jobs consume the exact OCI digest and do not setup Node dynamically',async()=>{
 const escaped=EXPECTED_RUNTIME_IMAGE.ref.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const candidate=await readFile('.github/workflows/actual-candidate.yml','utf8');
 assert.match(candidate,new RegExp('ACTUAL_RUNTIME_IMAGE:\\s*'+escaped));
 assert.match(candidate,/docker run[\s\S]*?--network none/);
 assert.doesNotMatch(candidate,/actions\/setup-node@/);
 for(const name of ['actual-topology-audit.yml','actual-promote-candidate.yml','verify-persisted-actual-release.yml']){
  const workflow=await readFile('.github/workflows/'+name,'utf8');
  assert.match(workflow,new RegExp('image:\\s*'+escaped));
  assert.doesNotMatch(workflow,/actions\/setup-node@/);
 }
});
