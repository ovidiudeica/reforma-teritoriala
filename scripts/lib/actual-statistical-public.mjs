import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {readFile,writeFile} from 'node:fs/promises';
import osmtogeojson from 'osmtogeojson';
import {bbox,centroid} from '@turf/turf';

export const STATISTICAL_POLICY_PATH='data/sources/actual-statistical-policy.json';
export const STATISTICAL_CONTRACT_PATH='schemas/actual-statistical-hierarchy-contract.json';
export const SETTLEMENT_POLICY_PATH='data/sources/actual-settlement-policy.json';
export const STATISTICAL_SOURCE_BUNDLE_PATH='data/sources/actual-statistical-source-bundle.json';
export const RO_LAYER_PATH='data/p2/actual-statistical-ro.json';
export const MD_LAYER_PATH='data/p2/actual-statistical-md.json';
export const RO_OSM_MANIFEST_PATH='data/sources/ro-statistical-osm-current.json';
export const MD_OSM_MANIFEST_PATH='data/sources/md-statistical-osm-current.json';
export const PUBLIC_INDEX_PATH='public/data/actual-entities.json';
export const RO_OVERVIEW_PATH='public/geo/actual/ro-overview.geojson';
export const MD_OVERVIEW_PATH='public/geo/actual/md-overview.geojson';
export const ACTIVATION_MARKER_PATH='data/current/actual-statistical-activation.json';
export const PUBLIC_CONTRACT='actual-public-entity-v3';
export const PUBLIC_SCHEMA_VERSION=3;
export const HIERARCHY_CONTRACT='actual-public-hierarchy-v1';

export const sha256=value=>createHash('sha256').update(value).digest('hex');
const json=async(path,readFileFn=readFile)=>JSON.parse((await readFileFn(path)).toString('utf8'));
const unique=values=>[...new Set(values.filter(Boolean))];

function relationFeature(snapshot,relationId){
 const converted=osmtogeojson(snapshot,{flatProperties:false});
 const wanted='relation/'+String(relationId);
 const feature=(converted.features||[]).find(f=>String(f.id)===wanted||String(f.properties?.id??'')===wanted);
 if(!feature||!['Polygon','MultiPolygon'].includes(feature.geometry?.type))throw new Error('Missing polygonal statistical OSM relation '+relationId);
 return {type:'Feature',properties:{},geometry:feature.geometry};
}

function mapMeta(feature){
 return {tier:'overview',bbox:bbox(feature),center:centroid(feature).geometry.coordinates};
}

function statPublicEntity(spec,feature){
 return {
  id:spec.id,
  status:'current',
  jurisdiction:spec.jurisdiction,
  category:'statistical',
  roles:['statistical'],
  name:spec.name,
  official_name:spec.official_name||spec.name,
  display_name:spec.official_name||spec.name,
  display_type:'statistical_level_'+spec.statistical.level,
  searchable_names:unique([spec.name,spec.official_name,spec.statistical.code]),
  legal:null,
  statistical:{...spec.statistical},
  statistical_membership:null,
  hierarchy:{
   parent_catalog_id:spec.statistical.parent_entity_id||null,
   parent_name:null,
   legal_parent_id:null,
   legal_parent_name:null,
   administrative_parent_id:null,
   statistical_parent_id:spec.statistical.parent_entity_id||null,
   navigation_parent_id:spec.statistical.parent_entity_id||null,
   navigation_parent_kind:'statistical'
  },
  representation:{
   source:'OpenStreetMap',
   source_url:'https://www.openstreetmap.org/relation/'+spec.representation.osm_relation_id,
   osm_relation_id:spec.representation.osm_relation_id,
   source_feature_id:null,
   source_inspire_id:null,
   partition_mode:null,
   outer_shell_source:null,
   internal_boundary_source:null,
   osm_shell_relation_id:null,
   admin_level:null,
   place:null,
   inferred_type:'statistical_level_'+spec.statistical.level,
   geometry_source:'OpenStreetMap statistical relation bound to official statistical identity',
   geometry_role:'statistical_representation',
   canonical_geometry_role:'statistical_boundary',
   geometry_scope:spec.representation.geometry_scope,
   public_geometry_precision:'source_snapshot_coordinate_fidelity',
   master_geometry_path:spec.representation.source_snapshot,
   statistical_identity_authority:spec.statistical.identity_authority,
   osm_ref_is_identity_authority:spec.representation.osm_ref_is_identity_authority??false,
   osm_statistical_ref:spec.representation.osm_statistical_ref??spec.statistical.code,
   identity_ref_conflict:spec.representation.identity_ref_conflict??null,
   geometry_review_class:spec.representation.geometry_review_class??null
  },
  validation:{
   legal_identity_status:'statistical_identity',
   reconciliation_class:null,
   review_status:null,
   review_source:null,
   match_confidence:'official',
   representation_confidence:'reviewed',
   review_required:false
  },
  map:mapMeta(feature)
 };
}

