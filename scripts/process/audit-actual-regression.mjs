#!/usr/bin/env node
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const OUTPUT='data/current/actual-regression-audit.json';
const EXPECTED_STATE_RELATION={RO:90689,MD:58974};
const catalog=JSON.parse(await readFile('data/current/entities.json','utf8'));
const settlementPolicy=JSON.parse(await readFile('data/sources/actual-settlement-policy.json','utf8'));
const fallbackIds=(settlementPolicy?.administrative_geometry_fallbacks?.RO?.legal_ids||[]).map(String);
const bretcuFallbackEnabled=fallbackIds.includes('64096');
const ojdulaOverride=(settlementPolicy?.administrative_geometry_fallbacks?.RO?.reviewed_geometry_overrides||[]).find(x=>String(x.legal_id)==='64602');
const ojdulaOverrideEnabled=Boolean(ojdulaOverride);
const hybridPartitionEnabled=ojdulaOverride?.disposition==='partition_osm_shell_by_ancpi_shared_boundary';
const EXPECTED={RO:bretcuFallbackEnabled?3234:3233,MD:2596};
const EXPECTED_TOTAL=EXPECTED.RO+EXPECTED.MD;
const blockers=[];
const counts=Object.fromEntries(['RO','MD'].map(j=>[j,(catalog.entities||[]).filter(e=>e.jurisdiction===j).length]));
for(const j of ['RO','MD'])if(counts[j]!==EXPECTED[j])blockers.push({issue:'entity_count_drift',jurisdiction:j,expected:EXPECTED[j],actual:counts[j]});
for(const [j,path] of Object.entries({RO:'public/geo/current/ro-administrative.geojson',MD:'public/geo/current/md-administrative.geojson'})){const doc=JSON.parse(await readFile(path,'utf8'));if((doc.features||[]).length!==EXPECTED[j])blockers.push({issue:'master_feature_count_drift',jurisdiction:j,expected:EXPECTED[j],actual:(doc.features||[]).length});}
const total=counts.RO+counts.MD;if(total!==EXPECTED_TOTAL)blockers.push({issue:'total_entity_count_drift',expected:EXPECTED_TOTAL,actual:total});
const bretcu=(catalog.entities||[]).filter(e=>e.id==='siruta-u64096');
if(bretcu.length!==(bretcuFallbackEnabled?1:0))blockers.push({issue:'bretcu_fallback_cardinality',expected:bretcuFallbackEnabled?1:0,actual:bretcu.length});
const bretcuEntity=bretcu[0];
if(bretcuFallbackEnabled&&bretcuEntity&&(
 bretcuEntity.jurisdiction!=='RO'
 ||bretcuEntity.type!=='commune'
 ||bretcuEntity.parent_id!=='osm-r2248621'
 ||bretcuEntity.legal?.registry!=='SIRUTA'
 ||String(bretcuEntity.legal?.id||'')!=='64096'
 ||bretcuEntity.representation?.source!=='ANCPI RELUAT'
 ||Number(bretcuEntity.representation?.admin_level)!==8
 ||bretcuEntity.geometry?.role!=='administrative_boundary'
 ||bretcuEntity.geometry?.scope!==(hybridPartitionEnabled?'uat_hybrid_partition':'uat_fallback')
 ||(hybridPartitionEnabled&&bretcuEntity.representation?.partition_mode!=='osm_shell_ancpi_shared_boundary_partition')
 ||bretcuEntity.geometry?.legal_geometry_equivalence_asserted!==false
))blockers.push({issue:'bretcu_fallback_contract_drift',actual:bretcuEntity});
if(ojdulaOverrideEnabled){
 const ojdula=(catalog.entities||[]).filter(e=>e.id==='osm-r14735731');
 const oe=ojdula[0];
 if(
  ojdula.length!==1
  ||String(oe?.legal?.id||'')!=='64602'
  ||(hybridPartitionEnabled?oe?.representation?.source!=='OpenStreetMap':oe?.representation?.source!=='ANCPI RELUAT')
  ||Number(oe?.representation?.reviewed_osm_relation_id)!==14735731
  ||(hybridPartitionEnabled?oe?.representation?.osm_relation_geometry_accepted_as_outer_shell!==true:oe?.representation?.osm_relation_geometry_accepted!==false)
  ||(hybridPartitionEnabled&&oe?.representation?.internal_boundary_source!=='ANCPI RELUAT')
  ||(hybridPartitionEnabled&&oe?.representation?.partition_mode!=='osm_shell_ancpi_shared_boundary_partition')
  ||oe?.geometry?.role!=='administrative_boundary'
  ||oe?.geometry?.scope!==(hybridPartitionEnabled?'uat_hybrid_partition':'uat_fallback')
 ){
  blockers.push({issue:'ojdula_geometry_override_contract_drift',actual:oe||null});
 }
}
for(const j of ['RO','MD']){
 const states=(catalog.entities||[]).filter(e=>e.jurisdiction===j&&e.type==='state');
 if(states.length!==1)blockers.push({issue:'state_context_count_drift',jurisdiction:j,expected:1,actual:states.length});
 const state=states[0];
 if(state&&(
  Number(state.osm?.relation_id)!==EXPECTED_STATE_RELATION[j]
  ||Number(state.osm?.admin_level)!==2
  ||state.category!=='context'
  ||state.parent_id!==null
  ||state.geometry?.role!=='administrative_boundary'
  ||state.geometry?.scope!=='state_context'
 ))blockers.push({issue:'state_context_contract_drift',jurisdiction:j,expected_relation_id:EXPECTED_STATE_RELATION[j],actual:state});
}
const report={schema_version:1,generated_at:new Date().toISOString(),mode:'ACTUAL',status:blockers.length?'FAIL':'PASS',bretcu_fallback_enabled:bretcuFallbackEnabled,ojdula_geometry_override_enabled:ojdulaOverrideEnabled,hybrid_partition_enabled:hybridPartitionEnabled,expected_entity_count:EXPECTED_TOTAL,entity_count:total,entity_count_by_jurisdiction:counts,reviewed_topology_normalization_entity_ids:['osm-r12463200'],policy:'Entity and master-feature counts are fail-closed against the reviewed ACTUAL baseline. Before P1.2 activation the baseline is RO=3233, MD=2596, total=5829; after explicit Brețcu fallback activation it is RO=3234, MD=2596, total=5830 with exactly one siruta-u64096 ANCPI/RELUAT fallback. Exactly one state-context boundary per jurisdiction remains required. Exact master-coordinate fidelity and unintended geometry drift are enforced separately by the ACTUAL release gate.',blocking_issue_count:blockers.length,blocking_issues:blockers};
await mkdir('data/current',{recursive:true});await writeFile(OUTPUT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(blockers.length)process.exit(1);
