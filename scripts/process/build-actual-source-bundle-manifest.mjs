#!/usr/bin/env node
import {mkdir,writeFile} from 'node:fs/promises';
import {SOURCE_BUNDLE_PATH,buildSourceBundleManifest,inspectCurrentSourceInputs} from '../lib/actual-source-bundle.mjs';

const inspected=await inspectCurrentSourceInputs();
const manifest=buildSourceBundleManifest(inspected);
await mkdir('data/current',{recursive:true});
await writeFile(SOURCE_BUNDLE_PATH,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({
 status:'PASS',
 source_bundle_path:SOURCE_BUNDLE_PATH,
 source_watermark:manifest.source_watermark,
 bundle_fingerprint_sha256:manifest.bundle_fingerprint_sha256,
 osm:{RO:manifest.sources.osm.countries.RO.semantic_sha256,MD:manifest.sources.osm.countries.MD.semantic_sha256},
 siruta:manifest.sources.siruta.sha256,
 cuatm:manifest.sources.cuatm.sha256
},null,2));
