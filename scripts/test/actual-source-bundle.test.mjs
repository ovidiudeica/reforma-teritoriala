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
 const expectedSources=['cuatm','osm','siruta'];
 if(bundle.sources.ancpi_ro_uat_fallbacks)expectedSources.push('ancpi_ro_uat_fallbacks');
 assert.deepEqual(Object.keys(bundle.sources).sort(),expectedSources.sort());
 if(bundle.sources.ancpi_ro_uat_fallbacks){
  assert.equal(bundle.sources.ancpi_ro_uat_fallbacks.mode,'ACTUAL_RO_ANCPI_UAT_FALLBACKS');
  assert.ok(JSON.stringify(bundle.sources.ancpi_ro_uat_fallbacks.legal_ids)===JSON.stringify(['64096'])||JSON.stringify(bundle.sources.ancpi_ro_uat_fallbacks.legal_ids)===JSON.stringify(['64096','64602']));
 }
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
 const [workflow,runner]=await Promise.all([
  readFile('.github/workflows/actual-candidate.yml','utf8'),
  readFile('scripts/process/run-actual-deterministic-candidate.sh','utf8')
 ]);
 const lastRefresh=Math.max(workflow.indexOf('npm run import:ro-siruta'),workflow.indexOf('npm run import:md-cuatm'),workflow.indexOf('npm run import:osm'));
 const deterministicPhase=workflow.indexOf('scripts/process/run-actual-deterministic-candidate.sh');
 assert.ok(lastRefresh>=0&&deterministicPhase>lastRefresh);
 const buildBundle=runner.indexOf('npm run build:actual-source-bundle');
 const gateBundle=runner.indexOf('npm run audit:actual-source-bundle');
 const osmBuild=runner.indexOf('npm run build:osm-actual');
 const releaseManifest=runner.indexOf('npm run build:actual-release-manifest');
 assert.ok(buildBundle>=0&&gateBundle>buildBundle&&osmBuild>gateBundle);
 assert.ok(releaseManifest>osmBuild);
 assert.match(workflow,/data\/current\/actual-source-bundle-manifest\.json/);
 assert.match(workflow,/data\/current\/actual-source-bundle-gate\.json/);
});
