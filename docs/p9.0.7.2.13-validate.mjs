import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const sha256=b=>createHash('sha256').update(b).digest('hex');
const ledger=read('docs/p9.0.7.2.13-cadastral-vs-city-border.json');
const previous=read('docs/p9.0.7.2.12-boundary-decree-targets.json');
const ids=read('docs/p9.0.7.2.11-85-case-worklist.json');
const policy=read('docs/p9.0.4.3-promotion-policy.json');
function decodeArchivedCapture(e,kind){
 const file=kind==='html'?'docs/p9.0.7.2.13-primary/rybnitsa-decree116-html.html.gz.b64':kind==='card'?'docs/p9.0.7.2.13-primary/rybnitsa-decree116-card.html.gz.b64':null;
 assert(file,'Only pinned documentary captures');
 assert.equal(e.path,file);
 const encoded=readFileSync(file,'utf8').trim();
 assert.equal(encoded.length,e.base64_chars,'Truncated provenance base64');
 assert.match(encoded,/^[A-Za-z0-9+/]+={0,2}$/);
 const gz=Buffer.from(encoded,'base64');
 assert.equal(gz.toString('base64'),encoded);
 assert.equal(gz.length,e.gzipped_bytes);
 assert.equal(sha256(gz),e.gzip_sha256);
 assert.equal(gz[9],255,'canonical gzip OS marker');
 const raw=gunzipSync(gz);
 assert.equal(raw.length,e.original_html_bytes);
 assert.equal(sha256(raw),e.original_html_sha256);
 return raw.toString('utf8');
}
assert.equal(ledger.schema_version,'p907213-first-party-legal-html-evidence-v1');
assert.equal(ledger.document.publication_id,'2026000508');
assert.equal(ledger.document.act_number,'116');
assert.equal(ledger.document.act_date,'2026-04-02');
assert.equal(ledger.document.target_actual_id,'osm-r9659979');
assert.equal(ledger.document.official_publication_date,'2026-04-02');
assert(new URL(ledger.document.first_party_legal_document).hostname==='ul-test.gospmr.org');
assert(new URL(ledger.document.first_party_legal_card).hostname==='ul-test.gospmr.org');
const html=decodeArchivedCapture(ledger.document.legal_document_archive,'html');
const card=decodeArchivedCapture(ledger.document.legal_card_archive,'card');
const hints=[
 'Об установлении границ города Рыбницы',
 'Настоящий Указ вступает в силу',
 'Описание границ кадастровой зоны города Рыбницы',
 'Описание черты города Рыбницы',
 'Приложению № 1*',
 'Приложению № 2*',
 'Доступно по тарифу',
 'Скачивание доступно по тарифу'
];
for(const h of hints)assert(html.includes(h),'Missing legal-rendered evidence fragment: '+h);
assert(card.includes('Об установлении границ города Рыбницы'));
assert(card.includes('Президент Приднестровской Молдавской Республики'));
assert(html.includes('Президент Приднестровской Молдавской Республики'));
assert.equal(ledger.document.legal_document_archive.signed_official_pdf,false);
assert.equal(ledger.document.legal_document_archive.embedded_annex_maps_retrieved,false);
assert.equal(ledger.document.legal_claims.distinguishes_urban_settlement_line_from_cadastral_zone,true);
assert.equal(ledger.document.legal_claims.description_requires_cadastral_plan_annex_1,true);
assert.equal(ledger.document.legal_claims.description_requires_city_line_plan_annex_2,true);
assert.equal(ledger.document.legal_claims.map_download_explicitly_requires_service_tariff,true);
assert.equal(ledger.document.legal_claims.exact_cartographic_attachments_obtained,false);
assert.equal(ledger.document.legal_claims.effective_date_from_official_publication,'2026-04-03');
assert.equal(ledger.document.legal_claims.operative_at_audit_cutoff,true);
assert.equal(ledger.document.issuer_certification_scope,'CONFIRMED_ON_FIRST_PARTY_LEGAL_CARD_FOR_DOCUMENT_116_ONLY_NOT_GLOBAL_9254_CENSUS');
assert.equal(ledger.document.individual_2026_effective_full_polygon_control_certified,false);
assert.equal(ledger.document.exact_osm_polygon_versus_enacted_limit_compared,false);
assert.equal(ledger.document.geometry_semantics_resolved,false);
assert.deepEqual(ledger.document.relevant_semantic_roles,['CITY_URBAN_LINE','CITY_CADASTRAL_ZONE']);
assert.equal(ledger.document.role_assignment_to_osm_relation,'UNRESOLVED_TWO_DIFFERENT_NORMATIVE_BORDERS');
assert.equal(ledger.document.legal_md_parent_preserved,true);
assert.equal(ledger.document.not_a_de_jure_moldovan_reclassification,true);
const target=previous.city_boundary_acts.find(x=>x.publication_id==='2026000508');
assert(target&&target.target_osm_actual_ids.includes(ledger.document.target_actual_id));
assert.equal(target.complete_annex_recovered,false);
assert.equal(target.original_binary_recovered,false,'Previous signed original still absent');
assert.equal(ledger.other_target.publication_id,'2025001424');
assert.equal(ledger.other_target.original_signed_decree_retrieved,false);
assert.equal(ledger.other_target.official_map_retrieved,false);
assert.equal(ledger.other_target.council_document_access_proven,false);
assert.equal(ledger.other_target.semantic_accepted,false);
assert.equal(ledger.global_issuer_certifications_previous_count,6);
assert.equal(ledger.global_issuer_certifications_promoted_in_this_step,0);
assert.equal(ledger.full_city_boundary_approvals_with_exact_maps,0);
assert.equal(ledger.identities_not_adjudicated,85);
assert.equal(ids.adjudicated_cases,0);
assert.equal(ids.rows.length,85);
assert(ids.rows.every(x=>x.individual_semantic_acceptance==='BLOCKED_INCOMPLETE'));
assert.equal(ledger.semantic_acceptance,'BLOCKED_INCOMPLETE');
assert.equal(policy.semantic_acceptance,'BLOCKED_INCOMPLETE');
assert.equal(ledger.p91_import_allowed,false);
assert.equal(ledger.actual_mutation_allowed,false);
assert.equal(policy.p91_import_allowed,false);
console.log('P907213_RENDERED_PRIMARY_DUAL_BORDER_FAIL_CLOSED_PASS: government-hosted legal HTML+card 2 original-byte SHA256 verified; urban-city-limit distinct from cadastral-zone-limit; effective 2026-04-03; maps behind permitted access; 85 NOT_ADJUDICATED, P9.1 DENIED');
