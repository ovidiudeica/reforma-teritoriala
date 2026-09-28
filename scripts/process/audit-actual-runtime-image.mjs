#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {RUNTIME_IMAGE_PATH,sha256,validateRuntimeImageManifest} from '../lib/actual-runtime-image.mjs';

const bytes=await readFile(RUNTIME_IMAGE_PATH);
const manifest=JSON.parse(bytes.toString('utf8'));
const validation=await validateRuntimeImageManifest(manifest);
const report={
 schema_version:1,
 mode:'ACTUAL_OCI_RUNTIME_GATE',
 runtime_image_path:RUNTIME_IMAGE_PATH,
 runtime_image_manifest_sha256:sha256(bytes),
 runtime_fingerprint_sha256:manifest.runtime_fingerprint_sha256??null,
 runtime_ref:manifest.runtime?.ref??null,
 status:validation.status,
 policy:'Fail closed unless the exact GHCR runtime digest, exact upstream base digest, Dockerfile bytes and reproducible builder contract match the committed ACTUAL OCI runtime manifest.',
 checks:validation.checks,
 failures:validation.failures
};
console.log(JSON.stringify(report,null,2));
if(report.status!=='PASS')process.exit(1);
