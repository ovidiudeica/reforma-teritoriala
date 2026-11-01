// NI-TREE.1: a single documentary tree with non-duplicated cartographic references.
// The 2023 source model and canonical ACTUAL geometry objects remain immutable.
export const NI_TREE1_ROOT='view-nistrenia';
export const NI_TREE1_LUNGA='view-nistrenia-role-osm-r19001619';
export const NI_TREE1_EXPLICIT_ASSOCIATIONS=Object.freeze({
 'osm-r1216706':{node:'view-nistrenia-place-20',reason:'DOCUMENTARY_OSM_PARENT_CONFLICT'},
 'osm-r19001619':{node:NI_TREE1_LUNGA,reason:'OSM_REFERENCE_ONLY_NO_DOCUMENTARY_UNIT'},
 'osm-r19015110':{node:'view-nistrenia-place-110',reason:'HOMONYMOUS_TOWN_NOT_RAION'},
 'osm-r8289751':{node:'view-nistrenia-place-218',reason:'HOMONYMOUS_TOWN_NOT_RAION'},
 'osm-r9301464':{node:'view-nistrenia-place-24',reason:'HOMONYMOUS_TOWN_NOT_RAION'}
});
const normalize=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('ro-RO').replace(/\s*[—–-]\s*oras$/u,'').trim();
const fail=m=>{throw Error('NI-TREE.1: '+m);};
export function buildNistreniaUnifiedTree(model,validated){
 if(model?.baseline_year!==2023||model.actual_mutation_allowed!==false||model.p91_import_allowed!==false)fail('protected model contract');
 const source=validated?.nodes,resources=validated?.resources;
 if(!(source instanceof Map)||!(resources instanceof Map)||source.size!==242)fail('source inventory');
 const nodes=new Map([...source].map(([id,node])=>[id,{...node,child_ids:[...node.child_ids]}]));
 const reparent=[
  ['view-nistrenia-unit-15','view-nistrenia-group-osm-r1702215'],
  ['view-nistrenia-unit-16','view-nistrenia-group-osm-r1702217']
 ];
 for(const [cityId,districtId] of reparent){
  const city=nodes.get(cityId),district=nodes.get(districtId);
  if(!city||city.parent_id!==NI_TREE1_ROOT||city.kind!=='upper_city'||!district||district.kind!=='raion'||district.parent_id!==NI_TREE1_ROOT)fail('unexpected city/district identity '+cityId);
  nodes.set(cityId,{...city,parent_id:districtId,depth:2});
  nodes.set(districtId,{...district,child_ids:[...district.child_ids,cityId]});
 }
 const root=nodes.get(NI_TREE1_ROOT);
 const rootChildren=root.child_ids.filter(id=>!reparent.some(([city])=>id===city));
 if(rootChildren.length!==7||new Set(rootChildren).size!==7||rootChildren.some(id=>!['raion','upper_city'].includes(nodes.get(id)?.kind)))fail('seven documented top-level branches');
 nodes.set(NI_TREE1_ROOT,{...root,child_ids:rootChildren});
 const sourceGroup=n=>{
  const seen=new Set();
  while(n?.parent_id&&n.parent_id!==NI_TREE1_ROOT){
   if(seen.has(n.id))fail('source cycle');seen.add(n.id);
   n=source.get(n.parent_id);
  }
  return n?.id||null;
 };
 const groups=new Map();
 for(const n of source.values()){
  if(!['raion','upper_city'].includes(n.kind))continue;
  const match=/^view-nistrenia-group-osm-r(\d+)$/.exec(n.id);
  if(match)groups.set(Number(match[1]),n.id);
 }
 if(groups.size!==7)fail('seven outline groups');
 const candidates=new Map();
 for(const n of source.values()){
  if(!['place','raion','upper_city'].includes(n.kind))continue;
  const key=normalize(n.display_name)+'|'+sourceGroup(n);
  const group=candidates.get(key)||[];group.push(n.id);candidates.set(key,group);
 }
 const geometryByNode=new Map(),associationByResource=new Map();
 for(const resource of resources.values()){
  if(resource.kind!=='ACTUAL')continue;
  const canonical=resource.canonical_id;
  const explicit=NI_TREE1_EXPLICIT_ASSOCIATIONS[canonical];
  const group=groups.get(resource.geometric_osm_parent_id);
  const possible=candidates.get(normalize(resource.display_name)+'|'+group)||[];
  const target=explicit?.node||(possible.length===1?possible[0]:null);
  if(!target)fail('unresolved geometry: '+canonical+' '+resource.display_name);
  if(explicit&&canonical!=='osm-r19001619'&&(!source.has(target)||normalize(source.get(target).display_name)!==normalize(resource.display_name)))fail('invalid documented exception target '+canonical);
  if(associationByResource.has(canonical))fail('duplicate canonical role '+canonical);
  if(!nodes.has(target)){
   if(target!==NI_TREE1_LUNGA||canonical!=='osm-r19001619')fail('unknown node '+target);
   const districtId='view-nistrenia-group-osm-r1702215',district=nodes.get(districtId);
   if(!district)fail('missing Lunga contextual district');
   nodes.set(target,{
    id:target,kind:'geometry_reference',display_type:'locality',display_name:'Lunga · referință OSM',
    jurisdiction:'NI',parent_id:districtId,child_ids:[],depth:2,view_only:true,
    source_actual_id:canonical,geometry_ref:null,geometry_candidates:[],
    geometry_status:'GEOMETRY_CANDIDATE',original_names:[],source_refs:[],
    additional_md_name_candidates:[],baseline_year:2023,
    temporal_notice:'Contur OSM fără identitate administrativă documentară confirmată; nu este o unitate nouă.',
    legal_certification:'PENDING',contemporary_status:'PROVISIONAL',
    administrative_status:'OSM_REFERENCE_ONLY',effective_control:'UNDETERMINED'
   });
   nodes.set(districtId,{...district,child_ids:[...district.child_ids,target]});
  }
  const array=geometryByNode.get(target)||[];
  array.push(canonical);geometryByNode.set(target,array);
  associationByResource.set(canonical,{
   nodeId:target,
   evidence:explicit?.reason||'UNIQUE_NAME_IN_OSM_GEOMETRIC_GROUP',
   geometricParentId:resource.geometric_osm_parent_id,
   legalBoundaryEquivalent:false
  });
 }
 if(associationByResource.size!==85||[...geometryByNode.values()].reduce((n,x)=>n+x.length,0)!==85)fail('85/85 role coverage');
 if(nodes.size!==243||nodes.get(NI_TREE1_ROOT).child_ids.length!==7)fail('documentary cardinality');
 // Validate every reachable node and prevent duplicate child edges.
 const seen=new Set();
 const visit=(id,parent,depth)=>{
  if(seen.has(id))fail('duplicate/cyclic documentary node '+id);
  seen.add(id);
  const n=nodes.get(id);
  if(!n||n.parent_id!==parent||n.depth!==depth)fail('parent/depth mismatch '+id);
  if(new Set(n.child_ids).size!==n.child_ids.length)fail('duplicate sibling '+id);
  for(const child of n.child_ids)visit(child,id,depth+1);
 };
 visit(NI_TREE1_ROOT,null,0);
 if(seen.size!==243)fail('unreachable documentary node');
 const mappedGeometryToNode=new Map([...associationByResource].map(([id,v])=>[id,v.nodeId]));
 return {nodes,root:nodes.get(NI_TREE1_ROOT),geometryByNode,associationByResource,
  mappedGeometryToNode,roleIds:new Set(associationByResource.keys()),
  referenceOnlyNodeIds:new Set([NI_TREE1_LUNGA]),
  groupIds:[...rootChildren],sourceDocumentaryNodes:source};
}
