import fs from 'node:fs';
import assert from 'node:assert/strict';
const p='docs/audits/rt-adm2-5/osmb-cartographic-closure.json';
const d=JSON.parse(fs.readFileSync(p,'utf8'));
assert.equal(d.schema,'rt-adm2-5-osmb-cartographic-closure-v1');
assert.equal(d.cases.length,3);
assert.deepEqual(d.cases.map(x=>x.id).sort(),['osm-r12104636','osm-r18967570','osm-r18968043'].sort());
assert.equal(new Set(d.cases.flatMap(x=>x.way_ids)).size,4);
for(const c of d.cases){
 assert.equal(c.cartographic_decision,'ACCEPT_EXISTING_OSMB_REPRESENTATION_AS_IS');
 assert.equal(c.issue_closure,'CARTOGRAPHIC_ONLY');
 assert.equal(c.semantic_status.endsWith('UNRESOLVED'),true);
 for(const key of ['legal_boundary_equivalence_certified','legal_identity_and_parentage_changed','geometry_edit_authorized','cuatm_binding_edit_authorized','administrative_reparent_authorized'])assert.equal(c[key],false,key);
 assert.equal(c.remaining_gate,'NO_CHANGE_PENDING_PRIMARY_EVIDENCE');
}
for(const v of Object.values(d.global_invariants))assert.equal(v,true);
assert.equal(d.osmb_snapshot_sha256_certified_this_step,false);
assert.equal(d.osmb_geometries_reimported,false);
console.log('RT-ADM.2.5 PASS: 3 cartographic decisions, 4 way references, zero administrative edits');
