// P9.0.7.2.19 — immutable evidence-consolidation gate, NOT geometry recertification or legal promotion.
// Network-free, read-only, 85 OSM descriptive roles; no ACTUAL mutation or live OSM requests.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

const read=p=>JSON.parse(readFileSync(p,'utf8'));
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const manifest=read('docs/p9.0.7.2.19-acceptance-manifest.json');
const policy=read('docs/p9.0.4.3-promotion-policy.json');
const roles=read('public/data/p907216-osm-roles.json');
const semantic=read('docs/p9.0.7.2.15-osm-semantic-reconciliation.json');
const ledger=read('docs/p9.0.6.2-verified-evidence-ledger.json');
const census=read('docs/p9.0.7.2.15-osm-tag-census.json');
const matrix=read('docs/p9.0.6.3-final-semantic-matrix.json');
const actual=read('data/current/actual-release-manifest.json');
const index=read('public/data/actual-entities.json');
const exactHash=/^[a-f0-9]{64}$/;
function verifyBoundary(m,p,s,r){
 assert.equal(m.schema_version,'p907219-cartographic-acceptance-dossier-v1');
 assert.equal(m.scope,'P9_85_EXISTING_OSM_DESCRIPTIVE_ROLES_ONLY');
 assert.equal(m.baseline_main_sha,'ef47db7be28267dad1e8288d0c44af47dd34b870');
 assert.equal(m.juridical.status,'BLOCKED_INCOMPLETE');
 assert.equal(p.semantic_acceptance,'BLOCKED_INCOMPLETE');
 assert.equal(p.p91_import_allowed,false);
 assert.equal(p.fully_certified_contemporary_memberships,0);
 assert.equal(p.candidate_count,85);
 assert.equal(m.juridical.p91_import_allowed,false);
 assert.equal(m.juridical.actual_mutation_allowed,false);
 assert.equal(m.juridical.authorization_to_promote,false);
 assert.equal(m.juridical.de_facto_full_polygon_control_certified,0);
 assert.equal(m.juridical.legal_md_parent_unchanged,true);
 assert.equal(m.juridical.distinct_osm_roles_not_jurisdictions,true);
 assert.equal(s.p91_import_allowed,false);
 assert.equal(s.actual_mutation_allowed,false);
 assert.equal(s.legal_certification_accepted,0);
 assert.equal(s.separate_md_de_jure_jurisdiction_immutable,true);
 assert.equal(s.no_duplicate_osm_polygons,true);
 assert.equal(s.no_geometry_edit,true);
 assert.equal(s.no_reparenting,true);
 assert.equal(r.no_new_geometries,true);
 assert.equal(r.no_new_jurisdictions,true);
 assert.equal(r.existing_actual_legal_parent_unchanged,true);
 assert.equal(r.legal_de_facto_certified,0);
 assert.equal(r.no_new_OSM_API_calls_at_runtime,true);
 assert.equal(r.source_geometry_byte_equivalence_to_osm_2026_10_12_claimed,false);
 assert.equal(m.cartographic.geometry_files_byte_identical_claimed,false);
 assert.equal(m.cartographic.live_capture_atomic,false);
 assert.equal(m.cartographic.live_freshness_guaranteed_after_audit,false);
 assert.equal(m.no_live_osm_reread_in_this_dossier,true);
 assert.equal(m.no_geometry_reimport_or_reconstruction_in_this_dossier,true);
 assert.equal(m.no_new_polygons,true);
 assert.equal(m.no_changes_to_actual_release,true);
 assert.deepEqual(m.independent_edges,[
  'md_cuatm_legal_parent','osm_geometric_containment_parent',
  'dated_de_facto_administrative_claim','effective_control_scope_unverified']);
 assert.equal(m.residual_legal_gates.length,4);
}
function uniqueRows(rows,key,count){
 assert.equal(rows.length,count,'unexpected scoped case count');
 const ids=rows.map(x=>String(x[key]));
 assert.equal(new Set(ids).size,count,'duplicate scoped ID');
 return new Map(rows.map(x=>[String(x[key]),x]));
}
function verifyCase(r,src,evidence,tags,old){
 assert(src&&evidence&&tags&&old,'missing case lineage '+r.id);
 const id=String(r.osm_relation_id);
 assert.equal(r.id,'osm-r'+id);
 assert.equal(r.id,src.actual_id);
 assert.equal(r.id,tags.actual_id);
 assert.equal(r.id,old.actual_id);
 assert.equal(r.existing_actual_entity_id,r.id);
 assert.equal(r.osm_relation_version,evidence.relation_version_261012);
 assert.equal(r.osm_relation_version,src.osm_relation_version);
 assert.equal(r.osm_relation_version,tags.relation_version);
 assert.equal(r.osm_relation_timestamp,evidence.relation_timestamp);
 assert.equal(r.osm_relation_timestamp,src.osm_relation_timestamp);
 assert.equal(r.osm_relation_timestamp,tags.relation_timestamp);
 assert.equal(src.pinned_2026_10_12_polygon_sha256,evidence.source_polygon_261012_sha256);
 assert.equal(src.pinned_2026_10_12_ordered_members_sha256,evidence.ordered_members_sha256);
 assert.equal(tags.raw_relation_xml_sha256,src.original_osm_relation_xml_sha256);
 assert.match(evidence.live_polygon_edges_sha256,exactHash);
 assert.equal(evidence.snapshot_polygon_status,'EXACT_COORDINATE_REPRESENTATION');
 assert.equal(evidence.live_vs_2026_10_12_exact,true);
 assert.equal(src.verified_source_geometry,'PINNED_2026_10_12_PBF_EXACT_LIVE');
 assert.equal(src.cartographic_geometry_acceptance,'ACCEPTED_PINNED_OSM_GEOMETRY');
 assert.equal(src.cartographic_osm_tag_acceptance,'ACCEPTED_EXACT_RELATION_TAGS');
 assert.equal(src.osm_display_role_acceptance,'ACCEPTED_AS_OSM_TAGGED_ROLE_ONLY');
 assert.equal(src.official_boundary_equivalence,'NOT_CLAIMED');
 assert.equal(src.permission_to_assert_legal_de_facto_administrative_parent,false);
 assert.equal(src.permission_to_promote_ACTUAL,false);
 assert.equal(src.legal_moldova_parent_unchanged,true);
 assert.equal(r.geometry_source,'EXISTING_ACTUAL_PUBLIC_GEOJSON_ONLY');
 assert.equal(r.legal_de_facto_certified,false);
 assert.equal(old.effective_2026_full_polygon_administrative_control_certified,false);
 assert.equal(old.p91_import_allowed,false);
 assert.equal(old.legal_moldova_parent_preserved,true);
 assert.equal(old.administrative_acceptance,'BLOCKED_INCOMPLETE');
 return {id:r.id,osm_relation_id:id,cartographic_role:r.role,osm_relation_version:r.osm_relation_version,
  pinned_source_edges_sha256:evidence.live_polygon_edges_sha256,
  osg_geometric_parent_only:src.geometric_osm_parent_id??null,
  claimed_de_facto_parent_separate:src.claimed_de_facto_parent_id_separate??null,
  juridical_de_facto_certification:'BLOCKED_INCOMPLETE',geometry_acceptance:'OSM_EDGE_FIDELITY_PROVEN_BY_PRIOR_PINNED_AUDIT'};
}
function assertEvidence(m){
 assert.equal(m.audit_date_utc,'2026-10-16');
 assert.equal(m.source.osm_pbf_sha256,'4ebd791fb953a22961e40ef7921914251c7b7292c33ed1e90e919488f1a397b8');
 assert.equal(m.source.osm_replication_timestamp,'2026-10-12T20:21:35Z');
 assert.equal(m.source.actual_snapshot,'actual-a9e5a4ddcb5277ef');
 assert.equal(m.source.actual_release_fingerprint_sha256,'a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446');
 assert.equal(m.source.osm_attribution,'© OpenStreetMap contributors, ODbL');
 const c=m.cartographic;
 assert.equal(c.status,'CLOSED_EVIDENCE_BOUND');
 for(const k of ['relation_roles','geometries_equal_by_7_decimal_osm_edge_multiset','source_closure_way_node_live'])assert.equal(c[k],85);
 for(const k of ['missing_geometries','geometry_differences','duplicate_geometries','topological_interior_overlaps'])assert.equal(c[k],0);
 assert.equal(m.proofs.p907215.accepted_osm_roles,85);
 assert.equal(m.proofs.p907215.certified_legal_roles,0);
 assert.equal(m.proofs.p907216.public_roles,85);
 assert.equal(m.proofs.p907217.workflow_run_id,38969053338);
 assert.equal(m.proofs.p907217.artifact_id,12075548658);
 assert.equal(m.proofs.p907217.artifact_zip_sha256,'dc253e6b065b53f55735ea7f009421ea5e8f7a6203bf9c143bad7c2cb94d4542');
 assert.equal(m.proofs.p907217.verified_geometry_count,85);
 assert.deepEqual(m.proofs.p907218.workflow_run_ids,[38972358011,38972594502]);
 assert.equal(m.proofs.p907218.final_artifact_id,12077273752);
 assert.equal(m.proofs.p907218.final_artifact_zip_sha256,'dd4e7e388b49357762de5a230b613e4bc6bebe0f38c39a4c551c799946f6246a');
 assert.equal(m.proofs.p907218.verdict,'COMPLETE_85_UNCHANGED');
 assert.equal(m.proofs.p907218.verified_live_relations,85);
 assert.equal(m.proofs.integration.pr_number,359);
 assert.equal(m.proofs.integration.squash_main_sha,m.baseline_main_sha);
 assert.equal(m.proofs.integration.post_merge_workflows_success,12);
 assert.equal(m.proofs.integration.post_merge_workflows_total,12);
 assert.equal(m.proofs.integration.pages_http_200_verified,true);
 assert.equal(m.proofs.integration.public_catalog_roles,85);
 for(const file of [m.proofs.p907215.document,m.proofs.p907216.document,m.proofs.p907216.catalog,
  m.proofs.p907217.document,m.proofs.p907218.document])assert.doesNotThrow(()=>readFileSync(file));
}
verifyBoundary(manifest,policy,semantic,roles);
assertEvidence(manifest);
assert.equal(ledger.snapshot_261012.sha256,manifest.source.osm_pbf_sha256);
assert.equal(ledger.snapshot_261012.replication_timestamp,manifest.source.osm_replication_timestamp);
assert.equal(ledger.counts.candidates,85);
assert.equal(ledger.counts.source_errors,0);
assert.equal(census.scanned,85);
assert.equal(census.osm_tags_complete_for_85,true);
assert.equal(census.all_versions_match_baseline,true);
assert.equal(semantic.total,85);
assert.equal(semantic.pinned_geometry_accepted,85);
assert.equal(semantic.relation_tags_accepted,85);
assert.equal(matrix.scope_count,85);
assert.equal(matrix.p91_import_allowed,false);
assert.equal(matrix.semantic_acceptance,'BLOCKED_INCOMPLETE');
assert.equal(roles.contract,'p907216-osm-role-ui-overlay-v1');
assert.equal(roles.osm_evidence_sha256,hash('docs/p9.0.7.2.15-osm-semantic-reconciliation.json'));
assert.equal(semantic.upstream_tag_census_sha256,hash('docs/p9.0.7.2.15-osm-tag-census.json'));
assert.equal(semantic.upstream_verified_geometry_ledger_sha256,hash('docs/p9.0.6.2-verified-evidence-ledger.json'));
assert.equal(roles.existing_actual_snapshot_id,actual.snapshot_id);
assert.equal(roles.existing_actual_release_fingerprint_sha256,actual.release_fingerprint_sha256);
assert.equal(actual.snapshot_id,manifest.source.actual_snapshot);
assert.equal(actual.release_fingerprint_sha256,manifest.source.actual_release_fingerprint_sha256);
assert.equal(roles.relation_count,85);
assert.equal(roles.indexed_actual_entities,85);
assert.equal(index.entity_count,roles.existing_actual_entity_count);
const entities=uniqueRows(index.entities,'id',index.entity_count);
const candidates=uniqueRows(roles.rows,'id',85);
const bySrc=uniqueRows(semantic.rows,'actual_id',85);
const byTags=uniqueRows(census.rows,'actual_id',85);
const byHistorical=uniqueRows(matrix.rows,'actual_id',85);
const byLedger=new Map(ledger.rows.filter(x=>x.roles.includes('candidate_85')).map(x=>[String(x.osm_id),x]));
assert.equal(byLedger.size,85);
const rows=[];
for(const role of roles.rows){
 assert(entities.has(role.id),'published entity ID missing '+role.id);
 rows.push(verifyCase(role,bySrc.get(role.id),byLedger.get(String(role.osm_relation_id)),byTags.get(role.id),byHistorical.get(role.id)));
}
assert.equal(rows.length,85);
assert.equal(new Set(rows.map(x=>x.id)).size,85);
for(const [a,b] of [['osm-r9581354','osm-r12463379'],['osm-r8291058','osm-r9301463']]){
 assert(candidates.has(a)&&candidates.has(b));
 assert.notEqual(a,b,'homonymous OSM roles were collapsed');
}
assert(rows.some(r=>r.id==='osm-r1216706'&&r.claimed_de_facto_parent_separate&&r.claimed_de_facto_parent_separate!==r.osg_geometric_parent_only));
for(const id of ['osm-r19001619','osm-r9659979'])assert(candidates.has(id),'special-case missing '+id);
if(process.argv.includes('--self-test')){
 assert.throws(()=>verifyBoundary(manifest,{...policy,p91_import_allowed:true},semantic,roles),/true !== false/);
 assert.throws(()=>verifyBoundary({...manifest,juridical:{...manifest.juridical,authorization_to_promote:true}},policy,semantic,roles),/true !== false/);
 assert.throws(()=>uniqueRows([{id:'x'},{id:'x'}],'id',2),/duplicate scoped ID/);
 const example=roles.rows[0];
 assert.throws(()=>verifyCase({...example,osm_relation_version:example.osm_relation_version+1},
  bySrc.get(example.id),byLedger.get(String(example.osm_relation_id)),byTags.get(example.id),byHistorical.get(example.id)),/Expected values to be strictly equal/);
 console.log('P907219_FAIL_CLOSED_SELF_TEST_PASS');process.exit(0);
}
if(!process.argv.includes('--audit'))throw Error('Use --self-test or --audit');
const output={schema_version:'p907219-evidence-reconciliation-verdict-v1',
 baseline_main_sha:manifest.baseline_main_sha,audit_only:true,
 evidence_provenance_verified_offline:true,
 external_github_artifacts_re_read_during_this_gate:false,
 geometry_recomputed_during_this_gate:false,
 osm_network_requests_during_this_gate:0,
 cartographic_acceptance:'CLOSED_EVIDENCE_BOUND',
 legal_semantic_acceptance:'BLOCKED_INCOMPLETE',
 p91_import_allowed:false,actual_mutation_allowed:false,
 counts:{scope:85,published_osm_roles:85,pinned_geometry_evidence_bound:85,
 contemporary_de_facto_full_polygon_control_certified:0,
 open_legal_gates:manifest.residual_legal_gates.length},
 evidence_sources:manifest.proofs,rows,verdict:'CARTOGRAPHIC_PASS_LEGAL_DENIED'};
mkdirSync(resolve('outputs/P9.0.7.2.19'),{recursive:true});
writeFileSync(resolve('outputs/P9.0.7.2.19/acceptance-verdict.json'),JSON.stringify(output,null,2)+'\n');
console.log('P907219_SUMMARY '+JSON.stringify({verdict:output.verdict,counts:output.counts}));
