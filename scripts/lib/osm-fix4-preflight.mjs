// Bounded mapper preflight. This module has no network, credential or upload operation.
import {createHash} from 'node:crypto';
import {osmElementIndex,mergeOsmElements} from './osm-element-index.mjs';
import {auditOsmClosure} from './osm-closure-audit.mjs';
import {readTopologyGeometry} from './p82-topology.mjs';
import {pointInGeometry} from '../../atlas-point-geometry.mjs';
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
export const digest=v=>createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
const same=(a,b)=>digest(a)===digest(b);
export function changesetElement(payload,id,{requireDiscussion=false}={}){
 if(!Number.isSafeInteger(id)||id<=0)throw Error('Invalid changeset identity');
 const values=[...(payload?.changeset?[payload.changeset]:[]),...(Array.isArray(payload?.elements)?payload.elements.filter(e=>e.type==='changeset'):[])];
 if(values.length!==1||values[0].id!==id)throw Error('Missing, ambiguous or mismatched changeset object');
 const e=values[0];
 if(requireDiscussion&&(!Array.isArray(e.comments)||e.comments.length!==e.comments_count))throw Error('Incomplete changeset discussion');
 return {id:e.id,created_at:e.created_at,closed_at:e.closed_at,tags:e.tags??{},comments_count:e.comments_count??null,discussion_retrieved:Array.isArray(e.comments),comments:Array.isArray(e.comments)?e.comments.map(c=>({id:c.id,date:c.date,visible:c.visible,text:c.text})):null};
}
function boundaryPaths(index,id,inner=false,parents=new Set(),paths={outer:[],inner:[]}){
 if(parents.has(id))throw Error('CYCLIC_GEOMETRY_RELATION');
 const relation=index.get(`relation/${id}`);if(!relation)throw Error('MISSING_RELATION');
 const next=new Set(parents).add(id);
 for(const m of relation.members??[]){
  if(!['outer','inner',''].includes(m.role??''))continue;
  const invert=(m.role==='inner')!==inner;
  if(m.type==='relation')boundaryPaths(index,m.ref,invert,next,paths);
  else if(m.type==='way'){
   const way=index.get(`way/${m.ref}`);if(!way||!Array.isArray(way.nodes)||way.nodes.length<2)throw Error('MISSING_OR_DEGENERATE_WAY');
   paths[invert?'inner':'outer'].push({id:way.id,nodes:way.nodes});
  }
 }
 return paths;
}
// Reuses the prior exact-ID ring stitching: never join by coordinate coincidence.
export function assembleRings(paths){
 const pending=paths.map(p=>({id:p.id,nodes:[...p.nodes]})),rings=[];
 while(pending.length){
  const first=pending.shift(),chain=first.nodes,used=[first.id];
  while(chain.at(-1)!==chain[0]){
   const end=chain.at(-1),choices=pending.map((p,i)=>({p,i})).filter(({p})=>p.nodes[0]===end||p.nodes.at(-1)===end);
   if(!choices.length)throw Error('OPEN_BY_NODE_IDENTITY');
   if(choices.length!==1)throw Error('AMBIGUOUS_BRANCHING_REQUIRES_OSM_SPECIAL_CASE_REVIEW');
   const {p,i}=choices[0];pending.splice(i,1);const nodes=p.nodes[0]===end?p.nodes:[...p.nodes].reverse();chain.push(...nodes.slice(1));used.push(p.id);
  }
  if(chain.length<4)throw Error('DEGENERATE_RING');rings.push({nodes:chain,ways:used});
 }
 return rings;
}
export function relationGeometry(index,id){
 const paths=boundaryPaths(index,id);if(!paths.outer.length)throw Error('NO_OUTER_WAYS');
 const coordinates=ring=>ring.nodes.map(n=>{const node=index.get(`node/${n}`);if(!node||!Number.isFinite(node.lon)||!Number.isFinite(node.lat))throw Error('MISSING_OR_INVALID_NODE');return [node.lon,node.lat];});
 const outer=assembleRings(paths.outer).map(coordinates),inner=assembleRings(paths.inner).map(coordinates),polygons=outer.map(o=>[o]);
 for(const hole of inner){
  const candidates=outer.map((o,i)=>({i,states:hole.slice(0,-1).map(p=>pointInGeometry(p,{type:'Polygon',coordinates:[o]}))})).filter(c=>c.states.includes('inside'));
  if(candidates.length!==1)throw Error('UNASSIGNED_OR_AMBIGUOUS_HOLE');polygons[candidates[0].i].push(hole);
 }
 const geometry=polygons.length===1?{type:'Polygon',coordinates:polygons[0]}:{type:'MultiPolygon',coordinates:polygons};
 readTopologyGeometry(geometry);return geometry;
}
function audit(index,ids){
 const raw={elements:[...index.values()]};return ids.map(id=>{
  const closure=auditOsmClosure(raw,[id],'MD');let geometry=null,error=null;
  try{if(closure.missing_reference_count||closure.invalid_coordinate_count||closure.topology_issue_count)throw Error('NODE_INCIDENCE_OR_DEPENDENCY_FAILURE');geometry=relationGeometry(index,id);}catch(e){error=e.message;}
  return {id,closure,geometry_valid:geometry!==null,geometry_sha256:geometry?digest(geometry):null,error};
 });
}
const geometryRelation=e=>e.type==='relation'&&(e.tags?.boundary==='administrative'||['boundary','multipolygon'].includes(e.tags?.type));
export function assessFix4(rows,targets){
 const keys=['relation','relation_version','way','way_version','index','from','to'];
 if(!Array.isArray(targets)||!targets.length)throw Error('Missing explicit preflight targets');
 for(const t of targets)if(Object.keys(t).some(k=>!keys.includes(k))||keys.some(k=>!Number.isSafeInteger(t[k])||t[k]<(k==='index'?0:1))||t.from===t.to)throw Error('Invalid or unsupported target/authority fields');
 const last=path=>rows.filter(r=>r.path===path).at(-1);
 const requireRow=path=>{const r=last(path);if(!r||r.http_status!==200||r.error||!Array.isArray(r.elements))throw Error('Incomplete official preflight '+path);return r;};
 const index=new Map();
 for(const row of rows)for(const e of row.elements??[])if(!Number.isSafeInteger(e.version)||e.version<1||!Number.isSafeInteger(e.changeset)||!Number.isFinite(Date.parse(e.timestamp))||e.visible===false)throw Error('Invalid current object metadata');
 for(const r of rows.filter(r=>r.path.endsWith('/full.json'))){if(r.http_status!==200||r.error)throw Error('Incomplete full response');mergeOsmElements(index,r.elements);}
 // Consistency across current API views; histories are kept separate and never merged as current.
 for(const row of rows)for(const e of row.elements??[]){
  const full=index.get(`${e.type}/${e.id}`);if(!full)continue;
  for(const k of ['version','timestamp','changeset','nodes','members','lat','lon','tags'])if(Object.hasOwn(full,k)&&Object.hasOwn(e,k)&&!same(full[k],e[k]))throw Error(`Conflicting current API witness ${e.type}/${e.id}/${k}`);
 }
 const nodeIds=[...new Set(targets.flatMap(t=>[t.from,t.to]))],reverseWays=new Set(),parents=new Map();
 for(const id of nodeIds){const r=requireRow(`node/${id}/ways.json`);const got=new Set(r.elements.map(w=>w.id));for(const w of index.values())if(w.type==='way'&&w.nodes?.includes(id)&&!got.has(w.id))throw Error('Missing known inverse node use');for(const w of r.elements){if(w.type!=='way'||!w.nodes?.includes(id))throw Error('Invalid node reverse-use witness');reverseWays.add(w.id);}}
 for(const id of reverseWays){const r=requireRow(`way/${id}/relations.json`);const got=new Set(r.elements.map(e=>e.id));for(const e of index.values())if(e.type==='relation'&&e.members?.some(m=>m.type==='way'&&m.ref===id)&&!got.has(e.id))throw Error('Missing known inverse way parent');for(const relation of r.elements){if(relation.type!=='relation')throw Error('Invalid way parent witness');parents.set(relation.id,relation);}}
 const affected=new Set(),pending=[];
 for(const t of targets){const parents=requireRow(`way/${t.way}/relations.json`).elements;if(!parents.some(r=>r.id===t.relation))throw Error('Missing target inverse parent');for(const r of parents){affected.add(r.id);pending.push(r.id);}}
 const seen=new Set();
 while(pending.length){const id=pending.shift();if(seen.has(id))continue;seen.add(id);const r=requireRow(`relation/${id}/relations.json`);for(const p of r.elements){if(p.type!=='relation')throw Error('Invalid relation parent witness');affected.add(p.id);parents.set(p.id,p);pending.push(p.id);}}
 const geometryIds=[...new Set([...parents.values()].filter(geometryRelation).map(e=>e.id).concat([...affected]))].sort((a,b)=>a-b);
 for(const id of geometryIds)if(!index.has(`relation/${id}`))throw Error('Missing neighbor geometry '+id);
 const before=audit(index,geometryIds),simIndex=osmElementIndex({elements:structuredClone([...index.values()])}),proposals=[];
 for(const t of targets){
  const way=index.get(`way/${t.way}`),relation=index.get(`relation/${t.relation}`),a=index.get(`node/${t.from}`),b=index.get(`node/${t.to}`);
  const positions=Array.isArray(way?.nodes)?way.nodes.map((n,i)=>n===t.from?i:-1).filter(i=>i>=0):[];
  const nodeIndex=positions.length===1?positions[0]:-1;
  const terminal=nodeIndex===0||nodeIndex===way?.nodes?.length-1;
  const partner=(relation?.members??[]).filter(m=>m.type==='way'&&m.ref!==t.way&&['outer','inner',''].includes(m.role??'')).some(m=>{const w=index.get(`way/${m.ref}`);return w?.nodes[0]===t.to||w?.nodes.at(-1)===t.to;});
  const base=before.find(r=>r.id===t.relation);
  const eligible=Boolean(way&&relation&&base&&base.closure.missing_reference_count===0&&base.closure.invalid_coordinate_count===0&&terminal&&partner&&a&&b&&a.lat===b.lat&&a.lon===b.lon);
  if(eligible)simIndex.get(`way/${t.way}`).nodes[nodeIndex]=t.to;
  const coords=(w,lookup)=>w.nodes.map(n=>{const v=lookup.get(`node/${n}`);return [v.lon,v.lat];});
  const changed=eligible?simIndex.get(`way/${t.way}`):null;
  proposals.push({...t,current_way_version:way?.version??null,current_relation_version:relation?.version??null,current_node_index:nodeIndex,proposal_differs_from_reference:way?.version!==t.way_version||relation?.version!==t.relation_version||nodeIndex!==t.index,technical_preconditions:eligible,ordered_coordinates_identical:eligible&&same(coords(way,index),coords(changed,simIndex)),only_one_reference_changed:eligible&&way.nodes.length===changed.nodes.length&&way.nodes.filter((n,i)=>n!==changed.nodes[i]).length===1,way_tags_unchanged:eligible&&same(way.tags??{},changed.tags??{}),nodes_preserved:true,source_before_sha256:way?digest(way):null,proposed_after_sha256:changed?digest(changed):null,mapper_intent:'MAPPER_INTENT_UNRESOLVED',mapper_review_record:null,upload_authorization:null});
 }
 const individual=proposals.map(p=>{
  const isolated=osmElementIndex({elements:structuredClone([...index.values()])});
  if(p.technical_preconditions)isolated.get(`way/${p.way}`).nodes[p.current_node_index]=p.to;
  const results=audit(isolated,geometryIds),newFailures=results.filter(r=>!r.geometry_valid&&before.find(b=>b.id===r.id).geometry_valid).map(r=>r.id);
  const ownParents=new Set(),queue=requireRow(`way/${p.way}/relations.json`).elements.map(r=>r.id);
  while(queue.length){const id=queue.shift();if(ownParents.has(id))continue;ownParents.add(id);queue.push(...requireRow(`relation/${id}/relations.json`).elements.map(r=>r.id));}
  return {way:p.way,relation:p.relation,affected_relation_ids:[...ownParents].sort((a,b)=>a-b),after:results,new_geometry_failure_ids:newFailures,pass:p.technical_preconditions&&p.ordered_coordinates_identical&&p.only_one_reference_changed&&results.filter(r=>ownParents.has(r.id)).every(r=>r.geometry_valid)&&newFailures.length===0};
 });
 const after=audit(simIndex,geometryIds),otherObjectsUnchanged=[...index.values()].filter(e=>!(e.type==='way'&&targets.some(t=>t.way===e.id))).every(e=>same(e,simIndex.get(`${e.type}/${e.id}`)));
 const unaffectedIds=geometryIds.filter(id=>!affected.has(id)),neighborsUnchanged=unaffectedIds.every(id=>same(before.find(x=>x.id===id),after.find(x=>x.id===id)));
 return {scope:'Current bounded local preflight, not a global OSM topology/source certificate',object_count:index.size,geometry_relation_ids:geometryIds,affected_relation_ids:[...affected].sort((a,b)=>a-b),reverse_way_ids:[...reverseWays].sort((a,b)=>a-b),before,proposals,individual_simulations:individual,after,other_objects_unchanged:otherObjectsUnchanged,unaffected_neighbor_results_identical:neighborsUnchanged,all_neighbor_geometries_valid_before:before.filter(x=>unaffectedIds.includes(x.id)).every(x=>x.geometry_valid),all_observed_geometries_valid_after:after.every(x=>x.geometry_valid),INVERSE_REFERENCES_VALIDATED:rows.every(r=>r.http_status===200&&!r.error),CONDITIONAL_SIMULATION_PASS:individual.every(x=>x.pass)&&proposals.every(p=>p.technical_preconditions&&p.ordered_coordinates_identical&&p.only_one_reference_changed&&p.way_tags_unchanged)&&after.every(x=>x.geometry_valid)&&otherObjectsUnchanged&&neighborsUnchanged,HORESTI_MAPPER_INTENT_CONFIRMED:false,BUNETI_MAPPER_INTENT_CONFIRMED:false,PUBLIC_OSM_EDIT_AUTHORIZED:false,PUBLIC_OSM_EDIT_EXECUTED:false,UPSTREAM_TOPOLOGY_FIXED:false,OSM_SOURCE_CANDIDATE_VALIDATED:false,OSM_SOURCE_PROMOTED:false,OSM_FRESHNESS_PASS:false,ISSUE_396_RESOLVED:false,READY_FOR_UA_CV0:false,publication_eligible:false,publication_blockers:['MAPPER_INTENT_UNRESOLVED for both objects','No explicit final upload authorization','No authenticated mapper editor/account assumed'],post_publication_checks_executed:false,published_changeset_ids:[]};
}
