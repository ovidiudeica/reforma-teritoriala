import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import osmtogeojson from 'osmtogeojson';
import {bbox,centroid} from '@turf/turf';

export const STATISTICAL_POLICY_PATH='data/sources/actual-statistical-policy.json';
export const RO_LAYER_PATH='data/p2/actual-statistical-ro.json';
export const MD_LAYER_PATH='data/p2/actual-statistical-md.json';
export const PUBLIC_INDEX_PATH='public/data/actual-entities.json';
export const TREE_PATH='public/data/actual-consolidated-tree.json';
export const RO_STAT_GEO_PATH='public/geo/actual/ro-statistical.geojson';
export const MD_STAT_GEO_PATH='public/geo/actual/md-statistical.geojson';
export const PUBLIC_CONTRACT='actual-public-entity-v3';
export const TREE_CONTRACT='actual-consolidated-hierarchy-v1';
export const STAT_GEOMETRY_CONTRACT='actual-public-statistical-geometry-v1';

const sha256=b=>createHash('sha256').update(b).digest('hex');
const readJson=async(path,readFileFn=readFile)=>JSON.parse((await readFileFn(path)).toString('utf8'));
const uniq=a=>[...new Set(a)];
const clean=v=>v==null?null:String(v);

function sourceGeometry(raw,relationId){
 const geo=osmtogeojson(raw,{flatProperties:false});
 const feature=(geo.features||[]).find(f=>String(f.id)==='relation/'+relationId);
 if(!feature||!['Polygon','MultiPolygon'].includes(feature.geometry?.type))throw new Error('Missing polygonal statistical OSM relation '+relationId);
 return feature.geometry;
}

async function snapshotGeometryMap(layer,readFileFn=readFile){
 const manifest=await readJson(layer.sources.osm_statistical.path,readFileFn);
 const compressed=await readFileFn(manifest.snapshot_path);
 if(sha256(compressed)!==manifest.compressed_sha256)throw new Error('Statistical OSM compressed snapshot hash mismatch '+manifest.snapshot_path);
 const semantic=gunzipSync(compressed);
 if(sha256(semantic)!==manifest.semantic_sha256)throw new Error('Statistical OSM semantic snapshot hash mismatch '+manifest.snapshot_path);
 const raw=JSON.parse(semantic.toString('utf8'));
 const out=new Map();
 for(const entity of layer.statistical_entities||[]){
  out.set(entity.id,sourceGeometry(raw,Number(entity.representation.osm_relation_id)));
 }
 return {manifest,raw,geometries:out};
}

const rootIds={RO:'osm-r90689',MD:'osm-r58974'};
const normalizedAdminParent=(entity)=>{
 const p=entity.hierarchy?.parent_catalog_id??null;
 if(p==='RO'||p==='MD')return rootIds[entity.jurisdiction]||null;
 return p;
};

function baseRoles(entity){
 return [entity.category==='context'?'context':'administrative'];
}

function publicStatEntity(source,geometry){
 const b=bbox({type:'Feature',properties:{},geometry});
 const c=centroid({type:'Feature',properties:{},geometry}).geometry.coordinates;
 const level=Number(source.statistical.level);
 return {
  id:source.id,
  status:'current',
  jurisdiction:source.jurisdiction,
  category:'statistical',
  name:source.name,
  official_name:source.official_name||source.name,
  display_name:source.official_name||source.name||source.id,
  display_type:'statistical_level_'+level,
  searchable_names:uniq([source.name,source.official_name,source.statistical.code].filter(Boolean)),
  roles:['statistical'],
  legal:null,
  statistical:{...source.statistical},
  hierarchy:{
   parent_catalog_id:null,
   parent_name:null,
   legal_parent_id:null,
   legal_parent_name:null,
   administrative_parent_id:null,
   statistical_parent_id:source.statistical.parent_entity_id??null,
   statistical_parent_name:null,
   consolidated_parent_id:source.statistical.parent_entity_id??null,
   consolidated_parent_name:null
  },
  representation:{
   source:'OpenStreetMap',
   source_url:'https://www.openstreetmap.org/relation/'+source.representation.osm_relation_id,
   osm_relation_id:source.representation.osm_relation_id,
   source_feature_id:null,
   source_inspire_id:null,
   partition_mode:null,
   outer_shell_source:null,
   internal_boundary_source:null,
   osm_shell_relation_id:null,
   admin_level:null,
   place:null,
   inferred_type:'statistical_level_'+level,
   geometry_source:'OpenStreetMap statistical relation',
   geometry_role:'current_representation',
   canonical_geometry_role:'statistical_boundary',
   geometry_scope:source.representation.geometry_scope,
   public_geometry_precision:'master_coordinate_fidelity',
   master_geometry_path:source.representation.source_snapshot,
   statistical_identity_authority:source.statistical.identity_authority,
   osm_statistical_ref:source.representation.osm_statistical_ref??source.statistical.code,
   osm_ref_is_identity_authority:source.representation.osm_ref_is_identity_authority??false,
   identity_ref_conflict:source.representation.identity_ref_conflict??null,
   geometry_review_class:source.representation.geometry_review_class??null
  },
  validation:{
   legal_identity_status:'statistical_identity',
   statistical_identity_status:'official',
   reconciliation_class:null,
   review_status:null,
   review_source:null,
   match_confidence:'official',
   representation_confidence:'reviewed',
   review_required:false
  },
  map:{tier:'overview',bbox:b,center:c}
 };
}

