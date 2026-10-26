import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createNistreniaAdministrativeView} from '../../atlas-nistrenia-jurisdiction.mjs';
import {nistreniaPerspectiveForGeometry} from '../../atlas-nistrenia-unified-card.mjs';

const json=path=>JSON.parse(readFileSync(new URL('../../'+path,import.meta.url),'utf8'));
const model=json('views/nistrenia/administration.json');
const entities=json('public/data/actual-entities.json').entities;
const tree=json('public/data/actual-consolidated-tree.json');
const entityById=new Map(entities.map(e=>[e.id,e]));
const officialNodes=new Map(tree.nodes.map(n=>[n.id,n]));
const officialSnapshot=JSON.stringify([...officialNodes]);
const view=createNistreniaAdministrativeView({model,entityById,officialNodes,officialRoots:tree.root_ids});

test('WEB-NI-U1.2 exposes exactly 85 NI perspectives on canonical ACTUAL IDs',()=>{
 const count=[...entityById.keys()].filter(id=>nistreniaPerspectiveForGeometry(view,id)!==null);
 assert.equal(count.length,85);
 assert.equal(new Set(count).size,85);
 for(const id of count){
  const entry=nistreniaPerspectiveForGeometry(view,id);
  assert.equal(entry.canonical_id,id);
  assert.equal(entry.source_kind,'ACTUAL');
  assert.equal(entry.md_official_identity_changed,false);
  assert.equal(entry.full_polygon_control_certified,false);
  assert.equal(entry.contemporary_legal_certification,'PENDING');
  assert.ok(Number.isInteger(entry.osm_relation_id)&&entry.osm_relation_id>0);
  assert.equal(entry.source_year,2023);
 }
 assert.equal(JSON.stringify([...officialNodes]),officialSnapshot);
});

test('WEB-NI-U1.2 distinguishes candidate documentary nodes from certified identity',()=>{
 const rows=[...view.roleIds].map(id=>nistreniaPerspectiveForGeometry(view,id));
 assert.equal(rows.filter(x=>x.no_documentary_candidate).length,1);
 assert.equal(rows.find(x=>x.no_documentary_candidate).canonical_id,'osm-r19001619');
 assert.equal(rows.filter(x=>x.associated_documentary_nodes.length>1).length,6);
 for(const row of rows)for(const node of row.associated_documentary_nodes){
  assert.equal(node.geometry_association,'CANDIDATE_NOT_CERTIFIED');
  assert.equal(node.legal_certification,'PENDING');
  assert.equal(node.reference_year,2023);
  assert.notEqual(view.nodes.get(node.node_id).geometry_ref,row.canonical_id);
 }
});

test('WEB-NI-U1.2 never adds a Moldova section to eight exclusive NI outlines',()=>{
 for(const row of model.geometry_resources.filter(x=>x.kind==='OSM_OUTLINE')){
  assert.equal(nistreniaPerspectiveForGeometry(view,row.canonical_id),null);
  assert.ok(view.resources.has(row.canonical_id));
 }
});
