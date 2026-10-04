#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import * as turf from '@turf/turf';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const review=await read('data/current/admin-review.json');
const allowed=await read('data/sources/ro-release-gate-exceptions.json');
const geo=await read('public/geo/current/ro-administrative.geojson');
const catalog=await read('data/current/entities.json');
const semanticEvidence=await read('data/sources/ro-level9-exception-evidence.json');
const official=await read('data/current/ro-official-reconciliation.json');
const officialApplication=await read('data/current/ro-official-application.json');
const officialExceptionAudit=await read('data/current/ro-official-exception-audit.json');
const officialAllowed=await read('data/sources/ro-official-reconciliation-exceptions.json');
const officialOnlyReviewed=await read('data/sources/ro-official-only-reviewed-resolutions.json');
const otherLevelReviewed=await read('data/sources/ro-other-level-reviewed-resolutions.json');
const semanticTypeReviewed=await read('data/sources/ro-semantic-type-reviewed-resolutions.json');
const settlementPolicy=await read('data/sources/actual-settlement-policy.json');
const ancpiFallbacks=await read('data/sources/ro-ancpi-uat-fallbacks.json');
const ojdulaReviewBytes=await readFile('data/sources/ro-ancpi-ojdula-reviewed.json');
const ojdulaReview=JSON.parse(ojdulaReviewBytes.toString('utf8'));
const sha256=value=>createHash('sha256').update(value).digest('hex');
const failures=[],checks=[];
const check=(name,ok,detail)=>{checks.push({name,ok,detail});if(!ok)failures.push({name,detail})};
const ro=(review.items||[]).filter(x=>x.jurisdiction==='RO');
const key=x=>String(x.osm_relation_id)+'|'+x.issue;
const expected=new Map((allowed.allowed_review_items||[]).map(x=>[key(x),x]));
const actual=new Map(ro.map(x=>[key(x),x]));
check('no_new_ro_review_exceptions',[...actual.keys()].every(k=>expected.has(k)),{actual:[...actual.keys()]});
check('documented_ro_exception_set_is_stable',[...expected.keys()].every(k=>actual.has(k)),{expected:[...expected.keys()]});
check('documented_exception_classifications_are_stable',ro.every(x=>!expected.has(key(x))||expected.get(key(x)).classification===x.entity_type),{});
const roByRelation=new Map((catalog.entities||[]).filter(x=>x.jurisdiction==='RO').map(x=>[Number(x.osm?.relation_id),x]));
const unresolvedSemantic=(semanticEvidence.items||[]).flatMap(ev=>{
 const entity=roByRelation.get(Number(ev.osm_relation_id));
 const expectedParent=ev.osm_parent_relation_id?`osm-r${ev.osm_parent_relation_id}`:null;
 const ok=entity
  && entity.type===ev.semantic_classification
  && entity.parent_id===expectedParent
  && entity.review_required===false
  && entity.classification?.evidence==='data/sources/ro-level9-exception-evidence.json';
 return ok?[]:[{
  osm_relation_id:ev.osm_relation_id,
  expected_classification:ev.semantic_classification,
  expected_parent_id:expectedParent,
  actual_classification:entity?.type||null,
  actual_parent_id:entity?.parent_id||null,
  review_required:entity?.review_required??null,
  evidence:entity?.classification?.evidence||null
 }];
});
check('audited_ro_level9_semantics_are_encoded',unresolvedSemantic.length===0,{unresolved:unresolvedSemantic});
check('ro_official_reconciliation_pass',official.status==='PASS',{status:official.status});
check('ro_official_reconciliation_has_no_unmatched',official.summary?.unmatched_osm_count===0,{count:official.summary?.unmatched_osm_count});
check('ro_official_reconciliation_has_no_duplicates',official.summary?.duplicate_legal_mapping_count===0,{count:official.summary?.duplicate_legal_mapping_count});
check('ro_official_reconciliation_has_no_unresolved_official_only',official.summary?.official_only_count===0,{count:official.summary?.official_only_count});
check('ro_official_reconciliation_has_no_unresolved_other_level',official.summary?.represented_at_other_osm_level_count===0,{count:official.summary?.represented_at_other_osm_level_count});
check('ro_official_reconciliation_has_no_unresolved_semantic_type_conflicts',official.summary?.type_mismatch_count===0,{count:official.summary?.type_mismatch_count});
check('ro_official_application_pass',officialApplication.status==='PASS',{status:officialApplication.status,summary:officialApplication.summary});
check('ro_official_application_is_complete',officialApplication.summary?.applied_count===official.summary?.osm_admin_level_8_count,{applied:officialApplication.summary?.applied_count,expected:official.summary?.osm_admin_level_8_count});

