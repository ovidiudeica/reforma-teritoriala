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

/**
 * WEB-R2c.1.1 — counted tree filter scope, not visible geometries.
 * Matches are distinct directly matching tree-node IDs; ancestors are
 * navigation-only IDs retained by the existing filter. Both are computed
 * on the validated full tree, independently from expanded/virtual DOM rows.
 */
export function osmTreeFilterSummary(nodeById,roots,active,context){
 const visibleIds=osmTreeVisibleIds(nodeById,roots,active,context),selected=new Set(active);
 let matches=0;
 for(const id of visibleIds){
  const level=osmLevelForTreeNode(nodeById.get(id),context);
  if(selected.has(level===null?OSM_UNKNOWN:level))matches++;
 }
 return {visibleIds,matches,ancestors:visibleIds.size-matches};
}
