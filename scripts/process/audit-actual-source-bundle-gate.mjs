#!/usr/bin/env node
import {readFile,writeFile} from 'node:fs/promises';
import {SOURCE_BUNDLE_GATE_PATH,SOURCE_BUNDLE_PATH,sha256,validateSourceBundleManifest} from '../lib/actual-source-bundle.mjs';

const bundleBytes=await readFile(SOURCE_BUNDLE_PATH);
const bundle=JSON.parse(bundleBytes.toString('utf8'));
const validation=await validateSourceBundleManifest(bundle);
const report={
 schema_version:1,
 mode:'ACTUAL_SOURCE_BUNDLE_GATE',
 generated_at:bundle.source_watermark??new Date(0).toISOString(),
 source_bundle_path:SOURCE_BUNDLE_PATH,
 source_bundle_sha256:sha256(bundleBytes),
 bundle_fingerprint_sha256:bundle.bundle_fingerprint_sha256??null,
 status:validation.status,
 policy:'Fail closed unless the source-bundle manifest exactly matches all currently activated ACTUAL sources: OSM, SIRUTA, CUATM and any explicitly policy-bound ANCPI/RELUAT fallback bytes. Both durable OSM raw snapshots and every activated fallback source must remain cryptographically exact.',
 checks:validation.checks,
 failures:validation.failures
};
await writeFile(SOURCE_BUNDLE_GATE_PATH,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(report.status!=='PASS')process.exit(1);