const exactSetCheck=(name,actualRows,expectedRows,keyOf,stableFields=[])=>{
 const actualMap=new Map((actualRows||[]).map(x=>[keyOf(x),x]));
 const expectedMap=new Map((expectedRows||[]).map(x=>[keyOf(x),x]));
 const missing=[...expectedMap.keys()].filter(k=>!actualMap.has(k));
 const unexpected=[...actualMap.keys()].filter(k=>!expectedMap.has(k));
 const changed=[];
 for(const [k,expectedRow] of expectedMap){
  const actualRow=actualMap.get(k);if(!actualRow)continue;
  const fields=stableFields.filter(field=>String(actualRow?.[field]??'')!==String(expectedRow?.[field]??''));
  if(fields.length)changed.push({key:k,fields,expected:expectedRow,actual:actualRow});
 }
 check(name,missing.length===0&&unexpected.length===0&&changed.length===0,{missing,unexpected,changed});
};
exactSetCheck(
 'ro_official_only_set_is_stable',
 official.official_only,officialAllowed.allowed_official_only,
 x=>String(x.legal_id),['legal_name','legal_type','legal_parent_name']
);
exactSetCheck(
 'ro_reviewed_official_only_resolution_set_is_stable',
 official.reviewed_official_only_resolutions,officialOnlyReviewed.items,
 x=>String(x.legal_id),['legal_name','legal_type','legal_parent_name','classification','covering_osm_relation_id','covering_osm_relation_legal_id','expected_parent_osm_relation_id']
);
const officialOnlyAuditById=new Map((officialExceptionAudit.reviewed_official_only_resolutions||[]).map(x=>[String(x.legal_id),x]));
const unstableReviewedOfficialOnly=(officialOnlyReviewed.items||[]).flatMap(x=>{
 const audit=officialOnlyAuditById.get(String(x.legal_id));
 return audit?.stable===true?[]:[{legal_id:String(x.legal_id),audit:audit||null}];
});
check('ro_reviewed_official_only_geometry_audit_pass',unstableReviewedOfficialOnly.length===0,{failed:unstableReviewedOfficialOnly});
const represented=(official.represented_at_other_osm_level||[]).flatMap(x=>(x.osm||[]).map(o=>({legal_id:x.legal_id,osm_relation_id:o.relation_id,admin_level:o.admin_level})));
exactSetCheck(
 'ro_represented_at_other_level_set_is_stable',
 represented,officialAllowed.allowed_represented_at_other_osm_level,
 x=>String(x.legal_id)+'|'+String(x.osm_relation_id),['admin_level']
);
exactSetCheck(
 'ro_reviewed_other_level_resolution_set_is_stable',
 official.reviewed_other_level_resolutions,otherLevelReviewed.items,
 x=>String(x.legal_id),['legal_name','legal_type','legal_parent_id','legal_parent_name','classification','osm_relation_id','osm_relation_name','osm_admin_level','osm_entity_type','expected_catalog_parent_id']
);
const otherLevelAuditById=new Map((officialExceptionAudit.reviewed_other_level_resolutions||[]).map(x=>[String(x.legal_id),x]));
const unstableReviewedOtherLevel=(otherLevelReviewed.items||[]).flatMap(x=>{
 const audit=otherLevelAuditById.get(String(x.legal_id));
 return audit?.stable===true?[]:[{legal_id:String(x.legal_id),audit:audit||null}];
});
check('ro_reviewed_other_level_structure_audit_pass',unstableReviewedOtherLevel.length===0,{failed:unstableReviewedOtherLevel});
exactSetCheck(
 'ro_legal_parent_mismatch_set_is_stable',
 official.parent_mismatches,officialAllowed.allowed_parent_mismatches,
 x=>String(x.osm_relation_id)+'|'+String(x.legal_id),['osm_parent_name','legal_parent_name']
);
exactSetCheck(
 'ro_osm_semantic_type_conflict_set_is_stable',
 official.type_mismatches,officialAllowed.allowed_osm_semantic_type_conflicts,
 x=>String(x.osm_relation_id)+'|'+String(x.legal_id),['osm_claimed_legal_type','legal_type']
);
exactSetCheck(
 'ro_reviewed_semantic_type_resolution_set_is_stable',
 official.reviewed_semantic_type_resolutions,semanticTypeReviewed.items,
 x=>String(x.osm_relation_id)+'|'+String(x.legal_id),['osm_name','legal_name','legal_type','legal_parent_name','classification','osm_claimed_legal_type','expected_parent_osm_relation_id']
);
const semanticTypeAuditByKey=new Map((officialExceptionAudit.reviewed_semantic_type_resolutions||[]).map(x=>[String(x.osm_relation_id)+'|'+String(x.legal_id),x]));
const unstableReviewedSemanticTypes=(semanticTypeReviewed.items||[]).flatMap(x=>{
 const audit=semanticTypeAuditByKey.get(String(x.osm_relation_id)+'|'+String(x.legal_id));
 return audit?.stable===true?[]:[{osm_relation_id:Number(x.osm_relation_id),legal_id:String(x.legal_id),audit:audit||null}];
});
check('ro_reviewed_semantic_type_geometry_history_audit_pass',unstableReviewedSemanticTypes.length===0,{failed:unstableReviewedSemanticTypes});

