import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';
const fixed={
 census:'docs/p9.0.7.2.15-osm-tag-census.json',
 source:'docs/p9.0.7.2.15-raw-osm-relations.json.gz.b64',
 recon:'docs/p9.0.7.2.15-osm-semantic-reconciliation.json',
 dual:'docs/p9.0.7.2.15-dual-acceptance-policy.json',
 geometry:'docs/p9.0.6.2-verified-evidence-ledger.json',
 originalWorklist:'docs/p9.0.7.2.11-85-case-worklist.json',
 legacy:'docs/p9.0.4.3-promotion-policy.json'
};
const shaBuf=b=>createHash('sha256').update(b).digest('hex');
const sha=p=>shaBuf(readFileSync(p));
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const census=read(fixed.census),data=read(fixed.recon),policy=read(fixed.dual),geo=read(fixed.geometry),old=read(fixed.originalWorklist),legacy=read(fixed.legacy);
const rawB64=readFileSync(fixed.source,'utf8').trim();
assert.match(rawB64,/^[A-Za-z0-9+/]+={0,2}$/);
const gz=Buffer.from(rawB64,'base64');
assert.equal(gz.toString('base64'),rawB64,'Original evidence corrupted');
assert.equal(gz.length,census.raw_osm_archive.gzip_bytes);
assert.equal(shaBuf(gz),census.raw_osm_archive.gzip_sha256);
const raw=gunzipSync(gz);
assert.equal(raw.length,census.raw_osm_archive.decompressed_bytes);
assert.equal(shaBuf(raw),census.raw_osm_archive.decompressed_sha256);
const archived=JSON.parse(raw.toString('utf8'));
assert.equal(archived.schema_version,'p907215-api-raw-xml-original-v1');
assert.equal(archived.raw_relation_xml.length,85);
assert.deepEqual(archived.api_receipts,census.api_receipts);
assert.equal(census.api_receipts.length,3);
assert.deepEqual(census.api_receipts.map(r=>r.xml_relations),[30,30,25]);
assert.equal(census.source_worklist_sha256,sha(fixed.originalWorklist));
assert.equal(census.source_verified_geometry_ledger_sha256,sha(fixed.geometry));
assert.equal(census.scanned,85);
assert.equal(census.all_versions_match_baseline,true);
assert.deepEqual(census.distinct_versions,[]);
assert.equal(census.osm_tags_complete_for_85,true);
const prev=new Map(geo.rows.map(r=>['osm-r'+r.osm_id,r]));
const histories=new Map(old.rows.map(r=>[r.actual_id,r]));
const actualRows=new Map(data.rows.map(r=>[r.actual_id,r]));
const xml=new Map(archived.raw_relation_xml.map(r=>[r.actual_id,r.xml]));
assert.equal(actualRows.size,85);
assert.equal(xml.size,85);
assert.deepEqual([...actualRows.keys()],old.rows.map(x=>x.actual_id));
let lv4=0,lv8=0,roleCounts={},places={};
for(const r of census.rows){
 const orig=histories.get(r.actual_id),g=prev.get(r.actual_id),s=actualRows.get(r.actual_id);
 assert(orig&&g&&s&&xml.has(r.actual_id),'Unrecognized OSM relation');
 assert.equal(shaBuf(Buffer.from(xml.get(r.actual_id),'utf8')),r.raw_relation_xml_sha256,'Original XML checksum mismatch for '+r.actual_id);
 assert(xml.get(r.actual_id).includes('<relation id="'+r.osm_relation_id+'"'));
 assert.equal(r.baseline_relation_version,g.relation_version_261012);
 assert.equal(r.relation_version,g.relation_version_261012);
 assert.equal(r.relation_timestamp,g.relation_timestamp);
 assert.equal(r.version_matches_pinned_snapshot,true);
 assert.equal(g.live_vs_2026_10_12_exact,true);
 assert.equal(r.tags.type,'boundary');
 assert.equal(r.tags.boundary,'administrative');
 assert(r.tags.name?.length>0);
 assert(['4','8'].includes(r.tags.admin_level));
 if(r.tags.admin_level==='4')lv4++;else lv8++;
 const place=r.tags.place??'NONE';places[place]=(places[place]??0)+1;
 assert.equal(s.osm_name,r.tags.name);
 assert.equal(s.osm_name_ro,r.tags['name:ro']??null);
 assert.equal(s.osm_place,r.tags.place??null);
 assert.equal(s.osm_relation_version,r.relation_version);
 assert.equal(s.original_osm_relation_xml_sha256,r.raw_relation_xml_sha256);
 assert.equal(s.pinned_2026_10_12_polygon_sha256,g.source_polygon_261012_sha256);
 assert.equal(s.pinned_2026_10_12_ordered_members_sha256,g.ordered_members_sha256);
 assert.equal(s.verified_source_geometry,'PINNED_2026_10_12_PBF_EXACT_LIVE');
 assert.equal(s.display_label_existing_ro,orig.name_ro);
 assert.equal(s.geometric_osm_parent_id,orig.geometric_parent_osm_id);
 assert.equal(s.claimed_de_facto_parent_id_separate,orig.claimed_de_facto_parent_osm_id);
 assert.equal(s.legal_moldova_parent_unchanged,true);
 assert.equal(s.distinct_osm_relation_preserved,true);
 assert.equal(s.cartographic_geometry_acceptance,'ACCEPTED_PINNED_OSM_GEOMETRY');
 assert.equal(s.cartographic_osm_tag_acceptance,'ACCEPTED_EXACT_RELATION_TAGS');
 assert.equal(s.osm_display_role_acceptance,'ACCEPTED_AS_OSM_TAGGED_ROLE_ONLY');
 assert.equal(s.de_facto_legal_2026_parent_certification,'BLOCKED_INCOMPLETE');
 assert.equal(s.official_boundary_equivalence,'NOT_CLAIMED');
 assert.equal(s.permission_to_publish_osm_labeled_candidate,true);
 assert.equal(s.permission_to_assert_legal_de_facto_administrative_parent,false);
 assert.equal(s.permission_to_promote_ACTUAL,false);
 roleCounts[s.osm_role_from_tags]=(roleCounts[s.osm_role_from_tags]??0)+1;
}
assert.deepEqual({lv4,lv8},{lv4:1,lv8:84});
assert.deepEqual(places,{village:1,municipality:72,city:4,town:7,NONE:1});
assert.deepEqual(Object.fromEntries(Object.entries(roleCounts).sort(([a],[b])=>a.localeCompare(b))),data.cartographic_role_counts);
assert.deepEqual(data.cartographic_role_counts,{
 OSM_CITY_BOUNDARY:3,
 OSM_CITY_COUNCIL_AREA:1,
 OSM_LEVEL4_MUNICIPALITY_BOUNDARY:1,
 OSM_LEVEL8_MUNICIPALITY_AREA_UNSPECIFIED:24,
 OSM_RURAL_COUNCIL_AREA:46,
 OSM_SETTLEMENT_COUNCIL_AREA:3,
 OSM_TOWN_BOUNDARY:6,
 OSM_VILLAGE_BOUNDARY:1
});
assert.deepEqual(data.same_display_name_groups,[
 {display_name:'Bender',osm_ids:['osm-r12463379','osm-r9581354']},
 {display_name:'Hlinaia',osm_ids:['osm-r8291058','osm-r9301463']}
]);
const checkRole=(id,role)=>assert.equal(actualRows.get(id)?.osm_role_from_tags,role,id);
checkRole('osm-r12463379','OSM_CITY_BOUNDARY');
checkRole('osm-r9581354','OSM_LEVEL4_MUNICIPALITY_BOUNDARY');
checkRole('osm-r8291058','OSM_RURAL_COUNCIL_AREA');
checkRole('osm-r9301463','OSM_SETTLEMENT_COUNCIL_AREA');
checkRole('osm-r19001619','OSM_LEVEL8_MUNICIPALITY_AREA_UNSPECIFIED');
checkRole('osm-r1216706','OSM_VILLAGE_BOUNDARY');
assert(actualRows.get('osm-r19001619').context_notes.includes('LUNGA_MICRODISTRICT_VS_OSM_MUNICIPALITY_TAG_UNRESOLVED'));
assert(actualRows.get('osm-r1216706').context_notes.includes('GEOMETRIC_PARENT_DIFFERS_FROM_HISTORIC_DE_FACTO_CLAIM'));
assert(actualRows.get('osm-r9659979').context_notes.includes('URBAN_LINE_VS_CADASTRAL_ZONE_NOT_LEGALLY_RECONCILED'));
assert.equal(data.upstream_tag_census_sha256,sha(fixed.census));
assert.equal(data.upstream_verified_geometry_ledger_sha256,sha(fixed.geometry));
assert.equal(data.upstream_85_case_worklist_sha256,sha(fixed.originalWorklist));
assert.equal(data.legacy_promotion_policy_sha256,sha(fixed.legacy));
assert.equal(policy.legacy_promotion_policy_path,fixed.legacy);
assert.equal(policy.legacy_policy_changes_in_this_stage,false);
assert.equal(legacy.p91_import_allowed,false);
assert.equal(legacy.semantic_acceptance,'BLOCKED_INCOMPLETE');
assert.equal(old.adjudicated_cases,0);
assert.equal(data.total,85);
assert.equal(data.pinned_geometry_accepted,85);
assert.equal(data.relation_tags_accepted,85);
assert.equal(data.legal_certification_accepted,0);
assert.equal(data.candidate_osm_descriptive_display_allowed,true);
assert.equal(data.actuaL_production_overlay_enabled,false);
assert.equal(data.display_requires_explicit_source_attribution,true);
assert.equal(data.display_requires_legal_certification_disclaimer,true);
assert.equal(data.no_duplicate_osm_polygons,true);
assert.equal(data.no_geometry_edit,true);
assert.equal(data.no_reparenting,true);
assert.equal(data.separate_md_de_jure_jurisdiction_immutable,true);
assert.equal(data.p91_import_allowed,false);
assert.equal(data.actual_mutation_allowed,false);
assert.equal(policy.trust_axes.cartographic.eligible_count,85);
assert.equal(policy.trust_axes.cartographic.completion_status,'ACCEPTED_SOURCE_VERIFIED');
assert.equal(policy.trust_axes.legal.completion_status,'BLOCKED_INCOMPLETE');
assert.equal(policy.trust_axes.legal.accepted_count,0);
assert.equal(policy.display_contract.production_feature_flag_enablement_in_this_pr,false);
assert.equal(policy.semantic_legal_acceptance,'BLOCKED_INCOMPLETE');
assert.equal(policy.p91_import_allowed,false);
assert.equal(policy.actual_mutation_allowed,false);
const child=spawnSync(process.execPath,['docs/p9.0.7.2.15-build-osm-semantic.mjs','--check'],{encoding:'utf8'});
assert.equal(child.status,0,child.stderr||child.stdout);
console.log('P907215_DUAL_ACCEPTANCE_FAIL_CLOSED_PASS: 85 exact OSM geometry + tag roles accepted for descriptive candidate layer, 84 level8 + 1 level4, 46 rural councils, no legal claims, 0 de facto juridical certifications; ACTUAL and P9.1 DENIED');