function featureFor(entity,geometry){
 return {
  type:'Feature',
  properties:{
   entity_id:entity.id,
   jurisdiction:entity.jurisdiction,
   display_name:entity.display_name,
   display_type:entity.display_type,
   statistical_code:entity.statistical?.code??null,
   statistical_level:entity.statistical?.level??null,
   parent_entity_id:entity.hierarchy?.statistical_parent_id??null,
   osm_relation_id:entity.representation?.osm_relation_id??null,
   geometry_source:'OpenStreetMap',
   canonical_geometry_role:'statistical_boundary',
   geometry_scope:entity.representation?.geometry_scope??null,
   geometry_precision:'master_coordinate_fidelity'
  },
  geometry
 };
}

function buildTree(entities,generatedAt){
 const byId=new Map(entities.map(e=>[e.id,e]));
 const children=new Map();
 for(const e of entities){
  const parent=e.hierarchy?.consolidated_parent_id??null;
  if(parent&&!byId.has(parent))throw new Error('Consolidated parent missing for '+e.id+': '+parent);
  if(parent===e.id)throw new Error('Self-parent in consolidated tree '+e.id);
  if(!children.has(parent))children.set(parent,[]);
  children.get(parent).push(e.id);
 }
 const sortIds=ids=>ids.sort((a,b)=>{
  const ea=byId.get(a),eb=byId.get(b);
  const sa=ea?.roles?.includes('statistical')?0:1,sb=eb?.roles?.includes('statistical')?0:1;
  if(sa!==sb)return sa-sb;
  const la=Number(ea?.statistical?.level??99),lb=Number(eb?.statistical?.level??99);
  if(la!==lb)return la-lb;
  const ca=String(ea?.statistical?.code??''),cb=String(eb?.statistical?.code??'');
  if(ca!==cb)return ca.localeCompare(cb);
  return String(ea?.display_name??a).localeCompare(String(eb?.display_name??b),'ro');
 });
 for(const ids of children.values())sortIds(ids);
 const roots=[rootIds.RO,rootIds.MD];
 const depth=new Map(),seen=new Set(),queue=roots.map(id=>[id,0]);
 while(queue.length){
  const [id,d]=queue.shift();
  if(seen.has(id))throw new Error('Cycle/duplicate reachability in consolidated tree at '+id);
  seen.add(id);depth.set(id,d);
  for(const child of children.get(id)||[])queue.push([child,d+1]);
 }
 if(seen.size!==entities.length){
  const missing=entities.filter(e=>!seen.has(e.id)).map(e=>e.id);
  throw new Error('Unreachable consolidated tree entities: '+JSON.stringify(missing.slice(0,50)));
 }
 const nodes=entities.map(e=>({
  id:e.id,
  parent_id:e.hierarchy?.consolidated_parent_id??null,
  child_ids:children.get(e.id)||[],
  depth:depth.get(e.id),
  jurisdiction:e.jurisdiction,
  display_name:e.display_name,
  display_type:e.display_type,
  roles:e.roles||[],
  statistical_code:e.statistical?.code??null,
  statistical_level:e.statistical?.level??null
 })).sort((a,b)=>a.jurisdiction.localeCompare(b.jurisdiction)||a.depth-b.depth||a.id.localeCompare(b.id));
 return {
  schema_version:1,
  contract:TREE_CONTRACT,
  mode:'ACTUAL',
  generated_at:generatedAt,
  policy:'Single consolidated descending hierarchy: country, statistical levels, then administrative descendants. Entities with identical administrative/statistical territorial identity are coalesced into one node.',
  root_ids:roots,
  node_count:nodes.length,
  entity_count_by_jurisdiction:Object.fromEntries(['RO','MD'].map(j=>[j,nodes.filter(n=>n.jurisdiction===j).length])),
  max_depth:Math.max(...nodes.map(n=>n.depth)),
  nodes
 };
}

