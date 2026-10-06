import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildMdStatisticalLayer,validateMdStatisticalLayer} from './actual-md-statistical-layer.mjs';

test('P2.2 MD builds 6 new entities, reuses 3 and binds 37 CUATM components',async()=>{
 const layer=await buildMdStatisticalLayer();
 assert.deepEqual(layer.counts,{statistical_only_entities:6,reused_existing_statistical_entities:3,total_statistical_roles:9,component_bindings:37});
 assert.deepEqual(layer.statistical_entities.map(x=>x.statistical.code).sort(),['MD11','MD12','MD111','MD112','MD113','MD120'].sort());
 assert.deepEqual(layer.existing_entity_statistical_roles.map(x=>x.statistical.code).sort(),['MD1','MD114','MD115'].sort());
});

test('P2.2 keeps MD120 official and never promotes OSM MD121 to identity',async()=>{
 const layer=await buildMdStatisticalLayer();
 const md120=layer.statistical_entities.find(x=>x.statistical.code==='MD120');
 assert.equal(md120.statistical.identity_authority,'Biroul Național de Statistică al Republicii Moldova');
 assert.equal(md120.representation.osm_statistical_ref,'MD121');
 assert.equal(md120.representation.osm_ref_is_identity_authority,false);
 assert.equal([...layer.statistical_entities,...layer.existing_entity_statistical_roles].some(x=>x.statistical.code==='MD121'),false);
});

test('P2.2 reuses administrative geometry without duplication or mutation',async()=>{
 const layer=await buildMdStatisticalLayer();
 for(const role of layer.existing_entity_statistical_roles){
  assert.equal(role.geometry_reuse.source_entity_id,role.entity_id);
  assert.equal(role.geometry_reuse.duplicate_geometry,false);
  assert.equal(role.geometry_reuse.geometry_modified,false);
 }
 assert.doesNotMatch(JSON.stringify(layer),/"coordinates"\s*:/);
});

test('P2.2 persisted MD layer passes fail-closed gate',async()=>{
 const report=await validateMdStatisticalLayer();
 assert.equal(report.status,'PASS',JSON.stringify(report.failures));
 assert.equal(report.summary.statistical_only_entities,6);
 assert.equal(report.summary.reused_existing_statistical_entities,3);
 assert.equal(report.summary.component_bindings,37);
 assert.equal(report.summary.md121_identity_count,0);
});

test('P2 workflow enforces Moldova statistical layer',async()=>{
 const workflow=await readFile('.github/workflows/p2-statistical-foundation.yml','utf8');
 assert.match(workflow,/audit-actual-md-statistical-layer\.mjs/);
 assert.match(workflow,/actual-md-statistical-layer\.test\.mjs/);
});
