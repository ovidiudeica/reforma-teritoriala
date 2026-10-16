import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';

const json=p=>JSON.parse(readFileSync(p,'utf8'));
const sha256=b=>createHash('sha256').update(b).digest('hex');
const ledger=json('docs/p9.0.7.2.10.2-retrieval-parity-status.json');
const manifest=json('docs/p9.0.7.2.10.1-individual-issuers-manifest.json');
const old=json('docs/p9.0.7.2.9-issuer-parity-evidence.json');
const policy=json('docs/p9.0.4.3-promotion-policy.json');
const gz=readFileSync(ledger.base_registry);
assert.equal(ledger.schema_version,'p9072102-retrieval-cross-registry-status-v1');
assert.equal(ledger.base_registry,manifest.registry_path);
assert.equal(sha256(gz),manifest.registry_gzip_sha256);
assert.equal(sha256(gz),ledger.base_registry_gzip_sha256);
const reg=JSON.parse(gunzipSync(gz).toString('utf8'));
assert.equal(reg.records.length,9254);
assert.equal(new Set(reg.records.map(r=>r.publication_id)).size,9254);
const confirmed=reg.records.filter(r=>r.issuer_legal_name!==null);
const pending=reg.records.filter(r=>r.issuer_legal_name===null);
assert.equal(confirmed.length,6);
assert.equal(pending.length,9248);
assert.equal(ledger.base_record_count,9254);
assert.equal(ledger.inherited_official_issuer_certifications,6);
assert.equal(ledger.new_official_issuer_certifications,0);
assert.equal(ledger.issuer_pending,9248);
assert.equal(ledger.individual_issuer_census_certified,false);
assert.equal(ledger.central_index_integrity_certified,true);
assert.equal(ledger.normative_exhaustiveness_certified,false);

const probe=ledger.official_card_probe;
assert.equal(probe.mode,'BOUNDED_DIRECT_OFFICIAL_URL_FETCH');
assert.equal(probe.selected_pending_records,2);
assert.equal(probe.publication_ids.length,2);
assert.equal(probe.total_url_attempts,4);
assert.equal(probe.timeout_ms,2500);
assert.equal(probe.records.length,2);
assert.equal(probe.primary_html_archived_in_git,false);
assert(probe.scope_inference.startsWith('SAMPLE_ONLY'));
for(let i=0;i<2;i++){
 const row=pending.find(x=>x.publication_id===probe.publication_ids[i]);
 assert(row,'probe claims nonpending publication');
 assert.equal(probe.records[i].publication_id,row.publication_id);
 const match=new URL(row.official_detail_url).pathname.match(/\/([a-f0-9]{32})!OpenDocument$/i);
 assert(match);
 assert.equal(probe.records[i].lotus_unid,match[1].toLowerCase());
 assert.equal(probe.records[i].official_content_recovered,false);
 assert.equal(probe.records[i].probe_status,'ALL_ATTEMPTS_TIMEOUT');
}
const external=ledger.external_registry_probe;
assert.equal(external.url,'https://pravopmr.ru/');
assert.equal(external.http_status,200);
assert.equal(external.observed_raw_html_bytes,176085);
assert.match(external.observed_raw_html_sha256,/^[a-f0-9]{64}$/);
assert.equal(external.html_archived_in_git,false);
assert.equal(external.document_level_issuer_certification_allowed,false);
assert.equal(external.authenticated_bulk_export_obtained,false);
assert.equal(external.pairwise_join_map_captured,false);
assert.equal(external.no_automated_bypass_attempted,true);
const cmp=ledger.external_comparison;
assert.equal(cmp.matched_one_to_one_records_certified,0);
for(const key of [
 'central_vs_external_missing','central_vs_external_duplicates',
 'central_vs_external_conflicting_issuers','external_only_publications','external_unavailable_records'
])assert.equal(cmp[key],null,'Cannot infer parity zeros without mapping: '+key);
assert.equal(cmp.exact_comparative_denominators_certified,false);
assert.equal(cmp.full_cross_registry_parity_certified,false);
assert.equal(old.parity_result.exact_cross_registry_counts_certified,false);
assert.equal(old.parity_result.cross_registry_omissions,null);
assert.equal(old.parity_result.cross_registry_duplicates,null);
assert.equal(old.parity_result.cross_registry_contradictions,null);
for(const v of Object.values(ledger.other_channels))assert.equal(v,false);
for(const [key,v] of Object.entries(ledger.evidence_policy)){
 if(key==='batch_probe_may_assess_access_without_authenticating_issuer')assert.equal(v,true);
 else if(key==='pending_records_must_remain_null')assert.equal(v,true);
 else assert.equal(v,false,'unsafe policy '+key);
}
assert(reg.records.filter(x=>x.issuer_legal_name===null).every(x=>x.issuer_evidence_url===null));
assert.equal(ledger.identity_count,85);
assert.equal(ledger.identity_adjudication_allowed,false);
assert.equal(ledger.semantic_acceptance,'BLOCKED_INCOMPLETE');
assert.equal(policy.semantic_acceptance,'BLOCKED_INCOMPLETE');
assert.equal(ledger.p91_import_allowed,false);
assert.equal(ledger.actual_mutation_allowed,false);
const self=spawnSync(process.execPath,['docs/p9.0.7.2.10.2-probe-official-cards.mjs','--self-test'],{encoding:'utf8'});
assert.equal(self.status,0,self.stderr||self.stdout);
assert(self.stdout.includes('P9072102_PROBE_LOCAL_SELF_TEST_PASS'));
console.log('P9072102_RETRIEVAL_PARITY_FAIL_CLOSED_PASS: 2 bounded official-card samples, 4 timeouts, 0 newly authenticated; 6/9254 prior issuer proofs, 9248 pending; external index accessible but NON_AUTHENTIC; cross-registry differences NULL; 85 unadjudicated; P9.1 DENIED');
