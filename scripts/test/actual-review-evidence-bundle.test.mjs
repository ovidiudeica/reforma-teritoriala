import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 buildReviewEvidenceBundle,
 inspectCurrentReviewEvidence,
 validateReviewEvidenceBundle
} from '../lib/actual-review-evidence-bundle.mjs';

test('review evidence bundle is deterministic and validates current frozen evidence',async()=>{
 const inspected=await inspectCurrentReviewEvidence();
 const a=buildReviewEvidenceBundle(inspected);
 const b=buildReviewEvidenceBundle(inspected);
 assert.deepEqual(a,b);
 assert.equal((await validateReviewEvidenceBundle(a)).status,'PASS');
 assert.equal(Object.keys(a.evidence).length,8);
});

test('ACTUAL candidate consumes frozen review evidence and never runs live evidence refresh audits',async()=>{
 const workflow=await readFile('.github/workflows/actual-candidate.yml','utf8');
 for(const forbidden of [
  'npm run audit:ro-official-exceptions',
  'npm run audit:ro-level9-exceptions',
  'npm run audit:osm-history',
  'npm run audit:balti-way-history',
  'npm run audit:balti-semantics',
  'npm run audit:md-individual-cases'
 ])assert.equal(workflow.includes(forbidden),false,forbidden+' must not run in deterministic candidate lifecycle');
 assert.match(workflow,/npm run build:actual-review-evidence-bundle/);
 assert.match(workflow,/npm run audit:actual-review-evidence-bundle/);
});
