import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const wrapperPath='.github/workflows/import-osm.yml';
const candidatePath='.github/workflows/actual-candidate.yml';
const importerPath='scripts/import/import-osm.mjs';
const builderPath='scripts/process/build-osm-actual.mjs';

test('OSM source refresh is routed exclusively through ACTUAL candidate lifecycle',async()=>{
 const [wrapper,candidate]=await Promise.all([
  readFile(wrapperPath,'utf8'),
  readFile(candidatePath,'utf8')
 ]);
 assert.match(wrapper,/uses:\s*\.\/\.github\/workflows\/actual-candidate\.yml/);
 assert.match(wrapper,/source_trigger:\s*'osm-refresh'/);
 assert.doesNotMatch(wrapper,/\bgit\s+push\b/);
 assert.doesNotMatch(wrapper,/\bgit\s+commit\b/);
 assert.doesNotMatch(wrapper,/npm run import:osm/);
 assert.doesNotMatch(wrapper,/npm run build:osm-actual/);
 assert.doesNotMatch(wrapper,/audit:actual-release-gate/);

 const refreshIndex=candidate.indexOf('npm run import:osm');
 const buildIndex=candidate.indexOf('npm run build:osm-actual');
 const roIndex=candidate.indexOf('npm run audit:ro-official-reconciliation');
 const mdIndex=candidate.indexOf('npm run reconcile:cuatm');
 assert.ok(refreshIndex>=0&&buildIndex>refreshIndex,'OSM source refresh must precede deterministic OSM build');
 assert.ok(roIndex>buildIndex&&mdIndex>buildIndex,'all jurisdiction reconciliation must consume the deterministic OSM build');
});

test('OSM importer is the only networked OSM source step',async()=>{
 const [importer,builder]=await Promise.all([
  readFile(importerPath,'utf8'),
  readFile(builderPath,'utf8')
 ]);
 assert.match(importer,/\bfetch\s*\(/);
 assert.match(importer,/AbortController/);
 assert.match(importer,/OVERPASS_REQUEST_TIMEOUT_MS/);
 assert.match(importer,/OVERPASS_RETRIES_PER_ENDPOINT/);
 assert.match(importer,/data\/sources\/osm-current\.json/);
 assert.match(importer,/data\/sources\/osm-runtime/);
 assert.match(importer,/status=unchanged\?'UNCHANGED':'UPDATED'/);
 assert.match(importer,/semantic_sha256/);

 assert.match(builder,/data\/sources\/osm-current\.json/);
 assert.match(builder,/readRawSnapshot/);
 assert.match(builder,/gunzipSync/);
 assert.doesNotMatch(builder,/\bfetch\s*\(/);
 assert.doesNotMatch(builder,/OVERPASS_/);
 assert.doesNotMatch(builder,/https:\/\/overpass/);
 assert.doesNotMatch(builder,/new Date\s*\(/);
});

test('candidate captures compressed raw OSM bytes for review without committing them to release branches',async()=>{
 const candidate=await readFile(candidatePath,'utf8');
 assert.match(candidate,/data\/sources\/osm-runtime\/\*\.json\.gz/);
 const commitLine=candidate.split('\n').find(line=>line.includes('git add data/current/'))||'';
 assert.match(commitLine,/data\/sources\/osm-current\.json/);
 assert.doesNotMatch(commitLine,/osm-runtime/);
});

test('deterministic OSM builder retains all non-network classifier dependencies after extraction',async()=>{
 const builder=await readFile(builderPath,'utf8');
 assert.match(builder,/const CLASSIFIER_VERSION='2\.3'/);
 assert.match(builder,/const countries=\\{/);
 assert.match(builder,/ro-level9-exception-evidence\\.json/);
 assert.match(builder,/const roSemanticByRelation=/);
 assert.match(builder,/const RO_SEMANTIC_CLASSES=/);
});