function ensureHierarchyFields(entity){
 const administrativeParent=entity.hierarchy?.parent_catalog_id??null;
 entity.roles=unique(entity.roles?.length?entity.roles:['administrative']);
 entity.hierarchy={
  ...(entity.hierarchy||{}),
  administrative_parent_id:entity.hierarchy?.administrative_parent_id??administrativeParent,
  statistical_parent_id:entity.hierarchy?.statistical_parent_id??null,
  navigation_parent_id:entity.hierarchy?.navigation_parent_id??administrativeParent,
  navigation_parent_kind:entity.hierarchy?.navigation_parent_kind??(administrativeParent?'administrative':null)
 };
 return entity;
}

function buildTree(entities){
 const byId=new Map(entities.map(e=>[e.id,e]));
 const children=new Map(entities.map(e=>[e.id,[]]));
 const roots=[];
 for(const entity of entities){
  const parent=entity.hierarchy?.navigation_parent_id??null;
  if(parent==null)roots.push(entity.id);
  else{
   if(parent===entity.id)throw new Error('Self-parent in consolidated hierarchy: '+entity.id);
   if(!byId.has(parent))throw new Error('Missing consolidated parent '+parent+' for '+entity.id);
   children.get(parent).push(entity.id);
  }
 }
 const order=(a,b)=>{
  const ea=byId.get(a),eb=byId.get(b);
  const sa=ea?.statistical?.level??99,sb=eb?.statistical?.level??99;
  return sa-sb||String(ea?.display_name??a).localeCompare(String(eb?.display_name??b),'ro');
 };
 for(const xs of children.values())xs.sort(order);
 roots.sort((a,b)=>String(byId.get(a)?.jurisdiction).localeCompare(String(byId.get(b)?.jurisdiction)));
 const nodes=entities.map(entity=>({
  id:entity.id,
  jurisdiction:entity.jurisdiction,
  display_name:entity.display_name,
  display_type:entity.display_type,
  category:entity.category,
  roles:entity.roles,
  statistical_code:entity.statistical?.code??null,
  statistical_level:entity.statistical?.level??null,
  parent_id:entity.hierarchy?.navigation_parent_id??null,
  parent_kind:entity.hierarchy?.navigation_parent_kind??null,
  children:children.get(entity.id)
 }));
 const rootSet=new Set(roots);
 if(roots.length!==2)throw new Error('Consolidated hierarchy must have exactly two country roots, got '+roots.length+': '+roots.join(','));
 const visited=new Set(),stack=[...roots];
 while(stack.length){
  const id=stack.pop();
  if(visited.has(id))throw new Error('Cycle/duplicate traversal in consolidated hierarchy at '+id);
  visited.add(id);
  stack.push(...(children.get(id)||[]));
 }
 if(visited.size!==entities.length){
  const missing=entities.filter(e=>!visited.has(e.id)).map(e=>e.id).slice(0,25);
  throw new Error('Consolidated hierarchy is disconnected: visited='+visited.size+' entities='+entities.length+' missing='+missing.join(','));
 }
 return {
  contract:HIERARCHY_CONTRACT,
  root_count:roots.length,
  roots,
  node_count:nodes.length,
  nodes
 };
}

function statisticalFeature(entity,feature){
 return {
  type:'Feature',
  properties:{
   entity_id:entity.id,
   jurisdiction:entity.jurisdiction,
   display_name:entity.display_name,
   display_type:entity.display_type,
   tier:'overview',
   legal_identity_status:'statistical_identity',
   geometry_precision:'source_snapshot_coordinate_fidelity',
   geometry_role:'statistical_boundary',
   statistical_code:entity.statistical.code,
   statistical_level:entity.statistical.level
  },
  geometry:feature.geometry
 };
}

