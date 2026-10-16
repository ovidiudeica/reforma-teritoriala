import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const source='docs/p9.0.7.2.11-85-case-worklist.json';
const prior='docs/p9.0.7.2.13-cadastral-vs-city-border.json';
const framework='docs/p9.0.7.2.14-institutional-registry-sources.json';
const output='docs/p9.0.7.2.14-85-authoritative-document-request-matrix.json';
const sha256=b=>createHash('sha256').update(b).digest('hex');
const bytes={};
for(const f of [source,prior,framework])bytes[f]=readFileSync(f);
const cases=JSON.parse(bytes[source]);
const old=JSON.parse(bytes[prior]);
const law=JSON.parse(bytes[framework]);
assert(cases.rows.length===85&&new Set(cases.rows.map(x=>x.actual_id)).size===85);
assert(old.identities_not_adjudicated===85);
assert(law.authoritative_requested_products.length===8);
const special=new Map(Object.entries(law.case_specific_portal).map(([key,v])=>[v.actual_id,{key,source:v}]));
function classify(r){
 const needsCityBoundary=['Tiraspol','Rîbnița','Bender','Camenca','Dnestrovsc','Dubăsari','Grigoriopol','Slobozia'];
 if(special.has(r.actual_id)&&r.actual_id==='osm-r9659979')return 'DUAL_URBAN_LAND_LINE_AND_CADASTRAL_ZONE';
 if(special.has(r.actual_id)&&r.actual_id==='osm-r18941890')return 'APPROVED_CITY_PERIMETER_AND_LEGAL_ROLE';
 if(r.name_ro==='Bender')return 'CITY_ROLE_DISAMBIGUATION_AND_APPROVED_CITY_PERIMETER';
 if(needsCityBoundary.includes(r.name_ro))return 'CITY_VERSUS_DISTRICT_ROLE_AND_LEGAL_PERIMETER';
 if(r.name_ro==='Lunga')return 'MICRODISTRICT_VERSUS_SETTLEMENT_WITH_REGISTRY_PROOF';
 if(r.same_name_osm_candidates.length>1)return 'HOMONYM_DISTINCT_ID_AND_EXACT_OFFICIAL_PERIMETER';
 if(r.historical_2023_registry_claims.length===2)return 'LEGAL_ROLE_AND_HOMONYM_LEGAL_PERIMETER';
 return 'VILLAGE_OR_SETTLEMENT_OFFICIAL_REGISTRATION_AND_BOUNDARY';
}
function build(){
const rows=cases.rows.map(r=>{
 const hasDual=r.actual_id==='osm-r9659979';
 const critical=r.actual_id==='osm-r1216706';
 const extra=[
 'CERTIFIED_CURRENT_2026_ATU_STATE_REGISTER_EXTRACT',
 'CERTIFIED_2026_NORMATIVE_CHANGE_LOG_AT_CUTOFF',
 'CERTIFIED_BOUNDARY_OF_CORRECT_ADMINISTRATIVE_ROLE_IN_APPROVED_CRS',
 'OSM_RELATION_GEOMETRY_COMPARE_WITH_AUTHORIZED_PRIMARY_BOUNDARY',
 'INDEPENDENT_AREA_WIDE_DEFACTO_JURISDICTION_AND_MD_DE_JURE_SEPARATION'
 ];
 if(hasDual)extra.push('SEPARATE_CITY_LINE_MAP_ANNEX_2_FROM_CADASTRAL_ZONE_MAP_ANNEX_1');
 if(critical)extra.push('PROVE_FULL_CREMENCIUG_POLYGON_PARENT_SLOBOZIA_VS_TIRASPOL');
 if(r.same_name_osm_candidates.length>1)extra.push('EACH_SAME_NAMED_OSM_RELATION_NEEDS_DISTINCT_LEGAL_ROLE');
 if(r.match_type_2023==='CURATED_ALIAS_POTENTIAL_MATCH')extra.push('LEGAL_ALIASES_AND_UNIQUE_CURRENT_SETTLEMENT_ID');
 if(r.match_type_2023==='NO_EXACT_2023_NAME')extra.push('PROVE_MICRODISTRICT_IS_OR_IS_NOT_ATU_IN_REGISTER');
 return {
  actual_id:r.actual_id,
  label:r.name_ro,
  historical_2023_class:r.match_type_2023,
  observed_osm_parent:r.geometric_parent_osm_id,
  conflicting_claimed_de_facto_parent:r.claimed_de_facto_parent_osm_id!==r.geometric_parent_osm_id?r.claimed_de_facto_parent_osm_id:null,
  required_boundary_kind:classify(r),
  existing_context_source_ids:r.context_source_refs.map(x=>x.source_id).sort(),
  previous_official_decree:(hasDual?'2026000508':r.actual_id==='osm-r18941890'?'2025001424':null),
  requirements:extra,
  current_2026_registry_extract_bytes_recovered:false,
  exact_correct_role_approved_map_or_vector_recovered:false,
  coordinate_system_and_topology_compared_to_osm:false,
  entire_polygon_de_facto_2026_control_certified:false,
  source_based_legal_md_parent_unchanged:true,
  acceptance:'NOT_ADJUDICATED',
  status:'AUTHORITATIVE_SOURCE_ACQUISITION_REQUIRED'
 };
});
const counts={};
for(const r of rows)counts[r.required_boundary_kind]=(counts[r.required_boundary_kind]||0)+1;
const report={
 schema_version:'p907214-85-official-source-acquisition-matrix-v1',
 snapshot_date:'2026-10-16',
 upstream_worklist_sha256:sha256(bytes[source]),
 upstream_rybnitsa_render_provenance_sha256:sha256(bytes[prior]),
 upstream_custodian_source_ledger_sha256:sha256(bytes[framework]),
 source_document:source,
 current_legal_custodian_confirmed:false,
 institution_to_request_from:'VERIFY_2026_DECREE_120_REGISTRY_MANDATE_BEFORE_OFFICIAL_REQUEST',
 source_product_types:['ADMINISTRATIVE_ATU_REGISTER','OFFICIAL_SETTLEMENT_LAND_LINE','OFFICIAL_CADASTRAL_ZONE_LINE','APPROVED_CITY_BOUNDARY_MAP','SIGNED_LEGAL_CHANGE_CHAIN'],
 identity_count:rows.length,
 contextual_cases:rows.filter(r=>r.existing_context_source_ids.length>0).length,
 category_counts:Object.fromEntries(Object.entries(counts).sort((a,b)=>a[0].localeCompare(b[0]))),
 already_signed_polygon_annexes_recovered:0,
 accepted_identities:0,
 no_automatic_parent_reassignment:true,
 no_geometric_change:true,
 semantic_acceptance:'BLOCKED_INCOMPLETE',
 p91_import_allowed:false,
 actual_mutation_allowed:false,
 records:rows
};
return JSON.stringify(report,null,2)+'\n';
}
const rendered=build();
if(process.argv.includes('--check')){
 assert.equal(readFileSync(output,'utf8'),rendered,'Matrix must match source-joined deterministic rebuild');
 console.log('P907214_SOURCE_ACQUISITION_REPRO_PASS: 85 IDs pinned, 0 original approved vectors, P9.1 denied');
}else {
 writeFileSync(output,rendered);
 console.log('P907214_MATRIX_BUILT '+JSON.stringify({bytes:rendered.length,sha256:sha256(Buffer.from(rendered)),cases:85}));
}
