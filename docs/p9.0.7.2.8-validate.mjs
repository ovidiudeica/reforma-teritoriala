import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const load=p=>JSON.parse(readFileSync(p,'utf8'));
const p=load('docs/p9.0.7.2.8-original-pdf-verification.json');
const index=load('docs/p9.0.7.2.8-scoped-official-index.json');
const before=load('docs/p9.0.7.2.7-legal-trigger-provenance.json');
const policy=load('docs/p9.0.4.3-promotion-policy.json');

const expected=[
['PMR-2024-96-ZI-VII','2024001013',2500596,'755616be599d670e2e67bb9016a627f54eda1df34c89fd73398cbfd37e6fa47c','adb4cc7e8010b3b65561f974ec958ecb755700e5'],
['PMR-2024-97-ZD-VII','2024001014',2044037,'70da7a2c7425a80a0f43fc65a79a0bd5ca6c948ceb1d9c7376ebc7394640873f','973a0fa0b02957fff31dfd147388c6cb90d60cde'],
['PMR-2024-276-ZD-VII','2024002326',2051861,'46a166161c545f1e438a4eae4b78586557d14cd8de1e3c06a158ab70a11c2c7a','56640f06352cd83a5a5ffa07389c362899a26b6c'],
['PMR-2024-287-ZID-VII','2024002387',2163384,'9354c98ac66c7609dc9f0670ecbec626512b193f91ad56f1666946370b340045','84f1b201ece2728929e2a3aab7c623c6e84660a7'],
['PMR-2024-339-ZI-VII','2024002592',909587,'83acb323f6d4f6c891e8f6a89eda0b95dd0a4e0ecc51ffc08097e3afbbf1d251','e8a2684608484179afbde60f9285075f6929864d'],
['PMR-2024-340-ZI-VII','2024002593',2008292,'66c9a10bfcb8dc003896c6593540f3156ae0cd19e943c81d752725a80a867f8a','877e8ca2594441f97eb9f22eae26358235f15e0a'],
['PMR-2025-97-ZI-VII','2025000896',2565363,'680be6ada00b332a9cf4787364482ae580f1e825f71f7c6ecea86dc8bcf21d4c','81f84fe8b54a7b7179afe9bb4459bc7362edd1b3'],
['PMR-2025-187-ZI-VII','2025001392',2027714,'1f979ef9e56339eb453271186785fb5e957e44e3ec4f32130d0b11cd7df6c5fd','a4853add1777e3d43c1b8b059b7e578f20240732'],
['PMR-2025-223-ZI-VII','2025002031',2264887,'1eeb2926f1111a5414bd625caabba62edfa1439d78d0d88ec93049692c1f49a0','279ce410338de16b8802c32c19631c0cde6b92c8']
];
assert.equal(p.schema_version,'p90728-original-pdf-proof-v1');
assert.equal(p.official_primary_pdf_count,9);
assert.equal(p.original_primary_pdfs.length,9);
assert.equal(p.pdf_original_git_archival_count,9);
assert.equal(p.original_pdfs_in_git,true);
for(let i=0;i<expected.length;i++){
 const e=p.original_primary_pdfs[i];
 const [id,pub,bytes,sha,git]=expected[i];
 assert.equal(e.act,id);
 assert.equal(e.publication_id,pub);
 assert.equal(e.original_pdf_bytes,bytes);
 assert.equal(e.original_pdf_sha256,sha);
 assert.equal(e.git_blob_sha1,git);
 assert.equal(e.pdf_binary_archived_in_repository,true);
 assert.equal(e.pdf_electronic_signature_verified,false);
 assert.equal(e.individual_territorial_identity_adjudicated,false);
 assert.equal(e.git_path,'docs/p9.0.7.2.8-primary/'+id+'.pdf');
 assert.match(e.original_pdf_url,/^http:\/\/www\.minjust\.gospmr\.org\/publication\/docs\//);
 const raw=readFileSync(e.git_path);
 assert.equal(raw.length,bytes);
 assert.equal(raw.subarray(0,4).toString('ascii'),'%PDF');
 assert.equal(createHash('sha256').update(raw).digest('hex'),sha);
 assert.equal(createHash('sha1').update(Buffer.from('blob '+bytes+'\0')).update(raw).digest('hex'),git);
}
assert.equal(p.original_primary_pdfs.reduce((n,x)=>n+x.original_pdf_bytes,0),18535721);
assert.equal(index.schema_version,'p90728-scoped-title-index-v2');
assert.equal(index.unique_document_uuid_count,234);
assert.equal(index.query_result_total,234);
assert.equal(index.scoped_page_coverage_complete,true);
assert.deepEqual(index.queries.map(q=>[q.category,q.advertised_count,q.indexed_count]),[
 ['local_government',194,194],['territorial_organization',35,35],['satellite_city',5,5]
]);
assert.deepEqual(index.queries.map(q=>q.pages.length),[8,2,1]);
assert.equal(index.period_2023_2026_total,23);
const ids=index.queries.flatMap(q=>q.rows.map(r=>r.uuid));
assert.equal(new Set(ids).size,234);
assert(index.queries.every(q=>q.query_count_reconciled));
const laws=p.additional_2026_laws;
assert.deepEqual(laws.map(x=>x.act_number),['91-ЗД-VIII','53-ЗИД-VIII','6-ЗД-VIII','1-ЗИ-VIII']);
assert(laws.every(x=>x.primary_signed_binary_sha256===null && !x.individual_effect_certified && !x.signed_original_pdf_recovered));
assert.equal(p.scope_count,85);
assert.equal(p.identity_rows.length,85);
assert.equal(new Set(p.identity_rows.map(x=>x.actual_id)).size,85);
assert.deepEqual(p.identity_rows.map(x=>x.actual_id).sort(),before.identity_rows.map(x=>x.actual_id).sort());
assert(p.identity_rows.every(x=>x.legal_md_parent_preserved && x.primaries_retrieved.length===9 &&
 !x.individual_admin_parent_change_certified && !x.full_polygon_effective_control_certified &&
 x.semantic_acceptance==='BLOCKED_INCOMPLETE' && !x.p91_import_allowed));
assert.equal(p.global_official_gazette_exhaustiveness_certified,false);
assert.equal(p.all_relevant_acts_found_certified,false);
assert.equal(p.all_relevant_original_PDF_SHA256_certified,false);
assert.equal(p.all_2023_2026_normative_evolution_certified,false);
assert.equal(p.individual_admin_identity_adjudication_performed,false);
assert.equal(p.semantic_acceptance,'BLOCKED_INCOMPLETE');
assert.equal(p.p91_import_allowed,false);
assert.equal(p.actual_mutation_allowed,false);
assert.equal(index.all_official_documents_2023_2026_enumerated,false);
assert.equal(index.official_old_vs_new_parity_complete,false);
assert.equal(index.normative_exhaustiveness_certified,false);
assert.equal(policy.semantic_acceptance,'BLOCKED_INCOMPLETE');
assert.equal(policy.p91_import_allowed,false);
console.log('P90728_PRIMARY_PDF_FAIL_CLOSED_PASS: 9 original PDFs 18,535,721 bytes SHA256/GitSHA1; 194/35/5 query coverage; 85 unadjudicated; P9.1 denied');
