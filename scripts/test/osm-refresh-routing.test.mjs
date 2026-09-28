import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';

const wrapperPath='.github/workflows/import-osm.yml';
const candidatePath='.github/workflows/actual-candidate.yml';
const importerPath='scripts/import/import-osm.mjs';
const builderPath='scripts/process/build-osm-actual.mjs';
const manifestPath='data/sources/osm-current.json';
const sha256=value=>createHash('sha256').update(value).digest('hex');

test('OSM source refresh is explicit and routed exclusively through ACTUAL candidate lifecycle',async()=>{
 const [wrapper,candidate]=await Promise.all([
  readFile(wrapperPath,'utf8'),
  readFile(candidatePath,'utf8')
 ]);
 assert.match(wrapper,/uses:\s*\.\/\.github\/workflows\/actual-candidate\.yml/);
 assert.match(wrapper,/refresh_osm:\s*true/);
 assert.match(wrapper,/source_trigger:\s*'osm-refresh'/);
 assert.doesNotMatch(wrapper,/\bgit\s+push\b/);
 assert.doesNotMatch(wrapper,/\bgit\s+commit\b/);
 assert.doesNotMatch(wrapper,/npm run import:osm/);
 assert.doesNotMatch(wrapper,/npm run build:osm-actual/);
 assert.doesNotMatch(wrapper,/audit:actual-release-gate/);

 assert.match(candidate,/refresh_osm:/);
 assert.match(candidate,/description: 'Refresh raw OSM source through Overpass before deterministic build'/);
 assert.match(candidate,/if:\s*inputs\.refresh_osm == true/);
 assert.match(candidate,/echo "- Refresh OSM raw source: \$\{\{ inputs\.refresh_osm \}\}"/);
 const refreshIndex=candidate.indexOf('npm run import:osm');
 const buildIndex=candidate.indexOf('npm run build:osm-actual');
 const roIndex=candidate.indexOf('npm run audit:ro-official-reconciliation');
 const mdIndex=candidate.indexOf('npm run reconcile:cuatm');
 assert.ok(refreshIndex>=0&&buildIndex>refreshIndex,'optional OSM source refresh must precede deterministic OSM build');
 assert.ok(roIndex>buildIndex&&mdIndex>buildIndex,'all jurisdiction reconciliation must consume the deterministic OSM build');
});

test('candidate defaults to offline OSM rebuild and only the OSM wrapper enables network refresh',async()=>{
 const [candidate,osmWrapper,roWrapper,mdWrapper]=await Promise.all([
  readFile(candidatePath,'utf8'),
  readFile(wrapperPath,'utf8'),
  readFile('.github/workflows/refresh-ro-official.yml','utf8'),
  readFile('.github/workflows/refresh-md-official.yml','utf8')
 ]);
 const refreshInputBlocks=[...candidate.matchAll(/refresh_osm:\s*\n\s+(?:description:.*\n\s+)?required:\s*false\s*\n\s+type:\s*boolean\s*\n\s+default:\s*false/g)];
 assert.equal(refreshInputBlocks.length,2,'workflow_dispatch and workflow_call must both default refresh_osm=false');
 assert.match(osmWrapper,/refresh_osm:\s*true/);
 assert.match(roWrapper,/refresh_osm:\s*false/);
 assert.match(mdWrapper,/refresh_osm:\s*false/);
});

test('OSM importer is the only networked OSM source step and writes durable content-addressed snapshots',async()=>{
 const [importer,builder]=await Promise.all([
  readFile(importerPath,'utf8'),
  readFile(builderPath,'utf8')
 ]);
 assert.match(importer,/\bfetch\s*\(/);
 assert.match(importer,/AbortController/);
 assert.match(importer,/OVERPASS_REQUEST_TIMEOUT_MS/);
 assert.match(importer,/OVERPASS_RETRIES_PER_ENDPOINT/);
 assert.match(importer,/data\/sources\/osm-current\.json/);
 assert.match(importer,/data\/sources\/osm-snapshots/);
 assert.match(importer,/snapshotPath/);
 assert.match(importer,/compressed_sha256/);
 assert.match(importer,/snapshot_at/);
 assert.match(importer,/previousEntry\?\.semantic_sha256===result\.semanticSha/);
 assert.match(importer,/status=unchanged\?'UNCHANGED':'UPDATED'/);
 assert.match(importer,/semantic_sha256/);
 assert.doesNotMatch(importer,/data\/sources\/osm-runtime/);

 assert.match(builder,/data\/sources\/osm-current\.json/);
 assert.match(builder,/data\/sources\/osm-snapshots/);
 assert.match(builder,/snapshot_path/);
 assert.match(builder,/compressed_sha256/);
 assert.match(builder,/osmSource\.snapshot_at/);
 assert.match(builder,/readRawSnapshot/);
 assert.match(builder,/gunzipSync/);
 assert.doesNotMatch(builder,/\bfetch\s*\(/);
 assert.doesNotMatch(builder,/OVERPASS_/);
 assert.doesNotMatch(builder,/https:\/\/overpass/);
 assert.doesNotMatch(builder,/new Date\s*\(/);
 assert.doesNotMatch(builder,/osm-runtime/);
});

test('committed OSM manifest points to exact durable content-addressed bytes',async()=>{
 const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
 assert.equal(manifest.schema_version,2);
 assert.equal(manifest.snapshot_directory,'data/sources/osm-snapshots');
 assert.ok(Number.isFinite(new Date(manifest.snapshot_at).getTime()));
 for(const code of ['RO','MD']){
  const entry=manifest.countries?.[code];
  assert.ok(entry,code+' manifest entry is required');
  assert.ok(Number.isFinite(new Date(entry.snapshot_at).getTime()),code+' snapshot_at must be stable');
  const expected=`data/sources/osm-snapshots/${code.toLowerCase()}-${entry.semantic_sha256}.json.gz`;
  assert.equal(entry.snapshot_path,expected);
  const compressed=await readFile(entry.snapshot_path);
  assert.equal(sha256(compressed),entry.compressed_sha256,code+' compressed SHA256 must match');
  const canonical=gunzipSync(compressed);
  assert.equal(sha256(canonical),entry.semantic_sha256,code+' semantic SHA256 must match');
  const raw=JSON.parse(canonical.toString('utf8'));
  assert.equal(raw.elements.length,entry.element_count,code+' element count must match');
 }
});

test('candidate commits durable OSM snapshots but network review artifacts never become a separate runtime source',async()=>{
 const candidate=await readFile(candidatePath,'utf8');
 const commitLine=candidate.split('\n').find(line=>line.includes('git add data/current/'))||'';
 assert.match(commitLine,/data\/sources\/osm-current\.json/);
 assert.match(commitLine,/data\/sources\/osm-snapshots\//);
 assert.doesNotMatch(commitLine,/osm-runtime/);
 assert.match(candidate,/data\/sources\/osm-snapshots\/\*\.json\.gz/);
 assert.doesNotMatch(candidate,/data\/sources\/osm-runtime\/\*\.json\.gz/);
});

test('deterministic OSM builder retains all non-network classifier dependencies after extraction',async()=>{
 const builder=await readFile(builderPath,'utf8');
 assert.match(builder,/const CLASSIFIER_VERSION='2\.3'/);
 assert.match(builder,/const countries=\{/);
 assert.match(builder,/ro-level9-exception-evidence\.json/);
 assert.match(builder,/const roSemanticByRelation=/);
 assert.match(builder,/const RO_SEMANTIC_CLASSES=/);
});
