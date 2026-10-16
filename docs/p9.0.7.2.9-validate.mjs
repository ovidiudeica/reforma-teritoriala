import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';

const sha256=b=>createHash('sha256').update(b).digest('hex');
const gitSha1=b=>createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const annual=read('docs/p9.0.7.2.9-annual-census-manifest.json');
const primary=read('docs/p9.0.7.2.9-2026-primary-evidence.json');
const issuer=read('docs/p9.0.7.2.9-issuer-parity-evidence.json');
const prev=read('docs/p9.0.7.2.8-original-pdf-verification.json');
const policy=read('docs/p9.0.4.3-promotion-policy.json');

assert.equal(annual.schema_version,'p90729-annual-publication-census-proof-v1');
assert.equal(annual.compressed_archive_git_blob_sha1,'c45e0a8b9884f9b08936b6b573aa28c5379d5cc9');
const compressed=readFileSync(annual.archive_path);
assert.equal(compressed.length,855633);
assert.equal(sha256(compressed),'8acc0d75a35f65fdac3e5fa88e04f6ef494f5f89822efa85b8467f2108f0a3ad');
assert.equal(gitSha1(compressed),annual.compressed_archive_git_blob_sha1);
const full=gunzipSync(compressed);
assert.equal(full.length,7812213);
assert.equal(sha256(full),'0269fb83e168f7943dc3fa5b05c0c44939a8eee3dae25088d44c6bb9cf2efeda');
const data=JSON.parse(full.toString('utf8'));
assert.equal(data.schema_version,'p90729-annual-issuer-census-v1');
assert.equal(data.years.length,4);
const counts=new Map([[2023,2390],[2024,2659],[2025,2479],[2026,1726]]);
const typeRecs={
2023:{'Приказ':1042,'Указ':174,'Распоряжение':130,'Постановление':521,'Указание':64,'Закон':431,'Конституционный закон':5,'Техническая ошибка':23},
2024:{'Постановление':590,'Приказ':1007,'Закон':361,'Указ':343,'Распоряжение':318,'Техническая ошибка':11,'Указание':24,'Конституционный закон':4,'Положение':1},
2025:{'Постановление':519,'Техническая ошибка':25,'Приказ':1022,'Указание':51,'Распоряжение':301,'Указ':285,'Закон':270,'Положение':1,'Конституционный закон':5},
2026:{'Приказ':744,'Постановление':282,'Распоряжение':214,'Указ':217,'Закон':228,'Указание':24,'Техническая ошибка':10,'Конституционный закон':6,'Инструкция':1}
};
let total=0;
for(const y of data.years){
 const expected=counts.get(y.year);
 assert(expected,'Unrecognized year');
 assert.equal(y.official_year_header_count,expected);
 assert.equal(y.records_extracted,expected);
 assert.equal(y.unique_publications,expected);
 assert.equal(y.publications.length,expected);
 assert.equal(y.source_pages.length,y.year===2026?10:12);
 const ids=y.publications.map(r=>Number(r.publication_id.slice(4))).sort((a,b)=>a-b);
 assert.equal(new Set(ids).size,expected);
 for(let n=1;n<=expected;n++)assert.equal(ids[n-1],n);
 assert.deepEqual(y.act_type_distribution,typeRecs[y.year]);
 assert.equal(Object.values(typeRecs[y.year]).reduce((s,n)=>s+n,0),expected);
 assert(y.publications.every(r=>r.publication_id.startsWith(String(y.year))&&r.publication_date.endsWith(String(y.year))&&r.act_type&&r.source_url?.includes('/oo/Publication.nsf/')));
 assert(y.source_pages.every((p,i)=>p.monthPosition===i+1&&p.extracted_count>0&&p.url.includes('Start=')&&p.source_html_sha256?.length===64&&!p.error));
 assert.equal(y.publication_id_series.consecutive_complete,true);
 assert.equal(y.annual_index_exactly_reconciled,true);
 assert.equal(y.issuer_entity_pending_count,expected);
 assert.equal(y.issuer_directly_authenticated_per_record,false);
 total+=expected;
}
assert.equal(total,9254);
assert.equal(data.total_publications,total);
assert.equal(data.all_annual_index_pages_reconciled,true);
assert.equal(annual.official_publication_total,total);
assert.equal(annual.annual_publication_totals.length,4);
assert.equal(annual.all_annual_central_index_rows_verified,true);
assert.equal(annual.issuer_counts_as_distinct_juridical_issuers_certified,false);
assert.equal(annual.complete_other_issuer_portals,false);
assert.equal(annual.complete_new_legislative_system_parity,false);
assert.equal(annual.all_local_de_facto_council_and_CIK_acts_reconciled,false);
assert.equal(annual.full_2023_2026_legal_normative_exhaustiveness_certified,false);

