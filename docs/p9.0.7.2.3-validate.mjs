import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load=p=>JSON.parse(readFileSync(p,'utf8'));
const data=load('docs/p9.0.7.2.3-primaries-articles-85.json');
const prior=load('docs/p9.0.7.2.2-primary-archive-coverage.json');
const policy=load('docs/p9.0.4.3-promotion-policy.json');
const primary = new Map(data.primary_documents.map(p=>[p.id,p]));
assert.equal(data.primary_documents.length,4);
assert.equal(primary.size,4);
assert.deepEqual(data.primary_documents.map(x=>x.file_id),[82189,82191,86073,86075]);
const originals=[
['PMR-2023-291-ZI-VII',1716896,'4a430b13c5b49b33f24a91028816c1fa4ceeed6bb7a217ee252e42a2d8f53c9a'],
['PMR-2023-292-ZI-VII',495437,'eb1bc210f20f34b6f2d6f5b684dbd2186b5166a4446eed15430a76d8f40c6367'],
['PMR-2024-47-ZI-VII',531237,'2b38db7ce14e27b881c46926a63723a95b3c7fbb60d2a44de3413e4c956bb8c9'],
['PMR-2024-48-ZI-VII',1789790,'efdc90ee38b19bfff57f97f1ab1ca544cd2e3d36d6d0417b51213de629629184']
];
for(const [id,bytes,sha] of originals){
  const a=primary.get(id);assert(a);assert.equal(a.bytes,bytes);assert.equal(a.sha256,sha);
  assert.equal(a.bytes_integrity,'VERIFIED_BY_DIRECT_DOWNLOAD_SHA256');
  assert.equal(a.direct_named_parent_change,'NONE_IDENTIFIED_IN_THIS_ACT');
  assert.equal(a.future_parent_effect,'NOT_CERTIFIED');
  assert.match(readFileSync('docs/p9.0.7.2.3-ocr/'+id+'.txt','utf8'),/NOT the authentic legislative text/);
}
assert.equal(primary.get('PMR-2023-291-ZI-VII').in_force,'2024-01-01');
assert(data.primary_documents.every(p=>p.relevant_operational_provisions_visually_proofread===true));
assert(primary.get('PMR-2023-292-ZI-VII').articles_changed.some(s=>s.includes('б)')));
assert(primary.get('PMR-2024-47-ZI-VII').articles_changed.some(s=>s.includes('г)')));
assert.deepEqual(primary.get('PMR-2024-48-ZI-VII').articles_changed,['Article 12: remove subparagraph 3)','Article 38: remove subparagraph 6)','Article 38: remove subparagraph 11)']);
assert.equal(primary.get('PMR-2023-292-ZI-VII').in_force,'2024-01-01');
assert.equal(data.additional_2023_law.id,'PMR-2023-42-ZI-VII');
assert.equal(data.additional_2023_law.published_register_id,'2023000402');
assert.equal(data.additional_2023_law.primary_full_text_retrieved,false);
assert.equal(data.row_count,85);
assert.deepEqual(data.rows.map(x=>x.actual_id).sort(),prior.rows.map(x=>x.actual_id).sort());
assert(data.rows.every(x=>x.legal_md_parent_preserved&&!x.unchanged_membership_across_all_other_acts_certified&&!x.control_2026_certified&&x.normative_acceptance==='BLOCKED_INCOMPLETE'&&!x.p91_import_allowed));
assert(data.yearly_exhaustiveness.every(x=>!x.all_publications_enumerated&&!x.all_relevant_original_binaries_hashed&&!x.negative_omission_proof));
assert.equal(data.all_2023_2026_relevant_acts_certified,false);
assert.equal(data.final_85_parent_status_certified,0);
assert.equal(data.semantic_acceptance,'BLOCKED_INCOMPLETE');
assert.equal(data.p91_import_allowed,false);
assert.equal(policy.semantic_acceptance,'BLOCKED_INCOMPLETE');
assert.equal(policy.p91_import_allowed,false);
console.log('P90723_PRIMARY_DOC_FAIL_CLOSED_PASS: four authenticated originals, law 42 candidate, 85 identities protected, no premature P9.1');
