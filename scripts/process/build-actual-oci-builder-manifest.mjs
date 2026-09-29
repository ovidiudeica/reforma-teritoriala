#!/usr/bin/env node
import {mkdir,writeFile} from 'node:fs/promises';
import {OCI_BUILDER_PATH,buildOciBuilderManifest,inspectOciBuilderDefinition} from '../lib/actual-oci-builder.mjs';

const inspected=await inspectOciBuilderDefinition();
const manifest=buildOciBuilderManifest(inspected);
await mkdir('data/current',{recursive:true});
await writeFile(OCI_BUILDER_PATH,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',builder_manifest_path:OCI_BUILDER_PATH,builder_fingerprint_sha256:manifest.builder_fingerprint_sha256,toolchain:manifest.toolchain,builder:manifest.builder,source:manifest.source},null,2));
