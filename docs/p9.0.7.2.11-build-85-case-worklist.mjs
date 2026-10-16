import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const LEDGER='docs/p9.0.7-contemporary-evidence-ledger.json';
const CONTEXT='docs/p9.0.7.2.11-targeted-external-evidence.json';
const OUTPUT='docs/p9.0.7.2.11-85-case-worklist.json';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const sha256=b=>createHash('sha256').update(b).digest('hex');
function build(){
 const baseBytes=readFileSync(LEDGER);
 const contextBytes=readFileSync(CONTEXT);
 const base=JSON.parse(baseBytes.toString('utf8'));
 const contextual=JSON.parse(contextBytes.toString('utf8'));
 assert.equal(base.rows.length,85);
 assert.equal(new Set(base.rows.map(x=>x.actual_id)).size,85);
 assert.equal(contextual.primary_binary_byte_capture_count,0);
 const byId=new Map(base.rows.map(r=>[r.actual_id,r]));
 const grouped=new Map();
 for(const r of base.rows){
  const group=grouped.get(r.name_ro)??[];
  group.push(r.actual_id);
  grouped.set(r.name_ro,group);
 }
 const proofs=new Map();
 for(const item of contextual.independent_claim_sources){
  assert(item.binary_archived===false&&item.sha256===null&&!item.primary_original_independently_verified,'Context improperly promoted as binary primary');
  assert(item.source_url.startsWith('https://'));
  for(const id of item.relevant_ids){
   assert(byId.has(id),'Unrecognized OSM candidate in contextual source: '+id);
   proofs.set(id,[...(proofs.get(id)??[]),{source_id:item.id,claim_type:item.claim_type}]);
  }
 }
 const allRequirements=[
  'CERTIFIED_EXHAUSTIVE_2023_2026_ADMINISTRATIVE_LAW_AMENDMENT_CHAIN',
  'INDEPENDENT_CONTEMPORARY_DE_FACTO_CONTROL_OF_THE_EXACT_FULL_OSM_POLYGON',
  'LEGAL_MOLDOVAN_PARENT_PRESERVED_AND_DISTINGUISHED',
  'EVIDENCE_PROVENANCE_WITH_RETRIEVED_PRIMARY_BYTES_AND_SHA256',
  'MANUAL_SEMANTIC_ACCEPTANCE_BEFORE_ANY_P9_1_PROMOTION'
 ];
 const records=base.rows.map(r=>{
  const extra=[];
  if(r.match_type_2023==='HOMONYM_MULTIPLE_ENTRIES_2023'){
   extra.push('IDENTIFY_2026_LEGAL_SETTLEMENT_AND_ROLE_AMONG_HOMONYMS');
  }else if(r.match_type_2023==='CURATED_ALIAS_POTENTIAL_MATCH'){
   extra.push('OFFICIAL_COMPATIBLE_NAME_PROOF_AND_EXACT_OSM_BINDING');
  }else if(r.match_type_2023==='NO_EXACT_2023_NAME'){
   extra.push('CLASSIFY_MICRODISTRICT_VERSUS_SETTLEMENT_FROM_CURRENT_INSTITUTIONAL_OR_NORMATIVE_SOURCE');
  }
  if(grouped.get(r.name_ro).length>1)extra.push('DISAMBIGUATE_DISTINCT_OSM_RELATIONS_WITH_IDENTICAL_ROMANIAN_NAME');
  if(r.claimed_de_facto_parent_osm_id&&r.claimed_de_facto_parent_osm_id!==r.geometric_parent_osm_id)
   extra.push('EXPLICIT_DE_FACTO_PARENT_CONFLICT_RESOLUTION_WITHOUT_CHANGING_GEOMETRY');
  const evidence=proofs.get(r.actual_id)??[];
  return {
   actual_id:r.actual_id,
   name_ro:r.name_ro,
   match_type_2023:r.match_type_2023,
   historical_2023_registry_claims:r.registry_claims_2023,
   geometric_parent_osm_id:r.geometric_parent_osm_id,
   claimed_de_facto_parent_osm_id:r.claimed_de_facto_parent_osm_id,
   legal_md_parent_preserved:r.legal_md_parent_preserved,
   same_name_osm_candidates:[...grouped.get(r.name_ro)].sort(),
   context_source_refs:evidence,
   contextual_source_count:evidence.length,
   already_present_legacy_evidence_urls:r.documentary_evidence??[],
   requirements:[...allRequirements,...extra],
   exhausted_normative_chain_certified:false,
   exact_2026_full_polygon_control_certified:false,
   full_primary_byte_provenance_certified:false,
   individual_semantic_acceptance:'BLOCKED_INCOMPLETE',
   p91_import_allowed:false,
   status:'CONTEXTUAL_RESEARCH_ONLY_NOT_ADJUDICATED'
  };
 });
 const summary={
  schema_version:'p907211-85-case-probatory-worklist-v1',
  asof:'2026-10-16',
  source_ledger:LEDGER,
  source_ledger_sha256:sha256(baseBytes),
  external_context:CONTEXT,
  external_context_sha256:sha256(contextBytes),
  total:records.length,
  match_type_counts:Object.fromEntries([...new Set(records.map(r=>r.match_type_2023))].sort().map(t=>[t,records.filter(r=>r.match_type_2023===t).length])),
  linked_context_cases:records.filter(r=>r.contextual_source_count>0).length,
  context_sources:contextual.independent_claim_sources.length,
  context_is_not_primary_binary:true,
  full_polygon_certified:0,
  normative_chain_exhaustive_certified:0,
  adjudicated_cases:0,
  disputed_parent_osm_cases:records.filter(r=>r.requirements.includes('EXPLICIT_DE_FACTO_PARENT_CONFLICT_RESOLUTION_WITHOUT_CHANGING_GEOMETRY')).map(r=>r.actual_id),
  repeated_name_groups:[...grouped.entries()].filter(([,ids])=>ids.length>1).map(([name,ids])=>({name,actual_ids:[...ids].sort()})),
  identities_preserved:85,
  semantic_acceptance:'BLOCKED_INCOMPLETE',
  p91_import_allowed:false,
  actual_mutation_allowed:false,
  rows:records
 };
 return JSON.stringify(summary,null,2)+'\n';
}
const built=build();
if(process.argv.includes('--check')){
 assert.equal(readFileSync(OUTPUT,'utf8'),built,'Committed worklist differs from canonical source-joined build');
 console.log('P907211_85_CASE_REPRO_PASS: 85 exact source-joined records, contextual observations only, 0 accepted');
}else{
 writeFileSync(OUTPUT,built,{flag:'w'});
 console.log('P907211_85_CASE_BUILT: 85 identities, SHA256='+sha256(Buffer.from(built)));
}
