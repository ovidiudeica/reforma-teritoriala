import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createNistreniaAdministrativeView,nistreniaSearchEntities} from '../../atlas-nistrenia-jurisdiction.mjs';
import {jurisdictionAllowsCanonicalGeometry} from '../../atlas-ni-jurisdiction-visibility.mjs';
import {compactTreeName} from '../../atlas-tree-labels.mjs';
import {createUrlConfig,normalizeUrlState,parseUrlState,serializeUrlState} from '../../atlas-url-state.mjs';
import {createGeometryFilterIndex} from '../../geometry-taxonomy.mjs';

const read=p=>JSON.parse(readFileSync(new URL('../../'+p,import.meta.url),'utf8'));
const model=read('views/nistrenia/administration.json'),entities=read('public/data/actual-entities.json').entities;
const tree=read('public/data/actual-consolidated-tree.json');
const officialNodes=new Map(tree.nodes.map(x=>[x.id,x])),entityById=new Map(entities.map(x=>[x.id,x]));
const view=createNistreniaAdministrativeView({model,entityById,officialNodes,officialRoots:tree.root_ids});

test('U1.4 exposes all 85 MD canonical NI roles directly in a non-administrative navigation branch',()=>{
 assert.equal(view.virtualIds.size,242);
 assert.equal(view.geometryNavigationIds.size,86);
 assert.equal(view.toActual.size,85);
 assert.equal(view.root.child_ids.length,9);
 assert.equal(view.navigationRoot.child_ids.length,10);
 assert.deepEqual(view.root.child_ids,model.nodes.find(n=>n.id==='view-nistrenia').child_ids);
 assert.equal(view.nodes.get('view-nistrenia'),view.navigationRoot);
 assert.deepEqual(view.navigationRoot.child_ids,[...view.root.child_ids,view.cartographicNavigationId]);
 assert.ok(!view.virtualIds.has(view.cartographicNavigationId));
 assert.equal(view.groupIds.length,9);
 const nav=view.nodes.get(view.cartographicNavigationId);
 assert.equal(nav.kind,'geometry_navigation');
 assert.equal(nav.roles[0],'navigation_only');
 assert.equal(nav.child_ids.length,85);
 assert.equal(new Set(nav.child_ids.map(id=>view.toActual.get(id))).size,85);
 for(const id of nav.child_ids){
  const alias=view.nodes.get(id),canonical=view.toActual.get(id);
  assert.equal(alias.kind,'geometry_reference');
  assert.equal(alias.parent_id,view.cartographicNavigationId);
  assert.equal(alias.geometry_canonical_id,canonical);
  assert.equal(alias.source_actual_id,canonical);
  assert.equal(alias.geometry_ref,null);
  assert.equal(alias.geometry_candidates.length,0);
  assert.ok(view.isVirtual(id));
  assert.equal(view.actualId(id),canonical);
  assert.ok(view.roleIds.has(canonical));
  assert.equal(compactTreeName(alias),compactTreeName(officialNodes.get(canonical)));
 }
 assert.equal(officialNodes.size,5848);
 assert.deepEqual(model.nodes.find(x=>x.id==='view-nistrenia').child_ids.length,9);
 assert.equal(nistreniaSearchEntities(view,entityById).length,242+86);
});

test('U1.4 MD geometry remains visible from whichever perspective is enabled',()=>{
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

test('U1.4 checkbox identity is the same ID in MD tree and NI navigation',()=>{
 const state=new Set(),niAlias=[...view.toActual.keys()][0],id=view.toActual.get(niAlias);
 state.add(id);
 assert.equal(state.has(view.actualId(niAlias)),true);
 state.delete(view.actualId(niAlias));
 assert.equal(state.has(id),false);
 assert.notEqual(niAlias,id);
 assert.equal(view.nodes.get(niAlias).geometry_ref,null);
});

test('U1.4 URL recognizes navigational NI role without adding an artificial checked ID',()=>{
 const ids=[...view.geometryNavigationIds,...view.virtualIds];
 const config=createUrlConfig({entityById,nodeById:view.nodes,rootIds:tree.root_ids,treeRootIds:view.rootIds,virtualEntityIds:ids,
  operationalOutlineIds:model.nodes.filter(x=>x.geometry_ref).map(x=>x.geometry_ref),filterIndex:createGeometryFilterIndex(entities)});
 const alias=[...view.toActual.keys()][0],id=view.toActual.get(alias);
 const state=normalizeUrlState({entityId:alias,visibleEntityIds:[...tree.root_ids,id,alias],jurisdictions:['RO','NI']},config);
 assert.equal(state.entityId,alias);
 assert.ok(state.visibleEntityIds.includes(id));
 assert.ok(!state.visibleEntityIds.includes(alias));
 assert.equal(parseUrlState('?'+serializeUrlState(state,config),config).entityId,alias);
});
