import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildRoStatisticalLayer,validateRoStatisticalLayer} from './actual-ro-statistical-layer.mjs';

test('P2.1 RO builds exactly 12 new statistical entities and 42 reused NUTS3 memberships',async()=>{
 const layer=await buildRoStatisticalLayer();
 assert.equal(layer.counts.statistical_only_entities,12);
 assert.equal(layer.counts.reused_existing_nuts3_entities,42);
 assert.equal(layer.counts.total_statistical_roles,54);
 assert.ok(layer.statistical_entities.every(x=>[1,2].includes(x.statistical.level)));
 assert.ok(layer.existing_entity_memberships.every(x=>x.roles.includes('administrative')&&x.roles.includes('statistical')));
});

test('P2.1 NUTS3 does not duplicate or modify county geometry',async()=>{
 const layer=await buildRoStatisticalLayer();
 for(const membership of layer.existing_entity_memberships){
  assert.equal(membership.geometry_reuse.source_entity_id,membership.entity_id);
  assert.equal(membership.geometry_reuse.duplicate_geometry,false);
  assert.equal(membership.geometry_reuse.geometry_modified,false);
  assert.equal(membership.geometry_reuse.reuse_existing_master_geometry,true);
 }
 assert.doesNotMatch(JSON.stringify(layer),/"coordinates"\s*:/);
});

test('P2.1 persisted RO layer passes fail-closed gate',async()=>{
 const report=await validateRoStatisticalLayer();
 assert.equal(report.status,'PASS',JSON.stringify(report.failures));
 assert.equal(report.summary.statistical_only_entities,12);
 assert.equal(report.summary.reused_existing_nuts3_entities,42);
 assert.equal(report.summary.geometry_mutations,0);
 assert.equal(report.summary.geometry_duplicates,0);
});

test('P2.1 workflow enforces RO statistical layer',async()=>{
 const workflow=await readFile('.github/workflows/p2-statistical-foundation.yml','utf8');
 assert.match(workflow,/audit-actual-ro-statistical-layer\.mjs/);
 assert.match(workflow,/actual-ro-statistical-layer\.test\.mjs/);
});
