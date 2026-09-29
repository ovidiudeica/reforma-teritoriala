#!/usr/bin/env node
import {readFile,writeFile} from 'node:fs/promises';
import {OCI_BUILDER_GATE_PATH,OCI_BUILDER_PATH,sha256,validateOciBuilderManifest,validateOciBuilderRuntime} from '../lib/actual-oci-builder.mjs';

const bytes=await readFile(OCI_BUILDER_PATH);
const manifest=JSON.parse(bytes.toString('utf8'));
const staticValidation=await validateOciBuilderManifest(manifest);
const runtimeValidation=process.env.ACTUAL_OCI_BUILDER_RUNTIME_CHECK==='1'?await validateOciBuilderRuntime():null;
const failures=[
 ...staticValidation.failures.map(x=>({scope:'static',...x})),
 ...(runtimeValidation?.failures??[]).map(x=>({scope:'runtime',...x}))
];
const report={
 schema_version:1,
 mode:'ACTUAL_OCI_BUILDER_GATE',
 builder_manifest_path:OCI_BUILDER_PATH,
 builder_manifest_sha256:sha256(bytes),
 builder_fingerprint_sha256:manifest.builder_fingerprint_sha256??null,
 runtime_check:runtimeValidation!==null,
 status:failures.length?'FAIL':'PASS',
 policy:'Fail closed unless Buildx binary bytes/version/commit, BuildKit digest/image identity, docker-container driver contract and builder workflow bytes exactly match committed OCI-builder provenance. Runtime image builds require the live runtime check before building.',
 checks:[
  ...staticValidation.checks.map(x=>({scope:'static',...x})),
  ...(runtimeValidation?.checks??[]).map(x=>({scope:'runtime',...x}))
 ],
 failures
};
if(process.env.ACTUAL_OCI_BUILDER_GATE_READ_ONLY!=='1')await writeFile(OCI_BUILDER_GATE_PATH,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(report.status!=='PASS')process.exit(1);
