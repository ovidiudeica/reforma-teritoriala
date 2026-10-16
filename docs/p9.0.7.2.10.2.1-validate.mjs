import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';

const read=p=>JSON.parse(readFileSync(p,'utf8'));
const sha256=b=>createHash('sha256').update(b).digest('hex');
const evidence=read('docs/p9.0.7.2.10.2.1-access-evidence.json');
const previous=read('docs/p9.0.7.2.10.2-retrieval-parity-status.json');
const manifest=read('docs/p9.0.7.2.10.1-individual-issuers-manifest.json');
const policy=read('docs/p9.0.4.3-promotion-policy.json');
assert.equal(evidence.schema_version,'p90721021-official-access-pilot-evidence-v1');
assert.equal(evidence.asof,'2026-10-16');
assert.equal(evidence.baseline.registry,manifest.registry_path);
assert.equal(evidence.baseline.sha256,manifest.registry_gzip_sha256);
const raw=readFileSync(evidence.baseline.registry);
assert.equal(sha256(raw),evidence.baseline.sha256);
const reg=JSON.parse(gunzipSync(raw).toString('utf8'));
assert.equal(reg.records.length,9254);
assert.equal(evidence.baseline.publication_count,9254);
assert.equal(evidence.baseline.official_issuer_certified_count,6);
assert.equal(evidence.baseline.pending_issuer_count,9248);
assert.equal(reg.records.filter(r=>r.issuer_legal_name!==null).length,6);
assert.equal(reg.records.filter(r=>r.issuer_legal_name===null).length,9248);
assert.equal(previous.issuer_pending,9248);
assert.equal(previous.new_official_issuer_certifications,0);

const ci=evidence.github_runner;
assert.equal(ci.runner,'ubuntu-24.04');
assert.equal(ci.node,'24.21.0');
assert.equal(ci.workflow_run_id,38894085292);
assert.equal(ci.workflow_job_id,116950282683);
assert.equal(ci.artifact_id,12042574394);
assert.equal(ci.artifact_retention_days,7);
assert.equal(ci.pilot_ids.length,5);
assert.deepEqual(ci.pilot_record_types,{pending:4,preverified_positive_control:1});
assert.equal(ci.hosts.length,3);
assert.equal(new Set(ci.hosts).size,3);
assert.deepEqual(ci.hosts,['www.justice.idknet.com','www.minjust.gospmr.org','www.minjust.org']);
assert.equal(ci.official_index_requests,3);
assert.equal(ci.individual_official_detail_requests,15);
assert.equal(ci.all_attempts_network_error_count,18);
assert.equal(ci.index_http_200_count,0);
assert.equal(ci.detail_html_captured_count,0);
assert.equal(ci.detail_exact_id_matches,0);
assert.equal(ci.issuer_certifications_new,0);
for(const id of ci.pilot_ids){
 const record=reg.records.find(r=>r.publication_id===id);
 assert(record,'pilot id not in certified central index');
 if(id==='2026000043')assert(record.issuer_legal_name!==null);
 else assert.equal(record.issuer_legal_name,null);
}
assert(ci.scope_limitation.includes('do not prove'));

const gov=evidence.alternate_official_primary;
assert.equal(gov.publication_id,'2026000001');
assert.equal(gov.official_ministry_index_date,'12.01.2026');
assert.equal(gov.official_ministry_index_number,'№1р');
assert.equal(gov.official_ministry_index_kind,'Распоряжение');
const u=new URL(gov.government_pdf_url);
assert.equal(u.hostname,'government.gospmr.org');
assert.equal(u.protocol,'https:');
assert(u.pathname.toLowerCase().endsWith('.pdf'));
assert.equal(gov.indexed_official_pdf_preview.page_count,2);
assert.equal(gov.indexed_official_pdf_preview.document_kind,'РАСПОРЯЖЕНИЕ');
assert.equal(gov.indexed_official_pdf_preview.explicit_issuer_header,'ПРАВИТЕЛЬСТВО ПРИДНЕСТРОВСКОЙ МОЛДАВСКОЙ РЕСПУБЛИКИ');
assert.equal(gov.indexed_official_pdf_preview.document_number,'№ 1р');
assert.equal(gov.indexed_official_pdf_preview.title_matches_ministry_index,true);
assert.equal(gov.indexed_official_pdf_preview.evidence_kind,'SEARCH_INDEXED_FIRST_PARTY_PDF_TEXT_NOT_BYTES');
assert.equal(gov.desktop_binary_retrieval,'TIMEOUT_9000MS');
assert.equal(gov.runner_binary_retrieval.timeout_ms,7000);
assert.equal(gov.runner_binary_retrieval.status,'NETWORK_ERROR');
assert.equal(gov.runner_binary_retrieval.http_status,null);
assert.equal(gov.runner_binary_retrieval.binary_pdf_available,false);
assert.equal(gov.runner_binary_retrieval.sha256,null);
assert.equal(gov.runner_binary_retrieval.byte_count,null);
assert.equal(gov.runner_binary_retrieval.primary_header_verified_from_downloaded_bytes,false);
assert.equal(gov.raw_primary_archived_in_git,false);
assert.equal(gov.new_issuer_certified,false);
assert.equal(evidence.optional_secondary_discovery.raw_lotus_cards_retrieved_by_runner,false);
assert.equal(evidence.optional_secondary_discovery.search_index_only_metadata_must_not_be_promoted,true);

assert.equal(evidence.access_path_status,'BLOCKED_NO_VERIFIABLE_RAW_OFFICIAL_DOCUMENT_RETRIEVAL');
for(const key of ['reliable_full_issuer_acquisition_demonstrated','all_issuer_certifications_complete',
 'cross_registry_parity_complete','global_normative_exhaustiveness_complete','p91_import_allowed','actual_mutation_allowed']){
 assert.equal(evidence[key],false,'must stay fail-closed: '+key);
}
for(const key of ['exact_external_missing','exact_external_duplicates','exact_external_contradictions'])assert.equal(evidence[key],null);
assert.equal(evidence.identities_not_adjudicated,85);
assert.equal(evidence.semantic_acceptance,'BLOCKED_INCOMPLETE');
assert.equal(policy.semantic_acceptance,'BLOCKED_INCOMPLETE');
assert.equal(previous.semantic_acceptance,'BLOCKED_INCOMPLETE');
assert.equal(previous.p91_import_allowed,false);
const checks=[
 'docs/p9.0.7.2.10.2.1-probe-access.mjs',
 'docs/p9.0.7.2.10.2.1-probe-government-primary.mjs'
];
for(const p of checks){
 const s=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});
 assert.equal(s.status,0,s.stderr);
 const smoke=spawnSync(process.execPath,[p,'--self-test'],{encoding:'utf8'});
 assert.equal(smoke.status,0,smoke.stderr||smoke.stdout);
}
console.log('P90721021_OFFICIAL_ACCESS_FAIL_CLOSED_PASS: 18 GH official index/detail timeouts across 3 hosts, 0 raw cards; indexed Government 2026000001 PDF primary candidate, 0 downloaded bytes; 6 confirmed and 9248 pending; 85 NOT_ADJUDICATED, P9.1 DENIED');
