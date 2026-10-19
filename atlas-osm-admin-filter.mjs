import {osmLevelForTreeNode} from './atlas-osm-admin-badges.mjs';
export const OSM_ADMIN_LEVELS=[2,3,4,5,7,8,9];
export const OSM_UNKNOWN='unknown';
export const allOsmLevelFilters=()=>new Set([...OSM_ADMIN_LEVELS,OSM_UNKNOWN]);
export function osmTreeVisibleIds(nodeById,roots,active,context){
 const allowed=new Set(),selected=new Set(active),pending=[...roots.map(id=>[id,false])];
 while(pending.length){
  const [id,done]=pending.pop(),node=nodeById.get(id);
  if(!node)continue;
  if(!done){pending.push([id,true]);for(const child of node.child_ids||[])pending.push([child,false]);continue;}
  const level=osmLevelForTreeNode(node,context);
  if(selected.has(level===null?OSM_UNKNOWN:level)||(node.child_ids||[]).some(child=>allowed.has(child)))allowed.add(id);
 }
 return allowed;
}
