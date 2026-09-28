import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('candidate deterministic phase is kernel-network-isolated',async()=>{
 const workflow=await readFile('.github/workflows/actual-candidate.yml','utf8');
 assert.match(workflow,/ACTUAL_RUNTIME_IMAGE:\s*ghcr\.io\/ovidiudeica\/reforma-teritoriala-actual-runtime@sha256:[0-9a-f]{64}/);
 assert.match(workflow,/docker run[\s\S]*?--network none[\s\S]*?--cap-drop ALL[\s\S]*?no-new-privileges/);
 assert.match(workflow,/ACTUAL_NETWORK_MODE=docker-network-none/);
 assert.match(workflow,/scripts\/process\/run-actual-deterministic-candidate\.sh/);
 assert.match(workflow,/node scripts\/process\/verify-actual-persisted-base\.mjs/);
 assert.doesNotMatch(workflow,/node --input-type=module <<|<<"NODE"/);
 assert.doesNotMatch(workflow,/\/var\/run\/docker\.sock/);
});

test('deterministic runner proves denial before doing ACTUAL work',async()=>{
 const script=await readFile('scripts/process/run-actual-deterministic-candidate.sh','utf8');
 const proof=script.indexOf('npm run prove:actual-network-denial');
 const source=script.indexOf('npm run build:actual-source-bundle');
 const build=script.indexOf('npm run build:osm-actual');
 assert.ok(proof>=0&&source>proof&&build>source);
 assert.doesNotMatch(script,/\bcurl\b|\bwget\b|\bgh\s|git\s+(?:fetch|pull|push|ls-remote)\b/);
});

test('network denial proof is part of the candidate review artifact',async()=>{
 const workflow=await readFile('.github/workflows/actual-candidate.yml','utf8');
 assert.match(workflow,/data\/current\/actual-network-denial-audit\.json/);
});
