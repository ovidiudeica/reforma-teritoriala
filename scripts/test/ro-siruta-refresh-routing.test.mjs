import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const refreshPath='.github/workflows/refresh-ro-official.yml';
const candidatePath='.github/workflows/actual-candidate.yml';

test('RO SIRUTA refresh is routed exclusively through ACTUAL candidate lifecycle',async()=>{
 const [refresh,candidate]=await Promise.all([
  readFile(refreshPath,'utf8'),
  readFile(candidatePath,'utf8')
 ]);
 assert.match(refresh,/uses:\s*\.\/\.github\/workflows\/actual-candidate\.yml/);
 assert.match(refresh,/refresh_ro_siruta:\s*true/);
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
 assert.match(candidate,/if:\s*inputs\.refresh_ro_siruta == true/);
 assert.match(candidate,/npm run import:ro-siruta/);
 const refreshIndex=candidate.indexOf('npm run import:ro-siruta');
 const osmRefreshIndex=candidate.indexOf('npm run import:osm');
 const osmBuildIndex=candidate.indexOf('npm run build:osm-actual');
 const reconcileIndex=candidate.indexOf('npm run audit:ro-official-reconciliation');
 assert.ok(refreshIndex>=0&&osmRefreshIndex>refreshIndex&&osmBuildIndex>osmRefreshIndex&&reconcileIndex>osmBuildIndex,'SIRUTA refresh must precede OSM source refresh, deterministic OSM build and RO reconciliation');
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
