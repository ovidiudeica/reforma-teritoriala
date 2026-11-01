import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compactNistreniaDocumentaryName,compactTreeName,nistreniaTreeContext} from '../../atlas-tree-labels.mjs';
import {createNistreniaAdministrativeView} from '../../atlas-nistrenia-jurisdiction.mjs';

const get=p=>JSON.parse(readFileSync(new URL('../../'+p,import.meta.url),'utf8'));
const m=get('views/nistrenia/administration.json'),actual=get('public/data/actual-entities.json').entities,tree=get('public/data/actual-consolidated-tree.json');
const entities=new Map(actual.map(e=>[e.id,e])),official=new Map(tree.nodes.map(n=>[n.id,n]));
const view=createNistreniaAdministrativeView({model:m,entityById:entities,officialNodes:official,officialRoots:tree.root_ids});

test('U1.3 removes only visual suffixes, never mutates NI-FIN originals',()=>{
 assert.equal(compactNistreniaDocumentaryName(m.nodes.find(n=>n.id==='view-nistrenia-unit-15')),'Dubăsari');
 assert.equal(compactNistreniaDocumentaryName(m.nodes.find(n=>n.id==='view-nistrenia-unit-16')),'Rîbnița');
 assert.equal(m.nodes.find(n=>n.id==='view-nistrenia-unit-15').display_name,'Dubăsari — oraș');
 assert.equal(view.nodes.get('view-nistrenia-group-osm-r1702215').display_name,'Dubăsari');
 assert.equal(view.nodes.get('view-nistrenia-unit-15').display_name,'Dubăsari');
 assert.equal(view.nodes.get('view-nistrenia-unit-16').display_name,'Rîbnița');
 assert.equal(view.nodes.get('view-nistrenia-group-osm-r1702217').display_name,'Rîbnița');
 for(const n of m.nodes){
  const v=view.nodes.get(n.id);
  assert.equal(v.kind,n.kind);
  const relocated={ 'view-nistrenia-unit-15':'view-nistrenia-group-osm-r1702215','view-nistrenia-unit-16':'view-nistrenia-group-osm-r1702217'};
  assert.equal(v.parent_id,relocated[n.id]||n.parent_id);
  const expectedChildren=n.id==='view-nistrenia'
   ?n.child_ids.filter(id=>!Object.hasOwn(relocated,id))
   :n.id==='view-nistrenia-group-osm-r1702215'?[...n.child_ids,'view-nistrenia-unit-15']
   :n.id==='view-nistrenia-group-osm-r1702217'?[...n.child_ids,'view-nistrenia-unit-16']
   :n.child_ids;
  // NI-TREE.1: only those two presentation edges change; original documentary
  // indices, identities, geometry and all other edges remain unchanged.
  const extra= n.id==='view-nistrenia-group-osm-r1702215'?'view-nistrenia-role-osm-r19001619':null;
  assert.deepEqual(v.child_ids,extra?[...expectedChildren,extra]:expectedChildren);
  if(view.documentaryNodes)assert.deepEqual(view.documentaryNodes.get(n.id).child_ids,n.child_ids);
  assert.equal(v.geometry_ref,n.geometry_ref);
  assert.ok(!/\((?:raion|oraș)\)$/iu.test(v.display_name));
  if(n.kind==='council')assert.ok(v.display_name.startsWith('Consiliul sătesc '));
 }
});

test('U1.3 leaves RO/MD labels and all verified geometry references unchanged',()=>{
 for(const [id,node] of official)assert.equal(view.nodes.get(id),node);
 for(const n of m.nodes.filter(n=>n.geometry_ref))assert.equal(view.nodes.get(n.id).geometry_ref,n.geometry_ref);
 assert.equal(view.virtualIds.size,243);
 assert.equal(compactTreeName({id:'test',jurisdiction:'RO',display_name:'Județul Cluj'}),'Cluj');
});

test('U1.3 preserves authentic non-city names and exposes homonym context',()=>{
 for(const kind of ['place','council','raion'])assert.equal(compactNistreniaDocumentaryName({kind,display_name:'Nume — oraș'}),'Nume — oraș');
 assert.equal(compactNistreniaDocumentaryName({kind:'upper_city',display_name:'Orașul nou'}),'Orașul nou');
 for(const id of ['view-nistrenia-unit-15','view-nistrenia-unit-16'])assert.match(nistreniaTreeContext(view.nodes.get(id)),/^Oraș enumerat distinct/);
 for(const id of ['view-nistrenia-group-osm-r1702215','view-nistrenia-group-osm-r1702217'])assert.match(nistreniaTreeContext(view.nodes.get(id)),/^Raion/);
 assert.equal(nistreniaTreeContext({jurisdiction:'MD',kind:'upper_city'}),null);
});
