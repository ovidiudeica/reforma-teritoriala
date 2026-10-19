// WEB-R2b.1: presentation only. Never modifies ACTUAL identities or geometry checkboxes.
const NI_GROUP_LEVEL_IDS=new Set(['1702216','1702217','1702215','1702214','1702219','1702218','944727']);
export function numericOsmLevel(value){
 if(typeof value!=='number'&&!(/^[0-9]+$/.test(value||'')))return null;
 const n=Number(value);
 return Number.isInteger(n)&&n>=1&&n<=12?n:null;
}
export function osmLevelForTreeNode(node,{entityById,osmRoleById}){
 if(!node)return null;
 if(node.id==='view-nistrenia')return 3;
 if(node.id.startsWith('view-nistrenia-group-osm-r')){
  const id=node.id.slice('view-nistrenia-group-osm-r'.length);
  return NI_GROUP_LEVEL_IDS.has(id)?5:null;
 }
 if(node.id.startsWith('view-nistrenia-role-')){
  const role=osmRoleById?.get(node.source_actual_id||node.id.slice('view-nistrenia-role-'.length));
  return role?numericOsmLevel(role.osm_admin_level):null;
 }
 return numericOsmLevel(entityById?.get(node.id)?.representation?.admin_level);
}
export function createOsmLevelBadge(document,level){
 const normalized=numericOsmLevel(level);
 if(normalized===null)return null;
 const badge=document.createElement('span');
 badge.className='tree-osm-admin-badge';
 badge.textContent=String(normalized);
 badge.setAttribute('aria-label','Nivel administrativ OSM '+normalized);
 badge.setAttribute('title','Nivel administrativ OSM '+normalized);
 return badge;
}