assert.equal(issuer.schema_version,'p90729-issuer-parity-evidence-v1');
assert.equal(issuer.central_chronological_registry.publication_count,9254);
assert.equal(issuer.central_chronological_registry.publication_id_gaps,0);
assert.equal(issuer.central_chronological_registry.duplicate_publication_ids,0);
assert.equal(issuer.central_chronological_registry.chronological_index_reconciled,true);
assert.equal(issuer.attribution_contract.act_type_is_issuer_identity,false);
assert.equal(issuer.attribution_contract.infer_issuer_from_act_type_allowed,false);
assert.equal(issuer.attribution_contract.committed_corpus_has_certified_issuer_field_count,0);
assert.equal(issuer.attribution_contract.committed_corpus_pending_record_level_issuer_enrichment,9254);
assert.equal(issuer.attribution_contract.full_issuer_census_certified,false);
assert.equal(issuer.directly_verified_official_detail_samples.length,6);
assert.deepEqual(issuer.directly_verified_official_detail_samples.map(x=>x.publication_id).sort(),['2025001047','2025001335','2025001336','2025001337','2026000043','2026000935']);
assert(issuer.directly_verified_official_detail_samples.every(x=>x.issuer&&x.source_url?.startsWith('https://')&&x.verification==='OFFICIAL_DETAIL_CARD_EXPLICIT_ISSUER'));
assert.equal(issuer.official_issuer_indexes.exact_2023_2026_counts_by_individual_juridical_issuer_certified,false);
assert.equal(issuer.new_legislative_registry.directly_accessible_on_2026_10_16,true);
assert.equal(issuer.new_legislative_registry.advanced_search_exposes_adopting_body_filter,true);
assert.equal(issuer.new_legislative_registry.deterministic_bulk_export_for_all_9254_captured,false);
assert.equal(issuer.new_legislative_registry.pairwise_publication_mapping_complete,false);
assert.equal(issuer.new_legislative_registry.full_parity_certified,false);
assert.equal(issuer.parity_result.central_registry_omissions,0);
assert.equal(issuer.parity_result.central_registry_duplicates,0);
assert.equal(issuer.parity_result.cross_registry_omissions,null);
assert.equal(issuer.parity_result.cross_registry_contradictions,null);
assert.equal(issuer.parity_result.cross_registry_duplicates,null);
assert.equal(issuer.parity_result.exact_cross_registry_counts_certified,false);
assert.equal(issuer.global_normative_exhaustiveness_certified,false);
assert.equal(issuer.identity_count,85);
assert.equal(issuer.individual_identity_status_certified,false);
assert.equal(issuer.semantic_acceptance,'BLOCKED_INCOMPLETE');
assert.equal(issuer.p91_import_allowed,false);
assert.equal(issuer.actual_mutation_allowed,false);

