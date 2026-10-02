#!/usr/bin/env node
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const OUTPUT='data/current/actual-regression-audit.json';
const policy=JSON.parse(await readFile('data/sources/actual-settlement-policy.json','utf8'));
const bretcuActive=(policy?.jurisdictions?.RO?.official_geometry_exceptions||[]).some(x=>String(x?.legal_id)==='64096');
const EXPECTED={RO:bretcuActive?3234:3233,MD:2596};
const EXPECTED_TOTAL=bretcuActive?5830:5829;
const EXPECTED_STATE_RELATION={RO:90689,MD:58974};
const catalog=JSON.parse(await readFile('data/current/entities.json','utf8'));
const blockers=[];
const counts=Object.fromEntries(['RO','MD'].map(j=>[j,(catalog.entities||[]).filter(e=>e.jurisdiction===j).length]));
for(const j of ['RO','MD'])if(counts[j]!==EXPECTED[j])blockers.push({issue:'entity_count_drift',jurisdiction:j,expected:EXPECTED[j],actual:counts[j]});
for(const [j,path] of Object.entries({RO:'public/geo/current/ro-administrative.geojson',MD:'public/geo/current/md-administrative.geojson'})){const doc=JSON.parse(await readFile(path,'utf8'));if((doc.features||[]).length!==EXPECTED[j])blockers.push({issue:'master_feature_count_drift',jurisdiction:j,expected:EXPECTED[j],actual:(doc.features||[]).length});}
const total=counts.RO+counts.MD;if(total!==EXPECTED_TOTAL)blockers.push({issue:'total_entity_count_drift',expected:EXPECTED_TOTAL,actual:total});
if(bretcuActive){
 const bretcu=(catalog.entities||[]).filter(e=>e.id==='ro-siruta-64096');
 if(bretcu.length!==1)blockers.push({issue:'bretcu_official_geometry_entity_count_drift',expected:1,actual:bretcu.length});
 const e=bretcu[0];
 if(e&&(
  e.jurisdiction!=='RO'
  ||e.source!=='ANCPI'
  ||e.type!=='commune'
  ||e.parent_id!=='osm-r2248621'
  ||e.osm!==null
  ||e.geometry?.role!=='administrative_boundary'
  ||e.geometry?.scope!=='uat'
  ||String(e.legal?.id)!=='64096'
 ))blockers.push({issue:'bretcu_official_geometry_contract_drift',actual:e});
}else if((catalog.entities||[]).some(e=>e.id==='ro-siruta-64096')){
 blockers.push({issue:'bretcu_official_geometry_present_without_policy'});
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
const report={schema_version:1,generated_at:new Date().toISOString(),mode:'ACTUAL',status:blockers.length?'FAIL':'PASS',expected_entity_count:EXPECTED_TOTAL,entity_count:total,entity_count_by_jurisdiction:counts,reviewed_topology_normalization_entity_ids:['osm-r12463200'],policy:bretcuActive
 ?'Entity and master-feature counts are fail-closed against the reviewed P1.2 ACTUAL baseline RO=3234, MD=2596, total=5830, including exactly one reviewed ANCPI Brețcu UAT boundary and exactly one state-context boundary per jurisdiction. Exact master-coordinate fidelity and unintended geometry drift are enforced separately by the ACTUAL release gate.'
 :'Entity and master-feature counts are fail-closed against the reviewed ACTUAL baseline RO=3233, MD=2596, total=5829, including exactly one state-context boundary per jurisdiction. The MD baseline includes the five explicitly imported Chișinău sector representations. Exact master-coordinate fidelity and unintended geometry drift are enforced separately by the ACTUAL release gate; osm-r12463200 is the sole reviewed topology normalization currently under validation.',blocking_issue_count:blockers.length,blocking_issues:blockers};
await mkdir('data/current',{recursive:true});await writeFile(OUTPUT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(blockers.length)process.exit(1);
