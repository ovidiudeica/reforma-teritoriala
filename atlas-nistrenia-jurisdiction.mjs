import {validateNistreniaAdministrativeModel} from './atlas-nistrenia-administrative.mjs';
import {compactNistreniaDocumentaryName} from './atlas-tree-labels.mjs';
// P9.0.9.4: operational UI jurisdiction only. NEVER a legal ACTUAL entity/parent or a new polygon.
import {validateNistreniaOsmNavigation} from './atlas-nistrenia-osm.mjs';
export const NISTR_EN_ROOT='view-nistrenia';
export const NISTR_EN_GROUP_PREFIX='view-nistrenia-group-';
export const NISTR_EN_ROLE_PREFIX='view-nistrenia-role-';
export function createNistreniaOperationalView({catalog,roles,entityById,officialNodes,officialRoots}){
 const groups=validateNistreniaOsmNavigation(catalog,roles);
 if(!(entityById instanceof Map)||!(officialNodes instanceof Map)||officialNodes.size!==5848)throw Error('Nistrenia: invalid immutable ACTUAL baseline');
 if(officialRoots.length!==2||officialRoots.some(id=>!officialNodes.has(id)))throw Error('Nistrenia: expected two legal ACTUAL roots');
 const nodes=new Map(officialNodes),toActual=new Map(),aggregates=new Map(),roleIds=new Set();
 const root={id:NISTR_EN_ROOT,display_name:'Nistrenia',jurisdiction:'NI',parent_id:null,child_ids:[],roles:['operational_osm'],display_type:'state',depth:0,view_only:true};
 nodes.set(root.id,root);
 for(const group of groups){
  const groupId=NISTR_EN_GROUP_PREFIX+group.group_id,ids=[...group.role_ids];
  if(nodes.has(groupId))throw Error('Nistrenia: ID collision');
  const geoGroup={id:groupId,display_name:group.label,jurisdiction:'NI',parent_id:root.id,child_ids:[],roles:['operational_osm'],display_type:'district',depth:1,view_only:true};
  nodes.set(groupId,geoGroup);root.child_ids.push(groupId);aggregates.set(groupId,ids);
  for(const id of ids){
   const actual=entityById.get(id),osm=roles.get(id),source=officialNodes.get(id);
   if(!actual||!osm||!source||actual.jurisdiction!=='MD'||!Array.isArray(actual.map?.bbox)||actual.map.bbox.length!==4)throw Error('Nistrenia: unverified source geometry '+id);
   if(roleIds.has(id))throw Error('Nistrenia: duplicate role '+id);
   roleIds.add(id);
   const alias=NISTR_EN_ROLE_PREFIX+id;
   if(nodes.has(alias))throw Error('Nistrenia: role alias collision');
   nodes.set(alias,{id:alias,display_name:osm.display_name||source.display_name,jurisdiction:'NI',parent_id:groupId,child_ids:[],roles:['operational_osm'],display_type:source.display_type,depth:2,view_only:true,source_actual_id:id});
   geoGroup.child_ids.push(alias);toActual.set(alias,id);
  }
 }
 if(roleIds.size!==85||nodes.size!==officialNodes.size+1+7+85)throw Error('Nistrenia: 85 role invariant violated');
 aggregates.set(NISTR_EN_ROOT,[...roleIds]);
 return {nodes,rootIds:[...officialRoots,NISTR_EN_ROOT],toActual,aggregates,roleIds,groupIds:root.child_ids,root,groups,
  officialNodeCount:officialNodes.size,
  isVirtual:id=>id===NISTR_EN_ROOT||aggregates.has(id)||toActual.has(id),
  actualId:id=>toActual.get(id)||id,
  operationalJurisdiction:id=>roleIds.has(id)?'NI':entityById.get(id)?.jurisdiction,
  aggregateIds:id=>aggregates.get(id)||null};
}
export function nistreniaSearchEntities(view,entityById){
 if(!view)return [];
 if(view.model)return [...view.virtualIds].map(id=>{const node=view.nodes.get(id);return {...node,representation:{inferred_type:node.display_type},hierarchy:{consolidated_parent_id:node.parent_id},searchable_names:[node.display_name,...node.original_names]};});
 return [view.root,...view.groupIds.map(id=>view.nodes.get(id)),...[...view.toActual.entries()].map(([alias,id])=>{
  const original=entityById.get(id),node=view.nodes.get(alias);
  return {...original,id:alias,display_name:node.display_name,jurisdiction:'NI',roles:['operational_osm'],official_name:original.official_name,representation:{...(original.representation||{}),inferred_type:original.display_type}};
 })].map(node=>({
  ...node,representation:node.representation||{inferred_type:node.display_type},
  hierarchy:{...(node.hierarchy||{}),consolidated_parent_id:node.parent_id},
  searchable_names:[...(node.searchable_names||[]),...(node.id===NISTR_EN_ROOT?['Nistrenia','Transnistria','Republica Moldovenească Nistreană']:[])]
 }));
}

// Administrative presentation only; canonical objects stay in the legal ACTUAL tree.
export function createNistreniaAdministrativeView({model,entityById,officialNodes,officialRoots}){
 const checked=validateNistreniaAdministrativeModel(model,{actualIds:new Set(entityById.keys())});
 if(officialNodes.size!==5848||officialRoots.length!==2)throw Error('Nistrenia: invalid ACTUAL hierarchy');
 const nodes=new Map(officialNodes);
 for(const [id,node] of checked.nodes){if(nodes.has(id))throw Error('Nistrenia: presentation ID collision');nodes.set(id,{...node,display_name:compactNistreniaDocumentaryName(node)});}
 const roleIds=new Set(Object.values(model.compatibility_role_aliases));
 if(roleIds.size!==85)throw Error('Nistrenia: canonical geometry role coverage');
 return {model,nodes,resources:checked.resources,root:checked.root,rootIds:[...officialRoots,NISTR_EN_ROOT],
  groupIds:checked.root.child_ids,virtualIds:new Set(checked.nodes.keys()),roleIds,toActual:new Map(),
  officialNodeCount:officialNodes.size,isVirtual:id=>checked.nodes.has(id),actualId:id=>id,
  operationalJurisdiction:id=>roleIds.has(id)?'NI':entityById.get(id)?.jurisdiction,aggregateIds:()=>null};
}