export async function activateStatisticalPublicContract({readFileFn=readFile,writeFileFn=writeFile}={}){
 const [policy,settlementPolicy,baseIndex,roLayer,mdLayer,roOsm,mdOsm,roOverview,mdOverview,contract,bundle]=await Promise.all([
  json(STATISTICAL_POLICY_PATH,readFileFn),
  json(SETTLEMENT_POLICY_PATH,readFileFn),
  json(PUBLIC_INDEX_PATH,readFileFn),
  json(RO_LAYER_PATH,readFileFn),
  json(MD_LAYER_PATH,readFileFn),
  json(RO_OSM_MANIFEST_PATH,readFileFn),
  json(MD_OSM_MANIFEST_PATH,readFileFn),
  json(RO_OVERVIEW_PATH,readFileFn),
  json(MD_OVERVIEW_PATH,readFileFn),
  json(STATISTICAL_CONTRACT_PATH,readFileFn),
  json(STATISTICAL_SOURCE_BUNDLE_PATH,readFileFn)
 ]);
 if(policy?.activation_requested!==true)return {status:'SKIP',reason:'statistical_activation_not_requested'};
 if(settlementPolicy?.public_contract!==PUBLIC_CONTRACT)return {status:'SKIP',reason:'public_contract_v3_not_selected'};
 if(baseIndex.contract!=='actual-public-entity-v2'||Number(baseIndex.schema_version)!==2||baseIndex.entity_count!==5830)throw new Error('P2.3 activation requires exact v2 administrative public baseline');
 const [roGz,mdGz]=await Promise.all([readFileFn(roOsm.snapshot_path),readFileFn(mdOsm.snapshot_path)]);
 if(sha256(roGz)!==roOsm.compressed_sha256||sha256(mdGz)!==mdOsm.compressed_sha256)throw new Error('Statistical OSM compressed snapshot binding mismatch');
 const roRaw=gunzipSync(roGz),mdRaw=gunzipSync(mdGz);
 if(sha256(roRaw)!==roOsm.semantic_sha256||sha256(mdRaw)!==mdOsm.semantic_sha256)throw new Error('Statistical OSM semantic snapshot binding mismatch');
 const roSnapshot=JSON.parse(roRaw.toString('utf8')),mdSnapshot=JSON.parse(mdRaw.toString('utf8'));
 const entities=(baseIndex.entities||[]).map(e=>ensureHierarchyFields(structuredClone(e)));
 const byId=new Map(entities.map(e=>[e.id,e]));
 const newFeatures={RO:[],MD:[]};

 for(const membership of roLayer.existing_entity_memberships||[]){
  const entity=byId.get(membership.entity_id);if(!entity)throw new Error('Missing RO NUTS3 reuse target '+membership.entity_id);
  entity.roles=unique([...entity.roles,'statistical']);
  entity.statistical={...membership.statistical,geometry_reuse:membership.geometry_reuse};
  entity.hierarchy.statistical_parent_id=membership.statistical.parent_entity_id;
  entity.hierarchy.navigation_parent_id=membership.statistical.parent_entity_id;
  entity.hierarchy.navigation_parent_kind='statistical';
 }
 for(const role of mdLayer.existing_entity_statistical_roles||[]){
  const entity=byId.get(role.entity_id);if(!entity)throw new Error('Missing MD reused statistical target '+role.entity_id);
  entity.roles=unique([...entity.roles,'statistical']);
  entity.statistical={...role.statistical,geometry_reuse:role.geometry_reuse};
  entity.hierarchy.statistical_parent_id=role.statistical.parent_entity_id;
  entity.hierarchy.navigation_parent_id=role.statistical.parent_entity_id;
  entity.hierarchy.navigation_parent_kind=role.statistical.parent_entity_id?'statistical':null;
 }
 for(const binding of mdLayer.administrative_component_bindings||[]){
  const entity=byId.get(binding.entity_id);if(!entity)throw new Error('Missing MD component target '+binding.entity_id);
  entity.statistical_membership={
   classification:'NUTS_MOLDOVA',
   version:'2017',
   component_statistical_code:binding.component_statistical_code,
   parent_code:binding.statistical_parent_code,
   parent_entity_id:binding.statistical_parent_entity_id,
   source:binding.source
  };
  if(binding.tree_edge_created){
   entity.hierarchy.navigation_parent_id=binding.statistical_parent_entity_id;
   entity.hierarchy.navigation_parent_kind='statistical';
  }
 }

 const addNew=(spec,snapshot)=>{
  if(byId.has(spec.id))throw new Error('Duplicate statistical entity id '+spec.id);
  const sourceFeature=relationFeature(snapshot,spec.representation.osm_relation_id);
  const entity=statPublicEntity(spec,sourceFeature);
  byId.set(entity.id,entity);entities.push(entity);
  newFeatures[entity.jurisdiction].push(statisticalFeature(entity,sourceFeature));
 };
 for(const spec of roLayer.statistical_entities||[])addNew(spec,roSnapshot);
 for(const spec of mdLayer.statistical_entities||[])addNew(spec,mdSnapshot);

 const hierarchyTree=buildTree(entities);
 const entityCountByJurisdiction=Object.fromEntries(['RO','MD'].map(j=>[j,entities.filter(e=>e.jurisdiction===j).length]));
 const legalIdentityStatusCounts={};
 for(const e of entities){const s=e.validation?.legal_identity_status||'unknown';legalIdentityStatusCounts[s]=(legalIdentityStatusCounts[s]||0)+1;}
 const finalIndex={
  ...baseIndex,
  schema_version:PUBLIC_SCHEMA_VERSION,
  contract:PUBLIC_CONTRACT,
  entity_count:entities.length,
  administrative_entity_count:5830,
  statistical_only_entity_count:18,
  entity_count_by_jurisdiction:entityCountByJurisdiction,
  statistical_model:{
   contract:contract.contract,
   contract_path:STATISTICAL_CONTRACT_PATH,
   source_bundle_path:STATISTICAL_SOURCE_BUNDLE_PATH,
   source_bundle_fingerprint_sha256:bundle.bundle_fingerprint_sha256,
   RO:{classification:'NUTS',version:'2024',new_entities:12,reused_entities:42},
   MD:{classification:'NUTS_MOLDOVA',version:'2017',new_entities:6,reused_entities:3,component_bindings:37},
   geometry_policy:'Administrative master geometry is immutable. Reused statistical roles share existing entity geometry; statistical-only entities use exact reviewed OSM statistical snapshot geometry.'
  },
  legal_identity_status_counts:legalIdentityStatusCounts,
  hierarchy_tree:hierarchyTree,
  entities
 };

 const addFeatures=(doc,items)=>{
  const copy=structuredClone(doc);
  copy.features=[...(copy.features||[]),...items];
  if(copy.metadata)copy.metadata.feature_count=copy.features.length;
  return copy;
 };
 const finalRoOverview=addFeatures(roOverview,newFeatures.RO);
 const finalMdOverview=addFeatures(mdOverview,newFeatures.MD);
 const markerCore={
  schema_version:1,
  mode:'ACTUAL_STATISTICAL_ACTIVATION',
  phase:'P2.3_PUBLIC',
  activated:true,
  public_contract:PUBLIC_CONTRACT,
  public_schema_version:PUBLIC_SCHEMA_VERSION,
  administrative_entity_count:5830,
  statistical_only_entity_count:18,
  public_entity_count:entities.length,
  entity_count_by_jurisdiction:entityCountByJurisdiction,
  hierarchy_contract:HIERARCHY_CONTRACT,
  hierarchy_node_count:hierarchyTree.node_count,
  source_bundle_fingerprint_sha256:bundle.bundle_fingerprint_sha256,
  ro_layer_fingerprint_sha256:roLayer.layer_fingerprint_sha256,
  md_layer_fingerprint_sha256:mdLayer.layer_fingerprint_sha256,
  ro_statistical_osm_semantic_sha256:roOsm.semantic_sha256,
  md_statistical_osm_semantic_sha256:mdOsm.semantic_sha256,
  policy:'Release-bound activation of the consolidated RO+MD statistical hierarchy. Existing administrative parentage and master geometry remain unchanged; statistical-only geometry is sourced from reviewed OSM statistical snapshots.'
 };
 const marker={...markerCore,activation_fingerprint_algorithm:'actual-statistical-activation-v1',activation_fingerprint_sha256:sha256(Buffer.from(JSON.stringify(markerCore),'utf8'))};
 await Promise.all([
  writeFileFn(PUBLIC_INDEX_PATH,JSON.stringify(finalIndex,null,2)+'\n'),
  writeFileFn(RO_OVERVIEW_PATH,JSON.stringify(finalRoOverview,null,2)+'\n'),
  writeFileFn(MD_OVERVIEW_PATH,JSON.stringify(finalMdOverview,null,2)+'\n'),
  writeFileFn(ACTIVATION_MARKER_PATH,JSON.stringify(marker,null,2)+'\n')
 ]);
 return {status:'PASS',public_entity_count:entities.length,entity_count_by_jurisdiction:entityCountByJurisdiction,statistical_only_entity_count:18,hierarchy_node_count:hierarchyTree.node_count,activation_fingerprint_sha256:marker.activation_fingerprint_sha256};
}

