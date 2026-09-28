#!/usr/bin/env node
import {mkdir,writeFile} from 'node:fs/promises';
import {BUILD_ENVIRONMENT_PATH,buildBuildEnvironmentManifest,inspectCurrentBuildEnvironment} from '../lib/actual-build-environment.mjs';

const inspected=await inspectCurrentBuildEnvironment();
const manifest=buildBuildEnvironmentManifest(inspected);
await mkdir('data/current',{recursive:true});
await writeFile(BUILD_ENVIRONMENT_PATH,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({
 status:'PASS',
 build_environment_path:BUILD_ENVIRONMENT_PATH,
 environment_fingerprint_sha256:manifest.environment_fingerprint_sha256,
 runner:manifest.environment.runner,
 toolchain:{
  node:manifest.environment.toolchain.node,
  npm:manifest.environment.toolchain.npm,
  package_lock_sha256:manifest.environment.toolchain.package_lock.sha256
 },
 actions:manifest.environment.actions
},null,2));