const locked=[
['PMR-2026-1-ZI-VIII','2026000086',2509016,'1dfed5a9ad884666f3f52d25bf483e25e811a70973d3d9cfa6cc68077bb1c0ae','8c6e8c67a90bcceb08fd05b9aa7c715a6f940351'],
['PMR-2026-4-ZI-VIII','2026000089',902265,'2518c04c7accaba6a69b01d1651b2b4a3380d29612bbb438f4bc6b70c29473b6','18c7abee07b782e56acdd1a4103cc2e5de89e74c'],
['PMR-2026-6-ZD-VIII','2026000091',2002247,'673b0d0bd60bfe472e8af13149f95c2370697afab1514e6eabcc2ffc62362122','9bc7146e2a9ea3398a2bdc18715c27af6672d326'],
['PMR-2026-53-ZID-VIII','2026000438',2278954,'a5eb1f4bd593c5d1b364ac8875e036777f77766dd37a757e5023eecfe3af5f37','9841f03152da9225ee56acd288e885b1c1edb2b8'],
['PMR-2026-78-ZID-VIII','2026000607',2436500,'3debaea6ed6211548d80427f69e2b82b559b8c0a8c48ba070e31f4e6f15e6d6c','79bedc53a60a33b07186642f58dc70dedb7f812c'],
['PMR-2026-89-ZI-VIII','2026000689',1647680,'214da4beb4f1f4e54592611b29954fb1bc521a853a90dc6f6f2a730cc34df725','b372921e2ea7efd4fa91fd03e6cd987c464bff0a'],
['PMR-2026-90-ZD-VIII','2026000690',1304976,'dee52d215aa07002c0357411cb016385fd3abec1023d963fdabeb009720a0bfe','2a8a04e364f7ad42c9a2046917b150882624d720'],
['PMR-2026-91-ZD-VIII','2026000691',1938286,'cd2bd623624c7bee1b5f3c7bb5bd9363ae948144031ec5f8031e92e19b504d09','e59ac282a20e805c9fdb9a46fd2ba5cf43f68dfb'],
['PMR-2026-114-ZID-VIII','2026000856',2481796,'630df1c3a6985539264baa1684c942796b5eb73f93164df6c302eef3d30aece2','2377360933817766cea793b12c73fe8a90c93708']
];
assert.equal(primary.primaries.length,locked.length);
for(let i=0;i<locked.length;i++){
 const e=primary.primaries[i];const [id,pub,len,hash,sha]=locked[i];
 assert.equal(e.id,id);
 assert.equal(e.pub,pub);
 assert.equal(e.actual_bytes,len);
 assert.equal(e.sha256,hash);
 assert.equal(e.git_blob_sha1,sha);
 assert.equal(e.primary_archived_in_git,true);
 assert.equal(e.qualified_pdf_signature_checked,false);
 assert.equal(e.legal_parent_reassigned,false);
 const raw=readFileSync(e.git_path);
 assert.equal(raw.length,len);
 assert.equal(raw.subarray(0,4).toString('ascii'),'%PDF');
 assert.equal(sha256(raw),hash);
 assert.equal(gitSha1(raw),sha);
 assert(data.years.find(y=>y.year===2026).publications.some(r=>r.publication_id===pub));
}
assert.equal(primary.laws_1_6_53_91_originals_pinned,true);
assert.equal(primary.trigger_laws_4_89_originals_pinned,true);
assert.equal(primary.conditional_effective_rules_cross_matched,true);
assert.equal(primary.primaries.find(a=>a.id==='PMR-2026-6-ZD-VIII').trigger,'PMR-2026-4-ZI-VIII');
assert.equal(primary.primaries.find(a=>a.id==='PMR-2026-91-ZD-VIII').trigger,'PMR-2026-89-ZI-VIII');
assert.equal(primary.primaries.find(a=>a.id==='PMR-2026-6-ZD-VIII').effect,'2026-01-30');
assert.equal(primary.primaries.find(a=>a.id==='PMR-2026-91-ZD-VIII').effect,'2026-05-07');
const op=primary.operative_clause_verification;
assert.equal(op['PMR-2026-4-ZI-VIII'].publication_id,'2026000089');
assert.equal(op['PMR-2026-4-ZI-VIII'].rule,'DAY_AFTER_OFFICIAL_PUBLICATION');
assert.equal(op['PMR-2026-4-ZI-VIII'].certified_effective_date,'2026-01-30');
assert.equal(op['PMR-2026-6-ZD-VIII'].trigger,'PMR-2026-4-ZI-VIII');
assert.equal(op['PMR-2026-6-ZD-VIII'].rule,'CONDITIONAL_ON_ENTRY_INTO_FORCE_OF_PM2026_4_ZI_VIII');
assert.equal(op['PMR-2026-6-ZD-VIII'].certified_effective_date,'2026-01-30');
assert.equal(op['PMR-2026-89-ZI-VIII'].publication_id,'2026000689');
assert.equal(op['PMR-2026-89-ZI-VIII'].rule,'DAY_AFTER_OFFICIAL_PUBLICATION');
assert.equal(op['PMR-2026-89-ZI-VIII'].certified_effective_date,'2026-05-07');
assert.equal(op['PMR-2026-91-ZD-VIII'].trigger,'PMR-2026-89-ZI-VIII');
assert.equal(op['PMR-2026-91-ZD-VIII'].rule,'CONDITIONAL_ON_ENTRY_INTO_FORCE_OF_PM2026_89_ZI_VIII');
assert.equal(op['PMR-2026-91-ZD-VIII'].certified_effective_date,'2026-05-07');
assert.equal(op['PMR-2026-114-ZID-VIII'].rule,'SIX_MONTHS_AFTER_DAY_OF_OFFICIAL_PUBLICATION');
assert.equal(op['PMR-2026-114-ZID-VIII'].certified_effective_date,null);
assert.equal(op['PMR-2026-114-ZID-VIII'].exact_calendar_interpretation_certified,false);
assert(Object.values(op).every(x=>x.primary_render_verified===true));
const president=primary.presidential_primary_law114;
assert.equal(president.actual_bytes,2479046);
assert.equal(president.sha256,'c9d05f579677f176007bd6987bf11031c986299e180d9e98577715f7cb1cc566');
assert.equal(president.git_blob_sha1,'0746164737e65d381bb594900f9165a3e7cef7b1');
const pbytes=readFileSync(president.git_path);
assert.equal(pbytes.length,president.actual_bytes);
assert.equal(pbytes.subarray(0,4).toString('ascii'),'%PDF');
assert.equal(sha256(pbytes),president.sha256);
assert.equal(gitSha1(pbytes),president.git_blob_sha1);
assert.notEqual(locked.at(-1)[3],president.sha256);
assert.equal(president.compared_to_ministry_law114_qualified_equivalence_certified,false);
assert.equal(president.rendered_page_equivalence_certified,true);
const l114=primary.law114_comparison;
assert.equal(l114.byte_identical,false);
assert.equal(l114.ministry_bytes,2481796);
assert.equal(l114.presidential_bytes,2479046);
assert.equal(l114.page_count_ministry,4);
assert.equal(l114.page_count_presidential,4);
assert.deepEqual(l114.rendered_page_base64_lengths,[166984,205220,178244,29084]);
assert.deepEqual(l114.rendered_page_bytes_identical,[true,true,true,true]);
assert.equal(l114.rendered_page_equivalence_certified,true);
assert.equal(l114.visible_normative_text_difference_detected,false);
assert.equal(l114.non_rendered_container_difference_exists,true);
assert.equal(l114.container_level_cause_identified,false);
assert.equal(primary.ministry_114_vs_president_114_byte_difference_unresolved,true);
assert.equal(primary.global_2023_2026_issuer_census_complete,false);
assert.equal(primary.individual_identity_status_certified,false);
assert.equal(prev.scope_count,85);
assert.equal(primary.identity_count,85);
assert.equal(primary.semantic_acceptance,'BLOCKED_INCOMPLETE');
assert.equal(primary.p91_import_allowed,false);
assert.equal(primary.actual_mutation_allowed,false);
assert.equal(policy.semantic_acceptance,'BLOCKED_INCOMPLETE');
assert.equal(policy.p91_import_allowed,false);
console.log('P90729_ANNUAL_PUBLICATION_PRIMARY_FAIL_CLOSED_PASS: 9254/9254 gap-free official monthly entries; 6 explicit official issuer-card samples but 9254 record-level issuer fields remain pending; 9+1 original 2026 PDFs hashed; 4->6 and 89->91 operative clauses certified; Law114 4/4 rendered pages identical despite distinct container hashes; 85 NOT_ADJUDICATED; global completeness BLOCKED, P9.1 denied');
