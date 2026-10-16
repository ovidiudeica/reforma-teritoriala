import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const parse=p=>JSON.parse(readFileSync(p,'utf8'));
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const src=parse('docs/p9.0.7.2.11-85-case-worklist.json');
const matrix=parse('docs/p9.0.7.2.14-85-authoritative-document-request-matrix.json');
const legal=parse('docs/p9.0.7.2.14-institutional-registry-sources.json');
const prior=parse('docs/p9.0.7.2.13-cadastral-vs-city-border.json');
const policy=parse('docs/p9.0.4.3-promotion-policy.json');
assert.equal(matrix.schema_version,'p907214-85-official-source-acquisition-matrix-v1');
assert.equal(matrix.snapshot_date,'2026-10-16');
assert.equal(matrix.identity_count,85);
assert.equal(matrix.records.length,85);
assert.equal(new Set(matrix.records.map(r=>r.actual_id)).size,85);
assert.deepEqual(matrix.records.map(x=>x.actual_id),src.rows.map(x=>x.actual_id));
assert.equal(matrix.upstream_worklist_sha256,hash('docs/p9.0.7.2.11-85-case-worklist.json'));
assert.equal(matrix.upstream_rybnitsa_render_provenance_sha256,hash('docs/p9.0.7.2.13-cadastral-vs-city-border.json'));
assert.equal(matrix.upstream_custodian_source_ledger_sha256,hash('docs/p9.0.7.2.14-institutional-registry-sources.json'));
assert.equal(matrix.current_legal_custodian_confirmed,false);
assert.equal(matrix.institution_to_request_from,'VERIFY_2026_DECREE_120_REGISTRY_MANDATE_BEFORE_OFFICIAL_REQUEST');
assert.deepEqual(matrix.category_counts,{
 APPROVED_CITY_PERIMETER_AND_LEGAL_ROLE:1,
 CITY_ROLE_DISAMBIGUATION_AND_APPROVED_CITY_PERIMETER:2,
 CITY_VERSUS_DISTRICT_ROLE_AND_LEGAL_PERIMETER:5,
 DUAL_URBAN_LAND_LINE_AND_CADASTRAL_ZONE:1,
 HOMONYM_DISTINCT_ID_AND_EXACT_OFFICIAL_PERIMETER:2,
 LEGAL_ROLE_AND_HOMONYM_LEGAL_PERIMETER:4,
 MICRODISTRICT_VERSUS_SETTLEMENT_WITH_REGISTRY_PROOF:1,
 VILLAGE_OR_SETTLEMENT_OFFICIAL_REGISTRATION_AND_BOUNDARY:69
});
assert.equal(legal.schema_version,'p907214-2026-official-register-custodian-and-map-roles-v1');
assert.equal(legal.source_set.length,3);
assert(legal.source_set.every(s=>new URL(s.url).hostname==='government.gospmr.org'));
assert.equal(legal.source_set[0].effective_on_cutoff,false);
assert.equal(legal.source_set[0].register_current_custodian_inferred,false);
assert.equal(legal.source_set[1].effective_on_cutoff,true);
assert.equal(legal.source_set[1].current_ministry_register_mandate_clause_certified,false);
assert.equal(legal.source_set[1].authoritative_register_export_retrieved,false);
assert.equal(legal.source_set[2].source_text_available_in_index,true);
assert.equal(legal.authoritative_requested_products.length,8);
assert.equal(matrix.source_product_types.length,5);
assert.equal(matrix.contextual_cases,22);
assert.equal(matrix.already_signed_polygon_annexes_recovered,0);
assert.equal(matrix.accepted_identities,0);
assert.equal(matrix.no_automatic_parent_reassignment,true);
assert.equal(matrix.no_geometric_change,true);
const indexed=new Map(src.rows.map(x=>[x.actual_id,x]));
for(const row of matrix.records){
 const original=indexed.get(row.actual_id);
 assert(original);
 assert.equal(row.label,original.name_ro);
 assert.equal(row.historical_2023_class,original.match_type_2023);
 assert.equal(row.observed_osm_parent,original.geometric_parent_osm_id);
 assert.equal(row.conflicting_claimed_de_facto_parent,
   original.claimed_de_facto_parent_osm_id!==original.geometric_parent_osm_id?original.claimed_de_facto_parent_osm_id:null);
 assert.deepEqual(row.existing_context_source_ids,original.context_source_refs.map(y=>y.source_id).sort());
 assert(row.requirements.includes('CERTIFIED_CURRENT_2026_ATU_STATE_REGISTER_EXTRACT'));
 assert(row.requirements.includes('CERTIFIED_BOUNDARY_OF_CORRECT_ADMINISTRATIVE_ROLE_IN_APPROVED_CRS'));
 assert(row.requirements.includes('OSM_RELATION_GEOMETRY_COMPARE_WITH_AUTHORIZED_PRIMARY_BOUNDARY'));
 for(const key of ['current_2026_registry_extract_bytes_recovered','exact_correct_role_approved_map_or_vector_recovered',
 'coordinate_system_and_topology_compared_to_osm','entire_polygon_de_facto_2026_control_certified'])assert.equal(row[key],false);
 assert.equal(row.source_based_legal_md_parent_unchanged,true);
 assert.equal(row.acceptance,'NOT_ADJUDICATED');
 assert.equal(row.status,'AUTHORITATIVE_SOURCE_ACQUISITION_REQUIRED');
}
const rbn=matrix.records.find(r=>r.actual_id==='osm-r9659979');
assert(rbn);
assert.equal(rbn.previous_official_decree,'2026000508');
assert.equal(rbn.required_boundary_kind,'DUAL_URBAN_LAND_LINE_AND_CADASTRAL_ZONE');
assert(rbn.requirements.includes('SEPARATE_CITY_LINE_MAP_ANNEX_2_FROM_CADASTRAL_ZONE_MAP_ANNEX_1'));
assert.equal(prior.document.legal_claims.exact_cartographic_attachments_obtained,false);
const tirs=matrix.records.find(r=>r.actual_id==='osm-r18941890');
assert.equal(tirs?.previous_official_decree,'2025001424');
assert.equal(tirs?.required_boundary_kind,'APPROVED_CITY_PERIMETER_AND_LEGAL_ROLE');
const cr=matrix.records.find(r=>r.actual_id==='osm-r1216706');
assert.equal(cr?.conflicting_claimed_de_facto_parent,'1702219');
assert.equal(cr?.observed_osm_parent,'1702218');
assert(cr.requirements.includes('PROVE_FULL_CREMENCIUG_POLYGON_PARENT_SLOBOZIA_VS_TIRASPOL'));
assert.equal(matrix.records.find(r=>r.actual_id==='osm-r19001619').required_boundary_kind,'MICRODISTRICT_VERSUS_SETTLEMENT_WITH_REGISTRY_PROOF');
assert.equal(matrix.semantic_acceptance,'BLOCKED_INCOMPLETE');
assert.equal(policy.semantic_acceptance,'BLOCKED_INCOMPLETE');
assert.equal(matrix.p91_import_allowed,false);
assert.equal(matrix.actual_mutation_allowed,false);
assert.equal(src.adjudicated_cases,0);
const repro=spawnSync(process.execPath,['docs/p9.0.7.2.14-build-acquisition-matrix.mjs','--check'],{encoding:'utf8'});
assert.equal(repro.status,0,repro.stderr||repro.stdout);
console.log('P907214_85_REGISTER_AND_BOUNDARY_ACQUISITION_FAIL_CLOSED_PASS: 85 exact per-case requests; 2026 registrar mandate NOT certified, maps vs OSM NOT compared, 0 identities accepted; P9.1 and ACTUAL denied');