export async function validateStatisticalPublicActivation({readFileFn=readFile}={}){
 const failures=[],checks=[];const check=(name,ok,detail={})=>{checks.push({name,ok:Boolean(ok),detail});if(!ok)failures.push({name,detail});};
 const [policy,index,marker,roLayer,mdLayer,roOsm,mdOsm,roOverview,mdOverview]=await Promise.all([
  json(STATISTICAL_POLICY_PATH,readFileFn),json(PUBLIC_INDEX_PATH,readFileFn),json(ACTIVATION_MARKER_PATH,readFileFn),
  json(RO_LAYER_PATH,readFileFn),json(MD_LAYER_PATH,readFileFn),json(RO_OSM_MANIFEST_PATH,readFileFn),json(MD_OSM_MANIFEST_PATH,readFileFn),
  json(RO_OVERVIEW_PATH,readFileFn),json(MD_OVERVIEW_PATH,readFileFn)
 ]);
 check('activation_requested',policy.activation_requested===true,{activation_requested:policy.activation_requested??null});
 check('marker_active',marker.activated===true&&marker.phase==='P2.3_PUBLIC',{marker});
 check('public_contract_v3',index.contract===PUBLIC_CONTRACT&&Number(index.schema_version)===3,{contract:index.contract,schema_version:index.schema_version});
 check('public_cardinality',index.entity_count===5848&&index.administrative_entity_count===5830&&index.statistical_only_entity_count===18,{entity_count:index.entity_count,administrative:index.administrative_entity_count,statistical_only:index.statistical_only_entity_count});
 check('jurisdiction_cardinality',index.entity_count_by_jurisdiction?.RO===3246&&index.entity_count_by_jurisdiction?.MD===2602,{counts:index.entity_count_by_jurisdiction});
 const byId=new Map((index.entities||[]).map(e=>[e.id,e]));
 const statIds=(index.entities||[]).filter(e=>e.category==='statistical').map(e=>e.id);
 check('exact_new_statistical_entity_count',statIds.length===18&&new Set(statIds).size===18,{count:statIds.length});
 check('ro_nuts3_reuse',roLayer.existing_entity_memberships.every(m=>byId.get(m.entity_id)?.statistical?.code===m.statistical.code&&byId.get(m.entity_id)?.hierarchy?.administrative_parent_id===byId.get(m.entity_id)?.hierarchy?.parent_catalog_id),{});
 check('md_reuse',mdLayer.existing_entity_statistical_roles.every(m=>byId.get(m.entity_id)?.statistical?.code===m.statistical.code),{});
 check('no_md121_identity',!(index.entities||[]).some(e=>e.statistical?.code==='MD121'),{});
 const tree=index.hierarchy_tree;
 check('consolidated_tree_complete',tree?.contract===HIERARCHY_CONTRACT&&tree?.root_count===2&&tree?.node_count===5848&&(tree.nodes||[]).length===5848,{root_count:tree?.root_count,node_count:tree?.node_count});
 const statOverviewCount=(roOverview.features||[]).filter(f=>f.properties?.geometry_role==='statistical_boundary').length+(mdOverview.features||[]).filter(f=>f.properties?.geometry_role==='statistical_boundary').length;
 check('statistical_only_geometries_exact',statOverviewCount===18,{count:statOverviewCount});
 check('administrative_geometry_reuse_not_duplicated',roLayer.existing_entity_memberships.every(x=>x.geometry_reuse?.duplicate_geometry===false&&x.geometry_reuse?.geometry_modified===false)&&mdLayer.existing_entity_statistical_roles.every(x=>x.geometry_reuse?.duplicate_geometry===false&&x.geometry_reuse?.geometry_modified===false),{});
 check('marker_source_bindings',marker.ro_layer_fingerprint_sha256===roLayer.layer_fingerprint_sha256&&marker.md_layer_fingerprint_sha256===mdLayer.layer_fingerprint_sha256&&marker.ro_statistical_osm_semantic_sha256===roOsm.semantic_sha256&&marker.md_statistical_osm_semantic_sha256===mdOsm.semantic_sha256,{});
 return {schema_version:1,mode:'ACTUAL_STATISTICAL_PUBLIC_P2_3_GATE',phase:'P2.3_PUBLIC',status:failures.length?'FAIL':'PASS',checks,failures,summary:{public_entity_count:index.entity_count,statistical_only_entity_count:18,hierarchy_node_count:tree?.node_count??null}};
}
