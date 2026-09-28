import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {EXPECTED_RUNTIME_IMAGE,RUNTIME_IMAGE_PATH,validateRuntimeImageManifest} from '../lib/actual-runtime-image.mjs';

test('committed ACTUAL OCI runtime exactly matches pinned definition',async()=>{
 const manifest=JSON.parse(await readFile(RUNTIME_IMAGE_PATH,'utf8'));
 const validation=await validateRuntimeImageManifest(manifest);
 assert.equal(validation.status,'PASS',JSON.stringify(validation.failures));
 assert.deepEqual(manifest.runtime,EXPECTED_RUNTIME_IMAGE);
});

test('all ACTUAL jobs consume the exact OCI digest and do not setup Node dynamically',async()=>{
 for(const name of ['actual-candidate.yml','actual-topology-audit.yml','actual-promote-candidate.yml','verify-persisted-actual-release.yml']){
  const content=await readFile('.github/workflows/'+name,'utf8');
  assert.match(content,new RegExp('image:\\s*'+EXPECTED_RUNTIME_IMAGE.ref.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.doesNotMatch(content,/actions\/setup-node@/);
 }
});
