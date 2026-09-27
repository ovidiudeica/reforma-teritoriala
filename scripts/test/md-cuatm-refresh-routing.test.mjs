import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const refreshPath='.github/workflows/refresh-md-official.yml';
const candidatePath='.github/workflows/actual-candidate.yml';
const reconcilePath='scripts/process/reconcile-cuatm.mjs';
const importerPath='scripts/import/import-md-cuatm.mjs';

test('MD CUATM refresh is routed exclusively through ACTUAL candidate lifecycle',async()=>{
 const [refresh,candidate]=await Promise.all([
  readFile(refreshPath,'utf8'),
  readFile(candidatePath,'utf8')
 ]);
 assert.match(refresh,/uses:\s*\.\/\.github\/workflows\/actual-candidate\.yml/);
 assert.match(refresh,/refresh_md_cuatm:\s*true/);
 assert.match(refresh,/source_trigger:\s*'md-cuatm-refresh'/);
 assert.doesNotMatch(refresh,/\bgit\s+push\b/);
 assert.doesNotMatch(refresh,/\bgit\s+commit\b/);
 assert.doesNotMatch(refresh,/reconcile:cuatm/);
 assert.doesNotMatch(refresh,/build:actual-release-manifest/);
 assert.doesNotMatch(refresh,/audit:actual-release-gate/);
 assert.doesNotMatch(refresh,/^\s{2}push:\s*$/m);

 assert.match(candidate,/workflow_call:/);
 assert.match(candidate,/refresh_md_cuatm:/);
 assert.match(candidate,/if:\s*inputs\.refresh_md_cuatm == true/);
 assert.match(candidate,/npm run import:md-cuatm/);
 const refreshIndex=candidate.indexOf('npm run import:md-cuatm');
 const osmIndex=candidate.indexOf('npm run import:osm');
 const reconcileIndex=candidate.indexOf('npm run reconcile:cuatm');
 assert.ok(refreshIndex>=0&&osmIndex>refreshIndex&&reconcileIndex>osmIndex,'CUATM refresh must precede OSM regeneration and deterministic MD reconciliation');
});

test('MD CUATM reconciliation is deterministic on the materialized snapshot',async()=>{
 const content=await readFile(reconcilePath,'utf8');
 assert.match(content,/data\/sources\/cuatm-current\.json/);
 assert.match(content,/readFile\(SNAPSHOT/);
 assert.doesNotMatch(content,/\bfetch\s*\(/);
 assert.doesNotMatch(content,/from ['"]xlsx['"]/);
 assert.doesNotMatch(content,/CUATM_URL/);
 assert.doesNotMatch(content,/writeFile\(SNAPSHOT/);
 assert.match(content,/validateOfficialSnapshot/);
});

test('MD CUATM importer is bounded and preserves a valid prior official snapshot on source failure',async()=>{
 const content=await readFile(importerPath,'utf8');
 assert.match(content,/CUATM_REQUEST_TIMEOUT_MS/);
 assert.match(content,/AbortController/);
 assert.match(content,/CUATM_RETRIES/);
 assert.match(content,/PRESERVED_LAST_OFFICIAL_SNAPSHOT/);
 assert.match(content,/UNCHANGED/);
 assert.match(content,/UPDATED/);
 assert.match(content,/validateSnapshot/);
 assert.match(content,/CUATM schema missing columns/);
 assert.match(content,/CUATM parse produced too few records/);
});