export async function buildActivatedStatisticalPublic({readFileFn=readFile}={}){
 const policy=await readJson(STATISTICAL_POLICY_PATH,readFileFn);
 if(policy?.activated!==true)return {status:'SKIP',reason:'statistical_policy_not_activated'};
 const [base,ro,md]=await Promise.all([
  readJson(PUBLIC_INDEX_PATH,readFileFn),
  readJson(RO_LAYER_PATH,readFileFn),
  readJson(MD_LAYER_PATH,readFileFn)
 ]);
 if(base.contract!=='actual-public-entity-v2'||Number(base.schema_version)!==2)throw new Error('P2.3 activation requires freshly built v2 administrative public index');
 const [roGeom,mdGeom]=await Promise.all([snapshotGeometryMap(ro,readFileFn),snapshotGeometryMap(md,readFileFn)]);
 const roMembership=new Map((ro.existing_entity_memberships||[]).map(x=>[x.entity_id,x]));
 const mdReuse=new Map((md.existing_entity_statistical_roles||[]).map(x=>[x.entity_id,x]));
 const mdComponent=new Map((md.administrative_component_bindings||[]).filter(x=>x.tree_edge_created!==false).map(x=>[x.entity_id,x]));
 const existing=base.entities.map(entity=>{
  const item=structuredClone(entity);
  const roRole=roMembership.get(item.id)||null;
  const mdRole=mdReuse.get(item.id)||null;
  const role=roRole||mdRole;
  const component=mdComponent.get(item.id)||null;
  item.roles=uniq([...baseRoles(item),...(role?['statistical']:[])]);
  if(role)item.statistical={...role.statistical};
  const adminParent=normalizedAdminParent(item);
  const statParent=role?.statistical?.parent_entity_id??null;
  const consolidated=statParent||component?.statistical_parent_entity_id||adminParent;
  item.hierarchy={
   ...item.hierarchy,
   administrative_parent_id:adminParent,
   statistical_parent_id:statParent,
   statistical_parent_name:null,
   consolidated_parent_id:item.id===rootIds[item.jurisdiction]?null:consolidated,
   consolidated_parent_name:null
  };
  return item;
 });
 const newSources=[...(ro.statistical_entities||[]),...(md.statistical_entities||[])];
 if(newSources.length!==18)throw new Error('Expected exactly 18 statistical-only entities, got '+newSources.length);
 const geometryById=new Map([...roGeom.geometries,...mdGeom.geometries]);
 const added=newSources.map(source=>publicStatEntity(source,geometryById.get(source.id)));
 const entities=[...existing,...added];
 if(new Set(entities.map(e=>e.id)).size!==entities.length)throw new Error('Duplicate public entity IDs after P2.3 activation');
 const byId=new Map(entities.map(e=>[e.id,e]));
 for(const e of entities){
  const sp=e.hierarchy?.statistical_parent_id;
  const cp=e.hierarchy?.consolidated_parent_id;
  e.hierarchy.statistical_parent_name=sp?byId.get(sp)?.display_name??null:null;
  e.hierarchy.consolidated_parent_name=cp?byId.get(cp)?.display_name??null:null;
 }
 entities.sort((a,b)=>a.jurisdiction.localeCompare(b.jurisdiction)||String(a.display_name).localeCompare(String(b.display_name),'ro')||a.id.localeCompare(b.id));
 const statusCounts=entities.reduce((a,e)=>(a[e.validation?.legal_identity_status??'unknown']=(a[e.validation?.legal_identity_status??'unknown']||0)+1,a),{});
 const counts=Object.fromEntries(['RO','MD'].map(j=>[j,entities.filter(e=>e.jurisdiction===j).length]));
 const tree=buildTree(entities,base.generated_at??null);
 const roStatEntities=added.filter(e=>e.jurisdiction==='RO');
 const mdStatEntities=added.filter(e=>e.jurisdiction==='MD');
 const roGeo={type:'FeatureCollection',metadata:{schema_version:1,contract:STAT_GEOMETRY_CONTRACT,mode:'ACTUAL',jurisdiction:'RO',feature_count:roStatEntities.length,geometry_source:'OpenStreetMap',geometry_precision:'master_coordinate_fidelity'},features:roStatEntities.map(e=>featureFor(e,geometryById.get(e.id)))};
 const mdGeo={type:'FeatureCollection',metadata:{schema_version:1,contract:STAT_GEOMETRY_CONTRACT,mode:'ACTUAL',jurisdiction:'MD',feature_count:mdStatEntities.length,geometry_source:'OpenStreetMap',geometry_precision:'master_coordinate_fidelity'},features:mdStatEntities.map(e=>featureFor(e,geometryById.get(e.id)))};
 const index={
  ...base,
  schema_version:3,
  contract:PUBLIC_CONTRACT,
  policy:'Public ACTUAL contract v3 consolidates administrative and official statistical hierarchies while preserving separate identity authorities and geometry roles. Existing administrative entities/geometries remain unchanged; statistical-only entities use reviewed OSM statistical geometry and shared territorial entities are not duplicated.',
  entity_count:entities.length,
  administrative_entity_count:base.entity_count,
  statistical_only_entity_count:added.length,
  statistical_role_entity_count:entities.filter(e=>e.roles?.includes('statistical')).length,
  entity_count_by_jurisdiction:counts,
  legal_identity_status_counts:statusCounts,
  hierarchy:{contract:TREE_CONTRACT,path:TREE_PATH,root_ids:tree.root_ids,node_count:tree.node_count},
  statistical_geometry:{
   RO:{path:RO_STAT_GEO_PATH,contract:STAT_GEOMETRY_CONTRACT,feature_count:roGeo.features.length},
   MD:{path:MD_STAT_GEO_PATH,contract:STAT_GEOMETRY_CONTRACT,feature_count:mdGeo.features.length}
  },
  entities
 };
 return {status:'PASS',policy,index,tree,roGeo,mdGeo};
}

