#!/usr/bin/env node
// Read-only deterministic interpretation of frozen official OSM observations; no upload/promotion API.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {auditOsmClosure} from '../lib/osm-closure-audit.mjs';
import {osmElementIndex,mergeOsmElements} from '../lib/osm-element-index.mjs';
const root=new URL('../../docs/osm-fix3/',import.meta.url);
const hash=value=>createHash('sha256').update(Buffer.isBuffer(value)||typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
const equal=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
const [obsBytes,baseBytes]=await Promise.all([readFile(new URL('observations.json',root)),readFile(new URL('baseline.json',root))]);
const observations=JSON.parse(obsBytes),baseline=JSON.parse(baseBytes);
const rows=observations.rows;
const response=path=>{const values=rows.filter(r=>r.path===path);if(!values.length)throw Error('Missing frozen official response '+path);return values.at(-1);};
const require200=path=>{const r=response(path);if(r.http_status!==200||r.error)throw Error('Incomplete official evidence '+path);return r;};
const history=id=>{
 const h=require200(`relation/${id}/history.json`).elements;
 if(!h.length||!h.every((e,i)=>e.type==='relation'&&e.id===id&&e.version===i+1&&Number.isFinite(Date.parse(e.timestamp))&&(i===0||Date.parse(e.timestamp)>=Date.parse(h[i-1].timestamp))))throw Error('Incomplete or conflicting history '+id);
 return h;
};
const baseIndex=osmElementIndex(baseline),fullIndex=new Map();
for(const id of [18967493,18968082,21515245])mergeOsmElements(fullIndex,require200(`relation/${id}/full.json`).elements);
const full={elements:[...fullIndex.values()]};
const matrix=[];
for(const id of baseline.selected_retired_ids){
 const h=history(id),latest=h.at(-1),previous=h.filter(e=>e.visible!==false).at(-1),atEpoch=h.filter(e=>Date.parse(e.timestamp)<=Date.parse(baseline.snapshot_at)).at(-1),current=response(`relation/${id}.json`),accepted=baseIndex.get(`relation/${id}`);
 const deleted=current.http_status===410&&latest.visible===false;
 matrix.push({relation_id:id,name:previous.tags?.name??null,accepted_epoch:baseline.snapshot_at,normalized_snapshot_contains_relation:Boolean(accepted),relation_version_at_accepted_epoch:atEpoch?.version??null,accepted_members_and_tags_match_history:Boolean(atEpoch)&&equal(accepted?.members,atEpoch.members)&&equal(accepted?.tags,atEpoch.tags),accepted_way_node_versions:'NOT_PRESENT_IN_NORMALIZED_ACCEPTED_SNAPSHOT',last_visible_version:previous.version,last_visible_timestamp:previous.timestamp,last_visible_changeset:previous.changeset,last_version:latest.version,last_timestamp:latest.timestamp,last_changeset:latest.changeset,current_http:current.http_status,current_state:deleted?'OFFICIALLY_RETIRED':'UNRESOLVED_CURRENT_STATE',cuatm:previous.tags?.['ref:cuatm:codunic']??previous.tags?.cuatm??null,boundary:previous.tags?.boundary??null,admin_level:previous.tags?.admin_level??null,place:previous.tags?.place??null,member_ways:previous.members.filter(m=>m.type==='way').map(m=>m.ref),accepted_graph:auditOsmClosure(baseline,[id],'MD'),current_geometry:'NONE_FOR_DELETED_RELATION; HISTORICAL_GEOMETRY_NOT_RESTORED',official_history:require200(`relation/${id}/history.json`).url,history_raw_sha256:require200(`relation/${id}/history.json`).raw_sha256,history_sanitized_sha256:hash(h),current_raw_sha256:current.raw_sha256,cartographic_verdict:deleted?'RETIRED_FROM_CURRENT_OSM':'BLOCKED_EVIDENCE',legal_verdict:'UNRESOLVED'});
}
const addedId=21515245,addedHistory=history(addedId),added=require200(`relation/${addedId}.json`).elements.find(e=>e.type==='relation'&&e.id===addedId);
if(!added||added.version!==addedHistory.at(-1).version)throw Error('Added relation version drift');
matrix.push({relation_id:addedId,name:added.tags?.name,current_state:'CURRENT_OSM_ADDITION',version:added.version,timestamp:added.timestamp,changeset:added.changeset,cuatm:added.tags?.['ref:cuatm:codunic']??null,boundary:added.tags?.boundary,admin_level:added.tags?.admin_level,place:added.tags?.place,member_ways:added.members.filter(m=>m.type==='way').map(m=>m.ref),current_graph:auditOsmClosure(full,[addedId],'MD'),official_history:require200(`relation/${addedId}/history.json`).url,current_raw_sha256:response(`relation/${addedId}.json`).raw_sha256,cartographic_verdict:'CURRENT_OSM_ADDITION_NOT_ACTUAL_IDENTITY',legal_verdict:'UNRESOLVED'});
const oldId=18967907,oldHistory=history(oldId),oldDeleted=oldHistory.at(-1),oldVisible=oldHistory.filter(e=>e.visible!==false).at(-1);
function ring(id,index){
 const r=index.get(`relation/${id}`);if(!r||r.members.length!==1||r.members[0].type!=='way')return null;
 const w=index.get(`way/${r.members[0].ref}`);if(!w)return null;
 const coordinates=w.nodes.map(id=>{const n=index.get(`node/${id}`);if(!n)throw Error('Missing ring node');return [n.lon,n.lat];});
 if(!equal(coordinates[0],coordinates.at(-1)))return null;
 const c=coordinates.slice(0,-1),strings=[];
 for(const sequence of [c,[...c].reverse()])for(let i=0;i<sequence.length;i++)strings.push(JSON.stringify([...sequence.slice(i),...sequence.slice(0,i)]));
 return {vertices:c.length,coordinate_cycle_sha256:hash(strings.sort()[0])};
}
const oldRing=ring(oldId,baseIndex),newRing=ring(addedId,fullIndex),sameCuatm=(oldVisible.tags?.['ref:cuatm:codunic']??oldVisible.tags?.cuatm)===added.tags?.['ref:cuatm:codunic'];
const successor={from:oldId,to:addedId,same_cuatm:sameCuatm,same_changeset:oldDeleted.changeset===added.changeset,same_timestamp:oldDeleted.timestamp===added.timestamp,old_ring:oldRing,new_ring:newRing,coordinate_cycles_equal:Boolean(oldRing&&newRing)&&oldRing.coordinate_cycle_sha256===newRing.coordinate_cycle_sha256,method:'Exact coordinate cycles, rotation/orientation invariant, no tolerance or snapping; only single-way rings supported',cartographic_verdict:sameCuatm&&oldDeleted.changeset===added.changeset&&oldDeleted.timestamp===added.timestamp?'CARTOGRAPHIC_SUCCESSOR_LINK_SUPPORTED_NOT_AUTOMATIC_ALIAS':'UNRESOLVED',legal_verdict:'UNRESOLVED',actual_mutation_allowed:false};
const targets=[{relation:18967493,relation_version:6,way:1376179876,way_version:8,index:457,from:12318728194,to:12318728593},{relation:18968082,relation_version:7,way:1376180731,way_version:6,index:227,from:11649857778,to:8265822008}];
const simulated={elements:structuredClone(full.elements)},simIndex=osmElementIndex(simulated),proposals=[];
for(const target of targets){
 const way=fullIndex.get(`way/${target.way}`),relation=fullIndex.get(`relation/${target.relation}`),a=fullIndex.get(`node/${target.from}`),b=fullIndex.get(`node/${target.to}`);
 const parents=require200(`way/${target.way}/relations.json`).elements.filter(e=>e.type==='relation');
 const parentChains=parents.map(p=>({relation:p.id,parents:require200(`relation/${p.id}/relations.json`).elements.filter(e=>e.type==='relation').map(e=>e.id)}));
 const exact=way?.version===target.way_version&&relation?.version===target.relation_version&&way.nodes[target.index]===target.from&&a&&b&&a.lat===b.lat&&a.lon===b.lon;
 const before=parents.map(p=>auditOsmClosure(full,[p.id],'MD'));
 if(exact)simIndex.get(`way/${target.way}`).nodes[target.index]=target.to;
 const after=parents.map(p=>auditOsmClosure(simulated,[p.id],'MD'));
 const coordinateSequence=(w,index)=>w.nodes.map(id=>{const n=index.get(`node/${id}`);return [n.lon,n.lat];});
 const unchanged=exact&&equal(coordinateSequence(way,fullIndex),coordinateSequence(simIndex.get(`way/${target.way}`),simIndex));
 const reverseUses=[target.from,target.to].map(id=>({node_id:id,ways:require200(`node/${id}/ways.json`).elements.filter(e=>e.type==='way').map(e=>({id:e.id,version:e.version,positions:e.nodes.map((n,i)=>n===id?i:-1).filter(i=>i>=0),edited_by_proposal:e.id===target.way}))}));
 proposals.push({...target,coordinate:[a?.lon,a?.lat],version_and_endpoint_preconditions:exact,coordinate_sequence_unchanged:unchanged,orientation_preserved_by_identical_coordinate_order:unchanged,coordinate_sequence_sha256:exact?hash(coordinateSequence(way,fullIndex)):null,direct_parent_relations:parents.map(p=>({id:p.id,version:p.version})),parent_chains:parentChains,reverse_uses:reverseUses,before,after,impact_complete_for_observed_direct_parents:parents.every(p=>fullIndex.has(`relation/${p.id}`))&&parentChains.every(p=>p.parents.length===0),conditional_simulation_pass:exact&&unchanged&&after.every(p=>p.missing_reference_count===0&&p.invalid_coordinate_count===0&&p.topology_issue_count===0),mapper_intent_review:'REQUIRED_NOT_SELF_APPROVED',public_edit_authorization:'NOT_GRANTED',upload_performed:false});
}
const unchangedOtherObjects=full.elements.filter(e=>!targets.some(t=>e.type==='way'&&e.id===t.way)).every(e=>equal(e,simIndex.get(`${e.type}/${e.id}`)));
const report={schema:'osm-fix3-current-review-v1',scope:'13 identities and bounded current topology/impact diagnostic; not full RO/MD source qualification',input_sha256:{observations:hash(obsBytes),baseline:hash(baseBytes)},baseline_snapshot_at:baseline.snapshot_at,current_observation_window:{from:rows[0].accessed_at,to:rows.at(-1).accessed_at},snapshot_atomic_certified:false,matrix,successor,proposals,joint_simulation:{unchanged_other_objects:unchangedOtherObjects,audit:auditOsmClosure(simulated,[18967493,18968082,21515245],'MD'),status:proposals.every(p=>p.conditional_simulation_pass)&&unchangedOtherObjects?'PASS_FOR_ISOLATED_CONDITIONAL_SUBGRAPH':'BLOCKED'},OSM_SOURCE_CANDIDATE_VALIDATED:false,OSM_SOURCE_PROMOTED:false,OSM_FRESHNESS_PASS:false,ISSUE_396_RESOLVED:false,READY_FOR_UA_CV0:false,guards:{actual_mutation_allowed:false,p91_import_allowed:false,semantic_acceptance:'BLOCKED_INCOMPLETE',public_osm_edit_performed:false},limitations:['Coordinate-preserving simulation is not an authorized OSM edit or proof of original mapper intent','Dependency/node-incidence checks do not certify self-intersections or every global polygon','Independent selection and historical/provenance exceptions remain unresolved','No complete contemporary RO/MD snapshot was captured by this per-ID diagnostic']};
await writeFile(new URL('analysis.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({retired:matrix.filter(x=>x.current_state==='OFFICIALLY_RETIRED').length,added:1,simulation:report.joint_simulation.status,source_validated:false}));
