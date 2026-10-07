import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('P2.3 activation request is explicit and release-bound',async()=>{
 const p=JSON.parse(await readFile('data/sources/actual-statistical-policy.json','utf8'));
 assert.equal(p.phase,'P2_3_READY');
 assert.equal(p.activated,false);
 assert.equal(p.activation_requested,true);
 assert.equal(p.activation_authority,'data/current/actual-statistical-activation.json');
 assert.equal(p.target_public_contract,'actual-public-entity-v3');
 assert.equal(p.progress.P2_3_PUBLIC.target_public_entity_count,5848);
});

test('v3 schema fixes consolidated public cardinality and statistical IDs',async()=>{
 const s=JSON.parse(await readFile('schemas/actual-public-entity-v3.schema.json','utf8'));
 assert.equal(s.properties.schema_version.const,3);
 assert.equal(s.properties.contract.const,'actual-public-entity-v3');
 assert.equal(s.properties.entity_count.const,5848);
 assert.match(s.$defs.entity.properties.id.pattern,/stat-/);
 assert.equal(s.properties.hierarchy_tree.properties.node_count.const,5848);
});

test('base builder invokes release-bound statistical activator',async()=>{
 const build=await readFile('scripts/process/build-actual-public-data.mjs','utf8');
 assert.match(build,/activateStatisticalPublicContract/);
 const apply=await readFile('scripts/process/apply-actual-geometry-policy-v1-1.mjs','utf8');
 assert.match(apply,/actual-public-entity-v3/);
});
