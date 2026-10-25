// Reused from PR398@027d66f; dependency/node-incidence audit, not full geometric certification.
import {osmElementIndex} from './osm-element-index.mjs';
const key=(type,id)=>type+'/'+Number(id);
export function auditOsmClosure(raw,selectedIds,code){
 const byKey=osmElementIndex(raw);
 const missing=[],invalidCoordinates=[],topology=[],checked=new Set();
 const selected=new Set(selectedIds.map(Number));
 const visit=(type,id,owner,root,role='')=>{
  const k=key(type,id),element=byKey.get(k);
  if(!element){missing.push({owner,missing:k,role,root_relation_id:root});return;}
  if(checked.has(k))return;checked.add(k);
  if(type==='node'&&(!Number.isFinite(element.lon)||!Number.isFinite(element.lat)||Math.abs(element.lon)>180||Math.abs(element.lat)>90))invalidCoordinates.push({owner,node_id:Number(id),root_relation_id:root});
  if(type==='way')for(const n of element.nodes||[])visit('node',n,k,root);
  if(type==='relation')for(const m of element.members||[])visit(m.type,m.ref,k,root,m.role||'');
 };
 for(const relationId of selected){
  visit('relation',relationId,'relation/'+relationId,relationId);
  const endpoints={outer:new Map(),inner:new Map()},invalid=[];let geometryWays=0;
  const boundary=(id,invert=false,parents=new Set())=>{
   if(parents.has(id)){invalid.push({relation_id:id,reason:'cyclic_geometry_relation'});return;}
   const r=byKey.get(key('relation',id));if(!r)return;
   const next=new Set(parents).add(id);
   for(const m of r.members||[]){
    if(!['outer','inner',''].includes(m.role||''))continue; // subarea/admin_centre are dependencies, not polygon edges.
    const inner=(m.role==='inner')!==invert,role=inner?'inner':'outer';
    if(m.type==='relation'){boundary(Number(m.ref),inner,next);continue;}
    if(m.type!=='way')continue;geometryWays++;
    const w=byKey.get(key('way',m.ref));if(!w)continue;
    if(!Array.isArray(w.nodes)||w.nodes.length<2){invalid.push({way_id:Number(m.ref),role,reason:'insufficient_way_nodes'});continue;}
    const start=Number(w.nodes[0]),end=Number(w.nodes.at(-1));
    if(start===end){if(w.nodes.length<4)invalid.push({way_id:Number(m.ref),role,reason:'degenerate_closed_ring'});continue;}
    for(const n of [start,end])endpoints[role].set(n,(endpoints[role].get(n)||0)+1);
   }
  };
  boundary(relationId);
  if(geometryWays===0)invalid.push({relation_id:relationId,reason:'no_polygon_way_members'});
  const odd=Object.fromEntries(Object.entries(endpoints).map(([role,degrees])=>[role,[...degrees].filter(([,degree])=>degree%2).map(([node_id,degree])=>({node_id,degree}))]));
  if(odd.outer.length||odd.inner.length||invalid.length){
   const coordinateGroups=new Map();
   for(const [role,points] of Object.entries(odd))for(const point of points){
    const node=byKey.get(key('node',point.node_id));if(!node||!Number.isFinite(node.lon)||!Number.isFinite(node.lat))continue;
    const position=JSON.stringify([role,node.lon,node.lat]);
    if(!coordinateGroups.has(position))coordinateGroups.set(position,{role,coordinates:[node.lon,node.lat],node_ids:[]});
    coordinateGroups.get(position).node_ids.push(point.node_id);
   }
   topology.push({relation_id:relationId,relation_version:byKey.get(key('relation',relationId))?.version??null,odd_endpoints:odd,coincident_distinct_endpoint_groups:[...coordinateGroups.values()].filter(g=>g.node_ids.length>1),invalid_geometry_members:invalid});
  }
 }
 return {scope:'dependency-and-node-incidence-only',full_topology_certified:false,code,selected_relation_count:selected.size,checked_dependency_count:checked.size,missing_reference_count:missing.length,missing_references:missing,invalid_coordinate_count:invalidCoordinates.length,invalid_coordinates:invalidCoordinates,topology_issue_count:topology.length,topology_issues:topology};
}
