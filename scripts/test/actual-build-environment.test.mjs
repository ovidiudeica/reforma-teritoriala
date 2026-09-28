import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 BUILD_ENVIRONMENT_PATH,
 EXPECTED_BUILD_ENVIRONMENT,
 buildEnvironmentFingerprint,
 sha256,
 validateBuildEnvironmentManifest
} from '../lib/actual-build-environment.mjs';

const readJson=async path=>JSON.parse(await readFile(path,'utf8'));

test('committed ACTUAL build environment matches repository bytes and exact pins',async()=>{
 const manifest=await readJson(BUILD_ENVIRONMENT_PATH);
 const validation=await validateBuildEnvironmentManifest(manifest);
 assert.equal(validation.status,'PASS',JSON.stringify(validation.failures));
 assert.deepEqual(manifest.environment.runner,EXPECTED_BUILD_ENVIRONMENT.runner);
 assert.deepEqual(manifest.environment.actions,EXPECTED_BUILD_ENVIRONMENT.actions);
});

test('build-environment fingerprint reacts to workflow, action, lockfile and vendored dependency identities',async()=>{
 const manifest=await readJson(BUILD_ENVIRONMENT_PATH);
 const before=buildEnvironmentFingerprint(manifest).sha256;
 for(const mutate of [
  value=>{value.environment.actions['actions/checkout']='0'.repeat(40);},
  value=>{value.environment.workflows.candidate.sha256='1'.repeat(64);},
  value=>{value.environment.toolchain.package_lock.sha256='2'.repeat(64);},
  value=>{value.environment.toolchain.dependency_bundle.archive_sha256='3'.repeat(64);},
  value=>{value.environment.toolchain.dependency_bundle.bundle_fingerprint_sha256='4'.repeat(64);},
  value=>{value.environment.support_files['scripts/process/install-actual-npm-offline.mjs']='5'.repeat(64);}
 ]){
  const changed=structuredClone(manifest);
  mutate(changed);
  assert.notEqual(buildEnvironmentFingerprint(changed).sha256,before);
 }
});

test('release manifest cryptographically binds the current build environment',async()=>{
 const [release,environment,bytes]=await Promise.all([
  readJson('data/current/actual-release-manifest.json'),
  readJson(BUILD_ENVIRONMENT_PATH),
  readFile(BUILD_ENVIRONMENT_PATH)
 ]);
 assert.equal(release.build_environment?.path,BUILD_ENVIRONMENT_PATH);
 assert.equal(release.build_environment?.sha256,sha256(bytes));
 assert.equal(release.build_environment?.environment_fingerprint_sha256,environment.environment_fingerprint_sha256);
 assert.equal(release.build_environment?.environment_fingerprint_algorithm,environment.environment_fingerprint_algorithm);
});

test('candidate builds and gates execution environment before dependency installation',async()=>{
 const workflow=await readFile('.github/workflows/actual-candidate.yml','utf8');
 const build=workflow.indexOf('npm run build:actual-build-environment');
 const gate=workflow.indexOf('npm run audit:actual-build-environment');
 const bundleGate=workflow.indexOf('npm run audit:actual-npm-dependency-bundle');
 const offlineInstall=workflow.indexOf('npm run install:actual-offline-deps');
 assert.ok(bundleGate>=0&&build>bundleGate&&gate>build&&offlineInstall>gate);
 assert.match(workflow,/data\/current\/actual-build-environment-manifest\.json/);
 assert.match(workflow,/data\/current\/actual-build-environment-gate\.json/);
});
