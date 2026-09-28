#!/usr/bin/env node
import {mkdir,writeFile} from 'node:fs/promises';
import {
 REVIEW_EVIDENCE_BUNDLE_PATH,
 buildReviewEvidenceBundle,
 inspectCurrentReviewEvidence
} from '../lib/actual-review-evidence-bundle.mjs';

const inspected=await inspectCurrentReviewEvidence();
const manifest=buildReviewEvidenceBundle(inspected);
await mkdir('data/current',{recursive:true});
await writeFile(REVIEW_EVIDENCE_BUNDLE_PATH,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({
 status:'PASS',
 review_evidence_bundle_path:REVIEW_EVIDENCE_BUNDLE_PATH,
 evidence_watermark:manifest.evidence_watermark,
 evidence_count:Object.keys(manifest.evidence).length,
 bundle_fingerprint_sha256:manifest.bundle_fingerprint_sha256
},null,2));
