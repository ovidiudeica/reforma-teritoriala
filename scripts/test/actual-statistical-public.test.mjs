import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('P2.3 activation tooling is wired through the deterministic public builder',async()=>{
 const builder=await readFile('scripts/process/build-actual-public-data.mjs','utf8');
 assert.match(builder,/activateStatisticalPublic/);
});

test('P2.3 public contract schema permits statistical-only IDs and typed hierarchy',async()=>{
 const schema=JSON.parse(await readFile('schemas/actual-public-entity-v3.schema.json','utf8'));
 assert.equal(schema.properties.schema_version.const,3);
 assert.equal(schema.properties.contract.const,'actual-public-entity-v3');
 assert.match(schema.$defs.entity.properties.id.pattern,/stat-/);
 assert.ok(schema.$defs.entity.properties.roles);
 assert.ok(schema.$defs.entity.properties.statistical);
});

test('P2.3 frontend accepts v3 and exposes consolidated hierarchy surface',async()=>{
 const [app,html]=await Promise.all([readFile('app.js','utf8'),readFile('index.html','utf8')]);
 assert.match(app,/actual-public-entity-v3/);
 assert.match(app,/actual-consolidated-hierarchy-v1/);
 assert.match(app,/loadHierarchyTree/);
 assert.match(html,/id="hierarchy-tree"/);
});
