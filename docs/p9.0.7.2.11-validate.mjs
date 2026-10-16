import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const read=p=>JSON.parse(readFileSync(p,'utf8'));
const sha256=b=>createHash('sha256').update(b).digest('hex');
const src=read('docs/p9.0.7-contemporary-evidence-ledger.json');
const context=read('docs/p9.0.7.2.11-targeted-external-evidence.json');
const work=read('docs/p9.0.7.2.11-85-case-worklist.json');
const policy=read('docs/p9.0.4.3-promotion-policy.json');
const r=spawnSync(process.execPath,['docs/p9.0.7.2.11-build-85-case-worklist.mjs','--check'],{encoding:'utf8'});
assert.equal(r.status,0,r.stderr||r.stdout);
assert.match(r.stdout,/P907211_85_CASE_REPRO_PASS/);
assert.equal(work.schema_version,'p907211-85-case-probatory-worklist-v1');
assert.equal(work.total,85);
assert.equal(work.identities_preserved,85);
assert.equal(work.rows.length,85);
assert.equal(new Set(work.rows.map(x=>x.actual_id)).size,85);
assert.deepEqual(work.rows.map(x=>x.actual_id).sort(),src.rows.map(x=>x.actual_id).sort());
assert.equal(work.source_ledger_sha256,sha256(readFileSync(work.source_ledger)));
assert.equal(work.external_context_sha256,sha256(readFileSync(work.external_context)));
assert.deepEqual(work.match_type_counts,{
 CURATED_ALIAS_POTENTIAL_MATCH:4,
 HOMONYM_MULTIPLE_ENTRIES_2023:11,
 NO_EXACT_2023_NAME:1,
 UNIQUE_NAME_2023:69
});
assert.equal(work.linked_context_cases,20);
assert.equal(work.context_sources,8);
assert.equal(context.independent_claim_sources.length,8);
assert.equal(work.context_is_not_primary_binary,true);
assert.equal(context.primary_binary_byte_capture_count,0);
const allowed=['government.gospmr.org','www.president.gospmr.org','president.gospmr.org','gov.md','justice.idknet.com'];
for(const ref of context.independent_claim_sources){
 const domain=new URL(ref.source_url);
 assert.equal(domain.protocol,'https:');
 assert(allowed.includes(domain.hostname),'Noninstitutional source '+domain.hostname);
 assert(ref.relevant_ids.length>0);
 assert.equal(ref.binary_archived,false);
 assert.equal(ref.sha256,null);
 assert.equal(ref.primary_original_independently_verified,false);
 assert(ref.claim_type&&ref.limitation);
 if(ref.date===null)assert(ref.date_precision!=='DAY');
}
assert.equal(context.guardrails.external_context_is_not_certified_polygons,true);
assert.equal(context.guardrails.must_not_infer_full_control_from_service_or_road_maintenance,true);
assert.equal(context.guardrails.must_not_reassign_moldovan_legal_parent,true);
assert.equal(context.guardrails.must_not_treat_unofficial_consolidation_as_primary,true);
assert.equal(context.guardrails.must_not_replace_nistrenia_osm_geometries,true);
assert.equal(context.guardrails.need_exhaustive_normative_chain_and_primary_border_control,true);
assert.deepEqual(work.repeated_name_groups,[
 {name:'Bender',actual_ids:['osm-r12463379','osm-r9581354']},
 {name:'Hlinaia',actual_ids:['osm-r8291058','osm-r9301463']}
]);
assert.deepEqual(work.disputed_parent_osm_cases,['osm-r1216706']);
const names=new Map(work.rows.map(x=>[x.actual_id,x]));
assert.equal(names.get('osm-r1216706').claimed_de_facto_parent_osm_id,'1702219');
assert.equal(names.get('osm-r1216706').geometric_parent_osm_id,'1702218');
assert(names.get('osm-r1216706').requirements.includes('EXPLICIT_DE_FACTO_PARENT_CONFLICT_RESOLUTION_WITHOUT_CHANGING_GEOMETRY'));
assert.equal(names.get('osm-r19001619').match_type_2023,'NO_EXACT_2023_NAME');
assert(names.get('osm-r19001619').requirements.includes('CLASSIFY_MICRODISTRICT_VERSUS_SETTLEMENT_FROM_CURRENT_INSTITUTIONAL_OR_NORMATIVE_SOURCE'));
assert.equal(names.get('osm-r8291058').geometric_parent_osm_id,'1702218');
assert.equal(names.get('osm-r9301463').geometric_parent_osm_id,'1702214');
assert(names.get('osm-r12463379').requirements.includes('DISAMBIGUATE_DISTINCT_OSM_RELATIONS_WITH_IDENTICAL_ROMANIAN_NAME'));
assert(names.get('osm-r9581354').requirements.includes('DISAMBIGUATE_DISTINCT_OSM_RELATIONS_WITH_IDENTICAL_ROMANIAN_NAME'));
let withRefs=0;
for(const row of work.rows){
 const original=src.rows.find(x=>x.actual_id===row.actual_id);
 assert(original);
 assert.equal(row.name_ro,original.name_ro);
 assert.equal(row.match_type_2023,original.match_type_2023);
 assert.deepEqual(row.historical_2023_registry_claims,original.registry_claims_2023);
 assert.equal(row.geometric_parent_osm_id,original.geometric_parent_osm_id);
 assert.equal(row.claimed_de_facto_parent_osm_id,original.claimed_de_facto_parent_osm_id);
 assert.equal(row.legal_md_parent_preserved,true);
 assert.equal(row.full_primary_byte_provenance_certified,false);
 assert.equal(row.exhausted_normative_chain_certified,false);
 assert.equal(row.exact_2026_full_polygon_control_certified,false);
 assert.equal(row.individual_semantic_acceptance,'BLOCKED_INCOMPLETE');
 assert.equal(row.p91_import_allowed,false);
 assert.equal(row.status,'CONTEXTUAL_RESEARCH_ONLY_NOT_ADJUDICATED');
 assert(row.requirements.includes('CERTIFIED_EXHAUSTIVE_2023_2026_ADMINISTRATIVE_LAW_AMENDMENT_CHAIN'));
 assert(row.requirements.includes('INDEPENDENT_CONTEMPORARY_DE_FACTO_CONTROL_OF_THE_EXACT_FULL_OSM_POLYGON'));
 assert(row.requirements.includes('LEGAL_MOLDOVAN_PARENT_PRESERVED_AND_DISTINGUISHED'));
 assert.equal(row.contextual_source_count,row.context_source_refs.length);
 if(row.contextual_source_count)withRefs++;
 for(const e of row.context_source_refs){
  const source=context.independent_claim_sources.find(x=>x.id===e.source_id);
  assert(source?.relevant_ids.includes(row.actual_id));
  assert.equal(source.claim_type,e.claim_type);
 }
}
assert.equal(withRefs,20);
assert.equal(work.full_polygon_certified,0);
assert.equal(work.normative_chain_exhaustive_certified,0);
assert.equal(work.adjudicated_cases,0);
assert.equal(work.semantic_acceptance,'BLOCKED_INCOMPLETE');
assert.equal(work.p91_import_allowed,false);
assert.equal(work.actual_mutation_allowed,false);
assert.equal(policy.semantic_acceptance,'BLOCKED_INCOMPLETE');
assert.equal(policy.p91_import_allowed,false);
console.log('P907211_85_INDIVIDUAL_CONTEXT_FAIL_CLOSED_PASS: 85 individually pinned; 20 have additional scoped first-party context from 8 references; duplicate OSM names Bender/Hlinaia and Cremenciug parent conflict isolated; 0 full-polygon adjudications; 85 preserved; P9.1 DENIED');
