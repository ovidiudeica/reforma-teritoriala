import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const refreshPath='.github/workflows/refresh-ro-official.yml';
const candidatePath='.github/workflows/actual-candidate.yml';
const deterministicRunnerPath='scripts/process/run-actual-deterministic-candidate.sh';

test('RO SIRUTA refresh is routed exclusively through ACTUAL candidate lifecycle',async()=>{
 const [refresh,candidate]=await Promise.all([
  readFile(refreshPath,'utf8'),
  readFile(candidatePath,'utf8')
 ]);
 assert.match(refresh,/uses:\s*\.\/\.github\/workflows\/actual-candidate\.yml/);
 assert.match(refresh,/refresh_ro_siruta:\s*true/);
 assert.match(refresh,/refresh_osm:\s*false/);
 assert.match(refresh,/source_trigger:\s*'ro-siruta-refresh'/);
 assert.doesNotMatch(refresh,/\bgit\s+push\b/);
 assert.doesNotMatch(refresh,/\bgit\s+commit\b/);
 assert.doesNotMatch(refresh,/audit:ro-official-reconciliation/);
 assert.doesNotMatch(refresh,/apply:ro-official-reconciliation/);
 assert.doesNotMatch(refresh,/build:actual-release-manifest/);
 assert.doesNotMatch(refresh,/audit:actual-release-gate/);
 assert.doesNotMatch(refresh,/^\s{2}push:\s*$/m);

 assert.match(candidate,/workflow_call:/);
 assert.match(candidate,/refresh_ro_siruta:/);
 assert.match(candidate,/if:[^\n]*inputs\.refresh_ro_siruta == true/);
 assert.match(candidate,/npm run import:ro-siruta/);
 assert.match(candidate,/--network bridge/);
 assert.match(candidate,/--network none/);
 const refreshIndex=candidate.indexOf('npm run import:ro-siruta');
 const deterministicIndex=candidate.indexOf('scripts/process/run-actual-deterministic-candidate.sh');
 assert.ok(refreshIndex>=0&&deterministicIndex>refreshIndex,'SIRUTA refresh must precede the network-denied deterministic phase');
 const runner=await readFile(deterministicRunnerPath,'utf8');
 const osmBuildIndex=runner.indexOf('npm run build:osm-actual');
 const reconcileIndex=runner.indexOf('npm run audit:ro-official-reconciliation');
 assert.ok(osmBuildIndex>=0&&reconcileIndex>osmBuildIndex,'RO reconciliation must consume the deterministic OSM build');
});

test('reviewed București exceptional-level identity belongs to raw OSM reconciliation stage',async()=>{
 const [catalog,resolutions]=await Promise.all([
  readFile('data/current/entities.json','utf8').then(JSON.parse),
  readFile('data/sources/ro-other-level-reviewed-resolutions.json','utf8').then(JSON.parse)
 ]);
 const resolution=resolutions.items?.find(x=>String(x.legal_id)==='179132');
 assert.ok(resolution,'expected reviewed București SIRUTA 179132 resolution');
 assert.equal(Number(resolution.osm_relation_id),377733);
 assert.equal(resolution.osm_entity_type,'capital_municipality');

 const persisted=catalog.entities?.find(x=>Number(x.osm?.relation_id)===377733);
 assert.ok(persisted,'expected persisted București relation 377733');
 assert.equal(persisted.type,'county');
 assert.equal(persisted.legal?.id,'40');
 assert.notEqual(persisted.type,resolution.osm_entity_type,'post-bridge persisted catalog must not be used as the raw OSM reconciliation input');
});
