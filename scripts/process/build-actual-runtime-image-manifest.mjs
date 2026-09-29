#!/usr/bin/env node
import {mkdir,writeFile} from 'node:fs/promises';
import {RUNTIME_IMAGE_PATH,buildRuntimeImageManifest,inspectRuntimeImageDefinition} from '../lib/actual-runtime-image.mjs';

const inspected=await inspectRuntimeImageDefinition();
const manifest=buildRuntimeImageManifest(inspected);
await mkdir('data/current',{recursive:true});
await writeFile(RUNTIME_IMAGE_PATH,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',runtime_image_path:RUNTIME_IMAGE_PATH,runtime_ref:manifest.runtime.ref,runtime_fingerprint_sha256:manifest.runtime_fingerprint_sha256,source:manifest.source,reproducibility:manifest.reproducibility,builder_provenance:manifest.builder_provenance},null,2));