const fallbackBinding=settlementPolicy?.administrative_geometry_fallbacks?.RO??null;
if(fallbackBinding){
 const fallbackIds=(fallbackBinding.legal_ids||[]).map(String).sort();
 const sourceIds=(ancpiFallbacks.features||[]).map(x=>String(x.legal_id)).sort();
 check('ancpi_fallback_policy_source_identity_set_is_exact',JSON.stringify(fallbackIds)===JSON.stringify(sourceIds),{policy:fallbackIds,source:sourceIds});
 const ojdulaOverride=(fallbackBinding.reviewed_geometry_overrides||[]).find(x=>String(x.legal_id)==='64602');
 const hybridPartitionEnabled=ojdulaOverride?.disposition==='partition_osm_shell_by_ancpi_shared_boundary';
 const bretcu=(catalog.entities||[]).filter(e=>e.id==='siruta-u64096');
 const source=(ancpiFallbacks.features||[]).filter(x=>String(x.legal_id)==='64096');
 const master=(geo.features||[]).filter(x=>x.properties?.catalog_id==='siruta-u64096');
 const entity=bretcu[0]||null;
 check('bretcu_ancpi_fallback_policy_binding_is_exact',
  fallbackBinding.path==='data/sources/ro-ancpi-uat-fallbacks.json'
  && fallbackBinding.mode==='ACTUAL_RO_ANCPI_UAT_FALLBACKS'
  && fallbackIds.includes('64096'),
  {binding:fallbackBinding});
 check('bretcu_ancpi_fallback_source_is_exact',
  source.length===1
  && Number(source[0]?.source_object_id)===1227
  && source[0]?.inspire_id_local_id==='1.145.64096'
  && source[0]?.geometry_role==='administrative_boundary'
  && source[0]?.geometry_scope==='uat_fallback',
  {source_count:source.length,source:source[0]??null});
 check('bretcu_ancpi_fallback_catalog_contract_is_exact',
  bretcu.length===1
  && entity?.legal?.registry==='SIRUTA'
  && String(entity?.legal?.id||'')==='64096'
  && entity?.type==='commune'
  && entity?.parent_id==='osm-r2248621'
  && entity?.representation?.source==='ANCPI RELUAT'
  && entity?.geometry?.role==='administrative_boundary'
  && entity?.geometry?.scope===(hybridPartitionEnabled?'uat_hybrid_partition':'uat_fallback')
  &&(!hybridPartitionEnabled||entity?.representation?.partition_mode==='osm_shell_ancpi_shared_boundary_partition')
  && entity?.geometry?.legal_geometry_equivalence_asserted===false
  && entity?.review_required===false,
  {entity_count:bretcu.length,entity});
 check('bretcu_ancpi_fallback_master_geometry_is_exactly_once',
  master.length===1&&['Polygon','MultiPolygon'].includes(master[0]?.geometry?.type),
  {feature_count:master.length});
 if(ojdulaOverride){
  const ojdula=(catalog.entities||[]).filter(e=>e.id==='osm-r14735731');
  const ojdulaMaster=(geo.features||[]).filter(x=>x.properties?.catalog_id==='osm-r14735731');
  const oe=ojdula[0]||null;
  const os=ojdulaReview.feature||null;
  const om=ojdulaMaster[0]||null;
  check('ojdula_review_evidence_sha256_is_exact',ojdulaOverride.evidence==='data/sources/ro-ancpi-ojdula-reviewed.json'&&ojdulaOverride.evidence_sha256===sha256(ojdulaReviewBytes),{expected:ojdulaOverride.evidence_sha256,actual:sha256(ojdulaReviewBytes)});
  const hybridApplication=(officialApplication.ancpi_fallbacks||[]).find(x=>x.mode==='partition_osm_shell_by_ancpi_shared_boundary'&&x.entity_id==='osm-r14735731');
  check('ojdula_geometry_override_contract_is_exact',
   hybridPartitionEnabled
   ?(
    ojdula.length===1&&os!==null&&ojdulaMaster.length===1
    &&String(oe?.legal?.id||'')==='64602'
    &&oe?.representation?.source==='OpenStreetMap'
    &&Number(oe?.representation?.reviewed_osm_relation_id)===14735731
    &&oe?.representation?.osm_relation_geometry_accepted_as_outer_shell===true
    &&oe?.representation?.internal_boundary_source==='ANCPI RELUAT'
    &&oe?.representation?.partition_mode==='osm_shell_ancpi_shared_boundary_partition'
    &&oe?.geometry?.role==='administrative_boundary'
    &&oe?.geometry?.scope==='uat_hybrid_partition'
    &&Number(os?.source_object_id)===1167
    &&os?.inspire_id_local_id==='1.145.64602'
   )
   :(
    ojdula.length===1&&os!==null&&ojdulaMaster.length===1
    &&String(oe?.legal?.id||'')==='64602'
    &&oe?.representation?.source==='ANCPI RELUAT'
    &&Number(oe?.representation?.reviewed_osm_relation_id)===14735731
    &&oe?.representation?.osm_relation_geometry_accepted===false
    &&oe?.geometry?.role==='administrative_boundary'
    &&oe?.geometry?.scope==='uat_fallback'
    &&Number(os?.source_object_id)===1167
    &&os?.inspire_id_local_id==='1.145.64602'
   ),
   {entity:oe,source_object_id:os?.source_object_id??null,hybrid_partition_enabled:hybridPartitionEnabled});
  if(hybridPartitionEnabled){
   const audit=hybridApplication?.partition?.audit||null;
   check('bretcu_ojdula_hybrid_partition_audit_is_exact',
    Boolean(hybridApplication)
    &&audit?.method==='osm_shell_ancpi_shared_boundary_polygonization_v1'
    &&Number(audit?.shell_symmetric_difference_m2)<=0.01
    &&Number(audit?.overlap_m2)<=0.01
    &&audit?.ancpi_shared_edges_preserved===true
    &&Number(audit?.ancpi_shared_edge_count)>0,
    {application:hybridApplication??null});
  }else{
   check('ojdula_master_matches_ancpi_exactly',
    JSON.stringify(om?.geometry??null)===JSON.stringify(os?.geometry??null),
    {});
  }
  const bm=(geo.features||[]).find(x=>x.properties?.catalog_id==='siruta-u64096');
  let overlapKm2=null;
  try{
   const inter=turf.intersect(turf.featureCollection([om,bm]));
   overlapKm2=inter?turf.area(inter)/1e6:0;
  }catch{}
  check('ojdula_bretcu_current_uat_geometries_do_not_overlap',
   overlapKm2!==null&&overlapKm2<0.000001,
   {overlap_km2:overlapKm2});
 }
}

