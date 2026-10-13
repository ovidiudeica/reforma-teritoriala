// P9.0.4: deterministic, read-only semantic reconciliation for Nistrenia ACTUAL MD overlays.
// Audit dispositions never establish sovereignty, effective control or new ACTUAL membership.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const ROOT=new URL('../../',import.meta.url),OUT=new URL('../../outputs/P9.0.4/',import.meta.url);
const json=async p=>JSON.parse(await readFile(new URL(p,ROOT),'utf8'));
const sha=x=>createHash('sha256').update(x).digest('hex');
const fail=x=>{throw Error('P904 contract: '+x);};
const data=await json('docs/p9.0.4-geometric-candidates.json');
const policy=await json('docs/p9.0.4-semantic-decisions.json');
const prior=await json('docs/p9.0.3-missing-relations.json');
const checkedById=new Map(),controlEnum=new Set(['constitutional_local_administration_reported','outside_constitutional_control_reported','mixed_or_locality_specific','not_established_for_exact_polygon']);
const linkEnum=new Set(['osm_de_facto_parent_candidate','no_geometric_parent','overlap_not_parent','boundary_not_parent','unmapped_no_polygon']);
const parentIds=['944727','1702214','1702215','1702216','1702217','1702218','1702219'];
const reuseIds=['1216706','8289751','9301464','9659979','12215667','12463378','12463379'];
const rootCounts={contains:88,overlap:15,boundary:50};
const parentCounts={'944727':4,'1702214':16,'1702215':10,'1702216':13,'1702217':23,'1702218':16,'1702219':3};
const allowedRows=/^(osm-r[1-9][0-9]*|stat-MD[0-9]+)$/;
function verifyInput(){
 if(data.schema_version!=='p904-geometric-candidates-v1'||data.candidates?.length!==153||data.source_snapshot!=='actual-a9e5a4ddcb5277ef')fail('geometry baseline metadata');
 if(data.source_run_id!==38372981580||data.source_artifact_id!==11799998411||!(/^[a-f0-9]{64}$/.test(data.source_sha256)))fail('missing P9.0.2 evidence binding');
 if(policy.schema_version!=='p904-semantic-decisions-v1'||policy.review_as_of!=='2026-10-13')fail('decision schema');
 if(prior.expected_missing_count!==84||new Set(prior.missing_relations.map(x=>x.id)).size!==84)fail('P9.0.3 binding');
 if(policy.jurisdiction.legal_sovereignty!=='Republica Moldova'||policy.jurisdiction.recognized_sovereign_state!==false||
   policy.jurisdiction.de_facto_administrative_layer!==true||policy.jurisdiction.prohibit_cross_layer_parent_rewrite!==true||
   policy.jurisdiction.osm_de_facto_relation!=='65335'||policy.jurisdiction.official_md_relation!=='2607033')fail('jurisdiction semantics');
 if(JSON.stringify([...policy.de_facto_top_level_osm_ids].sort())!==JSON.stringify([...parentIds].sort()))fail('top-level seven');
 if(JSON.stringify([...policy.immutable_reuse_subarea_osm_ids].sort())!==JSON.stringify([...reuseIds].sort()))fail('seven topology reuse IDs');
 const count={}, parents={};
 for(const row of data.candidates){
  if(!allowedRows.test(row.actual_id)||checkedById.has(row.actual_id)||!row.name)fail('invalid or duplicate candidate '+row.actual_id);
  if(!Object.hasOwn(rootCounts,row.root_relation))fail('unexpected geometric relation');
  if(row.geometric_parent&&!parentIds.includes(row.geometric_parent))fail('unknown parent');
  if(row.geometric_parent&&row.root_relation!=='contains')fail('parent for noncontained shape');
  checkedById.set(row.actual_id,row);count[row.root_relation]=(count[row.root_relation]||0)+1;
  if(row.geometric_parent)parents[row.geometric_parent]=(parents[row.geometric_parent]||0)+1;
 }
 if(JSON.stringify(count)!==JSON.stringify(rootCounts))fail('root relation counts '+JSON.stringify(count));
 for(const [id,n]of Object.entries(parentCounts))if(parents[id]!==n)fail('parent count '+id+' ('+parents[id]+')');
 if(!checkedById.has('osm-r2607033')||!checkedById.has('stat-MD12')||!checkedById.has('stat-MD120'))fail('missing distinct official/statistical aggregate');
 for(const id of reuseIds)if(!checkedById.has('osm-r'+id))fail('missing reusable OSM geometry '+id);
 if(!policy.sources||Object.keys(policy.sources).length<6)fail('source registry');
 for(const [id,s]of Object.entries(policy.sources)){
  if(!/^https:\/\//.test(s.url)||!s.publisher||!s.evidence||!s.period)fail('invalid source '+id);
 }
 const caseIDs=new Set(),caseEntities=new Set();
 for(const c of policy.cases){
  if(caseIDs.has(c.case_id)||!c.reason||c.geometry_override!==false||c.legal_parent_override!==false||
   c.reviewed_for_policy!==true||!controlEnum.has(c.constitutional_control)||!linkEnum.has(c.de_facto_link)||
   !c.source_ids?.length||c.source_ids.some(x=>!policy.sources[x]))fail('invalid case '+c.case_id);
  caseIDs.add(c.case_id);
  if(c.actual_id){
   if(caseEntities.has(c.actual_id)||!checkedById.has(c.actual_id))fail('case identity unresolved '+c.actual_id);
   caseEntities.add(c.actual_id);
   const rel=checkedById.get(c.actual_id);
   const expected=rel.geometric_parent?'osm_de_facto_parent_candidate':
    rel.root_relation==='boundary'?'boundary_not_parent':'overlap_not_parent';
   if(c.de_facto_link!==expected)fail('incompatible case relationship '+c.case_id+': '+c.de_facto_link+' vs '+expected);
  }else if(c.de_facto_link!=='unmapped_no_polygon'||c.constitutional_control==='outside_constitutional_control_reported')fail('unmapped case overclaimed '+c.case_id);
 }
 if(caseIDs.size<20)fail('focus-case coverage');
 if(!caseIDs.has('BENDER-LEGAL')||!caseIDs.has('DUBASARI-LEGAL')||!caseIDs.has('DUBASARI-COCIERI')||!caseIDs.has('BENDER-VARNITA-1'))fail('missing mandatory cases');
}
verifyInput();
if(process.argv.includes('--self-test')){
 assert.equal(parentIds.length,7);assert.equal(reuseIds.length,7);
 assert.equal(checkedById.size,153);
 assert.equal(data.candidates.filter(x=>x.geometric_parent).length,85);
 console.log('P904_SELF_TEST PASS');process.exit(0);
}
const byCase=new Map(policy.cases.filter(x=>x.actual_id).map(x=>[x.actual_id,x]));
const aggregates=new Set(['osm-r2607033','stat-MD12','stat-MD120']);
const review=data.candidates.map(row=>{
 const c=byCase.get(row.actual_id);
 const disposition=aggregates.has(row.actual_id)?'existing_legal_or_statistical_aggregate_distinct':
  row.geometric_parent?'geometric_parent_candidate_no_semantic_approval':
  row.root_relation==='boundary'?'boundary_only_excluded_from_de_facto_membership':
  'partial_overlap_preserve_legal_geometry_and_review';
 return {actual_id:row.actual_id,name:row.name,root_relation:row.root_relation,
  geometric_parent_candidate:row.geometric_parent,
  case_id:c?.case_id||null,
  constitutional_control:c?.constitutional_control||'not_evaluated_individually',
  de_facto_membership:'not_certified_by_geometry',
  disposition,legal_parent_change:false,duplicate_geometry_creation:false,
  requires_manual_member_verification:!!row.geometric_parent,
  review_evidence:c?.source_ids||[],control_scope:c?'locality_specific_or_entity_scope':'not_verified'};
});
const rootStats=review.reduce((o,x)=>(o[x.root_relation]=(o[x.root_relation]||0)+1,o),{});
const pendingParents=review.filter(x=>x.requires_manual_member_verification);
const crossLayer=review.filter(x=>x.disposition==='existing_legal_or_statistical_aggregate_distinct');
const overlap=review.filter(x=>x.root_relation==='overlap');
const caseMapping=policy.cases.map(x=>({...x,candidate_in_P902:!!x.actual_id,
  semantic_review_status:x.actual_id?'reviewed_with_source_constraints':'requires_identity_binding',
  de_facto_member_acceptance:false}));
const failures=[];
if(review.length!==153||pendingParents.length!==85||crossLayer.length!==3||overlap.length!==15)failures.push('missing_or_changed_review_scope');
if(review.some(x=>x.legal_parent_change||x.duplicate_geometry_creation||x.de_facto_membership!=='not_certified_by_geometry'))failures.push('forbidden_promotion');
const summary={schema_version:'p904-semantic-audit-v1',audit_status:failures.length?'FAIL':'PASS',
 semantic_promote_ready:false,p91_import_allowed:false,hard_block_reason:'No positive source-backed de facto parent acceptance for 85 geometrically contained ACTUAL identities; legal/de facto administrative identity bindings and mixed localities require human review.',
 source_p902_run_id:data.source_run_id,source_p902_artifact_id:data.source_artifact_id,source_p902_sha256:data.source_sha256,
 source_p903_run_id:38476771169,reference_snapshot:data.source_snapshot,
 candidate_count:review.length,root_relations:rootStats,unique_geometric_parent_candidates:pendingParents.length,
 constitutional_statistical_aggregates:crossLayer.map(x=>x.actual_id),
 disputed_partial_overlaps:overlap.length,neighbor_boundary_only:review.filter(x=>x.root_relation==='boundary').length,
 case_review_count:caseMapping.length,case_bound_count:caseMapping.filter(x=>x.candidate_in_P902).length,
 cases_requiring_identity_binding:caseMapping.filter(x=>!x.candidate_in_P902).map(x=>x.case_id),
 reuse_same_osm_id_geometric_equal:reuseIds.length,
 de_facto_parent_certified_count:0,legal_parent_changes:0,geometries_copied:0,
 source_links:Object.keys(policy.sources).length,
 failures,review_policy:'Control claims apply only to sourced locality/administrative scope. Geometric containment never assigns administration. Moldovan legal sovereignty not altered.'};
await mkdir(OUT,{recursive:true});
for(const [name,value]of [['summary.json',summary],['candidate-matrix.json',review],['focus-cases.json',caseMapping],['pending-p91-gates.json',{promotion_blocked:true,needs_member_review:pendingParents.map(x=>x.actual_id),needs_identity_binding:summary.cases_requiring_identity_binding,needs_exact_OSM_snapshot_comparison:true,needs_MD_legal_review:true}]]){
 await writeFile(new URL(name,OUT),JSON.stringify(value,null,2)+'\n');
}
console.log('P904_SUMMARY '+JSON.stringify(summary));
if(failures.length)process.exitCode=2;
