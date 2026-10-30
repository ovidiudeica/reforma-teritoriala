#!/usr/bin/env node
// RT-ADM.2.1 read-only evidence guard: no semantic uplift from role evidence to footprint.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>JSON.parse(readFileSync(path.join(root,p),'utf8'));
const v=read('docs/audits/rt-adm2-1/individual-evidence-register.json');
const parent=read('docs/audits/rt-adm2/identity-decision-register.json');
assert.equal(v.schema,'rt-adm2-1-individual-primary-evidence-v1');
assert.equal(v.audit,'RT-ADM.2.1');
assert.equal(v.cases.length,14);
assert.equal(parent.records.length,14);
assert.equal(new Set(v.cases.map(x=>x.id)).size,14);
assert.deepEqual(v.cases.map(x=>x.id),parent.records.map(x=>x.id));
assert.equal(v.counts.md,3);
assert.equal(v.counts.ro,11);
assert.equal(v.counts.total,14);
assert.equal(v.counts.certified_osm_boundaries,0);
assert.equal(v.counts.proven_administrative_edits,0);
assert.equal(v.counts.protected_no_change,14);
assert.equal(v.counts.substantive_exceptions_open,14);
for(let i=0;i<14;i++){
 const x=v.cases[i],p=parent.records[i];
 assert.equal(x.jurisdiction,p.jurisdiction,x.id);
 assert.equal(x.existing_parent_id,p.parent_id,x.id);
 assert.equal(x.name,p.name,x.id);
 assert.equal(x.decision,'NO_CHANGE_PENDING_PRIMARY_EVIDENCE',x.id);
 assert.equal(x.record_closure,'EVIDENTIARY_REVIEW_COMPLETE_OPEN_SUBSTANTIVE_EXCEPTION',x.id);
 assert.equal(x.allow_automatic_edit,false,x.id);
 assert.equal(x.positive_osm_identity_independently_certified,false,x.id);
 assert.equal(x.authoritative_osm_footprint_equivalence_certified,false,x.id);
 assert.equal(x.administrative_edit_proven,false,x.id);
 assert.ok(x.primary_source_assessment.length&&x.missing_required_evidence.length,x.id);
 assert.equal(x.code_context.stored_code,p.stored_code,x.id);
 assert.equal(x.code_context.official_parent_code,p.official_parent_code,x.id);
 assert.equal(x.code_context.tree_parent_code,p.tree_parent_code,x.id);
 if(i<2)assert.equal(x.group,'MD_CODE_PARENTAGE_DISCREPANCY');
 else if(i===2)assert.equal(x.group,'MD_NO_POSITIVE_IDENTITY');
 else if(i<8)assert.equal(x.group,'RO_OFFICIAL_NOMINAL_LOCALITY_OSM_UNBOUND');
 else {assert.equal(x.group,'RO_SECTOR_OFFICIAL_IDENTITY_UNBOUND');assert.equal(x.code_context.official_sector_code_reference,p.official_sector_code_reference);}
}
assert.equal(v.authorization_required_before_mutation,true);
assert.equal(v.p91_authorized,false);
console.log(JSON.stringify({status:'PASS',audit:'RT-ADM.2.1',cases:14,md:3,ro:11,certified_boundaries:0,automatic_edits:0,substantive_exceptions_open:14}));
