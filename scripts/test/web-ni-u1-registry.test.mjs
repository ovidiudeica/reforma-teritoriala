import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const read = async path => readFile(new URL('../../' + path, import.meta.url));
const json = async path => JSON.parse((await read(path)).toString('utf8'));
const model = await json('views/nistrenia/administration.json');
const manifest = await json('views/nistrenia/manifest.json');
const reg = await json('docs/web-ni-u1/ni-u1-0-u1-1-per-id-registry.json');
const map = new Map(model.nodes.map(node => [node.id,node]));
const resources = new Map(model.geometry_resources.map(geom => [geom.canonical_id,geom]));
const rows = new Map(reg.node_to_geometry.map(row => [row.administrative_node_id,row]));
const roles = new Map(reg.geometry_to_administrative_roles.map(row => [row.geometry_id,row]));

test('U1.0 immutable input SHA-256 and protected contracts', async () => {
 const bytes=await read('views/nistrenia/administration.json');
 assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.sha256);
 assert.equal(reg.source_model_manifest_sha256,manifest.sha256);
 assert.equal(reg.guards.ACTUAL_MUTATION_ALLOWED,false);
 assert.equal(reg.guards.P91_IMPORT_ALLOWED,false);
 assert.equal(model.actual_mutation_allowed,false);
 assert.equal(model.p91_import_allowed,false);
 assert.equal(reg.mode,'READ_ONLY');
});

test('U1.0 covers exactly 242 nodes without inventing parents or merging councils', () => {
 assert.equal(map.size,242); assert.equal(rows.size,242);
 const kinds=model.nodes.reduce((o,n)=>(o[n.kind]=(o[n.kind]||0)+1,o),{});
 assert.deepEqual(kinds,{root:1,raion:5,upper_city:4,council:74,place:158});
 for(const node of model.nodes){
  const row=rows.get(node.id);assert.ok(row,'missing '+node.id);
  assert.equal(row.documentary_parent_id,node.parent_id);
  assert.deepEqual(row.documentary_child_ids,node.child_ids);
  assert.deepEqual(row.source_refs,node.source_refs);
  if(node.parent_id)assert.ok(map.has(node.parent_id));
  for(const child of node.child_ids) assert.equal(map.get(child)?.parent_id,node.id);
  let current=node,seen=new Set();
  while(current.parent_id){assert.ok(!seen.has(current.id),'parent cycle');seen.add(current.id);current=map.get(current.parent_id);}
 }
 assert.equal(rows.get('view-nistrenia-unit-15').documentary_parent_id,'view-nistrenia');
 assert.equal(rows.get('view-nistrenia-unit-16').documentary_parent_id,'view-nistrenia');
 assert.ok(reg.exceptions.some(x=>x.type==='TOP_TIER_CLASSIFICATION'));
});

test('U1.1 preserves 93 canonical resources with 85 MD roles and 8 NI outlines', () => {
 assert.equal(resources.size,93);assert.equal(roles.size,93);
 assert.equal([...resources.values()].filter(x=>x.kind==='ACTUAL').length,85);
 assert.equal([...resources.values()].filter(x=>x.kind==='OSM_OUTLINE').length,8);
 assert.equal(Object.keys(model.compatibility_role_aliases).length,85);
 for(const [gid,res] of resources){
  const entry=roles.get(gid);assert.ok(entry,'missing geometry '+gid);
  assert.equal(entry.geometry_id,gid);assert.equal(entry.kind,res.kind);
  assert.equal(entry.osm_relation_id,res.osm_relation_id);
  if(res.kind==='ACTUAL'){
   assert.equal(entry.administrative_roles.filter(x=>x.jurisdiction==='MD'&&x.role==='PRESERVED_ACTUAL_GEOMETRY_ID').length,1);
   assert.equal(entry.administrative_roles.filter(x=>x.jurisdiction==='NI'&&x.role==='OSM_ROLE_REFERENCE').length,1);
  }
 }
});

test('U1.1 never upgrades candidate or nominal MD matches to own polygons', () => {
 assert.equal(reg.node_to_geometry.filter(x=>x.geometry_id).length,8);
 assert.equal(reg.node_to_geometry.filter(x=>!x.geometry_id).length,234);
 assert.equal(reg.node_to_geometry.filter(x=>x.geometry_candidates.length).length,87);
 assert.equal(reg.node_to_geometry.filter(x=>x.nominal_md_candidates.length&&!x.geometry_candidates.length).length,12);
 for(const node of model.nodes){
  const row=rows.get(node.id);
  assert.equal(row.geometry_id,node.geometry_ref ?? null);
  assert.deepEqual(row.geometry_candidates,node.geometry_candidates);
  assert.deepEqual(row.nominal_md_candidates,node.additional_md_name_candidates);
  if(row.geometry_id) assert.equal(resources.get(row.geometry_id)?.kind,'OSM_OUTLINE');
  for(const c of row.geometry_candidates)assert.equal(resources.get(c)?.kind,'ACTUAL');
 }
 for(const x of reg.node_to_geometry.filter(x=>x.source_kind==='council'))assert.equal(x.geometry_id,null);
});

test('U1.1 tracks one unassociated NI role and six multiple candidates', () => {
 const orphan=reg.geometry_to_administrative_roles.filter(x=>x.kind==='ACTUAL'&&!x.ni_candidate_nodes.length).map(x=>x.geometry_id);
 assert.deepEqual(orphan,['osm-r19001619']);
 const multiple=reg.geometry_to_administrative_roles.filter(x=>x.ni_candidate_nodes.length>1);
 assert.equal(multiple.length,6);
 assert.deepEqual(multiple.map(x=>x.geometry_id).sort(),['osm-r7427669','osm-r8290877','osm-r8291058','osm-r9301463','osm-r9659709','osm-r9679382']);
 for(const x of reg.geometry_to_administrative_roles){
  assert.deepEqual(x.ni_candidate_nodes,model.nodes.filter(n=>n.geometry_candidates.includes(x.geometry_id)).map(n=>n.id).sort());
  assert.deepEqual(x.ni_verified_outline_nodes,model.nodes.filter(n=>n.geometry_ref===x.geometry_id).map(n=>n.id).sort());
 }
});

test('U1.0 provenance does not claim recognized NI sovereignty or 2026 certification', () => {
 assert.equal(model.legal_certification,'PENDING');
 assert.equal(reg.legal_status,'NOT_CERTIFIED_CONTEMPORARY');
 assert.equal(reg.reference_year,2023);
 for(const node of model.nodes)assert.equal(rows.get(node.id).contemporary_status,node.contemporary_status);
});
