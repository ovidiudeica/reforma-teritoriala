import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildNistreniaUnifiedTree,NI_TREE1_EXPLICIT_ASSOCIATIONS,NI_TREE1_LUNGA} from '../../atlas-ni-tree1.mjs';
import {validateNistreniaAdministrativeModel} from '../../atlas-nistrenia-administrative.mjs';
import {createNistreniaAdministrativeView} from '../../atlas-nistrenia-jurisdiction.mjs';
import {ancestorPath} from '../../atlas-tree.mjs';
const read=p=>JSON.parse(readFileSync(new URL('../../'+p,import.meta.url),'utf8'));
const model=read('views/nistrenia/administration.json');
const sourceBytes=readFileSync(new URL('../../views/nistrenia/administration.json',import.meta.url));
const checked=validateNistreniaAdministrativeModel(model);
const tree=read('public/data/actual-consolidated-tree.json');
const actual=read('public/data/actual-entities.json').entities;
const officialNodes=new Map(tree.nodes.map(n=>[n.id,n]));
const entityById=new Map(actual.map(n=>[n.id,n]));
const originalParentIds=new Map(model.nodes.map(n=>[n.id,n.parent_id]));
const unified=buildNistreniaUnifiedTree(model,checked);
const view=createNistreniaAdministrativeView({model,entityById,officialNodes,officialRoots:tree.root_ids});

test('NI-TREE.1 exposes exactly seven top-level UI branches without changing protected source model',()=>{
 assert.equal(model.nodes.length,242);
 assert.equal(checked.root.child_ids.length,9,'2023 documentary original is unchanged');
 assert.equal(view.root.child_ids.length,7);
 assert.equal(view.groupIds.length,7);
 assert.equal(view.virtualIds.size,243);
 assert.equal(view.nodes.size,5848+243);
 assert.deepEqual(view.root.child_ids,[
  'view-nistrenia-group-osm-r1702216',
  'view-nistrenia-group-osm-r1702217',
  'view-nistrenia-group-osm-r1702215',
  'view-nistrenia-group-osm-r1702214',
  'view-nistrenia-group-osm-r1702218',
  'view-nistrenia-group-osm-r1702219',
  'view-nistrenia-group-osm-r944727'
 ]);
 assert.equal(view.nodes.get('view-nistrenia-unit-15').parent_id,'view-nistrenia-group-osm-r1702215');
 assert.equal(view.nodes.get('view-nistrenia-unit-16').parent_id,'view-nistrenia-group-osm-r1702217');
 for(const [id,parent] of originalParentIds)assert.equal(model.nodes.find(n=>n.id===id).parent_id,parent);
 assert.deepEqual(readFileSync(new URL('../../views/nistrenia/administration.json',import.meta.url)),sourceBytes);
 assert.equal(view.nodes.has('view-nistrenia-cartographic-navigation'),false);
 for(const id of view.virtualIds)assert.equal(ancestorPath(view.nodes,view.rootIds,id)[0],'view-nistrenia');
});
test('NI-TREE.1 binds all 85 canonical shared geometries once, without duplicate navigation aliases or new polygons',()=>{
 assert.equal(view.roleIds.size,85);
 assert.equal(view.associationByResource.size,85);
 assert.equal(view.geometryByNode.size,84,'Bender has two OSM roles, one documentary identity');
 assert.equal([...view.geometryByNode.values()].flat().length,85);
 assert.equal(view.geometryNavigationIds.size,1);
 assert.equal(view.toActual.size,1);
 assert.equal(view.toActual.get(NI_TREE1_LUNGA),'osm-r19001619');
 assert.equal(view.root.child_ids.includes(NI_TREE1_LUNGA),false);
 assert.equal(view.geometryByNode.has('view-nistrenia'),false,'root card must not aggregate descendants');
 for(const [id,association] of view.associationByResource){
  const node=view.nodes.get(association.nodeId);
  assert(node,'missing mapped NI node '+id);
  assert.equal(association.legalBoundaryEquivalent,false);
  assert(view.roleIds.has(id));
  assert.equal(view.mappedGeometryToNode.get(id),node.id);
  assert(entityById.has(id),'new geometry must not be invented '+id);
 }
 assert.deepEqual(new Set([...view.associationByResource.keys()].filter(id=>view.associationByResource.get(id).evidence!=='UNIQUE_NAME_IN_OSM_GEOMETRIC_GROUP')),new Set(Object.keys(NI_TREE1_EXPLICIT_ASSOCIATIONS)));
 assert.equal(view.associationByResource.get('osm-r1216706').evidence,'DOCUMENTARY_OSM_PARENT_CONFLICT');
 assert.equal(view.nodes.get(NI_TREE1_LUNGA).kind,'geometry_reference');
 assert.equal(view.nodes.get(NI_TREE1_LUNGA).parent_id,'view-nistrenia-group-osm-r1702215');
 assert.equal(view.nodes.get(NI_TREE1_LUNGA).administrative_status,'OSM_REFERENCE_ONLY');
});
test('NI-TREE.1 preserves one geometry toggle per known node and canonical MD visibility IDs',()=>{
 for(const [node,ids] of view.geometryByNode){
  assert.deepEqual(ids.map(id=>view.mappedGeometryToNode.get(id)),ids.map(()=>node));
  assert.equal(view.primaryGeometryForNode(node),ids.length===1?ids[0]:null);
 }
 assert.equal(view.primaryGeometryForNode('view-nistrenia-group-osm-r944727'),null,'Bender has two distinct references on its own card');
 assert.equal(view.primaryGeometryForNode('view-nistrenia-place-110'),'osm-r19015110');
 assert.equal(view.primaryGeometryForNode('view-nistrenia-place-218'),'osm-r8289751');
 assert.equal(view.primaryGeometryForNode('view-nistrenia-place-24'),'osm-r9301464');
 assert.equal(view.primaryGeometryForNode('view-nistrenia-unit-15'),'osm-r9288287');
 assert.equal(view.primaryGeometryForNode('view-nistrenia-unit-16'),'osm-r9659979');
 assert.equal(view.primaryGeometryForNode('view-nistrenia-group-osm-r1702215'),null);
 assert.equal(view.primaryGeometryForNode('view-nistrenia-group-osm-r1702217'),null);
 assert.equal(view.primaryGeometryForNode('view-nistrenia'),null);
 assert.equal(officialNodes.size,5848);
 assert.deepEqual([...tree.root_ids].sort(),['osm-r58974','osm-r90689'].sort());
});
