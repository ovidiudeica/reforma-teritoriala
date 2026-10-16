import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const path={
 census:'docs/p9.0.7.2.15-osm-tag-census.json',
 original:'docs/p9.0.6.2-verified-evidence-ledger.json',
 worklist:'docs/p9.0.7.2.11-85-case-worklist.json',
 priorPolicy:'docs/p9.0.4.3-promotion-policy.json',
 out:'docs/p9.0.7.2.15-osm-semantic-reconciliation.json'
};
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const census=read(path.census),geo=read(path.original),worklist=read(path.worklist),policy=read(path.priorPolicy);
assert.equal(census.scanned,85);
assert.equal(worklist.rows.length,85);
assert.equal(new Set(census.rows.map(x=>x.actual_id)).size,85);
assert.equal(census.all_versions_match_baseline,true);
assert.equal(census.source_worklist_sha256,sha(path.worklist));
assert.equal(census.source_verified_geometry_ledger_sha256,sha(path.original));
assert.equal(policy.p91_import_allowed,false);
const byGeo=new Map(geo.rows.map(r=>['osm-r'+r.osm_id,r]));
const byOld=new Map(worklist.rows.map(r=>[r.actual_id,r]));
function role(tags){
 const name=(tags.name??'').toLocaleLowerCase('ru');
 const ro=(tags['name:ro']??'').toLocaleLowerCase('ro');
 if(tags.admin_level==='4')return 'OSM_LEVEL4_MUNICIPALITY_BOUNDARY';
 if(/сельск(?:ий|ого)\s+совет/u.test(name)||/sovetul\s+sătesc/u.test(ro))return 'OSM_RURAL_COUNCIL_AREA';
 if(/поселков(?:ый|ого)\s+совет/u.test(name))return 'OSM_SETTLEMENT_COUNCIL_AREA';
 if(/городск(?:ой|ого)\s+совет/u.test(name))return 'OSM_CITY_COUNCIL_AREA';
 switch(tags.place){
  case 'city':return 'OSM_CITY_BOUNDARY';
  case 'town':return 'OSM_TOWN_BOUNDARY';
  case 'village':return 'OSM_VILLAGE_BOUNDARY';
  case 'municipality':return 'OSM_LEVEL8_MUNICIPALITY_AREA_UNSPECIFIED';
  default:return 'OSM_LEVEL8_ADMIN_AREA_UNSPECIFIED';
 }
}
function build(){
 const pairs=new Map();
 for(const r of worklist.rows){
  const group=pairs.get(r.name_ro)??[];
  group.push(r.actual_id);
  pairs.set(r.name_ro,group);
 }
 const rows=census.rows.map(t=>{
  const r=byOld.get(t.actual_id),g=byGeo.get(t.actual_id);
  assert(r&&g,'Identity absent from pinned evidence');
  assert(t.version_matches_pinned_snapshot);
  assert.equal(g.live_vs_2026_10_12_exact,true,'Unverified source geometry for '+t.actual_id);
  assert.equal(t.relation_version,g.relation_version_261012);
  assert.equal(t.relation_timestamp,g.relation_timestamp);
  assert.equal(t.tags.type,'boundary');
  assert.equal(t.tags.boundary,'administrative');
  assert(['4','8'].includes(t.tags.admin_level));
  assert(t.tags.name?.length>0);
  const roleName=role(t.tags);
  const conflicting=r.claimed_de_facto_parent_osm_id!==null&&r.claimed_de_facto_parent_osm_id!==r.geometric_parent_osm_id;
  const sameName=pairs.get(r.name_ro);
  const flags=[];
  if(roleName==='OSM_LEVEL8_MUNICIPALITY_AREA_UNSPECIFIED'||roleName==='OSM_LEVEL8_ADMIN_AREA_UNSPECIFIED')flags.push('NO_OSM_PROOF_OF_DISTINCT_SETTLEMENT_STATUS');
  if(roleName.includes('COUNCIL'))flags.push('COUNCIL_BOUNDARY_NOT_EQUIVALENT_TO_SETTLEMENT_FOOTPRINT');
  if(sameName.length>1)flags.push('DISPLAY_NAME_COLLISION_USE_OSM_ID_AND_ROLE');
  if(conflicting)flags.push('GEOMETRIC_PARENT_DIFFERS_FROM_HISTORIC_DE_FACTO_CLAIM');
  if(t.actual_id==='osm-r9659979')flags.push('URBAN_LINE_VS_CADASTRAL_ZONE_NOT_LEGALLY_RECONCILED');
  if(t.actual_id==='osm-r19001619')flags.push('LUNGA_MICRODISTRICT_VS_OSM_MUNICIPALITY_TAG_UNRESOLVED');
  if(r.match_type_2023==='CURATED_ALIAS_POTENTIAL_MATCH')flags.push('NAME_ALIAS_NOT_EQUAL_TO_CURRENT_LEGAL_IDENTITY');
  if(r.match_type_2023==='HOMONYM_MULTIPLE_ENTRIES_2023')flags.push('2023_LEGAL_HOMONYM_NOT_AUTOMATIC_OSM_BINDING');
  return {
   actual_id:t.actual_id,
   osm_relation_id:t.osm_relation_id,
   display_label_existing_ro:r.name_ro,
   osm_name:t.tags.name,
   osm_name_ro:t.tags['name:ro']??null,
   osm_name_ru:t.tags['name:ru']??null,
   osm_boundary:t.tags.boundary,
   osm_type:t.tags.type,
   osm_admin_level:t.tags.admin_level,
   osm_place:t.tags.place??null,
   osm_role_from_tags:roleName,
   osm_relation_version:t.relation_version,
   osm_relation_timestamp:t.relation_timestamp,
   original_osm_relation_xml_sha256:t.raw_relation_xml_sha256,
   pinned_2026_10_12_polygon_sha256:g.source_polygon_261012_sha256,
   pinned_2026_10_12_ordered_members_sha256:g.ordered_members_sha256,
   verified_source_geometry:'PINNED_2026_10_12_PBF_EXACT_LIVE',
   geometric_osm_parent_id:r.geometric_parent_osm_id,
   claimed_de_facto_parent_id_separate:r.claimed_de_facto_parent_osm_id??null,
   legal_moldova_parent_unchanged:r.legal_md_parent_preserved,
   prior_2023_nominal_match:r.match_type_2023,
   cartographic_geometry_acceptance:'ACCEPTED_PINNED_OSM_GEOMETRY',
   cartographic_osm_tag_acceptance:'ACCEPTED_EXACT_RELATION_TAGS',
   osm_display_role_acceptance:'ACCEPTED_AS_OSM_TAGGED_ROLE_ONLY',
   de_facto_legal_2026_parent_certification:'BLOCKED_INCOMPLETE',
   official_boundary_equivalence:'NOT_CLAIMED',
   context_notes:flags,
   distinct_osm_relation_preserved:true,
   permission_to_publish_osm_labeled_candidate:true,
   permission_to_assert_legal_de_facto_administrative_parent:false,
   permission_to_promote_ACTUAL:false
  };
 });
 const c={};
 for(const r of rows)c[r.osm_role_from_tags]=(c[r.osm_role_from_tags]??0)+1;
 return JSON.stringify({
  schema_version:'p907215-two-axis-osm-semantic-reconciliation-v1',
  audit_day:'2026-10-16',
  cartographic_source:'OpenStreetMap relation metadata + independently proven pinned 2026-10-12 geometry',
  attribution:'© OpenStreetMap contributors, ODbL',
  upstream_tag_census_sha256:sha(path.census),
  upstream_verified_geometry_ledger_sha256:sha(path.original),
  upstream_85_case_worklist_sha256:sha(path.worklist),
  legacy_promotion_policy_sha256:sha(path.priorPolicy),
  precise_semantics:'A polygon is accepted as an OSM-described administrative relation, not as a legally approved de facto administrative unit, village footprint, or a cadastral polygon.',
  total:rows.length,
  pinned_geometry_accepted:rows.filter(r=>r.cartographic_geometry_acceptance==='ACCEPTED_PINNED_OSM_GEOMETRY').length,
  relation_tags_accepted:rows.filter(r=>r.cartographic_osm_tag_acceptance==='ACCEPTED_EXACT_RELATION_TAGS').length,
  legal_certification_accepted:0,
  candidate_osm_descriptive_display_allowed:true,
  actual_production_overlay_enabled:false,
  display_requires_explicit_source_attribution:true,
  display_requires_legal_certification_disclaimer:true,
  cartographic_role_counts:Object.fromEntries(Object.entries(c).sort(([a],[b])=>a.localeCompare(b))),
  same_display_name_groups:[...pairs.entries()].filter(([,v])=>v.length>1).map(([n,v])=>({display_name:n,osm_ids:[...v].sort()})),
  osm_tie_break_rule:'Never equate same display names; always use osm_relation_id + role + version.',
  separate_md_de_jure_jurisdiction_immutable:true,
  no_duplicate_osm_polygons:true,
  no_geometry_edit:true,
  no_reparenting:true,
  legacy_semantic_acceptance:'BLOCKED_INCOMPLETE',
  p91_import_allowed:false,
  actual_mutation_allowed:false,
  rows
 },null,2)+'\n';
}
const expected=build();
if(process.argv.includes('--check')){
 assert.equal(readFileSync(path.out,'utf8'),expected,'OSM semantic reconciliation must be byte-reproducible from pinned source tags');
 console.log('P907215_OSM_CARTOGRAPHIC_RECONCILIATION_REPRO_PASS: 85/85 geometries + OSM tags accepted; legal claims 0, ACTUAL unchanged, P9.1 DENIED');
}else{
 writeFileSync(path.out,expected,{flag:'w'});
 console.log('P907215_OSM_CARTOGRAPHIC_RECONCILIATION_BUILT '+JSON.stringify({bytes:Buffer.byteLength(expected),roles:JSON.parse(expected).cartographic_role_counts}));
}
