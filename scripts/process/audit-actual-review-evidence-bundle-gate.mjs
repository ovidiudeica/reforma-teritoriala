#!/usr/bin/env node
import {readFile,writeFile} from 'node:fs/promises';
import {
 REVIEW_EVIDENCE_BUNDLE_PATH,
 REVIEW_EVIDENCE_GATE_PATH,
 sha256,
 validateReviewEvidenceBundle
} from '../lib/actual-review-evidence-bundle.mjs';

const bundleBytes=await readFile(REVIEW_EVIDENCE_BUNDLE_PATH);
const bundle=JSON.parse(bundleBytes.toString('utf8'));
const validation=await validateReviewEvidenceBundle(bundle);
const report={
 schema_version:1,
 mode:'ACTUAL_REVIEW_EVIDENCE_BUNDLE_GATE',
 generated_at:bundle.evidence_watermark??new Date(0).toISOString(),
 review_evidence_bundle_path:REVIEW_EVIDENCE_BUNDLE_PATH,
 review_evidence_bundle_sha256:sha256(bundleBytes),
 bundle_fingerprint_sha256:bundle.bundle_fingerprint_sha256??null,
 status:validation.status,
 policy:'Fail closed unless every committed review-evidence byte matches the exact content-addressed bundle and the canonical bundle fingerprint recomputes exactly. Candidate builds are forbidden from refreshing this evidence.',
 checks:validation.checks,
 failures:validation.failures
};
await writeFile(REVIEW_EVIDENCE_GATE_PATH,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(report.status!=='PASS')process.exit(1);