export async function activateStatisticalPublic({readFileFn=readFile,writeFileFn=writeFile}={}){
 const built=await buildActivatedStatisticalPublic({readFileFn});
 if(built.status==='SKIP')return built;
 await writeFileFn(PUBLIC_INDEX_PATH,JSON.stringify(built.index,null,2)+'\n');
 await writeFileFn(TREE_PATH,JSON.stringify(built.tree,null,2)+'\n');
 await writeFileFn(RO_STAT_GEO_PATH,JSON.stringify(built.roGeo));
 await writeFileFn(MD_STAT_GEO_PATH,JSON.stringify(built.mdGeo));
 return {status:'PASS',entity_count:built.index.entity_count,statistical_only_entity_count:built.index.statistical_only_entity_count,statistical_role_entity_count:built.index.statistical_role_entity_count,tree_node_count:built.tree.node_count,counts:built.index.entity_count_by_jurisdiction};
}

export async function validateActivatedStatisticalPublic({readFileFn=readFile}={}){
 const policy=await readJson(STATISTICAL_POLICY_PATH,readFileFn);
 if(policy?.activated!==true)return {status:'SKIP',phase:policy?.phase??null,checks:[],failures:[]};
 const expected=await buildActivatedStatisticalPublic({readFileFn:async path=>{
  if(path===PUBLIC_INDEX_PATH){
   const persisted=await readJson(PUBLIC_INDEX_PATH,readFileFn);
   if(persisted.contract==='actual-public-entity-v3'){
    const clone=structuredClone(persisted);
    clone.schema_version=2;clone.contract='actual-public-entity-v2';
    clone.policy='synthetic-base';
    clone.entity_count=clone.administrative_entity_count;
    clone.entity_count_by_jurisdiction={RO:3234,MD:2596};
    clone.entities=clone.entities.filter(e=>!String(e.id).startsWith('stat-')).map(e=>{
     const x=structuredClone(e);
     delete x.roles;delete x.statistical;
     if(x.hierarchy){delete x.hierarchy.administrative_parent_id;delete x.hierarchy.statistical_parent_id;delete x.hierarchy.statistical_parent_name;delete x.hierarchy.consolidated_parent_id;delete x.hierarchy.consolidated_parent_name;}
     return x;
    });
    delete clone.administrative_entity_count;delete clone.statistical_only_entity_count;delete clone.statistical_role_entity_count;delete clone.hierarchy;delete clone.statistical_geometry;
    return Buffer.from(JSON.stringify(clone));
   }
  }
  return readFileFn(path);
 }});
 const [index,tree,roGeo,mdGeo]=await Promise.all([readJson(PUBLIC_INDEX_PATH,readFileFn),readJson(TREE_PATH,readFileFn),readJson(RO_STAT_GEO_PATH,readFileFn),readJson(MD_STAT_GEO_PATH,readFileFn)]);
 const checks=[],failures=[];const check=(name,ok,detail={})=>{checks.push({name,ok:Boolean(ok),detail});if(!ok)failures.push({name,detail});};
 check('public_contract_v3',index.contract===PUBLIC_CONTRACT&&index.schema_version===3,{contract:index.contract,schema_version:index.schema_version});
 check('public_counts_exact',index.entity_count===5848&&index.administrative_entity_count===5830&&index.statistical_only_entity_count===18&&index.statistical_role_entity_count===63&&index.entity_count_by_jurisdiction?.RO===3246&&index.entity_count_by_jurisdiction?.MD===2602,{entity_count:index.entity_count,counts:index.entity_count_by_jurisdiction});
 const statOnly=(index.entities||[]).filter(e=>String(e.id).startsWith('stat-'));
 check('statistical_only_ids_exact',statOnly.length===18&&new Set(statOnly.map(e=>e.id)).size===18,{ids:statOnly.map(e=>e.id)});
 check('reused_statistical_entities_exact',(index.entities||[]).filter(e=>!String(e.id).startsWith('stat-')&&e.roles?.includes('statistical')).length===45,{});
 check('no_md121_identity',!(index.entities||[]).some(e=>e.statistical?.code==='MD121'),{});
 check('statistical_geometry_cardinality',roGeo.features?.length===12&&mdGeo.features?.length===6,{RO:roGeo.features?.length,MD:mdGeo.features?.length});
 const statGeoIds=new Set([...(roGeo.features||[]),...(mdGeo.features||[])].map(f=>f.properties?.entity_id));
 check('no_reused_geometry_duplication',statGeoIds.size===18&&[...(index.entities||[])].filter(e=>!String(e.id).startsWith('stat-')&&e.roles?.includes('statistical')).every(e=>!statGeoIds.has(e.id)),{});
 check('tree_contract_exact',tree.contract===TREE_CONTRACT&&tree.node_count===5848&&tree.root_ids?.length===2&&tree.nodes?.length===5848,{node_count:tree.node_count,roots:tree.root_ids});
 const treeIds=new Set((tree.nodes||[]).map(n=>n.id));
 check('tree_covers_public_contract_once',treeIds.size===5848&&(index.entities||[]).every(e=>treeIds.has(e.id)),{tree_unique:treeIds.size});
 check('tree_statistical_before_administrative',(tree.nodes||[]).filter(n=>n.roles?.includes('statistical')&&n.statistical_level&&n.parent_id).every(n=>{const p=(tree.nodes||[]).find(x=>x.id===n.parent_id);return n.statistical_level===1||p?.roles?.includes('statistical')||p?.display_type==='state';}),{});
 check('persisted_outputs_match_deterministic_build',expected.status==='PASS'&&expected.index.entity_count===index.entity_count&&expected.tree.node_count===tree.node_count,{expected_status:expected.status});
 return {schema_version:1,mode:'ACTUAL_STATISTICAL_PUBLIC_P2_3_GATE',phase:'P2.3_PUBLIC',status:failures.length?'FAIL':'PASS',checks,failures,summary:{entity_count:index.entity_count,statistical_only_entities:statOnly.length,reused_statistical_entities:45,tree_node_count:tree.node_count,statistical_geometry_features:18}};
}
