const codes=['RO','MD'];

const idSet=value=>new Set((value||[]).map(Number));
const sorted=value=>[...value].map(Number).sort((a,b)=>a-b);
const eq=(a,b)=>JSON.stringify(sorted(a))===JSON.stringify(sorted(b));
const sha=value=>/^[a-f0-9]{64}$/.test(String(value||''));
const must=(ok,message)=>{if(!ok)throw new Error(message);};

export function assessOsmSourceTransition({baseline,candidate,continuity,policy}){
 must(policy?.schema_version===1&&policy?.mode==='OSM_SOURCE_TRANSITION_POLICY','Invalid OSM transition policy');
 must(baseline?.schema_version===2&&candidate?.schema_version===2,'Invalid OSM source manifests');
 must(continuity?.schema==='osm-source-per-id-continuity-v1','Invalid OSM continuity report');
 must(policy?.guards?.actual_mutation_allowed===false,'OSM transition policy must forbid ACTUAL mutation');
 must(policy?.guards?.p91_import_allowed===false,'OSM transition policy must keep P9.1 blocked');
 must(policy?.guards?.semantic_acceptance==='BLOCKED_INCOMPLETE','OSM transition policy must keep semantic acceptance blocked');

 const failures=[],checks=[];
 const check=(name,ok,detail={})=>{
  checks.push({name,ok:Boolean(ok),detail});
  if(!ok)failures.push({name,detail});
 };

 check('baseline_snapshot_timestamp',
  baseline.snapshot_at===policy.baseline.snapshot_at,
  {expected:policy.baseline.snapshot_at,actual:baseline.snapshot_at});
 for(const code of codes){
  const expected=policy.baseline.countries?.[code];
  const actual=baseline.countries?.[code];
  check('baseline_'+code+'_source_identity',
   Boolean(expected&&actual)
   && actual.selected_relation_count===expected.selected_relation_count
   && actual.semantic_sha256===expected.semantic_sha256
   && actual.compressed_sha256===expected.compressed_sha256,
   {expected,actual:actual?{
    selected_relation_count:actual.selected_relation_count,
    semantic_sha256:actual.semantic_sha256,
    compressed_sha256:actual.compressed_sha256
   }:null});
  check('candidate_'+code+'_cryptographic_snapshot',
   Boolean(candidate.countries?.[code])
   && sha(candidate.countries[code].semantic_sha256)
   && sha(candidate.countries[code].compressed_sha256)
   && typeof candidate.countries[code].snapshot_path==='string',
   {snapshot_path:candidate.countries?.[code]?.snapshot_path??null,
    semantic_sha256:candidate.countries?.[code]?.semantic_sha256??null,
    compressed_sha256:candidate.countries?.[code]?.compressed_sha256??null});
 }

 const expectedRetired=policy.expected_transition.retired_relations||[];
 const expectedAdded=policy.expected_transition.added_relations||[];
 const actualMissing=Object.values(continuity.countries||{}).flatMap(c=>c.missing||[]);
 const actualAdded=Object.values(continuity.countries||{}).flatMap(c=>c.added||[]);
 check('exact_retired_relation_set',
  eq(actualMissing.map(x=>x.relation_id),expectedRetired.map(x=>x.relation_id)),
  {expected:sorted(expectedRetired.map(x=>x.relation_id)),actual:sorted(actualMissing.map(x=>x.relation_id))});
 check('exact_added_relation_set',
  eq(actualAdded.map(x=>x.relation_id),expectedAdded.map(x=>x.relation_id)),
  {expected:sorted(expectedAdded.map(x=>x.relation_id)),actual:sorted(actualAdded.map(x=>x.relation_id))});

 for(const expected of expectedRetired){
  const row=actualMissing.find(x=>Number(x.relation_id)===Number(expected.relation_id));
  const retiredByApi=Object.values(continuity.countries||{}).some(c=>
   idSet(c.retired_by_api).has(Number(expected.relation_id)));
  const authoritative410=Boolean(row?.authoritative_probe?.some(x=>
   x.status==='not_found'&&Number(x.http_status)===Number(expected.required_current_api_status)));
  check('retired_'+expected.relation_id+'_authoritative_410',
   Boolean(row)&&retiredByApi&&authoritative410,
   {retired_by_api:retiredByApi,authoritative_probe:row?.authoritative_probe??null});
  check('retired_'+expected.relation_id+'_previous_osm_semantics',
   row?.previous?.boundary===expected.expected_previous.boundary
   && String(row?.previous?.admin_level)===String(expected.expected_previous.admin_level)
   && row?.previous?.place===expected.expected_previous.place,
   {expected:expected.expected_previous,actual:row?.previous??null});
 }

 for(const expected of expectedAdded){
  const row=actualAdded.find(x=>Number(x.relation_id)===Number(expected.relation_id));
  check('added_'+expected.relation_id+'_current_osm_semantics',
   Boolean(row)
   && row.candidate?.boundary===expected.expected_current.boundary
   && String(row.candidate?.admin_level)===String(expected.expected_current.admin_level)
   && row.candidate?.place===expected.expected_current.place
   && String(row.candidate?.ref_cuatm_codunic||'')===String(expected.cuatm_unique_id)
   && Number(row.candidate?.version)===Number(expected.version)
   && row.candidate?.timestamp===expected.timestamp
   && Number(row.candidate?.changeset)===Number(expected.changeset),
   {expected,actual:row?.candidate??null});
 }

 check('candidate_timestamp_is_newer',
  Number.isFinite(Date.parse(candidate.snapshot_at))
  && Date.parse(candidate.snapshot_at)>Date.parse(baseline.snapshot_at),
  {baseline:baseline.snapshot_at,candidate:candidate.snapshot_at});
 check('ro_inventory_membership_unchanged',
  continuity.countries?.RO?.missing_count===0&&continuity.countries?.RO?.added_count===0,
  {missing:continuity.countries?.RO?.missing_count??null,added:continuity.countries?.RO?.added_count??null});
 check('md_inventory_delta_matches_policy',
  candidate.countries?.MD?.selected_relation_count
   ===baseline.countries?.MD?.selected_relation_count-expectedRetired.length+expectedAdded.length,
  {baseline:baseline.countries?.MD?.selected_relation_count??null,
   candidate:candidate.countries?.MD?.selected_relation_count??null,
   retired:expectedRetired.length,added:expectedAdded.length});

 return {
  schema:'osm-source-transition-assessment-v1',
  transition_id:policy.transition_id,
  status:failures.length?'BLOCKED_SOURCE_TRANSITION':'PASS_SOURCE_ONLY_TRANSITION',
  baseline_snapshot_at:baseline.snapshot_at,
  candidate_snapshot_at:candidate.snapshot_at,
  current_osm_inventory:{
   RO:candidate.countries?.RO?.selected_relation_count??null,
   MD:candidate.countries?.MD?.selected_relation_count??null
  },
  actual_contract:{
   mutation_allowed:false,
   p91_import_allowed:false,
   semantic_acceptance:'BLOCKED_INCOMPLETE'
  },
  checks,failures
 };
}