const bad=(geo.features||[]).filter(f=>!f.geometry||!['Polygon','MultiPolygon'].includes(f.geometry.type)||!Array.isArray(f.geometry.coordinates)||!f.geometry.coordinates.length);
check('all_ro_features_have_polygonal_geometry',bad.length===0,{count:bad.length});
const ungheni=(geo.features||[]).filter(f=>Number(f.properties?.osm_relation_id)===18967922||f.properties?.catalog_id==='osm-r18967922');
check('known_cross_jurisdiction_ungheni_removed',ungheni.length===0,{present:ungheni.length});
const report={schema_version:1,generated_at:new Date().toISOString(),jurisdiction:'RO',status:failures.length?'FAIL':'PASS',policy:'RO release requires zero unresolved/duplicate SIRUTA matches, zero unresolved official-only UATs, zero unresolved cross-level UAT representations, zero unresolved OSM-vs-SIRUTA semantic type conflicts, and complete official application. OSM remains the primary geometry source. Any activated ANCPI/RELUAT UAT fallback must be explicitly policy-bound, source-bound and identity-bound, with no fabricated OSM relation. Reviewed missing-boundary, exceptional-level and semantic-type resolutions remain fail-closed.',checks,failures};
await writeFile('data/current/ro-release-gate.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));if(failures.length)process.exit(1);
