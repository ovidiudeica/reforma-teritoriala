import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createNistreniaAdministrativeView,nistreniaSearchEntities} from '../../atlas-nistrenia-jurisdiction.mjs';
import {createUrlConfig,normalizeUrlState,serializeUrlState,parseUrlState} from '../../atlas-url-state.mjs';
import {createGeometryFilterIndex} from '../../geometry-taxonomy.mjs';
import {ancestorPath} from '../../atlas-tree.mjs';
const read=p=>JSON.parse(readFileSync(new URL('../../'+p,import.meta.url),'utf8'));
const model=read('views/nistrenia/administration.json'),actual=read('public/data/actual-entities.json').entities,tree=read('public/data/actual-consolidated-tree.json');
const entityById=new Map(actual.map(e=>[e.id,e])),officialNodes=new Map(tree.nodes.map(n=>[n.id,n]));
const before=JSON.stringify([...officialNodes]);
const view=createNistreniaAdministrativeView({model,entityById,officialNodes,officialRoots:tree.root_ids});
test('242 documentary nodes are reciprocal/reachable without modifying 5848 official nodes',()=>{
 assert.equal(view.nodes.size,5848+242);assert.equal(view.groupIds.length,9);assert.equal(view.roleIds.size,85);
 for(const id of view.virtualIds)assert.equal(ancestorPath(view.nodes,view.rootIds,id)[0],'view-nistrenia');
 assert.equal(JSON.stringify([...officialNodes]),before);
});
test('all documentary nodes are searchable and city/raion labels remain distinct',()=>{
 const rows=nistreniaSearchEntities(view,entityById);assert.equal(rows.length,242);assert.equal(new Set(rows.map(x=>x.id)).size,242);
 assert.equal(view.nodes.get('view-nistrenia-unit-15').display_name,'Dubăsari');
 assert.equal(view.nodes.get('view-nistrenia-group-osm-r1702215').display_name,'Dubăsari');
 assert.equal(view.nodes.get('view-nistrenia-unit-16').display_name,'Rîbnița');
 assert.equal(view.nodes.get('view-nistrenia-group-osm-r1702217').display_name,'Rîbnița');
 assert.notEqual(view.nodes.get('view-nistrenia-unit-15').id,view.nodes.get('view-nistrenia-group-osm-r1702215').id);
 assert.notEqual(view.nodes.get('view-nistrenia-unit-16').kind,view.nodes.get('view-nistrenia-group-osm-r1702217').kind);
 assert.equal(model.nodes.find(x=>x.id==='view-nistrenia-unit-15').display_name,'Dubăsari — oraș');
});
test('URL selects a documentary council but cannot turn it into checked geometry',()=>{
 const config=createUrlConfig({entityById,nodeById:view.nodes,rootIds:tree.root_ids,treeRootIds:view.rootIds,virtualEntityIds:view.virtualIds,operationalOutlineIds:model.nodes.filter(n=>n.geometry_ref).map(n=>n.geometry_ref),filterIndex:createGeometryFilterIndex(actual)});
 const id='view-nistrenia-council-29',state=normalizeUrlState({entityId:id,visibleEntityIds:[...tree.root_ids,id]},config);
 assert.equal(state.entityId,id);assert.deepEqual(state.visibleEntityIds,[...tree.root_ids].sort());
 assert.equal(parseUrlState('?'+serializeUrlState(state,config),config).entityId,id);
 assert.equal(normalizeUrlState({entityId:'view-nistrenia-invented'},config).entityId,null);
});
