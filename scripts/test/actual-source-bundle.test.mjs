import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SOURCE_BUNDLE_PATH,SOURCE_BUNDLE_GATE_PATH,sha256,sourceBundleFingerprint,validateSourceBundleManifest} from '../lib/actual-source-bundle.mjs';

const readJson=async path=>JSON.parse(await readFile(path,'utf8'));
const clone=value=>structuredClone(value);

test('committed ACTUAL source bundle validates exact OSM, SIRUTA and CUATM inputs',async()=>{
 const bundle=await readJson(SOURCE_BUNDLE_PATH);
 const gate=await readJson(SOURCE_BUNDLE_GATE_PATH);
 const bytes=await readFile(SOURCE_BUNDLE_PATH);
 const validation=await validateSourceBundleManifest(bundle);
 assert.equal(validation.status,'PASS',JSON.stringify(validation.failures));
 assert.equal(gate.status,'PASS');
 assert.equal(gate.source_bundle_sha256,sha256(bytes));
 assert.equal(gate.bundle_fingerprint_sha256,bundle.bundle_fingerprint_sha256);
 assert.deepEqual(Object.keys(bundle.sources).sort(),['cuatm','osm','siruta']);
 assert.deepEqual(Object.keys(bundle.sources.osm.countries).sort(),['MD','RO']);
});

for(const [name,mutate] of [
 ['OSM manifest',bundle=>{bundle.sources.osm.manifest_sha256='0'.repeat(64);}],
 ['OSM raw snapshot',bundle=>{bundle.sources.osm.countries.RO.compressed_sha256='1'.repeat(64);}],
 ['SIRUTA',bundle=>{bundle.sources.siruta.sha256='2'.repeat(64);}],
 ['CUATM',bundle=>{bundle.sources.cuatm.sha256='3'.repeat(64);}]
]){
 test('source-bundle fingerprint reacts to '+name+' byte identity',async()=>{
  const bundle=await readJson(SOURCE_BUNDLE_PATH);
  const before=sourceBundleFingerprint(bundle).sha256;
  const changed=clone(bundle);
  mutate(changed);
  assert.notEqual(sourceBundleFingerprint(changed).sha256,before);
  const validation=await validateSourceBundleManifest(changed);
  assert.equal(validation.status,'FAIL');
 });
}

test('release manifest cryptographically binds the current source bundle',async()=>{
 const [manifest,bundle,bytes]=await Promise.all([
  readJson('data/current/actual-release-manifest.json'),
  readJson(SOURCE_BUNDLE_PATH),
  readFile(SOURCE_BUNDLE_PATH)
 ]);
 assert.equal(manifest.source_bundle?.path,SOURCE_BUNDLE_PATH);
 assert.equal(manifest.source_bundle?.sha256,sha256(bytes));
 assert.equal(manifest.source_bundle?.bundle_fingerprint_sha256,bundle.bundle_fingerprint_sha256);
 assert.equal(manifest.source_bundle?.bundle_fingerprint_algorithm,bundle.bundle_fingerprint_algorithm);
});

test('candidate lifecycle builds and gates source bundle after refreshes and before deterministic OSM build',async()=>{
 const workflow=await readFile('.github/workflows/actual-candidate.yml','utf8');
 const lastRefresh=Math.max(workflow.indexOf('npm run import:ro-siruta'),workflow.indexOf('npm run import:md-cuatm'),workflow.indexOf('npm run import:osm'));
 const buildBundle=workflow.indexOf('npm run build:actual-source-bundle');
 const gateBundle=workflow.indexOf('npm run audit:actual-source-bundle');
 const osmBuild=workflow.indexOf('npm run build:osm-actual');
 const releaseManifest=workflow.indexOf('npm run build:actual-release-manifest');
 assert.ok(lastRefresh>=0&&buildBundle>lastRefresh);
 assert.ok(gateBundle>buildBundle&&osmBuild>gateBundle);
 assert.ok(releaseManifest>osmBuild);
 assert.match(workflow,/data\/current\/actual-source-bundle-manifest\.json/);
 assert.match(workflow,/data\/current\/actual-source-bundle-gate\.json/);
});
