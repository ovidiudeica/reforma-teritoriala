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
 assert.equal(manifest.environment.network_policy?.deterministic_network,'none');
 assert.equal(manifest.environment.network_policy?.docker_socket_mounted,false);
 assert.equal(manifest.environment.host_trust?.kernel_release,'6.17.0-1022-azure');
 assert.equal(manifest.environment.host_trust?.docker_server_version,'28.0.4');
 assert.equal(manifest.environment.host_trust?.containerd_version,'v2.3.6');
 assert.equal(manifest.environment.host_trust?.runc_version,'1.5.1');
 assert.equal(manifest.environment.host_trust?.cpu_execution_profile?.node_options,'--jitless');
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
  value=>{value.environment.runtime_image.digest='5'.repeat(64);},
  value=>{value.environment.runtime_image.runtime_fingerprint_sha256='6'.repeat(64);},
  value=>{value.environment.network_policy.deterministic_network='bridge';},
  value=>{value.environment.host_trust.host_trust_fingerprint_sha256='8'.repeat(64);},
  value=>{value.environment.host_trust.cpu_execution_profile.node_options='';},
  value=>{value.environment.support_files['scripts/process/install-actual-npm-offline.mjs']='7'.repeat(64);}
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
 const runtimeBuild=workflow.indexOf('npm run build:actual-runtime-image-manifest');
 const runtimeGate=workflow.indexOf('npm run audit:actual-runtime-image');
 const bundleGate=workflow.indexOf('npm run audit:actual-npm-dependency-bundle');
 const build=workflow.indexOf('npm run build:actual-build-environment');
 const gate=workflow.indexOf('npm run audit:actual-build-environment');
 const offlineInstall=workflow.indexOf('npm run install:actual-offline-deps');
 assert.ok(runtimeBuild>=0&&runtimeGate>runtimeBuild&&bundleGate>runtimeGate&&build>bundleGate&&gate>build&&offlineInstall>gate);
 assert.match(workflow,/data\/current\/actual-build-environment-manifest\.json/);
 assert.match(workflow,/data\/current\/actual-build-environment-gate\.json/);
});
