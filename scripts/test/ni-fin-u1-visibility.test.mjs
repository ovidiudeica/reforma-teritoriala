import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createNistreniaAdministrativeView,nistreniaSearchEntities} from '../../atlas-nistrenia-jurisdiction.mjs';
import {jurisdictionAllowsCanonicalGeometry} from '../../atlas-ni-jurisdiction-visibility.mjs';
import {createUrlConfig,normalizeUrlState,parseUrlState,serializeUrlState} from '../../atlas-url-state.mjs';
import {createGeometryFilterIndex} from '../../geometry-taxonomy.mjs';

const read=p=>JSON.parse(readFileSync(new URL('../../'+p,import.meta.url),'utf8'));
const model=read('views/nistrenia/administration.json'),entities=read('public/data/actual-entities.json').entities;
const tree=read('public/data/actual-consolidated-tree.json');
const officialNodes=new Map(tree.nodes.map(x=>[x.id,x])),entityById=new Map(entities.map(x=>[x.id,x]));
const view=createNistreniaAdministrativeView({model,entityById,officialNodes,officialRoots:tree.root_ids});

test('NI-TREE.1 has seven administrative first-level branches and 85 associated canonical geometries without navigation catalogue',()=>{
 assert.equal(view.virtualIds.size,243);
 assert.equal(view.geometryNavigationIds.size,1,'only documentary-unmatched Lunga is reference-only');
 assert.equal(view.toActual.size,1);
 assert.equal(view.root.child_ids.length,7);
 assert.equal(view.navigationRoot.child_ids.length,7);
 assert.equal(view.nodes.get('view-nistrenia'),view.navigationRoot);
 assert.equal(view.cartographicNavigationId,null);
 assert.equal(view.groupIds.length,7);
 assert.equal(view.nodes.has('view-nistrenia-cartographic-navigation'),false);
 assert.equal(view.roleIds.size,85);
 assert.equal(view.associationByResource.size,85);
 assert.equal([...view.geometryByNode.values()].flat().length,85);
 assert.equal(view.geometryByNode.get('view-nistrenia')?.length??0,0);
 assert.equal(view.nodes.get('view-nistrenia-unit-15').parent_id,'view-nistrenia-group-osm-r1702215');
 assert.equal(view.nodes.get('view-nistrenia-unit-16').parent_id,'view-nistrenia-group-osm-r1702217');
 assert.equal(view.nodes.get('view-nistrenia-role-osm-r19001619').parent_id,'view-nistrenia-group-osm-r1702215');
 assert.equal(nistreniaSearchEntities(view,entityById).length,243);
 assert.equal(officialNodes.size,5848);
 assert.equal(model.nodes.find(x=>x.id==='view-nistrenia').child_ids.length,9,'original 2023 evidence must stay untouched');
});

test('U1.4 shared MD geometry remains visible through either jurisdiction perspective',()=>{
 const id=[...view.roleIds][0],shared=entityById.get(id),other=[...entityById.values()].find(x=>x.jurisdiction==='MD'&&!view.roleIds.has(x.id));
 assert.ok(shared&&other);
 const permitted=(entity,active)=>jurisdictionAllowsCanonicalGeometry(entity,{isChecked:j=>active.has(j),isSharedNiGeometry:x=>view.roleIds.has(x)});
 assert.equal(permitted(shared,new Set(['MD'])),true);
 assert.equal(permitted(shared,new Set(['NI'])),true);
 assert.equal(permitted(shared,new Set(['MD','NI'])),true);
 assert.equal(permitted(shared,new Set()),false);
 assert.equal(permitted(other,new Set(['NI'])),false);
 assert.equal(permitted(other,new Set(['MD'])),true);
 assert.equal(permitted({...shared,jurisdiction:'RO'},new Set(['NI'])),false);
});

test('NI-TREE.1 documentary checkbox and official MD checkbox reference exactly one canonical geometry ID',()=>{
 const id='osm-r19015110',nodeId=view.mappedGeometryToNode.get(id),state=new Set();
 assert.equal(nodeId,'view-nistrenia-place-110');
 assert.equal(view.primaryGeometryForNode(nodeId),id);
 state.add(id);
 assert.equal(state.has(view.primaryGeometryForNode(nodeId)),true);
 state.delete(view.primaryGeometryForNode(nodeId));
 assert.equal(state.has(id),false);
 assert.notEqual(nodeId,id);
 assert.equal(view.nodes.get(nodeId).geometry_ref,null,'OSM reference is not falsely promoted into a certified outline');
});

test('NI-TREE.1 URL retains Lunga unverified reference leaf without adding synthetic canonical checked IDs',()=>{
 const config=createUrlConfig({entityById,nodeById:view.nodes,rootIds:tree.root_ids,treeRootIds:view.rootIds,
  virtualEntityIds:[...view.virtualIds],operationalOutlineIds:model.nodes.filter(x=>x.geometry_ref).map(x=>x.geometry_ref),
  filterIndex:createGeometryFilterIndex(entities)});
 const alias='view-nistrenia-role-osm-r19001619',id=view.toActual.get(alias);
 assert.equal(id,'osm-r19001619');
 const state=normalizeUrlState({entityId:alias,visibleEntityIds:[...tree.root_ids,id,alias],jurisdictions:['RO','NI']},config);
 assert.equal(state.entityId,alias);
 assert.ok(state.visibleEntityIds.includes(id));
 assert.ok(!state.visibleEntityIds.includes(alias));
 assert.equal(parseUrlState('?'+serializeUrlState(state,config),config).entityId,alias);
});
