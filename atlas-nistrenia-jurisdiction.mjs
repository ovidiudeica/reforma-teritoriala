import {buildNistreniaUnifiedTree,NI_TREE1_LUNGA} from './atlas-ni-tree1.mjs';
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
 if(view.model)return [...new Set([...view.virtualIds,...(view.geometryNavigationIds||[])])].map(id=>{const node=view.nodes.get(id);return {...node,representation:{inferred_type:node.display_type},hierarchy:{consolidated_parent_id:node.parent_id},searchable_names:[node.display_name,...(node.original_names||[])]};});
 return [view.root,...view.groupIds.map(id=>view.nodes.get(id)),...[...view.toActual.entries()].map(([alias,id])=>{
  const original=entityById.get(id),node=view.nodes.get(alias);
  return {...original,id:alias,display_name:node.display_name,jurisdiction:'NI',roles:['operational_osm'],official_name:original.official_name,representation:{...(original.representation||{}),inferred_type:original.display_type}};
 })].map(node=>({
  ...node,representation:node.representation||{inferred_type:node.display_type},
  hierarchy:{...(node.hierarchy||{}),consolidated_parent_id:node.parent_id},
  searchable_names:[...(node.searchable_names||[]),...(node.id===NISTR_EN_ROOT?['Nistrenia','Transnistria','Republica Moldovenească Nistreană']:[])]
 }));
}

// Administrative presentation only; canonical ACTUAL nodes and polygons remain unchanged.
// NI-TREE.1: seven documentary branches, with OSM geometry references on their
// corresponding documentary nodes, not an eighth cartographic-only sub-tree.
export function createNistreniaAdministrativeView({model,entityById,officialNodes,officialRoots}){
 const checked=validateNistreniaAdministrativeModel(model,{actualIds:new Set(entityById.keys())});
 if(officialNodes.size!==5848||officialRoots.length!==2)throw Error('Nistrenia: invalid ACTUAL hierarchy');
 const unified=buildNistreniaUnifiedTree(model,checked);
 const nodes=new Map(officialNodes);
 for(const [id,node] of unified.nodes){
  if(nodes.has(id))throw Error('Nistrenia: presentation ID collision '+id);
  nodes.set(id,{...node,child_ids:[...node.child_ids],
   display_name:node.kind==='geometry_reference'?node.display_name:compactNistreniaDocumentaryName(node)});
 }
 const toActual=new Map([[NI_TREE1_LUNGA,'osm-r19001619']]);
 for(const [alias,canonical] of toActual){
  const actual=entityById.get(canonical),source=officialNodes.get(canonical);
  if(!actual||!source||actual.jurisdiction!=='MD'||!Array.isArray(actual.map?.bbox)||actual.map.bbox.length!==4)throw Error('Nistrenia: missing canonical geometry '+canonical);
 }
 // NI-TREE.2 is a presentation-only projection: Moldova remains the sole
 // ACTUAL MD root; NI is its first display child before both statistical parts.
 const mdRootId='osm-r58974',md=nodes.get(mdRootId);
 if(!md||md.parent_id!==null||md.jurisdiction!=='MD'
    ||md.child_ids.length!==2||md.child_ids[0]!=='stat-MD11'||md.child_ids[1]!=='stat-MD12')
  throw Error('NI-TREE.2: unexpected immutable Moldova root layout');
 const niRoot=nodes.get(NISTR_EN_ROOT);
 nodes.set(NISTR_EN_ROOT,{...niRoot,parent_id:mdRootId,depth:1});
 for(const [id,node] of unified.nodes){
  if(id===NISTR_EN_ROOT)continue;
  nodes.set(id,{...nodes.get(id),depth:node.depth+1});
 }
 nodes.set(mdRootId,{...md,child_ids:[NISTR_EN_ROOT,...md.child_ids]});
 const root=nodes.get(NISTR_EN_ROOT);
 const roleIds=unified.roleIds;
 // The sole reference-only leaf (Lunga) is an explicit unresolved cartographic
 // association, never a new administrative identity.
 const geometryNavigationIds=new Set([NI_TREE1_LUNGA]);
 const virtualIds=new Set(unified.nodes.keys());
 const primaryGeometryForNode=id=>{
  const ids=unified.geometryByNode.get(id)||[];
  return ids.length===1?ids[0]:null;
 };
 return {model,nodes,resources:checked.resources,documentaryNodes:checked.nodes,
  root,navigationRoot:root,rootIds:[...officialRoots],
  groupIds:[...unified.groupIds],virtualIds,geometryNavigationIds,
  cartographicNavigationId:null,roleIds,toActual,
  geometryByNode:unified.geometryByNode,
  associationByResource:unified.associationByResource,
  mappedGeometryToNode:unified.mappedGeometryToNode,
  primaryGeometryForNode,
  officialNodeCount:officialNodes.size,
  isVirtual:id=>virtualIds.has(id),
  actualId:id=>toActual.get(id)||id,
  operationalJurisdiction:id=>entityById.get(toActual.get(id)||id)?.jurisdiction||(nodes.has(id)?'NI':undefined),
  aggregateIds:()=>null};
}
