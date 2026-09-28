#!/usr/bin/env node
import {readFile,writeFile} from 'node:fs/promises';
import {BUILD_ENVIRONMENT_GATE_PATH,BUILD_ENVIRONMENT_PATH,sha256,validateBuildEnvironmentManifest} from '../lib/actual-build-environment.mjs';

const bytes=await readFile(BUILD_ENVIRONMENT_PATH);
const manifest=JSON.parse(bytes.toString('utf8'));
const validation=await validateBuildEnvironmentManifest(manifest,{checkRuntime:process.env.GITHUB_ACTIONS==='true'});
const report={
 schema_version:1,
 mode:'ACTUAL_BUILD_ENVIRONMENT_GATE',
 build_environment_path:BUILD_ENVIRONMENT_PATH,
 build_environment_sha256:sha256(bytes),
 environment_fingerprint_sha256:manifest.environment_fingerprint_sha256??null,
 status:validation.status,
 policy:'Fail closed unless repository workflow bytes, runner family/image, Node/npm, package files, the complete vendored offline npm dependency bundle and GitHub Action commit pins exactly match the committed ACTUAL build-environment manifest. GitHub Actions runs also verify the observed hosted image version.',
 checks:validation.checks,
 failures:validation.failures
};
if(process.env.ACTUAL_BUILD_ENVIRONMENT_GATE_READ_ONLY!=='1'){
 await writeFile(BUILD_ENVIRONMENT_GATE_PATH,JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify(report,null,2));
if(report.status!=='PASS')process.exit(1);
