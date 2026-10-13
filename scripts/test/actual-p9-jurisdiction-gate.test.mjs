import {readFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateP9JurisdictionGate,parseAddedGitDiff} from '../lib/actual-p9-jurisdiction-promotion-gate.mjs';

const policy={schema_version:'actual-p9-jurisdiction-promotion-policy-v1',
 status:'BLOCKED_PENDING_CONTEMPORARY_EVIDENCE',p91_import_allowed:false,
 semantic_acceptance:'BLOCKED_INCOMPLETE',candidate_count:85,
 fully_certified_contemporary_memberships:0,
 require_non_geometric_parent_evidence:true,
 require_exact_osm_snapshot_alignment:true,
 require_explicit_production_gate:true,
 never_modify_md_legal_parent_from_de_facto:true};
const base={entities:[
 {id:'osm-r1216706',jurisdiction:'MD',name:'Cremenciug',
  legal:{id:'0703',registry:'CUATM'},hierarchy:{legal_parent_id:'2700',parent_catalog_id:'osm-r65343'},
  representation:{geometry_role:'current_representation'}},
 {id:'osm-r9581354',jurisdiction:'MD',name:'Municipiul Bender',
  legal:{id:'0500',registry:'CUATM'},hierarchy:{parent_catalog_id:'MD'},representation:{geometry_role:'current_representation'}},
 {id:'osm-r9999',jurisdiction:'RO',name:'sample',legal:{id:'5'}}
]};
const copy=x=>structuredClone(x);
const gate=(after=base,extras={})=>evaluateP9JurisdictionGate({
 policy,baseCatalog:base,candidateCatalog:after,
 changedPaths:[],knownSensitiveIds:['osm-r1216706','osm-r9581354'],...extras
});
test('ordinary unrelated ACTUAL refresh remains eligible for ordinary promotion gates',()=>{
 const changed=copy(base);changed.entities[2].legal.id='6';
 const a=gate(changed,{changedPaths:['data/current/entities.json']});
 assert.equal(a.status,'PASS');assert.equal(a.p91_import_allowed,false);
});
test('new Nistrenia jurisdiction is blocked before an ACTUAL candidate promotion',()=>{
 const changed=copy(base);changed.entities.push({id:'osm-r65335',jurisdiction:'PMR',name:'Nistrenia'});
 const a=gate(changed,{changedPaths:['public/data/actual-entities.json']});
 assert.equal(a.status,'FAIL');assert.ok(a.prohibited_changes.some(x=>x.issue==='new_p9_entity'));
});
test('same ACTUAL MD identifier cannot silently gain de facto administration',()=>{
 const changed=copy(base);changed.entities[0].de_facto_administrative_parent='1702219';
 const a=gate(changed);
 assert.equal(a.status,'FAIL');assert.ok(a.prohibited_changes.some(x=>x.issue==='new_p9_semantic_role'));
});
test('no silent CUATM/legal reparenting of 85 protected MD entities',()=>{
 const changed=copy(base);changed.entities[0].hierarchy.legal_parent_id='1702219';
 const a=gate(changed);
 assert.equal(a.status,'FAIL');assert.ok(a.prohibited_changes.some(x=>x.issue==='sensitive_md_parent_drift'));
});
test('an MD Nistrenia overlay introduced in new sources is blocked even with old catalog',()=>{
 const a=gate(base,{changedPaths:['data/sources/nistrenia-layer.json']});
 assert.equal(a.status,'FAIL');assert.ok(a.prohibited_changes.some(x=>x.issue==='new_p9_publication_path'));
});
test('P9 marker injected into ACTUAL source diff fails closed',()=>{
 const a=gate(base,{changedPaths:['data/current/actual-source-bundle.json'],
  addedLines:[{path:'data/current/actual-source-bundle.json',text:'"source": "relation/65335"'}]});
 assert.equal(a.status,'FAIL');assert.ok(a.prohibited_changes.some(x=>x.issue==='p9_diff_addition'));
});
test('tampered policy cannot authorize P9 by changing only a JSON flag',()=>{
 const a=evaluateP9JurisdictionGate({policy:{...policy,p91_import_allowed:true},baseCatalog:base,candidateCatalog:base,changedPaths:[]});
 assert.equal(a.status,'FAIL');assert.ok(a.policy_failures.some(x=>x.issue==='policy_must_deny_import'));
});
test('diff parser reads only added lines and tracks file paths',()=>{
 const text='diff --git a/data/current/a.json b/data/current/a.json\n--- a/data/current/a.json\n+++ b/data/current/a.json\n@@ -1 +1 @@\n-old\n+"jurisdiction":"PMR"\n';
 assert.deepEqual(parseAddedGitDiff(text),[{path:'data/current/a.json',text:'"jurisdiction":"PMR"'}]);
});
test('candidate ID collision and dropped sensitive identity are rejected',()=>{
 const changed=copy(base);
 changed.entities.push(copy(changed.entities[0]));
 assert.equal(gate(changed).status,'FAIL');
 const removed=copy(base);removed.entities=removed.entities.filter(x=>x.id!=='osm-r1216706');
 assert.ok(gate(removed).prohibited_changes.some(x=>x.issue==='sensitive_md_entity_removed'));
});

test('2025 provider-service cross-check covers all 85 and never asserts territorial control',async()=>{
 const x=JSON.parse(await readFile('docs/p9.0.4.3-2025-service-crosscheck.json','utf8'));
 assert.equal(x.schema_version,'p9043-contemporary-service-evidence-v1');
 assert.equal(x.rows.length,85);
 assert.equal(new Set(x.rows.map(r=>r.actual_id)).size,85);
 const matched=x.rows.filter(r=>r.provider_service_area_name_match_in_same_district).length;
 assert.equal(matched,72);
 assert.equal(x.summary.not_in_same_provider_region,13);
 assert.equal(x.summary.other_district_name_collisions,2);
 assert.ok(x.rows.every(r=>r.service_area_evidence_not_administrative_parent===true&&r.de_facto_control_on_polygon_proven===false));
});
