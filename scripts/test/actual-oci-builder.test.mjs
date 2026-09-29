import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 EXPECTED_OCI_BUILDER,
 OCI_BUILDER_PATH,
 ociBuilderFingerprint,
 validateOciBuilderManifest
} from '../lib/actual-oci-builder.mjs';

test('committed ACTUAL OCI builder exactly matches pinned Buildx and BuildKit',async()=>{
 const manifest=JSON.parse(await readFile(OCI_BUILDER_PATH,'utf8'));
 const validation=await validateOciBuilderManifest(manifest);
 assert.equal(validation.status,'PASS',JSON.stringify(validation.failures));
 assert.deepEqual(manifest.toolchain.buildx,EXPECTED_OCI_BUILDER.buildx);
 assert.deepEqual(manifest.toolchain.buildkit,EXPECTED_OCI_BUILDER.buildkit);
 assert.deepEqual(manifest.builder,EXPECTED_OCI_BUILDER.builder);
});

test('OCI builder workflow installs byte-pinned Buildx and digest-pinned BuildKit before build',async()=>{
 const workflow=await readFile('.github/workflows/build-actual-runtime-image.yml','utf8');
 assert.match(workflow,/BUILDX_VERSION=v0\.37\.1/);
 assert.match(workflow,/BUILDX_COMMIT=0b265a9f62db554fa9aba6dd19e1bd5704bc7d8a/);
 assert.match(workflow,/BUILDX_SHA256=9447199cdb435f25880548343c128a4b6650e8891ee598905d8d29d39a8e359b/);
 assert.match(workflow,/BUILDKIT_REF=moby\/buildkit:v0\.33\.0@sha256:6c2fa84a6b61ccd72899dde4239f8d5717f05f9a8ca6f3cad185fb1a95a94de3/);
 assert.match(workflow,/--driver docker-container/);
 assert.match(workflow,/ACTUAL_OCI_BUILDER_RUNTIME_CHECK=1 node scripts\/process\/audit-actual-oci-builder\.mjs/);
 assert.match(workflow,/docker buildx --builder "\$BUILDER_NAME" build/);
});

test('OCI builder fingerprint reacts to Buildx or BuildKit identity drift',async()=>{
 const manifest=JSON.parse(await readFile(OCI_BUILDER_PATH,'utf8'));
 const base=ociBuilderFingerprint(manifest).sha256;
 const buildx=structuredClone(manifest);
 buildx.toolchain.buildx.binary_sha256='0'.repeat(64);
 assert.notEqual(ociBuilderFingerprint(buildx).sha256,base);
 const buildkit=structuredClone(manifest);
 buildkit.toolchain.buildkit.digest='sha256:'+'1'.repeat(64);
 assert.notEqual(ociBuilderFingerprint(buildkit).sha256,base);
});
