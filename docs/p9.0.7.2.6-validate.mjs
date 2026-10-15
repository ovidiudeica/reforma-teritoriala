import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const read=p=>JSON.parse(readFileSync(p,'utf8'));
const evidence=read('docs/p9.0.7.2.6-primary-evidence-closure.json');
const prior=read('docs/p9.0.7.2.5-dependency-and-exhaustiveness-ledger.json');
const promotion=read('docs/p9.0.4.3-promotion-policy.json');

assert.equal(evidence.original_documents.length,3);
assert.equal(evidence.primary_restored_for_2023_post_baseline_count,3);
assert.deepEqual(evidence.original_documents.map(x=>x.id),[
  'PMR-2023-84-ZI-VII','PMR-2023-85-ZI-VII','PMR-2023-216-ZI-VII'
]);
const expected=[
  ['2023000620','2023-04-19T16:15:31','2023-04-20',81408,'13e09f154a2398c23abccfe0206b2496cc7e80c9d0ad5a27d534d82b78c389ea','33986e332b1d9082641f9bbf37c913ce646af9b9'],
  ['2023000621','2023-04-19T16:21:54','2023-04-20',19237,'65c73d8471d60187cdbee0c72b790a93a67881f9ca2fbb6c719c319c8a979567','0a0750412a9f5c25a41d751112b6340ef4203700'],
  ['2023001134','2023-07-14T18:00:39','2023-07-15',18654,'5bec6ef1f05ff74f9b46778999d29293cd5d024d34eb9c8318c3e85087cf96be','8786519d569ea99993549e561cb8824c9a0b4efe']
];
for(let i=0;i<3;i++){
  const a=evidence.original_documents[i];
  const [pub,when,eff,bytes,sha,blob]=expected[i];
  assert.equal(a.publication_id,pub);
  assert.equal(a.published_at,when);
  assert.equal(a.effective_rule,'DAY_AFTER_OFFICIAL_PUBLICATION');
  assert.equal(a.effective_date,eff);
  assert.equal(a.word_bytes,bytes);
  assert.equal(a.word_sha256,sha);
  assert.equal(a.git_blob_sha1,blob);
  assert.equal(a.original_word_bytes_sha256_certified,true);
  assert.equal(a.original_word_committed_to_git,true);
  assert.equal(a.presidential_pdf_sha256_certified,true);
  assert.equal(a.presidential_pdf_committed_to_git,false);
  assert.equal(a.law_individual_name_based_parent_effect,'NOT_ADJUDICATED');
  assert.equal(a.legal_md_parent_effect,'NONE_AUTHORIZED');
  assert.match(a.official_revision_url,/ul-test\.gospmr\.org\/documents\//);
  const raw=readFileSync(a.word_path);
  assert.equal(raw.length,bytes);
  assert.equal(createHash('sha256').update(raw).digest('hex'),sha);
  const gitInput=Buffer.concat([Buffer.from('blob '+bytes+'\0'),raw]);
  assert.equal(createHash('sha1').update(gitInput).digest('hex'),blob);
}
assert.equal(evidence.original_documents[0].word_format,'DOC_OLE');
assert.equal(evidence.original_documents[1].word_format,'DOCX');
assert.equal(evidence.original_documents[2].word_format,'DOCX');
assert.equal(evidence.direct_primary_2023_target_set_complete_for_discovered_ids,true);
assert.equal(evidence.complete_2023_2026_primary_corpus_certified,false);
assert.equal(evidence.all_remaining_signed_word_pdf_copies_acquired,false);
assert(evidence.outstanding.some(z=>z.id==='PMR-2024-97-ZD-VII'));
assert(evidence.outstanding.some(z=>z.id==='PMR-2025-94-KZID-VII'));
assert(evidence.outstanding.some(z=>z.id==='PMR-2026-114-ZID-VIII'));
assert.equal(evidence.identity_count,85);
assert.equal(evidence.identity_rows.length,85);
assert.equal(new Set(evidence.identity_rows.map(x=>x.actual_id)).size,85);
assert.deepEqual(evidence.identity_rows.map(x=>x.actual_id).sort(),prior.identity_rows.map(x=>x.actual_id).sort());
assert(evidence.identity_rows.every(x=>x.legal_md_parent_preserved &&
  x.primary_acts_2023_checked_for_operative_provisions.length===3 &&
  x.role_effect_not_equated_to_territorial_assignment &&
  !x.individual_de_facto_parent_adjudicated &&
  !x.full_polygon_control_adjudicated &&
  !x.normative_chain_exhaustive && x.semantic_acceptance==='BLOCKED_INCOMPLETE' &&
  !x.p91_import_allowed));
assert.equal(evidence.legal_identity_adjudication_performed,false);
assert.equal(evidence.real_world_control_adjudication_performed,false);
assert.equal(evidence.administrative_status_certification,false);
assert.equal(evidence.semantic_acceptance,'BLOCKED_INCOMPLETE');
assert.equal(evidence.p91_import_allowed,false);
assert.equal(evidence.actual_mutation_allowed,false);
assert.equal(promotion.semantic_acceptance,'BLOCKED_INCOMPLETE');
assert.equal(promotion.p91_import_allowed,false);

console.log('P90726_PRIMARIES_FAIL_CLOSED_PASS: 3 byte-verified authentic Word originals and indexed PDFs, 85 unadjudicated, no P9.1');
