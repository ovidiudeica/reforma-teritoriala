#!/usr/bin/env node
import {readFile} from 'node:fs/promises';

const POLICY='data/sources/actual-statistical-policy.json';
const PUBLIC='public/data/actual-entities.json';
const MARKER='data/current/actual-statistical-activation.json';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const policy=await read(POLICY);
const pub=await read(PUBLIC);
let marker=null;try{marker=await read(MARKER);}catch{}
const active=Boolean(marker?.activated===true&&marker?.mode==='ACTUAL_STATISTICAL_ACTIVATION');
const checks=[],failures=[];const check=(name,ok,detail={})=>{checks.push({name,ok:Boolean(ok),detail});if(!ok)failures.push({name,detail});};
check('activation_request_bound',policy.activation_requested===true&&policy.activation_authority===MARKER&&policy.target_public_contract==='actual-public-entity-v3',{phase:policy.phase,activation_requested:policy.activation_requested,activation_authority:policy.activation_authority,target_public_contract:policy.target_public_contract});
if(active){
 const stat=(pub.entities||[]).filter(e=>e.category==='statistical');
 check('active_public_contract_v3',pub.contract==='actual-public-entity-v3'&&pub.schema_version===3,{contract:pub.contract,schema_version:pub.schema_version});
 check('active_public_cardinality',pub.entity_count===5848&&pub.administrative_entity_count===5830&&pub.statistical_only_entity_count===18&&pub.entity_count_by_jurisdiction?.RO===3246&&pub.entity_count_by_jurisdiction?.MD===2602,{entity_count:pub.entity_count,counts:pub.entity_count_by_jurisdiction});
 check('active_statistical_only_entities',stat.length===18&&new Set(stat.map(x=>x.id)).size===18,{count:stat.length});
 check('active_consolidated_tree',pub.hierarchy_tree?.contract==='actual-public-hierarchy-v1'&&pub.hierarchy_tree?.root_count===2&&pub.hierarchy_tree?.node_count===5848,{tree:pub.hierarchy_tree?{contract:pub.hierarchy_tree.contract,root_count:pub.hierarchy_tree.root_count,node_count:pub.hierarchy_tree.node_count}:null});
 check('active_no_md121_identity',!(pub.entities||[]).some(e=>e.statistical?.code==='MD121'),{});
}else{
 check('pending_public_release_stays_v2',pub.contract==='actual-public-entity-v2'&&pub.schema_version===2&&pub.entity_count===5830,{contract:pub.contract,schema_version:pub.schema_version,entity_count:pub.entity_count});
 check('pending_has_no_statistical_only_entities',!(pub.entities||[]).some(e=>String(e.id||'').startsWith('stat-')),{});
}
const report={schema_version:1,mode:'ACTUAL_STATISTICAL_P2_3_READINESS',phase:active?'P2.3_ACTIVE':'P2.3_READY',status:failures.length?'FAIL':'PASS',active,checks,failures};
console.log(JSON.stringify(report,null,2));
if(failures.length)process.exit(1);
