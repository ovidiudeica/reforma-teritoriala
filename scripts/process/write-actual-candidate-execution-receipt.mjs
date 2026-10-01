#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';

const output='/tmp/actual-candidate-execution-receipt.json';
const sha256=value=>createHash('sha256').update(value).digest('hex');
const markerBytes=await readFile('data/current/actual-release-candidate.json');
const diffBytes=await readFile('data/current/actual-candidate-diff.json');
const marker=JSON.parse(markerBytes.toString('utf8'));
const receipt={
 schema_version:1,
 mode:'ACTUAL_CANDIDATE_EXECUTION_RECEIPT',
 generated_at:new Date().toISOString(),
 candidate_identity_sha256:marker.candidate_identity_sha256??null,
 candidate_marker_sha256:sha256(markerBytes),
 candidate_diff_sha256:sha256(diffBytes),
 execution:{
  workflow_run_id:process.env.GITHUB_RUN_ID??null,
  workflow_run_attempt:process.env.GITHUB_RUN_ATTEMPT??null,
  source_sha:process.env.GITHUB_SHA??null,
  workflow_ref:process.env.GITHUB_WORKFLOW_REF??null,
  source_trigger:process.env.ACTUAL_SOURCE_TRIGGER??null
 },
 policy:'Volatile execution metadata is artifact-only evidence. This receipt must never be staged into an ACTUAL candidate or persisted release tree.'
};
await mkdir('/tmp',{recursive:true});
await writeFile(output,JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt,null,2));
